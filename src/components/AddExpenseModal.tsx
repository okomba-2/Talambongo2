import React, { useState, useEffect } from 'react';
import { X, Check, Utensils, Bus, Receipt, Wifi, ShoppingBag, Sparkles, GraduationCap, MoreHorizontal } from 'lucide-react';
import { Expense, ExpenseCategory, ExpenseMoment, SupportedCurrency } from '../types';
import { CATEGORIES } from '../data/initialData';
import { SUPPORTED_CURRENCIES } from '../utils/currency';

// Date du jour détectée automatiquement depuis l'appareil
const getDeviceTodayDateStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  defaultDate?: string;
  currency?: SupportedCurrency;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  defaultDate,
  currency = 'XOF',
}) => {
  const [amount, setAmount] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<ExpenseCategory>('Alimentation');
  const [moment, setMoment] = useState<ExpenseMoment>('Après-midi');
  const [date, setDate] = useState<string>(() => defaultDate || getDeviceTodayDateStr());
  const [note, setNote] = useState<string>('');

  const currencyConfig = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.XOF;

  // Synchronise automatiquement la date à chaque ouverture du formulaire
  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate || getDeviceTodayDateStr());
    }
  }, [isOpen, defaultDate]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let numAmount: number;

    if (currency === 'EUR') {
      const cleanStr = amount.replace(',', '.').trim();
      numAmount = parseFloat(cleanStr);
      if (isNaN(numAmount) || numAmount <= 0) return;
      numAmount = Math.round(numAmount * 100) / 100;
    } else {
      numAmount = parseInt(amount.replace(/\D/g, ''), 10);
      if (isNaN(numAmount) || numAmount <= 0) return;
    }

    onAdd({
      title: title.trim() || category,
      amount: numAmount,
      currency,
      category,
      moment,
      date,
      note: note.trim() || undefined,
    });

    // Reset fields
    setAmount('');
    setTitle('');
    setNote('');
    onClose();
  };

  const getCategoryIcon = (catName: ExpenseCategory) => {
    switch (catName) {
      case 'Alimentation': return <Utensils className="w-4 h-4" />;
      case 'Transport': return <Bus className="w-4 h-4" />;
      case 'Factures': return <Receipt className="w-4 h-4" />;
      case 'Téléphone / Internet': return <Wifi className="w-4 h-4" />;
      case 'Achats': return <ShoppingBag className="w-4 h-4" />;
      case 'Loisirs': return <Sparkles className="w-4 h-4" />;
      case 'Études': return <GraduationCap className="w-4 h-4" />;
      default: return <MoreHorizontal className="w-4 h-4" />;
    }
  };

  return (
    <div
      id="add-expense-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="w-full max-w-lg rounded-t-[32px] sm:rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-gray-100 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-250">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">Ajouter une dépense</h2>
            <p className="text-xs text-gray-400">Enregistre rapidement tes sorties d'argent</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer la fenêtre d'ajout"
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 pt-4">
          {/* Montant (Hero input) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 block">
              Montant
            </label>
            <div className="relative flex items-center">
              <input
                id="expense-amount-input"
                type="number"
                required
                min={currency === 'EUR' ? '0.01' : '1'}
                step={currency === 'EUR' ? 'any' : '1'}
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={currency === 'EUR' ? '0.00' : '0'}
                className="w-full pl-4 pr-16 py-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-2xl sm:text-3xl font-black text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
              />
              <span className="absolute right-4 text-sm font-bold text-emerald-800">
                {currencyConfig.symbol}
              </span>
            </div>
          </div>

          {/* Description / Titre court */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 block">
              Description (facultative)
            </label>
            <input
              id="expense-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Taxi retour, Déjeuner garba, Supermarché..."
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
            />
          </div>

          {/* Catégories Grid */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-600 block">
              Catégorie
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setCategory(cat.name)}
                    className={`p-2.5 rounded-xl text-left flex items-center gap-2 border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    <span className={isSelected ? 'text-white' : 'text-emerald-600'}>
                      {getCategoryIcon(cat.name)}
                    </span>
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Moment (Matin, Après-midi, Soir) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-600 block">
              Moment de la journée
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Matin', 'Après-midi', 'Soir'] as ExpenseMoment[]).map((m) => {
                const isSelected = moment === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMoment(m)}
                    className={`py-2.5 px-3 rounded-xl text-center text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 block">
              Date
            </label>
            <input
              id="expense-date-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
            />
          </div>

          {/* Note facultative */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 block">
              Note (facultative)
            </label>
            <textarea
              id="expense-note-input"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Détail utile pour te souvenir de cette dépense..."
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            id="expense-save-btn"
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-700/20 transition-all active:scale-[0.99] cursor-pointer"
          >
            Enregistrer
          </button>
        </form>
      </div>
    </div>
  );
};
