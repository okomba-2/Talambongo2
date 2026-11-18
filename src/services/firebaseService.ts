import { User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  AdminRegistryEntry,
  AdminSettingsConfig,
  Expense,
  FirestoreSubscriptionRecord,
  FirestoreUserAccount,
  PaymentStatusType,
  SubscriptionPlanType,
  SubscriptionStatusType,
  SupportedCurrency,
  UserProfile,
  UserRole,
} from '../types';
import { convertAmount } from '../utils/currency';

export const BOOTSTRAP_ADMIN_EMAIL = 'okombacontact@gmail.com';

const VALID_CURRENCIES: SupportedCurrency[] = ['XOF', 'XAF', 'CDF', 'EUR'];

function sanitizeStr(value: string | undefined | null, fallback: string, maxLen: number): string {
  const cleaned = (value || '').trim();
  const nonEmpty = cleaned.length > 0 ? cleaned : fallback;
  return nonEmpty.slice(0, maxLen);
}

function normalizeCurrency(val: string | undefined): SupportedCurrency {
  if (val && (VALID_CURRENCIES as string[]).includes(val)) {
    return val as SupportedCurrency;
  }
  return 'XOF';
}

function timestampToMs(ts: unknown): number {
  if (ts instanceof Timestamp) {
    return ts.toMillis();
  }
  if (ts && typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === 'number') {
    return ts;
  }
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
}

export interface VerifiedRoleResolution {
  role: UserRole;
  source: 'custom_claim' | 'admin_registry' | 'bootstrap_email' | 'default_user';
  emailVerified: boolean;
}

/**
 * Vérification sécurisée du rôle à partir du token Firebase (Custom Claims)
 * et du registre /admins/{uid}. Ne fait jamais confiance à une valeur locale modifiable.
 */
export async function resolveUserRole(
  firebaseUser: FirebaseUser,
  forceRefresh = false
): Promise<VerifiedRoleResolution> {
  const tokenResult = await firebaseUser.getIdTokenResult(forceRefresh);
  const claims = tokenResult.claims || {};
  const emailVerified = Boolean(firebaseUser.emailVerified);
  const emailLower = (firebaseUser.email || '').toLowerCase();

  // 1. Custom Claims Firebase (ex: { role: 'ADMIN' } ou { admin: true })
  if (emailVerified && (claims.role === 'ADMIN' || claims.admin === true)) {
    return { role: 'ADMIN', source: 'custom_claim', emailVerified };
  }

  // 2. Email administrateur principal vérifié
  if (emailVerified && emailLower === BOOTSTRAP_ADMIN_EMAIL) {
    return { role: 'ADMIN', source: 'bootstrap_email', emailVerified };
  }

  // 3. Vérification dans le registre protégé /admins/{uid}
  if (emailVerified) {
    const adminPath = `admins/${firebaseUser.uid}`;
    try {
      const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
      if (adminSnap.exists()) {
        return { role: 'ADMIN', source: 'admin_registry', emailVerified };
      }
    } catch {
      // Si la lecture est refusée par les règles, l'utilisateur n'est pas admin.
      console.warn(`Admin check fallback for ${adminPath}`);
    }
  }

  return { role: 'USER', source: 'default_user', emailVerified };
}

/**
 * S'assure que le compte administrateur vérifié possède son entrée dans /admins/{uid}
 */
export async function ensureAdminRegistryEntry(firebaseUser: FirebaseUser): Promise<void> {
  const path = `admins/${firebaseUser.uid}`;
  try {
    const ref = doc(db, 'admins', firebaseUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: firebaseUser.uid,
        email: sanitizeStr(firebaseUser.email, BOOTSTRAP_ADMIN_EMAIL, 200),
        displayName: sanitizeStr(firebaseUser.displayName || firebaseUser.email?.split('@')[0], 'Administrateur', 120),
        grantedBy: 'system_bootstrap',
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Crée ou synchronise le document /users/{uid} lors d'une connexion / inscription.
 */
export async function syncUserAccountOnAuth(
  firebaseUser: FirebaseUser,
  verifiedRole: UserRole,
  preferredName?: string,
  authIntent?: 'signup' | 'login'
): Promise<UserProfile> {
  const uid = firebaseUser.uid;
  const userPath = `users/${uid}`;

  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      const existingRole: UserRole =
        verifiedRole === 'ADMIN' ? 'ADMIN' : data.role === 'ADMIN' ? 'USER' : 'USER';

      const subStatus = (data.subscriptionStatus as SubscriptionStatusType) || 'trial';
      const subType = (data.subscriptionType as SubscriptionPlanType) || 'free_trial';

      await updateDoc(userRef, {
        name: sanitizeStr(preferredName || data.name || firebaseUser.displayName, 'Utilisateur TalaMbongo', 120),
        ...(verifiedRole === 'ADMIN' && data.role !== 'ADMIN' ? { role: 'ADMIN' } : {}),
        lastActiveAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        uid,
        name: sanitizeStr(preferredName || data.name || firebaseUser.displayName, 'Utilisateur TalaMbongo', 120),
        email: sanitizeStr(data.email || firebaseUser.email, 'utilisateur@talambongo.app', 200),
        status: subStatus === 'active' || subStatus === 'renewed' ? 'Premium' : 'Essai gratuit',
        trialDaysLeft: typeof data.trialDaysLeft === 'number' ? data.trialDaysLeft : 7,
        country: typeof data.country === 'string' ? data.country : 'Congo-Brazzaville',
        mainGoal: typeof data.mainGoal === 'string' ? data.mainGoal : 'Comprendre où va mon argent',
        trackingFrequency: typeof data.trackingFrequency === 'string' ? data.trackingFrequency : 'Tous les jours',
        onboardingCompleted: Boolean(data.onboardingCompleted),
        currency: normalizeCurrency(data.currency),
        role: verifiedRole === 'ADMIN' ? 'ADMIN' : existingRole,
        subscriptionStatus: subStatus,
        subscriptionType: subType,
      };
    }

    // Création d'un nouveau compte utilisateur dans Firestore
    const displayName = sanitizeStr(
      preferredName || firebaseUser.displayName || firebaseUser.email?.split('@')[0],
      'Utilisateur TalaMbongo',
      120
    );
    const email = sanitizeStr(firebaseUser.email, `${uid}@talambongo.app`, 200);
    const initialOnboardingCompleted = verifiedRole === 'ADMIN' ? true : authIntent === 'login' ? false : false;

    const payload = {
      uid,
      name: displayName,
      email,
      country: 'Congo-Brazzaville',
      currency: 'XOF' as SupportedCurrency,
      role: verifiedRole,
      subscriptionStatus: 'trial' as SubscriptionStatusType,
      subscriptionType: 'free_trial' as SubscriptionPlanType,
      trialDaysLeft: 7,
      onboardingCompleted: initialOnboardingCompleted,
      expensesCount: 0,
      reportsViewedCount: 0,
      pdfExportsCount: 0,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, payload);

    return {
      uid,
      name: displayName,
      email,
      status: 'Essai gratuit',
      trialDaysLeft: 7,
      country: 'Congo-Brazzaville',
      onboardingCompleted: initialOnboardingCompleted,
      currency: 'XOF',
      role: verifiedRole,
      subscriptionStatus: 'trial',
      subscriptionType: 'free_trial',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateUserAccountDoc(
  uid: string,
  updates: Partial<UserProfile> & {
    subscriptionStartAt?: string;
    subscriptionEndAt?: string;
  }
): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const payload: Record<string, unknown> = {
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (updates.name !== undefined) {
      payload.name = sanitizeStr(updates.name, 'Utilisateur TalaMbongo', 120);
    }
    if (updates.country !== undefined) {
      payload.country = sanitizeStr(updates.country, 'Congo-Brazzaville', 80);
    }
    if (updates.currency !== undefined) {
      payload.currency = normalizeCurrency(updates.currency);
    }
    if (updates.mainGoal !== undefined) {
      payload.mainGoal = sanitizeStr(updates.mainGoal, 'Comprendre où va mon argent', 150);
    }
    if (updates.trackingFrequency !== undefined) {
      payload.trackingFrequency = sanitizeStr(updates.trackingFrequency, 'Tous les jours', 80);
    }
    if (updates.onboardingCompleted !== undefined) {
      payload.onboardingCompleted = Boolean(updates.onboardingCompleted);
    }
    if (updates.trialDaysLeft !== undefined) {
      payload.trialDaysLeft = Math.max(0, Math.min(365, Math.round(updates.trialDaysLeft)));
    }
    if (updates.status !== undefined) {
      payload.subscriptionStatus = updates.status === 'Premium' ? 'active' : 'trial';
    }
    if (updates.subscriptionStatus !== undefined) {
      payload.subscriptionStatus = updates.subscriptionStatus;
    }
    if (updates.subscriptionType !== undefined) {
      payload.subscriptionType = updates.subscriptionType;
    }
    if (updates.subscriptionStartAt !== undefined) {
      payload.subscriptionStartAt = sanitizeStr(updates.subscriptionStartAt, new Date().toISOString(), 40);
    }
    if (updates.subscriptionEndAt !== undefined) {
      payload.subscriptionEndAt = sanitizeStr(updates.subscriptionEndAt, new Date().toISOString(), 40);
    }

    await updateDoc(userRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function loadUserExpensesFromFirestore(uid: string): Promise<Expense[]> {
  const path = `users/${uid}/expenses`;
  try {
    const snapshot = await getDocs(collection(db, 'users', uid, 'expenses'));
    const list: Expense[] = snapshot.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: String(d.id || docSnap.id),
        title: String(d.title || 'Dépense'),
        amount: typeof d.amount === 'number' ? d.amount : 0,
        currency: normalizeCurrency(d.currency),
        category: d.category || 'Autres',
        moment: d.moment || 'Matin',
        date: String(d.date || new Date().toISOString().slice(0, 10)),
        note: typeof d.note === 'string' ? d.note : undefined,
        createdAt: timestampToMs(d.createdAt),
      };
    });
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function syncExpenseToFirestore(uid: string, expense: Expense): Promise<void> {
  const expensePath = `users/${uid}/expenses/${expense.id}`;
  try {
    const payload: Record<string, unknown> = {
      id: sanitizeStr(expense.id, `exp-${Date.now()}`, 128),
      userId: uid,
      title: sanitizeStr(expense.title, 'Dépense', 160),
      amount: typeof expense.amount === 'number' && expense.amount >= 0 ? expense.amount : 0,
      currency: normalizeCurrency(expense.currency),
      category: sanitizeStr(expense.category, 'Autres', 50),
      moment: ['Matin', 'Après-midi', 'Soir'].includes(expense.moment) ? expense.moment : 'Matin',
      date: /^\d{4}-\d{2}-\d{2}$/.test(expense.date)
        ? expense.date
        : new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp(),
    };

    if (expense.note && expense.note.trim().length > 0) {
      payload.note = sanitizeStr(expense.note, '', 300);
    }

    await setDoc(doc(db, 'users', uid, 'expenses', expense.id), payload);

    await updateDoc(doc(db, 'users', uid), {
      expensesCount: increment(1),
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, expensePath);
  }
}

export async function deleteExpenseFromFirestore(uid: string, expenseId: string, nextCount: number): Promise<void> {
  const expensePath = `users/${uid}/expenses/${expenseId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'expenses', expenseId));
    await updateDoc(doc(db, 'users', uid), {
      expensesCount: Math.max(0, nextCount),
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, expensePath);
  }
}

export async function incrementUserActivityCounter(
  uid: string,
  field: 'reportsViewedCount' | 'pdfExportsCount'
): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      [field]: increment(1),
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function recordSubscriptionInFirestore(
  uid: string,
  params: {
    country: string;
    planType: 'monthly' | 'quarterly';
    currency: SupportedCurrency;
    amount: number;
  }
): Promise<void> {
  const subId = `sub-${uid.slice(0, 12)}-${Date.now()}`;
  const subPath = `subscriptions/${subId}`;
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + (params.planType === 'quarterly' ? 3 : 1));

  const startDate = now.toISOString();
  const endDate = end.toISOString();
  const amountXof = Math.round(convertAmount(params.amount, params.currency, 'XOF'));

  try {
    await setDoc(doc(db, 'subscriptions', subId), {
      userId: uid,
      country: sanitizeStr(params.country, 'Congo-Brazzaville', 80),
      planType: params.planType,
      status: 'active',
      paymentStatus: 'confirmed',
      amount: Math.max(0, params.amount),
      currency: normalizeCurrency(params.currency),
      amountXof: Math.max(0, amountXof),
      startDate,
      endDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateUserAccountDoc(uid, {
      status: 'Premium',
      subscriptionStatus: 'active',
      subscriptionType: params.planType,
      subscriptionStartAt: startDate,
      subscriptionEndAt: endDate,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, subPath);
  }
}

// =========================================================================
// FONCTIONS ADMINISTRATEUR (PROTÉGÉES PAR RÈGLES FIRESTORE)
// Aucune requête n'accède aux sous-collections /users/{uid}/expenses
// =========================================================================

export interface AdminDashboardPayload {
  users: FirestoreUserAccount[];
  subscriptions: FirestoreSubscriptionRecord[];
  admins: AdminRegistryEntry[];
  settings: AdminSettingsConfig;
}

export async function fetchAdminDashboardData(): Promise<AdminDashboardPayload> {
  if (!auth.currentUser) {
    throw new Error('Authentification requise.');
  }

  let users: FirestoreUserAccount[] = [];
  let subscriptions: FirestoreSubscriptionRecord[] = [];
  let admins: AdminRegistryEntry[] = [];
  let settings: AdminSettingsConfig = {
    activeActivityThresholdDays: 30,
    defaultAdminCurrency: 'XOF',
  };

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    users = usersSnap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        uid: String(d.uid || docSnap.id),
        name: String(d.name || 'Utilisateur'),
        email: String(d.email || ''),
        country: String(d.country || 'Non spécifié'),
        currency: normalizeCurrency(d.currency),
        role: d.role === 'ADMIN' ? 'ADMIN' : 'USER',
        subscriptionStatus: (d.subscriptionStatus as SubscriptionStatusType) || 'trial',
        subscriptionType: (d.subscriptionType as SubscriptionPlanType) || 'free_trial',
        subscriptionStartAt: typeof d.subscriptionStartAt === 'string' ? d.subscriptionStartAt : undefined,
        subscriptionEndAt: typeof d.subscriptionEndAt === 'string' ? d.subscriptionEndAt : undefined,
        trialDaysLeft: typeof d.trialDaysLeft === 'number' ? d.trialDaysLeft : 7,
        mainGoal: typeof d.mainGoal === 'string' ? d.mainGoal : undefined,
        trackingFrequency: typeof d.trackingFrequency === 'string' ? d.trackingFrequency : undefined,
        onboardingCompleted: Boolean(d.onboardingCompleted),
        expensesCount: typeof d.expensesCount === 'number' ? d.expensesCount : 0,
        reportsViewedCount: typeof d.reportsViewedCount === 'number' ? d.reportsViewedCount : 0,
        pdfExportsCount: typeof d.pdfExportsCount === 'number' ? d.pdfExportsCount : 0,
        createdAtMs: timestampToMs(d.createdAt),
        lastActiveAtMs: timestampToMs(d.lastActiveAt),
        updatedAtMs: timestampToMs(d.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }

  try {
    const subsSnap = await getDocs(collection(db, 'subscriptions'));
    subscriptions = subsSnap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        userId: String(d.userId || ''),
        country: String(d.country || 'Non spécifié'),
        planType: (d.planType as SubscriptionPlanType) || 'monthly',
        status: (d.status as SubscriptionStatusType) || 'active',
        paymentStatus: (d.paymentStatus as PaymentStatusType) || 'confirmed',
        amount: typeof d.amount === 'number' ? d.amount : 0,
        currency: normalizeCurrency(d.currency),
        amountXof: typeof d.amountXof === 'number' ? d.amountXof : 0,
        startDate: String(d.startDate || ''),
        endDate: String(d.endDate || ''),
        createdAtMs: timestampToMs(d.createdAt),
        updatedAtMs: timestampToMs(d.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'subscriptions');
  }

  try {
    const adminsSnap = await getDocs(collection(db, 'admins'));
    admins = adminsSnap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        uid: String(d.uid || docSnap.id),
        email: String(d.email || ''),
        displayName: String(d.displayName || 'Administrateur'),
        grantedBy: String(d.grantedBy || ''),
        createdAtMs: timestampToMs(d.createdAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'admins');
  }

  try {
    const settingsSnap = await getDoc(doc(db, 'admin_stats', 'settings'));
    if (settingsSnap.exists()) {
      const d = settingsSnap.data();
      settings = {
        activeActivityThresholdDays:
          typeof d.activeActivityThresholdDays === 'number' && d.activeActivityThresholdDays > 0
            ? d.activeActivityThresholdDays
            : 30,
        defaultAdminCurrency: normalizeCurrency(d.defaultAdminCurrency),
        updatedAtMs: timestampToMs(d.updatedAt),
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'admin_stats/settings');
  }

  return { users, subscriptions, admins, settings };
}

export async function syncAdminStatsSummary(summary: {
  totalUsers: number;
  activeUsers30d: number;
  paidUsers: number;
  freeUsers: number;
  totalRevenueXof: number;
  countriesCount: number;
  totalExpensesLogged: number;
  totalReportsViewed: number;
  totalPdfExports: number;
  usersWithExpenses: number;
}): Promise<void> {
  const path = 'admin_stats/global_summary';
  try {
    await setDoc(doc(db, 'admin_stats', 'global_summary'), {
      ...summary,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveAdminSettings(settings: AdminSettingsConfig): Promise<void> {
  const path = 'admin_stats/settings';
  try {
    await setDoc(doc(db, 'admin_stats', 'settings'), {
      activeActivityThresholdDays: Math.max(
        1,
        Math.min(365, Math.round(settings.activeActivityThresholdDays))
      ),
      defaultAdminCurrency: normalizeCurrency(settings.defaultAdminCurrency),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function grantAdminAccess(params: {
  uid: string;
  email: string;
  displayName: string;
  grantedBy: string;
}): Promise<void> {
  const uid = params.uid.trim();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) {
    throw new Error('Identifiant UID invalide (caractères alphanumériques, tirets ou underscores uniquement).');
  }
  const adminPath = `admins/${uid}`;
  try {
    await setDoc(doc(db, 'admins', uid), {
      uid,
      email: sanitizeStr(params.email, 'admin@talambongo.app', 200),
      displayName: sanitizeStr(params.displayName, 'Administrateur', 120),
      grantedBy: sanitizeStr(params.grantedBy, 'admin', 128),
      createdAt: serverTimestamp(),
    });

    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      await updateDoc(doc(db, 'users', uid), {
        role: 'ADMIN',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, adminPath);
  }
}

export async function revokeAdminAccess(uid: string): Promise<void> {
  const adminPath = `admins/${uid}`;
  try {
    await deleteDoc(doc(db, 'admins', uid));
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      await updateDoc(doc(db, 'users', uid), {
        role: 'USER',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, adminPath);
  }
}
