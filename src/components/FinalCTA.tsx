import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface FinalCTAProps {
  onStart: () => void;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ onStart }) => {
  return (
    <section id="final-cta-section" className="py-20 sm:py-28 bg-white text-center relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="rounded-[36px] bg-gradient-to-b from-[#f0fdf4] to-[#ecfdf5] border border-emerald-100 p-8 sm:p-14 space-y-6"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-700/20">
            <Sparkles className="w-6 h-6" />
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight">
            Commence à voir où va ton argent.
          </h2>

          <p className="text-base sm:text-lg text-gray-600 max-w-xl mx-auto font-normal">
            7 jours pour découvrir TalaMbongo et mieux comprendre tes dépenses.
          </p>

          <div className="pt-2">
            <button
              id="final-cta-btn"
              onClick={onStart}
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-700/25 hover:shadow-xl transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Commencer gratuitement</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-gray-400">
            Sans carte bancaire • Configuration en 30 secondes
          </p>
        </motion.div>
      </div>
    </section>
  );
};
