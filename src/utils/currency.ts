import { SupportedCurrency } from '../types';

export interface CurrencyDetails {
  code: SupportedCurrency;
  label: string; // Nom officiel
  symbol: string; // Symbole usuel d'affichage
  flag: string;
  decimals: number; // 0 pour XOF/XAF/CDF, 2 pour EUR
  isFixed: boolean;
}

export const SUPPORTED_CURRENCIES: Record<SupportedCurrency, CurrencyDetails> = {
  XOF: {
    code: 'XOF',
    label: 'Franc CFA BCEAO',
    symbol: 'XOF',
    flag: '🌍',
    decimals: 0,
    isFixed: true,
  },
  XAF: {
    code: 'XAF',
    label: 'Franc CFA BEAC',
    symbol: 'XAF',
    flag: '🌍',
    decimals: 0,
    isFixed: true,
  },
  CDF: {
    code: 'CDF',
    label: 'Franc congolais',
    symbol: 'CDF',
    flag: '🇨🇩',
    decimals: 0,
    isFixed: false,
  },
  EUR: {
    code: 'EUR',
    label: 'Euro',
    symbol: '€',
    flag: '🇪🇺',
    decimals: 2,
    isFixed: true,
  },
};

export interface CountryCurrencyOption {
  code: string;
  name: string;
  flag: string;
  currency: SupportedCurrency;
}

/**
 * Configuration centralisée de correspondance Pays -> Devise.
 * Garantit que chaque pays reçoit automatiquement sa devise officielle
 * sans jamais appliquer l'euro par défaut à un pays utilisant le XOF, XAF ou CDF.
 */
export const COUNTRY_CURRENCY_OPTIONS: CountryCurrencyOption[] = [
  { code: 'CG', name: 'Congo-Brazzaville', flag: '🇨🇬', currency: 'XAF' },
  { code: 'CD', name: 'RD Congo', flag: '🇨🇩', currency: 'CDF' },
  { code: 'CI', name: 'Côte d’Ivoire', flag: '🇨🇮', currency: 'XOF' },
  { code: 'CM', name: 'Cameroun', flag: '🇨🇲', currency: 'XAF' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳', currency: 'XOF' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦', currency: 'XAF' },
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯', currency: 'XOF' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', currency: 'XOF' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱', currency: 'XOF' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫', currency: 'XOF' },
  { code: 'GN', name: 'Guinée', flag: '🇬🇳', currency: 'XOF' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪', currency: 'XOF' },
  { code: 'TD', name: 'Tchad', flag: '🇹🇩', currency: 'XAF' },
  { code: 'CF', name: 'Centrafrique', flag: '🇨🇫', currency: 'XAF' },
  { code: 'GQ', name: 'Guinée équatoriale', flag: '🇬🇶', currency: 'XAF' },
  { code: 'GW', name: 'Guinée-Bissau', flag: '🇬🇼', currency: 'XOF' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', currency: 'XAF' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮', currency: 'XAF' },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR' },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪', currency: 'EUR' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺', currency: 'EUR' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭', currency: 'EUR' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪', currency: 'EUR' },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸', currency: 'EUR' },
  { code: 'IT', name: 'Italie', flag: '🇮🇹', currency: 'EUR' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', currency: 'EUR' },
  { code: 'NL', name: 'Pays-Bas', flag: '🇳🇱', currency: 'EUR' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'EUR' },
  { code: 'OTHER', name: 'Autre pays', flag: '🌍', currency: 'XOF' },
];

export const COUNTRY_TO_CURRENCY: Record<string, SupportedCurrency> = COUNTRY_CURRENCY_OPTIONS.reduce(
  (acc, item) => {
    acc[item.name] = item.currency;
    return acc;
  },
  {} as Record<string, SupportedCurrency>
);

function normalizeCountryKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, "'")
    .replace(/\s+/g, ' ');
}

const NORMALIZED_COUNTRY_CURRENCY_MAP: Record<string, SupportedCurrency> = (() => {
  const map: Record<string, SupportedCurrency> = {};
  for (const item of COUNTRY_CURRENCY_OPTIONS) {
    map[normalizeCountryKey(item.name)] = item.currency;
  }
  // Alias courants
  map['rdc'] = 'CDF';
  map['republique democratique du congo'] = 'CDF';
  map['congo-kinshasa'] = 'CDF';
  map['congo kinshasa'] = 'CDF';
  map['congo brazzaville'] = 'XAF';
  map['republique du congo'] = 'XAF';
  map['cote d\'ivoire'] = 'XOF';
  map['ivory coast'] = 'XOF';
  return map;
})();

/**
 * Retourne automatiquement la devise associée à un pays selon la configuration centralisée.
 * Ne renvoie jamais EUR pour les pays utilisant XOF, XAF ou CDF.
 */
export function getCurrencyForCountry(country?: string | null): SupportedCurrency {
  if (!country || typeof country !== 'string') {
    return 'XOF';
  }
  const normalized = normalizeCountryKey(country);
  return NORMALIZED_COUNTRY_CURRENCY_MAP[normalized] || 'XOF';
}

/**
 * Taux officiels fixés par accords monétaires internationaux :
 * - 1 EUR = 655.957 XOF (Parité fixe officielle BCEAO)
 * - 1 EUR = 655.957 XAF (Parité fixe officielle BEAC)
 * - Parité stricte 1:1 entre XOF et XAF.
 *
 * Pour le CDF (Franc congolais) :
 * - Taux de référence officiel de la Banque Centrale du Congo (BCC)
 * - Valeur actualisable stockée et modifiable/rafraîchissable
 */
export const OFFICIAL_FIXED_EUR_RATES: Record<'EUR' | 'XOF' | 'XAF', number> = {
  EUR: 1,
  XOF: 655.957,
  XAF: 655.957,
};

// Cours de référence officiel BCC pour le CDF (actualisable)
export const DEFAULT_CDF_RATE_PER_EUR = 2680.0;

const STORAGE_KEY_EXCHANGE_RATES = 'talambongo_exchange_rates';

export interface ExchangeRatesState {
  EUR: number;
  XOF: number;
  XAF: number;
  CDF: number;
  lastUpdated?: string;
}

/**
 * Récupère les taux de conversion en vigueur (avec taux CDF actualisable)
 */
export function getExchangeRates(): ExchangeRatesState {
  if (typeof window === 'undefined') {
    return {
      EUR: OFFICIAL_FIXED_EUR_RATES.EUR,
      XOF: OFFICIAL_FIXED_EUR_RATES.XOF,
      XAF: OFFICIAL_FIXED_EUR_RATES.XAF,
      CDF: DEFAULT_CDF_RATE_PER_EUR,
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY_EXCHANGE_RATES);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        EUR: OFFICIAL_FIXED_EUR_RATES.EUR,
        XOF: OFFICIAL_FIXED_EUR_RATES.XOF,
        XAF: OFFICIAL_FIXED_EUR_RATES.XAF,
        CDF: typeof parsed.CDF === 'number' && parsed.CDF > 0 ? parsed.CDF : DEFAULT_CDF_RATE_PER_EUR,
        lastUpdated: parsed.lastUpdated,
      };
    }
  } catch (e) {
    console.error('Erreur lecture taux de change:', e);
  }

  return {
    EUR: OFFICIAL_FIXED_EUR_RATES.EUR,
    XOF: OFFICIAL_FIXED_EUR_RATES.XOF,
    XAF: OFFICIAL_FIXED_EUR_RATES.XAF,
    CDF: DEFAULT_CDF_RATE_PER_EUR,
  };
}

/**
 * Permet d'actualiser le taux de change du CDF par rapport à l'euro
 */
export function updateCdfRate(newRate: number): void {
  if (typeof window === 'undefined' || !newRate || newRate <= 0) return;
  try {
    const current = getExchangeRates();
    const updated: ExchangeRatesState = {
      ...current,
      CDF: Math.round(newRate * 100) / 100,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY_EXCHANGE_RATES, JSON.stringify(updated));
  } catch (e) {
    console.error('Erreur mise à jour taux CDF:', e);
  }
}

/**
 * Convertit un montant d'une devise d'origine vers une devise cible.
 * Règle d'or :
 * Si fromCurrency === toCurrency, retourne directement le montant original SANS conversion,
 * garantissant 0 erreur d'arrondi sur les allers-retours.
 */
export function convertAmount(
  amount: number,
  fromCurrency: SupportedCurrency | string | undefined,
  toCurrency: SupportedCurrency | string | undefined
): number {
  if (typeof amount !== 'number' || isNaN(amount) || amount === 0) {
    return 0;
  }

  const from: SupportedCurrency = (fromCurrency as SupportedCurrency) || 'XOF';
  const to: SupportedCurrency = (toCurrency as SupportedCurrency) || 'XOF';

  // Identique : conservation absolue de la valeur originale
  if (from === to) {
    return amount;
  }

  // Parité 1:1 stricte entre XOF et XAF
  if ((from === 'XOF' && to === 'XAF') || (from === 'XAF' && to === 'XOF')) {
    return amount;
  }

  const rates = getExchangeRates();
  const rateFrom = rates[from] || rates.XOF;
  const rateTo = rates[to] || rates.XOF;

  // Montant pivot en EUR
  const amountInEur = amount / rateFrom;
  // Conversion finale dans la devise demandée
  const converted = amountInEur * rateTo;

  return converted;
}

/**
 * Formate un montant dans la devise spécifiée avec le bon symbole et le respect des décimales.
 */
export function formatCurrency(
  amount: number,
  currency: SupportedCurrency | string | undefined = 'XOF',
  options?: {
    compact?: boolean;
    includeSymbol?: boolean;
  }
): string {
  const activeCode: SupportedCurrency = (currency as SupportedCurrency) || 'XOF';
  const config = SUPPORTED_CURRENCIES[activeCode] || SUPPORTED_CURRENCIES.XOF;
  const includeSymbol = options?.includeSymbol !== false;

  // Affichage compact pour les cellules du calendrier (ex: "15k", "25€", "45k")
  if (options?.compact) {
    if (activeCode === 'EUR') {
      const rounded = Math.round(amount * 10) / 10;
      const formatted = rounded >= 1000 ? `${(rounded / 1000).toFixed(1)}k` : `${rounded}`;
      return includeSymbol ? `${formatted}€` : formatted;
    }
    const rounded = Math.round(amount);
    const formatted = rounded >= 1000 ? `${Math.round(rounded / 1000)}k` : `${rounded}`;
    return formatted;
  }

  let formattedNumber: string;
  if (config.decimals === 0) {
    // XOF, XAF, CDF : nombres entiers sans centimes
    formattedNumber = Math.round(amount).toLocaleString('fr-FR');
  } else {
    // EUR : 2 décimales selon usage monétaire standard
    formattedNumber = amount.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Nettoyage impératif : remplace les espaces fines ou insécables (U+202F, U+00A0) par un espace standard ASCII (' ')
  // pour éviter tout artefact de rendu dans les générateurs PDF (jsPDF) où U+202F est interprété comme un slash '/' ou un trait traversant les chiffres
  formattedNumber = formattedNumber.replace(/[^\S\r\n]/g, ' ');

  if (!includeSymbol) {
    return formattedNumber;
  }

  if (activeCode === 'EUR') {
    return `${formattedNumber} €`;
  }

  return `${formattedNumber} ${config.symbol}`;
}
