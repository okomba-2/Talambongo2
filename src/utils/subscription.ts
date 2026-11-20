import { UserProfile } from '../types';

export const TRIAL_DURATION_DAYS = 7;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * MS_PER_DAY;

export const MONTHLY_PRICE_XOF = 500;
export const QUARTERLY_PRICE_XOF = 1200;

export type SubscriptionAccessPhase =
  | 'admin'
  | 'premium_active'
  | 'trial_active'
  | 'trial_expired'
  | 'subscription_expired';

export type GatedFeature =
  | 'dashboard'
  | 'calendar'
  | 'bilan'
  | 'add_expense'
  | 'delete_expense'
  | 'pdf_export'
  | 'profile'
  | 'payment'
  | 'logout';

export interface SubscriptionAccessState {
  phase: SubscriptionAccessPhase;
  hasFullAccess: boolean;
  isAdmin: boolean;
  isTrialActive: boolean;
  isPremiumActive: boolean;
  isExpired: boolean;
  trialDaysLeft: number;
  subscriptionDaysLeft: number;
  trialStartedAtMs: number;
  trialEndsAtMs: number;
  subscriptionEndAtMs?: number;
  hasUsedFreeTrial: boolean;
}

/**
 * Calcule la fenêtre initiale d'essai gratuit de 7 jours (UTC millisecondes).
 */
export function computeTrialWindow(startAtMs: number): {
  trialStartedAtMs: number;
  trialEndsAtMs: number;
} {
  return {
    trialStartedAtMs: startAtMs,
    trialEndsAtMs: startAtMs + TRIAL_DURATION_MS,
  };
}

/**
 * Calcule dynamiquement le nombre de jours d'essai restants sans valeur codée en dur.
 * Retourne 0 dès que trialEndsAtMs est atteint ou dépassé.
 */
export function computeTrialDaysLeft(trialEndsAtMs: number, nowMs: number = Date.now()): number {
  if (!Number.isFinite(trialEndsAtMs) || nowMs >= trialEndsAtMs) {
    return 0;
  }
  const remainingMs = trialEndsAtMs - nowMs;
  return Math.min(TRIAL_DURATION_DAYS, Math.max(1, Math.ceil(remainingMs / MS_PER_DAY)));
}

/**
 * Calcule les dates de début et d'expiration d'un abonnement mensuel ou trimestriel en UTC.
 * Lors d'un renouvellement avant échéance, prolonge à partir de la date d'expiration existante.
 */
export function computeSubscriptionPeriod(
  planType: 'monthly' | 'quarterly',
  nowMs: number = Date.now(),
  existingEndAtMs?: number
): {
  startDate: string;
  startAtMs: number;
  endDate: string;
  endAtMs: number;
} {
  const monthsToAdd = planType === 'quarterly' ? 3 : 1;
  const anchorMs =
    typeof existingEndAtMs === 'number' &&
    Number.isFinite(existingEndAtMs) &&
    existingEndAtMs > nowMs
      ? existingEndAtMs
      : nowMs;

  const endDateObj = new Date(anchorMs);
  endDateObj.setUTCMonth(endDateObj.getUTCMonth() + monthsToAdd);

  return {
    startDate: new Date(nowMs).toISOString(),
    startAtMs: nowMs,
    endDate: endDateObj.toISOString(),
    endAtMs: endDateObj.getTime(),
  };
}

/**
 * Évalue de façon centralisée l'accès d'un utilisateur (Admin, Essai actif, Premium actif, ou Expiré).
 */
export function getSubscriptionAccessState(
  user: Pick<
    UserProfile,
    | 'role'
    | 'status'
    | 'subscriptionStatus'
    | 'subscriptionType'
    | 'trialStartedAtMs'
    | 'trialEndsAtMs'
    | 'trialDaysLeft'
    | 'subscriptionStartAtMs'
    | 'subscriptionEndAtMs'
    | 'hasUsedFreeTrial'
    | 'createdAtMs'
  >,
  nowMs: number = Date.now()
): SubscriptionAccessState {
  const fallbackStart =
    typeof user.trialStartedAtMs === 'number' && Number.isFinite(user.trialStartedAtMs)
      ? user.trialStartedAtMs
      : typeof user.createdAtMs === 'number' && Number.isFinite(user.createdAtMs)
      ? user.createdAtMs
      : nowMs;

  const fallbackEnd =
    typeof user.trialEndsAtMs === 'number' && Number.isFinite(user.trialEndsAtMs)
      ? user.trialEndsAtMs
      : user.trialDaysLeft === 0
      ? nowMs
      : fallbackStart + TRIAL_DURATION_MS;

  if (user.role === 'ADMIN') {
    return {
      phase: 'admin',
      hasFullAccess: true,
      isAdmin: true,
      isTrialActive: false,
      isPremiumActive: true,
      isExpired: false,
      trialDaysLeft: 0,
      subscriptionDaysLeft: 0,
      trialStartedAtMs: fallbackStart,
      trialEndsAtMs: fallbackEnd,
      hasUsedFreeTrial: Boolean(user.hasUsedFreeTrial ?? true),
    };
  }

  const subEndMs =
    typeof user.subscriptionEndAtMs === 'number' && Number.isFinite(user.subscriptionEndAtMs)
      ? user.subscriptionEndAtMs
      : undefined;

  const isPaidStatus =
    user.subscriptionStatus === 'active' || user.subscriptionStatus === 'renewed';

  if (isPaidStatus) {
    if (subEndMs === undefined || subEndMs > nowMs) {
      const subscriptionDaysLeft =
        subEndMs !== undefined
          ? Math.max(1, Math.ceil((subEndMs - nowMs) / MS_PER_DAY))
          : 30;
      return {
        phase: 'premium_active',
        hasFullAccess: true,
        isAdmin: false,
        isTrialActive: false,
        isPremiumActive: true,
        isExpired: false,
        trialDaysLeft: 0,
        subscriptionDaysLeft,
        trialStartedAtMs: fallbackStart,
        trialEndsAtMs: fallbackEnd,
        subscriptionEndAtMs: subEndMs,
        hasUsedFreeTrial: true,
      };
    }

    // Abonnement payant expiré à la date d'échéance sans renouvellement confirmé
    return {
      phase: 'subscription_expired',
      hasFullAccess: false,
      isAdmin: false,
      isTrialActive: false,
      isPremiumActive: false,
      isExpired: true,
      trialDaysLeft: 0,
      subscriptionDaysLeft: 0,
      trialStartedAtMs: fallbackStart,
      trialEndsAtMs: fallbackEnd,
      subscriptionEndAtMs: subEndMs,
      hasUsedFreeTrial: true,
    };
  }

  if (user.subscriptionStatus === 'expired' || user.subscriptionStatus === 'cancelled') {
    const hadPaidPlan =
      subEndMs !== undefined ||
      user.subscriptionType === 'monthly' ||
      user.subscriptionType === 'quarterly';

    return {
      phase: hadPaidPlan ? 'subscription_expired' : 'trial_expired',
      hasFullAccess: false,
      isAdmin: false,
      isTrialActive: false,
      isPremiumActive: false,
      isExpired: true,
      trialDaysLeft: 0,
      subscriptionDaysLeft: 0,
      trialStartedAtMs: fallbackStart,
      trialEndsAtMs: fallbackEnd,
      subscriptionEndAtMs: subEndMs,
      hasUsedFreeTrial: true,
    };
  }

  // État essai gratuit : strictement borné par trialEndsAtMs
  const trialDaysLeft = computeTrialDaysLeft(fallbackEnd, nowMs);
  if (trialDaysLeft > 0) {
    return {
      phase: 'trial_active',
      hasFullAccess: true,
      isAdmin: false,
      isTrialActive: true,
      isPremiumActive: false,
      isExpired: false,
      trialDaysLeft,
      subscriptionDaysLeft: 0,
      trialStartedAtMs: fallbackStart,
      trialEndsAtMs: fallbackEnd,
      hasUsedFreeTrial: true,
    };
  }

  return {
    phase: 'trial_expired',
    hasFullAccess: false,
    isAdmin: false,
    isTrialActive: false,
    isPremiumActive: false,
    isExpired: true,
    trialDaysLeft: 0,
    subscriptionDaysLeft: 0,
    trialStartedAtMs: fallbackStart,
    trialEndsAtMs: fallbackEnd,
    hasUsedFreeTrial: true,
  };
}

/**
 * Contrôle d'accès par fonctionnalité :
 * - Profil, Paiement et Déconnexion restent toujours accessibles pour protéger les données et permettre l'activation.
 * - Les fonctionnalités principales sont verrouillées dès l'expiration sans abonnement actif.
 */
export function canAccessFeature(
  access: SubscriptionAccessState,
  feature: GatedFeature
): boolean {
  if (feature === 'profile' || feature === 'payment' || feature === 'logout') {
    return true;
  }
  return access.hasFullAccess;
}

export function sanitizeIdempotencyKey(rawKey?: string): string | undefined {
  if (!rawKey) return undefined;
  const cleaned = rawKey.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return cleaned.length > 0 ? cleaned : undefined;
}

export function buildSubscriptionDocumentId(
  uid: string,
  idempotencyKey?: string,
  nowMs: number = Date.now()
): string {
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'user';
  const cleanKey = sanitizeIdempotencyKey(idempotencyKey);
  if (cleanKey) {
    return `sub_${safeUid}_${cleanKey}`.slice(0, 128);
  }
  return `sub-${safeUid.slice(0, 12)}-${nowMs}`;
}
