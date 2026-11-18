import React, { useState } from 'react';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { SupportedCurrency } from '../types';
import { convertAmount, formatCurrency } from '../utils/currency';

interface PricingSectionProps {
  currency?: SupportedCurrency;
  onSelectPlan: (plan: 'free' | 'premium' | 'monthly' | 'quarterly') => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ currency, onSelectPlan }) => {
  const [premiumOption, setPremiumOption] = useState<'monthly' | 'quarterly'>('monthly');

  // Devise active : passée en prop ou synchronisée avec le profil utilisateur sauvegardé
  const activeCurrency: SupportedCurrency = currency || (() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('talambongo_user') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currency) return parsed.currency as SupportedCurrency;
      }
    } catch {
      // fallback
    }
    return 'XOF';
  })();

  // Calculs dynamiques basés sur le prix de référence inaltérable de 1 000 XOF
  const monthlyPrice = convertAmount(1000, 'XOF', activeCurrency);
  const quarterlyPrice = convertAmount(2700, 'XOF', activeCurrency);
  const savingsPrice = convertAmount(300, 'XOF', activeCurrency);
  const perMonthQuarterlyPrice = convertAmount(900, 'XOF', activeCurrency);
  const freePrice = formatCurrency(0, activeCurrency);

  return (
    <section id="pricing-section" className="py-16 sm:py-24 bg-[#fafbfc]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-3 border border-emerald-100">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tarifs clairs & transparents</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Commence simplement.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-gray-600 font-normal">
            Démarre avec l'essai sans carte bancaire, puis choisis la sérénité avec TalaMbongo Premium.
          </p>
        </div>

        {/* Pricing Cards Grid (Exact 2 offers required: Essai gratuit & Premium) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
          {/* Card 1: Essai gratuit */}
          <div className="rounded-3xl bg-white border border-gray-200/90 p-8 sm:p-9 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Découverte
              </span>
              <h3 className="text-2xl font-black text-gray-900">Essai gratuit</h3>

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-gray-900">{freePrice}</span>
                <span className="text-sm font-semibold text-gray-500">/ 7 jours</span>
              </div>

              <p className="text-xs text-gray-500">
                Idéal pour tester l'application et comprendre tes dépenses de la semaine.
              </p>

              <div className="pt-4 border-t border-gray-100 space-y-3">
                <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">Inclus :</p>
                <ul className="space-y-2.5 text-sm text-gray-600">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Suivi des dépenses</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Calendrier</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Bilans</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Statistiques de base</span>
                  </li>
                </ul>
              </div>
            </div>

            <button
              id="pricing-free-btn"
              onClick={() => onSelectPlan('free')}
              className="w-full py-3.5 px-6 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold text-sm transition-all text-center cursor-pointer"
            >
              Commencer
            </button>
          </div>

          {/* Card 2: Premium */}
          <div className="relative rounded-3xl bg-white border-2 border-emerald-600 p-8 sm:p-9 shadow-md flex flex-col justify-between space-y-6">
            {/* Top Pill Badge */}
            <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-xs">
              Recommandé
            </div>

            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Complet
              </span>
              <h3 className="text-2xl font-black text-gray-900">Premium</h3>

              {/* Toggle option between monthly (1 000 XOF / mois) and 3 mois (2 700 XOF) */}
              <div className="p-1 rounded-xl bg-gray-100/90 flex gap-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPremiumOption('monthly')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    premiumOption === 'monthly'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Mensuel
                </button>
                <button
                  type="button"
                  onClick={() => setPremiumOption('quarterly')}
                  className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    premiumOption === 'quarterly'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <span>3 mois</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                    -{formatCurrency(savingsPrice, activeCurrency)}
                  </span>
                </button>
              </div>

              {/* Price display based on selected option */}
              {premiumOption === 'monthly' ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-gray-900">{formatCurrency(monthlyPrice, activeCurrency)}</span>
                    <span className="text-sm font-semibold text-gray-500">/ mois</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Facturé mensuellement. Annulable à tout moment.</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-gray-900">{formatCurrency(quarterlyPrice, activeCurrency)}</span>
                    <span className="text-sm font-semibold text-gray-500">/ 3 mois</span>
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-1">
                    Économisez {formatCurrency(savingsPrice, activeCurrency)} (soit {formatCurrency(perMonthQuarterlyPrice, activeCurrency)} / mois)
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 space-y-3">
                <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                  Tout l'essai gratuit, plus :
                </p>
                <ul className="space-y-2.5 text-sm text-gray-700">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Suivi complet des dépenses</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Historique mensuel (jusqu'au 3 du mois suivant)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Statistiques avancées</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Export PDF propre & partage</span>
                  </li>
                </ul>
              </div>
            </div>

            <button
              id="pricing-premium-btn"
              onClick={() => onSelectPlan(premiumOption)}
              className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <span>{premiumOption === 'monthly' ? `Choisir Premium (${formatCurrency(monthlyPrice, activeCurrency)})` : `Choisir 3 mois (${formatCurrency(quarterlyPrice, activeCurrency)})`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
