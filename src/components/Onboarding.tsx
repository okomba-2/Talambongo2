import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  Search,
  ArrowRight,
  ArrowLeft,
  Eye,
  TrendingDown,
  PiggyBank,
  Target,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface OnboardingProps {
  userName: string;
  onComplete: (data: {
    country: string;
    mainGoal: string;
    trackingFrequency: string;
  }) => void;
}

interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

const COUNTRIES: CountryOption[] = [
  { code: 'CG', name: 'Congo-Brazzaville', flag: '🇨🇬' },
  { code: 'CD', name: 'RD Congo', flag: '🇨🇩' },
  { code: 'CI', name: 'Côte d’Ivoire', flag: '🇨🇮' },
  { code: 'CM', name: 'Cameroun', flag: '🇨🇲' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦' },
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
  { code: 'GN', name: 'Guinée', flag: '🇬🇳' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪' },
  { code: 'TD', name: 'Tchad', flag: '🇹🇩' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'OTHER', name: 'Autre pays', flag: '🌍' },
];

const GOALS = [
  {
    id: 'understand',
    title: 'Comprendre où va mon argent',
    subtitle: 'Identifier mes habitudes et éliminer les fuites inutiles',
    icon: Eye,
  },
  {
    id: 'reduce',
    title: 'Réduire mes dépenses',
    subtitle: 'Mettre un frein aux achats compulsifs et superflu',
    icon: TrendingDown,
  },
  {
    id: 'save',
    title: 'Économiser davantage',
    subtitle: 'Constituer une épargne régulière pour mes projets d’avenir',
    icon: PiggyBank,
  },
  {
    id: 'budget',
    title: 'Mieux gérer mon budget',
    subtitle: 'Planifier et équilibrer mes revenus sans stress de fin de mois',
    icon: Target,
  },
];

const FREQUENCIES = [
  {
    id: 'daily',
    title: 'Tous les jours',
    subtitle: '1 à 2 minutes par jour pour un contrôle absolu et sans effort',
    badge: 'Recommandé',
    icon: Calendar,
  },
  {
    id: 'weekly',
    title: 'Plusieurs fois par semaine',
    subtitle: 'Noter mes dépenses tous les deux ou trois jours par blocs',
    icon: Clock,
  },
  {
    id: 'occasional',
    title: 'De temps en temps',
    subtitle: 'Faire le point le week-end ou lors des moments clés',
    icon: Sparkles,
  },
];

export function Onboarding({ userName, onComplete }: OnboardingProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedCountry, setSelectedCountry] = useState<string>('Congo-Brazzaville');
  const [countrySearch, setCountrySearch] = useState<string>('');
  const [selectedGoal, setSelectedGoal] = useState<string>('Comprendre où va mon argent');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('Tous les jours');

  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase().trim())
  );

  const handleNext = () => {
    if (step < 4) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleFinish = () => {
    onComplete({
      country: selectedCountry,
      mainGoal: selectedGoal,
      trackingFrequency: selectedFrequency,
    });
  };

  const selectedCountryObj = COUNTRIES.find((c) => c.name === selectedCountry) || {
    name: selectedCountry,
    flag: '🌍',
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] flex flex-col justify-between py-6 sm:py-10 px-4 sm:px-6">
      {/* Top Brand Bar & Progress */}
      <header className="max-w-xl w-full mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Eye className="w-6 h-6 text-emerald-600 stroke-[2.4] shrink-0" />
            <span className="font-extrabold text-gray-900 tracking-tight text-lg leading-none">
              TalaMbongo
            </span>
          </div>
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full">
            {step <= 3 ? `Étape ${step} sur 3` : 'Configuration terminée'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-emerald-600 rounded-full"
            initial={{ width: '33%' }}
            animate={{
              width:
                step === 1 ? '33%' : step === 2 ? '66%' : step === 3 ? '100%' : '100%',
            }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </header>

      {/* Main Content Form Card */}
      <main className="max-w-xl w-full mx-auto my-auto py-6">
        <AnimatePresence mode="wait">
          {/* ÉTAPE 1 : PAYS */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs"
            >
              <div className="mb-6 text-center sm:text-left">
                <span className="text-2xl mb-2 inline-block">🌍</span>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                  Dans quel pays vis-tu ?
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Sélectionne ton pays pour adapter l’application à ton quotidien.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative mb-4">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Rechercher un pays..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200/80 text-sm text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                />
              </div>

              {/* Countries Grid / List */}
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-transparent">
                {filteredCountries.length > 0 ? (
                  filteredCountries.map((c) => {
                    const isSelected = selectedCountry === c.name;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setSelectedCountry(c.name)}
                        className={`w-full p-3 rounded-2xl flex items-center justify-between border transition text-left cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 text-emerald-950'
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/70 text-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl" role="img" aria-label={c.name}>
                            {c.flag}
                          </span>
                          <span className="text-sm font-semibold">{c.name}</span>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-sm text-gray-400">
                    Aucun pays correspondant à votre recherche.
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!selectedCountry}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  Continuer
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ÉTAPE 2 : OBJECTIF PRINCIPAL */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs"
            >
              <div className="mb-6 text-center sm:text-left">
                <span className="text-2xl mb-2 inline-block">🎯</span>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                  Quel est ton objectif principal ?
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Choisis ce qui compte le plus pour toi en ce moment.
                </p>
              </div>

              {/* 4 Choices */}
              <div className="space-y-2.5">
                {GOALS.map((goal) => {
                  const isSelected = selectedGoal === goal.title;
                  const Icon = goal.icon;
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setSelectedGoal(goal.title)}
                      className={`w-full p-4 rounded-2xl flex items-center justify-between border transition text-left cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/70'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-gray-900">{goal.title}</h2>
                          <p className="text-xs text-gray-500 mt-0.5">{goal.subtitle}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 ml-2">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Bottom Navigation */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2.5 rounded-2xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-semibold text-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  Continuer
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ÉTAPE 3 : FRÉQUENCE DE SUIVI */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs"
            >
              <div className="mb-6 text-center sm:text-left">
                <span className="text-2xl mb-2 inline-block">⏱️</span>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                  À quelle fréquence prévois-tu de noter tes dépenses ?
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Il n’y a pas de mauvaise réponse, c’est selon ton rythme.
                </p>
              </div>

              {/* 3 Choices */}
              <div className="space-y-3">
                {FREQUENCIES.map((freq) => {
                  const isSelected = selectedFrequency === freq.title;
                  const Icon = freq.icon;
                  return (
                    <button
                      key={freq.id}
                      type="button"
                      onClick={() => setSelectedFrequency(freq.title)}
                      className={`w-full p-4 rounded-2xl flex items-center justify-between border transition text-left cursor-pointer relative ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/70'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-gray-900">{freq.title}</h2>
                            {freq.badge && (
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800">
                                {freq.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{freq.subtitle}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 ml-2">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Bottom Navigation */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2.5 rounded-2xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-semibold text-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  Continuer
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ÉCRAN DE CONFIRMATION : TOUT EST PRÊT 🎉 */}
          {step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs text-center"
            >
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Tout est prêt 🎉
              </h1>
              <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
                Bienvenue sur TalaMbongo, {userName.split(' ')[0]} ! Ton espace personnel est configuré. Tu peux désormais noter et comprendre tes dépenses en toute clarté.
              </p>

              {/* Recap Box */}
              <div className="mt-6 p-4 rounded-2xl bg-[#fafbfc] border border-gray-100 text-left space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Pays sélectionné</span>
                  <span className="font-bold text-gray-900 flex items-center gap-1.5">
                    <span>{selectedCountryObj.flag}</span>
                    <span>{selectedCountryObj.name}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Objectif</span>
                  <span className="font-bold text-gray-900">{selectedGoal}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Fréquence</span>
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {selectedFrequency}
                  </span>
                </div>
              </div>

              {/* Action Button to Dashboard */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleFinish}
                  className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm transition shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  Accéder à mon tableau de bord
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer hint */}
      <footer className="max-w-xl w-full mx-auto text-center text-xs text-gray-400">
        TalaMbongo • Vois où va ton argent.
      </footer>
    </div>
  );
}
