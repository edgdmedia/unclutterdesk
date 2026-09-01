/* Dashboard (/) — morning check-in: what's earning, who's coming, and
   one-click access to the booking link the therapist shares with clients. */

const REVENUE_12 = [
  { label: 'S', value: 238 }, { label: 'O', value: 262 }, { label: 'N', value: 251 },
  { label: 'D', value: 305 }, { label: 'J', value: 288 }, { label: 'F', value: 331 },
  { label: 'M', value: 318 }, { label: 'A', value: 372 }, { label: 'M', value: 355 },
  { label: 'J', value: 401 }, { label: 'J', value: 380 }, { label: 'A', value: 450, current: true },
];

const TODAY = [
  { start: '14:00', end: '15:00', initials: 'AO', name: 'Adaeze Okonkwo', type: 'Individual Therapy', mode: 'Telehealth', status: 'active', statusLabel: 'Confirmed', tone: 'tenant' },
  { start: '15:30', end: '16:20', initials: 'TB', name: 'Tunde Bello', type: 'Individual Therapy', mode: 'In-person', status: 'active', statusLabel: 'Confirmed', tone: 'tenant' },
  { start: '17:00', end: '18:00', initials: 'NM', name: 'Ngozi & Michael', type: 'Couples Therapy', mode: 'Telehealth', status: 'pending', statusLabel: 'Awaiting intake', tone: 'secondary' },
];

function SessionRow({ s }) {
  const { Card, AvatarChip, StatusPill, Button, IconButton } = window.DESK;
  return (
    <Card hoverable padding="14px 16px" radius={18} style={{ display: 'flex', alignItems: 'center', gap: 16, boxShadow: 'none' }}>
      <div style={{ width: 52, flex: 'none' }}>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>{s.start}</div>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--desk-text-subtle)' }}>{s.end}</div>
      </div>
      <div style={{ width: 1, height: 34, background: 'var(--desk-border)', flex: 'none' }} />
      <AvatarChip initials={s.initials} size={38} tone={s.tone} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{s.name}</div>
        <div style={{ fontSize: 12, color: 'var(--desk-text-muted)' }}>{s.type} · {s.mode}</div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusPill status={s.status}>{s.statusLabel}</StatusPill>
        <Button variant="secondary" size="sm" style={{ height: 34, borderRadius: 11 }}>Notes</Button>
        <Button variant="primary" size="sm" style={{ height: 34, borderRadius: 11 }}>Start session</Button>
        <IconButton size={34} variant="muted" radius={11} aria-label="More"><Icon d={ICON.more} size={16} /></IconButton>
      </div>
    </Card>
  );
}

function Dashboard({ brand, setBrand, active, setActive }) {
  const { Card, Eyebrow, Badge, StatusPill, Button, IconButton, AvatarChip,
          Input, Toggle, ColorField, PresetSwatches, StatTile, BarChart } = window.DESK;
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef(null);

  const copy = () => {
    clearTimeout(timer.current);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 372px', gap: 20, alignItems: 'start' }}>

      {/* ── Left column ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

        <Card>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <Eyebrow>Revenue this month</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <span className="d-stat-hero">₦450,000</span>
                <StatusPill status="active" dot={false} height={24}>
                  <Icon d={ICON.chevronUp} size={13} /> 18.2%
                </StatusPill>
              </div>
              <div style={{ fontSize: 13, color: 'var(--desk-text-muted)', marginTop: 8 }}>
                August 2026 · vs ₦380,500 in July
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <StatTile compact label="Total sessions" value="62" />
              <StatTile compact label="Avg. per session" value="₦7,258" />
              <StatTile compact label="Attendance" value="94%" />
            </div>
          </div>
          <div style={{ marginTop: 22 }}>
            <BarChart data={REVENUE_12} height={96} />
          </div>
        </Card>

        <Card padding="22px 24px 24px">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <Eyebrow>Upcoming</Eyebrow>
              <div className="d-card-title" style={{ marginTop: 8 }}>Client sessions today</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: 10,
                             background: 'var(--desk-surface-muted)', fontSize: 12.5, fontWeight: 700, color: 'var(--desk-text-body)' }}>
                Thu, 7 Aug
              </span>
              <Button variant="link" size="sm" style={{ height: 32, borderRadius: 10 }}>View schedule</Button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {TODAY.map(s => <SessionRow key={s.name} s={s} />)}
          </div>
        </Card>
      </div>

      {/* ── Right column ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <Card padding="22px">
          <Eyebrow>Profile photo</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
            <AvatarChip initials="JS" size={76} ring online />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Dr. Jane Smith</div>
              <div style={{ fontSize: 12.5, color: 'var(--desk-text-muted)' }}>Clinical Psychologist · MSc</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 11.5, color: 'var(--desk-text-subtle)' }}>
                <Icon d={ICON.info} size={13} /> JPG or PNG · max 2 MB
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button variant="primary" style={{ flex: 1 }} icon={<Icon d={ICON.upload} size={15} />}>Upload Photo</Button>
            <Button variant="secondary">Remove</Button>
          </div>
        </Card>

        <Card padding="20px 22px">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <Eyebrow>Practice status</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: active ? 'var(--desk-active-dot)' : 'var(--desk-inactive)' }} />
                <span style={{ fontSize: 16, fontWeight: 700 }}>{active ? 'Active Practice' : 'Inactive Practice'}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--desk-text-muted)', maxWidth: 210, marginTop: 8, textWrap: 'pretty' }}>
                {active
                  ? 'Your booking page is live and accepting new client bookings.'
                  : 'Your booking page is hidden. Existing sessions are unaffected.'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <Toggle checked={active} onChange={setActive} />
            </div>
          </div>
        </Card>

        <Card padding="22px">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <Eyebrow>Brand styling</Eyebrow>
              <div className="d-card-title" style={{ marginTop: 8, fontSize: 15.5 }}>Your booking page</div>
            </div>
            <Badge tone="pine" style={{ marginLeft: 'auto' }}>White-label</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
            <ColorField label="Primary" value={brand.primary} onChange={v => setBrand({ ...brand, primary: v })} />
            <ColorField label="Secondary" value={brand.secondary} onChange={v => setBrand({ ...brand, secondary: v })} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--desk-text-subtle)' }}>Presets</span>
            <PresetSwatches value={brand.primary} onPick={p => setBrand({ primary: p.primary, secondary: p.secondary })} />
          </div>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                        border: '1.5px dashed var(--desk-border-strong)', borderRadius: 16, background: 'var(--desk-surface)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fff', border: '1px solid var(--desk-border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--desk-text-subtle)' }}>
              <Icon d={ICON.file} size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>jane-smith-logo.svg</div>
              <div style={{ fontSize: 11, color: 'var(--desk-text-subtle)' }}>SVG or PNG · max 2 MB · replace</div>
            </div>
            <Button variant="secondary" size="sm" style={{ marginLeft: 'auto' }}>Upload</Button>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--desk-text-body)' }}>Custom domain (CNAME)</span>
              <StatusPill status="active" dot={false} height={20} style={{ fontSize: 10, letterSpacing: '0.06em' }}>Verified</StatusPill>
            </div>
            <Input muted readOnly height={44} icon={<Icon d={ICON.globe} size={15} />} defaultValue="booking.drsmiththerapy.com" />
            <div style={{ fontSize: 11, color: 'var(--desk-text-subtle)', marginTop: 8 }}>
              Point a CNAME record at{' '}
              <span className="d-mono" style={{ background: 'var(--desk-surface-muted)', borderRadius: 5, padding: '1px 5px', color: 'var(--desk-pine-600)' }}>
                cname.unclutterdesk.com
              </span>
            </div>
          </div>

          <Button variant="primary" fullWidth size="lg" style={{ marginTop: 18 }}>Save brand settings</Button>
        </Card>
      </div>
    </div>
  );
}

/* Header action cluster for this screen — rendered by the shell. */
function DashboardHeaderActions() {
  const { Input, Button, IconButton } = window.DESK;
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef(null);
  const copy = () => {
    clearTimeout(timer.current);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };
  return (
    <React.Fragment>
      <Input muted readOnly mono height={44} icon={<Icon d={ICON.link} size={15} />}
             value="unclutterdesk.com/booking/dr-smith" onChange={() => {}}
             wrapperStyle={{ width: 320 }}
             trailing={<IconButton size={32} variant="plain" onClick={copy} aria-label="Copy booking link">
                         <Icon d={copied ? ICON.check : ICON.copy} size={14} />
                       </IconButton>} />
      <Button variant="primary" size="lg" onClick={copy} icon={<Icon d={copied ? ICON.check : ICON.copy} size={15} />}>
        {copied ? 'Link copied' : 'Copy Booking Link'}
      </Button>
      <div style={{ width: 1, height: 28, background: 'var(--desk-border)' }} />
      <IconButton size={44} dot aria-label="Notifications"><Icon d={ICON.bell} size={18} /></IconButton>
    </React.Fragment>
  );
}

window.Dashboard = Dashboard;
window.DashboardHeaderActions = DashboardHeaderActions;
