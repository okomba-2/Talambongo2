import { Expense, ExpenseCategory, Testimonial, UserProfile } from '../types';
import { formatCurrency } from '../utils/currency';

export const CATEGORIES: { name: ExpenseCategory; icon: string; color: string; bg: string }[] = [
  { name: 'Alimentation', icon: 'Utensils', color: '#059669', bg: '#ecfdf5' },
  { name: 'Transport', icon: 'Bus', color: '#0284c7', bg: '#f0f9ff' },
  { name: 'Factures', icon: 'Receipt', color: '#d97706', bg: '#fffbeb' },
  { name: 'Téléphone / Internet', icon: 'Wifi', color: '#7c3aed', bg: '#f5f3ff' },
  { name: 'Achats', icon: 'ShoppingBag', color: '#db2777', bg: '#fdf2f8' },
  { name: 'Loisirs', icon: 'Sparkles', color: '#e11d48', bg: '#fff1f2' },
  { name: 'Études', icon: 'GraduationCap', color: '#4f46e5', bg: '#eef2ff' },
  { name: 'Autres', icon: 'MoreHorizontal', color: '#475569', bg: '#f1f5f9' },
];

export const INITIAL_USER: UserProfile = {
  name: 'David Okomba',
  email: 'okombacontact@gmail.com',
  status: 'Essai gratuit',
  trialDaysLeft: 7,
  country: 'Congo-Brazzaville',
  mainGoal: 'Comprendre où va mon argent',
  trackingFrequency: 'Tous les jours',
  onboardingCompleted: true,
  currency: 'XOF',
};

export const INITIAL_TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Sarah',
    country: 'Côte d’Ivoire',
    quote: "Depuis que j'utilise TalaMbongo, j'ai découvert plusieurs petites dépenses inutiles que je faisais chaque semaine.",
    avatarBg: '#dcfce7',
    initials: 'SA',
    rating: 5,
  },
  {
    id: '2',
    name: 'Kevin',
    country: 'Congo-Brazzaville',
    quote: "Avant, je ne savais jamais où partait mon argent. Maintenant, je peux voir clairement mes dépenses du mois.",
    avatarBg: '#e0f2fe',
    initials: 'KB',
    rating: 5,
  },
  {
    id: '3',
    name: 'Mariam',
    country: 'Sénégal',
    quote: "TalaMbongo m'aide à mieux contrôler mes dépenses et à mettre de côté plus facilement.",
    avatarBg: '#fef3c7',
    initials: 'MS',
    rating: 5,
  },
  {
    id: '4',
    name: 'David',
    country: 'Cameroun',
    quote: "J'ai commencé à noter toutes mes dépenses et je me suis rendu compte que les petites dépenses s'accumulaient énormément.",
    avatarBg: '#fce7f3',
    initials: 'DC',
    rating: 5,
  },
];

// Calcul dynamique des dates à partir de la date actuelle de l'appareil (aucun mois ou année codé en dur)
const getRelativeDateInfo = (daysAgo: number, hour = 12, min = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  d.setHours(hour, min, 0, 0);
  return {
    date: `${year}-${month}-${day}`,
    createdAt: d.getTime(),
  };
};

// Dépenses initiales réalistes calculées dynamiquement selon la date de l'appareil (toutes enregistrées en XOF d'origine)
const RAW_INITIAL_EXPENSES: Omit<Expense, 'currency'>[] = [
  // Dépense du mois précédent (automatiquement retirée dès le 3 du mois en cours)
  {
    id: 'exp-past-month-expired',
    title: 'Ancien achat fournitures bureau',
    amount: 8500,
    category: 'Factures',
    moment: 'Matin',
    date: getRelativeDateInfo(35, 10, 0).date,
    note: 'Archivée',
    createdAt: getRelativeDateInfo(35, 10, 0).createdAt,
  },

  // Aujourd'hui (Matin, Midi, Soir)
  {
    id: 'exp-today-1',
    title: 'Transport',
    amount: 1500,
    category: 'Transport',
    moment: 'Matin',
    date: getRelativeDateInfo(0, 8, 30).date,
    note: 'Taxi vers le travail',
    createdAt: getRelativeDateInfo(0, 8, 30).createdAt,
  },
  {
    id: 'exp-today-2',
    title: 'Déjeuner',
    amount: 2500,
    category: 'Alimentation',
    moment: 'Après-midi',
    date: getRelativeDateInfo(0, 13, 0).date,
    note: 'Plat du jour au resto',
    createdAt: getRelativeDateInfo(0, 13, 0).createdAt,
  },
  {
    id: 'exp-today-3',
    title: 'Courses',
    amount: 4000,
    category: 'Alimentation',
    moment: 'Soir',
    date: getRelativeDateInfo(0, 19, 30).date,
    note: 'Fruits, légumes et eau',
    createdAt: getRelativeDateInfo(0, 19, 30).createdAt,
  },

  // Il y a 1 jour
  {
    id: 'exp-1d-1',
    title: 'Transport matinal',
    amount: 2000,
    category: 'Transport',
    moment: 'Matin',
    date: getRelativeDateInfo(1, 8, 0).date,
    createdAt: getRelativeDateInfo(1, 8, 0).createdAt,
  },
  {
    id: 'exp-1d-2',
    title: 'Déjeuner d’équipe',
    amount: 3500,
    category: 'Alimentation',
    moment: 'Après-midi',
    date: getRelativeDateInfo(1, 12, 45).date,
    createdAt: getRelativeDateInfo(1, 12, 45).createdAt,
  },

  // Il y a 2 jours
  {
    id: 'exp-2d-1',
    title: 'Pass transport hebdomadaire',
    amount: 8500,
    category: 'Transport',
    moment: 'Matin',
    date: getRelativeDateInfo(2, 7, 45).date,
    createdAt: getRelativeDateInfo(2, 7, 45).createdAt,
  },
  {
    id: 'exp-2d-2',
    title: 'Supermarché ravitaillement',
    amount: 11000,
    category: 'Alimentation',
    moment: 'Soir',
    date: getRelativeDateInfo(2, 18, 50).date,
    createdAt: getRelativeDateInfo(2, 18, 50).createdAt,
  },

  // Il y a 4 jours
  {
    id: 'exp-4d-1',
    title: 'Taxi express aéroport / gare',
    amount: 12000,
    category: 'Transport',
    moment: 'Après-midi',
    date: getRelativeDateInfo(4, 14, 30).date,
    createdAt: getRelativeDateInfo(4, 14, 30).createdAt,
  },
  {
    id: 'exp-4d-2',
    title: 'Dîner à emporter',
    amount: 4000,
    category: 'Alimentation',
    moment: 'Soir',
    date: getRelativeDateInfo(4, 20, 10).date,
    createdAt: getRelativeDateInfo(4, 20, 10).createdAt,
  },

  // Il y a 7 jours
  {
    id: 'exp-7d-1',
    title: 'Soirée restaurant entre amis',
    amount: 12500,
    category: 'Loisirs',
    moment: 'Soir',
    date: getRelativeDateInfo(7, 21, 0).date,
    createdAt: getRelativeDateInfo(7, 21, 0).createdAt,
  },

  // Il y a 10 jours
  {
    id: 'exp-10d-1',
    title: 'Facture électricité Senelec / Eneo',
    amount: 14500,
    category: 'Factures',
    moment: 'Matin',
    date: getRelativeDateInfo(10, 10, 0).date,
    createdAt: getRelativeDateInfo(10, 10, 0).createdAt,
  },
  {
    id: 'exp-10d-2',
    title: 'Déjeuner collègues',
    amount: 3000,
    category: 'Alimentation',
    moment: 'Après-midi',
    date: getRelativeDateInfo(10, 13, 15).date,
    createdAt: getRelativeDateInfo(10, 13, 15).createdAt,
  },

  // Il y a 13 jours
  {
    id: 'exp-13d-1',
    title: 'Sortie cinéma et encas',
    amount: 7500,
    category: 'Loisirs',
    moment: 'Soir',
    date: getRelativeDateInfo(13, 20, 0).date,
    note: 'Séance week-end',
    createdAt: getRelativeDateInfo(13, 20, 0).createdAt,
  },

  // Il y a 15 jours
  {
    id: 'exp-15d-1',
    title: 'Essence moto / taxi',
    amount: 5000,
    category: 'Transport',
    moment: 'Matin',
    date: getRelativeDateInfo(15, 8, 15).date,
    createdAt: getRelativeDateInfo(15, 8, 15).createdAt,
  },
  {
    id: 'exp-15d-2',
    title: 'Goûter et café',
    amount: 2000,
    category: 'Alimentation',
    moment: 'Après-midi',
    date: getRelativeDateInfo(15, 16, 20).date,
    createdAt: getRelativeDateInfo(15, 16, 20).createdAt,
  },

  // Il y a 18 jours
  {
    id: 'exp-18d-1',
    title: 'Recharge Internet Box',
    amount: 25000,
    category: 'Téléphone / Internet',
    moment: 'Matin',
    date: getRelativeDateInfo(18, 9, 0).date,
    note: 'Abonnement mensuel fibre',
    createdAt: getRelativeDateInfo(18, 9, 0).createdAt,
  },
  {
    id: 'exp-18d-2',
    title: 'Courses marché début du mois',
    amount: 18500,
    category: 'Alimentation',
    moment: 'Après-midi',
    date: getRelativeDateInfo(18, 15, 0).date,
    note: 'Riz, huile, épices',
    createdAt: getRelativeDateInfo(18, 15, 0).createdAt,
  },

  // Il y a 22 jours
  {
    id: 'exp-22d-1',
    title: 'Recharge mobile crédit d’appel',
    amount: 5000,
    category: 'Téléphone / Internet',
    moment: 'Matin',
    date: getRelativeDateInfo(22, 9, 30).date,
    createdAt: getRelativeDateInfo(22, 9, 30).createdAt,
  },
  {
    id: 'exp-22d-2',
    title: 'Pharmacie et vitamines',
    amount: 10000,
    category: 'Autres',
    moment: 'Après-midi',
    date: getRelativeDateInfo(22, 15, 40).date,
    createdAt: getRelativeDateInfo(22, 15, 40).createdAt,
  },
];

// Chaque dépense initiale est explicitement typée avec sa devise originale 'XOF'
export const INITIAL_EXPENSES: Expense[] = RAW_INITIAL_EXPENSES.map((exp) => ({
  ...exp,
  currency: 'XOF',
}));

// Helper rétro-compatible (remplacé par formatCurrency dans l'ensemble de l'application)
export function formatFCFA(amount: number): string {
  return formatCurrency(amount, 'XOF');
}
