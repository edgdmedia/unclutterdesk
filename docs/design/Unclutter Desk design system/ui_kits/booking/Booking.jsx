/* White-label client booking portal (public) + the confirmation screen.
   Authored at 1180px. Everything branded reads the tenant slots; the only
   Desk branding is the "Booking powered by Unclutter Desk" footer line. */

const SERVICES = [
  { id: 'individual', title: '50-minute Individual Session', detail: 'One-to-one therapy · online or in person', price: 30000, tag: 'Most booked', label: 'Individual Therapy', mins: 50 },
  { id: 'couples',    title: '80-minute Couples Session',    detail: 'For partners attending together',        price: 52000, tag: '80 min',      label: 'Couples Therapy',   mins: 80 },
];

const SLOTS = ['9:00 AM', '11:30 AM', '2:00 PM', '4:30 PM'];
const OPEN_DAYS = [10,11,12,13,14,17,18,19,20,21,24,25,26,27,28,31];
const DOW = ['M','T','W','T','F','S','S'];
const MONTH_LABEL = 'August 2026';
const LONG_DATE = d => {
  const names = { 10:'Monday', 11:'Tuesday', 12:'Wednesday', 13:'Thursday', 14:'Friday',
                  17:'Monday', 18:'Tuesday', 19:'Wednesday', 20:'Thursday', 21:'Friday',
                  24:'Monday', 25:'Tuesday', 26:'Wednesday', 27:'Thursday', 28:'Friday', 31:'Monday' };
  return `${names[d] || ''}, ${d} August 2026`;
};
const naira = n => '₦' + n.toLocaleString('en-NG');

function StepHeading({ n, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--brand-primary)',
                     color: 'var(--brand-on-primary)', fontSize: 11, fontWeight: 800,
                     display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{n}</span>
      <span style={{ fontSize: 16, fontWeight: 700 }}>{children}</span>
    </div>
  );
}

function BrandHeader() {
  const { Badge, Logo } = window.DESK;
  return (
    <header style={{
      padding: '30px 40px 26px',
      background: 'linear-gradient(120deg, var(--brand-tint), var(--brand-secondary-tint))',
      borderBottom: '1px solid var(--brand-ring)',
      display: 'flex', gap: 22, alignItems: 'center',
    }}>
      <div style={{ width: 82, height: 82, flex: 'none', borderRadius: 26, background: '#fff',
                    boxShadow: '0 8px 24px rgba(15,23,42,.10)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 26, fontWeight: 800, color: 'var(--brand-primary)' }}>
        JS
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase',
                         color: 'var(--brand-primary)' }}>Dr. Jane Smith Therapy</span>
          <Badge tone="secondary" height={20}>Clinical psychology</Badge>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.035em', margin: '10px 0 0' }}>
          Book a session with Dr. Jane Smith
        </h1>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13, color: 'var(--desk-text-body)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon d={ICON.star} size={14} fill="var(--desk-pine-500)" style={{ color: 'var(--desk-pine-500)' }} />
            <strong>4.9</strong> · 214 reviews
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon d={ICON.pin} size={14} /> Lagos, Nigeria · Online &amp; in-person
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon d={ICON.check} size={14} /> Licensed · 12 years practising
          </span>
        </div>
      </div>
    </header>
  );
}

function ServiceCard({ s, selected, onSelect }) {
  const { Badge } = window.DESK;
  return (
    <button type="button" onClick={onSelect} style={{
      textAlign: 'left', cursor: 'pointer', padding: 18, borderRadius: 20, background: '#fff',
      border: `2px solid ${selected ? 'var(--brand-primary)' : 'var(--desk-border)'}`,
      boxShadow: selected ? '0 10px 28px var(--brand-ring)' : 'none',
      transition: 'border-color var(--dur-color) ease-out, box-shadow var(--dur-lift) ease-out',
      display: 'flex', flexDirection: 'column', gap: 10, position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{s.title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--desk-text-muted)', marginTop: 4 }}>{s.detail}</div>
        </div>
        <Badge tone={selected ? 'tenantSolid' : 'neutral'} style={{ marginLeft: 'auto', flex: 'none' }}>
          {selected ? 'Selected' : s.tag}
        </Badge>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{naira(s.price)}</span>
        <span style={{ fontSize: 12, color: 'var(--desk-text-subtle)' }}>per session</span>
      </div>
    </button>
  );
}

function Calendar({ date, setDate }) {
  const { IconButton } = window.DESK;
  /* August 2026 starts on a Saturday; Monday-first grid → 5 leading blanks. */
  const cells = [null, null, null, null, null, ...Array.from({ length: 31 }, (_, i) => i + 1)];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton size={30} variant="muted" aria-label="Previous month"><Icon d={ICON.chevronLeft} size={15} /></IconButton>
        <IconButton size={30} variant="muted" aria-label="Next month"><Icon d={ICON.chevronRight} size={15} /></IconButton>
        <span style={{ fontSize: 14.5, fontWeight: 700 }}>{MONTH_LABEL}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--desk-text-subtle)' }}>WAT (GMT+1)</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 14 }}>
        {DOW.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 800,
                                letterSpacing: '0.1em', color: 'var(--desk-text-subtle)' }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />;
          const open = OPEN_DAYS.includes(d);
          const on = d === date;
          return (
            <button key={i} type="button" disabled={!open} onClick={() => open && setDate(d)}
              style={{
                position: 'relative', height: 38, borderRadius: 12, fontSize: 13, fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: open ? 'pointer' : 'default',
                background: on ? 'var(--brand-primary)' : open ? 'var(--desk-surface)' : 'transparent',
                border: `1px solid ${on ? 'var(--brand-primary)' : open ? 'var(--desk-border)' : 'transparent'}`,
                color: on ? 'var(--brand-on-primary)' : open ? 'var(--desk-text)' : 'var(--desk-border-strong)',
                transition: 'background var(--dur-color) ease-out',
              }}>
              {d}
              {open && (
                <span style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)',
                               width: 4, height: 4, borderRadius: 999,
                               background: on ? 'rgba(255,255,255,.65)' : 'var(--brand-dot)' }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BookingPortal({ state, set, onConfirm }) {
  const { Card, Eyebrow, Input, Textarea, SegmentedControl, Button, Logo } = window.DESK;
  const service = SERVICES.find(s => s.id === state.service);

  return (
    <div style={{ width: 1180, background: '#fff' }}>
      <BrandHeader />

      <div style={{ padding: '30px 40px 40px', background: 'var(--desk-surface-alt)',
                    display: 'grid', gridTemplateColumns: '1fr 348px', gap: 28, alignItems: 'start' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, minWidth: 0 }}>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StepHeading n="1">Choose a service</StepHeading>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {SERVICES.map(s => (
                <ServiceCard key={s.id} s={s} selected={state.service === s.id}
                             onSelect={() => set({ service: s.id })} />
              ))}
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StepHeading n="2">Pick a date &amp; time</StepHeading>
            <Card radius={22} padding={20} style={{ display: 'grid', gridTemplateColumns: '1fr 216px', gap: 20, boxShadow: 'none' }}>
              <Calendar date={state.date} setDate={d => set({ date: d })} />
              <div style={{ borderLeft: '1px solid var(--desk-border)', paddingLeft: 20,
                            display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Eyebrow>Available times</Eyebrow>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{LONG_DATE(state.date)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
                  {SLOTS.map(t => {
                    const on = t === state.slot;
                    return (
                      <button key={t} type="button" onClick={() => set({ slot: t })}
                        style={{
                          height: 42, borderRadius: 999, fontSize: 13.5, fontWeight: 700,
                          fontFamily: 'var(--font-primary)', cursor: 'pointer',
                          background: on ? 'var(--brand-primary)' : '#fff',
                          border: `1.5px solid ${on ? 'var(--brand-primary)' : 'var(--desk-border)'}`,
                          color: on ? 'var(--brand-on-primary)' : 'var(--desk-text)',
                          transition: 'background var(--dur-color) ease-out',
                        }}>{t}</button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--desk-text-subtle)', lineHeight: 1.5, marginTop: 2 }}>
                  Times shown in your local timezone. Sessions run {service.mins} minutes.
                </div>
              </div>
            </Card>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StepHeading n="3">Your details</StepHeading>
            <Card radius={22} padding={22} style={{ boxShadow: 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Input label="Full name" placeholder="Adaeze Okonkwo" />
                <Input label="Email address" placeholder="adaeze@email.com" />
                <Input label="Phone number" placeholder="+234 801 234 5678" />
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--desk-text-body)' }}>Session format</span>
                  <SegmentedControl options={['Online', 'In-person']} value={state.format}
                                    onChange={v => set({ format: v })} height={46} style={{ display: 'flex' }} />
                </label>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Textarea label="Share concerns" optionalLabel="(optional)" rows={3}
                            placeholder="Anything you'd like Dr. Smith to know before your first session." />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 14,
                            fontSize: 11.5, color: 'var(--desk-text-subtle)' }}>
                <Icon d={ICON.shield} size={14} style={{ color: 'var(--desk-active)' }} />
                Encrypted and confidential. Shared only with Dr. Smith.
              </div>
            </Card>
          </section>
        </div>

        {/* ── Session summary ── */}
        <aside style={{ position: 'sticky', top: 24, background: '#fff', borderRadius: 22,
                        overflow: 'hidden', border: '1px solid var(--desk-border)',
                        boxShadow: 'var(--desk-shadow-lg)' }}>
          <div style={{ padding: '16px 22px', background: 'var(--brand-primary)' }}>
            <Eyebrow tone="invert">Session summary</Eyebrow>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--brand-on-primary)', marginTop: 8 }}>
              {service.label}
            </div>
          </div>
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[
              ['Service',   service.title],
              ['Date',      LONG_DATE(state.date)],
              ['Time',      `${state.slot} WAT · ${service.mins} min`],
              ['Therapist', 'Dr. Jane Smith'],
              ['Format',    state.format],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span style={{ width: 78, flex: 'none', fontSize: 12.5, color: 'var(--desk-text-subtle)' }}>{k}</span>
                <span style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 13.5, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--desk-border)', margin: '4px 0' }} />
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--desk-text-body)' }}>Total</span>
              <span style={{ marginLeft: 'auto', fontSize: 26, fontWeight: 800, letterSpacing: '-0.035em' }}>
                {naira(service.price)}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--desk-text-subtle)', textAlign: 'right', marginTop: -4 }}>
              Paid securely at booking
            </div>
            <Button variant="primary" size="cta" fullWidth onClick={onConfirm}
                    style={{ marginTop: 6, boxShadow: 'var(--desk-shadow-tenant)' }}
                    iconAfter={<Icon d={ICON.arrowRight} size={17} />}>
              Confirm &amp; Book Session
            </Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center',
                          fontSize: 11.5, color: 'var(--desk-text-subtle)', marginTop: 2 }}>
              <Icon d={ICON.lock} size={13} /> Free cancellation up to 24 hours before
            </div>
          </div>
          <div style={{ padding: '14px 22px', background: 'var(--desk-surface)', borderTop: '1px solid var(--desk-border)' }}>
            <Logo variant="poweredBy" assetBase="../../" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function BookingConfirmed({ state, onReschedule }) {
  const { Button, AvatarChip, StatusPill, Logo } = window.DESK;
  const service = SERVICES.find(s => s.id === state.service);

  return (
    <div style={{ width: 1180, padding: '52px 40px 56px',
                  background: 'linear-gradient(180deg, var(--brand-tint), var(--desk-surface-alt) 240px)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ width: 72, height: 72, borderRadius: 26, background: 'var(--brand-primary)',
                    boxShadow: '0 14px 34px var(--brand-ring)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5 9.5 18 20 6" /></svg>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.035em', margin: 0, textAlign: 'center' }}>
        Your session is booked
      </h1>
      <p style={{ fontSize: 15, color: 'var(--desk-text-body)', maxWidth: 460, textAlign: 'center',
                  textWrap: 'pretty', lineHeight: 1.6, margin: 0 }}>
        A confirmation has been sent to your email, along with a secure telehealth link you can open
        five minutes before the session.
      </p>

      <div style={{ width: 560, background: '#fff', borderRadius: 24, overflow: 'hidden',
                    boxShadow: 'var(--desk-shadow-lg)', marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px',
                      borderBottom: '1px solid var(--desk-border)' }}>
          <AvatarChip initials="JS" size={46} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>Dr. Jane Smith</div>
            <div style={{ fontSize: 12.5, color: 'var(--desk-text-muted)' }}>
              Clinical Psychology · {service.title}
            </div>
          </div>
          <StatusPill status="active" style={{ marginLeft: 'auto' }}>Confirmed</StatusPill>
        </div>

        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          {[
            ['Booking ref', <span className="d-mono">UDK-4C81-2026</span>],
            ['Date',        LONG_DATE(state.date)],
            ['Time',        `${state.slot} WAT · ${service.mins} min`],
            ['Therapist',   'Dr. Jane Smith'],
            ['Format',      state.format],
            ['Paid',        `${naira(service.price)} · Card ending 4412`],
          ].map(([k, v], i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ width: 100, flex: 'none', fontSize: 12.5, color: 'var(--desk-text-subtle)' }}>{k}</span>
              <span style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 13.5, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Button variant="primary" size="xl" style={{ flex: 1 }} icon={<Icon d={ICON.calendar} size={15} />}>
              Add to calendar
            </Button>
            <Button variant="secondary" size="xl" style={{ flex: 1 }} onClick={onReschedule}>Reschedule</Button>
          </div>
        </div>

        <div style={{ padding: '14px 24px', background: 'var(--desk-surface)', borderTop: '1px solid var(--desk-border)' }}>
          <Logo variant="poweredBy" assetBase="../../" />
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--desk-text-subtle)' }}>
        Free cancellation up to 24 hours before your session.
      </div>
    </div>
  );
}

window.BookingPortal = BookingPortal;
window.BookingConfirmed = BookingConfirmed;
