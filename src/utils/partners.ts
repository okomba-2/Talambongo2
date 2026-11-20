import {
  FirestoreUserAccount,
  Partner,
  PartnerClickRecord,
  PartnerCommissionRecord,
  PartnerPublicLink,
  PartnerStatus,
} from '../types';

export const REFERRAL_CODE_REGEX = /^[A-Z0-9_-]{3,32}$/;
export const DEFAULT_PARTNER_FIXED_FEE_XOF = 20000;
export const DEFAULT_PARTNER_COMMISSION_XOF = 100;
export const REFERENCE_SUBSCRIPTION_PRICE_XOF = 500;

export function normalizeReferralCode(raw: string): string {
  return (raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidReferralCodeFormat(raw: string): boolean {
  const code = normalizeReferralCode(raw);
  return REFERRAL_CODE_REGEX.test(code);
}

export function generateUniqueReferralCode(
  partnerName: string,
  existingCodes?: Set<string>
): string {
  const cleanedPrefix = (partnerName || 'PARTENAIRE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'TALA';

  for (let attempt = 0; attempt < 25; attempt++) {
    const suffix = Math.floor(100 + Math.random() * 900).toString();
    const candidate = `${cleanedPrefix}${suffix}`;
    if (
      REFERRAL_CODE_REGEX.test(candidate) &&
      (!existingCodes || !existingCodes.has(candidate))
    ) {
      return candidate;
    }
  }

  const fallback = `${cleanedPrefix}${Date.now().toString(36).toUpperCase().slice(-4)}`;
  return fallback.slice(0, 32);
}

export function buildReferralLink(code: string, origin?: string): string {
  const normalized = normalizeReferralCode(code);
  const resolvedOrigin =
    origin ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://talambongo.netlify.app');
  return `${resolvedOrigin.replace(/\/+$/, '')}/?ref=${encodeURIComponent(normalized)}`;
}

export function isPartnerCurrentlyValid(
  link: Pick<PartnerPublicLink, 'status' | 'startDateMs' | 'endDateMs'>,
  nowMs: number = Date.now()
): { valid: boolean; reason?: 'suspended' | 'disabled' | 'not_started' | 'expired' } {
  if (link.status === 'suspended') {
    return { valid: false, reason: 'suspended' };
  }
  if (link.status === 'disabled') {
    return { valid: false, reason: 'disabled' };
  }
  if (nowMs < link.startDateMs) {
    return { valid: false, reason: 'not_started' };
  }
  if (nowMs > link.endDateMs) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true };
}

export function getPartnerEffectiveLifecycleState(
  partner: Pick<Partner, 'status' | 'startDateMs' | 'endDateMs'>,
  nowMs: number = Date.now()
): 'active' | 'scheduled' | 'expired' | 'suspended' | 'disabled' {
  if (partner.status === 'suspended') return 'suspended';
  if (partner.status === 'disabled') return 'disabled';
  if (nowMs < partner.startDateMs) return 'scheduled';
  if (nowMs > partner.endDateMs) return 'expired';
  return 'active';
}

export function anonymizeUserId(uid: string): string {
  // Deterministic non-reversible FNV-1a 32-bit digest for privacy-safe admin reporting
  let hash = 0x811c9dc5;
  for (let i = 0; i < uid.length; i++) {
    hash ^= uid.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `USR-${hex}`;
}

export interface PartnerPerformanceSummary {
  clicksCount: number;
  signupsCount: number;
  payingUsersCount: number;
  nonPayingUsersCount: number;
  conversionRatePct: number;
  clickToSignupRatePct: number;
  totalCommissionsXof: number;
  pendingCommissionsXof: number;
  paidCommissionsXof: number;
  pendingCommissionsCount: number;
  paidCommissionsCount: number;
  totalPartnerCostXof: number;
  effectiveLifecycle: ReturnType<typeof getPartnerEffectiveLifecycleState>;
}

export function computePartnerMetrics(
  partner: Partner,
  clicks: PartnerClickRecord[],
  users: FirestoreUserAccount[],
  commissions: PartnerCommissionRecord[],
  nowMs: number = Date.now()
): PartnerPerformanceSummary {
  const partnerClicks = clicks.filter((c) => c.partnerId === partner.id);
  const partnerUsers = users.filter((u) => u.referredByPartnerId === partner.id);
  const partnerCommissions = commissions.filter((c) => c.partnerId === partner.id);

  const payingUsersCount = partnerUsers.filter(
    (u) =>
      u.subscriptionStatus === 'active' ||
      u.subscriptionStatus === 'renewed' ||
      partnerCommissions.some((c) => c.userId === u.uid)
  ).length;
  const signupsCount = partnerUsers.length;
  const nonPayingUsersCount = Math.max(0, signupsCount - payingUsersCount);

  const conversionRatePct =
    signupsCount > 0 ? Math.round((payingUsersCount / signupsCount) * 1000) / 10 : 0;
  const clickToSignupRatePct =
    partnerClicks.length > 0
      ? Math.round((signupsCount / partnerClicks.length) * 1000) / 10
      : 0;

  const totalCommissionsXof = partnerCommissions.reduce((acc, c) => acc + c.amountXof, 0);
  const pendingList = partnerCommissions.filter((c) => c.status === 'pending');
  const paidList = partnerCommissions.filter((c) => c.status === 'paid');

  const pendingCommissionsXof = pendingList.reduce((acc, c) => acc + c.amountXof, 0);
  const paidCommissionsXof = paidList.reduce((acc, c) => acc + c.amountXof, 0);

  return {
    clicksCount: partnerClicks.length,
    signupsCount,
    payingUsersCount,
    nonPayingUsersCount,
    conversionRatePct,
    clickToSignupRatePct,
    totalCommissionsXof,
    pendingCommissionsXof,
    paidCommissionsXof,
    pendingCommissionsCount: pendingList.length,
    paidCommissionsCount: paidList.length,
    totalPartnerCostXof: partner.fixedAdFeeXof + totalCommissionsXof,
    effectiveLifecycle: getPartnerEffectiveLifecycleState(partner, nowMs),
  };
}

export function getPartnerStatusLabel(status: PartnerStatus | 'scheduled' | 'expired'): string {
  switch (status) {
    case 'active':
      return 'Actif';
    case 'scheduled':
      return 'Programmé';
    case 'expired':
      return 'Expiré';
    case 'suspended':
      return 'Suspendu';
    case 'disabled':
      return 'Désactivé';
  }
}
