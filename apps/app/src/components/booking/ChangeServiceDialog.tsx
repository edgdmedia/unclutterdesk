import { useEffect, useMemo, useState } from 'react';
import { Loader2, Repeat, X } from 'lucide-react';
import { api, TENANT_SLUG } from '../../utils/apiClient';
import { useAuth } from '../../context/AuthContext';
import { activeDisplayPrefs, formatTime } from '../../utils/displayFormat';

type Format = 'ONLINE' | 'IN_PERSON';
type Service = {
  id: string;
  title: string;
  durationMinutes: number;
  priceKobo: string;
  formats?: Array<{ format: Format; priceKobo: string; isActive: boolean }>;
};

export interface ChangeServiceSession {
  id: string;
  serviceId?: string | null;
  serviceTitle: string;
  startsAt: string;
  endsAt: string;
  status: string;
  format?: string;
  amountKobo: string | null;
  provider: { name: string };
}

export interface ChangeServiceResult {
  serviceTitle: string;
  endsAt: string;
  balanceKobo: string | null;
  overpaidKobo: string;
}

const naira = (kobo: bigint | string | number) => `₦${(Number(kobo) / 100).toLocaleString('en-NG')}`;
const time = (iso: string) => formatTime(new Date(iso), activeDisplayPrefs());

/** The service's price in the session's format, as the API charges it. */
export function priceIn(s: Service, format: Format): bigint | null {
  const row = (s.formats ?? []).find((f) => f.format === format && f.isActive);
  if (row) return BigInt(row.priceKobo);
  return format === 'ONLINE' && !(s.formats ?? []).length ? BigInt(s.priceKobo) : null;
}

/**
 * Change what a session was booked as (plan 2026-11-04-change-session-service):
 * the client booked Consultation and meant Individual Session. The preview is
 * the API's rule: an unpaid booking takes the new price; a paid one keeps what
 * was paid and owes the difference, for the desk to collect or waive.
 */
export function ChangeServiceDialog({
  session,
  onClose,
  onChanged,
}: {
  session: ChangeServiceSession;
  onClose: () => void;
  onChanged: (r: ChangeServiceResult) => void;
}) {
  const { profile } = useAuth();
  // The public services endpoint names the practice by host; localhost has none.
  const tenantHeaders = TENANT_SLUG || profile?.tenantSlug ? { 'X-Tenant-Slug': TENANT_SLUG || String(profile?.tenantSlug) } : undefined;
  const format: Format = session.format === 'IN_PERSON' ? 'IN_PERSON' : 'ONLINE';

  const [services, setServices] = useState<Service[] | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Service[]>('/v1/consult/public/services', tenantHeaders)
      .then((rows) => setServices(rows.filter((s) => s.id !== session.serviceId && priceIn(s, format) !== null)))
      .catch(() => setServices([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.serviceId, format]);

  const chosen = useMemo(() => services?.find((s) => s.id === serviceId) ?? null, [services, serviceId]);
  const preview = useMemo(() => {
    if (!chosen) return null;
    const price = priceIn(chosen, format) ?? 0n;
    const unpaid = session.status === 'PENDING_PAYMENT';
    const paid = BigInt(session.amountKobo ?? '0');
    const upcoming = new Date(session.startsAt).getTime() > Date.now();
    const endsAt = upcoming ? new Date(new Date(session.startsAt).getTime() + chosen.durationMinutes * 60_000).toISOString() : session.endsAt;
    return {
      price,
      unpaid,
      paid,
      balance: !unpaid && price > paid ? price - paid : 0n,
      overpaid: !unpaid && paid > price ? paid - price : 0n,
      endsAt,
      longer: upcoming && new Date(endsAt) > new Date(session.endsAt),
    };
  }, [chosen, format, session]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.patch<ChangeServiceResult>(`/v1/consult/practice/sessions/${session.id}/service`, { serviceId: chosen.id });
      onChanged(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the service');
    } finally {
      setBusy(false);
    }
  }

  const radio = (checked: boolean) =>
    `flex items-start gap-2 p-2.5 rounded-[12px] border cursor-pointer ${checked ? 'border-[var(--desk-pine-600)] bg-[var(--desk-surface-alt)]' : 'border-[var(--desk-border)]'}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--desk-sidebar)]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="change-service-title">
      <form onSubmit={submit} className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded-[20px] bg-white p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-[var(--desk-pine-600)]" />
            <h2 id="change-service-title" className="text-[16px] font-bold text-[var(--desk-text)]">Change service</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[var(--desk-text-muted)] hover:bg-[var(--desk-surface-muted)] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[13px] text-[var(--desk-text-body)]">
          Booked as <span className="font-bold text-[var(--desk-text)]">{session.serviceTitle}</span>. The client is emailed the change.
        </p>

        {services === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--desk-text-muted)]" />
        ) : services.length === 0 ? (
          <p className="text-[13px] text-[var(--desk-text-muted)]">No other service is offered {format === 'IN_PERSON' ? 'in person' : 'online'}.</p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="text-[12px] font-semibold text-[var(--desk-text-body)] mb-1">Change to</legend>
            {services.map((s) => {
              const price = priceIn(s, format) ?? 0n;
              return (
                <label key={s.id} className={radio(serviceId === s.id)}>
                  <input type="radio" name="service" checked={serviceId === s.id} onChange={() => setServiceId(s.id)} aria-label={`${s.title}, ${s.durationMinutes} minutes, ${naira(price)}`} />
                  <span className="text-[13px] text-[var(--desk-text)]">{s.title} · {s.durationMinutes} min · {naira(price)}</span>
                </label>
              );
            })}
          </fieldset>
        )}

        {preview ? (
          <div className="rounded-[14px] border border-[var(--desk-border)] bg-[var(--desk-surface)] p-3 space-y-1.5 text-[13px] text-[var(--desk-text-body)]" aria-live="polite">
            <p>
              {preview.longer
                ? `Ends at ${time(preview.endsAt)} instead of ${time(session.endsAt)}, if ${session.provider.name} is free then.`
                : `Ends at ${time(preview.endsAt)}.`}
            </p>
            {preview.unpaid ? (
              <p>Not paid yet: the amount to pay becomes <span className="font-bold text-[var(--desk-text)]">{naira(preview.price)}</span>.</p>
            ) : (
              <p>
                New price {naira(preview.price)} · Paid {naira(preview.paid)}
                {preview.balance > 0n ? (
                  <> · <span className="font-bold text-[var(--desk-pending)]">Balance {naira(preview.balance)}</span></>
                ) : null}
              </p>
            )}
            {preview.balance > 0n ? <p className="text-[12px] text-[var(--desk-text-muted)]">Record the balance as paid at the practice, or waive it, from the session page.</p> : null}
            {preview.overpaid > 0n ? (
              <p className="text-[12px] text-[var(--desk-text-muted)]">The client paid {naira(preview.overpaid)} more than the new price. Refunds are made by hand, if you agree to one.</p>
            ) : null}
          </div>
        ) : null}

        {error ? <p role="alert" className="text-[12.5px] font-medium text-[var(--desk-danger)]">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-[40px] px-4 rounded-[12px] bg-white border border-[var(--desk-border)] text-[var(--desk-text)] text-[13px] font-bold cursor-pointer">
            Keep it
          </button>
          <button type="submit" disabled={!chosen || busy} className="h-[40px] px-4 rounded-[12px] bg-[var(--desk-pine-600)] text-white text-[13px] font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Change service
          </button>
        </div>
      </form>
    </div>
  );
}
