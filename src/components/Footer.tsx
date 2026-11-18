import React, { useState } from 'react';
import { Eye, X } from 'lucide-react';

export const Footer: React.FC = () => {
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | 'contact' | null>(null);

  return (
    <footer id="main-footer" className="py-12 bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
        {/* Brand and Slogan */}
        <div className="space-y-1">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Eye className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold text-gray-900 text-lg">TalaMbongo</span>
          </div>
          <p className="text-xs text-gray-500 font-medium">« Vois où va ton argent. »</p>
        </div>

        {/* Minimal Links */}
        <div className="flex items-center gap-6 text-xs text-gray-500 font-medium">
          <button
            onClick={() => setActiveModal('privacy')}
            className="hover:text-emerald-700 transition cursor-pointer"
          >
            Confidentialité
          </button>
          <button
            onClick={() => setActiveModal('terms')}
            className="hover:text-emerald-700 transition cursor-pointer"
          >
            Conditions
          </button>
          <button
            onClick={() => setActiveModal('contact')}
            className="hover:text-emerald-700 transition cursor-pointer"
          >
            Contact
          </button>
        </div>

        {/* Copyright notice */}
        <div className="text-[11px] text-gray-400">
          © 2026 TalaMbongo. Tous droits réservés.
        </div>
      </div>

      {/* Lightweight info modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                {activeModal === 'privacy' && 'Politique de confidentialité'}
                {activeModal === 'terms' && 'Conditions d’utilisation'}
                {activeModal === 'contact' && 'Nous contacter'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs sm:text-sm text-gray-600 space-y-2.5 leading-relaxed max-h-72 overflow-y-auto">
              {activeModal === 'privacy' && (
                <>
                  <p>TalaMbongo respecte scrupuleusement la confidentialité de tes données financières personnelles.</p>
                  <p>Toutes les dépenses enregistrées restent privées et ne sont jamais vendues ou partagées avec des organismes de crédit tiers.</p>
                </>
              )}
              {activeModal === 'terms' && (
                <>
                  <p>TalaMbongo est un outil logiciel de suivi personnel des dépenses quotidiennes.</p>
                  <p>L'essai gratuit dure 7 jours sans carte bancaire requise. L'abonnement Premium est résiliable à tout instant.</p>
                  <p>TalaMbongo ne se substitue pas à des conseils financiers certifiés ou comptables agréés.</p>
                </>
              )}
              {activeModal === 'contact' && (
                <>
                  <p>Une question, un retour ou besoin d'assistance ? L'équipe TalaMbongo est à ton écoute :</p>
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-900 font-semibold text-xs">
                    support@talambongo.app
                  </div>
                  <p>Disponibilité 7j/7 pour t'aider dans la gestion de tes finances.</p>
                </>
              )}
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </footer>
  );
};
