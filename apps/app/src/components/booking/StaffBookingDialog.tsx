import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Loader2, Plus, X } from 'lucide-react';
import { api, TENANT_SLUG } from '../../utils/apiClient';
import { useAuth } from '../../context/AuthContext';
import { formatWhen } from '../../utils/displayFormat';
import { SlotDayPicker } from './SlotDayPicker';

type Service = { id: string; title: string; durationMinutes: number; priceKobo: string };
type StaffRow = { kind: 'member' | 'invite'; id: string; firstName: string | null; lastName: string | null; status: string; isTherapist: boolean };
type Staff = { id: string; name: string };
type Slot = { id: string; startsAt: string; endsAt: string; formats?: Array<'ONLINE' | 'IN_PERSON'>; location?: { id?: string; name: string; city: string } | null };
type Payment = 'LINK' | 'PAID' | 'NONE';
export type StaffBookingResult = { bookingId: string; status: 'PENDING_PAYMENT' | 'CONFIRMED' };
/** Sessions added with no time yet (§11.2): the client chooses the times later. */
export type ScheduledLaterResult = { count: number; planSessionIds: string[] };
/** As the API: more at once is a plan (§11.2, later). */
const MAX_LATER = 12;
/** A time added to the list, to book with the others in one go. */
type Pick = { availabilityId?: string; startsAt: string; format?: 'ONLINE' | 'IN_PERSON'; locationId?: string };
/** As the API: more than this at once is a session plan (§11.2). */
const MAX_AT_ONCE = 8;

const naira = (kobo: string | number) => `₦${(Number(kobo) / 100).toLocaleString('en-NG')}`;

const PAYMENTS: Array<{ value: Payment; label: string; hint: string; frontDeskOnly?: boolean }> = [
  { value: 'LINK', label: 'Send a payment link', hint: 'The client pays online. The time is held for up to 48 hours.' },
  { value: 'PAID', label: 'Mark as paid', hint: 'Money already received, in cash or by transfer.', frontDeskOnly: true },
  { value: 'NONE', label: 'No charge', hint: 'The practice waives the fee for this session.' },
];

export function StaffBookingDialog({
  client,
  onClose,
  onBooked,
}: {
  client: { id: string; name: string } | null;
  onClose: () => void;
  onBooked: (r: StaffBookingResult | ScheduledLaterResult) => void;
}) {
  const { profile } = useAuth();
  const role = String(profile?.role ?? '').toUpperCase();
  const isTherapist = role === 'THERAPIST';
  const payments = PAYMENTS.filter((p) => !(p.frontDeskOnly && isTherapist));
  // The public services and availability endpoints name the practice by host,
  // which localhost has none of; fall back to the signed-in profile's slug.
  const tenantHeaders = TENANT_SLUG || profile?.tenantSlug
    ? { 'X-Tenant-Slug': TENANT_SLUG || String(profile?.tenantSlug) }
    : undefined;

  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState(client?.id ?? '');
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [providerId, setProviderId] = useState(String(profile?.id ?? ''));
  // 'later': paid at the practice (or no charge) now, the client chooses the times.
  const [mode, setMode] = useState<'slot' | 'custom' | 'later'>('slot');
  const [laterCount, setLaterCount] = useState('1');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState('');
  // SET-06: the format for this booking; a slot that allows one fixes it.
  const [format, setFormat] = useState<'ONLINE' | 'IN_PERSON' | ''>('');
  const [locationId, setLocationId] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string; city: string }>>([]);
  const [customAt, setCustomAt] = useState('');
  const [payment, setPayment] = useState<Payment>('LINK');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [notifyClient, setNotifyClient] = useState(true);
  const [busy, setBusy] = useState(false);
  // Several sessions at once: times already added, booked with the current one.
  const [picks, setPicks] = useState<Pick[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Service[]>('/v1/consult/public/services', tenantHeaders).then(setServices).catch(() => setServices([]));
    if (!isTherapist) {
      // The roster also lists pending invites and receptionists; only active practitioners can be booked.
      api
        .get<StaffRow[]>('/v1/tenant/staff')
        .then((rows) => {
          const practitioners = rows
            .filter((m) => m.kind === 'member' && m.isTherapist && m.status === 'active')
            .map((m) => ({ id: m.id, name: `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() }));
          setStaff(practitioners);
          // The signed-in person may not see clients (a receptionist never
          // does). Start on a real practitioner rather than on them.
          setProviderId((current) => (practitioners.some((m) => m.id === current) ? current : practitioners[0]?.id ?? ''));
        })
        // Unknown is not the same as none: say nothing rather than "no practitioner".
        .catch(() => setStaff(null));
    }
    if (!client) {
      api.get<Array<{ id: string; name: string }>>('/v1/tenant/clients').then(setClients).catch(() => setClients([]));
    }
  }, [client, isTherapist]);

  useEffect(() => {
    setSlotId('');
    if (!serviceId || !providerId || mode !== 'slot') return setSlots([]);
    api
      .get<Slot[]>(`/v1/consult/public/availability?providerProfileId=${providerId}&serviceId=${serviceId}`, tenantHeaders)
      .then((r) => setSlots(r ?? []))
      .catch(() => setSlots([]));
  }, [serviceId, providerId, mode]);

  const service = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);
  const chosenSlot = slots.find((x) => x.id === slotId) ?? null;
  const slotFormats = chosenSlot?.formats?.length ? chosenSlot.formats : ['ONLINE'] as Array<'ONLINE' | 'IN_PERSON'>;
  useEffect(() => {
    if (mode === 'slot') return;
    api.get<typeof locations>('/v1/tenant/locations', tenantHeaders).then((r) => setLocations(r ?? [])).catch(() => setLocations([]));
  }, [mode]);
  // Another service or practitioner means other times: start the list again.
  useEffect(() => setPicks([]), [serviceId, providerId]);
  const started = mode === 'slot' ? !!slotId : !!customAt;
  const timeReady = started
    && (mode === 'custom' ? format !== '' : slotFormats.length === 1 || format !== '')
    && (format !== 'IN_PERSON' || (mode === 'slot' ? true : locationId !== ''));
  const laterN = Number(laterCount);
  const laterReady =
    Number.isInteger(laterN) && laterN >= 1 && laterN <= MAX_LATER && format !== '' && (format !== 'IN_PERSON' || locationId !== '');
  const ready = clientId && serviceId && (mode === 'later' ? laterReady : timeReady || (picks.length > 0 && !started));
  // A payment link needs a time to hold; sessions without one are paid at the practice.
  const shownPayments = mode === 'later' ? payments.filter((p) => p.value !== 'LINK') : payments;
  const currentPick = (): Pick => ({
    ...(mode === 'slot' ? { availabilityId: slotId, startsAt: chosenSlot?.startsAt ?? '' } : { startsAt: new Date(customAt).toISOString() }),
    format: (format || (slotFormats.length === 1 ? slotFormats[0] : undefined)) as Pick['format'],
    locationId: format === 'IN_PERSON' && mode === 'custom' ? locationId : undefined,
  });
  const all = [...picks, ...(timeReady ? [currentPick()] : [])];
  function addAnother() {
    if (!timeReady) return;
    setPicks((p) => [...p, currentPick()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    setSlotId('');
    setCustomAt('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const common = {
        clientProfileId: clientId,
        serviceId,
        providerProfileId: providerId || undefined,
        payment,
        ...(payment === 'PAID' && amount ? { amountKobo: String(Math.round(Number(amount) * 100)) } : {}),
        note: note || undefined,
        notifyClient,
      };
      if (mode === 'later') {
        const r = await api.post<ScheduledLaterResult>('/v1/consult/practice/plan-sessions', {
          clientProfileId: clientId,
          serviceId,
          providerProfileId: providerId || undefined,
          count: laterN,
          format,
          locationId: format === 'IN_PERSON' ? locationId : undefined,
          payment,
          ...(payment === 'PAID' && amount ? { amountKobo: String(Math.round(Number(amount) * 100)) } : {}),
          notifyClient,
        });
        onBooked(r);
      } else if (all.length > 1) {
        // All or none: the API books every time in one transaction.
        const r = await api.post<{ bookings: StaffBookingResult[] }>('/v1/consult/practice/bookings/several', {
          ...common,
          times: all.map(({ availabilityId, startsAt, format: f, locationId: l }) => (availabilityId ? { availabilityId, format: f } : { startsAt, format: f, locationId: l })),
        });
        onBooked(r.bookings[0]);
      } else {
        const one = all[0];
        const result = await api.post<StaffBookingResult>('/v1/consult/practice/bookings', {
          ...common,
          ...(one.availabilityId ? { availabilityId: one.availabilityId } : { startsAt: one.startsAt }),
          format: one.format,
          locationId: one.locationId,
        });
        onBooked(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not book the session');
      setBusy(false);
    }
  }

  const radio = (checked: boolean) =>
    `flex items-start gap-2 p-2.5 rounded-[12px] border cursor-pointer ${checked ? 'border-[var(--desk-pine-600)] bg-[var(--desk-surface-alt)]' : 'border-[var(--desk-border)]'}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--desk-sidebar)]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="staff-booking-title">
      <form onSubmit={submit} className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-[20px] bg-white p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-[var(--desk-pine-600)]" />
            <h2 id="staff-booking-title" className="text-[16px] font-bold text-[var(--desk-text)]">
              {client ? `Book a session for ${client.name}` : 'New booking'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[var(--desk-text-muted)] hover:bg-[var(--desk-surface-muted)] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!client && (
          <label className="block text-[12px] font-semibold text-[var(--desk-text-body)]">
            Client
            <select className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[var(--desk-border)] text-[13px]" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Choose a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}

        <fieldset className="space-y-2">
          <legend className="text-[12px] font-semibold text-[var(--desk-text-body)] mb-1">Service</legend>
          {services.map((s) => (
            <label key={s.id} className={radio(serviceId === s.id)}>
              <input type="radio" name="service" checked={serviceId === s.id} onChange={() => setServiceId(s.id)} aria-label={`${s.title}, ${s.durationMinutes} minutes, ${naira(s.priceKobo)}`} />
              <span className="text-[13px] text-[var(--desk-text)]">{s.title} · {s.durationMinutes} min · {naira(s.priceKobo)}</span>
            </label>
          ))}
        </fieldset>

        {!isTherapist && staff && staff.length === 0 ? (
          <p className="text-[12.5px] font-medium text-rose-700">
            No practitioner can take bookings yet. Add one under Team &amp; staff, or set up your own practitioner profile.
          </p>
        ) : null}

        {!isTherapist && staff && (staff.length > 1 || (staff.length === 1 && staff[0].id !== String(profile?.id ?? ''))) && (
          <label className="block text-[12px] font-semibold text-[var(--desk-text-body)]">
            Practitioner
            <select aria-label="Practitioner" className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[var(--desk-border)] text-[13px]" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              {staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}

        <fieldset className="space-y-2">
          <legend className="text-[12px] font-semibold text-[var(--desk-text-body)] mb-1">Time</legend>
          <div className="flex gap-2">
            <label className={radio(mode === 'slot')}><input type="radio" name="mode" checked={mode === 'slot'} onChange={() => { setMode('slot'); }} aria-label="Open slots" /><span className="text-[13px]">Open slots</span></label>
            <label className={radio(mode === 'custom')}><input type="radio" name="mode" checked={mode === 'custom'} onChange={() => { setMode('custom'); setFormat((f) => f || 'ONLINE'); }} aria-label="Custom time" /><span className="text-[13px]">Custom time</span></label>
            <label className={radio(mode === 'later')}>
              <input
                type="radio"
                name="mode"
                checked={mode === 'later'}
                onChange={() => {
                  setMode('later');
                  setFormat((f) => f || 'ONLINE');
                  setPicks([]);
                  setPayment((p) => (p === 'LINK' ? (isTherapist ? 'NONE' : 'PAID') : p));
                }}
                aria-label="Client chooses later"
              />
              <span className="text-[13px]">Client chooses later</span>
            </label>
          </div>
          {mode === 'later' ? (
            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold text-[var(--desk-text-body)]">
                How many sessions
                <input type="number" min={1} max={MAX_LATER} step={1} aria-label="How many sessions" className="mt-1 w-[120px] h-[40px] px-3 rounded-[12px] border border-[var(--desk-border)] text-[13px] block" value={laterCount} onChange={(e) => setLaterCount(e.target.value)} />
              </label>
              <p className="text-[11.5px] text-[var(--desk-text-muted)]">
                Paid now, at the practice. The client chooses each time from the practitioner's open times in their portal, and you can choose for them from their client page.
              </p>
            </div>
          ) : mode === 'slot' ? (
            serviceId ? (
              slots.length ? (
                <SlotDayPicker
                  name="slot"
                  slots={slots.filter((x) => !picks.some((p) => p.availabilityId === x.id))}
                  value={slotId}
                  onChange={(s) => {
                    setSlotId(s.id);
                    const full = slots.find((x) => x.id === s.id);
                    const fs: Array<'ONLINE' | 'IN_PERSON'> = full?.formats?.length ? full.formats : ['ONLINE'];
                    setFormat(fs.length === 1 ? fs[0] : '');
                  }}
                />
              ) : <p className="text-[12px] text-[var(--desk-text-muted)]">No open slots. Use a custom time.</p>
            ) : <p className="text-[12px] text-[var(--desk-text-muted)]">Choose a service first.</p>
          ) : (
            <label className="block text-[12px] font-semibold text-[var(--desk-text-body)]">
              Date and time
              <input type="datetime-local" aria-label="Date and time" className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[var(--desk-border)] text-[13px]" value={customAt} onChange={(e) => setCustomAt(e.target.value)} />
              <span className="block mt-1 text-[11.5px] font-normal text-[var(--desk-text-muted)]">
                This can fall outside working hours. Any open slot it overlaps is closed.
                {service ? ` The session runs for ${service.durationMinutes} minutes.` : ''}
              </span>
            </label>
          )}
        </fieldset>

        {(mode !== 'slot' || slotFormats.length > 1) ? (
          <fieldset className="space-y-2">
            <legend className="text-[12px] font-semibold text-[var(--desk-text-body)] mb-1">Format</legend>
            {(['ONLINE', 'IN_PERSON'] as const).filter((f) => mode !== 'slot' || slotFormats.includes(f)).map((f) => (
              <label key={f} className={radio(format === f)}>
                <input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} aria-label={f === 'ONLINE' ? 'Online' : 'In person'} />
                <span className="text-[13px]">{f === 'ONLINE' ? 'Online' : 'In person'}</span>
              </label>
            ))}
            {format === 'IN_PERSON' && mode !== 'slot' ? (
              <label className="block text-[12px] font-semibold text-[var(--desk-text-body)]">
                Location
                <select className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[var(--desk-border)] text-[13px]" value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Location">
                  <option value="">Choose a location…</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}, {l.city}</option>)}
                </select>
              </label>
            ) : null}
          </fieldset>
        ) : null}

        {mode !== 'later' ? (
        <div className="space-y-2">
          {picks.length ? (
            <div className="rounded-[12px] border border-[var(--desk-border)] bg-[var(--desk-surface)] p-3 space-y-1.5">
              <p className="text-[12px] font-semibold text-[var(--desk-text-body)]">
                Booking {all.length} sessions{timeReady ? ' (with the time chosen above)' : ''}
              </p>
              <ul className="space-y-1">
                {picks.map((p, i) => (
                  <li key={`${p.availabilityId ?? p.startsAt}`} className="flex items-center justify-between gap-2 text-[13px] text-[var(--desk-text)]">
                    <span>{formatWhen(p.startsAt, 'short')}{p.format === 'IN_PERSON' ? ' · In person' : ''}</span>
                    <button type="button" onClick={() => setPicks((all) => all.filter((_, j) => j !== i))} aria-label={`Remove ${formatWhen(p.startsAt, 'short')}`} className="h-6 w-6 inline-flex items-center justify-center rounded-[6px] text-[var(--desk-text-muted)] hover:bg-[var(--desk-surface-muted)] cursor-pointer">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <button
            type="button"
            onClick={addAnother}
            disabled={!timeReady || all.length >= MAX_AT_ONCE}
            className="h-[36px] px-3 rounded-[10px] border border-dashed border-[var(--desk-pine-300)] text-[12.5px] font-bold text-[var(--desk-pine-600)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" /> Add another time
          </button>
          {!picks.length ? (
            <p className="text-[11.5px] text-[var(--desk-text-muted)]">To book several sessions together, choose a time and add another.</p>
          ) : null}
        </div>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-[12px] font-semibold text-[var(--desk-text-body)] mb-1">Payment</legend>
          {shownPayments.map((p) => (
            <label key={p.value} className={radio(payment === p.value)}>
              <input type="radio" name="payment" checked={payment === p.value} onChange={() => setPayment(p.value)} aria-label={p.label} />
              <span><span className="block text-[13px] font-semibold text-[var(--desk-text)]">{p.label}</span><span className="block text-[11.5px] text-[var(--desk-text-muted)]">{p.hint}</span></span>
            </label>
          ))}
          {payment === 'PAID' && (
            <label className="block text-[12px] font-semibold text-[var(--desk-text-body)]">
              {all.length > 1 || (mode === 'later' && laterN > 1) ? 'Amount received per session (₦)' : 'Amount received (₦)'}
              <input type="number" min="0" step="0.01" placeholder={service ? String(Number(service.priceKobo) / 100) : ''} className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[var(--desk-border)] text-[13px]" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          )}
        </fieldset>

        <label className="block text-[12px] font-semibold text-[var(--desk-text-body)]">
          Note (optional)
          <textarea rows={2} className="mt-1 w-full px-3 py-2 rounded-[12px] border border-[var(--desk-border)] text-[13px]" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <label className="flex items-center gap-2 text-[12.5px] text-[var(--desk-text-body)]">
          <input type="checkbox" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} />
          Email the client
        </label>

        {error ? <p className="text-[12px] font-medium text-rose-700">{error}</p> : null}
        <button type="submit" disabled={busy || !ready} className="w-full h-[42px] rounded-[12px] bg-[var(--desk-pine-600)] text-white text-[13px] font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === 'later'
            ? `Add ${laterN > 1 ? `${laterN} sessions` : 'session'} to schedule later`
            : all.length > 1 ? `Book ${all.length} sessions` : 'Book session'}
        </button>
      </form>
    </div>
  );
}
