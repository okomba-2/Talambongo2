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

export interface UserProfile {
  uid?: string;
  name: string;
  email: string;
  status: 'Essai gratuit' | 'Premium';
  trialDaysLeft: number;
  country?: string;
  mainGoal?: string;
  trackingFrequency?: string;
  onboardingCompleted?: boolean;
  currency?: SupportedCurrency;
  role?: UserRole;
  subscriptionStatus?: SubscriptionStatusType;
  subscriptionType?: SubscriptionPlanType;
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
  trialDaysLeft: number;
  mainGoal?: string;
  trackingFrequency?: string;
  onboardingCompleted: boolean;
  expensesCount: number;
  reportsViewedCount: number;
  pdfExportsCount: number;
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
