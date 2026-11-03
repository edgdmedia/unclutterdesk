import React, { useEffect, useState } from 'react';
import { Palette, Sparkles } from 'lucide-react';
import { Card, Eyebrow, Page, PageHeader, BookingLinkField, useToast, ScaledPreview } from '@unclutterdesk/ui';
import { BookingWizardPage } from '../../public/booking/BookingWizardPage';
import { BookingConfirmedPage } from '../../public/BookingConfirmedPage';
import { api, practiceBookingUrl } from '../../../utils/apiClient';
import { usePracticeBrand } from '../../../context/PracticeBrandContext';
import { LogoField } from '../../../components/settings/LogoField';

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
  const [publicEmail, setPublicEmail] = useState('');
  const [previewTab, setPreviewTab] = useState<'booking' | 'confirmed'>('booking');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  return (
    <Page
      header={
        <PageHeader
          eyebrow="BRAND & BOOKING PAGE"
          title="How clients see your practice"
          actions={slug ? <BookingLinkField url={bookingUrl} className="hidden md:flex" /> : undefined}
        />
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
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

            </>
          )}
        </div>

        <div className="lg:col-span-7 space-y-4">
          <ScaledPreview
            width={1180}
            minHeight={580}
            showDeviceSwitch={true}
            showFullScreen={true}
            fullScreenLabel="View full booking page"
            onFullScreen={() => window.open(bookingUrl, '_blank')}
            className="h-full"
          >
            {previewTab === 'booking' ? <BookingWizardPage previewSlug={slug} /> : <BookingConfirmedPage />}
          </ScaledPreview>
        </div>
      </div>
    </Page>
  );
}
