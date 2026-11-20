import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  History,
  Link2,
  MousePointerClick,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Share2,
  Shield,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import {
  createPartnerInFirestore,
  markPartnerCommissionPaidInFirestore,
  updatePartnerInFirestore,
  updatePartnerStatusInFirestore,
} from '../services/firebaseService';
import {
  FirestoreSubscriptionRecord,
  FirestoreUserAccount,
  Partner,
  PartnerAuditLog,
  PartnerClickRecord,
  PartnerCommissionRecord,
  PartnerStatus,
  SupportedCurrency,
} from '../types';
import { convertAmount, formatCurrency } from '../utils/currency';
import {
  anonymizeUserId,
  buildReferralLink,
  computePartnerMetrics,
  DEFAULT_PARTNER_COMMISSION_XOF,
  DEFAULT_PARTNER_FIXED_FEE_XOF,
  generateUniqueReferralCode,
  getPartnerStatusLabel,
  normalizeReferralCode,
  REFERENCE_SUBSCRIPTION_PRICE_XOF,
} from '../utils/partners';

interface AdminPartnersSectionProps {
  currentAdminUid: string;
  selectedCurrency: SupportedCurrency;
  partners: Partner[];
  clicks: PartnerClickRecord[];
  commissions: PartnerCommissionRecord[];
  auditLogs: PartnerAuditLog[];
  users: FirestoreUserAccount[];
  subscriptions: FirestoreSubscriptionRecord[];
  onRefresh: () => Promise<void>;
}

const SOCIAL_NETWORKS = [
  'TikTok',
  'YouTube',
  'Instagram',
  'Facebook',
  'WhatsApp',
  'Snapchat',
  'X (Twitter)',
  'Blog / Média',
  'Autre',
];

function toInputDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseStartOfDayMs(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
}

function parseEndOfDayMs(dateStr: string): number {
  const d = new Date(`${dateStr}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? Date.now() + 30 * 86400000 : d.getTime();
}

function formatDateFr(ms?: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTimeFr(ms?: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AdminPartnersSection: React.FC<AdminPartnersSectionProps> = ({
  currentAdminUid,
  selectedCurrency,
  partners,
  clicks,
  commissions,
  auditLogs,
  users,
  subscriptions,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'scheduled' | 'expired' | 'suspended' | 'disabled'>('all');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<'commissions' | 'users' | 'history'>('commissions');

  // Feedback banners
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Create / Edit Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formName, setFormName] = useState('');
  const [formChannelName, setFormChannelName] = useState('');
  const [formSocialNetwork, setFormSocialNetwork] = useState('TikTok');
  const [formContactInfo, setFormContactInfo] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formStartDate, setFormStartDate] = useState(() => toInputDate(Date.now()));
  const [formEndDate, setFormEndDate] = useState(() => toInputDate(Date.now() + 30 * 86400000));
  const [formFixedFee, setFormFixedFee] = useState<number>(DEFAULT_PARTNER_FIXED_FEE_XOF);
  const [formCommission, setFormCommission] = useState<number>(DEFAULT_PARTNER_COMMISSION_XOF);
  const [formStatus, setFormStatus] = useState<PartnerStatus>('active');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Mark Commission Paid Modal State
  const [payingCommission, setPayingCommission] = useState<PartnerCommissionRecord | null>(null);
  const [payoutRefInput, setPayoutRefInput] = useState('');
  const [payoutDateInput, setPayoutDateInput] = useState(() => toInputDate(Date.now()));
  const [payoutNoteInput, setPayoutNoteInput] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);

  const fmtXofInAdminCur = (amountXof: number) => {
    const converted = convertAmount(amountXof, 'XOF', selectedCurrency);
    return formatCurrency(converted, selectedCurrency);
  };

  const existingCodesSet = useMemo(() => new Set(partners.map((p) => p.code)), [partners]);

  const enrichedPartners = useMemo(() => {
    return partners.map((partner) => ({
      partner,
      metrics: computePartnerMetrics(partner, clicks, users, commissions),
    }));
  }, [partners, clicks, users, commissions]);

  const globalTotals = useMemo(() => {
    const activeCount = enrichedPartners.filter((p) => p.metrics.effectiveLifecycle === 'active').length;
    const totalClicks = clicks.length;
    const totalSignups = users.filter((u) => Boolean(u.referredByPartnerId)).length;
    const totalPaying = commissions.length;
    const totalCommissionsXof = commissions.reduce((acc, c) => acc + c.amountXof, 0);
    const pendingCommissionsXof = commissions
      .filter((c) => c.status === 'pending')
      .reduce((acc, c) => acc + c.amountXof, 0);
    const paidCommissionsXof = commissions
      .filter((c) => c.status === 'paid')
      .reduce((acc, c) => acc + c.amountXof, 0);
    const totalFixedFeesXof = partners.reduce((acc, p) => acc + p.fixedAdFeeXof, 0);

    return {
      totalPartners: partners.length,
      activeCount,
      totalClicks,
      totalSignups,
      totalPaying,
      conversionPct: totalSignups > 0 ? Math.round((totalPaying / totalSignups) * 1000) / 10 : 0,
      totalCommissionsXof,
      pendingCommissionsXof,
      paidCommissionsXof,
      totalFixedFeesXof,
    };
  }, [enrichedPartners, partners, clicks, users, commissions]);

  const filteredPartners = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedPartners.filter(({ partner, metrics }) => {
      if (statusFilter !== 'all' && metrics.effectiveLifecycle !== statusFilter) {
        return false;
      }
      if (q) {
        const hay = `${partner.name} ${partner.channelName} ${partner.socialNetwork} ${partner.code} ${partner.contactInfo}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enrichedPartners, searchQuery, statusFilter]);

  const selectedPartnerBundle = useMemo(() => {
    if (!selectedPartnerId) return null;
    return enrichedPartners.find((item) => item.partner.id === selectedPartnerId) || null;
  }, [enrichedPartners, selectedPartnerId]);

  const selectedPartnerDetails = useMemo(() => {
    if (!selectedPartnerBundle) return null;
    const partner = selectedPartnerBundle.partner;
    const partnerCommissions = commissions
      .filter((c) => c.partnerId === partner.id)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);

    const partnerUsers = users
      .filter((u) => u.referredByPartnerId === partner.id)
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .map((u) => {
        const commission = partnerCommissions.find((c) => c.userId === u.uid);
        const firstConfirmedSub = subscriptions
          .filter((s) => s.userId === u.uid && s.paymentStatus === 'confirmed')
          .sort((a, b) => a.createdAtMs - b.createdAtMs)[0];

        const isPaid =
          u.subscriptionStatus === 'active' ||
          u.subscriptionStatus === 'renewed' ||
          Boolean(commission) ||
          Boolean(firstConfirmedSub);

        return {
          anonymizedId: commission?.anonymizedUserRef || anonymizeUserId(u.uid),
          signupAtMs: u.referralAttributedAtMs || u.createdAtMs,
          source: u.referralSource || 'link',
          statusLabel: isPaid
            ? 'Abonné payant'
            : u.subscriptionStatus === 'expired'
            ? 'Expiré'
            : 'Essai gratuit',
          isPaid,
          firstPaymentAtMs: firstConfirmedSub?.createdAtMs || commission?.createdAtMs,
          commissionAmountXof: commission ? commission.amountXof : 0,
          commissionStatus: commission?.status,
        };
      });

    const partnerLogs = auditLogs
      .filter((l) => l.partnerId === partner.id)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);

    return {
      partnerCommissions,
      partnerUsers,
      partnerLogs,
    };
  }, [selectedPartnerBundle, commissions, users, subscriptions, auditLogs]);

  const openCreateModal = () => {
    setEditingPartner(null);
    setFormName('');
    setFormChannelName('');
    setFormSocialNetwork('TikTok');
    setFormContactInfo('');
    setFormCode(generateUniqueReferralCode('TALA', existingCodesSet));
    setFormStartDate(toInputDate(Date.now()));
    setFormEndDate(toInputDate(Date.now() + 30 * 86400000));
    setFormFixedFee(DEFAULT_PARTNER_FIXED_FEE_XOF);
    setFormCommission(DEFAULT_PARTNER_COMMISSION_XOF);
    setFormStatus('active');
    setFormNotes('');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (partner: Partner) => {
    setEditingPartner(partner);
    setFormName(partner.name);
    setFormChannelName(partner.channelName);
    setFormSocialNetwork(partner.socialNetwork);
    setFormContactInfo(partner.contactInfo);
    setFormCode(partner.code);
    setFormStartDate(toInputDate(partner.startDateMs));
    setFormEndDate(toInputDate(partner.endDateMs));
    setFormFixedFee(partner.fixedAdFeeXof);
    setFormCommission(partner.commissionPerUserXof);
    setFormStatus(partner.status);
    setFormNotes(partner.notes || '');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleCopyLink = async (link: string, id: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      setFeedbackBanner({
        type: 'error',
        message: `Impossible de copier automatiquement. Lien : ${link}`,
      });
    }
  };

  const handleShareLink = async (partner: Partner) => {
    const shareText = `Rejoins TalaMbongo avec le code partenaire ${partner.code} : ${partner.referralLink}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Partenariat TalaMbongo — ${partner.name}`,
          text: `Suivez vos dépenses facilement avec TalaMbongo (${partner.code})`,
          url: partner.referralLink,
        });
        return;
      } catch {
        // Fallback vers copie presse-papiers si annulé ou non supporté
      }
    }
    await handleCopyLink(shareText, `share-${partner.id}`);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim() || !formChannelName.trim() || !formContactInfo.trim()) {
      setFormError('Veuillez renseigner le nom, la page/chaîne et les coordonnées de contact.');
      return;
    }

    const startMs = parseStartOfDayMs(formStartDate);
    const endMs = parseEndOfDayMs(formEndDate);
    if (endMs < startMs) {
      setFormError('La date de fin doit être postérieure ou égale à la date de début.');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingPartner) {
        await updatePartnerInFirestore(editingPartner, {
          name: formName.trim(),
          channelName: formChannelName.trim(),
          socialNetwork: formSocialNetwork,
          contactInfo: formContactInfo.trim(),
          startDateMs: startMs,
          endDateMs: endMs,
          fixedAdFeeXof: Math.max(0, Number(formFixedFee) || 0),
          commissionPerUserXof: Math.max(0, Number(formCommission) || 0),
          status: formStatus,
          notes: formNotes.trim(),
          actorUid: currentAdminUid,
        });
        setFeedbackBanner({
          type: 'success',
          message: `Partenaire « ${formName.trim()} » mis à jour avec succès.`,
        });
      } else {
        const normalizedCode = normalizeReferralCode(formCode);
        const created = await createPartnerInFirestore({
          name: formName.trim(),
          channelName: formChannelName.trim(),
          socialNetwork: formSocialNetwork,
          contactInfo: formContactInfo.trim(),
          code: normalizedCode,
          startDateMs: startMs,
          endDateMs: endMs,
          fixedAdFeeXof: Math.max(0, Number(formFixedFee) || 0),
          commissionPerUserXof: Math.max(0, Number(formCommission) || 0),
          status: formStatus,
          notes: formNotes.trim(),
          actorUid: currentAdminUid,
        });
        setSelectedPartnerId(created.id);
        setFeedbackBanner({
          type: 'success',
          message: `Partenaire « ${created.name} » créé avec le code ${created.code}.`,
        });
      }

      setIsFormModalOpen(false);
      await onRefresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (partner: Partner, nextStatus: PartnerStatus) => {
    setActionBusyId(partner.id);
    setFeedbackBanner(null);
    try {
      await updatePartnerStatusInFirestore(partner, nextStatus, currentAdminUid);
      setFeedbackBanner({
        type: 'success',
        message: `Statut du partenariat « ${partner.name} » mis à jour (${getPartnerStatusLabel(nextStatus)}).`,
      });
      await onRefresh();
    } catch (err) {
      setFeedbackBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erreur lors du changement de statut.',
      });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleConfirmCommissionPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCommission) return;

    const partnerObj = partners.find((p) => p.id === payingCommission.partnerId);
    setPayoutSubmitting(true);
    setFeedbackBanner(null);

    try {
      const paidAtMs = payoutDateInput ? parseStartOfDayMs(payoutDateInput) + 12 * 3600000 : Date.now();
      await markPartnerCommissionPaidInFirestore({
        commission: payingCommission,
        partnerName: partnerObj?.name || payingCommission.referralCode,
        payoutReference: payoutRefInput.trim() || `PAY-${Date.now().toString().slice(-6)}`,
        payoutNote: payoutNoteInput.trim(),
        paidAtMs,
        actorUid: currentAdminUid,
      });
      setPayingCommission(null);
      setPayoutRefInput('');
      setPayoutNoteInput('');
      setFeedbackBanner({
        type: 'success',
        message: `Commission de ${payingCommission.amountXof} FCFA marquée comme payée.`,
      });
      await onRefresh();
    } catch (err) {
      setFeedbackBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Impossible de valider le paiement de la commission.',
      });
    } finally {
      setPayoutSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-[#063D2E]'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#087A50] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Global KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#063D2E] text-white rounded-2xl p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-100">Partenaires actifs</span>
            <Sparkles className="w-4 h-4 text-[#B7F5D5]" />
          </div>
          <p className="text-2xl font-black tabular-nums">
            {globalTotals.activeCount}{' '}
            <span className="text-sm font-semibold text-emerald-200">
              / {globalTotals.totalPartners}
            </span>
          </p>
          <span className="text-[11px] text-[#B7F5D5] block">
            Forfaits fixes engagés : {fmtXofInAdminCur(globalTotals.totalFixedFeesXof)}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Clics & Inscriptions</span>
            <MousePointerClick className="w-4 h-4 text-[#087A50]" />
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            {globalTotals.totalClicks}{' '}
            <span className="text-sm font-bold text-[#087A50]">
              → {globalTotals.totalSignups} inscrits
            </span>
          </p>
          <span className="text-[11px] text-slate-500 block">
            {globalTotals.totalPaying} abonnés payants ({globalTotals.conversionPct}% conv.)
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Commissions en attente</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 tabular-nums">
            {fmtXofInAdminCur(globalTotals.pendingCommissionsXof)}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Règle : 1er paiement confirmé ({REFERENCE_SUBSCRIPTION_PRICE_XOF} FCFA)
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Commissions payées</span>
            <Wallet className="w-4 h-4 text-[#087A50]" />
          </div>
          <p className="text-2xl font-black text-[#087A50] tabular-nums">
            {fmtXofInAdminCur(globalTotals.paidCommissionsXof)}
          </p>
          <span className="text-[11px] text-slate-500 block">
            Total généré : {fmtXofInAdminCur(globalTotals.totalCommissionsXof)}
          </span>
        </div>
      </div>

      {/* Toolbar: Search, Filter & Create Button */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher partenaire, chaîne, code..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#087A50] focus:bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="scheduled">Programmés</option>
            <option value="expired">Expirés</option>
            <option value="suspended">Suspendus</option>
            <option value="disabled">Désactivés</option>
          </select>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#087A50] hover:bg-[#063D2E] text-white text-xs font-bold transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Créer un partenaire</span>
        </button>
      </div>

      {/* Partners Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Répertoire des partenaires & codes de parrainage
            </h2>
            <p className="text-xs text-slate-500">
              Cliquez sur « Détails » pour consulter les statistiques, utilisateurs anonymisés et règlements.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 tabular-nums">
            {filteredPartners.length} partenaire(s)
          </span>
        </div>

        {filteredPartners.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-xs text-slate-500 font-medium">
              Aucun partenaire trouvé pour ces critères.
            </p>
            {partners.length === 0 && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 text-[#087A50] hover:bg-emerald-100 text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter votre premier partenaire
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Partenaire & Chaîne</th>
                  <th className="py-3 px-4">Code & Lien</th>
                  <th className="py-3 px-4">Période & Statut</th>
                  <th className="py-3 px-4 text-right">Clics / Inscrits / Payants</th>
                  <th className="py-3 px-4 text-right">Commissions (Att. / Pay.)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredPartners.map(({ partner, metrics }) => {
                  const isSelected = selectedPartnerId === partner.id;
                  const lifecycle = metrics.effectiveLifecycle;
                  return (
                    <tr
                      key={partner.id}
                      className={`transition ${
                        isSelected ? 'bg-emerald-50/60' : 'hover:bg-emerald-50/30'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{partner.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {partner.socialNetwork} • {partner.channelName}
                        </p>
                        <p className="text-[11px] text-slate-400">{partner.contactInfo}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono font-bold text-[#063D2E] text-[11px]">
                            {partner.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(partner.referralLink, `copy-${partner.id}`)}
                            title="Copier le lien de parrainage"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#087A50] hover:border-emerald-300 bg-white transition cursor-pointer"
                          >
                            {copiedId === `copy-${partner.id}` ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#087A50]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareLink(partner)}
                            title="Partager le lien"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#087A50] hover:border-emerald-300 bg-white transition cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[210px]">
                          Forfait {fmtXofInAdminCur(partner.fixedAdFeeXof)} •{' '}
                          {fmtXofInAdminCur(partner.commissionPerUserXof)} / payant
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            lifecycle === 'active'
                              ? 'bg-emerald-50 text-[#087A50]'
                              : lifecycle === 'scheduled'
                              ? 'bg-sky-50 text-sky-700'
                              : lifecycle === 'suspended'
                              ? 'bg-amber-50 text-amber-700'
                              : lifecycle === 'expired'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {getPartnerStatusLabel(lifecycle)}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                          {formatDateFr(partner.startDateMs)} → {formatDateFr(partner.endDateMs)}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-right tabular-nums">
                        <p className="font-bold text-slate-900">
                          {metrics.clicksCount} clics • {metrics.signupsCount} inscr. •{' '}
                          <span className="text-[#087A50]">{metrics.payingUsersCount} payants</span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Conv. {metrics.conversionRatePct}%
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-right tabular-nums">
                        <p className="font-bold text-amber-600">
                          {fmtXofInAdminCur(metrics.pendingCommissionsXof)} en attente
                        </p>
                        <p className="text-[11px] text-[#087A50] font-semibold">
                          {fmtXofInAdminCur(metrics.paidCommissionsXof)} payées
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPartnerId(isSelected ? null : partner.id);
                              setDetailSubTab('commissions');
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                              isSelected
                                ? 'bg-[#063D2E] text-white'
                                : 'bg-emerald-50 text-[#087A50] hover:bg-emerald-100'
                            }`}
                          >
                            {isSelected ? 'Masquer' : 'Détails'}
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(partner)}
                            title="Modifier le partenaire"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {partner.status !== 'active' ? (
                            <button
                              type="button"
                              disabled={actionBusyId === partner.id}
                              onClick={() => handleQuickStatusChange(partner, 'active')}
                              title="Activer le partenariat"
                              className="p-1.5 rounded-lg border border-emerald-200 text-[#087A50] hover:bg-emerald-50 transition cursor-pointer disabled:opacity-50"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={actionBusyId === partner.id}
                              onClick={() => handleQuickStatusChange(partner, 'suspended')}
                              title="Suspendre temporairement"
                              className="p-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition cursor-pointer disabled:opacity-50"
                            >
                              <PauseCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {partner.status !== 'disabled' && (
                            <button
                              type="button"
                              disabled={actionBusyId === partner.id}
                              onClick={() => handleQuickStatusChange(partner, 'disabled')}
                              title="Désactiver définitivement les nouvelles attributions"
                              className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition cursor-pointer disabled:opacity-50"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Partner Detailed Dashboard */}
      {selectedPartnerBundle && selectedPartnerDetails && (
        <div className="bg-white rounded-2xl border border-emerald-200 overflow-hidden shadow-xs">
          {/* Partner Header */}
          <div className="p-5 sm:p-6 bg-[#063D2E] text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-extrabold">{selectedPartnerBundle.partner.name}</h3>
                <span className="px-2 py-0.5 rounded-md bg-[#13B981]/20 border border-[#13B981]/40 text-[#B7F5D5] font-mono text-xs font-bold">
                  {selectedPartnerBundle.partner.code}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-xs font-semibold">
                  {getPartnerStatusLabel(selectedPartnerBundle.metrics.effectiveLifecycle)}
                </span>
              </div>
              <p className="text-xs text-emerald-100/80">
                {selectedPartnerBundle.partner.socialNetwork} •{' '}
                {selectedPartnerBundle.partner.channelName} • Contact :{' '}
                {selectedPartnerBundle.partner.contactInfo}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <code className="text-[11px] bg-black/25 px-2.5 py-1 rounded-lg text-[#B7F5D5] break-all">
                  {selectedPartnerBundle.partner.referralLink}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyLink(
                      selectedPartnerBundle.partner.referralLink,
                      `detail-${selectedPartnerBundle.partner.id}`
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#13B981] text-[#063D2E] text-[11px] font-bold hover:bg-[#34D399] transition cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>
                    {copiedId === `detail-${selectedPartnerBundle.partner.id}` ? 'Copié !' : 'Copier'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openEditModal(selectedPartnerBundle.partner)}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Modifier le contrat</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPartnerId(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer"
                aria-label="Fermer le détail partenaire"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Partner KPI Cards */}
          <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 bg-[#f5faf7] border-b border-slate-200/80">
            <StatMiniBox
              label="Clics enregistrés"
              value={selectedPartnerBundle.metrics.clicksCount.toLocaleString('fr-FR')}
            />
            <StatMiniBox
              label="Inscriptions"
              value={selectedPartnerBundle.metrics.signupsCount.toLocaleString('fr-FR')}
              sub={`${selectedPartnerBundle.metrics.clickToSignupRatePct}% des clics`}
            />
            <StatMiniBox
              label="Abonnés payants"
              value={selectedPartnerBundle.metrics.payingUsersCount.toLocaleString('fr-FR')}
              sub={`${selectedPartnerBundle.metrics.nonPayingUsersCount} non payants`}
              highlight
            />
            <StatMiniBox
              label="Taux conversion"
              value={`${selectedPartnerBundle.metrics.conversionRatePct}%`}
              sub="Payants / inscrits"
            />
            <StatMiniBox
              label="Commissions générées"
              value={fmtXofInAdminCur(selectedPartnerBundle.metrics.totalCommissionsXof)}
              sub={`Attente : ${fmtXofInAdminCur(selectedPartnerBundle.metrics.pendingCommissionsXof)}`}
            />
            <StatMiniBox
              label="Coût campagne total"
              value={fmtXofInAdminCur(selectedPartnerBundle.metrics.totalPartnerCostXof)}
              sub={`Fixe ${fmtXofInAdminCur(selectedPartnerBundle.partner.fixedAdFeeXof)} + comm.`}
            />
          </div>

          {/* Partner Detail Sub-tabs */}
          <div className="px-5 sm:px-6 pt-4 border-b border-slate-200 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDetailSubTab('commissions')}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 transition cursor-pointer ${
                detailSubTab === 'commissions'
                  ? 'border-[#087A50] text-[#087A50] bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Commissions & Règlements ({selectedPartnerDetails.partnerCommissions.length})
            </button>
            <button
              type="button"
              onClick={() => setDetailSubTab('users')}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 transition cursor-pointer ${
                detailSubTab === 'users'
                  ? 'border-[#087A50] text-[#087A50] bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Utilisateurs attribués ({selectedPartnerDetails.partnerUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setDetailSubTab('history')}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 transition cursor-pointer ${
                detailSubTab === 'history'
                  ? 'border-[#087A50] text-[#087A50] bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Historique opérations ({selectedPartnerDetails.partnerLogs.length})
            </button>
          </div>

          {/* Detail Sub-tab Content */}
          <div className="p-5 sm:p-6">
            {detailSubTab === 'commissions' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <p className="text-slate-600">
                    Une commission unique est générée au premier paiement confirmé de chaque utilisateur attribué.
                  </p>
                  <div className="flex items-center gap-3 font-bold tabular-nums">
                    <span className="text-amber-600">
                      En attente : {fmtXofInAdminCur(selectedPartnerBundle.metrics.pendingCommissionsXof)}
                    </span>
                    <span className="text-[#087A50]">
                      Payées : {fmtXofInAdminCur(selectedPartnerBundle.metrics.paidCommissionsXof)}
                    </span>
                  </div>
                </div>

                {selectedPartnerDetails.partnerCommissions.length === 0 ? (
                  <div className="py-8 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-xs text-slate-500">
                    Aucune commission générée pour ce partenaire pour le moment.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-2.5 px-3.5">Utilisateur (anonymisé)</th>
                          <th className="py-2.5 px-3.5">Formule</th>
                          <th className="py-2.5 px-3.5">Date paiement</th>
                          <th className="py-2.5 px-3.5 text-right">Commission</th>
                          <th className="py-2.5 px-3.5">Statut règlement</th>
                          <th className="py-2.5 px-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedPartnerDetails.partnerCommissions.map((comm) => (
                          <tr key={comm.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-3.5 font-mono font-bold text-slate-800">
                              {comm.anonymizedUserRef}
                            </td>
                            <td className="py-3 px-3.5 text-slate-600">
                              {comm.planType === 'quarterly' ? 'Premium 3 mois' : 'Premium 1 mois'}
                            </td>
                            <td className="py-3 px-3.5 text-slate-500 tabular-nums">
                              {formatDateFr(comm.createdAtMs)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-bold text-slate-900 tabular-nums">
                              {fmtXofInAdminCur(comm.amountXof)}
                            </td>
                            <td className="py-3 px-3.5">
                              {comm.status === 'paid' ? (
                                <div>
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#087A50] font-bold text-[11px]">
                                    Payée
                                  </span>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {formatDateFr(comm.paidAtMs)} • Réf : {comm.payoutReference}
                                  </p>
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[11px]">
                                  En attente
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right">
                              {comm.status === 'pending' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPayingCommission(comm);
                                    setPayoutDateInput(toInputDate(Date.now()));
                                    setPayoutRefInput(`PAY-${comm.referralCode}-${Date.now().toString().slice(-4)}`);
                                    setPayoutNoteInput('');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[#087A50] hover:bg-[#063D2E] text-white font-bold text-[11px] transition cursor-pointer"
                                >
                                  Marquer payée
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">Réglée</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {detailSubTab === 'users' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-[#063D2E]">
                  <Shield className="w-4 h-4 text-[#087A50] shrink-0" />
                  <span>
                    Affichage anonymisé pour protéger la vie privée : aucune adresse e-mail ni donnée personnelle sensible n'est exposée.
                  </span>
                </div>

                {selectedPartnerDetails.partnerUsers.length === 0 ? (
                  <div className="py-8 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-xs text-slate-500">
                    Aucun utilisateur inscrit via ce partenaire pour le moment.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-2.5 px-3.5">ID anonymisé</th>
                          <th className="py-2.5 px-3.5">Date d'inscription</th>
                          <th className="py-2.5 px-3.5">Source</th>
                          <th className="py-2.5 px-3.5">Statut</th>
                          <th className="py-2.5 px-3.5">Date 1er paiement</th>
                          <th className="py-2.5 px-3.5 text-right">Commission</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedPartnerDetails.partnerUsers.map((u, idx) => (
                          <tr key={`${u.anonymizedId}-${idx}`} className="hover:bg-slate-50/70">
                            <td className="py-3 px-3.5 font-mono font-bold text-slate-800">
                              {u.anonymizedId}
                            </td>
                            <td className="py-3 px-3.5 text-slate-600 tabular-nums">
                              {formatDateFr(u.signupAtMs)}
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                                {u.source === 'link' ? 'Lien parrainage' : 'Saisie manuelle'}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                  u.isPaid
                                    ? 'bg-emerald-50 text-[#087A50]'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {u.statusLabel}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-slate-500 tabular-nums">
                              {u.firstPaymentAtMs ? formatDateFr(u.firstPaymentAtMs) : 'Aucun paiement'}
                            </td>
                            <td className="py-3 px-3.5 text-right font-bold tabular-nums">
                              {u.commissionAmountXof > 0
                                ? fmtXofInAdminCur(u.commissionAmountXof)
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {detailSubTab === 'history' && (
              <div>
                {selectedPartnerDetails.partnerLogs.length === 0 ? (
                  <div className="py-8 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-xs text-slate-500">
                    Aucune opération enregistrée dans l'historique pour ce partenaire.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl">
                    {selectedPartnerDetails.partnerLogs.map((log) => (
                      <div key={log.id} className="p-3.5 flex items-start justify-between gap-3 text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{log.details}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Action : {log.action} • Admin UID :{' '}
                            <span className="font-mono">{log.actorUid.slice(0, 8)}…</span>
                          </p>
                        </div>
                        <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                          {formatDateTimeFr(log.createdAtMs)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Partner Operations Audit Trail */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#087A50]" />
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Historique des opérations partenaires
              </h2>
              <p className="text-xs text-slate-500">
                Journal immuable des créations, modifications, statuts et paiements de commissions.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-500 tabular-nums">
            {auditLogs.length} entrée(s)
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Aucune opération partenaire enregistrée pour le moment.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {auditLogs.slice(0, 25).map((log) => (
              <div key={log.id} className="p-3.5 px-5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{log.partnerName}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-[#063D2E]">
                      {log.partnerCode}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5 truncate">{log.details}</p>
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                  {formatDateTimeFr(log.createdAtMs)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Partner Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-6 sm:p-7 space-y-5 my-auto shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {editingPartner ? `Modifier : ${editingPartner.name}` : 'Créer un nouveau partenaire'}
                </h3>
                <p className="text-xs text-slate-500">
                  Configurez les informations du partenariat, la période de validité et la commission.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Nom du partenaire *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex : Mariam Finance"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:border-[#087A50] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Nom de sa page ou chaîne *
                  </label>
                  <input
                    type="text"
                    required
                    value={formChannelName}
                    onChange={(e) => setFormChannelName(e.target.value)}
                    placeholder="Ex : @MariamBudget"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:border-[#087A50] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Réseau social *</label>
                  <select
                    value={formSocialNetwork}
                    onChange={(e) => setFormSocialNetwork(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900"
                  >
                    {SOCIAL_NETWORKS.map((net) => (
                      <option key={net} value={net}>
                        {net}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Coordonnées de contact *
                  </label>
                  <input
                    type="text"
                    required
                    value={formContactInfo}
                    onChange={(e) => setFormContactInfo(e.target.value)}
                    placeholder="Téléphone WhatsApp ou e-mail"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:border-[#087A50] focus:outline-none"
                  />
                </div>
              </div>

              {/* Referral Code & Link Preview */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#063D2E]">
                    Code de parrainage unique *
                  </label>
                  {!editingPartner && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormCode(generateUniqueReferralCode(formName || 'TALA', existingCodesSet))
                      }
                      className="text-[11px] font-bold text-[#087A50] hover:underline cursor-pointer"
                    >
                      Générer automatiquement
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    readOnly={Boolean(editingPartner)}
                    value={formCode}
                    onChange={(e) => {
                      if (editingPartner) return;
                      setFormCode(normalizeReferralCode(e.target.value).replace(/[^A-Z0-9_-]/g, ''));
                    }}
                    placeholder="EX: MARIAM2026"
                    maxLength={32}
                    className={`flex-1 px-3 py-2 rounded-xl border text-xs font-mono font-bold tracking-wider ${
                      editingPartner
                        ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                        : 'bg-white border-emerald-300 text-[#063D2E] uppercase'
                    }`}
                  />
                </div>

                <p className="text-[11px] text-emerald-900/80 flex items-center gap-1.5 break-all">
                  <Link2 className="w-3.5 h-3.5 text-[#087A50] shrink-0" />
                  <span>
                    Lien généré :{' '}
                    <strong className="font-mono">
                      {buildReferralLink(formCode || 'CODEPARTENAIRE')}
                    </strong>
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Date de début *</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Date de fin *</label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Prestation publicitaire fixe (FCFA)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    required
                    value={formFixedFee}
                    onChange={(e) => setFormFixedFee(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 tabular-nums"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Commission par nouvel abonné payant (FCFA)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    required
                    value={formCommission}
                    onChange={(e) => setFormCommission(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 tabular-nums"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Type de commission</label>
                  <input
                    type="text"
                    readOnly
                    value="Premier paiement uniquement (Abo 500 FCFA)"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Statut du partenariat</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as PartnerStatus)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900"
                  >
                    <option value="active">Actif</option>
                    <option value="suspended">Suspendu</option>
                    <option value="disabled">Désactivé</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Notes internes (optionnel)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Conditions particulières, livrables vidéo..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:border-[#087A50] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#087A50] hover:bg-[#063D2E] text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
                >
                  {formSubmitting
                    ? 'Enregistrement...'
                    : editingPartner
                    ? 'Enregistrer les modifications'
                    : 'Créer le partenaire'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Commission Paid Modal */}
      {payingCommission && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                Confirmer le paiement de commission
              </h3>
              <button
                type="button"
                onClick={() => setPayingCommission(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
              <p className="font-bold text-[#063D2E]">
                Montant à régler : {fmtXofInAdminCur(payingCommission.amountXof)} (
                {payingCommission.amountXof.toLocaleString('fr-FR')} FCFA)
              </p>
              <p className="text-emerald-900/80">
                Utilisateur attribué : <span className="font-mono">{payingCommission.anonymizedUserRef}</span> • Code :{' '}
                <span className="font-mono font-bold">{payingCommission.referralCode}</span>
              </p>
            </div>

            <form onSubmit={handleConfirmCommissionPayout} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Date du règlement *
                </label>
                <input
                  type="date"
                  required
                  value={payoutDateInput}
                  onChange={(e) => setPayoutDateInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Référence de paiement *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={payoutRefInput}
                  onChange={(e) => setPayoutRefInput(e.target.value)}
                  placeholder="Ex : MOMO-784512 ou VIREMENT-01"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Note (optionnel)
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={payoutNoteInput}
                  onChange={(e) => setPayoutNoteInput(e.target.value)}
                  placeholder="Ex : Payé via Mobile Money"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingCommission(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={payoutSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#087A50] hover:bg-[#063D2E] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {payoutSubmitting ? 'Validation...' : 'Confirmer le paiement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const StatMiniBox: React.FC<{
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}> = ({ label, value, sub, highlight }) => (
  <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 space-y-0.5">
    <span className="text-[11px] font-semibold text-slate-500 block">{label}</span>
    <p
      className={`text-base font-black tabular-nums ${
        highlight ? 'text-[#087A50]' : 'text-slate-900'
      }`}
    >
      {value}
    </p>
    {sub && <span className="text-[10px] text-slate-400 block truncate">{sub}</span>}
  </div>
);
