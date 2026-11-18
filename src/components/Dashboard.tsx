import React, { useState, useMemo, useEffect } from 'react';
import {
  Home,
  Calendar as CalendarIcon,
  PieChart as BilanIcon,
  User as UserIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Clock,
  Download,
  Settings,
  LogOut,
  CreditCard,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Share2,
  Trash2,
  Search,
  Award,
  ArrowLeft,
  Bell,
  Sun,
  Moon,
  Check,
  Pencil,
  UserCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Expense, ExpenseCategory, ExpenseMoment, SupportedCurrency, UserProfile } from '../types';
import { CATEGORIES } from '../data/initialData';
import { SUPPORTED_CURRENCIES, formatCurrency, convertAmount } from '../utils/currency';
import { getExpiringSoonExpenses, getExpenseExpirationDate } from '../utils/historyRetention';
import { AddExpenseModal } from './AddExpenseModal';
import { PdfExportModal } from './PdfExportModal';
import { PWAInstallButton } from './PWAInstallButton';

interface DashboardProps {
  user: UserProfile;
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onLogout: () => void;
  onReportViewed?: () => void;
  onPdfExported?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  expenses,
  onAddExpense,
  onDeleteExpense,
  onUpdateUser,
  onLogout,
  onReportViewed,
  onPdfExported,
}) => {
  // Mobile Bottom Navigation Tab ('home' | 'calendar' | 'bilan' | 'profile')
  const [activeTab, setActiveTab] = useState<'home' | 'calendar' | 'bilan' | 'profile'>('home');

  // Devise active de l'utilisateur (globale dans toute la plateforme)
  const activeCurrency: SupportedCurrency = user.currency || 'XOF';

  // Montants d'abonnement calculés dynamiquement depuis le prix de référence inaltérable de 1 000 XOF
  const subMonthlyPrice = convertAmount(1000, 'XOF', activeCurrency);
  const subQuarterlyPrice = convertAmount(2700, 'XOF', activeCurrency);
  const subSavingsPrice = convertAmount(300, 'XOF', activeCurrency);
  const subPerMonthQuarterly = convertAmount(900, 'XOF', activeCurrency);

  // Détection automatique de la date actuelle de l'appareil
  const deviceDate = useMemo(() => new Date(), []);
  const actualYear = deviceDate.getFullYear();
  const actualMonth = deviceDate.getMonth(); // 0 = Janvier ... 11 = Décembre
  const actualDay = deviceDate.getDate();

  // Chaîne "YYYY-MM" du mois actuel de l'appareil
  const actualCurrentMonthStr = `${actualYear}-${String(actualMonth + 1).padStart(2, '0')}`;

  // Date du premier jour du mois actuel de l'appareil
  const actualCurrentMonthDate = useMemo(() => {
    return new Date(actualYear, actualMonth, 1);
  }, [actualYear, actualMonth]);

  // Nom formaté du mois actuel (ex: "Septembre 2026", "Octobre 2026", "Janvier 2027")
  const actualMonthNameFormatted = useMemo(() => {
    const name = actualCurrentMonthDate.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [actualCurrentMonthDate]);

  // Mois affiché dans le Calendrier (initialisé automatiquement sur le mois actuel de l'appareil)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Jour sélectionné dans le calendrier (initialisé automatiquement sur le jour actuel de l'appareil)
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    return new Date().getDate();
  });

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [pdfTarget, setPdfTarget] = useState<'current_month' | 'expiring'>('current_month');

  // Page Paramètres dédiée accessible depuis Profil
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Gestion et édition du nom complet de l'utilisateur dans le profil
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user.name || '');

  // Synchroniser le champ avec le nom enregistré
  useEffect(() => {
    setEditedName(user.name || '');
  }, [user.name]);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editedName.trim();
    if (trimmed) {
      onUpdateUser({ name: trimmed });
      setIsEditingName(false);
    }
  };

  // Préférence Notifications (activé par défaut, persisté)
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('talambongo_notifications_enabled');
    return saved !== 'false';
  });

  // Préférence Apparence Thème (clair par défaut, persisté)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('talambongo_theme') as 'light' | 'dark') || 'light';
  });

  // Application immédiate du thème sur le document HTML
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('talambongo_theme', theme);
  }, [theme]);

  // Bascule des notifications avec persistance
  const handleToggleNotifications = () => {
    const nextVal = !notificationsEnabled;
    setNotificationsEnabled(nextVal);
    localStorage.setItem('talambongo_notifications_enabled', String(nextVal));
  };

  // Navigation entre les onglets
  const handleTabChange = (tab: 'home' | 'calendar' | 'bilan' | 'profile') => {
    setActiveTab(tab);
    if (tab === 'calendar') {
      // Lorsque l'utilisateur ouvre le Calendrier, afficher automatiquement le mois actuel
      const d = new Date();
      setCurrentMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
      setSelectedDay(d.getDate());
    }
    if (tab === 'bilan') {
      onReportViewed?.();
    }
    if (tab !== 'profile') {
      setIsSettingsOpen(false);
    }
  };

  // Dépenses approchant de leur expiration (conservées jusqu'au 3 du mois suivant)
  const expiringExpenses = useMemo(() => {
    return getExpiringSoonExpenses(expenses);
  }, [expenses]);

  const expiringPeriodName = useMemo(() => {
    if (expiringExpenses.length === 0) return '';
    const earliestDate = expiringExpenses.reduce(
      (min, e) => (e.date < min ? e.date : min),
      expiringExpenses[0].date
    );
    const [y, m] = earliestDate.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    const name = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [expiringExpenses]);

  const expiringDeadlineStr = useMemo(() => {
    if (expiringExpenses.length === 0) return '';
    const expDate = getExpenseExpirationDate(expiringExpenses[0].date);
    const monthName = expDate.toLocaleDateString('fr-FR', { month: 'long' });
    return `le 3 ${monthName}`;
  }, [expiringExpenses]);

  const expiringPeriodExpenses = useMemo(() => {
    if (expiringExpenses.length === 0) return [];
    const earliestMonthStr = expiringExpenses[0].date.slice(0, 7);
    const monthAll = expenses.filter((e) => e.date.startsWith(earliestMonthStr));
    return monthAll.length > 0 ? monthAll : expiringExpenses;
  }, [expiringExpenses, expenses]);

  const handleOpenNormalPdfExport = () => {
    setPdfTarget('current_month');
    setIsPdfModalOpen(true);
    onPdfExported?.();
  };

  const handleOpenExpiringPdfExport = () => {
    setPdfTarget('expiring');
    setIsPdfModalOpen(true);
    onPdfExported?.();
  };

  // ==========================================
  // 1. STATISTIQUES POUR L'ACCUEIL (TOUJOURS LE MOIS ACTUEL RÉEL DE L'APPAREIL)
  // ==========================================
  const actualMonthExpenses = useMemo(() => {
    return expenses.filter((e) => e.date.startsWith(actualCurrentMonthStr));
  }, [expenses, actualCurrentMonthStr]);

  const actualMonthTotal = useMemo(() => {
    return actualMonthExpenses.reduce(
      (acc, curr) => acc + convertAmount(curr.amount, curr.currency, activeCurrency),
      0
    );
  }, [actualMonthExpenses, activeCurrency]);

  const daysInActualMonth = useMemo(() => {
    return new Date(actualYear, actualMonth + 1, 0).getDate();
  }, [actualYear, actualMonth]);

  const homeStats = useMemo(() => {
    const count = actualMonthExpenses.length;
    const avgDaily =
      daysInActualMonth > 0
        ? activeCurrency === 'EUR'
          ? Math.round((actualMonthTotal / daysInActualMonth) * 100) / 100
          : Math.round(actualMonthTotal / daysInActualMonth)
        : 0;

    let maxExp: Expense | null = null;
    let maxConvertedAmount = 0;
    const catTotals: Record<ExpenseCategory, number> = {
      Alimentation: 0,
      Transport: 0,
      Factures: 0,
      'Téléphone / Internet': 0,
      Achats: 0,
      Loisirs: 0,
      Études: 0,
      Autres: 0,
    };

    for (const e of actualMonthExpenses) {
      const converted = convertAmount(e.amount, e.currency, activeCurrency);
      if (!maxExp || converted > maxConvertedAmount) {
        maxExp = e;
        maxConvertedAmount = converted;
      }
      catTotals[e.category] = (catTotals[e.category] || 0) + converted;
    }

    let mainCat: ExpenseCategory = 'Alimentation';
    let maxCatVal = 0;
    (Object.entries(catTotals) as [ExpenseCategory, number][]).forEach(([cat, val]) => {
      if (val > maxCatVal) {
        maxCatVal = val;
        mainCat = cat;
      }
    });

    const categoryBreakdown = (Object.entries(catTotals) as [ExpenseCategory, number][])
      .filter(([_, val]) => val > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => ({
        category: cat,
        amount: val,
        percentage: actualMonthTotal > 0 ? Math.round((val / actualMonthTotal) * 100) : 0,
      }));

    return {
      count,
      avgDaily,
      maxExpenseTitle: maxExp ? maxExp.title : '',
      maxExpenseAmount: maxConvertedAmount,
      mainCat,
      categoryBreakdown,
    };
  }, [actualMonthExpenses, actualMonthTotal, daysInActualMonth, activeCurrency]);

  // ==========================================
  // 2. DONNÉES DU MOIS POUR LE CALENDRIER & BILAN (NAVIGABLE)
  // ==========================================
  const currentMonthStr = `${currentMonthDate.getFullYear()}-${String(
    currentMonthDate.getMonth() + 1
  ).padStart(2, '0')}`;

  const monthExpenses = useMemo(() => {
    return expenses.filter((e) => e.date.startsWith(currentMonthStr));
  }, [expenses, currentMonthStr]);

  const currentMonthTotal = useMemo(() => {
    return monthExpenses.reduce(
      (acc, curr) => acc + convertAmount(curr.amount, curr.currency, activeCurrency),
      0
    );
  }, [monthExpenses, activeCurrency]);

  // Nombre de jours dans le mois actuellement affiché dans le calendrier
  const daysInMonth = new Date(
    currentMonthDate.getFullYear(),
    currentMonthDate.getMonth() + 1,
    0
  ).getDate();

  // Sécurité pour le jour sélectionné (ne jamais dépasser le nombre de jours du mois en cours)
  const safeSelectedDay = Math.min(selectedDay, daysInMonth);

  // Chaîne de la date sélectionnée (ex: "2026-09-15")
  const selectedDateStr = `${currentMonthStr}-${String(safeSelectedDay).padStart(2, '0')}`;

  // Dépenses de la journée sélectionnée
  const selectedDayExpenses = useMemo(() => {
    return monthExpenses.filter((e) => e.date === selectedDateStr);
  }, [monthExpenses, selectedDateStr]);

  const selectedDayTotal = useMemo(() => {
    return selectedDayExpenses.reduce(
      (acc, curr) => acc + convertAmount(curr.amount, curr.currency, activeCurrency),
      0
    );
  }, [selectedDayExpenses, activeCurrency]);

  // Groupement par moment (Matin, Après-midi, Soir)
  const groupedByMoment = useMemo(() => {
    const groups: Record<ExpenseMoment, Expense[]> = {
      Matin: [],
      'Après-midi': [],
      Soir: [],
    };
    selectedDayExpenses.forEach((e) => {
      if (groups[e.moment]) {
        groups[e.moment].push(e);
      }
    });
    return groups;
  }, [selectedDayExpenses]);

  // Nom formaté du mois affiché dans le calendrier (ex: "Septembre 2026")
  const monthNameFormatted = useMemo(() => {
    const name = currentMonthDate.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [currentMonthDate]);

  const nextMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  // Jour de la semaine du 1er jour du mois (lundi = 0)
  const firstDayOfWeek = (new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1).getDay() + 6) % 7;

  // Totaux par jour pour le calendrier
  const dayExpenseTotals = useMemo(() => {
    const map: Record<number, number> = {};
    monthExpenses.forEach((e) => {
      const d = parseInt(e.date.split('-')[2], 10);
      const converted = convertAmount(e.amount, e.currency, activeCurrency);
      map[d] = (map[d] || 0) + converted;
    });
    return map;
  }, [monthExpenses, activeCurrency]);

  // Dernières dépenses enregistrées (pour l'Accueil)
  const recentExpenses = useMemo(() => {
    return [...expenses]
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5);
  }, [expenses]);

  // Date sélectionnée formatée (ex: "mardi 15 septembre 2026")
  const selectedDayDateFormatted = useMemo(() => {
    const d = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), safeSelectedDay);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [currentMonthDate, safeSelectedDay]);

  // Indique si le mois affiché dans le calendrier est le mois actuel de l'appareil
  const isCurrentMonthCalendarActual =
    currentMonthDate.getFullYear() === actualYear &&
    currentMonthDate.getMonth() === actualMonth;

  // Calcul du bilan pour le mois affiché
  const bilanStats = useMemo(() => {
    const count = monthExpenses.length;
    const avgDaily =
      daysInMonth > 0
        ? activeCurrency === 'EUR'
          ? Math.round((currentMonthTotal / daysInMonth) * 100) / 100
          : Math.round(currentMonthTotal / daysInMonth)
        : 0;

    let maxExp: Expense | null = null;
    let maxConvertedAmount = 0;
    const catTotals: Record<ExpenseCategory, number> = {
      Alimentation: 0,
      Transport: 0,
      Factures: 0,
      'Téléphone / Internet': 0,
      Achats: 0,
      Loisirs: 0,
      Études: 0,
      Autres: 0,
    };

    for (const e of monthExpenses) {
      const converted = convertAmount(e.amount, e.currency, activeCurrency);
      if (!maxExp || converted > maxConvertedAmount) {
        maxExp = e;
        maxConvertedAmount = converted;
      }
      catTotals[e.category] = (catTotals[e.category] || 0) + converted;
    }

    let mainCat: ExpenseCategory = 'Alimentation';
    let maxCatVal = 0;
    (Object.entries(catTotals) as [ExpenseCategory, number][]).forEach(([cat, val]) => {
      if (val > maxCatVal) {
        maxCatVal = val;
        mainCat = cat;
      }
    });

    const categoryBreakdown = (Object.entries(catTotals) as [ExpenseCategory, number][])
      .filter(([_, val]) => val > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => ({
        category: cat,
        amount: val,
        percentage: currentMonthTotal > 0 ? Math.round((val / currentMonthTotal) * 100) : 0,
      }));

    return {
      count,
      avgDaily,
      maxExpenseTitle: maxExp ? maxExp.title : '',
      maxExpenseAmount: maxConvertedAmount,
      mainCat,
      categoryBreakdown,
    };
  }, [monthExpenses, currentMonthTotal, daysInMonth, activeCurrency]);

  return (
    <div id="talambongo-dashboard" className="min-h-screen bg-[#fafbfc] pb-24 md:pb-12 text-[#0f172a]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-700 tracking-wide uppercase">
              TalaMbongo
            </span>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                Bonjour 👋
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold hidden sm:inline-block">
                {user.status}
              </span>
            </div>
          </div>

          {/* Desktop Tab Switcher */}
          <div className="flex items-center gap-3">
            <nav className="hidden md:flex items-center gap-1 bg-gray-100/80 p-1 rounded-2xl">
              <button
                id="desktop-tab-home"
                onClick={() => handleTabChange('home')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'home' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Accueil
              </button>
              <button
                id="desktop-tab-calendar"
                onClick={() => handleTabChange('calendar')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'calendar' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Calendrier
              </button>
              <button
                id="desktop-tab-bilan"
                onClick={() => handleTabChange('bilan')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'bilan' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Bilan
              </button>
              <button
                id="desktop-tab-profile"
                onClick={() => handleTabChange('profile')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'profile' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Profil
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Avertissement avant expiration (respecte la préférence de notifications de l'utilisateur) */}
        {notificationsEnabled && expiringExpenses.length > 0 && (
          <div
            id="history-expiration-warning"
            className="mb-6 p-4 sm:p-5 rounded-2xl bg-amber-50/95 border border-amber-200/90 text-amber-950 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5 sm:mt-0">
                <Clock className="w-5 h-5 text-amber-700" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-950 leading-snug">
                  Certaines de tes dépenses vont bientôt disparaître de ton historique. Pense à exporter ton bilan avant leur expiration.
                </p>
                <p className="text-xs text-amber-800/80">
                  {expiringExpenses.length} dépense{expiringExpenses.length > 1 ? 's' : ''} approchant de la date limite du {expiringDeadlineStr || '3 du mois'} • Période : {expiringPeriodName}
                </p>
              </div>
            </div>

            <button
              id="export-bilan-warning-button"
              onClick={handleOpenExpiringPdfExport}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition cursor-pointer active:scale-95 shrink-0 self-stretch sm:self-auto"
            >
              <Download className="w-4 h-4" />
              <span>Exporter mon bilan</span>
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* TAB 1: ACCUEIL — DASHBOARD DE SYNTHÈSE DES DÉPENSES */}
          {activeTab === 'home' && (
            <motion.div
              key="tab-home"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Cadre principal : Dépenses du mois */}
              <div
                id="home-month-overview-card"
                className="relative overflow-hidden rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 shadow-xs"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">
                    Dépenses du mois
                  </span>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-100">
                    <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="capitalize">{actualMonthNameFormatted}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                    {formatCurrency(actualMonthTotal, activeCurrency)}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">
                    {actualMonthExpenses.length} dépense{actualMonthExpenses.length > 1 ? 's' : ''} enregistrée{actualMonthExpenses.length > 1 ? 's' : ''} • Période de {actualMonthNameFormatted}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-gray-400">
                    {actualMonthTotal > 0 ? 'Synthèse en direct de tes sorties d\'argent' : 'Aucune dépense enregistrée ce mois-ci'}
                  </span>
                  <button
                    onClick={() => setActiveTab('bilan')}
                    className="font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 cursor-pointer transition"
                  >
                    <span>Voir le bilan détaillé</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Cadres statistiques simples : Moyenne par jour, Plus grosse dépense, Catégorie principale */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Moyenne par jour */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-100 shadow-xs flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      Moyenne par jour
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <TrendingDown className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-black text-gray-900">
                      {formatCurrency(homeStats.avgDaily, activeCurrency)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Sur les {daysInActualMonth} jours du mois
                    </p>
                  </div>
                </div>

                {/* Plus grosse dépense */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-100 shadow-xs flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      Plus grosse dépense
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <Award className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-black text-gray-900 truncate">
                      {homeStats.maxExpenseAmount > 0
                        ? formatCurrency(homeStats.maxExpenseAmount, activeCurrency)
                        : formatCurrency(0, activeCurrency)}
                    </p>
                    <p className="text-[11px] text-gray-500 font-medium truncate mt-0.5" title={homeStats.maxExpenseTitle || 'Aucune'}>
                      {homeStats.maxExpenseTitle ? `« ${homeStats.maxExpenseTitle} »` : 'Aucune dépense'}
                    </p>
                  </div>
                </div>

                {/* Catégorie principale */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-100 shadow-xs flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      Catégorie principale
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <BilanIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-black text-gray-900 truncate">
                      {actualMonthExpenses.length > 0 ? homeStats.mainCat : 'Aucune'}
                    </p>
                    <p className="text-[11px] text-emerald-700 font-bold mt-0.5">
                      {homeStats.categoryBreakdown[0]
                        ? `${formatCurrency(homeStats.categoryBreakdown[0].amount, activeCurrency)} (${homeStats.categoryBreakdown[0].percentage}%)`
                        : `${formatCurrency(0, activeCurrency)} (0%)`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Aperçu visuel simple de la répartition des dépenses par catégorie */}
              <div className="rounded-3xl bg-white border border-gray-100 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900">
                      Répartition par catégorie
                    </h3>
                    <p className="text-xs text-gray-500">
                      Postes de dépenses prédominants sur {actualMonthNameFormatted}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('bilan')}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition cursor-pointer"
                  >
                    Voir tout
                  </button>
                </div>

                {homeStats.categoryBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {homeStats.categoryBreakdown.slice(0, 4).map((item) => (
                      <div key={item.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-800">{item.category}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 font-medium">{item.percentage}%</span>
                            <span className="font-bold text-gray-900">{formatCurrency(item.amount, activeCurrency)}</span>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">
                    Aucune dépense enregistrée pour ce mois.
                  </p>
                )}
              </div>

              {/* Section : Dernières dépenses */}
              <div className="rounded-3xl bg-white border border-gray-100 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900">
                      Dernières dépenses
                    </h3>
                    <p className="text-xs text-gray-500">
                      Aperçu de tes dépenses récentes
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('calendar')}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition cursor-pointer"
                  >
                    Ouvrir le calendrier
                  </button>
                </div>

                {recentExpenses.length > 0 ? (
                  <div className="space-y-2.5">
                    {recentExpenses.map((exp) => {
                      const convertedExpAmount = convertAmount(exp.amount, exp.currency, activeCurrency);
                      const isDifferentCurrency = exp.currency && exp.currency !== activeCurrency;
                      return (
                        <div
                          key={exp.id}
                          className="p-3 sm:p-3.5 rounded-2xl bg-[#fafbfc] border border-gray-100/90 flex items-center justify-between hover:border-emerald-200 transition-colors"
                        >
                          <div className="space-y-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                                {exp.title}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold shrink-0">
                                {exp.category}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                              <span>{exp.date}</span>
                              {exp.moment && (
                                <>
                                  <span>•</span>
                                  <span>{exp.moment}</span>
                                </>
                              )}
                              {exp.note && (
                                <>
                                  <span>•</span>
                                  <span className="italic truncate max-w-[150px]">{exp.note}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-sm sm:text-base font-black text-gray-900">
                              {formatCurrency(convertedExpAmount, activeCurrency)}
                            </span>
                            {isDifferentCurrency && (
                              <span className="text-[10px] text-gray-400 block font-normal">
                                (orig. {formatCurrency(exp.amount, exp.currency)})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center space-y-2">
                    <p className="text-xs sm:text-sm text-gray-500">
                      Tu n'as pas encore enregistré de dépenses.
                    </p>
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Enregistrer ma première dépense</span>
                    </button>
                  </div>
                )}

                {/* Bouton rapide d'ajout */}
                <div className="pt-2">
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Ajouter une dépense</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: CALENDRIER — ESPACE DE RECHERCHE ET CONSULTATION PAR DATE */}
          {activeTab === 'calendar' && (
            <motion.div
              key="tab-calendar"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* En-tête avec navigation de mois */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">Calendrier des dépenses</h2>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Consulte et recherche tes dépenses selon les dates du mois.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto bg-white p-1 rounded-2xl border border-gray-200/80 shadow-xs">
                  <button
                    onClick={prevMonth}
                    aria-label="Mois précédent"
                    className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-600 cursor-pointer transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-gray-800 capitalize px-2 min-w-[120px] text-center">
                    {monthNameFormatted}
                  </span>
                  <button
                    onClick={nextMonth}
                    aria-label="Mois suivant"
                    className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-600 cursor-pointer transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grand cadre du Calendrier (Grille mensuelle des jours) */}
              <div
                id="calendar-grid-card"
                className="bg-white rounded-3xl p-5 sm:p-7 border border-gray-100 shadow-xs space-y-4"
              >
                <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-gray-400">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                    <span key={d} className="py-1">{d}</span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`cal-empty-${i}`} className="aspect-square opacity-0" />
                  ))}

                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const isSelected = safeSelectedDay === day;
                    const isToday = isCurrentMonthCalendarActual && day === actualDay;
                    const amountForDay = dayExpenseTotals[day];
                    const hasExpense = amountForDay && amountForDay > 0;

                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={`aspect-square rounded-2xl p-1.5 sm:p-2 flex flex-col justify-between transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-600 ring-offset-2'
                            : isToday
                            ? 'bg-emerald-100 text-emerald-950 border-2 border-emerald-600 shadow-xs'
                            : hasExpense
                            ? 'bg-emerald-50 text-emerald-950 border border-emerald-100 hover:bg-emerald-100'
                            : 'bg-gray-50/70 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs sm:text-sm font-bold">{day}</span>
                          {isToday && !isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" title="Aujourd'hui" />
                          )}
                        </div>
                        {hasExpense && (
                          <span
                            className={`text-[9px] sm:text-[11px] font-black truncate w-full text-center ${
                              isSelected ? 'text-emerald-100' : isToday ? 'text-emerald-800' : 'text-emerald-700'
                            }`}
                          >
                            {amountForDay >= 1000
                              ? `${Math.round(amountForDay / 1000)}k`
                              : activeCurrency === 'EUR'
                              ? amountForDay.toFixed(0)
                              : Math.round(amountForDay)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grand cadre de consultation détaillée de la journée sélectionnée */}
              <div
                id="calendar-selected-day-details"
                className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-xs space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100">
                  <div>
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                      Journée sélectionnée
                    </span>
                    <h3 className="text-xl font-extrabold text-gray-900 mt-0.5 capitalize">
                      {selectedDayDateFormatted}
                    </h3>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-xs text-gray-400 block font-medium">Total de la journée</span>
                    <span className="text-2xl font-black text-gray-900">
                      {formatCurrency(selectedDayTotal, activeCurrency)}
                    </span>
                  </div>
                </div>

                {/* Dépenses du jour organisées par périodes Matin / Après-midi / Soir */}
                {selectedDayExpenses.length > 0 ? (
                  <div className="space-y-4">
                    {(['Matin', 'Après-midi', 'Soir'] as ExpenseMoment[]).map((moment) => {
                      const itemsInMoment = groupedByMoment[moment];
                      if (itemsInMoment.length === 0) return null;

                      return (
                        <div key={moment} className="space-y-2">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            {moment}
                          </span>

                          <div className="space-y-2">
                            {itemsInMoment.map((exp) => {
                              const convertedDayExpAmount = convertAmount(exp.amount, exp.currency, activeCurrency);
                              const isDiff = exp.currency && exp.currency !== activeCurrency;
                              return (
                                <div
                                  key={exp.id}
                                  className="p-3.5 rounded-2xl bg-[#fafbfc] border border-gray-100 flex items-center justify-between hover:border-emerald-200 transition-colors group"
                                >
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-gray-900">
                                        {exp.title}
                                      </span>
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
                                        {exp.category}
                                      </span>
                                    </div>
                                    {exp.note && (
                                      <p className="text-xs text-gray-400 italic font-normal">
                                        {exp.note}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <span className="text-sm font-black text-gray-900 block">
                                        {formatCurrency(convertedDayExpAmount, activeCurrency)}
                                      </span>
                                      {isDiff && (
                                        <span className="text-[10px] text-gray-400 block font-normal">
                                          (orig. {formatCurrency(exp.amount, exp.currency)})
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => onDeleteExpense(exp.id)}
                                      title="Supprimer la dépense"
                                      aria-label="Supprimer cette dépense"
                                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-rose-600 transition rounded-lg cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-500">
                      Aucune dépense enregistrée le {safeSelectedDay} {monthNameFormatted}.
                    </p>
                  </div>
                )}

                {/* Bouton d'ajout pour cette journée */}
                <div className="pt-2">
                  <button
                    id="calendar-add-expense-btn"
                    onClick={() => setIsAddModalOpen(true)}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Ajouter une dépense ce jour</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: BILAN */}
          {activeTab === 'bilan' && (
            <motion.div
              key="tab-bilan"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 capitalize">
                    Bilan de {monthNameFormatted}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Analyse complète et synthèse par poste de dépense.
                  </p>
                </div>

                {/* Exporter en PDF */}
                <button
                  id="bilan-export-pdf-btn"
                  onClick={handleOpenNormalPdfExport}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Exporter en PDF</span>
                </button>
              </div>

              {/* 5 Key Metrics Cards Required in Prompt:
                  1. Total dépensé
                  2. Nombre de dépenses
                  3. Moyenne quotidienne
                  4. Plus grosse dépense
                  5. Catégorie principale
              */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-gray-400 block">Total dépensé</span>
                  <p className="text-lg font-black text-gray-900">{formatCurrency(currentMonthTotal, activeCurrency)}</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-gray-400 block">Nb de dépenses</span>
                  <p className="text-lg font-black text-gray-900">{bilanStats.count} entrées</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-gray-400 block">Moyenne journalière</span>
                  <p className="text-lg font-black text-gray-900">{formatCurrency(bilanStats.avgDaily, activeCurrency)}</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-gray-400 block">Plus grosse dépense</span>
                  <p className="text-lg font-black text-gray-900 truncate" title={`${bilanStats.maxExpenseTitle} - ${formatCurrency(bilanStats.maxExpenseAmount, activeCurrency)}`}>
                    {bilanStats.maxExpenseAmount > 0
                      ? formatCurrency(bilanStats.maxExpenseAmount, activeCurrency)
                      : formatCurrency(0, activeCurrency)}
                  </p>
                  <span className="text-[10px] text-gray-400 block truncate">
                    {bilanStats.maxExpenseTitle || 'Aucune'}
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-emerald-800 block">Catégorie principale</span>
                  <p className="text-lg font-black text-emerald-950">{bilanStats.mainCat}</p>
                </div>
              </div>

              {/* Graphique simple par catégorie */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <h3 className="text-base font-bold text-gray-900">
                    Répartition par catégorie
                  </h3>
                  <span className="text-xs text-gray-400 font-medium">100% calculé</span>
                </div>

                {/* Interactive bar breakdown */}
                <div className="space-y-4">
                  {bilanStats.categoryBreakdown.map((item) => (
                    <div key={item.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs sm:text-sm font-semibold">
                        <span className="text-gray-800">{item.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 font-normal">{item.percentage}%</span>
                          <span className="font-bold text-gray-900">{formatCurrency(item.amount, activeCurrency)}</span>
                        </div>
                      </div>

                      {/* Bar */}
                      <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: PROFIL */}
          {activeTab === 'profile' && (
            <motion.div
              key={isSettingsOpen ? 'tab-settings' : 'tab-profile'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {isSettingsOpen ? (
                /* VUE DÉDIÉE : PARAMÈTRES */
                <div id="settings-view" className="space-y-6">
                  {/* Bouton retour vers le Profil */}
                  <div>
                    <button
                      id="settings-back-btn"
                      type="button"
                      onClick={() => setIsSettingsOpen(false)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 font-bold text-xs shadow-xs transition cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4 text-emerald-600" />
                      <span>Retour au Profil</span>
                    </button>
                  </div>

                  {/* En-tête Paramètres */}
                  <div>
                    <h2 className="text-2xl font-black text-gray-900">Paramètres</h2>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Gère tes préférences de devise, de notifications et d'apparence visuelle.
                    </p>
                  </div>

                  {/* Options : Devise, Notifications et Apparence */}
                  <div className="space-y-4">
                    {/* 1. 💱 Devise */}
                    <div id="settings-currency-section" className="rounded-3xl bg-white border border-gray-100 p-5 sm:p-6 shadow-xs space-y-4">
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          <span>💱</span>
                          <span>Devise</span>
                        </h3>
                        <p className="text-xs text-gray-500">
                          Choisis la devise principale de ton compte. Elle s'appliquera automatiquement à toute la plateforme TalaMbongo.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {(['XOF', 'XAF', 'CDF', 'EUR'] as SupportedCurrency[]).map((curCode) => {
                          const cur = SUPPORTED_CURRENCIES[curCode];
                          const isSelected = activeCurrency === curCode;
                          return (
                            <button
                              key={curCode}
                              id={`settings-currency-${curCode.toLowerCase()}-btn`}
                              type="button"
                              onClick={() => onUpdateUser({ currency: curCode })}
                              className={`p-4 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600 ring-offset-1'
                                  : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                                    isSelected ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {cur.symbol}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-bold text-gray-900">{cur.code}</p>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">
                                      {cur.symbol}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-500">{cur.label}</p>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. 🔔 Notifications */}
                    <div className="rounded-3xl bg-white border border-gray-100 p-5 sm:p-6 shadow-xs">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <span>🔔</span>
                            <span>Notifications</span>
                          </h3>
                          <p className="text-xs text-gray-500">
                            Alertes et notifications liées à la suppression de l'historique le 3 de chaque mois
                          </p>
                        </div>

                        {/* Interrupteur (Activé / Désactivé) */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs font-bold ${notificationsEnabled ? 'text-emerald-700' : 'text-gray-400'}`}>
                            {notificationsEnabled ? 'Activé' : 'Désactivé'}
                          </span>
                          <button
                            id="toggle-notifications-switch"
                            type="button"
                            role="switch"
                            aria-checked={notificationsEnabled}
                            onClick={handleToggleNotifications}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${
                              notificationsEnabled ? 'bg-emerald-600' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                                notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 2. 🎨 Apparence */}
                    <div className="rounded-3xl bg-white border border-gray-100 p-5 sm:p-6 shadow-xs space-y-4">
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          <span>🎨</span>
                          <span>Apparence</span>
                        </h3>
                        <p className="text-xs text-gray-500">
                          Choisis le mode d'affichage appliqué à toute l'interface de TalaMbongo
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* ☀️ Mode clair */}
                        <button
                          id="appearance-mode-light-btn"
                          type="button"
                          onClick={() => setTheme('light')}
                          className={`p-4 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between ${
                            theme === 'light'
                              ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600 ring-offset-1'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shrink-0">
                              ☀️
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">Mode clair</p>
                              <p className="text-[11px] text-gray-500">Fond blanc & vert émeraude</p>
                            </div>
                          </div>
                          {theme === 'light' && (
                            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          )}
                        </button>

                        {/* 🌙 Mode sombre */}
                        <button
                          id="appearance-mode-dark-btn"
                          type="button"
                          onClick={() => setTheme('dark')}
                          className={`p-4 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between ${
                            theme === 'dark'
                              ? 'border-emerald-500 bg-[#14211c] ring-2 ring-emerald-500 ring-offset-1'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 text-emerald-300 flex items-center justify-center text-xl shrink-0 border border-emerald-800/40">
                              🌙
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">Mode sombre</p>
                              <p className="text-[11px] text-gray-500">Contraste soigné & vert nuit</p>
                            </div>
                          </div>
                          {theme === 'dark' && (
                            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* VUE PROFIL PRINCIPALE */
                <>
                  {/* User Identity Card */}
                  <div className="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 font-black text-xl flex items-center justify-center shrink-0">
                        {user.name && user.name.trim().length > 0 ? user.name.trim().charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Information principale : Nom complet de l'utilisateur */}
                        {isEditingName ? (
                          <form onSubmit={handleSaveName} className="flex flex-wrap items-center gap-2 mb-1.5">
                            <input
                              id="profile-name-input"
                              type="text"
                              value={editedName}
                              onChange={(e) => setEditedName(e.target.value)}
                              placeholder="Ex : David Okomba"
                              required
                              autoFocus
                              className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 focus:outline-none focus:border-emerald-600 bg-white min-w-[180px]"
                            />
                            <button
                              id="profile-save-name-btn"
                              type="submit"
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer"
                            >
                              Enregistrer
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditedName(user.name || '');
                                setIsEditingName(false);
                              }}
                              className="px-2.5 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold transition cursor-pointer"
                            >
                              Annuler
                            </button>
                          </form>
                        ) : user.name && user.name.trim().length > 0 ? (
                          <div className="flex items-center gap-2 mb-0.5">
                            <h2 id="profile-user-name" className="text-xl font-extrabold text-gray-900 tracking-tight truncate">
                              {user.name}
                            </h2>
                            <button
                              id="profile-edit-name-btn"
                              type="button"
                              onClick={() => {
                                setEditedName(user.name);
                                setIsEditingName(true);
                              }}
                              className="p-1 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer shrink-0"
                              title="Modifier le nom complet"
                              aria-label="Modifier le nom complet"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          /* Cas des anciens utilisateurs sans nom enregistré : possibilité immédiate de compléter leur nom */
                          <div className="space-y-1 mb-1.5">
                            <p className="text-xs font-semibold text-amber-700">Nom complet non renseigné</p>
                            <button
                              id="profile-complete-name-btn"
                              type="button"
                              onClick={() => {
                                setEditedName('');
                                setIsEditingName(true);
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200/70 transition cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Compléter mon nom</span>
                            </button>
                          </div>
                        )}


                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            <span>Statut : {user.status}</span>
                          </div>
                          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                            <span>💱 {SUPPORTED_CURRENCIES[activeCurrency].code} ({SUPPORTED_CURRENCIES[activeCurrency].symbol})</span>
                          </div>
                          {user.country && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium">
                              <span>📍 {user.country}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions List (Mon abonnement, Export PDF, Paramètres, Se déconnecter) */}
                  <div className="rounded-3xl bg-white border border-gray-100 shadow-xs divide-y divide-gray-100 overflow-hidden">
                    <button
                      onClick={() => setIsSubModalOpen(true)}
                      className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">Mon abonnement</h4>
                          <p className="text-xs text-gray-500">
                            {user.status === 'Essai gratuit' ? '7 jours gratuits en cours' : 'Abonnement actif'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>

                    <button
                      onClick={handleOpenNormalPdfExport}
                      className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center">
                          <Download className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">Export PDF</h4>
                          <p className="text-xs text-gray-500">Télécharge tes bilans mensuels imprimables</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>

                    <button
                      id="profile-open-settings-button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center">
                          <Settings className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">Paramètres</h4>
                          <p className="text-xs text-gray-500">
                            Devise ({SUPPORTED_CURRENCIES[activeCurrency].code}), Notifications, Apparence
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>

                    <button
                      onClick={onLogout}
                      className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-rose-50/50 transition cursor-pointer text-left text-rose-600 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-100">
                          <LogOut className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold">Se déconnecter</h4>
                          <p className="text-xs text-rose-400">Retourner à la page d'accueil</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-rose-400" />
                    </button>
                  </div>

                  {/* PWA Install helper inside profile */}
                  <div className="p-5 rounded-3xl bg-[#fafbfc] border border-gray-100 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">Application PWA installable</h4>
                      <p className="text-[11px] text-gray-500">Ajoute TalaMbongo à ton écran d'accueil</p>
                    </div>
                    <PWAInstallButton variant="compact" />
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 15. NAVIGATION MOBILE EN BAS DE L'ÉCRAN (4 ÉLÉMENTS) + BOUTON FLOTTANT "+" AVEC LE POUCE */}
      <nav
        id="mobile-bottom-nav"
        aria-label="Navigation principale mobile"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 md:hidden px-2 py-1.5"
      >
        <div className="max-w-md mx-auto grid grid-cols-4 items-center relative">
          <button
            onClick={() => handleTabChange('home')}
            aria-label="Accueil"
            className={`flex flex-col items-center justify-center py-2 transition-colors cursor-pointer ${
              activeTab === 'home' ? 'text-emerald-700 font-bold' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-1">Accueil</span>
          </button>

          <button
            onClick={() => handleTabChange('calendar')}
            aria-label="Calendrier"
            className={`flex flex-col items-center justify-center py-2 transition-colors cursor-pointer ${
              activeTab === 'calendar' ? 'text-emerald-700 font-bold' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <CalendarIcon className="w-5 h-5" />
            <span className="text-[10px] mt-1">Calendrier</span>
          </button>

          <button
            onClick={() => handleTabChange('bilan')}
            aria-label="Bilan"
            className={`flex flex-col items-center justify-center py-2 transition-colors cursor-pointer ${
              activeTab === 'bilan' ? 'text-emerald-700 font-bold' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <BilanIcon className="w-5 h-5" />
            <span className="text-[10px] mt-1">Bilan</span>
          </button>

          <button
            onClick={() => handleTabChange('profile')}
            aria-label="Profil"
            className={`flex flex-col items-center justify-center py-2 transition-colors cursor-pointer ${
              activeTab === 'profile' ? 'text-emerald-700 font-bold' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] mt-1">Profil</span>
          </button>
        </div>
      </nav>

      {/* Floating Action Button (FAB) "+" for easy thumb access on mobile */}
      <button
        id="floating-add-expense-thumb-btn"
        onClick={() => setIsAddModalOpen(true)}
        aria-label="Ajouter une dépense rapidement"
        title="Ajouter une dépense"
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-700/35 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={onAddExpense}
        defaultDate={selectedDateStr}
        currency={activeCurrency}
      />

      {/* PDF Export Modal */}
      <PdfExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        expenses={pdfTarget === 'expiring' ? expiringPeriodExpenses : monthExpenses}
        monthName={pdfTarget === 'expiring' ? expiringPeriodName : monthNameFormatted}
        totalAmount={
          pdfTarget === 'expiring'
            ? expiringPeriodExpenses.reduce(
                (acc, curr) => acc + convertAmount(curr.amount, curr.currency, activeCurrency),
                0
              )
            : currentMonthTotal
        }
        currency={activeCurrency}
        userName={user.name}
        userCountry={user.country || 'Congo-Brazzaville'}
        avgDaily={pdfTarget === 'expiring' ? undefined : bilanStats.avgDaily}
        maxExpenseTitle={pdfTarget === 'expiring' ? undefined : bilanStats.maxExpenseTitle}
        maxExpenseAmount={pdfTarget === 'expiring' ? undefined : bilanStats.maxExpenseAmount}
      />

      {/* Subscription Modal (Mon abonnement) */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Mon abonnement</h3>
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                  Formule active
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold">
                  {user.status}
                </span>
              </div>
              <p className="text-sm font-bold text-gray-900">
                {user.status === 'Essai gratuit' ? '7 jours gratuits (il reste 5 jours)' : 'TalaMbongo Premium (historique mensuel jusqu\'au 3)'}
              </p>
            </div>

            <div className="space-y-3 text-xs text-gray-600">
              <p className="font-semibold text-gray-900">Passer à TalaMbongo Premium :</p>
              <div className="p-3.5 rounded-xl border border-emerald-300 bg-white flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">Option 1 mois</p>
                  <p className="text-gray-500">{formatCurrency(subMonthlyPrice, activeCurrency)} / mois</p>
                </div>
                <button
                  onClick={() => {
                    onUpdateUser({ status: 'Premium', subscriptionType: 'monthly', subscriptionStatus: 'active' });
                    setIsSubModalOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition cursor-pointer"
                >
                  Choisir
                </button>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-300 bg-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-gray-900">Option 3 mois</p>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                      -{formatCurrency(subSavingsPrice, activeCurrency)}
                    </span>
                  </div>
                  <p className="text-gray-500">{formatCurrency(subQuarterlyPrice, activeCurrency)} (soit {formatCurrency(subPerMonthQuarterly, activeCurrency)}/mois)</p>
                </div>
                <button
                  onClick={() => {
                    onUpdateUser({ status: 'Premium', subscriptionType: 'quarterly', subscriptionStatus: 'active' });
                    setIsSubModalOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition cursor-pointer"
                >
                  Choisir
                </button>
              </div>
            </div>

            <button
              onClick={() => setIsSubModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
