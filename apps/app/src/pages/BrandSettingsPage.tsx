import React, { useEffect, useState } from 'react';
import { Globe, Palette, Sparkles } from 'lucide-react';
import { Eyebrow, Card, BookingLinkField } from '@unclutterdesk/ui';
import { ClientBookingPage } from './ClientBookingPage';
import { BookingConfirmedPage } from './BookingConfirmedPage';
import { api, TENANT_SLUG } from '../utils/apiClient';

interface BrandSettingsPageProps {
  primaryColor?: string;
  setPrimaryColor?: (color: string) => void;
  secondaryColor?: string;
  setSecondaryColor?: (color: string) => void;
}

type BrandRecord = {
  name?: string;
  customDomain?: string | null;
  customDomainStatus?: string;
  publicEmail?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
};

export function BrandSettingsPage(props: BrandSettingsPageProps) {
  const primaryColor = props.primaryColor || '#0F3A53';
  const secondaryColor = props.secondaryColor || '#E3B341';
  const [practiceName, setPracticeName] = useState('Your Practice Name');
  const [customDomain, setCustomDomain] = useState('');
  const [customDomainStatus, setCustomDomainStatus] = useState('PENDING');
  const [publicEmail, setPublicEmail] = useState('');
  const [previewTab, setPreviewTab] = useState<'booking' | 'confirmed'>('booking');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingCustomDomain, setVerifyingCustomDomain] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookingUrl = customDomain
    ? (customDomain.startsWith('http') ? customDomain : `https://${customDomain}`)
    : `https://${TENANT_SLUG || 'practice'}.unclutterdesk.com`;

  useEffect(() => {
    let cancelled = false;
    async function loadBrand() {
      setLoading(true);
      try {
        const brand = await api.get<BrandRecord>('/v1/tenant/brand');
        if (cancelled) return;
        setPracticeName(brand.name || 'Your Practice Name');
        setCustomDomain(brand.customDomain || '');
        setCustomDomainStatus(brand.customDomainStatus || 'PENDING');
        setPublicEmail(brand.publicEmail || '');
        if (brand.primaryColor) props.setPrimaryColor?.(brand.primaryColor);
        if (brand.secondaryColor) props.setSecondaryColor?.(brand.secondaryColor);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load brand settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadBrand();
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.patch('/v1/tenant/brand', {
        name: practiceName,
        customDomain: customDomain || null,
        publicEmail,
        primaryColor,
        secondaryColor,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save brand settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyCustomDomain() {
    setVerifyingCustomDomain(true);
    setError(null);
    try {
      const verified = await api.post<{ customDomain: string | null; customDomainStatus: string }>('/v1/tenant/brand/custom-domain/verify', {});
      setCustomDomain(verified.customDomain || '');
      setCustomDomainStatus(verified.customDomainStatus || 'ACTIVE');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify custom domain');
      setCustomDomainStatus('FAILED');
    } finally {
      setVerifyingCustomDomain(false);
    }
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#F8FAFC]">
      <header className="h-[80px] bg-white border-b border-[#E2E8F0] px-4 md:px-[26px] flex items-center justify-between gap-3 md:gap-5 shrink-0">
        <div>
          <Eyebrow>WHITE-LABEL BRANDING</Eyebrow>
          <h1 className="text-[16px] md:text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Brand & Custom Domain Settings</h1>
        </div>
        <BookingLinkField url={bookingUrl} className="ml-auto hidden md:flex" />
      </header>

      <main className="p-4 md:p-[24px_26px_30px] grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start flex-1">
        <div className="lg:col-span-5 space-y-4 md:space-y-5">
          {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

          <Card padding="p-[22px]" className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
              <Palette className="h-4 w-4 text-[#E3B341]" />
              <Eyebrow>BRAND THEME COLORS</Eyebrow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-[10px_12px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[16px] flex items-center gap-2"><input type="color" value={primaryColor} onChange={(e) => props.setPrimaryColor?.(e.target.value)} className="h-9 w-9 rounded-[10px] border-none cursor-pointer p-0 shrink-0" /><div><span className="text-[11px] font-bold text-[#64748B] block">Primary</span><span className="text-[12px] font-mono font-bold text-[#0F172A] uppercase">{primaryColor}</span></div></div>
              <div className="p-[10px_12px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[16px] flex items-center gap-2"><input type="color" value={secondaryColor} onChange={(e) => props.setSecondaryColor?.(e.target.value)} className="h-9 w-9 rounded-[10px] border-none cursor-pointer p-0 shrink-0" /><div><span className="text-[11px] font-bold text-[#64748B] block">Secondary</span><span className="text-[12px] font-mono font-bold text-[#0F172A] uppercase">{secondaryColor}</span></div></div>
            </div>
          </Card>

          <Card padding="p-[22px]" className="space-y-3">
            <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3"><Globe className="h-4 w-4 text-blue-600" /><Eyebrow>DOMAIN & SENDER</Eyebrow></div>
            {loading ? <div className="text-sm font-medium text-[#64748B]">Loading brand settings...</div> : (
              <div className="space-y-3">
                <div className="space-y-1.5"><label className="text-[11.5px] font-bold text-[#475569]">Practice name</label><input type="text" value={practiceName} onChange={(e) => setPracticeName(e.target.value)} className="w-full h-[44px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] outline-none" /></div>
                <div className="space-y-1.5"><label className="text-[11.5px] font-bold text-[#475569]">Custom hostname</label><input type="text" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="booking.yourpractice.com" className="w-full h-[44px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-mono font-bold text-[#0F172A] outline-none" /></div>
                {customDomain ? (
                  <div className="flex items-center justify-between gap-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2.5">
                    <div className="text-[11.5px] font-medium text-[#475569]">
                      Status:{' '}
                      <span className={`font-bold ${customDomainStatus === 'ACTIVE' ? 'text-emerald-700' : customDomainStatus === 'FAILED' ? 'text-red-700' : 'text-amber-700'}`}>
                        {customDomainStatus}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleVerifyCustomDomain()}
                      disabled={verifyingCustomDomain}
                      className="h-[34px] px-3 rounded-[10px] bg-[#0F3A53] text-white text-[11px] font-bold disabled:opacity-60 cursor-pointer"
                    >
                      {verifyingCustomDomain ? 'Verifying...' : 'Verify domain'}
                    </button>
                  </div>
                ) : null}
                <div className="space-y-1.5"><label className="text-[11.5px] font-bold text-[#475569]">Practice contact email</label><input type="email" value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} className="w-full h-[42px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] outline-none" /></div>
                <button onClick={() => void handleSave()} disabled={saving} className="h-[42px] px-[15px] rounded-[13px] bg-[#0F3A53] text-white text-[13px] font-semibold cursor-pointer disabled:opacity-60">{saving ? 'Saving...' : 'Save brand settings'}</button>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <Card padding="p-[22px]" className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /><Eyebrow>LIVE SCALED PREVIEW PANE</Eyebrow></div>
              <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-[12px]">
                <button onClick={() => setPreviewTab('booking')} className={`px-3 py-1 text-xs font-bold rounded-[8px] transition-all ${previewTab === 'booking' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'}`}>Booking Page</button>
                <button onClick={() => setPreviewTab('confirmed')} className={`px-3 py-1 text-xs font-bold rounded-[8px] transition-all ${previewTab === 'confirmed' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'}`}>Confirmed State</button>
              </div>
            </div>
            <div className="rounded-[20px] border border-[#E2E8F0] bg-[#F8FAFC] p-4 min-h-[500px] flex items-center justify-center overflow-hidden">
              <div className="w-full h-[580px] overflow-auto relative rounded-[16px] bg-slate-50 border border-[#E2E8F0]"><div className="absolute origin-top-left" style={{ width: '1180px', transform: 'scale(0.62)' }}>{previewTab === 'booking' ? <ClientBookingPage /> : <BookingConfirmedPage />}</div></div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
