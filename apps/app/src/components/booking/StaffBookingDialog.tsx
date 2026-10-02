import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Loader2, X } from 'lucide-react';
import { api, TENANT_SLUG } from '../../utils/apiClient';
import { useAuth } from '../../context/AuthContext';

type Service = { id: string; title: string; durationMinutes: number; priceKobo: string };
type StaffRow = { kind: 'member' | 'invite'; id: string; firstName: string | null; lastName: string | null; status: string; isTherapist: boolean };
type Staff = { id: string; name: string };
type Slot = { id: string; startsAt: string; endsAt: string; formats?: Array<'ONLINE' | 'IN_PERSON'>; location?: { id?: string; name: string; city: string } | null };
type Payment = 'LINK' | 'PAID' | 'NONE';
export type StaffBookingResult = { bookingId: string; status: 'PENDING_PAYMENT' | 'CONFIRMED' };

const naira = (kobo: string | number) => `₦${(Number(kobo) / 100).toLocaleString('en-NG')}`;
const when = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

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
  onBooked: (r: StaffBookingResult) => void;
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
  const [mode, setMode] = useState<'slot' | 'custom'>('slot');
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
    if (mode !== 'custom') return;
    api.get<typeof locations>('/v1/tenant/locations', tenantHeaders).then((r) => setLocations(r ?? [])).catch(() => setLocations([]));
  }, [mode]);
  const ready = clientId && serviceId && (mode === 'slot' ? slotId : customAt)
    && (mode === 'custom' ? format !== '' : slotFormats.length === 1 || format !== '')
    && (format !== 'IN_PERSON' || (mode === 'slot' ? true : locationId !== ''));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<StaffBookingResult>('/v1/consult/practice/bookings', {
        clientProfileId: clientId,
        serviceId,
        providerProfileId: providerId || undefined,
        ...(mode === 'slot' ? { availabilityId: slotId } : { startsAt: new Date(customAt).toISOString() }),
        format: format || (slotFormats.length === 1 ? slotFormats[0] : undefined),
        locationId: format === 'IN_PERSON' && mode === 'custom' ? locationId : undefined,
        payment,
        ...(payment === 'PAID' && amount ? { amountKobo: String(Math.round(Number(amount) * 100)) } : {}),
        note: note || undefined,
        notifyClient,
      });
      onBooked(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not book the session');
      setBusy(false);
    }
  }

  const radio = (checked: boolean) =>
    `flex items-start gap-2 p-2.5 rounded-[12px] border cursor-pointer ${checked ? 'border-[#0F3A53] bg-[#F0F7FB]' : 'border-[#E2E8F0]'}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="staff-booking-title">
      <form onSubmit={submit} className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-[20px] bg-white p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-[#0F3A53]" />
            <h2 id="staff-booking-title" className="text-[16px] font-bold text-[#0F172A]">
              {client ? `Book a session for ${client.name}` : 'New booking'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!client && (
          <label className="block text-[12px] font-semibold text-[#334155]">
            Client
            <select className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[#E2E8F0] text-[13px]" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Choose a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}

        <fieldset className="space-y-2">
          <legend className="text-[12px] font-semibold text-[#334155] mb-1">Service</legend>
          {services.map((s) => (
            <label key={s.id} className={radio(serviceId === s.id)}>
              <input type="radio" name="service" checked={serviceId === s.id} onChange={() => setServiceId(s.id)} aria-label={`${s.title}, ${s.durationMinutes} minutes, ${naira(s.priceKobo)}`} />
              <span className="text-[13px] text-[#0F172A]">{s.title} · {s.durationMinutes} min · {naira(s.priceKobo)}</span>
            </label>
          ))}
        </fieldset>

        {!isTherapist && staff && staff.length === 0 ? (
          <p className="text-[12.5px] font-medium text-rose-700">
            No practitioner can take bookings yet. Add one under Team &amp; staff, or set up your own practitioner profile.
          </p>
        ) : null}

        {!isTherapist && staff && (staff.length > 1 || (staff.length === 1 && staff[0].id !== String(profile?.id ?? ''))) && (
          <label className="block text-[12px] font-semibold text-[#334155]">
            Practitioner
            <select aria-label="Practitioner" className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[#E2E8F0] text-[13px]" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              {staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}

        <fieldset className="space-y-2">
          <legend className="text-[12px] font-semibold text-[#334155] mb-1">Time</legend>
          <div className="flex gap-2">
            <label className={radio(mode === 'slot')}><input type="radio" name="mode" checked={mode === 'slot'} onChange={() => { setMode('slot'); }} aria-label="Open slots" /><span className="text-[13px]">Open slots</span></label>
            <label className={radio(mode === 'custom')}><input type="radio" name="mode" checked={mode === 'custom'} onChange={() => { setMode('custom'); setFormat((f) => f || 'ONLINE'); }} aria-label="Custom time" /><span className="text-[13px]">Custom time</span></label>
          </div>
          {mode === 'slot' ? (
            serviceId ? (
              slots.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((s) => (
                    <label key={s.id} data-testid={`slot-${s.id}`} className={radio(slotId === s.id)} onClick={() => { setSlotId(s.id); const fs: Array<'ONLINE' | 'IN_PERSON'> = s.formats?.length ? s.formats : ['ONLINE']; setFormat(fs.length === 1 ? fs[0] : ''); }}>
                      <input type="radio" name="slot" checked={slotId === s.id} onChange={() => { setSlotId(s.id); const fs: Array<'ONLINE' | 'IN_PERSON'> = s.formats?.length ? s.formats : ['ONLINE']; setFormat(fs.length === 1 ? fs[0] : ''); }} aria-label={when(s.startsAt)} />
                      <span className="text-[12.5px]">{when(s.startsAt)}</span>
                    </label>
                  ))}
                </div>
              ) : <p className="text-[12px] text-[#64748B]">No open slots. Use a custom time.</p>
            ) : <p className="text-[12px] text-[#64748B]">Choose a service first.</p>
          ) : (
            <label className="block text-[12px] font-semibold text-[#334155]">
              Date and time
              <input type="datetime-local" aria-label="Date and time" className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[#E2E8F0] text-[13px]" value={customAt} onChange={(e) => setCustomAt(e.target.value)} />
              <span className="block mt-1 text-[11.5px] font-normal text-[#64748B]">
                This can fall outside working hours. Any open slot it overlaps is closed.
                {service ? ` The session runs for ${service.durationMinutes} minutes.` : ''}
              </span>
            </label>
          )}
        </fieldset>

        {(mode === 'custom' || slotFormats.length > 1) ? (
          <fieldset className="space-y-2">
            <legend className="text-[12px] font-semibold text-[#334155] mb-1">Format</legend>
            {(['ONLINE', 'IN_PERSON'] as const).filter((f) => mode === 'custom' || slotFormats.includes(f)).map((f) => (
              <label key={f} className={radio(format === f)}>
                <input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} aria-label={f === 'ONLINE' ? 'Online' : 'In person'} />
                <span className="text-[13px]">{f === 'ONLINE' ? 'Online' : 'In person'}</span>
              </label>
            ))}
            {format === 'IN_PERSON' && mode === 'custom' ? (
              <label className="block text-[12px] font-semibold text-[#334155]">
                Location
                <select className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[#E2E8F0] text-[13px]" value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Location">
                  <option value="">Choose a location…</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}, {l.city}</option>)}
                </select>
              </label>
            ) : null}
          </fieldset>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-[12px] font-semibold text-[#334155] mb-1">Payment</legend>
          {payments.map((p) => (
            <label key={p.value} className={radio(payment === p.value)}>
              <input type="radio" name="payment" checked={payment === p.value} onChange={() => setPayment(p.value)} aria-label={p.label} />
              <span><span className="block text-[13px] font-semibold text-[#0F172A]">{p.label}</span><span className="block text-[11.5px] text-[#64748B]">{p.hint}</span></span>
            </label>
          ))}
          {payment === 'PAID' && (
            <label className="block text-[12px] font-semibold text-[#334155]">
              Amount received (₦)
              <input type="number" min="0" step="0.01" placeholder={service ? String(Number(service.priceKobo) / 100) : ''} className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[#E2E8F0] text-[13px]" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          )}
        </fieldset>

        <label className="block text-[12px] font-semibold text-[#334155]">
          Note (optional)
          <textarea rows={2} className="mt-1 w-full px-3 py-2 rounded-[12px] border border-[#E2E8F0] text-[13px]" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <label className="flex items-center gap-2 text-[12.5px] text-[#334155]">
          <input type="checkbox" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} />
          Email the client
        </label>

        {error ? <p className="text-[12px] font-medium text-rose-700">{error}</p> : null}
        <button type="submit" disabled={busy || !ready} className="w-full h-[42px] rounded-[12px] bg-[#0F3A53] text-white text-[13px] font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Book session
        </button>
      </form>
    </div>
  );
}
