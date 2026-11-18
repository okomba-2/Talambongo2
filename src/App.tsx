/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { onIdTokenChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';
import {
  deleteExpenseFromFirestore,
  ensureAdminRegistryEntry,
  incrementUserActivityCounter,
  loadUserExpensesFromFirestore,
  recordSubscriptionInFirestore,
  resolveUserRole,
  syncExpenseToFirestore,
  syncUserAccountOnAuth,
  updateUserAccountDoc,
  VerifiedRoleResolution,
} from './services/firebaseService';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { CalendarSection } from './components/CalendarSection';
import { MonthlyReportSection } from './components/MonthlyReportSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { PricingSection } from './components/PricingSection';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';
import { AuthScreen } from './components/AuthScreen';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Expense, UserProfile } from './types';
import { INITIAL_EXPENSES, INITIAL_USER } from './data/initialData';
import { convertAmount } from './utils/currency';
import { pruneExpiredExpenses } from './utils/historyRetention';

type AppView = 'landing' | 'auth' | 'onboarding' | 'app' | 'admin';

export default function App() {
  // Current view: 'landing' | 'auth' | 'onboarding' | 'app' | 'admin'
  const [view, setView] = useState<AppView>('landing');
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [roleResolution, setRoleResolution] = useState<VerifiedRoleResolution | null>(null);

  const [authInitialMode, setAuthInitialMode] = useState<'signup' | 'login'>('signup');

  // Stocke temporairement le nom saisi et l'intention (signup/login) lors d'une connexion via AuthScreen
  const pendingAuthRef = useRef<{ name?: string; mode?: 'signup' | 'login' } | null>(null);
  const lastResolvedUidRef = useRef<string | null>(null);

  // Persistent User profile
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('talambongo_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_USER,
          ...parsed,
          currency: parsed.currency || 'XOF',
        };
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_USER;
  });

  // Persistent Expenses list (avec application stricte de la conservation jusqu'au 3 de chaque mois)
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('talambongo_expenses');
    let loaded: Expense[] = INITIAL_EXPENSES;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          loaded = parsed.map((e) => ({
            ...e,
            currency: e.currency || 'XOF',
          }));
        }
      } catch (e) {
        console.error(e);
      }
    }
    const { validExpenses } = pruneExpiredExpenses(loaded);
    return validExpenses;
  });

  // Écoute sécurisée de Firebase Auth & renouvellement du token (onIdTokenChanged)
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
      if (!fbUser) {
        lastResolvedUidRef.current = null;
        setFirebaseUser(null);
        setRoleResolution(null);
        localStorage.removeItem('talambongo_auth_active');
        setView((prev) => (prev === 'auth' ? 'auth' : 'landing'));
        setAuthChecking(false);
        return;
      }

      try {
        setFirebaseUser(fbUser);
        const resolved = await resolveUserRole(fbUser);
        setRoleResolution(resolved);

        const isNewSessionResolution = lastResolvedUidRef.current !== fbUser.uid;
        lastResolvedUidRef.current = fbUser.uid;

        if (resolved.role === 'ADMIN') {
          await ensureAdminRegistryEntry(fbUser);
          const pending = pendingAuthRef.current;
          const syncedProfile = await syncUserAccountOnAuth(
            fbUser,
            'ADMIN',
            pending?.name,
            pending?.mode
          );
          pendingAuthRef.current = null;
          setUser(syncedProfile);
          localStorage.setItem('talambongo_auth_active', 'true');
          // L'interface administrateur reste en mode clair contrasté
          document.documentElement.classList.remove('dark');
          setView('admin');
        } else {
          const pending = pendingAuthRef.current;
          if (isNewSessionResolution || pending) {
            const syncedProfile = await syncUserAccountOnAuth(
              fbUser,
              'USER',
              pending?.name,
              pending?.mode
            );
            pendingAuthRef.current = null;
            setUser(syncedProfile);

            const cloudExpenses = await loadUserExpensesFromFirestore(fbUser.uid);
            const { validExpenses } = pruneExpiredExpenses(cloudExpenses);
            setExpenses(validExpenses);

            localStorage.setItem('talambongo_auth_active', 'true');
            if (syncedProfile.onboardingCompleted === false) {
              setView('onboarding');
            } else {
              setView('app');
            }
          } else {
            // Vérification continue lors du rafraîchissement du token : empêcher l'accès admin si rôle USER
            setView((prev) => (prev === 'admin' ? 'app' : prev));
          }
        }
      } catch (err) {
        console.error('Erreur vérification rôle Firebase:', err);
      } finally {
        setAuthChecking(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Rétention mensuelle : les données du mois précédent sont automatiquement supprimées le 3 de chaque mois
  // Les données du mois en cours restent totalement intactes
  useEffect(() => {
    const { validExpenses, removedCount } = pruneExpiredExpenses(expenses);
    if (removedCount > 0) {
      setExpenses(validExpenses);
    }
  }, [expenses]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('talambongo_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('talambongo_user', JSON.stringify(user));
  }, [user]);

  // Empêcher html.dark sur la landing page ou l'espace administrateur
  useEffect(() => {
    if (view !== 'app') {
      document.documentElement.classList.remove('dark');
    } else {
      const savedTheme = localStorage.getItem('talambongo_theme');
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    }
  }, [view]);

  // Initialisation native Capacitor (Play Store & App Store)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#059669' }).catch(() => {});
      SplashScreen.hide().catch(() => {});

      const backListener = CapApp.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          CapApp.exitApp();
        } else {
          window.history.back();
        }
      });

      return () => {
        backListener.then((sub) => sub.remove()).catch(() => {});
      };
    }
  }, []);

  // Navigate to Auth Screen
  const handleStart = (mode: 'signup' | 'login' = 'signup') => {
    setAuthInitialMode(mode);
    setView('auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auth Success -> stores user intent; actual redirection is strictly governed by verified Firebase role in onIdTokenChanged
  const handleAuthSuccess = (
    userInfo: { name: string; email: string },
    mode: 'signup' | 'login'
  ) => {
    pendingAuthRef.current = { name: userInfo.name, mode };
    if (auth.currentUser) {
      setAuthChecking(true);
      resolveUserRole(auth.currentUser, true)
        .then(async (resolved) => {
          setRoleResolution(resolved);
          if (resolved.role === 'ADMIN') {
            await ensureAdminRegistryEntry(auth.currentUser!);
            const synced = await syncUserAccountOnAuth(
              auth.currentUser!,
              'ADMIN',
              userInfo.name,
              mode
            );
            setUser(synced);
            setView('admin');
          } else {
            const synced = await syncUserAccountOnAuth(
              auth.currentUser!,
              'USER',
              userInfo.name,
              mode
            );
            setUser(synced);
            const cloudExpenses = await loadUserExpensesFromFirestore(auth.currentUser!.uid);
            const { validExpenses } = pruneExpiredExpenses(cloudExpenses);
            setExpenses(validExpenses);
            setView(synced.onboardingCompleted === false ? 'onboarding' : 'app');
          }
          localStorage.setItem('talambongo_auth_active', 'true');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        })
        .catch((err) => console.error(err))
        .finally(() => {
          pendingAuthRef.current = null;
          setAuthChecking(false);
        });
    }
  };

  // Onboarding Complete -> proceed to Dashboard
  const handleOnboardingComplete = (data: {
    country: string;
    mainGoal: string;
    trackingFrequency: string;
  }) => {
    const nextUpdates: Partial<UserProfile> = {
      country: data.country,
      mainGoal: data.mainGoal,
      trackingFrequency: data.trackingFrequency,
      onboardingCompleted: true,
    };
    setUser((prev) => ({
      ...prev,
      ...nextUpdates,
    }));
    if (firebaseUser) {
      updateUserAccountDoc(firebaseUser.uid, nextUpdates).catch((err) =>
        console.error('Sync onboarding error:', err)
      );
    }
    setView('app');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Logout -> sign out from Firebase Auth & return to landing page
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('SignOut error:', err);
    }
    lastResolvedUidRef.current = null;
    pendingAuthRef.current = null;
    localStorage.removeItem('talambongo_auth_active');
    setFirebaseUser(null);
    setRoleResolution(null);
    setView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add Expense
  const handleAddExpense = (newExpData: Omit<Expense, 'id' | 'createdAt'>) => {
    const newExpense: Expense = {
      ...newExpData,
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    setExpenses((prev) => [newExpense, ...prev]);

    if (firebaseUser) {
      syncExpenseToFirestore(firebaseUser.uid, newExpense).catch((err) =>
        console.error('Sync expense error:', err)
      );
    }
  };

  // Delete Expense
  const handleDeleteExpense = (id: string) => {
    setExpenses((prev) => {
      const next = prev.filter((e) => e.id !== id);
      if (firebaseUser) {
        deleteExpenseFromFirestore(firebaseUser.uid, id, next.length).catch((err) =>
          console.error('Delete expense error:', err)
        );
      }
      return next;
    });
  };

  // Update User Profile (+ record subscription payment in Firestore when upgrading to Premium)
  const handleUpdateUser = (updated: Partial<UserProfile>) => {
    setUser((prev) => {
      const merged = { ...prev, ...updated };
      if (firebaseUser) {
        if (updated.status === 'Premium') {
          const planType =
            updated.subscriptionType === 'quarterly' ? 'quarterly' : 'monthly';
          const activeCurrency = merged.currency || 'XOF';
          const baseXof = planType === 'quarterly' ? 2700 : 1000;
          const amount =
            activeCurrency === 'EUR'
              ? Math.round(convertAmount(baseXof, 'XOF', 'EUR') * 100) / 100
              : Math.round(convertAmount(baseXof, 'XOF', activeCurrency));

          recordSubscriptionInFirestore(firebaseUser.uid, {
            country: merged.country || 'Congo-Brazzaville',
            planType,
            currency: activeCurrency,
            amount,
          }).catch((err) => console.error('Subscription sync error:', err));
        } else {
          updateUserAccountDoc(firebaseUser.uid, updated).catch((err) =>
            console.error('Update user error:', err)
          );
        }
      }
      return merged;
    });
  };

  const handleReportViewed = () => {
    if (firebaseUser) {
      incrementUserActivityCounter(firebaseUser.uid, 'reportsViewedCount').catch((err) =>
        console.error('Report telemetry error:', err)
      );
    }
  };

  const handlePdfExported = () => {
    if (firebaseUser) {
      incrementUserActivityCounter(firebaseUser.uid, 'pdfExportsCount').catch((err) =>
        console.error('PDF export telemetry error:', err)
      );
    }
  };

  // Guard: vérifier que la vue admin est strictement inaccessible sans rôle ADMIN vérifié
  const isVerifiedAdmin =
    Boolean(firebaseUser) && roleResolution?.role === 'ADMIN';

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex flex-col items-center justify-center gap-3 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-gray-500">
          Vérification sécurisée de votre session...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#0f172a] flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Offline Status Indicator banner (PWA) */}
      <OfflineIndicator />

      {/* VIEW: AUTHENTICATION SCREEN */}
      {view === 'auth' && (
        <AuthScreen
          initialMode={authInitialMode}
          onSuccess={handleAuthSuccess}
          onBack={() => setView('landing')}
        />
      )}

      {/* VIEW: ONBOARDING SCREEN (3 STEPS) */}
      {view === 'onboarding' && (
        <Onboarding
          userName={user.name}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* VIEW: LOGGED-IN USER DASHBOARD */}
      {view === 'app' && (
        <Dashboard
          user={user}
          expenses={expenses}
          onAddExpense={handleAddExpense}
          onDeleteExpense={handleDeleteExpense}
          onUpdateUser={handleUpdateUser}
          onLogout={handleLogout}
          onReportViewed={handleReportViewed}
          onPdfExported={handlePdfExported}
        />
      )}

      {/* VIEW: PROTECTED ADMIN DASHBOARD (ROLE ADMIN STRICTEMENT REQUIS) */}
      {view === 'admin' && isVerifiedAdmin && firebaseUser && roleResolution && (
        <AdminDashboard
          currentAdminUid={firebaseUser.uid}
          currentAdminName={user.name || firebaseUser.displayName || 'Administrateur'}
          currentAdminEmail={firebaseUser.email || user.email}
          roleResolution={roleResolution}
          onLogout={handleLogout}
        />
      )}

      {/* VIEW: FULL ORIGINAL LANDING PAGE (aucun bouton admin, aucun sélecteur de rôle) */}
      {view === 'landing' && (
        <>
          <Navbar onStart={() => handleStart('signup')} />

          <main className="flex-grow">
            <Hero onStart={() => handleStart('signup')} />
            <HowItWorks />
            <CalendarSection />
            <MonthlyReportSection />
            <TestimonialsSection />
            <PricingSection currency={user.currency || 'XOF'} onSelectPlan={() => handleStart('signup')} />
            <FinalCTA onStart={() => handleStart('signup')} />
          </main>

          <Footer />
        </>
      )}
    </div>
  );
}
