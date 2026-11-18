import React from 'react';
import { PlusCircle, CalendarDays, LineChart } from 'lucide-react';
import { motion } from 'motion/react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      number: '01',
      title: 'Enregistre',
      description: 'Ajoute rapidement tes dépenses au quotidien.',
      icon: PlusCircle,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    {
      number: '02',
      title: 'Observe',
      description: 'Visualise où va ton argent grâce au calendrier et aux statistiques.',
      icon: CalendarDays,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    {
      number: '03',
      title: 'Comprends',
      description: 'Analyse tes habitudes et découvre les dépenses qui prennent le plus de place.',
      icon: LineChart,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
  ];

  return (
    <section id="how-it-works-section" className="py-16 sm:py-20 bg-white border-y border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Comment fonctionne TalaMbongo
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-500">
            Une méthode simple et sans friction pour reprendre le contrôle de ton budget.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="relative rounded-2xl p-6 sm:p-8 bg-[#fafbfc] border border-gray-100 hover:border-emerald-200 transition-all group"
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-bold tracking-wider text-emerald-600 uppercase bg-emerald-50 px-2.5 py-1 rounded-full">
                    Étape {step.number}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-emerald-700 shadow-xs group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5 stroke-[2]" />
                  </div>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                  {step.number} — {step.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed font-normal">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
