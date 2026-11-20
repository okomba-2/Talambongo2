import {
  buildSubscriptionDocumentId,
  canAccessFeature,
  computeSubscriptionPeriod,
  computeTrialDaysLeft,
  computeTrialWindow,
  getSubscriptionAccessState,
  MONTHLY_PRICE_XOF,
  MS_PER_DAY,
  QUARTERLY_PRICE_XOF,
  TRIAL_DURATION_DAYS,
  TRIAL_DURATION_MS,
} from '../src/utils/subscription';
import {
  anonymizeUserId,
  computePartnerMetrics,
  DEFAULT_PARTNER_COMMISSION_XOF,
  DEFAULT_PARTNER_FIXED_FEE_XOF,
} from '../src/utils/partners';
import {
  Expense,
  FirestoreSubscriptionRecord,
  Partner,
  PartnerCommissionRecord,
  PaymentStatusType,
  SubscriptionStatusType,
  UserProfile,
} from '../src/types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`TEST FAILED: ${message} (expected=${String(expected)}, actual=${String(actual)})`);
  }
}

// Simulation fidèle du cycle de vie utilisateur + paiement + parrainage (aligné avec firebaseService.ts et firestore.rules)
interface SimulatedUserRecord {
  profile: UserProfile;
  expenses: Expense[];
  subscriptions: FirestoreSubscriptionRecord[];
  commissions: PartnerCommissionRecord[];
}

function createAccountWithFreeTrial(params: {
  uid: string;
  name: string;
  email: string;
  nowMs: number;
  referral?: { partnerId: string; code: string };
}): SimulatedUserRecord {
  const { trialStartedAtMs, trialEndsAtMs } = computeTrialWindow(params.nowMs);
  return {
    profile: {
      uid: params.uid,
      name: params.name,
      email: params.email,
      country: 'Congo-Brazzaville',
      currency: 'XAF',
      role: 'USER',
      status: 'Essai gratuit',
      subscriptionStatus: 'trial',
      subscriptionType: 'free_trial',
      trialDaysLeft: TRIAL_DURATION_DAYS,
      trialStartedAtMs,
      trialEndsAtMs,
      hasUsedFreeTrial: true,
      onboardingCompleted: true,
      createdAtMs: params.nowMs,
      referredByPartnerId: params.referral?.partnerId,
      referredByCode: params.referral?.code,
      referralSource: params.referral ? 'link' : undefined,
      referralAttributedAtMs: params.referral ? params.nowMs : undefined,
    },
    expenses: [],
    subscriptions: [],
    commissions: [],
  };
}

function simulatePaymentWebhook(
  record: SimulatedUserRecord,
  params: {
    planType: 'monthly' | 'quarterly';
    paymentStatus: PaymentStatusType;
    nowMs: number;
    idempotencyKey?: string;
    partnerCommissionXof?: number;
  }
): { activated: boolean; idempotentReplay: boolean; subId: string } {
  const subId = buildSubscriptionDocumentId(
    record.profile.uid || 'user',
    params.idempotencyKey,
    params.nowMs
  );

  // Contrôle d'idempotence (même clé = aucun double prolongement ni double commission)
  if (params.idempotencyKey) {
    const existing = record.subscriptions.find((s) => s.id === subId);
    if (existing) {
      return {
        activated: existing.paymentStatus === 'confirmed',
        idempotentReplay: true,
        subId,
      };
    }
  }

  const amountXof = params.planType === 'quarterly' ? QUARTERLY_PRICE_XOF : MONTHLY_PRICE_XOF;
  const hasPriorConfirmed = record.subscriptions.some((s) => s.paymentStatus === 'confirmed');
  const isConfirmed = params.paymentStatus === 'confirmed';

  const period = computeSubscriptionPeriod(
    params.planType,
    params.nowMs,
    record.profile.subscriptionEndAtMs
  );

  const nextStatus: SubscriptionStatusType = isConfirmed
    ? hasPriorConfirmed
      ? 'renewed'
      : 'active'
    : 'cancelled';

  const subRecord: FirestoreSubscriptionRecord = {
    id: subId,
    userId: record.profile.uid || 'user',
    country: record.profile.country || 'Congo-Brazzaville',
    planType: params.planType,
    status: nextStatus,
    paymentStatus: params.paymentStatus,
    amount: amountXof,
    currency: 'XAF',
    amountXof,
    startDate: period.startDate,
    endDate: isConfirmed ? period.endDate : period.startDate,
    endAtMs: isConfirmed ? period.endAtMs : params.nowMs,
    idempotencyKey: params.idempotencyKey,
    createdAtMs: params.nowMs,
    updatedAtMs: params.nowMs,
  };
  record.subscriptions.push(subRecord);

  // Un paiement en attente ou échoué NE DOIT JAMAIS activer l'abonnement ni créer de commission
  if (!isConfirmed) {
    return { activated: false, idempotentReplay: false, subId };
  }

  record.profile = {
    ...record.profile,
    status: 'Premium',
    subscriptionStatus: nextStatus,
    subscriptionType: params.planType,
    subscriptionStartAtMs: period.startAtMs,
    subscriptionEndAtMs: period.endAtMs,
    lastConfirmedSubscriptionId: subId,
    trialDaysLeft: 0,
  };

  // Commission partenaire uniquement lors du premier paiement confirmé
  if (
    !hasPriorConfirmed &&
    record.profile.referredByPartnerId &&
    record.profile.referredByCode &&
    !record.commissions.some((c) => c.userId === record.profile.uid)
  ) {
    record.commissions.push({
      id: record.profile.uid || 'user',
      partnerId: record.profile.referredByPartnerId,
      referralCode: record.profile.referredByCode,
      userId: record.profile.uid || 'user',
      anonymizedUserRef: anonymizeUserId(record.profile.uid || 'user'),
      subscriptionId: subId,
      planType: params.planType,
      paymentAmountXof: amountXof,
      amountXof: params.partnerCommissionXof ?? DEFAULT_PARTNER_COMMISSION_XOF,
      commissionType: 'first_payment_only',
      status: 'pending',
      createdAtMs: params.nowMs,
      updatedAtMs: params.nowMs,
    });
  }

  return { activated: true, idempotentReplay: false, subId };
}

function runAll10Scenarios(): void {
  const t0 = Date.UTC(2026, 10, 1, 10, 0, 0); // 1er nov 2026 10:00 UTC

  // =========================================================================
  // SCÉNARIO 1 : Création de compte et démarrage de l'essai gratuit de 7 jours
  // =========================================================================
  const account = createAccountWithFreeTrial({
    uid: 'user_trial_001',
    name: 'Jean Kabila',
    email: 'jean@example.com',
    nowMs: t0,
  });
  assertEqual(account.profile.trialStartedAtMs, t0, 'Scenario 1: trialStartedAtMs recorded');
  assertEqual(account.profile.trialEndsAtMs, t0 + TRIAL_DURATION_MS, 'Scenario 1: trialEndsAtMs = +7 days');
  assertEqual(account.profile.hasUsedFreeTrial, true, 'Scenario 1: single trial flag marked true');
  assertEqual(TRIAL_DURATION_DAYS, 7, 'Scenario 1: trial duration is 7 days');

  // =========================================================================
  // SCÉNARIO 2 : Utilisation normale pendant les 7 jours + calcul dynamique
  // =========================================================================
  const tDay1 = t0 + 1 * MS_PER_DAY;
  const accessDay1 = getSubscriptionAccessState(account.profile, tDay1);
  assertEqual(accessDay1.phase, 'trial_active', 'Scenario 2: active trial on day 1');
  assertEqual(accessDay1.hasFullAccess, true, 'Scenario 2: full access granted');
  assertEqual(accessDay1.trialDaysLeft, 6, 'Scenario 2: 6 days left after 24h');
  assertEqual(computeTrialDaysLeft(account.profile.trialEndsAtMs!, t0 + 6 * MS_PER_DAY + 3600_000), 1, 'Scenario 2: 1 day left near end');
  assert(canAccessFeature(accessDay1, 'dashboard'), 'Scenario 2: dashboard accessible');
  assert(canAccessFeature(accessDay1, 'calendar'), 'Scenario 2: calendar accessible');
  assert(canAccessFeature(accessDay1, 'bilan'), 'Scenario 2: bilan accessible');
  assert(canAccessFeature(accessDay1, 'add_expense'), 'Scenario 2: expense creation accessible');

  // Ajout de dépenses pendant l'essai
  account.expenses.push({
    id: 'exp-1',
    title: 'Transport matin',
    amount: 1500,
    currency: 'XAF',
    category: 'Transport',
    moment: 'Matin',
    date: '2026-11-02',
    createdAt: tDay1,
  });

  // =========================================================================
  // SCÉNARIO 3 : Expiration de l'essai gratuit sans paiement
  // =========================================================================
  const tExpired = t0 + 7 * MS_PER_DAY; // Exact expiration boundary
  const accessExpired = getSubscriptionAccessState(account.profile, tExpired);
  assertEqual(accessExpired.phase, 'trial_expired', 'Scenario 3: expired exactly at +7d');
  assertEqual(accessExpired.trialDaysLeft, 0, 'Scenario 3: 0 trial days left');
  assertEqual(accessExpired.isExpired, true, 'Scenario 3: isExpired flag true');

  // =========================================================================
  // SCÉNARIO 4 : Blocage des fonctionnalités après expiration
  // =========================================================================
  assertEqual(accessExpired.hasFullAccess, false, 'Scenario 4: full access revoked');
  assertEqual(canAccessFeature(accessExpired, 'dashboard'), false, 'Scenario 4: dashboard blocked');
  assertEqual(canAccessFeature(accessExpired, 'calendar'), false, 'Scenario 4: calendar blocked');
  assertEqual(canAccessFeature(accessExpired, 'bilan'), false, 'Scenario 4: bilan blocked');
  assertEqual(canAccessFeature(accessExpired, 'add_expense'), false, 'Scenario 4: add_expense blocked');
  assertEqual(canAccessFeature(accessExpired, 'delete_expense'), false, 'Scenario 4: delete_expense blocked');
  assertEqual(canAccessFeature(accessExpired, 'pdf_export'), false, 'Scenario 4: pdf_export blocked');
  assertEqual(canAccessFeature(accessExpired, 'profile'), true, 'Scenario 4: profile still accessible');
  assertEqual(canAccessFeature(accessExpired, 'payment'), true, 'Scenario 4: payment still accessible');
  assertEqual(canAccessFeature(accessExpired, 'logout'), true, 'Scenario 4: logout still accessible');

  // =========================================================================
  // SCÉNARIO 5 : Conservation des données utilisateur existantes
  // =========================================================================
  assertEqual(account.expenses.length, 1, 'Scenario 5: expenses preserved on expiration');
  assertEqual(account.expenses[0].title, 'Transport matin', 'Scenario 5: expense content intact');
  assertEqual(account.profile.email, 'jean@example.com', 'Scenario 5: user profile intact');

  // Tentative de réinitialisation du essai gratuit interdite : même avec status 'trial' et pas de trialDaysLeft reset
  const spoofedResetAttempt = getSubscriptionAccessState(
    { ...account.profile, trialDaysLeft: 7, subscriptionStatus: 'trial' },
    tExpired + 3600_000
  );
  assertEqual(spoofedResetAttempt.phase, 'trial_expired', 'Scenario 5b: trial cannot be restarted via trialDaysLeft reset');

  // =========================================================================
  // SCÉNARIO 7 (avant activation) : Paiement échoué et paiement en attente
  // =========================================================================
  const pendingRes = simulatePaymentWebhook(account, {
    planType: 'monthly',
    paymentStatus: 'pending',
    nowMs: tExpired + 1000,
    idempotencyKey: 'pay_pending_1',
  });
  assertEqual(pendingRes.activated, false, 'Scenario 7a: pending payment never activates Premium');
  const failedRes = simulatePaymentWebhook(account, {
    planType: 'monthly',
    paymentStatus: 'failed',
    nowMs: tExpired + 2000,
    idempotencyKey: 'pay_failed_1',
  });
  assertEqual(failedRes.activated, false, 'Scenario 7b: failed payment never activates Premium');
  assertEqual(
    getSubscriptionAccessState(account.profile, tExpired + 3000).hasFullAccess,
    false,
    'Scenario 7c: access remains blocked after pending/failed payments'
  );

  // =========================================================================
  // SCÉNARIO 6 : Paiement confirmé et activation immédiate de l'abonnement
  // =========================================================================
  const tPay = tExpired + 60_000;
  const confirmRes = simulatePaymentWebhook(account, {
    planType: 'monthly',
    paymentStatus: 'confirmed',
    nowMs: tPay,
    idempotencyKey: 'pay_ok_1',
  });
  assertEqual(confirmRes.activated, true, 'Scenario 6: confirmed payment activates Premium');
  assertEqual(account.profile.subscriptionStatus, 'active', 'Scenario 6: status set to active');
  assertEqual(account.profile.subscriptionStartAtMs, tPay, 'Scenario 6: startAt recorded');
  assert(
    typeof account.profile.subscriptionEndAtMs === 'number' &&
      account.profile.subscriptionEndAtMs > tPay + 27 * MS_PER_DAY,
    'Scenario 6: endAt extended ~1 month'
  );
  const accessActive = getSubscriptionAccessState(account.profile, tPay + 1000);
  assertEqual(accessActive.phase, 'premium_active', 'Scenario 6: phase premium_active');
  assertEqual(accessActive.hasFullAccess, true, 'Scenario 6: access restored immediately');
  assertEqual(account.expenses.length, 1, 'Scenario 6: historical data preserved');

  // =========================================================================
  // SCÉNARIO 8 : Expiration de l'abonnement payant sans renouvellement
  // =========================================================================
  const tSubExpired = account.profile.subscriptionEndAtMs! + 1000;
  const accessSubExpired = getSubscriptionAccessState(account.profile, tSubExpired);
  assertEqual(accessSubExpired.phase, 'subscription_expired', 'Scenario 8: expired paid subscription');
  assertEqual(accessSubExpired.hasFullAccess, false, 'Scenario 8: access blocked again');
  assertEqual(canAccessFeature(accessSubExpired, 'calendar'), false, 'Scenario 8: calendar re-blocked');
  assertEqual(canAccessFeature(accessSubExpired, 'payment'), true, 'Scenario 8: renewal payment accessible');

  // =========================================================================
  // SCÉNARIO 9 : Renouvellement confirmé (+ idempotence webhook)
  // =========================================================================
  const tRenew = tSubExpired + 5000;
  const renewRes = simulatePaymentWebhook(account, {
    planType: 'monthly',
    paymentStatus: 'confirmed',
    nowMs: tRenew,
    idempotencyKey: 'pay_renew_1',
  });
  assertEqual(renewRes.activated, true, 'Scenario 9: renewal activated');
  assertEqual(account.profile.subscriptionStatus, 'renewed', 'Scenario 9: status updated to renewed');
  const endAfterRenew = account.profile.subscriptionEndAtMs!;

  // Webhook rejoué avec la même clé idempotencyKey : aucune double extension
  const replayRes = simulatePaymentWebhook(account, {
    planType: 'monthly',
    paymentStatus: 'confirmed',
    nowMs: tRenew + 10_000,
    idempotencyKey: 'pay_renew_1',
  });
  assertEqual(replayRes.idempotentReplay, true, 'Scenario 9b: idempotent replay detected');
  assertEqual(account.profile.subscriptionEndAtMs, endAfterRenew, 'Scenario 9b: end date not double-extended');
  assertEqual(
    getSubscriptionAccessState(account.profile, tRenew + 20_000).hasFullAccess,
    true,
    'Scenario 9: access unlocked after renewal'
  );

  // =========================================================================
  // SCÉNARIO 10 : Parrainage partenaire + essai gratuit + premier paiement confirmé + renouvellement
  // =========================================================================
  const partner: Partner = {
    id: 'ptr_test_1',
    name: 'Mireille B.',
    channelName: 'Mireille Finance',
    socialNetwork: 'TikTok',
    contactInfo: '+242060000000',
    code: 'MIREILLE10',
    referralLink: 'https://talambongo.app/?ref=MIREILLE10',
    startDateMs: t0 - 5 * MS_PER_DAY,
    endDateMs: t0 + 90 * MS_PER_DAY,
    fixedAdFeeXof: DEFAULT_PARTNER_FIXED_FEE_XOF,
    commissionPerUserXof: 100,
    commissionType: 'first_payment_only',
    status: 'active',
    createdBy: 'admin_1',
    createdAtMs: t0 - 5 * MS_PER_DAY,
    updatedAtMs: t0 - 5 * MS_PER_DAY,
  };

  const referredUser = createAccountWithFreeTrial({
    uid: 'user_ref_999',
    name: 'Kévin M.',
    email: 'kevin@example.com',
    nowMs: t0,
    referral: { partnerId: partner.id, code: partner.code },
  });

  // Pendant l'essai gratuit : 0 commission
  assertEqual(referredUser.commissions.length, 0, 'Scenario 10: 0 commission during 7-day trial');

  // Paiement échoué d'un filleul : 0 commission
  simulatePaymentWebhook(referredUser, {
    planType: 'monthly',
    paymentStatus: 'failed',
    nowMs: t0 + 2 * MS_PER_DAY,
    idempotencyKey: 'ref_fail_1',
    partnerCommissionXof: 100,
  });
  assertEqual(referredUser.commissions.length, 0, 'Scenario 10: 0 commission on failed payment');

  // Premier paiement confirmé de 500 FCFA -> 1 seule commission de 100 FCFA
  simulatePaymentWebhook(referredUser, {
    planType: 'monthly',
    paymentStatus: 'confirmed',
    nowMs: t0 + 8 * MS_PER_DAY,
    idempotencyKey: 'ref_ok_1',
    partnerCommissionXof: 100,
  });
  assertEqual(referredUser.commissions.length, 1, 'Scenario 10: 1 commission on first confirmed payment');
  assertEqual(referredUser.commissions[0].amountXof, 100, 'Scenario 10: commission is 100 FCFA');

  // Renouvellement ultérieur du même filleul -> AUCUNE nouvelle commission
  simulatePaymentWebhook(referredUser, {
    planType: 'monthly',
    paymentStatus: 'confirmed',
    nowMs: t0 + 40 * MS_PER_DAY,
    idempotencyKey: 'ref_renew_2',
    partnerCommissionXof: 100,
  });
  assertEqual(referredUser.commissions.length, 1, 'Scenario 10: no second commission on renewal');

  const stats = computePartnerMetrics(
    partner,
    [],
    [
      {
        uid: 'user_ref_999',
        name: 'Kévin M.',
        email: 'kevin@example.com',
        country: 'Congo-Brazzaville',
        currency: 'XAF',
        role: 'USER',
        subscriptionStatus: 'renewed',
        subscriptionType: 'monthly',
        trialDaysLeft: 0,
        onboardingCompleted: true,
        expensesCount: 5,
        reportsViewedCount: 2,
        pdfExportsCount: 1,
        referredByPartnerId: partner.id,
        referredByCode: partner.code,
        createdAtMs: t0,
        lastActiveAtMs: t0 + 40 * MS_PER_DAY,
        updatedAtMs: t0 + 40 * MS_PER_DAY,
      },
    ],
    referredUser.commissions,
    t0 + 40 * MS_PER_DAY
  );
  assertEqual(stats.signupsCount, 1, 'Scenario 10: partner signup tracked');
  assertEqual(stats.payingUsersCount, 1, 'Scenario 10: 1 unique paid subscriber');
  assertEqual(stats.totalCommissionsXof, 100, 'Scenario 10: partner earned 100 FCFA commission total');
  assertEqual(referredUser.subscriptions.filter((s) => s.paymentStatus === 'confirmed').reduce((a, b) => a + b.amountXof, 0), 1000, 'Scenario 10: total revenue across initial + renewal = 1000 FCFA');

  // Bonus : Admin jamais bloqué même sans dates d'essai
  const adminAccess = getSubscriptionAccessState({
    role: 'ADMIN',
    status: 'Premium',
    trialDaysLeft: 0,
  });
  assertEqual(adminAccess.hasFullAccess, true, 'Admin always unrestricted');

  console.log('✅ Tous les 10 scénarios Essai Gratuit (7 jours) & Abonnement Premium ont réussi.');
}

runAll10Scenarios();
