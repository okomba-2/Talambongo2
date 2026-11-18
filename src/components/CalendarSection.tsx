import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { formatFCFA } from '../data/initialData';

export const CalendarSection: React.FC = () => {
  // Calendar interactive state for September 2026
  const [selectedDay, setSelectedDay] = useState<number>(15);

  // Fictional day breakdown data matching the prompt
  const calendarData: Record<number, { amount: number; count: number; items: { title: string; amount: number; moment: string; category: string }[] }> = {
    1: {
      amount: 43500,
      count: 2,
      items: [
        { title: 'Recharge Internet Box', amount: 25000, moment: 'Matin', category: 'Téléphone / Internet' },
        { title: 'Courses marché début de mois', amount: 18500, moment: 'Après-midi', category: 'Alimentation' },
      ],
    },
    4: {
      amount: 7000,
      count: 2,
      items: [
        { title: 'Essence moto / taxi', amount: 5000, moment: 'Matin', category: 'Transport' },
        { title: 'Goûter et café', amount: 2000, moment: 'Après-midi', category: 'Alimentation' },
      ],
    },
    6: {
      amount: 7500,
      count: 1,
      items: [
        { title: 'Sortie cinéma et encas', amount: 7500, moment: 'Soir', category: 'Loisirs' },
      ],
    },
    8: {
      amount: 17500,
      count: 2,
      items: [
        { title: 'Facture électricité', amount: 14500, moment: 'Matin', category: 'Factures' },
        { title: 'Déjeuner collègues', amount: 3000, moment: 'Après-midi', category: 'Alimentation' },
      ],
    },
    10: {
      amount: 19500,
      count: 2,
      items: [
        { title: 'Pass transport hebdomadaire', amount: 8500, moment: 'Matin', category: 'Transport' },
        { title: 'Supermarché ravitaillement', amount: 11000, moment: 'Soir', category: 'Alimentation' },
      ],
    },
    12: {
      amount: 12500,
      count: 1,
      items: [
        { title: 'Restaurant entre amis', amount: 12500, moment: 'Soir', category: 'Loisirs' },
      ],
    },
    15: {
      amount: 8000,
      count: 3,
      items: [
        { title: 'Transport', amount: 1500, moment: 'Matin', category: 'Transport' },
        { title: 'Déjeuner', amount: 2500, moment: 'Après-midi', category: 'Alimentation' },
        { title: 'Courses', amount: 4000, moment: 'Soir', category: 'Alimentation' },
      ],
    },
    17: {
      amount: 16000,
      count: 2,
      items: [
        { title: 'Taxi express gare', amount: 12000, moment: 'Après-midi', category: 'Transport' },
        { title: 'Dîner à emporter', amount: 4000, moment: 'Soir', category: 'Alimentation' },
      ],
    },
    18: {
      amount: 5500,
      count: 2,
      items: [
        { title: 'Transport matinal', amount: 2000, moment: 'Matin', category: 'Transport' },
        { title: 'Déjeuner d’équipe', amount: 3500, moment: 'Après-midi', category: 'Alimentation' },
      ],
    },
    21: {
      amount: 15000,
      count: 2,
      items: [
        { title: 'Recharge mobile forfait', amount: 5000, moment: 'Matin', category: 'Téléphone / Internet' },
        { title: 'Pharmacie & vitamines', amount: 10000, moment: 'Après-midi', category: 'Autres' },
      ],
    },
    24: {
      amount: 13500,
      count: 2,
      items: [
        { title: 'Abonnement musique', amount: 5000, moment: 'Matin', category: 'Loisirs' },
        { title: 'Courses fraîches', amount: 8500, moment: 'Soir', category: 'Alimentation' },
      ],
    },
    27: {
      amount: 21000,
      count: 2,
      items: [
        { title: 'Déplacement professionnel', amount: 13000, moment: 'Après-midi', category: 'Transport' },
        { title: 'Dîner en ville', amount: 8000, moment: 'Soir', category: 'Alimentation' },
      ],
    },
  };

  // Calcul dynamique du mois actuel de l'appareil
  const now = new Date();
  const currentMonthName = useMemo(() => {
    const name = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, []);
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysInMonth = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);
  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const selectedData = calendarData[selectedDay];

  return (
    <section id="calendar-section" className="py-16 sm:py-24 bg-[#fafbfc]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-3 border border-emerald-100">
            <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>Vue temporelle intuitive</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Toutes tes dépenses, jour après jour.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-gray-600 font-normal">
            Retrouve facilement ce que tu as dépensé chaque jour et visualise ton évolution au fil du mois.
          </p>
        </div>

        {/* Interactive Calendar Showcase Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Calendar Grid Card */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-7 border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold text-gray-900">{currentMonthName}</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">
                  Mois actif
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium">Clique sur un jour avec indicateur</p>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center">
              {weekDays.map((d) => (
                <span key={d} className="text-xs font-semibold text-gray-400 py-1">
                  {d}
                </span>
              ))}
            </div>

            {/* Calendar Days Matrix (Offset 1 for Tuesday start) */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {/* Empty placeholder for Monday before Sept 1st */}
              <div className="aspect-square rounded-xl bg-gray-50/30 opacity-20" />

              {daysInMonth.map((day) => {
                const hasExpense = !!calendarData[day];
                const isSelected = selectedDay === day;
                const info = calendarData[day];

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`aspect-square relative rounded-xl sm:rounded-2xl p-1 flex flex-col items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20 ring-2 ring-emerald-600 ring-offset-2'
                        : hasExpense
                        ? 'bg-emerald-50/80 text-emerald-950 border border-emerald-100/70 hover:bg-emerald-100/80'
                        : 'bg-gray-50/50 text-gray-500 hover:bg-gray-100/70'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-semibold self-start ml-1 mt-0.5">
                      {day}
                    </span>

                    {hasExpense && (
                      <div className="w-full text-center pb-0.5">
                        <span
                          className={`text-[9px] sm:text-[10px] font-bold block truncate px-0.5 ${
                            isSelected ? 'text-emerald-100' : 'text-emerald-700'
                          }`}
                        >
                          {info.amount >= 1000 ? `${Math.round(info.amount / 1000)}k` : info.amount}
                        </span>
                      </div>
                    )}

                    {!hasExpense && (
                      <span className="w-1 h-1 rounded-full bg-gray-200 mb-1" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Jour avec dépenses</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" />
                <span>Aucune dépense</span>
              </div>
            </div>
          </div>

          {/* Right Selected Day Detail Panel */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div>
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                  Détail du jour sélectionné
                </p>
                <h3 className="text-xl font-extrabold text-gray-900 mt-0.5">
                  {selectedDay} septembre 2026
                </h3>
              </div>
              {selectedData && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">Total journée</p>
                  <p className="text-lg font-black text-gray-900">
                    {formatFCFA(selectedData.amount)}
                  </p>
                </div>
              )}
            </div>

            {selectedData ? (
              <motion.div
                key={selectedDay}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-3"
              >
                {selectedData.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-[#fafbfc] border border-gray-100/90 flex items-center justify-between hover:border-emerald-200 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">{item.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                          {item.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>{item.moment}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {formatFCFA(item.amount)}
                    </span>
                  </div>
                ))}

                <div className="pt-3 flex items-center justify-between text-xs text-emerald-700 bg-emerald-50/70 p-3 rounded-xl border border-emerald-100/70">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{selectedData.count} dépenses enregistrées</span>
                  </div>
                  <span className="font-bold">{formatFCFA(selectedData.amount)}</span>
                </div>
              </motion.div>
            ) : (
              <div className="py-12 text-center text-gray-400 space-y-2">
                <p className="text-sm">Aucune dépense enregistrée le {selectedDay} septembre.</p>
                <p className="text-xs text-gray-400">Sélectionne un autre jour (ex: 15 sep) pour voir ses détails.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
