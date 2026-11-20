/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import {
  getRedirectResult,
  onIdTokenChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, browserPopupRedirectResolver } from './firebase';
import {
  deleteExpenseFromFirestore,
  ensureAdminRegistryEntry,
  getReferralSessionFromFirestore,
  incrementUserActivityCounter,
  loadUserExpensesFromFirestore,
  recordPartnerClickAndSession,
  RecordedSubscriptionResult,
  recordSubscriptionInFirestore,
  resolveUserRole,
  syncExpenseToFirestore,
  syncUserAccountOnAuth,
  updateUserAccountDoc,
  validateReferralCode,
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
import {
  Expense,
  ReferralAttributionPayload,
  SupportedCurrency,
  UserProfile,
} from './types';
import { INITIAL_EXPENSES, INITIAL_USER } from './data/initialData';
import { convertAmount, getCurrencyForCountry } from './utils/currency';
import { pruneExpiredExpenses } from './utils/historyRetention';
import { normalizeReferralCode } from './utils/partners';
import { canAccessFeature, getSubscriptionAccessState } from './utils/subscription';

const REFERRAL_STORAGE_KEY = 'talambongo_pending_referral';

function readStoredReferral(): ReferralAttributionPayload | null {
  try {
    const raw =
      sessionStorage.getItem(REFERRAL_STORAGE_KEY) ||
      localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReferralAttributionPayload>;
    if (parsed && typeof parsed.code === 'string' && typeof parsed.partnerId === 'string') {
      return {
        code: parsed.code,
        partnerId: parsed.partnerId,
        source: parsed.source === 'manual' ? 'manual' : 'link',
        sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : undefined,
      };
    }
  } catch {
    // Ignorer un JSON invalide
  }
  return null;
}

function persistPendingReferral(payload: ReferralAttributionPayload | null): void {
  try {
    if (!payload) {
      sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      return;
    }
    const serialized = JSON.stringify(payload);
    sessionStorage.setItem(REFERRAL_STORAGE_KEY, serialized);
    localStorage.setItem(REFERRAL_STORAGE_KEY, serialized);
  } catch {
    // Stockage navigateur indisponible
  }
}

function needsMandatoryOnboarding(profile: Pick<UserProfile, 'role' | 'onboardingCompleted' | 'country'>): boolean {
  if (profile.role === 'ADMIN') return false;
  const country = (profile.country || '').trim();
  return profile.onboardingCompleted !== true || country.length === 0 || country === 'Non sélectionné';
}

type AppView = 'landing' | 'auth' | 'onboarding' | 'app' | 'admin';

export default function App() {
  // Current view: 'landing' | 'auth' | 'onboarding' | 'app' | 'admin'
  const [view, setView] = useState<AppView>('landing');
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [roleResolution, setRoleResolution] = useState<VerifiedRoleResolution | null>(null);

  const [authInitialMode, setAuthInitialMode] = useState<'signup' | 'login'>('signup');
  const [activeReferral, setActiveReferral] = useState<ReferralAttributionPayload | null>(() =>
    readStoredReferral()
  );

  // Stocke temporairement le nom saisi, l'intention et l'attribution partenaire lors d'une connexion via AuthScreen
  const pendingAuthRef = useRef<{
    name?: string;
    mode?: 'signup' | 'login';
    referralAttribution?: ReferralAttributionPayload | null;
  } | null>(null);
  const activeReferralRef = useRef<ReferralAttributionPayload | null>(activeReferral);
  const lastResolvedUidRef = useRef<string | null>(null);
  const syncingUidRef = useRef<string | null>(null);
  const latestUserRef = useRef<UserProfile>(INITIAL_USER);

  useEffect(() => {
    activeReferralRef.current = activeReferral;
  }, [activeReferral]);

  // Capture du lien de parrainage (?ref=CODEPARTENAIRE), validation Firestore et enregistrement du clic/session en base
  useEffect(() => {
    let isMounted = true;

    const captureOrRestoreReferral = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const rawRef = searchParams.get('ref');

        if (rawRef) {
          const normalized = normalizeReferralCode(rawRef);
          const check = await validateReferralCode(normalized);
          if (!isMounted) return;

          if (!check.valid || !check.link) {
            // Ne jamais appliquer un code inexistant, suspendu, désactivé ou expiré
            persistPendingReferral(null);
            setActiveReferral(null);
            return;
          }

          const existingStored = readStoredReferral();
          if (
            existingStored &&
            existingStored.code === check.link.code &&
            existingStored.sessionId
          ) {
            const sessionDoc = await getReferralSessionFromFirestore(existingStored.sessionId);
            if (!isMounted) return;
            if (sessionDoc && sessionDoc.status === 'pending') {
              setActiveReferral(existingStored);
              return;
            }
          }

          const sessionToken =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

          const { sessionId } = await recordPartnerClickAndSession(
            check.link,
            sessionToken,
            window.location.pathname || '/'
          );
          if (!isMounted) return;

          const attribution: ReferralAttributionPayload = {
            partnerId: check.link.partnerId,
            code: check.link.code,
            source: 'link',
            sessionId,
          };
          persistPendingReferral(attribution);
          setActiveReferral(attribution);
          return;
        }

        // Sans ?ref=, restaurer une éventuelle session d'attribution toujours en attente et valide
        const stored = readStoredReferral();
        if (stored) {
          if (stored.sessionId) {
            const sessionDoc = await getReferralSessionFromFirestore(stored.sessionId);
            if (!isMounted) return;
            if (!sessionDoc || sessionDoc.status !== 'pending') {
              persistPendingReferral(null);
              setActiveReferral(null);
              return;
            }
          }
          const check = await validateReferralCode(stored.code);
          if (!isMounted) return;
          if (check.valid && check.link) {
            setActiveReferral(stored);
          } else {
            persistPendingReferral(null);
            setActiveReferral(null);
          }
        }
      } catch (err) {
        console.error('Erreur capture lien parrainage:', err);
      }
    };

    captureOrRestoreReferral();

    return () => {
      isMounted = false;
    };
  }, []);

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

  // Écoute sécurisée de Firebase Auth, persistance de session et retour de redirection Google
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      try {
        // Récupérer un éventuel retour après signInWithRedirect (mobile / popup bloquée)
        const redirectCred = await getRedirectResult(auth, browserPopupRedirectResolver).catch(
          () => null
        );
        const pendingRedirectMode = sessionStorage.getItem('talambongo_pending_auth_mode') as
          | 'signup'
          | 'login'
          | null;
        const pendingManualRefRaw = sessionStorage.getItem('talambongo_pending_manual_referral');
        if (redirectCred?.user && pendingRedirectMode) {
          let parsedRedirectReferral: ReferralAttributionPayload | null = activeReferralRef.current;
          if (pendingManualRefRaw) {
            try {
              parsedRedirectReferral = JSON.parse(pendingManualRefRaw) as ReferralAttributionPayload;
            } catch {
              // Ignorer
            }
          }
          pendingAuthRef.current = {
            name: redirectCred.user.displayName || undefined,
            mode: pendingRedirectMode,
            referralAttribution: parsedRedirectReferral,
          };
          sessionStorage.removeItem('talambongo_pending_auth_mode');
          sessionStorage.removeItem('talambongo_pending_manual_referral');
        }

        // Attendre que la persistance locale Firebase Auth soit complètement restaurée
        await auth.authStateReady();
      } catch (err) {
        console.error('Auth hydration error:', err);
      }

      if (!isMounted) return;

      unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
        if (!isMounted) return;

        if (!fbUser) {
          lastResolvedUidRef.current = null;
          syncingUidRef.current = null;
          setFirebaseUser(null);
          setRoleResolution(null);
          localStorage.removeItem('talambongo_auth_active');
          setView((prev) => (prev === 'auth' ? 'auth' : 'landing'));
          setAuthChecking(false);
          return;
        }

        try {
          setFirebaseUser(fbUser);
          const isNewSessionResolution = lastResolvedUidRef.current !== fbUser.uid;
          const pending = pendingAuthRef.current;

          if (isNewSessionResolution || pending) {
            if (syncingUidRef.current === fbUser.uid && !pending) {
              return;
            }
            syncingUidRef.current = fbUser.uid;
            const resolved = await resolveUserRole(fbUser);
            if (!isMounted) return;
            setRoleResolution(resolved);
            lastResolvedUidRef.current = fbUser.uid;

            const attributionToApply =
              pending?.referralAttribution !== undefined
                ? pending.referralAttribution
                : activeReferralRef.current;

            if (resolved.role === 'ADMIN') {
              await ensureAdminRegistryEntry(fbUser);
              const syncedProfile = await syncUserAccountOnAuth(
                fbUser,
                'ADMIN',
                pending?.name,
                pending?.mode
              );
              pendingAuthRef.current = null;
              syncingUidRef.current = null;
              if (!isMounted) return;
              latestUserRef.current = syncedProfile;
              setUser(syncedProfile);
              localStorage.setItem('talambongo_auth_active', 'true');
              document.documentElement.classList.remove('dark');
              setView('admin');
            } else {
              const syncedProfile = await syncUserAccountOnAuth(
                fbUser,
                'USER',
                pending?.name,
                pending?.mode,
                attributionToApply
              );
              pendingAuthRef.current = null;
              syncingUidRef.current = null;
              persistPendingReferral(null);
              if (!isMounted) return;
              setActiveReferral(null);
              latestUserRef.current = syncedProfile;
              setUser(syncedProfile);

              const cloudExpenses = await loadUserExpensesFromFirestore(fbUser.uid);
              const { validExpenses } = pruneExpiredExpenses(cloudExpenses);
              if (!isMounted) return;
              setExpenses(validExpenses);

              localStorage.setItem('talambongo_auth_active', 'true');
              if (needsMandatoryOnboarding(syncedProfile)) {
                setView('onboarding');
              } else {
                setView('app');
              }
            }
          } else {
            // Vérification continue lors du rafraîchissement du token : empêcher l'accès admin si rôle USER et empêcher de contourner l'onboarding
            const resolved = await resolveUserRole(fbUser);
            if (!isMounted) return;
            setRoleResolution(resolved);
            if (resolved.role !== 'ADMIN') {
              const mustOnboard = needsMandatoryOnboarding(latestUserRef.current);
              setView((prev) => {
                if (mustOnboard) return 'onboarding';
                if (prev === 'admin' || prev === 'landing' || prev === 'auth') return 'app';
                return prev;
              });
            }
          }
        } catch (err) {
          syncingUidRef.current = null;
          console.error('Erreur vérification session Firebase:', err);
          // Si l'utilisateur Firebase est authentifié mais temporairement hors-ligne, garder sa session active
          if (fbUser && isMounted) {
            localStorage.setItem('talambongo_auth_active', 'true');
            setView((prev) => (prev === 'landing' || prev === 'auth' ? 'app' : prev));
          }
        } finally {
          if (isMounted) {
            setAuthChecking(false);
          }
        }
      });
    };

    initAuth();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
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
    latestUserRef.current = user;
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

  const handleAuthAttempt = (intent: {
    name?: string;
    mode: 'signup' | 'login';
    referralAttribution?: ReferralAttributionPayload | null;
  }) => {
    pendingAuthRef.current = intent;
  };

  // Auth Success -> stores user intent; actual redirection is strictly governed by verified Firebase role
  const handleAuthSuccess = (
    userInfo: { name: string; email: string },
    mode: 'signup' | 'login',
    referralAttribution?: ReferralAttributionPayload | null
  ) => {
    const resolvedAttribution =
      referralAttribution !== undefined ? referralAttribution : activeReferralRef.current;
    pendingAuthRef.current = {
      name: userInfo.name,
      mode,
      referralAttribution: resolvedAttribution,
    };
    if (auth.currentUser) {
      const currentFbUser = auth.currentUser;
      // Si onIdTokenChanged est déjà en train ou vient de synchroniser cet UID, éviter une double écriture concurrente
      if (lastResolvedUidRef.current === currentFbUser.uid || syncingUidRef.current === currentFbUser.uid) {
        if (mode === 'signup' && userInfo.name && latestUserRef.current.name !== userInfo.name) {
          handleUpdateUser({ name: userInfo.name });
        }
        if (needsMandatoryOnboarding(latestUserRef.current)) {
          setView('onboarding');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setAuthChecking(true);
      syncingUidRef.current = currentFbUser.uid;
      resolveUserRole(currentFbUser, true)
        .then(async (resolved) => {
          setRoleResolution(resolved);
          lastResolvedUidRef.current = currentFbUser.uid;
          if (resolved.role === 'ADMIN') {
            await ensureAdminRegistryEntry(currentFbUser);
            const synced = await syncUserAccountOnAuth(
              currentFbUser,
              'ADMIN',
              userInfo.name,
              mode
            );
            latestUserRef.current = synced;
            setUser(synced);
            setView('admin');
          } else {
            const synced = await syncUserAccountOnAuth(
              currentFbUser,
              'USER',
              userInfo.name,
              mode,
              resolvedAttribution
            );
            persistPendingReferral(null);
            setActiveReferral(null);
            latestUserRef.current = synced;
            setUser(synced);
            const cloudExpenses = await loadUserExpensesFromFirestore(currentFbUser.uid);
            const { validExpenses } = pruneExpiredExpenses(cloudExpenses);
            setExpenses(validExpenses);
            setView(needsMandatoryOnboarding(synced) ? 'onboarding' : 'app');
          }
          localStorage.setItem('talambongo_auth_active', 'true');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        })
        .catch((err) => console.error(err))
        .finally(() => {
          pendingAuthRef.current = null;
          syncingUidRef.current = null;
          setAuthChecking(false);
        });
    }
  };

  // Onboarding Complete -> enregistre le pays + définit automatiquement la devise puis accède au Dashboard
  const handleOnboardingComplete = (data: {
    country: string;
    currency?: SupportedCurrency;
    mainGoal: string;
    trackingFrequency: string;
  }) => {
    const resolvedCurrency = data.currency || getCurrencyForCountry(data.country);
    const nextUpdates: Partial<UserProfile> = {
      country: data.country,
      currency: resolvedCurrency,
      mainGoal: data.mainGoal,
      trackingFrequency: data.trackingFrequency,
      onboardingCompleted: true,
    };
    setUser((prev) => {
      const updated = {
        ...prev,
        ...nextUpdates,
      };
      latestUserRef.current = updated;
      return updated;
    });
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

  // Add Expense (verrouillé si l'essai gratuit ou l'abonnement a expiré)
  const handleAddExpense = (newExpData: Omit<Expense, 'id' | 'createdAt'>) => {
    const accessState = getSubscriptionAccessState(latestUserRef.current);
    if (!canAccessFeature(accessState, 'add_expense')) {
      return;
    }

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

  // Delete Expense (verrouillé si l'essai gratuit ou l'abonnement a expiré)
  const handleDeleteExpense = (id: string) => {
    const accessState = getSubscriptionAccessState(latestUserRef.current);
    if (!canAccessFeature(accessState, 'delete_expense')) {
      return;
    }

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

  // Update User Profile (uniquement champs profil ; jamais de promotion Premium côté client sans confirmation paiement)
  const handleUpdateUser = (updated: Partial<UserProfile>) => {
    setUser((prev) => {
      const safeUpdates: Partial<UserProfile> = { ...updated };
      delete safeUpdates.status;
      delete safeUpdates.subscriptionStatus;
      delete safeUpdates.subscriptionType;
      delete safeUpdates.subscriptionStartAtMs;
      delete safeUpdates.subscriptionEndAtMs;
      delete safeUpdates.trialStartedAtMs;
      delete safeUpdates.trialEndsAtMs;
      delete safeUpdates.hasUsedFreeTrial;
      delete safeUpdates.trialDaysLeft;

      const merged = { ...prev, ...safeUpdates };
      latestUserRef.current = merged;
      if (firebaseUser && Object.keys(safeUpdates).length > 0) {
        updateUserAccountDoc(firebaseUser.uid, safeUpdates).catch((err) =>
          console.error('Update user error:', err)
        );
      }
      return merged;
    });
  };

  // Souscription / Renouvellement Premium : activation STRICTEMENT après confirmation serveur/Firestore
  const handleSubscribePlan = async (
    planType: 'monthly' | 'quarterly',
    idempotencyKey?: string
  ): Promise<RecordedSubscriptionResult> => {
    if (!firebaseUser) {
      throw new Error('Connexion requise pour finaliser le paiement.');
    }

    const currentProfile = latestUserRef.current;
    const activeCurrency = currentProfile.currency || 'XOF';
    const baseXof = planType === 'quarterly' ? 1200 : 500;
    const amount =
      activeCurrency === 'EUR'
        ? Math.round(convertAmount(baseXof, 'XOF', 'EUR') * 100) / 100
        : Math.round(convertAmount(baseXof, 'XOF', activeCurrency));

    const result = await recordSubscriptionInFirestore(firebaseUser.uid, {
      country: currentProfile.country || 'Congo-Brazzaville',
      planType,
      currency: activeCurrency,
      amount,
      paymentStatus: 'confirmed',
      idempotencyKey,
    });

    if (result.activated && result.paymentStatus === 'confirmed') {
      setUser((prev) => {
        const nextUser: UserProfile = {
          ...prev,
          status: 'Premium',
          subscriptionStatus: result.status,
          subscriptionType: planType,
          subscriptionStartAtMs: result.startAtMs,
          subscriptionEndAtMs: result.endAtMs,
          lastConfirmedSubscriptionId: result.subscriptionId,
          trialDaysLeft: 0,
        };
        latestUserRef.current = nextUser;
        return nextUser;
      });
    }

    return result;
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
          lockedReferral={activeReferral}
          onAuthAttempt={handleAuthAttempt}
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
          onSubscribePlan={handleSubscribePlan}
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
