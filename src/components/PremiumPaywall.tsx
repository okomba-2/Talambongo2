import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  LogOut,
  MessageCircle,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { SupportedCurrency } from '../types';
import { convertAmount, formatCurrency } from '../utils/currency';
import { SubscriptionAccessPhase } from '../utils/subscription';

interface PremiumPaywallProps {
  phase: Extract<SubscriptionAccessPhase, 'trial_expired' | 'subscription_expired'>;
  currency: SupportedCurrency;
  expensesCount: number;
  trialEndsAtMs?: number;
  subscriptionEndAtMs?: number;
  onUpgradeClick: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

const PREMIUM_BENEFITS = [
  'Suivi illimité de vos dépenses quotidiennes par moment de la journée',
  'Calendrier mensuel interactif avec recherche et historique jour par jour',
  'Bilans automatiques et répartition complète par catégorie',
  'Exportation PDF professionnelle de vos rapports mensuels',
];

export const PremiumPaywall: React.FC<PremiumPaywallProps> = ({
  phase,
  currency,
  expensesCount,
  trialEndsAtMs,
  subscriptionEndAtMs,
  onUpgradeClick,
  onOpenProfile,
  onLogout,
}) => {
  const isRenewal = phase === 'subscription_expired';
  const convertedMonthly = convertAmount(500, 'XOF', currency);
  const convertedQuarterly = convertAmount(1200, 'XOF', currency);
  const showConvertedEquivalent = currency === 'CDF' || currency === 'EUR';

  const expiredDateMs = isRenewal ? subscriptionEndAtMs : trialEndsAtMs;
  const expiredDateLabel = expiredDateMs
    ? new Date(expiredDateMs).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <section
      id="premium-paywall-section"
      aria-labelledby="premium-paywall-title"
      className="max-w-2xl mx-auto py-4 sm:py-6"
    >
      <div className="rounded-3xl bg-white border border-gray-100 shadow-xs overflow-hidden">
        {/* Bandeau d'en-tête sobre */}
        <div className="p-6 sm:p-8 border-b border-gray-100 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider">
              <Lock className="w-4 h-4 shrink-0" />
              <span>{isRenewal ? 'Renouvellement requis' : 'Période d’essai expirée'}</span>
            </div>
            {expiredDateLabel && (
              <span className="text-xs text-gray-500 font-medium tabular-nums">
                Expiré le {expiredDateLabel}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h2
              id="premium-paywall-title"
              className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight"
            >
              {isRenewal
                ? 'Votre abonnement Premium a expiré'
                : 'Votre essai gratuit est terminé'}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {isRenewal
                ? 'Votre période d’abonnement est arrivée à échéance. Renouvelez votre abonnement pour débloquer immédiatement votre tableau de bord, votre calendrier et vos bilans.'
                : 'Votre essai gratuit de 7 jours est arrivé à son terme. Passez à TalaMbongo Premium pour continuer à enregistrer vos dépenses et consulter vos bilans.'}
            </p>
          </div>

          {/* Garantie de conservation des données */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950 leading-relaxed">
              <span className="font-bold block">Toutes vos données sont conservées en sécurité.</span>
              <span className="text-emerald-800">
                {expensesCount > 0
                  ? `${expensesCount} dépense${expensesCount > 1 ? 's enregistrées restent' : ' enregistrée reste'} intacte${expensesCount > 1 ? 's' : ''} et disponible${expensesCount > 1 ? 's' : ''} dès l’activation.`
                  : 'Votre profil et votre historique restent intacts et disponibles dès l’activation.'}
              </span>
            </div>
          </div>
        </div>

        {/* Bloc Tarif + Avantages */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#fafbfc] border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-extrabold text-emerald-700 uppercase tracking-wider block">
                TalaMbongo Premium
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-gray-900 tabular-nums">
                  500 FCFA
                </span>
                <span className="text-sm font-bold text-gray-600">Par mois</span>
              </div>
              {showConvertedEquivalent && (
                <p className="text-xs text-gray-500 font-medium tabular-nums">
                  Équivalent dans votre devise : {formatCurrency(convertedMonthly, currency)} / mois
                </p>
              )}
              <p className="text-xs text-emerald-700 font-semibold tabular-nums">
                Formule 3 mois également disponible à 1 200 FCFA
                {showConvertedEquivalent ? ` (${formatCurrency(convertedQuarterly, currency)})` : ''}
              </p>
            </div>

            <button
              id="paywall-upgrade-btn"
              type="button"
              onClick={onUpgradeClick}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-700/20 transition-all cursor-pointer active:scale-[0.99] shrink-0"
            >
              <span>Passer à Premium</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Liste des avantages inclus */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">
              Avantages inclus avec Premium
            </h3>
            <ul className="space-y-2.5">
              {PREMIUM_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Accès préservé : Profil, Support, Déconnexion */}
          <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <button
                id="paywall-open-profile-btn"
                type="button"
                onClick={onOpenProfile}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Mon profil</span>
              </button>

              <a
                href={`https://wa.me/242061152228?text=${encodeURIComponent(
                  'Bonjour, je souhaite activer ou renouveler mon abonnement TalaMbongo Premium.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold transition"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Support WhatsApp</span>
              </a>
            </div>

            <button
              id="paywall-logout-btn"
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50/50 font-bold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
