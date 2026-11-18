import React, { useState } from 'react';
import { X, Download, Eye, FileText, CheckCircle2, TrendingUp, Award, Calendar, ArrowRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Expense, ExpenseCategory, SupportedCurrency } from '../types';
import { formatCurrency, convertAmount, SUPPORTED_CURRENCIES } from '../utils/currency';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: Expense[];
  monthName: string;
  totalAmount: number;
  userName: string;
  userCountry?: string;
  avgDaily?: number;
  maxExpenseTitle?: string;
  maxExpenseAmount?: number;
  currency?: SupportedCurrency;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  expenses,
  monthName,
  totalAmount,
  userName,
  userCountry = 'Congo-Brazzaville',
  avgDaily,
  maxExpenseTitle,
  maxExpenseAmount,
  currency = 'XOF',
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const currencyConfig = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.XOF;

  if (!isOpen) return null;

  // Calcul direct et certifié sur les données réelles converties dans la devise active
  const categoryTotals: Record<string, number> = {};
  let calculatedMaxExp: Expense | null = null;
  let calculatedMaxConvertedAmount = 0;

  // Sort chronological
  const sortedExpenses = [...expenses].sort((a, b) => a.date.localeCompare(b.date));

  for (const e of expenses) {
    const converted = convertAmount(e.amount, e.currency, currency);
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + converted;
    if (!calculatedMaxExp || converted > calculatedMaxConvertedAmount) {
      calculatedMaxExp = e;
      calculatedMaxConvertedAmount = converted;
    }
  }

  const convertedTotalAmount = totalAmount > 0
    ? totalAmount
    : expenses.reduce((acc, curr) => acc + convertAmount(curr.amount, curr.currency, currency), 0);

  const finalAvgDaily = avgDaily ?? (expenses.length > 0 ? Math.round(convertedTotalAmount / 30) : 0);
  const finalMaxTitle = maxExpenseTitle || (calculatedMaxExp ? (calculatedMaxExp as Expense).title : 'Aucune');
  const finalMaxAmount = maxExpenseAmount || calculatedMaxConvertedAmount;

  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([cat, val]) => ({
      category: cat,
      amount: val,
      percentage: convertedTotalAmount > 0 ? Math.round((val / convertedTotalAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Catégorie dans laquelle l'utilisateur a le plus dépensé
  const mainCategoryItem = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;
  const mainCategory = mainCategoryItem ? mainCategoryItem.category : 'Aucune';
  const mainCategoryAmount = mainCategoryItem ? mainCategoryItem.amount : 0;
  const mainCategoryPercentage = mainCategoryItem ? mainCategoryItem.percentage : 0;

  // Répartition et évolution des dépenses sur la période (découpée en 4 tranches temporelles)
  const periodEvolution = [
    { label: 'Jours 01 à 07', filter: (d: number) => d >= 1 && d <= 7 },
    { label: 'Jours 08 à 14', filter: (d: number) => d >= 8 && d <= 14 },
    { label: 'Jours 15 à 21', filter: (d: number) => d >= 15 && d <= 21 },
    { label: 'Jours 22 à fin', filter: (d: number) => d >= 22 },
  ].map((t) => {
    let trancheTotal = 0;
    let trancheCount = 0;
    for (const e of expenses) {
      const dayNum = parseInt(e.date.split('-')[2], 10);
      if (!isNaN(dayNum) && t.filter(dayNum)) {
        trancheTotal += convertAmount(e.amount, e.currency, currency);
        trancheCount += 1;
      }
    }
    return {
      label: t.label,
      amount: trancheTotal,
      count: trancheCount,
      percentage: convertedTotalAmount > 0 ? Math.round((trancheTotal / convertedTotalAmount) * 100) : 0,
    };
  });

  const todayStr = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const handleDownloadPdf = () => {
    setIsGenerating(true);
    setDownloadSuccess(false);

    try {
      // Sécurisation stricte du texte pour le moteur jsPDF (police Type 1 Helvetica) :
      // Remplace tout espace insécable ou espace fine (ex: \u202F généré par toLocaleString français)
      // par un espace standard ASCII (' ') pour éliminer tout risque de slash '/' ou barre
      // traversant les montants ou les libellés dans le fichier PDF exporté.
      const cleanPdfText = (val: string | number): string => {
        return String(val).replace(/[^\S\r\n]/g, ' ');
      };

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 14;
      const contentWidth = pageWidth - margin * 2; // 182 mm

      // --- EN-TÊTE PAGE 1 ---
      doc.setFillColor(240, 253, 244); // emerald-50
      doc.setDrawColor(167, 243, 208); // emerald-200
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, 12, contentWidth, 23, 2.5, 2.5, 'FD');

      // Logo TalaMbongo TM
      doc.setFillColor(5, 150, 105); // emerald-600
      doc.roundedRect(margin + 4, 15.5, 16, 16, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('TM', margin + 8.5, 26);

      // Nom de l'app & Slogan
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(6, 78, 59);
      doc.text('TalaMbongo', margin + 24, 22.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('« Vois où va ton argent. »', margin + 24, 28);

      // Titre & Période du Bilan
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(5, 150, 105);
      doc.text('BILAN FINANCIER CERTIFIÉ', pageWidth - margin - 4, 19.5, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Période : ${monthName}`, pageWidth - margin - 4, 25.5, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Émis le ${todayStr}`, pageWidth - margin - 4, 30.5, { align: 'right' });

      // --- BANDEAU MÉTADONNÉES (Nom utilisateur, Pays, Date génération) ---
      let currentY = 39;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, contentWidth, 13, 2, 2, 'FD');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('UTILISATEUR', margin + 5, currentY + 5);
      doc.text('PAYS', margin + 62, currentY + 5);
      doc.text('DEVISE', margin + 115, currentY + 5);
      doc.text('DATE DE GÉNÉRATION', margin + 145, currentY + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(cleanPdfText(userName), margin + 5, currentY + 10);
      doc.text(cleanPdfText(userCountry), margin + 62, currentY + 10);
      doc.text(cleanPdfText(`${currencyConfig.code} (${currencyConfig.symbol})`), margin + 115, currentY + 10);
      doc.text(cleanPdfText(todayStr), margin + 145, currentY + 10);

      // --- 3 CARTES CLÉS (Total, Nombre, Moyenne quotidienne) ---
      currentY = 56;
      const cardWidth = (contentWidth - 6) / 3;
      const cardHeight = 20;

      // Carte 1 : Total des dépenses
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(margin, currentY, cardWidth, cardHeight, 2, 2, 'FD');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text('TOTAL DES DÉPENSES', margin + 4, currentY + 5.5);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(6, 78, 59);
      doc.text(cleanPdfText(formatCurrency(convertedTotalAmount, currency)), margin + 4, currentY + 14.5);

      // Carte 2 : Nombre total de dépenses
      const card2X = margin + cardWidth + 3;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 2, 2, 'FD');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('NOMBRE TOTAL DE DÉPENSES', card2X + 4, currentY + 5.5);
      doc.setFontSize(12.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(cleanPdfText(`${expenses.length} dépenses`), card2X + 4, currentY + 14.5);

      // Carte 3 : Moyenne par jour
      const card3X = card2X + cardWidth + 3;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(card3X, currentY, cardWidth, cardHeight, 2, 2, 'FD');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('MOYENNE DES DÉPENSES / JOUR', card3X + 4, currentY + 5.5);
      doc.setFontSize(12.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(cleanPdfText(formatCurrency(finalAvgDaily, currency)), card3X + 4, currentY + 14.5);

      // --- 2 CARTES SPÉCIFIQUES : PLUS GROSSE DÉPENSE & CATÉGORIE LA PLUS DÉPENSÉE ---
      currentY = 80;
      const subCardWidth = (contentWidth - 4) / 2;

      // Plus grosse dépense
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(margin, currentY, subCardWidth, 15, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(5, 150, 105);
      doc.text('PLUS GROSSE DÉPENSE DE LA PÉRIODE', margin + 4, currentY + 5);
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const truncMax = finalMaxTitle.length > 25 ? `${finalMaxTitle.slice(0, 23)}...` : finalMaxTitle;
      doc.text(cleanPdfText(`« ${truncMax} »`), margin + 4, currentY + 11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(6, 78, 59);
      doc.text(cleanPdfText(formatCurrency(finalMaxAmount, currency)), margin + subCardWidth - 4, currentY + 11, { align: 'right' });

      // Catégorie la plus dépensée
      const subCard2X = margin + subCardWidth + 4;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(subCard2X, currentY, subCardWidth, 15, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('CATÉGORIE LA PLUS DÉPENSÉE', subCard2X + 4, currentY + 5);
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(cleanPdfText(mainCategory), subCard2X + 4, currentY + 11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(cleanPdfText(`${formatCurrency(mainCategoryAmount, currency)} (${mainCategoryPercentage} %)`), subCard2X + subCardWidth - 4, currentY + 11, { align: 'right' });

      // --- RÉPARTITION DES DÉPENSES PAR CATÉGORIE ---
      currentY = 100;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('RÉPARTITION DES DÉPENSES PAR CATÉGORIE', margin, currentY);

      currentY += 3.5;
      doc.setFillColor(5, 150, 105);
      doc.roundedRect(margin, currentY, contentWidth, 6, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text('Catégorie', margin + 4, currentY + 4.2);
      doc.text(cleanPdfText(`Montant (${currencyConfig.symbol})`), margin + 115, currentY + 4.2);
      doc.text('Part (%)', pageWidth - margin - 4, currentY + 4.2, { align: 'right' });

      currentY += 6;
      categoryBreakdown.forEach((item, index) => {
        const isEven = index % 2 === 0;
        doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
        doc.rect(margin, currentY, contentWidth, 5.5, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(cleanPdfText(item.category), margin + 4, currentY + 4);

        doc.setFont('helvetica', 'bold');
        doc.text(cleanPdfText(formatCurrency(item.amount, currency)), margin + 115, currentY + 4);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text(cleanPdfText(`${item.percentage} %`), pageWidth - margin - 4, currentY + 4, { align: 'right' });

        currentY += 5.5;
      });

      // Ligne de fin tableau catégories
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY, pageWidth - margin, currentY);

      // --- RÉPARTITION ET ÉVOLUTION SUR LA PÉRIODE ---
      currentY += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('RÉPARTITION ET ÉVOLUTION DES DÉPENSES SUR LA PÉRIODE', margin, currentY);

      currentY += 3.5;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, currentY, contentWidth, 6, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Période / Tranche', margin + 4, currentY + 4.2);
      doc.text('Nombre d\'opérations', margin + 65, currentY + 4.2);
      doc.text('Montant total', margin + 115, currentY + 4.2);
      doc.text('Part (%)', pageWidth - margin - 4, currentY + 4.2, { align: 'right' });

      currentY += 6;
      periodEvolution.forEach((tranche, idx) => {
        const isEven = idx % 2 === 0;
        doc.setFillColor(isEven ? 255 : 250, isEven ? 255 : 250, isEven ? 255 : 250);
        doc.rect(margin, currentY, contentWidth, 5.5, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(cleanPdfText(tranche.label), margin + 4, currentY + 4);

        doc.setTextColor(100, 116, 139);
        doc.text(cleanPdfText(`${tranche.count} dépense${tranche.count > 1 ? 's' : ''}`), margin + 65, currentY + 4);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(cleanPdfText(formatCurrency(tranche.amount, currency)), margin + 115, currentY + 4);

        doc.setTextColor(5, 150, 105);
        doc.text(cleanPdfText(`${tranche.percentage} %`), pageWidth - margin - 4, currentY + 4, { align: 'right' });

        currentY += 5.5;
      });

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY, pageWidth - margin, currentY);

      // --- DÉTAIL DES DÉPENSES PAR JOUR (RELEVÉ CHRONOLOGIQUE) ---
      currentY += 7;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('DÉTAIL DES DÉPENSES PAR JOUR (RELEVÉ CHRONOLOGIQUE)', margin, currentY);

      currentY += 3.5;
      const printTableHeader = (y: number) => {
        doc.setFillColor(5, 150, 105);
        doc.roundedRect(margin, y, contentWidth, 6, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text('Date', margin + 3, y + 4.2);
        doc.text('Intitulé de la dépense', margin + 25, y + 4.2);
        doc.text('Moment', margin + 92, y + 4.2);
        doc.text('Catégorie', margin + 120, y + 4.2);
        doc.text(cleanPdfText(`Montant (${currencyConfig.symbol})`), pageWidth - margin - 3, y + 4.2, { align: 'right' });
      };

      printTableHeader(currentY);
      currentY += 6;

      // Impression des lignes chronologiques détaillées (montant converti dans la devise active)
      sortedExpenses.forEach((e, idx) => {
        if (currentY > pageHeight - 20) {
          doc.addPage();
          currentY = 16;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(5, 150, 105);
          doc.text(`TalaMbongo — Détail des dépenses par jour (suite)`, margin, currentY);
          currentY += 5;
          printTableHeader(currentY);
          currentY += 6;
        }

        const isEven = idx % 2 === 0;
        doc.setFillColor(isEven ? 255 : 250, isEven ? 255 : 250, isEven ? 255 : 250);
        doc.rect(margin, currentY, contentWidth, 5.5, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(cleanPdfText(e.date), margin + 3, currentY + 4);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        const truncatedTitle = e.title.length > 34 ? `${e.title.slice(0, 32)}...` : e.title;
        doc.text(cleanPdfText(truncatedTitle), margin + 25, currentY + 4);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(cleanPdfText(e.moment || '-'), margin + 92, currentY + 4);

        doc.setTextColor(71, 85, 105);
        doc.text(cleanPdfText(e.category), margin + 120, currentY + 4);

        const expAmount = convertAmount(e.amount, e.currency, currency);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(cleanPdfText(formatCurrency(expAmount, currency)), pageWidth - margin - 3, currentY + 4, { align: 'right' });

        currentY += 5.5;
      });

      // --- PIEDS DE PAGE SUR TOUTES LES PAGES ---
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(209, 250, 229);
        doc.setLineWidth(0.4);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          'TalaMbongo • Bilan financier certifié conforme aux données saisies • Clôture le 3 de chaque mois',
          margin,
          pageHeight - 7.5
        );

        doc.text(`Page ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 7.5, { align: 'right' });
      }

      const safeMonth = monthName.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`TalaMbongo_Bilan_${safeMonth}.pdf`);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4500);
    } catch (err) {
      console.error('Erreur lors de la génération PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      id="pdf-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 overflow-x-hidden overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white p-4 sm:p-7 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto overflow-x-hidden space-y-4 sm:space-y-6">
        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-gray-100 print:hidden">
          {/* Header Title + Close button on mobile top-right */}
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">Bilan Financier Récapitulatif</h3>
                <p className="text-xs text-gray-500 truncate">Document certifié prêt à être téléchargé en PDF</p>
              </div>
            </div>

            {/* Bouton X sur mobile - placé clairement en haut à droite */}
            <button
              id="close-pdf-modal-button-mobile"
              onClick={onClose}
              className="sm:hidden p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer shrink-0"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Actions : Uniquement Télécharger le PDF + Bouton X sur desktop */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              id="download-pdf-button"
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-xs sm:text-sm transition cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span>PDF téléchargé !</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 shrink-0" />
                  <span>{isGenerating ? 'Génération...' : 'Télécharger le PDF'}</span>
                </>
              )}
            </button>

            {/* Bouton X sur desktop */}
            <button
              id="close-pdf-modal-button-desktop"
              onClick={onClose}
              className="hidden sm:inline-flex p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer shrink-0"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success confirmation toast banner */}
        {downloadSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Le bilan financier PDF a été généré et téléchargé sur ton appareil avec succès.</span>
          </div>
        )}

        {/* The Printable Document Preview Area */}
        <div className="p-3.5 sm:p-6 bg-[#fafbfc] border border-gray-100 rounded-2xl space-y-4 sm:space-y-6 text-gray-900 overflow-x-hidden">
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                  <Eye className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-xl tracking-tight text-gray-900">TalaMbongo</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">« Vois où va ton argent. »</p>
            </div>
            <div className="text-left sm:text-right text-xs space-y-0.5 text-gray-500">
              <p className="font-bold text-emerald-700 uppercase tracking-wide text-[11px]">Bilan Financier</p>
              <p className="font-bold text-gray-900 text-sm">{monthName}</p>
              <p className="truncate max-w-xs">Utilisateur : <span className="font-semibold text-gray-800">{userName}</span> ({userCountry})</p>
              <p className="text-[11px] text-gray-400">Date de génération : {todayStr}</p>
            </div>
          </div>

          {/* 3 Cartes de synthèse */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-emerald-200/80 shadow-xs min-w-0">
              <span className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wider">Total dépenses</span>
              <p className="text-xl font-black text-emerald-950 mt-0.5 truncate">{formatCurrency(convertedTotalAmount, currency)}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-gray-200/80 shadow-xs min-w-0">
              <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Nombre total de dépenses</span>
              <p className="text-xl font-black text-gray-900 mt-0.5 truncate">{expenses.length} dépenses</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-gray-200/80 shadow-xs min-w-0">
              <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Moyenne par jour</span>
              <p className="text-xl font-black text-gray-900 mt-0.5 truncate">{formatCurrency(finalAvgDaily, currency)}</p>
            </div>
          </div>

          {/* Points saillants : Plus grosse dépense & Catégorie la plus dépensée */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Plus grosse dépense</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-gray-900 truncate">« {finalMaxTitle} »</span>
                <span className="font-black text-emerald-900 shrink-0">{formatCurrency(finalMaxAmount, currency)}</span>
              </div>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200/80 rounded-xl space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-gray-700 font-bold">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Catégorie la plus dépensée</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-gray-900 truncate">{mainCategory}</span>
                <span className="font-bold text-gray-900 shrink-0">
                  {formatCurrency(mainCategoryAmount, currency)} <span className="text-emerald-600 font-bold">({mainCategoryPercentage}%)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Répartition par catégorie */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Répartition des dépenses par catégorie
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {categoryBreakdown.map((item) => (
                <div key={item.category} className="p-2.5 bg-white rounded-lg border border-gray-100 flex justify-between items-center gap-2 min-w-0">
                  <span className="text-gray-700 font-medium truncate">{item.category}</span>
                  <div className="text-right shrink-0 flex items-center gap-1.5">
                    <span className="font-bold text-gray-900">{formatCurrency(item.amount, currency)}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Répartition et évolution sur la période */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Répartition et évolution sur la période
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {periodEvolution.map((tranche) => (
                <div key={tranche.label} className="p-2.5 bg-white rounded-lg border border-gray-100 space-y-1 min-w-0">
                  <span className="text-[11px] text-gray-500 font-semibold block truncate">{tranche.label}</span>
                  <p className="font-bold text-gray-900 truncate">{formatCurrency(tranche.amount, currency)}</p>
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>{tranche.count} dép.</span>
                    <span className="font-bold text-emerald-700">{tranche.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Relevé chronologique des dépenses par jour */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Détail des dépenses par jour ({sortedExpenses.length} opérations)
            </h4>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
              {sortedExpenses.map((e) => {
                const expAmount = convertAmount(e.amount, e.currency, currency);
                return (
                  <div
                    key={e.id}
                    className="p-2 sm:p-2.5 bg-white rounded-lg border border-gray-100/90 flex items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-gray-900 truncate max-w-[130px] sm:max-w-[220px]">{e.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">{e.category}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-gray-400 mt-0.5">
                        <span className="font-mono">{e.date}</span>
                        {e.moment && <span>• {e.moment}</span>}
                      </div>
                    </div>
                    <span className="font-bold text-gray-900 shrink-0 text-right">{formatCurrency(expAmount, currency)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Document Footer */}
          <div className="pt-3 border-t border-gray-200 text-center text-[10px] text-gray-400">
            Document généré par l'application TalaMbongo • Bilan financier conforme • Clôture le 3 de chaque mois
          </div>
        </div>
      </div>
    </div>
  );
};
