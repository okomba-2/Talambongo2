import React from 'react';
import { ArrowRight, Sparkles, TrendingDown, Calendar, PieChart } from 'lucide-react';
import { motion } from 'motion/react';

interface HeroProps {
  onStart: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStart }) => {
  const currentMonthName = React.useMemo(() => {
    const d = new Date();
    const name = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, []);

  return (
    <section id="hero-section" className="relative pt-10 pb-16 sm:pt-16 sm:pb-24 overflow-hidden">
      {/* Soft ambient background tint */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-emerald-50/60 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100/80 text-xs sm:text-sm font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Gestion personnelle des dépenses moderne & accessible</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.15]"
            >
              Vois où va ton argent.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-lg text-gray-600 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal"
            >
              TalaMbongo t'aide à suivre tes dépenses, comprendre tes habitudes et mieux gérer ton argent, simplement.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
            >
              <button
                id="hero-start-btn"
                onClick={onStart}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base shadow-md shadow-emerald-700/20 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
              >
                <span>Commencer gratuitement</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>7 jours gratuits</span>
                <span className="text-gray-300">•</span>
                <span>Sans engagement</span>
              </div>
            </motion.div>
          </div>

          {/* Right Visual Column: Modern Smartphone / Card UI Mockup */}
          <div className="lg:col-span-6 flex justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full max-w-[360px] sm:max-w-[390px] rounded-[38px] bg-gray-900 p-3 sm:p-3.5 shadow-2xl ring-1 ring-gray-900/10"
            >
              {/* Phone Inner Bezel & Screen */}
              <div className="w-full rounded-[30px] bg-white overflow-hidden border border-gray-100 flex flex-col text-left">
                {/* Mobile Status Bar */}
                <div className="px-6 pt-3 pb-2 flex items-center justify-between text-[11px] font-semibold text-gray-400 border-b border-gray-50">
                  <span>9:41</span>
                  <div className="w-16 h-3.5 bg-gray-100 rounded-full mx-auto" />
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>4G</span>
                  </div>
                </div>

                {/* Dashboard Header */}
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-gray-400 font-medium capitalize">{currentMonthName}</p>
                      <h3 className="text-sm font-bold text-gray-900">Aperçu TalaMbongo</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                      À jour
                    </span>
                  </div>

                  {/* Hero Metric Card: Total dépensé */}
                  <div className="p-4 rounded-2xl bg-[#f0fdf4] border border-emerald-100 text-left">
                    <div className="flex items-center justify-between text-xs font-medium text-emerald-800">
                      <span>Total dépensé</span>
                      <TrendingDown className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-2xl font-extrabold text-gray-900 mt-1">186 500 FCFA</p>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Budget maîtrisé cette semaine</span>
                    </div>
                  </div>

                  {/* Mini Calendar Row (Mon to Sun) */}
                  <div className="rounded-2xl border border-gray-100 p-3 bg-white space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-emerald-600" /> Semaine 38
                      </span>
                      <span className="text-emerald-600 font-semibold">15 sep. sélectionné</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {[
                        { day: 'Lun', num: '14', amount: '—' },
                        { day: 'Mar', num: '15', amount: '8k', active: true },
                        { day: 'Mer', num: '16', amount: '—' },
                        { day: 'Jeu', num: '17', amount: '16k' },
                        { day: 'Ven', num: '18', amount: '5.5k' },
                        { day: 'Sam', num: '19', amount: '—' },
                        { day: 'Dim', num: '20', amount: '—' },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className={`py-1.5 rounded-lg flex flex-col items-center justify-center transition-colors ${
                            item.active
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'bg-gray-50/70 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-[9px] opacity-80">{item.day}</span>
                          <span className="text-xs font-semibold">{item.num}</span>
                          <span
                            className={`text-[9px] mt-0.5 ${
                              item.active ? 'text-emerald-100' : 'text-emerald-600 font-medium'
                            }`}
                          >
                            {item.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Categories Breakdown Preview */}
                  <div className="rounded-2xl border border-gray-100 p-3 bg-white space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700">
                      <span className="flex items-center gap-1">
                        <PieChart className="w-3 h-3 text-emerald-600" />
                        Catégories principales
                      </span>
                      <span className="text-gray-400">Septembre</span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[11px] font-medium mb-1">
                          <span className="text-gray-700">Alimentation</span>
                          <span className="font-semibold text-gray-900">65 000 FCFA (35%)</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-600 rounded-full w-[35%]" />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-medium mb-1">
                          <span className="text-gray-700">Transport</span>
                          <span className="font-semibold text-gray-900">42 000 FCFA (23%)</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-500 rounded-full w-[23%]" />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-medium mb-1">
                          <span className="text-gray-700">Autres & Factures</span>
                          <span className="font-semibold text-gray-900">79 500 FCFA (42%)</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full w-[42%]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Minimal Sparkline Curve preview */}
                  <div className="p-2.5 rounded-xl bg-gray-50 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-gray-500 font-medium">Tendance du mois</span>
                    <svg className="w-28 h-6 text-emerald-600" viewBox="0 0 100 24" fill="none">
                      <path
                        d="M0 18 Q 20 4, 35 14 T 65 8 T 100 16"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="text-[11px] font-bold text-emerald-600">-12% vs août</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
