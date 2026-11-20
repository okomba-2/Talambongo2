import { User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  AdminRegistryEntry,
  AdminSettingsConfig,
  CommissionType,
  Expense,
  FirestoreSubscriptionRecord,
  FirestoreUserAccount,
  Partner,
  PartnerAuditAction,
  PartnerAuditLog,
  PartnerClickRecord,
  PartnerCommissionRecord,
  PartnerPublicLink,
  PartnerStatus,
  PaymentStatusType,
  ReferralAttributionPayload,
  ReferralSessionRecord,
  SubscriptionPlanType,
  SubscriptionStatusType,
  SupportedCurrency,
  UserProfile,
  UserRole,
} from '../types';
import { convertAmount, getCurrencyForCountry } from '../utils/currency';
import {
  anonymizeUserId,
  buildReferralLink,
  DEFAULT_PARTNER_COMMISSION_XOF,
  DEFAULT_PARTNER_FIXED_FEE_XOF,
  isPartnerCurrentlyValid,
  isValidReferralCodeFormat,
  normalizeReferralCode,
} from '../utils/partners';
import {
  buildSubscriptionDocumentId,
  computeSubscriptionPeriod,
  computeTrialDaysLeft,
  getSubscriptionAccessState,
  sanitizeIdempotencyKey,
  TRIAL_DURATION_MS,
} from '../utils/subscription';

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
 * Vérification sécurisée du rôle à partir du token Firebase (Custom Claims),
 * du registre /admins/{uid} et des règles serveur Firestore.
 * Aucun e-mail administrateur n'est exposé en dur côté client.
 */
export async function resolveUserRole(
  firebaseUser: FirebaseUser,
  forceRefresh = false
): Promise<VerifiedRoleResolution> {
  const tokenResult = await firebaseUser.getIdTokenResult(forceRefresh);
  const claims = tokenResult.claims || {};
  const emailVerified = Boolean(firebaseUser.emailVerified);

  // 1. Custom Claims Firebase (ex: { role: 'ADMIN' } ou { admin: true })
  if (emailVerified && (claims.role === 'ADMIN' || claims.admin === true)) {
    return { role: 'ADMIN', source: 'custom_claim', emailVerified };
  }

  // 2. Vérification dans le registre protégé /admins/{uid}
  if (emailVerified) {
    try {
      const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
      if (adminSnap.exists()) {
        return { role: 'ADMIN', source: 'admin_registry', emailVerified };
      }
    } catch {
      // L'utilisateur n'est pas autorisé dans /admins/{uid}
    }

    // 3. Vérification côté serveur via lecture de admin_stats/settings (autorisée uniquement par firestore.rules pour isAdmin())
    try {
      await getDoc(doc(db, 'admin_stats', 'settings'));
      return { role: 'ADMIN', source: 'bootstrap_email', emailVerified };
    } catch {
      // Refusé par les règles serveur : compte utilisateur standard
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
        email: sanitizeStr(firebaseUser.email, 'admin@talambongo.app', 200),
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
 * Valide un code de parrainage côté serveur (Firestore /partner_links/{code}) sans exposer de PII.
 */
export async function validateReferralCode(rawCode: string): Promise<{
  valid: boolean;
  link?: PartnerPublicLink;
  errorMessage?: string;
}> {
  const code = normalizeReferralCode(rawCode);
  if (!code || !isValidReferralCodeFormat(code)) {
    return {
      valid: false,
      errorMessage: 'Code de parrainage invalide (3 à 32 caractères alphanumériques, tirets ou underscores).',
    };
  }

  try {
    const snap = await getDoc(doc(db, 'partner_links', code));
    if (!snap.exists()) {
      return {
        valid: false,
        errorMessage: 'Ce code de parrainage n’existe pas.',
      };
    }

    const d = snap.data();
    const link: PartnerPublicLink = {
      code: String(d.code || code),
      partnerId: String(d.partnerId || ''),
      status: (d.status as PartnerStatus) || 'disabled',
      startDateMs: timestampToMs(d.startDate),
      endDateMs: timestampToMs(d.endDate),
      commissionPerUserXof:
        typeof d.commissionPerUserXof === 'number' ? d.commissionPerUserXof : DEFAULT_PARTNER_COMMISSION_XOF,
      commissionType: (d.commissionType as CommissionType) || 'first_payment_only',
    };

    const validity = isPartnerCurrentlyValid(link, Date.now());
    if (!validity.valid) {
      if (validity.reason === 'suspended') {
        return { valid: false, errorMessage: 'Ce code partenaire est temporairement suspendu.' };
      }
      if (validity.reason === 'disabled') {
        return { valid: false, errorMessage: 'Ce code partenaire est désactivé.' };
      }
      if (validity.reason === 'not_started') {
        return { valid: false, errorMessage: 'Ce partenariat n’a pas encore démarré.' };
      }
      return { valid: false, errorMessage: 'Ce code partenaire a expiré.' };
    }

    return { valid: true, link };
  } catch (error) {
    console.error('Validation code parrainage:', error);
    return {
      valid: false,
      errorMessage: 'Impossible de vérifier le code de parrainage pour le moment.',
    };
  }
}

/**
 * Enregistre un clic partenaire ET une session d'attribution temporaire dans Firestore.
 */
export async function recordPartnerClickAndSession(
  link: PartnerPublicLink,
  sessionToken: string,
  landingPath = '/'
): Promise<{ clickId: string; sessionId: string }> {
  const cleanSuffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const clickId = `clk_${cleanSuffix}`;
  const sessionId = `rs_${cleanSuffix}`;
  const path = `partner_clicks/${clickId}`;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'partner_clicks', clickId), {
      id: clickId,
      partnerId: link.partnerId,
      code: link.code,
      sessionToken: sanitizeStr(sessionToken, cleanSuffix, 128),
      landingPath: sanitizeStr(landingPath, '/', 200),
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'referral_sessions', sessionId), {
      id: sessionId,
      partnerId: link.partnerId,
      code: link.code,
      clickId,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return { clickId, sessionId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getReferralSessionFromFirestore(
  sessionId: string
): Promise<ReferralSessionRecord | null> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)) return null;
  try {
    const snap = await getDoc(doc(db, 'referral_sessions', sessionId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: String(d.id || snap.id),
      partnerId: String(d.partnerId || ''),
      code: String(d.code || ''),
      clickId: String(d.clickId || ''),
      status: d.status === 'consumed' ? 'consumed' : 'pending',
      usedByUid: typeof d.usedByUid === 'string' ? d.usedByUid : undefined,
      createdAtMs: timestampToMs(d.createdAt),
      updatedAtMs: timestampToMs(d.updatedAt),
    };
  } catch {
    return null;
  }
}

/**
 * Crée ou synchronise le document /users/{uid} lors d'une connexion / inscription.
 * Associe définitivement le nouvel utilisateur au partenaire lors de la création de son compte uniquement.
 */
export async function syncUserAccountOnAuth(
  firebaseUser: FirebaseUser,
  verifiedRole: UserRole,
  preferredName?: string,
  authIntent?: 'signup' | 'login',
  referralAttribution?: ReferralAttributionPayload | null
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

      const rawCountry = typeof data.country === 'string' ? data.country.trim() : '';
      const hasValidCountry =
        rawCountry.length > 0 && rawCountry !== 'Non sélectionné';
      const hasValidSavedCurrency =
        typeof data.currency === 'string' &&
        (VALID_CURRENCIES as string[]).includes(data.currency);
      const resolvedCurrency: SupportedCurrency = hasValidSavedCurrency
        ? (data.currency as SupportedCurrency)
        : hasValidCountry
        ? getCurrencyForCountry(rawCountry)
        : 'XOF';
      const isOnboardingDone =
        verifiedRole === 'ADMIN'
          ? true
          : Boolean(data.onboardingCompleted) && hasValidCountry;

      const createdAtMs = timestampToMs(data.createdAt);
      const trialStartedAtMs = data.trialStartedAt
        ? timestampToMs(data.trialStartedAt)
        : createdAtMs;
      const trialEndsAtMs = data.trialEndsAt
        ? timestampToMs(data.trialEndsAt)
        : trialStartedAtMs + TRIAL_DURATION_MS;

      const parsedStartMs =
        typeof data.subscriptionStartAt === 'string' ? Date.parse(data.subscriptionStartAt) : NaN;
      const subscriptionStartAtMs = Number.isNaN(parsedStartMs) ? undefined : parsedStartMs;

      const parsedEndMs = data.subscriptionEndAtTs
        ? timestampToMs(data.subscriptionEndAtTs)
        : typeof data.subscriptionEndAt === 'string'
        ? Date.parse(data.subscriptionEndAt)
        : NaN;
      const subscriptionEndAtMs = Number.isNaN(parsedEndMs) ? undefined : parsedEndMs;

      const accessState = getSubscriptionAccessState({
        role: existingRole,
        status: subStatus === 'active' || subStatus === 'renewed' ? 'Premium' : 'Essai gratuit',
        trialDaysLeft: typeof data.trialDaysLeft === 'number' ? data.trialDaysLeft : 7,
        subscriptionStatus: subStatus,
        subscriptionType: subType,
        trialStartedAtMs,
        trialEndsAtMs,
        subscriptionStartAtMs,
        subscriptionEndAtMs,
        hasUsedFreeTrial: true,
        createdAtMs,
      });

      const resolvedSubStatus: SubscriptionStatusType =
        existingRole === 'ADMIN'
          ? subStatus
          : accessState.isExpired
          ? 'expired'
          : subStatus;

      const updatePayload: Record<string, unknown> = {
        name: sanitizeStr(preferredName || data.name || firebaseUser.displayName, 'Utilisateur TalaMbongo', 120),
        ...(verifiedRole === 'ADMIN' && data.role !== 'ADMIN' ? { role: 'ADMIN' } : {}),
        lastActiveAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Rétro-migration unique pour anciens comptes créés avant l'ajout de trialEndsAt (ancrée strictement sur createdAt)
      if (!data.trialEndsAt && data.createdAt) {
        updatePayload.trialStartedAt = data.createdAt;
        updatePayload.trialEndsAt = Timestamp.fromMillis(createdAtMs + TRIAL_DURATION_MS);
        updatePayload.hasUsedFreeTrial = true;
      }

      if (existingRole !== 'ADMIN' && accessState.isExpired && subStatus !== 'expired') {
        updatePayload.subscriptionStatus = 'expired';
        updatePayload.trialDaysLeft = 0;
      } else if (
        existingRole !== 'ADMIN' &&
        accessState.isTrialActive &&
        data.trialDaysLeft !== accessState.trialDaysLeft
      ) {
        updatePayload.trialDaysLeft = accessState.trialDaysLeft;
      }

      await updateDoc(userRef, updatePayload);

      return {
        uid,
        name: sanitizeStr(preferredName || data.name || firebaseUser.displayName, 'Utilisateur TalaMbongo', 120),
        email: sanitizeStr(data.email || firebaseUser.email, 'utilisateur@talambongo.app', 200),
        status: accessState.isPremiumActive ? 'Premium' : 'Essai gratuit',
        trialDaysLeft: accessState.trialDaysLeft,
        trialStartedAtMs,
        trialEndsAtMs,
        hasUsedFreeTrial: true,
        country: hasValidCountry ? rawCountry : '',
        mainGoal: typeof data.mainGoal === 'string' ? data.mainGoal : 'Comprendre où va mon argent',
        trackingFrequency: typeof data.trackingFrequency === 'string' ? data.trackingFrequency : 'Tous les jours',
        onboardingCompleted: isOnboardingDone,
        currency: resolvedCurrency,
        role: verifiedRole === 'ADMIN' ? 'ADMIN' : existingRole,
        subscriptionStatus: resolvedSubStatus,
        subscriptionType: subType,
        subscriptionStartAtMs,
        subscriptionEndAtMs,
        lastConfirmedSubscriptionId:
          typeof data.lastConfirmedSubscriptionId === 'string'
            ? data.lastConfirmedSubscriptionId
            : undefined,
        createdAtMs,
        referredByPartnerId: typeof data.referredByPartnerId === 'string' ? data.referredByPartnerId : undefined,
        referredByCode: typeof data.referredByCode === 'string' ? data.referredByCode : undefined,
        referralSource:
          data.referralSource === 'link' || data.referralSource === 'manual'
            ? data.referralSource
            : undefined,
        referralAttributedAtMs: data.referralAttributedAt
          ? timestampToMs(data.referralAttributedAt)
          : undefined,
      };
    }

    // Création d'un nouveau compte utilisateur dans Firestore
    // Tout nouvel utilisateur (Google ou Email) doit obligatoirement passer par le choix du pays (onboardingCompleted = false)
    const displayName = sanitizeStr(
      preferredName || firebaseUser.displayName || firebaseUser.email?.split('@')[0],
      'Utilisateur TalaMbongo',
      120
    );
    const email = sanitizeStr(firebaseUser.email, `${uid}@talambongo.app`, 200);
    const initialOnboardingCompleted = verifiedRole === 'ADMIN' ? true : false;
    void authIntent;

    let validatedReferral: {
      partnerId: string;
      code: string;
      source: 'link' | 'manual';
      sessionId?: string;
    } | null = null;

    if (verifiedRole !== 'ADMIN' && referralAttribution?.code) {
      const check = await validateReferralCode(referralAttribution.code);
      if (check.valid && check.link) {
        validatedReferral = {
          partnerId: check.link.partnerId,
          code: check.link.code,
          source: referralAttribution.source === 'link' ? 'link' : 'manual',
          sessionId:
            referralAttribution.sessionId &&
            /^[a-zA-Z0-9_-]{1,128}$/.test(referralAttribution.sessionId)
              ? referralAttribution.sessionId
              : undefined,
        };
      }
    }

    const nowMs = Date.now();
    const trialEndsMs = nowMs + TRIAL_DURATION_MS;

    const payload: Record<string, unknown> = {
      uid,
      name: displayName,
      email,
      country: verifiedRole === 'ADMIN' ? 'Congo-Brazzaville' : 'Non sélectionné',
      currency: (verifiedRole === 'ADMIN' ? 'XAF' : 'XOF') as SupportedCurrency,
      role: verifiedRole,
      subscriptionStatus: 'trial' as SubscriptionStatusType,
      subscriptionType: 'free_trial' as SubscriptionPlanType,
      trialDaysLeft: 7,
      trialStartedAt: serverTimestamp(),
      trialEndsAt: Timestamp.fromMillis(trialEndsMs),
      hasUsedFreeTrial: true,
      onboardingCompleted: initialOnboardingCompleted,
      expensesCount: 0,
      reportsViewedCount: 0,
      pdfExportsCount: 0,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (validatedReferral) {
      payload.referredByPartnerId = validatedReferral.partnerId;
      payload.referredByCode = validatedReferral.code;
      payload.referralSource = validatedReferral.source;
      payload.referralAttributedAt = serverTimestamp();
      if (validatedReferral.sessionId) {
        payload.referralSessionId = validatedReferral.sessionId;
      }
    }

    await setDoc(userRef, payload);

    // Marquer la session temporaire d'attribution en base comme consommée
    if (validatedReferral?.sessionId) {
      try {
        const sessionRef = doc(db, 'referral_sessions', validatedReferral.sessionId);
        const sessionSnap = await getDoc(sessionRef);
        if (sessionSnap.exists() && sessionSnap.data().status === 'pending') {
          await updateDoc(sessionRef, {
            status: 'consumed',
            usedByUid: uid,
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        // Non-bloquant : l'attribution permanente sur /users/{uid} est déjà enregistrée
      }
    }

    return {
      uid,
      name: displayName,
      email,
      status: 'Essai gratuit',
      trialDaysLeft: 7,
      trialStartedAtMs: nowMs,
      trialEndsAtMs: trialEndsMs,
      hasUsedFreeTrial: true,
      country: verifiedRole === 'ADMIN' ? 'Congo-Brazzaville' : '',
      onboardingCompleted: initialOnboardingCompleted,
      currency: verifiedRole === 'ADMIN' ? 'XAF' : 'XOF',
      role: verifiedRole,
      subscriptionStatus: 'trial',
      subscriptionType: 'free_trial',
      createdAtMs: nowMs,
      ...(validatedReferral
        ? {
            referredByPartnerId: validatedReferral.partnerId,
            referredByCode: validatedReferral.code,
            referralSource: validatedReferral.source,
            referralAttributedAtMs: nowMs,
          }
        : {}),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateUserAccountDoc(
  uid: string,
  updates: Partial<UserProfile>
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

export interface RecordedSubscriptionResult {
  subscriptionId: string;
  activated: boolean;
  paymentStatus: PaymentStatusType;
  status: SubscriptionStatusType;
  planType: 'monthly' | 'quarterly';
  startDate: string;
  startAtMs: number;
  endDate: string;
  endAtMs: number;
  idempotentReplay: boolean;
}

export async function recordSubscriptionInFirestore(
  uid: string,
  params: {
    country: string;
    planType: 'monthly' | 'quarterly';
    currency: SupportedCurrency;
    amount: number;
    paymentStatus?: PaymentStatusType;
    idempotencyKey?: string;
  }
): Promise<RecordedSubscriptionResult> {
  const nowMs = Date.now();
  const cleanIdemKey = sanitizeIdempotencyKey(params.idempotencyKey);
  const subId = buildSubscriptionDocumentId(uid, cleanIdemKey, nowMs);
  const subPath = `subscriptions/${subId}`;
  const amountXof = Math.round(convertAmount(params.amount, params.currency, 'XOF'));
  const paymentStatus: PaymentStatusType = params.paymentStatus || 'confirmed';

  try {
    // Idempotency check : éviter toute double activation ou extension sur webhook/paiement rejoué
    if (cleanIdemKey) {
      const existingSubSnap = await getDoc(doc(db, 'subscriptions', subId));
      if (existingSubSnap.exists()) {
        const existingData = existingSubSnap.data();
        const existingPaymentStatus = (existingData.paymentStatus as PaymentStatusType) || 'pending';
        const existingStatus = (existingData.status as SubscriptionStatusType) || 'expired';
        const existingStartMs = Date.parse(String(existingData.startDate || '')) || nowMs;
        const existingEndMs = existingData.endAtTs
          ? timestampToMs(existingData.endAtTs)
          : Date.parse(String(existingData.endDate || '')) || nowMs;

        return {
          subscriptionId: subId,
          activated: existingPaymentStatus === 'confirmed',
          paymentStatus: existingPaymentStatus,
          status: existingStatus,
          planType: existingData.planType === 'quarterly' ? 'quarterly' : 'monthly',
          startDate: String(existingData.startDate || new Date(existingStartMs).toISOString()),
          startAtMs: existingStartMs,
          endDate: String(existingData.endDate || new Date(existingEndMs).toISOString()),
          endAtMs: existingEndMs,
          idempotentReplay: true,
        };
      }
    }

    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : null;

    const currentSubEndMs = userData?.subscriptionEndAtTs
      ? timestampToMs(userData.subscriptionEndAtTs)
      : typeof userData?.subscriptionEndAt === 'string' && !Number.isNaN(Date.parse(userData.subscriptionEndAt))
      ? Date.parse(userData.subscriptionEndAt)
      : undefined;

    const period = computeSubscriptionPeriod(params.planType, nowMs, currentSubEndMs);

    // Vérifier s'il existe déjà au moins un paiement confirmé (pour distinguer le premier paiement d'un renouvellement)
    const userSubsSnap = await getDocs(
      query(collection(db, 'subscriptions'), where('userId', '==', uid))
    );
    const hasPriorConfirmedPayment = userSubsSnap.docs.some(
      (docSnap) => docSnap.data().paymentStatus === 'confirmed'
    );

    // Règle stricte : seul un paiement 'confirmed' peut activer ou renouveler l'abonnement
    const isConfirmed = paymentStatus === 'confirmed';
    const nextSubStatus: SubscriptionStatusType = isConfirmed
      ? hasPriorConfirmedPayment
        ? 'renewed'
        : 'active'
      : 'cancelled';

    const subRecordPayload: Record<string, unknown> = {
      userId: uid,
      country: sanitizeStr(params.country, 'Congo-Brazzaville', 80),
      planType: params.planType,
      status: nextSubStatus,
      paymentStatus,
      amount: Math.max(0, params.amount),
      currency: normalizeCurrency(params.currency),
      amountXof: Math.max(0, amountXof),
      startDate: period.startDate,
      endDate: isConfirmed ? period.endDate : period.startDate,
      endAtTs: Timestamp.fromMillis(isConfirmed ? period.endAtMs : nowMs),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (cleanIdemKey) {
      subRecordPayload.idempotencyKey = cleanIdemKey;
    }

    const batch = writeBatch(db);
    batch.set(doc(db, 'subscriptions', subId), subRecordPayload);

    if (isConfirmed) {
      batch.update(userRef, {
        subscriptionStatus: nextSubStatus,
        subscriptionType: params.planType,
        subscriptionStartAt: period.startDate,
        subscriptionEndAt: period.endDate,
        subscriptionEndAtTs: Timestamp.fromMillis(period.endAtMs),
        lastConfirmedSubscriptionId: subId,
        trialDaysLeft: 0,
        lastActiveAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Créer UNE seule commission partenaire uniquement lors du premier paiement réel confirmé
    const referredPartnerId =
      typeof userData?.referredByPartnerId === 'string' ? userData.referredByPartnerId : '';
    const referredCode =
      typeof userData?.referredByCode === 'string' ? userData.referredByCode : '';

    if (
      isConfirmed &&
      !hasPriorConfirmedPayment &&
      referredPartnerId &&
      referredCode
    ) {
      const commissionRef = doc(db, 'partner_commissions', uid);
      const existingCommissionSnap = await getDoc(commissionRef);
      if (!existingCommissionSnap.exists()) {
        const linkSnap = await getDoc(doc(db, 'partner_links', referredCode));
        if (linkSnap.exists()) {
          const linkData = linkSnap.data();
          const commissionAmountXof =
            typeof linkData.commissionPerUserXof === 'number' && linkData.commissionPerUserXof >= 0
              ? linkData.commissionPerUserXof
              : DEFAULT_PARTNER_COMMISSION_XOF;

          batch.set(commissionRef, {
            id: uid,
            partnerId: referredPartnerId,
            referralCode: referredCode,
            userId: uid,
            anonymizedUserRef: anonymizeUserId(uid),
            subscriptionId: subId,
            planType: params.planType,
            paymentAmountXof: Math.max(1, amountXof),
            amountXof: commissionAmountXof,
            commissionType: 'first_payment_only',
            status: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    await batch.commit();

    return {
      subscriptionId: subId,
      activated: isConfirmed,
      paymentStatus,
      status: nextSubStatus,
      planType: params.planType,
      startDate: period.startDate,
      startAtMs: period.startAtMs,
      endDate: isConfirmed ? period.endDate : period.startDate,
      endAtMs: isConfirmed ? period.endAtMs : nowMs,
      idempotentReplay: false,
    };
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
      const createdAtMs = timestampToMs(d.createdAt);
      const trialStartedAtMs = d.trialStartedAt ? timestampToMs(d.trialStartedAt) : createdAtMs;
      const trialEndsAtMs = d.trialEndsAt
        ? timestampToMs(d.trialEndsAt)
        : trialStartedAtMs + TRIAL_DURATION_MS;
      const parsedEndMs = d.subscriptionEndAtTs
        ? timestampToMs(d.subscriptionEndAtTs)
        : typeof d.subscriptionEndAt === 'string'
        ? Date.parse(d.subscriptionEndAt)
        : NaN;
      const subscriptionEndAtMs = Number.isNaN(parsedEndMs) ? undefined : parsedEndMs;

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
        subscriptionEndAtMs,
        lastConfirmedSubscriptionId:
          typeof d.lastConfirmedSubscriptionId === 'string'
            ? d.lastConfirmedSubscriptionId
            : undefined,
        trialDaysLeft: computeTrialDaysLeft(trialEndsAtMs),
        trialStartedAtMs,
        trialEndsAtMs,
        hasUsedFreeTrial: Boolean(d.hasUsedFreeTrial ?? true),
        mainGoal: typeof d.mainGoal === 'string' ? d.mainGoal : undefined,
        trackingFrequency: typeof d.trackingFrequency === 'string' ? d.trackingFrequency : undefined,
        onboardingCompleted: Boolean(d.onboardingCompleted),
        expensesCount: typeof d.expensesCount === 'number' ? d.expensesCount : 0,
        reportsViewedCount: typeof d.reportsViewedCount === 'number' ? d.reportsViewedCount : 0,
        pdfExportsCount: typeof d.pdfExportsCount === 'number' ? d.pdfExportsCount : 0,
        referredByPartnerId:
          typeof d.referredByPartnerId === 'string' ? d.referredByPartnerId : undefined,
        referredByCode: typeof d.referredByCode === 'string' ? d.referredByCode : undefined,
        referralSource:
          d.referralSource === 'link' || d.referralSource === 'manual'
            ? d.referralSource
            : undefined,
        referralSessionId:
          typeof d.referralSessionId === 'string' ? d.referralSessionId : undefined,
        referralAttributedAtMs: d.referralAttributedAt
          ? timestampToMs(d.referralAttributedAt)
          : undefined,
        createdAtMs,
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
      const parsedSubEndMs = d.endAtTs
        ? timestampToMs(d.endAtTs)
        : typeof d.endDate === 'string'
        ? Date.parse(d.endDate)
        : NaN;
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
        endAtMs: Number.isNaN(parsedSubEndMs) ? undefined : parsedSubEndMs,
        idempotencyKey: typeof d.idempotencyKey === 'string' ? d.idempotencyKey : undefined,
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

// =========================================================================
// MODULE PARTENAIRES & PARRAINAGE (ADMIN UNIQUEMENT)
// =========================================================================

export interface AdminPartnersPayload {
  partners: Partner[];
  clicks: PartnerClickRecord[];
  commissions: PartnerCommissionRecord[];
  auditLogs: PartnerAuditLog[];
}

export async function fetchAdminPartnersData(): Promise<AdminPartnersPayload> {
  if (!auth.currentUser) {
    throw new Error('Authentification requise.');
  }

  let partners: Partner[] = [];
  let clicks: PartnerClickRecord[] = [];
  let commissions: PartnerCommissionRecord[] = [];
  let auditLogs: PartnerAuditLog[] = [];

  try {
    const partnersSnap = await getDocs(collection(db, 'partners'));
    partners = partnersSnap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        const code = String(d.code || '');
        return {
          id: String(d.id || docSnap.id),
          name: String(d.name || ''),
          channelName: String(d.channelName || ''),
          socialNetwork: String(d.socialNetwork || 'TikTok'),
          contactInfo: String(d.contactInfo || ''),
          code,
          referralLink: String(d.referralLink || buildReferralLink(code)),
          startDateMs: timestampToMs(d.startDate),
          endDateMs: timestampToMs(d.endDate),
          fixedAdFeeXof:
            typeof d.fixedAdFeeXof === 'number' ? d.fixedAdFeeXof : DEFAULT_PARTNER_FIXED_FEE_XOF,
          commissionPerUserXof:
            typeof d.commissionPerUserXof === 'number'
              ? d.commissionPerUserXof
              : DEFAULT_PARTNER_COMMISSION_XOF,
          commissionType: (d.commissionType as CommissionType) || 'first_payment_only',
          status: (d.status as PartnerStatus) || 'active',
          notes: typeof d.notes === 'string' ? d.notes : undefined,
          createdBy: String(d.createdBy || ''),
          createdAtMs: timestampToMs(d.createdAt),
          updatedAtMs: timestampToMs(d.updatedAt),
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'partners');
  }

  try {
    const clicksSnap = await getDocs(collection(db, 'partner_clicks'));
    clicks = clicksSnap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: String(d.id || docSnap.id),
        partnerId: String(d.partnerId || ''),
        code: String(d.code || ''),
        sessionToken: String(d.sessionToken || ''),
        landingPath: String(d.landingPath || '/'),
        createdAtMs: timestampToMs(d.createdAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'partner_clicks');
  }

  try {
    const commSnap = await getDocs(collection(db, 'partner_commissions'));
    commissions = commSnap.docs
      .map((docSnap): PartnerCommissionRecord => {
        const d = docSnap.data();
        const planType: PartnerCommissionRecord['planType'] =
          d.planType === 'quarterly' ? 'quarterly' : 'monthly';
        const status: PartnerCommissionRecord['status'] =
          d.status === 'paid' ? 'paid' : 'pending';
        return {
          id: String(d.id || docSnap.id),
          partnerId: String(d.partnerId || ''),
          referralCode: String(d.referralCode || ''),
          userId: String(d.userId || docSnap.id),
          anonymizedUserRef: String(d.anonymizedUserRef || anonymizeUserId(String(d.userId || docSnap.id))),
          subscriptionId: String(d.subscriptionId || ''),
          planType,
          paymentAmountXof: typeof d.paymentAmountXof === 'number' ? d.paymentAmountXof : 500,
          amountXof: typeof d.amountXof === 'number' ? d.amountXof : DEFAULT_PARTNER_COMMISSION_XOF,
          commissionType: 'first_payment_only',
          status,
          paidAtMs: d.paidAt ? timestampToMs(d.paidAt) : undefined,
          payoutReference: typeof d.payoutReference === 'string' ? d.payoutReference : undefined,
          payoutNote: typeof d.payoutNote === 'string' ? d.payoutNote : undefined,
          paidByAdminUid: typeof d.paidByAdminUid === 'string' ? d.paidByAdminUid : undefined,
          createdAtMs: timestampToMs(d.createdAt),
          updatedAtMs: timestampToMs(d.updatedAt),
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'partner_commissions');
  }

  try {
    const logsSnap = await getDocs(collection(db, 'partner_audit_logs'));
    auditLogs = logsSnap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id || docSnap.id),
          action: (d.action as PartnerAuditAction) || 'partner_updated',
          partnerId: String(d.partnerId || ''),
          partnerName: String(d.partnerName || ''),
          partnerCode: String(d.partnerCode || ''),
          actorUid: String(d.actorUid || ''),
          details: String(d.details || ''),
          amountXof: typeof d.amountXof === 'number' ? d.amountXof : undefined,
          createdAtMs: timestampToMs(d.createdAt),
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'partner_audit_logs');
  }

  return { partners, clicks, commissions, auditLogs };
}

export async function createPartnerInFirestore(params: {
  name: string;
  channelName: string;
  socialNetwork: string;
  contactInfo: string;
  code: string;
  startDateMs: number;
  endDateMs: number;
  fixedAdFeeXof: number;
  commissionPerUserXof: number;
  status: PartnerStatus;
  notes?: string;
  actorUid: string;
}): Promise<Partner> {
  const code = normalizeReferralCode(params.code);
  if (!isValidReferralCodeFormat(code)) {
    throw new Error('Code partenaire invalide (3 à 32 caractères A-Z, 0-9, _ ou -).');
  }
  if (params.endDateMs < params.startDateMs) {
    throw new Error('La date de fin doit être postérieure ou égale à la date de début.');
  }

  const linkSnap = await getDoc(doc(db, 'partner_links', code));
  if (linkSnap.exists()) {
    throw new Error(`Le code de parrainage « ${code} » est déjà attribué à un autre partenaire.`);
  }

  const partnerId = `ptr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const logId = `plog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const referralLink = buildReferralLink(code);
  const startTs = Timestamp.fromMillis(params.startDateMs);
  const endTs = Timestamp.fromMillis(params.endDateMs);
  const fixedAdFeeXof = Math.max(0, Math.round(params.fixedAdFeeXof));
  const commissionPerUserXof = Math.max(0, Math.round(params.commissionPerUserXof));
  const partnerName = sanitizeStr(params.name, 'Partenaire', 120);
  const path = `partners/${partnerId}`;

  try {
    const batch = writeBatch(db);
    const partnerPayload: Record<string, unknown> = {
      id: partnerId,
      name: partnerName,
      channelName: sanitizeStr(params.channelName, partnerName, 120),
      socialNetwork: sanitizeStr(params.socialNetwork, 'TikTok', 60),
      contactInfo: sanitizeStr(params.contactInfo, 'Non renseigné', 200),
      code,
      referralLink,
      startDate: startTs,
      endDate: endTs,
      fixedAdFeeXof,
      commissionPerUserXof,
      commissionType: 'first_payment_only',
      status: params.status,
      createdBy: params.actorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.notes && params.notes.trim().length > 0) {
      partnerPayload.notes = sanitizeStr(params.notes, '', 500);
    }

    batch.set(doc(db, 'partners', partnerId), partnerPayload);
    batch.set(doc(db, 'partner_links', code), {
      code,
      partnerId,
      status: params.status,
      startDate: startTs,
      endDate: endTs,
      commissionPerUserXof,
      commissionType: 'first_payment_only',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'partner_audit_logs', logId), {
      id: logId,
      action: 'partner_created',
      partnerId,
      partnerName,
      partnerCode: code,
      actorUid: params.actorUid,
      details: `Création partenaire (${params.socialNetwork}) • Forfait ${fixedAdFeeXof} FCFA • Commission ${commissionPerUserXof} FCFA`,
      amountXof: fixedAdFeeXof,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    const nowMs = Date.now();
    return {
      id: partnerId,
      name: partnerName,
      channelName: sanitizeStr(params.channelName, partnerName, 120),
      socialNetwork: sanitizeStr(params.socialNetwork, 'TikTok', 60),
      contactInfo: sanitizeStr(params.contactInfo, 'Non renseigné', 200),
      code,
      referralLink,
      startDateMs: params.startDateMs,
      endDateMs: params.endDateMs,
      fixedAdFeeXof,
      commissionPerUserXof,
      commissionType: 'first_payment_only',
      status: params.status,
      notes: params.notes?.trim() || undefined,
      createdBy: params.actorUid,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updatePartnerInFirestore(
  existingPartner: Partner,
  params: {
    name: string;
    channelName: string;
    socialNetwork: string;
    contactInfo: string;
    startDateMs: number;
    endDateMs: number;
    fixedAdFeeXof: number;
    commissionPerUserXof: number;
    status: PartnerStatus;
    notes?: string;
    actorUid: string;
  }
): Promise<void> {
  if (params.endDateMs < params.startDateMs) {
    throw new Error('La date de fin doit être postérieure ou égale à la date de début.');
  }

  const logId = `plog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const startTs = Timestamp.fromMillis(params.startDateMs);
  const endTs = Timestamp.fromMillis(params.endDateMs);
  const fixedAdFeeXof = Math.max(0, Math.round(params.fixedAdFeeXof));
  const commissionPerUserXof = Math.max(0, Math.round(params.commissionPerUserXof));
  const partnerName = sanitizeStr(params.name, existingPartner.name, 120);
  const path = `partners/${existingPartner.id}`;

  try {
    const batch = writeBatch(db);
    const nextPartnerData: Record<string, unknown> = {
      name: partnerName,
      channelName: sanitizeStr(params.channelName, existingPartner.channelName, 120),
      socialNetwork: sanitizeStr(params.socialNetwork, existingPartner.socialNetwork, 60),
      contactInfo: sanitizeStr(params.contactInfo, existingPartner.contactInfo, 200),
      referralLink: existingPartner.referralLink,
      startDate: startTs,
      endDate: endTs,
      fixedAdFeeXof,
      commissionPerUserXof,
      commissionType: 'first_payment_only',
      status: params.status,
      updatedAt: serverTimestamp(),
    };
    if (params.notes !== undefined) {
      nextPartnerData.notes = params.notes.trim().slice(0, 500);
    }

    batch.update(doc(db, 'partners', existingPartner.id), nextPartnerData);
    batch.update(doc(db, 'partner_links', existingPartner.code), {
      code: existingPartner.code,
      partnerId: existingPartner.id,
      status: params.status,
      startDate: startTs,
      endDate: endTs,
      commissionPerUserXof,
      commissionType: 'first_payment_only',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'partner_audit_logs', logId), {
      id: logId,
      action: 'partner_updated',
      partnerId: existingPartner.id,
      partnerName,
      partnerCode: existingPartner.code,
      actorUid: params.actorUid,
      details: `Mise à jour contrat • Statut : ${params.status} • Commission : ${commissionPerUserXof} FCFA`,
      amountXof: commissionPerUserXof,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updatePartnerStatusInFirestore(
  partner: Partner,
  nextStatus: PartnerStatus,
  actorUid: string
): Promise<void> {
  const logId = `plog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `partners/${partner.id}`;

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'partners', partner.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'partner_links', partner.code), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'partner_audit_logs', logId), {
      id: logId,
      action: 'partner_status_changed',
      partnerId: partner.id,
      partnerName: partner.name,
      partnerCode: partner.code,
      actorUid,
      details: `Changement statut partenariat : ${partner.status} → ${nextStatus}`,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markPartnerCommissionPaidInFirestore(params: {
  commission: PartnerCommissionRecord;
  partnerName: string;
  payoutReference: string;
  payoutNote?: string;
  paidAtMs?: number;
  actorUid: string;
}): Promise<void> {
  const logId = `plog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `partner_commissions/${params.commission.id}`;
  const payoutReference = sanitizeStr(params.payoutReference, `PAY-${Date.now().toString().slice(-6)}`, 120);
  const paidTs = params.paidAtMs ? Timestamp.fromMillis(params.paidAtMs) : serverTimestamp();

  try {
    const batch = writeBatch(db);
    const updateData: Record<string, unknown> = {
      status: 'paid',
      paidAt: paidTs,
      payoutReference,
      paidByAdminUid: params.actorUid,
      updatedAt: serverTimestamp(),
    };
    if (params.payoutNote && params.payoutNote.trim().length > 0) {
      updateData.payoutNote = sanitizeStr(params.payoutNote, '', 300);
    }

    batch.update(doc(db, 'partner_commissions', params.commission.id), updateData);
    batch.set(doc(db, 'partner_audit_logs', logId), {
      id: logId,
      action: 'commission_paid',
      partnerId: params.commission.partnerId,
      partnerName: sanitizeStr(params.partnerName, 'Partenaire', 120),
      partnerCode: params.commission.referralCode,
      actorUid: params.actorUid,
      details: `Commission ${params.commission.amountXof} FCFA marquée payée (${params.commission.anonymizedUserRef}) • Réf : ${payoutReference}`,
      amountXof: params.commission.amountXof,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
