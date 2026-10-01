import React, { useEffect, useState } from 'react';
import { Globe, Palette, Sparkles } from 'lucide-react';
import { Eyebrow, Card, BookingLinkField, useToast } from '@unclutterdesk/ui';
import { BookingWizardPage } from '../../public/booking/BookingWizardPage';
import { BookingConfirmedPage } from '../../public/BookingConfirmedPage';
import { api, practiceBookingUrl } from '../../../utils/apiClient';
import { usePracticeBrand } from '../../../context/PracticeBrandContext';
import { SendingDomainCard } from '../../../components/email/SendingDomainCard';
import { LogoField } from '../../../components/settings/LogoField';
import { BookingLinkCard } from '../../../components/settings/BookingLinkCard';

type BrandRecord = {
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  customDomain?: string | null;
  customDomainStatus?: string;
  customDomainTarget?: string | null;
  publicEmail?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
};

const fieldCls = 'w-full h-[44px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] outline-none';

/**
 * Everything setup asks about the practice's look, editable again: logo,
 * colours, name and contact email, the booking link, and a custom domain.
 */
export function BrandSettingsPage() {
  const toast = useToast();
  const { refresh } = usePracticeBrand();
  const [practiceName, setPracticeName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0F3A53');
  const [secondaryColor, setSecondaryColor] = useState('#E3B341');
  const [customDomain, setCustomDomain] = useState('');
  const [customDomainStatus, setCustomDomainStatus] = useState('PENDING');
  const [customDomainTarget, setCustomDomainTarget] = useState<string | null>(null);
  const [publicEmail, setPublicEmail] = useState('');
  const [previewTab, setPreviewTab] = useState<'booking' | 'confirmed'>('booking');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDomain, setSavingDomain] = useState(false);
  const [verifyingCustomDomain, setVerifyingCustomDomain] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookingUrl = practiceBookingUrl(slug, customDomain, customDomainStatus);

  useEffect(() => {
    let cancelled = false;
    async function loadBrand() {
      setLoading(true);
      try {
        const brand = await api.get<BrandRecord>('/v1/tenant/brand');
        if (cancelled) return;
        setPracticeName(brand.name || '');
        setSlug(brand.slug || '');
        setLogoUrl(brand.logoUrl || '');
        setCustomDomain(brand.customDomain || '');
        setCustomDomainStatus(brand.customDomainStatus || 'PENDING');
        setCustomDomainTarget(brand.customDomainTarget ?? null);
        setPublicEmail(brand.publicEmail || '');
        if (brand.primaryColor) setPrimaryColor(brand.primaryColor);
        if (brand.secondaryColor) setSecondaryColor(brand.secondaryColor);
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
        publicEmail,
        primaryColor,
        secondaryColor,
        // null clears it: an empty value used to be dropped, so a removed logo came back.
        logoUrl: logoUrl || null,
      });
      toast.success('Brand saved');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save brand settings');
      setError(err instanceof Error ? err.message : 'Unable to save brand settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDomain() {
    setSavingDomain(true);
    setError(null);
    try {
      await api.patch('/v1/tenant/brand', { customDomain: customDomain || null });
      setCustomDomainStatus('PENDING');
      toast.success(customDomain ? 'Domain saved. Add the DNS record, then verify.' : 'Custom domain removed');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the custom domain');
    } finally {
      setSavingDomain(false);
    }
  }

  async function handleVerifyCustomDomain() {
    setVerifyingCustomDomain(true);
    setError(null);
    try {
      const verified = await api.post<{ customDomain: string | null; customDomainStatus: string }>('/v1/tenant/brand/custom-domain/verify', {});
      setCustomDomain(verified.customDomain || '');
      setCustomDomainStatus(verified.customDomainStatus || 'ACTIVE');
      toast.success('Domain verified and live');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify custom domain');
      // The API records why: FAILED for DNS, PENDING while the certificate issues.
      const brand = await api.get<BrandRecord>('/v1/tenant/brand').catch(() => null);
      setCustomDomainStatus(brand?.customDomainStatus || 'FAILED');
    } finally {
      setVerifyingCustomDomain(false);
    }
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#F8FAFC]">
      <header className="h-[80px] bg-white border-b border-[#E2E8F0] px-4 md:px-[26px] flex items-center justify-between gap-3 md:gap-5 shrink-0">
        <div>
          <Eyebrow>BRAND & BOOKING PAGE</Eyebrow>
          <h1 className="text-[16px] md:text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">How clients see your practice</h1>
        </div>
        {slug ? <BookingLinkField url={bookingUrl} className="ml-auto hidden md:flex" /> : null}
      </header>

      <main className="p-4 md:p-[24px_26px_30px] grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start flex-1">
        <div className="lg:col-span-5 space-y-4 md:space-y-5">
          {error ? <div role="alert" className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

          {loading ? (
            <Card padding="p-[22px]"><div className="text-sm font-medium text-[#64748B]">Loading brand settings…</div></Card>
          ) : (
            <>
              <Card padding="p-[22px]" className="space-y-4">
                <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
                  <Palette className="h-4 w-4 text-[#E3B341]" />
                  <Eyebrow>BRAND</Eyebrow>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11.5px] font-bold text-[#475569] block">Logo</span>
                  <LogoField value={logoUrl} onChange={setLogoUrl} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="p-[10px_12px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[16px] flex items-center gap-2 cursor-pointer">
                    <input type="color" aria-label="Primary colour" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-9 rounded-[10px] border-none cursor-pointer p-0 shrink-0" />
                    <span><span className="text-[11px] font-bold text-[#64748B] block">Primary</span><span className="text-[12px] font-mono font-bold text-[#0F172A] uppercase">{primaryColor}</span></span>
                  </label>
                  <label className="p-[10px_12px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[16px] flex items-center gap-2 cursor-pointer">
                    <input type="color" aria-label="Accent colour" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-9 rounded-[10px] border-none cursor-pointer p-0 shrink-0" />
                    <span><span className="text-[11px] font-bold text-[#64748B] block">Accent</span><span className="text-[12px] font-mono font-bold text-[#0F172A] uppercase">{secondaryColor}</span></span>
                  </label>
                </div>
                <div className="space-y-1.5"><label htmlFor="brand-name" className="text-[11.5px] font-bold text-[#475569]">Practice name</label><input id="brand-name" type="text" value={practiceName} onChange={(e) => setPracticeName(e.target.value)} className={fieldCls} /></div>
                <div className="space-y-1.5"><label htmlFor="brand-email" className="text-[11.5px] font-bold text-[#475569]">Practice contact email</label><input id="brand-email" type="email" value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} className={fieldCls} /></div>
                <button onClick={() => void handleSave()} disabled={saving} className="h-[42px] px-[15px] rounded-[13px] bg-[#0F3A53] text-white text-[13px] font-semibold cursor-pointer disabled:opacity-60">{saving ? 'Saving…' : 'Save brand'}</button>
              </Card>

              <BookingLinkCard
                slug={slug}
                onSaved={(next) => {
                  setSlug(next);
                  void refresh();
                }}
              />

              <Card padding="p-[22px]" className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3"><Globe className="h-4 w-4 text-blue-600" /><Eyebrow>CUSTOM DOMAIN</Eyebrow></div>
                <p className="text-[11.5px] text-[#64748B] leading-relaxed">Optional. Use your own address, such as booking.yourpractice.com, instead of the booking link above.</p>
                <div className="space-y-1.5"><label htmlFor="custom-domain" className="text-[11.5px] font-bold text-[#475569]">Custom domain</label><input id="custom-domain" type="text" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="booking.yourpractice.com" className={`${fieldCls} font-mono font-bold`} /></div>
                {!customDomainTarget ? (
                  <p className="text-[11.5px] text-[#64748B] leading-relaxed">
                    Custom domains are not available yet. Clients book you at your booking link above.
                  </p>
                ) : customDomain && customDomainStatus !== 'ACTIVE' ? (
                  <p className="text-[11.5px] text-[#64748B] leading-relaxed">
                    Save, then at your domain provider add a <span className="font-bold">CNAME</span> record for{' '}
                    <span className="font-mono font-bold text-[#0F172A]">{customDomain}</span> with the value{' '}
                    <span className="font-mono font-bold text-[#0F172A]">{customDomainTarget}</span>, and press Verify.
                  </p>
                ) : null}
                {customDomain && customDomainTarget ? (
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
                      {verifyingCustomDomain ? 'Verifying…' : 'Verify domain'}
                    </button>
                  </div>
                ) : null}
                <button onClick={() => void handleSaveDomain()} disabled={savingDomain} className="h-[40px] px-[15px] rounded-[12px] border border-[#E2E8F0] bg-white text-[#0F172A] text-[12.5px] font-semibold cursor-pointer disabled:opacity-60">{savingDomain ? 'Saving…' : 'Save domain'}</button>
              </Card>
            </>
          )}

          <SendingDomainCard />
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
              <div className="w-full h-[580px] overflow-auto relative rounded-[16px] bg-slate-50 border border-[#E2E8F0]"><div className="absolute origin-top-left pointer-events-none select-none" aria-hidden="true" style={{ width: '1180px', transform: 'scale(0.62)' }}>{previewTab === 'booking' ? <BookingWizardPage previewSlug={slug} /> : <BookingConfirmedPage />}</div></div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
