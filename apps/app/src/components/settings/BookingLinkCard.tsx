import React, { useEffect, useState } from 'react';
import { Card, Eyebrow, useToast } from '@unclutterdesk/ui';
import { api, getBookingUrl } from '../../utils/apiClient';

const inputCls = 'w-full h-[44px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-mono font-bold text-[#0F172A] outline-none';

/** The same rule the API applies: lowercase letters, numbers and dashes. */
function toSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').slice(0, 63);
}

/** The practice's unclutterdesk.com address. A custom domain is a separate setting. */
export function BookingLinkCard({ slug: saved, onSaved }: { slug: string; onSaved?: (slug: string) => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState(saved);
  const [slug, setSlug] = useState(saved);
  const [check, setCheck] = useState<{ available: boolean; reason?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(saved);
    setSlug(saved);
  }, [saved]);

  const cleaned = slug.replace(/-+$/, '');
  const changed = cleaned.length > 0 && cleaned !== current;

  useEffect(() => {
    setCheck(null);
    if (!changed || cleaned.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .get<{ available: boolean; reason?: string }>(`/v1/tenant/check-slug/${cleaned}`)
        .then((r) => {
          if (!cancelled) setCheck(r);
        })
        .catch(() => {
          // The save will report any problem.
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cleaned, changed]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.patch('/v1/tenant/brand', { slug: cleaned });
      setCurrent(cleaned);
      setSlug(cleaned);
      toast.success('Booking link saved');
      onSaved?.(cleaned);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the booking link');
    } finally {
      setSaving(false);
    }
  }

  const taken = check !== null && !check.available;

  return (
    <Card padding="p-[22px]" className="space-y-3">
      <div>
        <Eyebrow>BOOKING LINK</Eyebrow>
        <p className="mt-1 text-xs text-[#64748B]">Where clients find and book your practice.</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="booking-link" className="text-[11.5px] font-bold text-[#475569]">Booking link</label>
        <input id="booking-link" value={slug} onChange={(e) => setSlug(toSlug(e.target.value))} className={inputCls} />
      </div>
      {cleaned ? <p className="text-xs font-semibold text-[#0F3A53] break-all">{getBookingUrl(cleaned)}</p> : null}
      {taken ? (
        <p className="text-xs font-semibold text-red-600">
          {check?.reason && check.reason !== 'Slug is already taken' ? check.reason : 'That link is already taken.'}
        </p>
      ) : null}
      {changed && !taken ? (
        <p className="text-xs text-amber-700">Your old link will stop working. Update it anywhere you've shared it.</p>
      ) : null}
      {error ? <p role="alert" className="text-xs font-semibold text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={() => void save()}
        disabled={!changed || saving || taken || check === null}
        className="h-10 px-4 rounded-[12px] bg-[#0F3A53] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save booking link'}
      </button>
    </Card>
  );
}
