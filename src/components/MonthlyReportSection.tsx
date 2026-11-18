import React from 'react';
import { PieChart, TrendingDown, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export const MonthlyReportSection: React.FC = () => {
  const now = new Date();
  const monthName = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const formattedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const breakdown = [
    { name: 'Alimentation', amount: '65 000 FCFA', percentage: 34.8, color: 'bg-emerald-600', text: 'text-emerald-700', bgLight: 'bg-emerald-50' },
    { name: 'Autres', amount: '54 500 FCFA', percentage: 29.2, color: 'bg-amber-500', text: 'text-amber-700', bgLight: 'bg-amber-50' },
    { name: 'Transport', amount: '42 000 FCFA', percentage: 22.5, color: 'bg-sky-500', text: 'text-sky-700', bgLight: 'bg-sky-50' },
    { name: 'Loisirs', amount: '25 000 FCFA', percentage: 13.5, color: 'bg-rose-500', text: 'text-rose-700', bgLight: 'bg-rose-50' },
  ];

  return (
    <section id="monthly-report-section" className="py-16 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-3 border border-emerald-100">
            <PieChart className="w-3.5 h-3.5 text-emerald-600" />
            <span>Synthèse intelligente</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            À la fin du mois, tout devient plus clair.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-gray-600 font-normal">
            Plus de calculs fastidieux. TalaMbongo classe tes dépenses et t'offre une vision limpide en un coup d'œil.
          </p>
        </div>

        {/* Monthly Report UI Card */}
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl bg-[#fafbfc] border border-gray-100 p-6 sm:p-9 shadow-xs space-y-7"
          >
            {/* Header of Report Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-gray-200/70">
              <div>
                <span className="text-xs font-bold tracking-wider uppercase text-emerald-600">
                  Bilan mensuel
                </span>
                <h3 className="text-2xl font-black text-gray-900 mt-1 capitalize">{formattedMonthName}</h3>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs text-gray-400 font-medium block">Total dépensé</span>
                <span className="text-2xl sm:text-3xl font-black text-gray-900">
                  186 500 FCFA
                </span>
              </div>
            </div>

            {/* Visual Progress Bar (Multi-Segment) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                <span>Répartition par catégorie</span>
                <span>100% analysé</span>
              </div>

              {/* High-contrast multi-color bar */}
              <div className="w-full h-3.5 rounded-full bg-gray-100 flex overflow-hidden p-0.5 gap-0.5">
                <div className="h-full bg-emerald-600 rounded-l-full" style={{ width: '34.8%' }} title="Alimentation: 34.8%" />
                <div className="h-full bg-amber-500" style={{ width: '29.2%' }} title="Autres: 29.2%" />
                <div className="h-full bg-sky-500" style={{ width: '22.5%' }} title="Transport: 22.5%" />
                <div className="h-full bg-rose-500 rounded-r-full" style={{ width: '13.5%' }} title="Loisirs: 13.5%" />
              </div>
            </div>

            {/* Clean Category Rows */}
            <div className="space-y-3 pt-2">
              {breakdown.map((cat) => (
                <div
                  key={cat.name}
                  className="p-4 rounded-2xl bg-white border border-gray-100/90 flex items-center justify-between hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${cat.color}`} />
                    <span className="text-sm sm:text-base font-semibold text-gray-900">
                      {cat.name}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${cat.bgLight} ${cat.text}`}>
                      {cat.percentage}%
                    </span>
                  </div>
                  <span className="text-sm sm:text-base font-bold text-gray-900">
                    {cat.amount}
                  </span>
                </div>
              ))}
            </div>

            {/* Key Takeaway Insight Pill */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100/80 flex items-start gap-3 text-xs text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-950">L'alimentation représente le poste principal</p>
                <p className="text-emerald-800/90 mt-0.5">
                  65 000 FCFA dépensés en alimentation, soit 34.8% de tes sorties totales.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
