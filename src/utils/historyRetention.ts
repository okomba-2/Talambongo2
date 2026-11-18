import { Expense } from '../types';

/**
 * Règle de conservation de l'historique TalaMbongo :
 * Les dépenses d'un mois sont conservées pendant tout le mois et jusqu'au 3 du mois suivant (« chaque le 3 »).
 * Le 3 de chaque mois à minuit (dès le 3 au matin), toutes les dépenses du mois précédent et des mois antérieurs
 * expirent et disparaissent automatiquement de l'historique de l'application.
 *
 * Exemples :
 * - Les dépenses de Septembre disparaissent le 3 Octobre.
 * - Les dépenses d'Octobre disparaissent le 3 Novembre.
 * - Les dépenses de Décembre disparaissent le 3 Janvier de l'année suivante.
 */

/**
 * Jour du mois où l'historique du mois précédent disparaît (le 3 de chaque mois).
 */
export const RETENTION_EXPIRY_DAY_OF_MONTH = 3;

/**
 * Nombre de jours avant la date limite du 3 où l'avertissement d'expiration s'affiche.
 * Affiche l'alerte préventive dans les 7 jours précédant l'expiration du 3 (ex: dès le 26 du mois jusqu'au 2 du mois suivant).
 */
export const WARNING_DAYS_BEFORE_EXPIRY = 7;

/**
 * Parse une chaîne de date YYYY-MM-DD à minuit local.
 */
export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Calcule l'âge exact d'une dépense en jours calendaires entiers par rapport à une date de référence (date actuelle par défaut).
 */
export function getExpenseAgeInDays(expenseDateStr: string, referenceDate: Date = new Date()): number {
  const [ey, em, ed] = expenseDateStr.split('-').map(Number);
  const expUtc = Date.UTC(ey, em - 1, ed);
  const refUtc = Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diffMs = refUtc - expUtc;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calcule la date exacte d'expiration d'une dépense (le 3 du mois suivant).
 * Exemple: dépense du 15/09/2026 -> expiration le 03/10/2026 à 00:00:00.
 */
export function getExpenseExpirationDate(expenseDateStr: string): Date {
  const [year, month] = expenseDateStr.split('-').map(Number);
  // `month` est 1-indexé (1 = Janvier, ..., 12 = Décembre).
  // En JS new Date(year, monthIndex, day) :
  // Le mois suivant a comme monthIndex exactement la valeur de `month`.
  // Si month = 12 (Décembre), JS bascule automatiquement sur Janvier de year + 1.
  return new Date(year, month, RETENTION_EXPIRY_DAY_OF_MONTH, 0, 0, 0, 0);
}

/**
 * Calcule le nombre de jours restants avant la date limite d'expiration du 3.
 * Renvoie 0 si la date d'expiration est déjà atteinte ou passée.
 */
export function getDaysRemainingBeforeExpiry(expenseDateStr: string, referenceDate: Date = new Date()): number {
  const expirationDate = getExpenseExpirationDate(expenseDateStr);
  const refMidnight = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0
  );
  const diffMs = expirationDate.getTime() - refMidnight.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Détermine si une dépense est expirée :
 * Dès le 3 du mois suivant (« chaque le 3 »), les dépenses du mois précédent sont expirées et doivent disparaître.
 */
export function isExpenseExpired(expense: { date: string }, referenceDate: Date = new Date()): boolean {
  const expirationDate = getExpenseExpirationDate(expense.date);
  const refMidnight = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0
  );
  return refMidnight.getTime() >= expirationDate.getTime();
}

/**
 * Détermine si une dépense approche de son expiration (dans les 7 jours précédant le 3 du mois suivant).
 * Une dépense déjà expirée n'est plus "approchant", elle doit disparaître.
 */
export function isExpenseExpiringSoon(expense: { date: string }, referenceDate: Date = new Date()): boolean {
  if (isExpenseExpired(expense, referenceDate)) {
    return false;
  }
  const daysRemaining = getDaysRemainingBeforeExpiry(expense.date, referenceDate);
  return daysRemaining <= WARNING_DAYS_BEFORE_EXPIRY && daysRemaining > 0;
}

/**
 * Filtre les dépenses en supprimant celles ayant atteint la date d'expiration du 3.
 * Les dépenses du mois en cours (et du mois précédent avant le 3) restent totalement intactes.
 */
export function pruneExpiredExpenses<T extends { date: string }>(
  expenses: T[],
  referenceDate: Date = new Date()
): {
  validExpenses: T[];
  expiredExpenses: T[];
  removedCount: number;
} {
  const validExpenses: T[] = [];
  const expiredExpenses: T[] = [];

  for (const e of expenses) {
    if (isExpenseExpired(e, referenceDate)) {
      expiredExpenses.push(e);
    } else {
      validExpenses.push(e);
    }
  }

  return {
    validExpenses,
    expiredExpenses,
    removedCount: expiredExpenses.length,
  };
}

/**
 * Récupère la liste des dépenses approchant de leur expiration (date limite du 3).
 */
export function getExpiringSoonExpenses<T extends { date: string }>(
  expenses: T[],
  referenceDate: Date = new Date()
): T[] {
  return expenses.filter((e) => isExpenseExpiringSoon(e, referenceDate));
}
