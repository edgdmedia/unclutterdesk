import React, { useEffect, useState } from 'react';
import { Tag, Plus, X, Power, PowerOff } from 'lucide-react';
import { Eyebrow, useBrand, useToast, Page, PageHeader, Grid, ResponsiveTable, byDate, byNumber, byText, type Column } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';

interface DiscountCode {
  id: string;
  code: string;
  label?: string;
  discountType: 'PERCENT' | 'FIXED';
  discountPercent?: number;
  discountAmountKobo?: string;
  maxUses?: number;
  usedCount: number;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

export function DiscountSettingsPage() {
  const toast = useToast();
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';

  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formType, setFormType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [formPercent, setFormPercent] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMaxUses, setFormMaxUses] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadDiscounts() {
      setLoading(true);
      try {
        const data = await api.get<DiscountCode[]>('/v1/discount');
        if (!cancelled) setDiscounts(data);
      } catch (err: any) {
        if (!cancelled) setError(err.response?.data?.message || err.message || 'Unable to load discounts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadDiscounts();
    return () => { cancelled = true; };
  }, []);

  async function handleToggleStatus(id: string, currentStatus: boolean) {
    if (!currentStatus) return; // Only allowing deactivation for now based on PRD
    try {
      await api.delete(`/v1/discount/${id}`);
      setDiscounts(current => current.map(d => d.id === id ? { ...d, isActive: false } : d));
      toast.success('Discount code switched off');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Could not switch the code off');
    }
  }

  async function handleCreateDiscount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    try {
      const payload: any = {
        code: formCode,
        label: formLabel || undefined,
        discountType: formType,
      };

      if (formType === 'PERCENT') payload.discountPercent = parseInt(formPercent, 10);
      else payload.discountAmountKobo = (parseInt(formAmount, 10) * 100).toString(); // Assuming input is in Naira, converting to Kobo

      if (formMaxUses) payload.maxUses = parseInt(formMaxUses, 10);
      if (formExpiresAt) payload.expiresAt = new Date(formExpiresAt).toISOString();

      const newDiscount = await api.post<DiscountCode>('/v1/discount', payload);
      setDiscounts(current => [newDiscount, ...current]);
      setShowModal(false);
      // Reset form
      setFormCode('');
      setFormLabel('');
      setFormType('PERCENT');
      setFormPercent('');
      setFormAmount('');
      setFormMaxUses('');
      setFormExpiresAt('');
      toast.success('Discount code created');
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : 'Could not create the discount code');
      setError(err.response?.data?.message || err.message || 'Error creating discount code');
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusOf = (d: DiscountCode) => {
    const expired = Boolean(d.expiresAt && new Date(d.expiresAt) < new Date());
    const exhausted = Boolean(d.maxUses && d.usedCount >= d.maxUses);
    if (d.isActive && !expired && !exhausted) return 'Active';
    return !d.isActive ? 'Inactive' : expired ? 'Expired' : 'Depleted';
  };
  const valueOf = (d: DiscountCode) =>
    d.discountType === 'PERCENT' ? `${d.discountPercent}% OFF` : `₦${(parseInt(d.discountAmountKobo || '0', 10) / 100).toLocaleString()} OFF`;

  const columns: Column<DiscountCode>[] = [
    {
      key: 'code',
      header: 'Code',
      sort: byText((d) => d.code),
      cell: (d) => (
        <>
          <div className="text-[13px] font-bold text-[#0F172A] tracking-wide">{d.code}</div>
          {d.label && <div className="text-[11px] text-slate-500 mt-0.5">{d.label}</div>}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sort: byText(statusOf),
      cell: (d) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
          statusOf(d) === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {statusOf(d)}
        </span>
      ),
    },
    { key: 'value', header: 'Value', priority: 'md', cell: (d) => <span className="text-[13px] font-bold text-[#0F3A53]">{valueOf(d)}</span> },
    {
      key: 'usage',
      header: 'Usage',
      priority: 'md',
      sort: byNumber((d) => d.usedCount),
      cell: (d) => <span className="text-[12px] font-medium text-slate-600">{d.usedCount} {d.maxUses ? `/ ${d.maxUses}` : 'uses'}</span>,
    },
    {
      key: 'expiry',
      header: 'Expiry',
      priority: 'lg',
      sort: byDate((d) => d.expiresAt ?? null),
      cell: (d) => <span className="text-[12px] font-medium text-slate-600">{d.expiresAt ? new Date(d.expiresAt).toLocaleDateString('en-GB') : 'Never'}</span>,
    },
  ];

  return (
    <Page
      header={
        <PageHeader
          eyebrow="SETTINGS"
          title="Discounts & Promos"
          actions={
            <button
              onClick={() => setShowModal(true)}
              className="h-10 px-4 rounded-[12px] text-white text-xs font-bold flex items-center gap-2 hover:brightness-110 transition-all cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="h-4 w-4" />
              Create Code
            </button>
          }
        />
      }
    >
      <p className="text-xs text-[#64748B] font-medium -mt-1">Manage promotional codes and discounts for your practice.</p>
        {error && !showModal ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
        
        {loading ? (
          <div className="rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-10 text-sm font-medium text-[#64748B]">Loading discounts...</div>
        ) : discounts.length === 0 ? (
          <div className="rounded-[24px] border border-[#E2E8F0] bg-white px-6 py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Tag className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-[16px] font-bold text-[#0F172A] mb-1">No discount codes</h3>
            <p className="text-[13px] text-slate-500 max-w-sm mb-6">Create promotional codes to offer discounts to new or returning clients when booking sessions.</p>
            <button
              onClick={() => setShowModal(true)}
              className="h-10 px-5 rounded-[12px] bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Create first code
            </button>
          </div>
        ) : (
          <div className="rounded-[24px] border border-[#E2E8F0] bg-white overflow-hidden">
            <ResponsiveTable<DiscountCode>
              caption="Discount codes"
              rows={discounts}
              rowKey={(d) => d.id}
              rowLabel={(d) => d.code}
              columns={columns}
              empty="No discount codes."
              filter={{ placeholder: 'Search codes', match: (d, q) => [d.code, d.label ?? ''].some((v) => v.toLowerCase().includes(q)) }}
              actions={(d) =>
                d.isActive ? (
                  <button
                    onClick={() => handleToggleStatus(d.id, d.isActive)}
                    className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer inline-flex p-1.5"
                    title="Deactivate code"
                    aria-label={`Deactivate ${d.code}`}
                  >
                    <PowerOff className="h-4 w-4" />
                  </button>
                ) : null
              }
            />
          </div>
        )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in">
          <form
            onSubmit={handleCreateDiscount}
            className="w-full max-w-[480px] bg-white rounded-[24px] p-8 shadow-2xl space-y-6 border border-slate-200 relative"
          >
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                <Tag className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-[#0F172A] leading-tight">Create Discount Code</h3>
                <p className="text-[12px] text-slate-500 font-medium">Configure a new promotional code.</p>
              </div>
            </div>

            {error && <div className="rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</div>}

            <Grid cols={{ base: 1, sm: 2 }}>
              <div className="space-y-1.5 col-span-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Discount Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WELCOME20"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-bold tracking-wide outline-none focus:border-slate-300 transition-colors uppercase"
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Internal Label (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Holiday Promo 2026"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium outline-none focus:border-slate-300 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Discount Type *</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as 'PERCENT' | 'FIXED')}
                  className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold outline-none cursor-pointer focus:border-slate-300"
                >
                  <option value="PERCENT">Percentage (%)</option>
                  <option value="FIXED">Fixed Amount (₦)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Value *</label>
                {formType === 'PERCENT' ? (
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    placeholder="20"
                    value={formPercent}
                    onChange={(e) => setFormPercent(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-bold outline-none focus:border-slate-300 transition-colors"
                  />
                ) : (
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="5000"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-bold outline-none focus:border-slate-300 transition-colors"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Max Uses (Optional)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={formMaxUses}
                  onChange={(e) => setFormMaxUses(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium outline-none focus:border-slate-300 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium outline-none focus:border-slate-300 transition-colors cursor-pointer"
                />
              </div>
            </Grid>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-[14px] text-white font-bold text-xs hover:brightness-110 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                {isSubmitting ? 'Creating...' : 'Create Discount Code'}
              </button>
            </div>
          </form>
        </div>
      )}
    </Page>
  );
}
