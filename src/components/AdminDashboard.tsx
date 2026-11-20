import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileText,
  Globe2,
  Handshake,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  AdminDashboardPayload,
  AdminPartnersPayload,
  fetchAdminDashboardData,
  fetchAdminPartnersData,
  grantAdminAccess,
  revokeAdminAccess,
  saveAdminSettings,
  syncAdminStatsSummary,
  VerifiedRoleResolution,
} from '../services/firebaseService';
import {
  AdminRegistryEntry,
  AdminSettingsConfig,
  FirestoreSubscriptionRecord,
  FirestoreUserAccount,
  Partner,
  PartnerAuditLog,
  PartnerClickRecord,
  PartnerCommissionRecord,
  SupportedCurrency,
} from '../types';
import { convertAmount, formatCurrency, SUPPORTED_CURRENCIES } from '../utils/currency';
import { AdminPartnersSection } from './AdminPartnersSection';

type AdminTab =
  | 'overview'
  | 'users'
  | 'growth'
  | 'geography'
  | 'subscriptions'
  | 'revenues'
  | 'activity'
  | 'partners'
  | 'settings';

type PeriodPreset =
  | 'today'
  | '7d'
  | '30d'
  | 'this_week'
  | 'this_month'
  | 'prev_month'
  | 'custom';

interface AdminDashboardProps {
  currentAdminUid: string;
  currentAdminName: string;
  currentAdminEmail: string;
  roleResolution: VerifiedRoleResolution;
  onLogout: () => void;
}

const COUNTRY_FLAGS: Record<string, string> = {
  'Congo-Brazzaville': '🇨🇬',
  'RD Congo': '🇨🇩',
  'Côte d’Ivoire': '🇨🇮',
  "Côte d'Ivoire": '🇨🇮',
  Cameroun: '🇨🇲',
  Sénégal: '🇸🇳',
  Gabon: '🇬🇦',
  Bénin: '🇧🇯',
  Togo: '🇹🇬',
  Mali: '🇲🇱',
  'Burkina Faso': '🇧🇫',
  Guinée: '🇬🇳',
  Niger: '🇳🇪',
  Tchad: '🇹🇩',
  Rwanda: '🇷🇼',
  Burundi: '🇧🇮',
  France: '🇫🇷',
  Belgique: '🇧🇪',
  Canada: '🇨🇦',
  'Autre pays': '🌍',
};

const PERIOD_OPTIONS: { id: PeriodPreset; label: string }[] = [
  { id: 'today', label: "Aujourd'hui" },
  { id: '7d', label: '7 derniers jours' },
  { id: '30d', label: '30 derniers jours' },
  { id: 'this_week', label: 'Cette semaine' },
  { id: 'this_month', label: 'Ce mois' },
  { id: 'prev_month', label: 'Mois précédent' },
  { id: 'custom', label: 'Personnaliser une période' },
];

const CHART_PALETTE = [
  '#063D2E',
  '#087A50',
  '#13B981',
  '#34D399',
  '#0D9488',
  '#0284C7',
  '#64748B',
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function toInputDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDateRangeForPreset(
  preset: PeriodPreset,
  customStartStr: string,
  customEndStr: string
): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  let start = startOfDay(now);
  let end = endOfDay(now);

  if (preset === 'today') {
    start = startOfDay(now);
    end = endOfDay(now);
  } else if (preset === '7d') {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    end = endOfDay(now);
  } else if (preset === '30d') {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    end = endOfDay(now);
  } else if (preset === 'this_week') {
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday));
    end = endOfDay(now);
  } else if (preset === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = endOfDay(now);
  } else if (preset === 'prev_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (preset === 'custom') {
    const parsedStart = customStartStr ? new Date(`${customStartStr}T00:00:00`) : startOfDay(now);
    const parsedEnd = customEndStr ? new Date(`${customEndStr}T23:59:59.999`) : endOfDay(now);
    if (!Number.isNaN(parsedStart.getTime()) && !Number.isNaN(parsedEnd.getTime())) {
      if (parsedStart <= parsedEnd) {
        start = parsedStart;
        end = parsedEnd;
      } else {
        start = startOfDay(parsedEnd);
        end = endOfDay(parsedStart);
      }
    }
  }

  const durationMs = Math.max(1, end.getTime() - start.getTime() + 1);
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs + 1);

  return { start, end, prevStart, prevEnd };
}

function formatGrowthDelta(current: number, previous: number): {
  pctLabel: string;
  direction: 'up' | 'down' | 'neutral';
} {
  if (previous === 0 && current === 0) {
    return { pctLabel: '0%', direction: 'neutral' };
  }
  if (previous === 0) {
    return { pctLabel: '+100%', direction: 'up' };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) {
    return { pctLabel: `+${pct}%`, direction: 'up' };
  }
  if (pct < 0) {
    return { pctLabel: `${pct}%`, direction: 'down' };
  }
  return { pctLabel: '0%', direction: 'neutral' };
}

function formatDateShort(ms: number): string {
  return new Date(ms).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isUserPaid(u: FirestoreUserAccount): boolean {
  if (u.subscriptionStatus !== 'active' && u.subscriptionStatus !== 'renewed') {
    return false;
  }
  const endMs =
    typeof u.subscriptionEndAtMs === 'number'
      ? u.subscriptionEndAtMs
      : u.subscriptionEndAt
      ? Date.parse(u.subscriptionEndAt)
      : NaN;
  if (!Number.isNaN(endMs) && endMs <= Date.now()) {
    return false;
  }
  return true;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentAdminUid,
  currentAdminName,
  currentAdminEmail,
  roleResolution,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Data from Firestore
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [users, setUsers] = useState<FirestoreUserAccount[]>([]);
  const [subscriptions, setSubscriptions] = useState<FirestoreSubscriptionRecord[]>([]);
  const [admins, setAdmins] = useState<AdminRegistryEntry[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerClicks, setPartnerClicks] = useState<PartnerClickRecord[]>([]);
  const [partnerCommissions, setPartnerCommissions] = useState<PartnerCommissionRecord[]>([]);
  const [partnerAuditLogs, setPartnerAuditLogs] = useState<PartnerAuditLog[]>([]);
  const [settings, setSettings] = useState<AdminSettingsConfig>({
    activeActivityThresholdDays: 30,
    defaultAdminCurrency: 'XOF',
  });

  // Filters
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return toInputDateStr(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => toInputDateStr(new Date()));
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>('XOF');

  // Growth chart toggles
  const [growthGranularity, setGrowthGranularity] = useState<'day' | 'week'>('day');
  const [growthCumulative, setGrowthCumulative] = useState(false);
  const [hoveredGrowthIndex, setHoveredGrowthIndex] = useState<number | null>(null);

  // Users directory filters
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState<'all' | 'paid' | 'free'>('all');
  const [userCountryFilter, setUserCountryFilter] = useState<string>('all');

  // Settings tab state
  const [thresholdInput, setThresholdInput] = useState<number>(30);
  const [defaultCurrencyInput, setDefaultCurrencyInput] = useState<SupportedCurrency>('XOF');
  const [settingsSavedBanner, setSettingsSavedBanner] = useState<string | null>(null);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [adminActionError, setAdminActionError] = useState<string | null>(null);
  const [adminActionSuccess, setAdminActionSuccess] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMsg(null);

    try {
      const [payload, partnersPayload]: [AdminDashboardPayload, AdminPartnersPayload] =
        await Promise.all([fetchAdminDashboardData(), fetchAdminPartnersData()]);
      setUsers(payload.users);
      setSubscriptions(payload.subscriptions);
      setAdmins(payload.admins);
      setPartners(partnersPayload.partners);
      setPartnerClicks(partnersPayload.clicks);
      setPartnerCommissions(partnersPayload.commissions);
      setPartnerAuditLogs(partnersPayload.auditLogs);
      setSettings(payload.settings);
      setThresholdInput(payload.settings.activeActivityThresholdDays);
      setDefaultCurrencyInput(payload.settings.defaultAdminCurrency);
      if (!isRefresh) {
        setSelectedCurrency(payload.settings.defaultAdminCurrency);
      }

      // Sync global summary document cleanly
      const nowMs = Date.now();
      const thresholdMs = payload.settings.activeActivityThresholdDays * 86400000;
      const activeCount = payload.users.filter((u) => nowMs - u.lastActiveAtMs <= thresholdMs).length;
      const paidCount = payload.users.filter((u) => isUserPaid(u)).length;
      const freeCount = payload.users.length - paidCount;
      const confirmedRevenueXof = payload.subscriptions
        .filter((s) => s.paymentStatus === 'confirmed')
        .reduce((acc, s) => acc + s.amountXof, 0);
      const countriesSet = new Set(payload.users.map((u) => u.country).filter(Boolean));
      const totalExpensesLogged = payload.users.reduce((acc, u) => acc + u.expensesCount, 0);
      const totalReportsViewed = payload.users.reduce((acc, u) => acc + u.reportsViewedCount, 0);
      const totalPdfExports = payload.users.reduce((acc, u) => acc + u.pdfExportsCount, 0);
      const usersWithExpenses = payload.users.filter((u) => u.expensesCount >= 10).length;

      await syncAdminStatsSummary({
        totalUsers: payload.users.length,
        activeUsers30d: activeCount,
        paidUsers: paidCount,
        freeUsers: freeCount,
        totalRevenueXof: confirmedRevenueXof,
        countriesCount: countriesSet.size,
        totalExpensesLogged,
        totalReportsViewed,
        totalPdfExports,
        usersWithExpenses,
      });
    } catch (err) {
      console.error('Admin fetch error:', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les statistiques administrateur.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const { start, end, prevStart, prevEnd } = useMemo(
    () => getDateRangeForPreset(periodPreset, customStartDate, customEndDate),
    [periodPreset, customStartDate, customEndDate]
  );

  // Core KPI Calculations
  const kpis = useMemo(() => {
    const startMs = start.getTime();
    const endMs = end.getTime();
    const prevStartMs = prevStart.getTime();
    const prevEndMs = prevEnd.getTime();

    const thresholdMs = settings.activeActivityThresholdDays * 86400000;
    const referenceNowMs = Math.min(Date.now(), endMs);

    const totalUsers = users.length;
    const totalUsersUntilPrevEnd = users.filter((u) => u.createdAtMs <= prevEndMs).length;

    const activeUsers = users.filter(
      (u) =>
        u.lastActiveAtMs >= referenceNowMs - thresholdMs &&
        u.lastActiveAtMs <= endMs
    ).length;
    const prevActiveUsers = users.filter(
      (u) =>
        u.lastActiveAtMs >= prevEndMs - thresholdMs &&
        u.lastActiveAtMs <= prevEndMs
    ).length;

    const newUsers = users.filter(
      (u) => u.createdAtMs >= startMs && u.createdAtMs <= endMs
    ).length;
    const prevNewUsers = users.filter(
      (u) => u.createdAtMs >= prevStartMs && u.createdAtMs <= prevEndMs
    ).length;

    const paidUsers = users.filter((u) => isUserPaid(u)).length;
    const prevPaidUsers = users.filter(
      (u) => isUserPaid(u) && u.createdAtMs <= prevEndMs
    ).length;

    const freeUsers = totalUsers - paidUsers;
    const prevFreeUsers = Math.max(0, totalUsersUntilPrevEnd - prevPaidUsers);

    const confirmedSubsInPeriod = subscriptions.filter(
      (s) =>
        s.paymentStatus === 'confirmed' &&
        s.createdAtMs >= startMs &&
        s.createdAtMs <= endMs
    );
    const prevConfirmedSubs = subscriptions.filter(
      (s) =>
        s.paymentStatus === 'confirmed' &&
        s.createdAtMs >= prevStartMs &&
        s.createdAtMs <= prevEndMs
    );

    const revenueXofPeriod = confirmedSubsInPeriod.reduce((acc, s) => acc + s.amountXof, 0);
    const prevRevenueXof = prevConfirmedSubs.reduce((acc, s) => acc + s.amountXof, 0);

    const revenueSelected = convertAmount(revenueXofPeriod, 'XOF', selectedCurrency);
    const prevRevenueSelected = convertAmount(prevRevenueXof, 'XOF', selectedCurrency);

    const countriesSet = new Set(users.map((u) => u.country).filter(Boolean));
    const prevCountriesSet = new Set(
      users
        .filter((u) => u.createdAtMs <= prevEndMs)
        .map((u) => u.country)
        .filter(Boolean)
    );

    return {
      totalUsers,
      totalUsersDelta: formatGrowthDelta(totalUsers, totalUsersUntilPrevEnd),
      activeUsers,
      activeUsersDelta: formatGrowthDelta(activeUsers, prevActiveUsers),
      newUsers,
      newUsersDelta: formatGrowthDelta(newUsers, prevNewUsers),
      paidUsers,
      paidUsersDelta: formatGrowthDelta(paidUsers, prevPaidUsers),
      freeUsers,
      freeUsersDelta: formatGrowthDelta(freeUsers, prevFreeUsers),
      revenueSelected,
      revenueDelta: formatGrowthDelta(revenueSelected, prevRevenueSelected),
      countriesCount: countriesSet.size,
      countriesDelta: formatGrowthDelta(countriesSet.size, prevCountriesSet.size),
    };
  }, [users, subscriptions, start, end, prevStart, prevEnd, settings.activeActivityThresholdDays, selectedCurrency]);

  // Growth Series Data (Day or Week buckets)
  const growthSeries = useMemo(() => {
    const startDay = startOfDay(start);
    const endDay = startOfDay(end);
    const totalDays = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / 86400000) + 1);

    if (growthGranularity === 'day' || totalDays <= 10) {
      const buckets: {
        label: string;
        fullDate: string;
        count: number;
        cumulative: number;
      }[] = [];

      let runningCumulative = users.filter((u) => u.createdAtMs < startDay.getTime()).length;
      const limitDays = Math.min(totalDays, 90);
      const effectiveStart =
        totalDays > 90
          ? new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() - 89)
          : startDay;

      if (totalDays > 90) {
        runningCumulative = users.filter((u) => u.createdAtMs < effectiveStart.getTime()).length;
      }

      for (let i = 0; i < limitDays; i++) {
        const d = new Date(
          effectiveStart.getFullYear(),
          effectiveStart.getMonth(),
          effectiveStart.getDate() + i
        );
        const dayStartMs = startOfDay(d).getTime();
        const dayEndMs = endOfDay(d).getTime();
        const count = users.filter(
          (u) => u.createdAtMs >= dayStartMs && u.createdAtMs <= dayEndMs
        ).length;
        runningCumulative += count;

        buckets.push({
          label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
          fullDate: d.toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
          count,
          cumulative: runningCumulative,
        });
      }
      return buckets;
    }

    // Weekly buckets
    const buckets: { label: string; fullDate: string; count: number; cumulative: number }[] = [];
    let cursor = new Date(startDay);
    let runningCumulative = users.filter((u) => u.createdAtMs < startDay.getTime()).length;

    while (cursor <= endDay) {
      const weekStart = startOfDay(cursor);
      const weekEndRaw = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 6
      );
      const weekEnd = weekEndRaw > endDay ? endOfDay(endDay) : endOfDay(weekEndRaw);

      const count = users.filter(
        (u) => u.createdAtMs >= weekStart.getTime() && u.createdAtMs <= weekEnd.getTime()
      ).length;
      runningCumulative += count;

      buckets.push({
        label: weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        fullDate: `Semaine du ${weekStart.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
        })} au ${weekEnd.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
        })}`,
        count,
        cumulative: runningCumulative,
      });

      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
    }
    return buckets;
  }, [users, start, end, growthGranularity]);

  // Geography Aggregation
  const geographyStats = useMemo(() => {
    const startMs = start.getTime();
    const endMs = end.getTime();

    const map = new Map<
      string,
      {
        country: string;
        total: number;
        newInPeriod: number;
        paid: number;
        free: number;
        revenueXof: number;
      }
    >();

    for (const u of users) {
      const c = u.country || 'Non spécifié';
      const entry = map.get(c) || {
        country: c,
        total: 0,
        newInPeriod: 0,
        paid: 0,
        free: 0,
        revenueXof: 0,
      };
      entry.total += 1;
      if (u.createdAtMs >= startMs && u.createdAtMs <= endMs) {
        entry.newInPeriod += 1;
      }
      if (isUserPaid(u)) {
        entry.paid += 1;
      } else {
        entry.free += 1;
      }
      map.set(c, entry);
    }

    for (const s of subscriptions) {
      if (s.paymentStatus === 'confirmed') {
        const c = s.country || 'Non spécifié';
        const entry = map.get(c);
        if (entry) {
          entry.revenueXof += s.amountXof;
        }
      }
    }

    const totalUsersCount = Math.max(1, users.length);
    return Array.from(map.values())
      .map((item, idx) => ({
        ...item,
        percentage: users.length > 0 ? Math.round((item.total / totalUsersCount) * 1000) / 10 : 0,
        color: CHART_PALETTE[idx % CHART_PALETTE.length],
      }))
      .sort((a, b) => b.total - a.total);
  }, [users, subscriptions, start, end]);

  // Subscription Breakdown
  const subscriptionStats = useMemo(() => {
    const activeMonthly = users.filter(
      (u) => isUserPaid(u) && u.subscriptionType === 'monthly'
    ).length;
    const activeQuarterly = users.filter(
      (u) => isUserPaid(u) && u.subscriptionType === 'quarterly'
    ).length;
    const trialUsers = users.filter((u) => u.subscriptionStatus === 'trial').length;
    const expiredUsers = users.filter((u) => u.subscriptionStatus === 'expired').length;
    const renewedUsers = users.filter((u) => u.subscriptionStatus === 'renewed').length;
    const cancelledUsers = users.filter((u) => u.subscriptionStatus === 'cancelled').length;

    const confirmedPayments = subscriptions.filter((s) => s.paymentStatus === 'confirmed');
    const pendingPayments = subscriptions.filter((s) => s.paymentStatus === 'pending');
    const failedPayments = subscriptions.filter((s) => s.paymentStatus === 'failed');

    const totalRevenueXof = confirmedPayments.reduce((acc, s) => acc + s.amountXof, 0);
    const monthlyRevenueXof = confirmedPayments
      .filter((s) => s.planType === 'monthly')
      .reduce((acc, s) => acc + s.amountXof, 0);
    const quarterlyRevenueXof = confirmedPayments
      .filter((s) => s.planType === 'quarterly')
      .reduce((acc, s) => acc + s.amountXof, 0);
    const pendingRevenueXof = pendingPayments.reduce((acc, s) => acc + s.amountXof, 0);

    return {
      activeMonthly,
      activeQuarterly,
      trialUsers,
      expiredUsers,
      renewedUsers,
      cancelledUsers,
      confirmedCount: confirmedPayments.length,
      pendingCount: pendingPayments.length,
      failedCount: failedPayments.length,
      totalRevenueXof,
      monthlyRevenueXof,
      quarterlyRevenueXof,
      pendingRevenueXof,
    };
  }, [users, subscriptions]);

  // Global Anonymized Activity Metrics
  const globalActivity = useMemo(() => {
    const totalExpensesLogged = users.reduce((acc, u) => acc + u.expensesCount, 0);
    const totalReportsViewed = users.reduce((acc, u) => acc + u.reportsViewedCount, 0);
    const totalPdfExports = users.reduce((acc, u) => acc + u.pdfExportsCount, 0);
    const usersWithExpenses = users.filter((u) => u.expensesCount >= 10).length;
    const activationRate =
      users.length > 0 ? Math.round((usersWithExpenses / users.length) * 100) : 0;

    const freqMap = new Map<string, number>();
    const goalMap = new Map<string, number>();
    for (const u of users) {
      if (u.trackingFrequency) {
        freqMap.set(u.trackingFrequency, (freqMap.get(u.trackingFrequency) || 0) + 1);
      }
      if (u.mainGoal) {
        goalMap.set(u.mainGoal, (goalMap.get(u.mainGoal) || 0) + 1);
      }
    }

    return {
      totalExpensesLogged,
      totalReportsViewed,
      totalPdfExports,
      usersWithExpenses,
      activationRate,
      frequencies: Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]),
      goals: Array.from(goalMap.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [users]);

  // Filtered Users Directory
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users
      .filter((u) => {
        if (userPlanFilter === 'paid' && !isUserPaid(u)) return false;
        if (userPlanFilter === 'free' && isUserPaid(u)) return false;
        if (userCountryFilter !== 'all' && u.country !== userCountryFilter) return false;
        if (q) {
          const hay = `${u.name} ${u.email} ${u.country}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [users, userSearch, userPlanFilter, userCountryFilter]);

  const availableCountries = useMemo(() => {
    return Array.from(new Set(users.map((u) => u.country).filter(Boolean))).sort();
  }, [users]);

  // Save Admin Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSavedBanner(null);
    try {
      const next: AdminSettingsConfig = {
        activeActivityThresholdDays: thresholdInput,
        defaultAdminCurrency: defaultCurrencyInput,
      };
      await saveAdminSettings(next);
      setSettings(next);
      setSelectedCurrency(defaultCurrencyInput);
      setSettingsSavedBanner('Paramètres administrateur enregistrés dans Firebase.');
    } catch (err) {
      setAdminActionError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Add new admin
  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminActionError(null);
    setAdminActionSuccess(null);
    if (!newAdminUid.trim() || !newAdminEmail.trim()) {
      setAdminActionError('Veuillez renseigner l’UID Firebase et l’adresse e-mail.');
      return;
    }
    try {
      await grantAdminAccess({
        uid: newAdminUid.trim(),
        email: newAdminEmail.trim(),
        displayName: newAdminName.trim() || newAdminEmail.split('@')[0],
        grantedBy: currentAdminUid,
      });
      setNewAdminUid('');
      setNewAdminEmail('');
      setNewAdminName('');
      setAdminActionSuccess('Accès administrateur accordé avec succès.');
      await loadData(true);
    } catch (err) {
      setAdminActionError(
        err instanceof Error ? err.message : 'Impossible d’accorder le rôle administrateur.'
      );
    }
  };

  const handleRevokeAdmin = async (uid: string) => {
    if (uid === currentAdminUid) {
      setAdminActionError('Vous ne pouvez pas révoquer votre propre accès administrateur actif.');
      return;
    }
    setAdminActionError(null);
    setAdminActionSuccess(null);
    try {
      await revokeAdminAccess(uid);
      setAdminActionSuccess('Privilège administrateur révoqué.');
      await loadData(true);
    } catch (err) {
      setAdminActionError(
        err instanceof Error ? err.message : 'Erreur lors de la révocation.'
      );
    }
  };

  const NAV_ITEMS: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'growth', label: 'Croissance et inscriptions', icon: TrendingUp },
    { id: 'geography', label: 'Répartition géographique', icon: Globe2 },
    { id: 'subscriptions', label: 'Abonnements', icon: CreditCard },
    { id: 'revenues', label: 'Revenus', icon: DollarSign },
    { id: 'activity', label: 'Activité globale', icon: Activity },
    { id: 'partners', label: 'Partenaires', icon: Handshake },
    { id: 'settings', label: 'Paramètres administrateur', icon: Settings },
  ];

  // SVG Growth Chart dimensions & scaling
  const chartValues = growthSeries.map((b) => (growthCumulative ? b.cumulative : b.count));
  const maxChartVal = Math.max(1, ...chartValues);
  const svgW = 720;
  const svgH = 220;
  const padX = 28;
  const padY = 20;
  const plotW = svgW - padX * 2;
  const plotH = svgH - padY * 2;

  const chartPoints = growthSeries.map((b, idx) => {
    const val = growthCumulative ? b.cumulative : b.count;
    const x =
      growthSeries.length === 1
        ? padX + plotW / 2
        : padX + (idx / (growthSeries.length - 1)) * plotW;
    const y = padY + plotH - (val / maxChartVal) * plotH;
    return { x, y, val, ...b };
  });

  const linePath =
    chartPoints.length > 0
      ? chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : '';
  const areaPath =
    chartPoints.length > 0
      ? `${linePath} L ${chartPoints[chartPoints.length - 1].x.toFixed(1)} ${(padY + plotH).toFixed(1)} L ${chartPoints[0].x.toFixed(1)} ${(padY + plotH).toFixed(1)} Z`
      : '';

  return (
    <div className="min-h-screen bg-[#f5faf7] text-slate-900 flex font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-[264px] lg:flex-col lg:fixed lg:inset-y-0 bg-[#063D2E] text-white border-r border-emerald-950/30 z-30">
        <div className="px-6 py-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#13B981] text-[#063D2E] flex items-center justify-center shrink-0">
            <Eye className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="font-black text-base tracking-tight block leading-none">
              TalaMbongo
            </span>
            <span className="text-[11px] text-emerald-200/80 font-semibold">
              Console Administration
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-[#087A50] text-white border border-[#13B981]/40'
                    : 'text-emerald-100/80 hover:bg-white/5 hover:text-white border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#B7F5D5]' : 'text-emerald-300/70'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 text-xs font-bold text-[#B7F5D5]">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{currentAdminName}</span>
            </div>
            <p className="text-[11px] text-emerald-200/70 truncate mt-0.5">{currentAdminEmail}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/45"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-[#063D2E] text-white flex flex-col h-full z-10">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#13B981] text-[#063D2E] flex items-center justify-center">
                  <Eye className="w-4 h-4 stroke-[2.5]" />
                </div>
                <span className="font-black text-base">TalaMbongo</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 rounded-lg text-emerald-200 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                      active
                        ? 'bg-[#087A50] text-white'
                        : 'text-emerald-100/80 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10">
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 text-xs font-bold text-white"
              >
                <LogOut className="w-4 h-4" />
                <span>Déconnexion</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 lg:pl-[264px] flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                aria-label="Ouvrir le menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#087A50]">
                    TalaMbongo Admin
                  </span>
                  <span className="text-slate-300">/</span>
                  <span className="text-xs font-semibold text-slate-500 truncate">
                    {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
                  </span>
                </div>
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                  Bienvenue, {currentAdminName} — Pilotage SaaS
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={refreshing || loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#087A50] hover:bg-[#063D2E] text-white text-xs font-bold transition whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Actualiser</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition whitespace-nowrap cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Scroll Container */}
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-4">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => loadData(true)}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold shrink-0 cursor-pointer"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* Global Temporal & Currency Filters (shown on analytics tabs) */}
          {['overview', 'growth', 'geography', 'subscriptions', 'revenues'].includes(activeTab) && (
            <section className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {PERIOD_OPTIONS.map((opt) => {
                  const isActive = periodPreset === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPeriodPreset(opt.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-[#063D2E] text-white'
                          : 'bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-[#087A50]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {periodPreset === 'custom' && (
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-[#087A50]" />
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50 focus:outline-none focus:border-[#087A50]"
                    />
                    <span className="text-slate-400">au</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50 focus:outline-none focus:border-[#087A50]"
                    />
                  </div>
                )}

                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500">Devise :</span>
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value as SupportedCurrency)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#087A50]"
                  >
                    {Object.values(SUPPORTED_CURRENCIES).map((cur) => (
                      <option key={cur.code} value={cur.code}>
                        {cur.code} ({cur.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* LOADING SKELETON */}
          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-32 rounded-2xl bg-white border border-slate-200/80 p-5 animate-pulse space-y-3"
                  >
                    <div className="h-3 w-28 bg-slate-200 rounded" />
                    <div className="h-7 w-24 bg-slate-200 rounded" />
                    <div className="h-3 w-36 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
              <div className="h-72 rounded-2xl bg-white border border-slate-200/80 animate-pulse" />
            </div>
          ) : (
            <>
              {/* ===================================================== */}
              {/* 1. VUE D'ENSEMBLE                                     */}
              {/* ===================================================== */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* 7 KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                      title="Nombre total d'utilisateurs"
                      value={kpis.totalUsers.toLocaleString('fr-FR')}
                      delta={kpis.totalUsersDelta}
                      subtitle="Comptes créés au total"
                      icon={Users}
                    />
                    <KpiCard
                      title={`Utilisateurs actifs (${settings.activeActivityThresholdDays}j)`}
                      value={kpis.activeUsers.toLocaleString('fr-FR')}
                      delta={kpis.activeUsersDelta}
                      subtitle={`Connexion ou action sur ${settings.activeActivityThresholdDays} jours`}
                      icon={UserCheck}
                    />
                    <KpiCard
                      title="Nouveaux utilisateurs"
                      value={kpis.newUsers.toLocaleString('fr-FR')}
                      delta={kpis.newUsersDelta}
                      subtitle="Inscriptions sur la période"
                      icon={UserPlus}
                    />
                    <KpiCard
                      title="Utilisateurs payants"
                      value={kpis.paidUsers.toLocaleString('fr-FR')}
                      delta={kpis.paidUsersDelta}
                      subtitle="Abonnements payés et valides"
                      icon={CreditCard}
                    />
                    <KpiCard
                      title="Utilisateurs gratuits"
                      value={kpis.freeUsers.toLocaleString('fr-FR')}
                      delta={kpis.freeUsersDelta}
                      subtitle="Essai gratuit ou sans abonnement"
                      icon={Sparkles}
                    />
                    <KpiCard
                      title={`Revenus (${selectedCurrency})`}
                      value={formatCurrency(kpis.revenueSelected, selectedCurrency)}
                      delta={kpis.revenueDelta}
                      subtitle="Paiements confirmés sur la période"
                      icon={DollarSign}
                      accent
                    />
                    <KpiCard
                      title="Pays représentés"
                      value={kpis.countriesCount.toLocaleString('fr-FR')}
                      delta={kpis.countriesDelta}
                      subtitle="Pays choisis par les utilisateurs"
                      icon={Globe2}
                    />
                  </div>

                  {/* Overview Interactive Visuals */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-sm font-extrabold text-slate-900">
                            Courbe des inscriptions
                          </h2>
                          <p className="text-xs text-slate-500">
                            Évolution sur la période sélectionnée ({growthSeries.length} points)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('growth')}
                          className="text-xs font-bold text-[#087A50] hover:text-[#063D2E] cursor-pointer"
                        >
                          Analyser en détail →
                        </button>
                      </div>

                      {growthSeries.length === 0 ? (
                        <EmptyBlock message="Aucune inscription enregistrée pour cette période." />
                      ) : (
                        <GrowthSvgChart
                          series={growthSeries}
                          chartPoints={chartPoints}
                          linePath={linePath}
                          areaPath={areaPath}
                          svgW={svgW}
                          svgH={svgH}
                          padX={padX}
                          padY={padY}
                          plotH={plotH}
                          maxVal={maxChartVal}
                          hoveredIndex={hoveredGrowthIndex}
                          onHover={setHoveredGrowthIndex}
                          cumulative={false}
                        />
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-sm font-extrabold text-slate-900">
                            Top pays
                          </h2>
                          <p className="text-xs text-slate-500">
                            Basé sur le pays déclaré à l’inscription
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('geography')}
                          className="text-xs font-bold text-[#087A50] hover:text-[#063D2E] cursor-pointer"
                        >
                          Tout voir →
                        </button>
                      </div>

                      {geographyStats.length === 0 ? (
                        <EmptyBlock message="Aucun pays enregistré pour le moment." />
                      ) : (
                        <div className="space-y-3">
                          {geographyStats.slice(0, 6).map((item) => (
                            <div key={item.country} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                                  <span>{COUNTRY_FLAGS[item.country] || '🌍'}</span>
                                  <span className="truncate">{item.country}</span>
                                </span>
                                <span className="font-bold text-slate-900 tabular-nums shrink-0">
                                  {item.total} ({item.percentage}%)
                                </span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.max(4, item.percentage)}%`,
                                    backgroundColor: item.color,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================== */}
              {/* 2. UTILISATEURS (MÉTRIQUES NON INTRUSIVES)            */}
              {/* ===================================================== */}
              {activeTab === 'users' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                      <span className="text-xs font-semibold text-slate-500">Total comptes</span>
                      <p className="text-2xl font-black text-slate-900 tabular-nums mt-1">
                        {users.length.toLocaleString('fr-FR')}
                      </p>
                      <span className="text-[11px] text-slate-500">
                        {users.filter((u) => u.onboardingCompleted).length} profils configurés
                      </span>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                      <span className="text-xs font-semibold text-slate-500">Taux payants</span>
                      <p className="text-2xl font-black text-[#087A50] tabular-nums mt-1">
                        {users.length > 0
                          ? `${Math.round((kpis.paidUsers / users.length) * 100)}%`
                          : '0%'}
                      </p>
                      <span className="text-[11px] text-slate-500">
                        {kpis.paidUsers} payants • {kpis.freeUsers} gratuits
                      </span>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                      <span className="text-xs font-semibold text-slate-500">Confidentialité stricte</span>
                      <p className="text-sm font-bold text-slate-900 mt-1.5 flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-[#087A50]" />
                        <span>Dépenses personnelles isolées</span>
                      </p>
                      <span className="text-[11px] text-slate-500">
                        Seul le compteur agrégé est affiché
                      </span>
                    </div>
                  </div>

                  {/* Directory Filters & Table */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                    <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Rechercher par nom, e-mail ou pays..."
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:border-[#087A50] focus:bg-white"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={userPlanFilter}
                          onChange={(e) =>
                            setUserPlanFilter(e.target.value as 'all' | 'paid' | 'free')
                          }
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
                        >
                          <option value="all">Tous les plans</option>
                          <option value="paid">Payants uniquement</option>
                          <option value="free">Essai / Gratuits</option>
                        </select>
                        <select
                          value={userCountryFilter}
                          onChange={(e) => setUserCountryFilter(e.target.value)}
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
                        >
                          <option value="all">Tous les pays</option>
                          {availableCountries.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {filteredUsers.length === 0 ? (
                      <div className="p-8">
                        <EmptyBlock message="Aucun compte utilisateur ne correspond aux critères sélectionnés." />
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              <th className="py-3 px-4">Compte</th>
                              <th className="py-3 px-4">Pays</th>
                              <th className="py-3 px-4">Formule</th>
                              <th className="py-3 px-4">Onboarding</th>
                              <th className="py-3 px-4 text-right">Dépenses (nb)</th>
                              <th className="py-3 px-4 text-right">Inscription</th>
                              <th className="py-3 px-4 text-right">Dernière activité</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredUsers.map((u) => {
                              const paid = isUserPaid(u);
                              return (
                                <tr key={u.uid} className="hover:bg-emerald-50/30 transition">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-[#063D2E] font-bold flex items-center justify-center shrink-0">
                                        {u.name.slice(0, 2).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                          <span className="truncate max-w-[160px]">{u.name}</span>
                                          {u.role === 'ADMIN' && (
                                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#063D2E] text-[#B7F5D5]">
                                              ADMIN
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">
                                          {u.email}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                                    {COUNTRY_FLAGS[u.country] || '🌍'} {u.country}
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                        paid
                                          ? 'bg-emerald-50 text-[#087A50] border border-emerald-200'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {paid
                                        ? u.subscriptionType === 'quarterly'
                                          ? 'Premium 3 mois'
                                          : 'Premium 1 mois'
                                        : 'Essai gratuit'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    {u.onboardingCompleted ? (
                                      <span className="text-[#087A50] font-semibold">Terminé</span>
                                    ) : (
                                      <span className="text-amber-600 font-semibold">En cours</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                                    {u.expensesCount}
                                  </td>
                                  <td className="py-3 px-4 text-right text-slate-500 tabular-nums whitespace-nowrap">
                                    {formatDateShort(u.createdAtMs)}
                                  </td>
                                  <td className="py-3 px-4 text-right text-slate-500 tabular-nums whitespace-nowrap">
                                    {formatDateShort(u.lastActiveAtMs)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===================================================== */}
              {/* 3. CROISSANCE ET INSCRIPTIONS                         */}
              {/* ===================================================== */}
              {activeTab === 'growth' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-extrabold text-slate-900">
                          Courbe d'évolution des inscriptions
                        </h2>
                        <p className="text-xs text-slate-500">
                          Survolez un point pour afficher la date exacte et le volume d'inscriptions.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-xl bg-slate-100 p-1">
                          <button
                            type="button"
                            onClick={() => setGrowthGranularity('day')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              growthGranularity === 'day'
                                ? 'bg-white text-[#063D2E]'
                                : 'text-slate-600'
                            }`}
                          >
                            Par jour
                          </button>
                          <button
                            type="button"
                            onClick={() => setGrowthGranularity('week')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              growthGranularity === 'week'
                                ? 'bg-white text-[#063D2E]'
                                : 'text-slate-600'
                            }`}
                          >
                            Par semaine
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setGrowthCumulative((v) => !v)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            growthCumulative
                              ? 'bg-[#087A50] text-white border-[#087A50]'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {growthCumulative ? 'Vue cumulative active' : 'Afficher cumulatif'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                      <div className="p-3.5 rounded-xl bg-[#f5faf7] border border-emerald-100">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Inscriptions sur la période
                        </span>
                        <p className="text-xl font-black text-[#063D2E] tabular-nums mt-0.5">
                          {kpis.newUsers}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-[#f5faf7] border border-emerald-100">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Variation vs période précédente
                        </span>
                        <p className="text-xl font-black text-slate-900 tabular-nums mt-0.5">
                          {kpis.newUsersDelta.pctLabel}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-[#f5faf7] border border-emerald-100">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Pic sur la période
                        </span>
                        <p className="text-xl font-black text-slate-900 tabular-nums mt-0.5">
                          {Math.max(0, ...growthSeries.map((g) => g.count))} / {growthGranularity === 'day' ? 'jour' : 'sem.'}
                        </p>
                      </div>
                    </div>

                    {growthSeries.length === 0 ? (
                      <EmptyBlock message="Aucune donnée disponible pour la période sélectionnée." />
                    ) : (
                      <GrowthSvgChart
                        series={growthSeries}
                        chartPoints={chartPoints}
                        linePath={linePath}
                        areaPath={areaPath}
                        svgW={svgW}
                        svgH={svgH}
                        padX={padX}
                        padY={padY}
                        plotH={plotH}
                        maxVal={maxChartVal}
                        hoveredIndex={hoveredGrowthIndex}
                        onHover={setHoveredGrowthIndex}
                        cumulative={growthCumulative}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* ===================================================== */}
              {/* 4. RÉPARTITION GÉOGRAPHIQUE                           */}
              {/* ===================================================== */}
              {activeTab === 'geography' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Donut Chart */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
                      <div>
                        <h2 className="text-sm font-extrabold text-slate-900">
                          Part par pays
                        </h2>
                        <p className="text-xs text-slate-500">
                          Source : pays sélectionné lors de l'inscription / onboarding.
                        </p>
                      </div>
                      {geographyStats.length === 0 ? (
                        <EmptyBlock message="Aucun pays enregistré." />
                      ) : (
                        <div className="flex flex-col items-center space-y-4">
                          <CountryDonutChart items={geographyStats} total={users.length} />
                          <div className="w-full space-y-2">
                            {geographyStats.slice(0, 6).map((item) => (
                              <div
                                key={item.country}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="flex items-center gap-2 text-slate-700 font-medium truncate">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: item.color }}
                                  />
                                  <span className="truncate">
                                    {COUNTRY_FLAGS[item.country] || '🌍'} {item.country}
                                  </span>
                                </span>
                                <span className="font-bold text-slate-900 tabular-nums">
                                  {item.percentage}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Full Country Table */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                      <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
                        <div>
                          <h2 className="text-sm font-extrabold text-slate-900">
                            Classement détaillé par pays
                          </h2>
                          <p className="text-xs text-slate-500">
                            {geographyStats.length} pays représentés au total
                          </p>
                        </div>
                      </div>
                      {geographyStats.length === 0 ? (
                        <div className="p-8">
                          <EmptyBlock message="Aucune répartition géographique à afficher." />
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                <th className="py-3 px-4">Pays</th>
                                <th className="py-3 px-4 text-right">Utilisateurs</th>
                                <th className="py-3 px-4 text-right">Part</th>
                                <th className="py-3 px-4 text-right">Nouveaux (période)</th>
                                <th className="py-3 px-4 text-right">Payants / Gratuits</th>
                                <th className="py-3 px-4 text-right">Revenus ({selectedCurrency})</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {geographyStats.map((row) => (
                                <tr key={row.country} className="hover:bg-emerald-50/30 transition">
                                  <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                                    {COUNTRY_FLAGS[row.country] || '🌍'} {row.country}
                                  </td>
                                  <td className="py-3 px-4 text-right font-bold tabular-nums">
                                    {row.total}
                                  </td>
                                  <td className="py-3 px-4 text-right text-slate-600 tabular-nums">
                                    {row.percentage}%
                                  </td>
                                  <td className="py-3 px-4 text-right text-[#087A50] font-semibold tabular-nums">
                                    +{row.newInPeriod}
                                  </td>
                                  <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                                    <span className="font-bold text-[#087A50]">{row.paid}</span>
                                    <span className="text-slate-400"> / </span>
                                    <span className="text-slate-600">{row.free}</span>
                                  </td>
                                  <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                    {formatCurrency(
                                      convertAmount(row.revenueXof, 'XOF', selectedCurrency),
                                      selectedCurrency
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================== */}
              {/* 5. ABONNEMENTS                                        */}
              {/* ===================================================== */}
              {activeTab === 'subscriptions' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <MiniMetric label="Mensuels actifs" value={subscriptionStats.activeMonthly} highlight />
                    <MiniMetric label="Trimestriels actifs" value={subscriptionStats.activeQuarterly} highlight />
                    <MiniMetric label="Essai gratuit" value={subscriptionStats.trialUsers} />
                    <MiniMetric label="Expirés" value={subscriptionStats.expiredUsers} />
                    <MiniMetric label="Renouvelés" value={subscriptionStats.renewedUsers} />
                    <MiniMetric label="Annulés" value={subscriptionStats.cancelledUsers} />
                  </div>

                  {/* Payment status split */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500">Paiements confirmés</span>
                        <p className="text-2xl font-black text-[#087A50] tabular-nums mt-1">
                          {subscriptionStats.confirmedCount}
                        </p>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-[#13B981]" />
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500">En attente</span>
                        <p className="text-2xl font-black text-amber-600 tabular-nums mt-1">
                          {subscriptionStats.pendingCount}
                        </p>
                      </div>
                      <BarChart3 className="w-6 h-6 text-amber-500" />
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500">Échoués</span>
                        <p className="text-2xl font-black text-red-600 tabular-nums mt-1">
                          {subscriptionStats.failedCount}
                        </p>
                      </div>
                      <X className="w-6 h-6 text-red-500" />
                    </div>
                  </div>

                  {/* Subscriptions Ledger */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                    <div className="p-5 border-b border-slate-200/80">
                      <h2 className="text-sm font-extrabold text-slate-900">
                        Historique des abonnements & paiements
                      </h2>
                      <p className="text-xs text-slate-500">
                        Transactions d'abonnement enregistrées dans Firebase.
                      </p>
                    </div>
                    {subscriptions.length === 0 ? (
                      <div className="p-8">
                        <EmptyBlock message="Aucun paiement ou abonnement enregistré pour le moment." />
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              <th className="py-3 px-4">Formule</th>
                              <th className="py-3 px-4">Pays</th>
                              <th className="py-3 px-4">Statut paiement</th>
                              <th className="py-3 px-4 text-right">Montant d'origine</th>
                              <th className="py-3 px-4 text-right">Équivalent ({selectedCurrency})</th>
                              <th className="py-3 px-4 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {[...subscriptions]
                              .sort((a, b) => b.createdAtMs - a.createdAtMs)
                              .map((sub) => (
                                <tr key={sub.id} className="hover:bg-emerald-50/30 transition">
                                  <td className="py-3 px-4 font-bold text-slate-900">
                                    {sub.planType === 'quarterly'
                                      ? 'Premium 3 mois'
                                      : sub.planType === 'monthly'
                                      ? 'Premium 1 mois'
                                      : 'Essai gratuit'}
                                  </td>
                                  <td className="py-3 px-4 text-slate-700">
                                    {COUNTRY_FLAGS[sub.country] || '🌍'} {sub.country}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                        sub.paymentStatus === 'confirmed'
                                          ? 'bg-emerald-50 text-[#087A50]'
                                          : sub.paymentStatus === 'pending'
                                          ? 'bg-amber-50 text-amber-700'
                                          : 'bg-red-50 text-red-700'
                                      }`}
                                    >
                                      {sub.paymentStatus === 'confirmed'
                                        ? 'Confirmé'
                                        : sub.paymentStatus === 'pending'
                                        ? 'En attente'
                                        : 'Échoué'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right font-semibold tabular-nums">
                                    {formatCurrency(sub.amount, sub.currency)}
                                  </td>
                                  <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                                    {formatCurrency(
                                      convertAmount(sub.amountXof, 'XOF', selectedCurrency),
                                      selectedCurrency
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right text-slate-500 tabular-nums">
                                    {formatDateShort(sub.createdAtMs)}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===================================================== */}
              {/* 6. REVENUS                                            */}
              {/* ===================================================== */}
              {activeTab === 'revenues' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#063D2E] text-white rounded-2xl p-5 space-y-1">
                      <span className="text-xs font-semibold text-emerald-200">
                        Revenus confirmés (période)
                      </span>
                      <p className="text-2xl font-black tabular-nums">
                        {formatCurrency(kpis.revenueSelected, selectedCurrency)}
                      </p>
                      <span className="text-[11px] text-[#B7F5D5]">
                        {kpis.revenueDelta.pctLabel} vs période précédente
                      </span>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-1">
                      <span className="text-xs font-semibold text-slate-500">
                        Revenus totaux cumulés
                      </span>
                      <p className="text-2xl font-black text-slate-900 tabular-nums">
                        {formatCurrency(
                          convertAmount(subscriptionStats.totalRevenueXof, 'XOF', selectedCurrency),
                          selectedCurrency
                        )}
                      </p>
                      <span className="text-[11px] text-slate-500">
                        {subscriptionStats.confirmedCount} paiements confirmés
                      </span>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-1">
                      <span className="text-xs font-semibold text-slate-500">
                        Revenu moyen / payant (ARPPU)
                      </span>
                      <p className="text-2xl font-black text-slate-900 tabular-nums">
                        {formatCurrency(
                          convertAmount(
                            kpis.paidUsers > 0
                              ? subscriptionStats.totalRevenueXof / kpis.paidUsers
                              : 0,
                            'XOF',
                            selectedCurrency
                          ),
                          selectedCurrency
                        )}
                      </p>
                      <span className="text-[11px] text-slate-500">Sur comptes payants actifs</span>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-1">
                      <span className="text-xs font-semibold text-slate-500">
                        En attente de confirmation
                      </span>
                      <p className="text-2xl font-black text-amber-600 tabular-nums">
                        {formatCurrency(
                          convertAmount(subscriptionStats.pendingRevenueXof, 'XOF', selectedCurrency),
                          selectedCurrency
                        )}
                      </p>
                      <span className="text-[11px] text-slate-500">
                        {subscriptionStats.pendingCount} transactions en attente
                      </span>
                    </div>
                  </div>

                  {/* Plan Revenue Split */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Répartition du chiffre d'affaires par formule ({selectedCurrency})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Option 1 mois (500 FCFA)</span>
                          <span className="tabular-nums text-[#087A50]">
                            {formatCurrency(
                              convertAmount(
                                subscriptionStats.monthlyRevenueXof,
                                'XOF',
                                selectedCurrency
                              ),
                              selectedCurrency
                            )}
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-[#087A50] rounded-full"
                            style={{
                              width: `${
                                subscriptionStats.totalRevenueXof > 0
                                  ? Math.round(
                                      (subscriptionStats.monthlyRevenueXof /
                                        subscriptionStats.totalRevenueXof) *
                                        100
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Option 3 mois (1 200 FCFA)</span>
                          <span className="tabular-nums text-[#063D2E]">
                            {formatCurrency(
                              convertAmount(
                                subscriptionStats.quarterlyRevenueXof,
                                'XOF',
                                selectedCurrency
                              ),
                              selectedCurrency
                            )}
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-[#13B981] rounded-full"
                            style={{
                              width: `${
                                subscriptionStats.totalRevenueXof > 0
                                  ? Math.round(
                                      (subscriptionStats.quarterlyRevenueXof /
                                        subscriptionStats.totalRevenueXof) *
                                        100
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================== */}
              {/* 7. ACTIVITÉ GLOBALE (STRICTEMENT ANONYMISÉE)          */}
              {/* ===================================================== */}
              {activeTab === 'activity' && (
                <div className="space-y-6">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-[#063D2E]">
                    <Lock className="w-4 h-4 text-[#087A50] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Protection stricte de la vie privée</p>
                      <p className="text-emerald-900/80 mt-0.5">
                        Les indicateurs ci-dessous sont exclusivement agrégés et anonymisés. Aucun administrateur ne peut consulter le détail individuel des dépenses d’un utilisateur.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">
                          Dépenses enregistrées (global)
                        </span>
                        <FileText className="w-4 h-4 text-[#087A50]" />
                      </div>
                      <p className="text-2xl font-black text-slate-900 tabular-nums">
                        {globalActivity.totalExpensesLogged.toLocaleString('fr-FR')}
                      </p>
                      <span className="text-[11px] text-slate-500">Total cumulé sur la plateforme</span>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">
                          Exports PDF générés
                        </span>
                        <Download className="w-4 h-4 text-[#087A50]" />
                      </div>
                      <p className="text-2xl font-black text-slate-900 tabular-nums">
                        {globalActivity.totalPdfExports.toLocaleString('fr-FR')}
                      </p>
                      <span className="text-[11px] text-slate-500">Bilans mensuels exportés</span>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">
                          Utilisateurs ayant saisi ≥ 10 dépenses
                        </span>
                        <Activity className="w-4 h-4 text-[#087A50]" />
                      </div>
                      <p className="text-2xl font-black text-[#087A50] tabular-nums">
                        {globalActivity.usersWithExpenses.toLocaleString('fr-FR')} ({globalActivity.activationRate}%)
                      </p>
                      <span className="text-[11px] text-slate-500">Taux d'activation produit</span>
                    </div>
                  </div>

                  {/* Global Onboarding Frequencies & Objectives */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
                      <h2 className="text-sm font-extrabold text-slate-900">
                        Fréquence de suivi déclarée
                      </h2>
                      {globalActivity.frequencies.length === 0 ? (
                        <EmptyBlock message="Aucune fréquence enregistrée pour le moment." />
                      ) : (
                        <div className="space-y-3">
                          {globalActivity.frequencies.map(([label, count]) => {
                            const pct =
                              users.length > 0 ? Math.round((count / users.length) * 100) : 0;
                            return (
                              <div key={label} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-700">{label}</span>
                                  <span className="font-bold text-slate-900 tabular-nums">
                                    {count} ({pct}%)
                                  </span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className="h-full bg-[#087A50] rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
                      <h2 className="text-sm font-extrabold text-slate-900">
                        Objectifs principaux des utilisateurs
                      </h2>
                      {globalActivity.goals.length === 0 ? (
                        <EmptyBlock message="Aucun objectif enregistré pour le moment." />
                      ) : (
                        <div className="space-y-3">
                          {globalActivity.goals.map(([label, count]) => {
                            const pct =
                              users.length > 0 ? Math.round((count / users.length) * 100) : 0;
                            return (
                              <div key={label} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-700">{label}</span>
                                  <span className="font-bold text-slate-900 tabular-nums">
                                    {count} ({pct}%)
                                  </span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className="h-full bg-[#13B981] rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================================== */}
              {/* 8. PARTENAIRES & PARRAINAGE                           */}
              {/* ===================================================== */}
              {activeTab === 'partners' && (
                <AdminPartnersSection
                  currentAdminUid={currentAdminUid}
                  selectedCurrency={selectedCurrency}
                  partners={partners}
                  clicks={partnerClicks}
                  commissions={partnerCommissions}
                  auditLogs={partnerAuditLogs}
                  users={users}
                  subscriptions={subscriptions}
                  onRefresh={() => loadData(true)}
                />
              )}

              {/* ===================================================== */}
              {/* 9. PARAMÈTRES ADMINISTRATEUR                          */}
              {/* ===================================================== */}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  {/* Session security status */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-[#087A50] flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5 text-xs">
                        <p className="font-extrabold text-slate-900 text-sm">
                          Session Administrateur Vérifiée
                        </p>
                        <p className="text-slate-600">
                          Compte : <span className="font-semibold">{currentAdminEmail}</span> • UID :{' '}
                          <span className="font-mono text-[11px]">{currentAdminUid}</span>
                        </p>
                        <p className="text-[#087A50] font-semibold">
                          Vérification :{' '}
                          {roleResolution.source === 'custom_claim'
                            ? 'Firebase Custom Claim (ADMIN)'
                            : roleResolution.source === 'admin_registry'
                            ? 'Registre protégé /admins'
                            : 'Compte administrateur principal vérifié'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onLogout}
                      className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs transition inline-flex items-center gap-2 shrink-0 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Déconnexion sécurisée</span>
                    </button>
                  </div>

                  {/* Admin Analytics Config */}
                  <form
                    onSubmit={handleSaveSettings}
                    className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-4"
                  >
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Paramètres d'analyse du tableau de bord
                    </h2>

                    {settingsSavedBanner && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-[#063D2E] font-semibold">
                        {settingsSavedBanner}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">
                          Fenêtre « Utilisateurs actifs » (jours)
                        </label>
                        <select
                          value={thresholdInput}
                          onChange={(e) => setThresholdInput(Number(e.target.value))}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900"
                        >
                          <option value={7}>7 derniers jours</option>
                          <option value={14}>14 derniers jours</option>
                          <option value={30}>30 derniers jours (recommandé)</option>
                          <option value={60}>60 derniers jours</option>
                          <option value={90}>90 derniers jours</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">
                          Devise par défaut du reporting Admin
                        </label>
                        <select
                          value={defaultCurrencyInput}
                          onChange={(e) =>
                            setDefaultCurrencyInput(e.target.value as SupportedCurrency)
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900"
                        >
                          {Object.values(SUPPORTED_CURRENCIES).map((cur) => (
                            <option key={cur.code} value={cur.code}>
                              {cur.code} — {cur.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="px-5 py-2.5 rounded-xl bg-[#087A50] hover:bg-[#063D2E] text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
                      >
                        {savingSettings ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                      </button>
                    </div>
                  </form>

                  {/* Admin Allowlist Management */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-5">
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900">
                        Gestion des comptes administrateurs (/admins)
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Seuls les administrateurs vérifiés peuvent accorder ou révoquer l'accès console. Un utilisateur normal ne peut jamais modifier son propre rôle.
                      </p>
                    </div>

                    {adminActionError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                        {adminActionError}
                      </div>
                    )}
                    {adminActionSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-[#063D2E] font-semibold">
                        {adminActionSuccess}
                      </div>
                    )}

                    <form onSubmit={handleGrantAdmin} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input
                        type="text"
                        value={newAdminUid}
                        onChange={(e) => setNewAdminUid(e.target.value)}
                        placeholder="UID Firebase de l'utilisateur"
                        className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
                      />
                      <input
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="E-mail vérifié"
                        className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
                      />
                      <input
                        type="text"
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        placeholder="Nom complet"
                        className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 rounded-xl bg-[#063D2E] hover:bg-[#087A50] text-white text-xs font-bold transition cursor-pointer"
                      >
                        Ajouter un admin
                      </button>
                    </form>

                    {admins.length === 0 ? (
                      <EmptyBlock message="Aucun administrateur additionnel enregistré dans /admins." />
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                        {admins.map((adm) => (
                          <div
                            key={adm.uid}
                            className="p-3.5 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">
                                {adm.displayName}{' '}
                                {adm.uid === currentAdminUid && (
                                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-[#063D2E]">
                                    Session actuelle
                                  </span>
                                )}
                              </p>
                              <p className="text-slate-500 truncate">
                                {adm.email} • <span className="font-mono text-[11px]">{adm.uid}</span>
                              </p>
                            </div>
                            {adm.uid !== currentAdminUid && (
                              <button
                                type="button"
                                onClick={() => handleRevokeAdmin(adm.uid)}
                                className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-bold text-[11px] shrink-0 cursor-pointer"
                              >
                                Révoquer
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

// =========================================================================
// COMPOSANTS INTERNES DU DASHBOARD ADMIN
// =========================================================================

const KpiCard: React.FC<{
  title: string;
  value: string;
  delta: { pctLabel: string; direction: 'up' | 'down' | 'neutral' };
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}> = ({ title, value, delta, subtitle, icon: Icon, accent }) => {
  return (
    <div
      className={`rounded-2xl p-5 border transition ${
        accent
          ? 'bg-[#063D2E] text-white border-[#063D2E]'
          : 'bg-white text-slate-900 border-slate-200/80'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`text-xs font-semibold leading-snug ${
            accent ? 'text-emerald-100' : 'text-slate-500'
          }`}
        >
          {title}
        </span>
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            accent
              ? 'bg-[#087A50] text-[#B7F5D5]'
              : 'bg-emerald-50 text-[#087A50]'
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <p className="text-2xl font-black tracking-tight tabular-nums mt-2.5">{value}</p>

      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-current/10">
        <span
          className={`text-[11px] truncate ${
            accent ? 'text-emerald-200/80' : 'text-slate-500'
          }`}
        >
          {subtitle}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums shrink-0 ${
            delta.direction === 'up'
              ? accent
                ? 'text-[#B7F5D5]'
                : 'text-[#087A50]'
              : delta.direction === 'down'
              ? accent
                ? 'text-red-300'
                : 'text-red-600'
              : accent
              ? 'text-emerald-200/70'
              : 'text-slate-400'
          }`}
        >
          {delta.direction === 'up' && <ArrowUpRight className="w-3 h-3" />}
          {delta.direction === 'down' && <ArrowDownRight className="w-3 h-3" />}
          {delta.pctLabel}
        </span>
      </div>
    </div>
  );
};

const MiniMetric: React.FC<{ label: string; value: number; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => (
  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-1">
    <span className="text-[11px] font-semibold text-slate-500 block">{label}</span>
    <p
      className={`text-xl font-black tabular-nums ${
        highlight ? 'text-[#087A50]' : 'text-slate-900'
      }`}
    >
      {value.toLocaleString('fr-FR')}
    </p>
  </div>
);

const EmptyBlock: React.FC<{ message: string }> = ({ message }) => (
  <div className="py-10 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-xs text-slate-500 font-medium">
    {message}
  </div>
);

const GrowthSvgChart: React.FC<{
  series: { label: string; fullDate: string; count: number; cumulative: number }[];
  chartPoints: { x: number; y: number; val: number; label: string; fullDate: string; count: number; cumulative: number }[];
  linePath: string;
  areaPath: string;
  svgW: number;
  svgH: number;
  padX: number;
  padY: number;
  plotH: number;
  maxVal: number;
  hoveredIndex: number | null;
  onHover: (idx: number | null) => void;
  cumulative: boolean;
}> = ({
  series,
  chartPoints,
  linePath,
  areaPath,
  svgW,
  svgH,
  padX,
  padY,
  plotH,
  maxVal,
  hoveredIndex,
  onHover,
  cumulative,
}) => {
  const hovered = hoveredIndex !== null ? chartPoints[hoveredIndex] : null;
  return (
    <div className="relative select-none">
      {/* Hover Tooltip Bar */}
      <div className="h-7 flex items-center justify-between text-xs mb-1 px-1">
        {hovered ? (
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#063D2E] text-white font-semibold tabular-nums">
            <span>{hovered.fullDate} :</span>
            <span className="text-[#B7F5D5] font-bold">
              {cumulative ? `${hovered.cumulative} total` : `${hovered.count} inscription(s)`}
            </span>
          </div>
        ) : (
          <span className="text-slate-400">
            Passez le curseur sur le graphique pour inspecter chaque date
          </span>
        )}
        <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
          Max : {maxVal}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full h-56 overflow-visible"
        onMouseLeave={() => onHover(null)}
      >
        <defs>
          <linearGradient id="talambongoAdminArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#13B981" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#13B981" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padY + plotH - t * plotH;
          return (
            <line
              key={t}
              x1={padX}
              x2={svgW - padX}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          );
        })}

        {/* Area & Line */}
        {areaPath && <path d={areaPath} fill="url(#talambongoAdminArea)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#087A50"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Active crosshair */}
        {hovered && (
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={padY}
            y2={padY + plotH}
            stroke="#063D2E"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* Interactive nodes */}
        {chartPoints.map((pt, idx) => (
          <g key={pt.label + idx}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={hoveredIndex === idx ? 5.5 : 3}
              fill={hoveredIndex === idx ? '#063D2E' : '#13B981'}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <rect
              x={pt.x - Math.max(8, (svgW - padX * 2) / Math.max(1, series.length) / 2)}
              y={0}
              width={Math.max(16, (svgW - padX * 2) / Math.max(1, series.length))}
              height={svgH}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => onHover(idx)}
            />
          </g>
        ))}

        {/* X Axis labels (sampled cleanly) */}
        {chartPoints.map((pt, idx) => {
          const step = Math.max(1, Math.ceil(chartPoints.length / 7));
          if (idx % step !== 0 && idx !== chartPoints.length - 1) return null;
          return (
            <text
              key={`lbl-${idx}`}
              x={pt.x}
              y={svgH - 2}
              textAnchor="middle"
              fontSize="10"
              fill="#64748b"
              fontWeight="600"
            >
              {pt.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

const CountryDonutChart: React.FC<{
  items: { country: string; total: number; color: string }[];
  total: number;
}> = ({ items, total }) => {
  const safeTotal = Math.max(1, total);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      <svg viewBox="0 0 140 140" className="w-40 h-40 -rotate-90">
        {items.map((item) => {
          const pct = item.total / safeTotal;
          const dash = pct * circumference;
          const dashOffset = -offset;
          offset += dash;
          return (
            <circle
              key={item.country}
              cx="70"
              cy="70"
              r={radius}
              fill="transparent"
              stroke={item.color}
              strokeWidth="18"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-xl font-black text-slate-900 tabular-nums">{total}</span>
        <span className="text-[10px] font-semibold text-slate-500">Comptes</span>
      </div>
    </div>
  );
};
