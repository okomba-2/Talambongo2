export type ExpenseCategory =
  | 'Alimentation'
  | 'Transport'
  | 'Factures'
  | 'Téléphone / Internet'
  | 'Achats'
  | 'Loisirs'
  | 'Études'
  | 'Autres';

export type ExpenseMoment = 'Matin' | 'Après-midi' | 'Soir';

export type SupportedCurrency = 'XOF' | 'XAF' | 'CDF' | 'EUR';

export type UserRole = 'USER' | 'ADMIN';

export type SubscriptionStatusType =
  | 'trial'
  | 'active'
  | 'expired'
  | 'renewed'
  | 'cancelled';

export type SubscriptionPlanType = 'free_trial' | 'monthly' | 'quarterly';

export type PaymentStatusType = 'confirmed' | 'pending' | 'failed' | 'none';

export interface Expense {
  id: string;
  title: string;
  amount: number; // montant original non altéré
  currency?: SupportedCurrency; // devise d'origine de la dépense (ex: 'XOF', 'EUR', etc.)
  category: ExpenseCategory;
  moment: ExpenseMoment;
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: number;
}

export type ReferralSource = 'link' | 'manual';

export type PartnerStatus = 'active' | 'suspended' | 'disabled';

export type CommissionType = 'first_payment_only';

export type CommissionStatus = 'pending' | 'paid';

export type PartnerAuditAction =
  | 'partner_created'
  | 'partner_updated'
  | 'partner_status_changed'
  | 'commission_paid';

export interface ReferralAttributionPayload {
  partnerId: string;
  code: string;
  source: ReferralSource;
  sessionId?: string;
}

export interface UserProfile {
  uid?: string;
  name: string;
  email: string;
  status: 'Essai gratuit' | 'Premium';
  trialDaysLeft: number;
  trialStartedAtMs?: number;
  trialEndsAtMs?: number;
  hasUsedFreeTrial?: boolean;
  country?: string;
  mainGoal?: string;
  trackingFrequency?: string;
  onboardingCompleted?: boolean;
  currency?: SupportedCurrency;
  role?: UserRole;
  subscriptionStatus?: SubscriptionStatusType;
  subscriptionType?: SubscriptionPlanType;
  subscriptionStartAtMs?: number;
  subscriptionEndAtMs?: number;
  lastConfirmedSubscriptionId?: string;
  createdAtMs?: number;
  referredByPartnerId?: string;
  referredByCode?: string;
  referralSource?: ReferralSource;
  referralAttributedAtMs?: number;
}

export interface FirestoreUserAccount {
  uid: string;
  name: string;
  email: string;
  country: string;
  currency: SupportedCurrency;
  role: UserRole;
  subscriptionStatus: SubscriptionStatusType;
  subscriptionType: SubscriptionPlanType;
  subscriptionStartAt?: string;
  subscriptionEndAt?: string;
  subscriptionEndAtMs?: number;
  lastConfirmedSubscriptionId?: string;
  trialDaysLeft: number;
  trialStartedAtMs?: number;
  trialEndsAtMs?: number;
  hasUsedFreeTrial?: boolean;
  mainGoal?: string;
  trackingFrequency?: string;
  onboardingCompleted: boolean;
  expensesCount: number;
  reportsViewedCount: number;
  pdfExportsCount: number;
  referredByPartnerId?: string;
  referredByCode?: string;
  referralSource?: ReferralSource;
  referralSessionId?: string;
  referralAttributedAtMs?: number;
  createdAtMs: number;
  lastActiveAtMs: number;
  updatedAtMs: number;
}

export interface FirestoreSubscriptionRecord {
  id: string;
  userId: string;
  country: string;
  planType: SubscriptionPlanType;
  status: SubscriptionStatusType;
  paymentStatus: PaymentStatusType;
  amount: number;
  currency: SupportedCurrency;
  amountXof: number;
  startDate: string;
  endDate: string;
  endAtMs?: number;
  idempotencyKey?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface AdminRegistryEntry {
  uid: string;
  email: string;
  displayName: string;
  grantedBy: string;
  createdAtMs: number;
}

export interface AdminSettingsConfig {
  activeActivityThresholdDays: number;
  defaultAdminCurrency: SupportedCurrency;
  updatedAtMs?: number;
}

export interface Partner {
  id: string;
  name: string;
  channelName: string;
  socialNetwork: string;
  contactInfo: string;
  code: string;
  referralLink: string;
  startDateMs: number;
  endDateMs: number;
  fixedAdFeeXof: number;
  commissionPerUserXof: number;
  commissionType: CommissionType;
  status: PartnerStatus;
  notes?: string;
  createdBy: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PartnerPublicLink {
  code: string;
  partnerId: string;
  status: PartnerStatus;
  startDateMs: number;
  endDateMs: number;
  commissionPerUserXof: number;
  commissionType: CommissionType;
}

export interface PartnerClickRecord {
  id: string;
  partnerId: string;
  code: string;
  sessionToken: string;
  landingPath: string;
  createdAtMs: number;
}

export interface ReferralSessionRecord {
  id: string;
  partnerId: string;
  code: string;
  clickId: string;
  status: 'pending' | 'consumed';
  usedByUid?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PartnerCommissionRecord {
  id: string;
  partnerId: string;
  referralCode: string;
  userId: string;
  anonymizedUserRef: string;
  subscriptionId: string;
  planType: 'monthly' | 'quarterly';
  paymentAmountXof: number;
  amountXof: number;
  commissionType: CommissionType;
  status: CommissionStatus;
  paidAtMs?: number;
  payoutReference?: string;
  payoutNote?: string;
  paidByAdminUid?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PartnerAuditLog {
  id: string;
  action: PartnerAuditAction;
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  actorUid: string;
  details: string;
  amountXof?: number;
  createdAtMs: number;
}

export interface DayExpenseGroup {
  date: string; // YYYY-MM-DD
  total: number;
  expenses: Expense[];
}

export interface Testimonial {
  id: string;
  name: string;
  country: string;
  quote: string;
  avatarBg: string;
  initials: string;
  rating?: number;
}

export interface PricingPlan {
  id: string;
  title: string;
  price: string;
  duration: string;
  badge?: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}
