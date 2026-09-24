import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Power, PowerOff, Clock } from 'lucide-react';
import { Card, Eyebrow, useBrand } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';

interface Service {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  priceKobo: string;
  isActive: boolean;
}

interface Draft {
  id?: string;
  title: string;
  description: string;
  durationMinutes: string;
  priceNaira: string;
}

const EMPTY_DRAFT: Draft = { title: '', description: '', durationMinutes: '50', priceNaira: '' };

function formatNaira(kobo: string): string {
  return `₦${(Number(kobo) / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function nairaToKobo(value: string): string {
  const naira = Number(value.replace(/[^0-9.]/g, '') || 0);
  return String(Math.round(naira * 100));
}

const inputCls =
  'w-full h-[44px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] outline-none focus:border-[#94A3B8]';
const labelCls = 'text-[11.5px] font-bold text-[#475569]';

/**
 * Services & pricing. Until this page existed, services could only be created
 * by the onboarding wizard, and the sidebar link to it went nowhere.
 */
export function ServicesSettingsPage() {
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Service[]>('/v1/consult/services')
      .then((list) => {
        if (!cancelled) setServices(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load your services.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function edit(service: Service) {
    setError(null);
    setDraft({
      id: service.id,
      title: service.title,
      description: service.description ?? '',
      durationMinutes: String(service.durationMinutes),
      priceNaira: String(Number(service.priceKobo) / 100),
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    const body = {
      title: draft.title,
      description: draft.description || null,
      durationMinutes: Number(draft.durationMinutes),
      priceKobo: nairaToKobo(draft.priceNaira),
    };
    try {
      if (draft.id) {
        const updated = await api.patch<Service>(`/v1/consult/services/${draft.id}`, body);
        setServices((current) => current.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const created = await api.post<Service>('/v1/consult/services', body);
        setServices((current) => [...current, { description: null, isActive: true, ...created }]);
      }
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save this service.');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(service: Service, isActive: boolean) {
    setError(null);
    try {
      const updated = await api.patch<Service>(`/v1/consult/services/${service.id}`, { isActive });
      setServices((current) => current.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update this service.');
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] min-w-0">
      <header className="min-h-[72px] md:h-[88px] bg-white border-b border-[#E2E8F0] px-4 md:px-[26px] py-3 flex items-center justify-between gap-4 shrink-0">
        <div>
          <Eyebrow>SETTINGS</Eyebrow>
          <h1 className="text-[16px] md:text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Services & pricing</h1>
          <p className="hidden md:block text-xs text-[#64748B] font-medium">
            What clients can book, how long it takes, and what it costs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setDraft({ ...EMPTY_DRAFT });
          }}
          className="h-10 px-4 rounded-[12px] text-white text-xs font-bold flex items-center gap-2 hover:brightness-110 transition-all cursor-pointer shrink-0"
          style={{ backgroundColor: primaryColor }}
        >
          <Plus className="h-4 w-4" />
          Add service
        </button>
      </header>

      <main className="p-4 md:p-[24px_26px_30px] grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
        <div className="lg:col-span-7 space-y-3">
          {error ? (
            <div role="alert" className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <Card padding="p-[22px]"><p className="text-sm font-medium text-[#64748B]">Loading services…</p></Card>
          ) : services.length === 0 ? (
            <Card padding="p-[22px]">
              <p className="text-sm font-semibold text-[#0F172A]">No services yet</p>
              <p className="mt-1 text-xs text-[#64748B]">Add a service so clients have something to book.</p>
            </Card>
          ) : (
            services.map((service) => (
              <Card key={service.id} padding="p-[18px]" className={service.isActive ? '' : 'opacity-60'}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-[#0F172A]">{service.title}</span>
                      {!service.isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] bg-[#F1F5F9] rounded-full px-2 py-0.5">
                          Not bookable
                        </span>
                      )}
                    </div>
                    {service.description ? (
                      <p className="mt-1 text-xs text-[#64748B] leading-relaxed">{service.description}</p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-[#475569]">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{service.durationMinutes} min</span>
                      <span>{Number(service.priceKobo) === 0 ? 'Free' : formatNaira(service.priceKobo)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => edit(service)}
                      aria-label={`Edit ${service.title}`}
                      className="h-9 w-9 rounded-[10px] border border-[#E2E8F0] bg-white text-[#475569] flex items-center justify-center hover:bg-[#F8FAFC] cursor-pointer"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void setActive(service, !service.isActive)}
                      aria-label={service.isActive ? `Stop offering ${service.title}` : `Offer ${service.title} again`}
                      title={service.isActive ? 'Stop offering' : 'Offer again'}
                      className="h-9 w-9 rounded-[10px] border border-[#E2E8F0] bg-white text-[#475569] flex items-center justify-center hover:bg-[#F8FAFC] cursor-pointer"
                    >
                      {service.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-5">
          {draft ? (
            <Card padding="p-[22px]">
              <form onSubmit={(e) => void save(e)} className="space-y-3">
                <Eyebrow>{draft.id ? 'EDIT SERVICE' : 'NEW SERVICE'}</Eyebrow>
                <div className="space-y-1.5">
                  <label htmlFor="service-title" className={labelCls}>Name</label>
                  <input id="service-title" required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Individual Therapy" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="service-description" className={labelCls}>Description <span className="font-normal text-[#94A3B8]">(optional)</span></label>
                  <textarea id="service-description" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="w-full p-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] outline-none focus:border-[#94A3B8] resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="service-duration" className={labelCls}>Length (minutes)</label>
                    <input id="service-duration" type="number" min={10} max={480} required value={draft.durationMinutes} onChange={(e) => setDraft({ ...draft, durationMinutes: e.target.value })} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="service-price" className={labelCls}>Price (₦)</label>
                    <input id="service-price" inputMode="decimal" value={draft.priceNaira} onChange={(e) => setDraft({ ...draft, priceNaira: e.target.value })} placeholder="0 for free" className={inputCls} />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button type="submit" disabled={saving} className="h-[42px] px-[15px] rounded-[13px] text-white text-[13px] font-semibold cursor-pointer disabled:opacity-60" style={{ backgroundColor: primaryColor }}>
                    {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Add service'}
                  </button>
                  <button type="button" onClick={() => setDraft(null)} className="h-[42px] px-[15px] rounded-[13px] border border-[#E2E8F0] bg-white text-[13px] font-semibold text-[#475569] cursor-pointer">
                    Cancel
                  </button>
                </div>
              </form>
            </Card>
          ) : (
            <Card padding="p-[22px]">
              <p className="text-xs text-[#64748B] leading-relaxed">
                Changing a price only affects new bookings. Services you stop offering disappear from your
                booking page but stay on the bookings already made with them.
              </p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
