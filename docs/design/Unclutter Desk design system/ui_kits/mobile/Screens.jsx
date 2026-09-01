/* Mobile companion app — five screens at 390 × 844.
   Frames are drawn at radius 46px for presentation only; build to the device viewport. */

const M = {
  frame: {
    width: 390, height: 844, flex: 'none', borderRadius: 46, overflow: 'hidden',
    background: 'var(--desk-surface)', boxShadow: 'var(--desk-shadow-phone)',
    display: 'flex', flexDirection: 'column', position: 'relative',
  },
  status: {
    height: 52, flex: 'none', display: 'flex', alignItems: 'flex-end', padding: '0 26px 6px',
    fontSize: 13, fontWeight: 700,
  },
  body: { flex: 1, overflow: 'auto', padding: '0 20px 16px' },
};

function StatusBar() {
  return <div style={M.status}>9:41</div>;
}

function MobileToday() {
  const { Card, AvatarChip, IconButton, Button, StatusPill } = window.DESK;
  const bars = [238, 262, 251, 305, 288, 331, 318, 372, 355, 401, 380, 450];
  const max = 450;
  return (
    <React.Fragment>
      <StatusBar />
      <div style={M.body}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 18px' }}>
          <AvatarChip initials="JS" size={44} tone="pine" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--desk-text-subtle)' }}>
              THURSDAY, 7 AUGUST
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 4 }}>Good morning</div>
          </div>
          <IconButton size={40} dot aria-label="Notifications" style={{ marginLeft: 'auto' }}>
            <Icon d={ICON.bell} size={17} />
          </IconButton>
        </div>

        <div style={{ background: 'var(--desk-sidebar)', borderRadius: 32, padding: '22px 24px',
                      boxShadow: '0 18px 40px rgba(15,23,42,.28)', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.22em', color: 'var(--desk-text-muted)' }}>
              REVENUE THIS MONTH
            </span>
            <span style={{ marginLeft: 'auto', height: 22, display: 'flex', alignItems: 'center', padding: '0 9px',
                           borderRadius: 999, background: 'rgba(16,185,129,.16)', color: '#34D399',
                           fontSize: 11.5, fontWeight: 700 }}>+18.2%</span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', marginTop: 10 }}>₦450,000</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 44, marginTop: 16 }}>
            {bars.map((v, i) => (
              <div key={i} style={{ flex: 1, height: (v / max) * 44, borderRadius: '4px 4px 2px 2px',
                                    background: i === bars.length - 1 ? '#fff' : 'rgba(255,255,255,.22)' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.08)' }}>
            {[['62','Sessions'],['94%','Attendance'],['128','Clients']].map(([v, l]) => (
              <div key={l}>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.03em' }}>{v}</div>
                <div style={{ fontSize: 10.5, color: 'var(--desk-text-muted)', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 10px' }}>
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.22em', color: 'var(--desk-text-subtle)' }}>NEXT UP</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--brand-primary)' }}>See all 3</span>
        </div>

        <Card radius={26} padding="18px 20px" style={{ boxShadow: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AvatarChip initials="AO" size={44} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Adaeze Okonkwo</div>
              <div style={{ fontSize: 12, color: 'var(--desk-text-muted)' }}>14:00 · Individual · Telehealth</div>
            </div>
            <StatusPill status="active" height={24} style={{ marginLeft: 'auto', fontSize: 10.5, padding: '0 9px' }}>Confirmed</StatusPill>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button variant="primary" style={{ flex: 1, height: 46, borderRadius: 15 }} icon={<Icon d={ICON.play} size={15} />}>
              Start session
            </Button>
            <Button variant="secondary" style={{ width: 46, height: 46, borderRadius: 15, padding: 0 }} aria-label="Edit">
              <Icon d={ICON.pencil} size={16} />
            </Button>
          </div>
        </Card>

        {[['15:30','Tunde Bello','Individual · In-person','TB','tenant'],
          ['17:00','Ngozi & Michael','Couples · Telehealth','NM','secondary']].map(([t, n, s, ini, tone]) => (
          <Card key={n} radius={22} padding="14px 16px" style={{ marginTop: 10, boxShadow: 'none',
                                                                 display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, flex: 'none', fontSize: 13, fontWeight: 800 }}>{t}</div>
            <AvatarChip initials={ini} size={34} tone={tone} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{n}</div>
              <div style={{ fontSize: 11.5, color: 'var(--desk-text-muted)' }}>{s}</div>
            </div>
          </Card>
        ))}
      </div>
    </React.Fragment>
  );
}

function MobileSchedule() {
  const { Card, Button } = window.DESK;
  const days = [['M','3'],['T','4'],['W','5'],['T','6'],['F','7'],['S','8'],['S','9']];
  const sessions = [
    ['09:00','50 min','Chidi Nwosu','Individual','tenant'],
    ['11:30','50 min','Yemi Adeyemi','Individual','tenant'],
    ['14:00','60 min','Ngozi & Michael','Couples','secondary'],
  ];
  return (
    <React.Fragment>
      <StatusBar />
      <div style={M.body}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 18px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.035em' }}>Schedule</div>
          <Button variant="primary" size="sm" style={{ marginLeft: 'auto', borderRadius: 999 }}
                  icon={<Icon d={ICON.plus} size={14} />}>Session</Button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {days.map(([d, n], i) => {
            const on = i === 4, weekend = i > 4;
            return (
              <div key={i} style={{ flex: 1, height: 66, borderRadius: 20, display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: 4,
                                    background: on ? 'var(--brand-primary)' : 'var(--desk-card)',
                                    border: '1px solid ' + (on ? 'var(--brand-primary)' : 'var(--desk-border)'),
                                    color: on ? '#fff' : weekend ? 'var(--desk-border-strong)' : 'var(--desk-text)' }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', opacity: .7 }}>{d}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{n}</span>
                <span style={{ width: 4, height: 4, borderRadius: 999,
                               background: on ? 'rgba(255,255,255,.7)' : weekend ? 'transparent' : 'var(--brand-dot)' }} />
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '22px 0 12px' }}>
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.22em', color: 'var(--desk-text-subtle)' }}>FRIDAY, 7 AUGUST</span>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--desk-text-muted)' }}>3 sessions · 2h 50m</span>
        </div>

        {sessions.map(([t, dur, n, cat, tone]) => (
          <div key={n} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 52, flex: 'none', textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{t}</div>
              <div style={{ fontSize: 10.5, color: 'var(--desk-text-subtle)' }}>{dur}</div>
            </div>
            <Card radius={20} padding="14px 16px" style={{
              flex: 1, boxShadow: 'none',
              borderLeft: '4px solid ' + (tone === 'secondary' ? 'var(--brand-secondary)' : 'var(--brand-primary)'),
            }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{n}</div>
              <div style={{ fontSize: 12, color: 'var(--desk-text-muted)', marginTop: 3 }}>{cat} · Telehealth</div>
            </Card>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

function MobileClients() {
  const { Card, Input, AvatarChip } = window.DESK;
  const chips = ['All', 'Active', 'Intake', 'Paused'];
  const rows = [
    ['AO','Adaeze Okonkwo','Individual · 14 sessions','active','tenant'],
    ['TB','Tunde Bello','Individual · 22 sessions','active','tenant'],
    ['NM','Ngozi & Michael','Couples · 3 sessions','pending','secondary'],
    ['CN','Chidi Nwosu','Individual · 31 sessions','active','tenant'],
    ['AE','Ada & Emeka','Couples · 11 sessions','inactive','secondary'],
  ];
  const dotColor = { active: 'var(--desk-active-dot)', pending: 'var(--desk-pending-dot)', inactive: 'var(--desk-inactive)' };
  return (
    <React.Fragment>
      <StatusBar />
      <div style={M.body}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '4px 0 16px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.035em' }}>Clients</div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--desk-text-muted)' }}>128 active</span>
        </div>

        <Input muted height={46} icon={<Icon d={ICON.search} size={16} />} placeholder="Search clients"
               wrapperStyle={{ marginBottom: 14 }} />

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {chips.map((c, i) => (
            <span key={c} style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 14px',
                                   borderRadius: 999, fontSize: 12.5, fontWeight: 600,
                                   background: i === 0 ? 'var(--desk-sidebar)' : 'var(--desk-card)',
                                   color: i === 0 ? '#fff' : 'var(--desk-text-muted)',
                                   border: '1px solid ' + (i === 0 ? 'var(--desk-sidebar)' : 'var(--desk-border)') }}>{c}</span>
          ))}
        </div>

        {rows.map(([ini, n, s, st, tone]) => (
          <Card key={n} radius={22} padding="12px 14px" style={{ marginBottom: 8, boxShadow: 'none',
                                                                 display: 'flex', alignItems: 'center', gap: 12 }}>
            <AvatarChip initials={ini} size={44} tone={tone} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{n}</div>
              <div style={{ fontSize: 11.5, color: 'var(--desk-text-muted)' }}>{s}</div>
            </div>
            <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: 999, background: dotColor[st] }} />
            <Icon d={ICON.chevronRight} size={16} style={{ color: 'var(--desk-border-strong)' }} />
          </Card>
        ))}
      </div>
    </React.Fragment>
  );
}

function MobileBrand({ brand, setBrand, active, setActive }) {
  const { Card, Eyebrow, Button, Toggle, ColorField, PresetSwatches } = window.DESK;
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef(null);
  const copy = () => { clearTimeout(timer.current); setCopied(true); timer.current = setTimeout(() => setCopied(false), 1600); };

  return (
    <React.Fragment>
      <StatusBar />
      <div style={M.body}>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.035em', padding: '4px 0 16px' }}>Brand</div>

        <div style={{ borderRadius: 28, padding: '20px 22px',
                      background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                      boxShadow: '0 16px 36px var(--brand-ring)', color: '#fff' }}>
          <Eyebrow tone="invert">Your booking link</Eyebrow>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>unclutterdesk.com/booking/dr-smith</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" onClick={copy} style={{
              flex: 1, height: 44, borderRadius: 15, border: 'none', cursor: 'pointer',
              background: '#fff', color: 'var(--desk-text)', fontSize: 13.5, fontWeight: 700,
              fontFamily: 'var(--font-primary)',
            }}>{copied ? 'Copied' : 'Copy link'}</button>
            <button type="button" style={{
              width: 100, height: 44, borderRadius: 15, cursor: 'pointer',
              background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.3)',
              color: '#fff', fontSize: 13.5, fontWeight: 700, fontFamily: 'var(--font-primary)',
            }}>Share</button>
          </div>
        </div>

        <Card radius={26} padding="18px 20px" style={{ marginTop: 14, boxShadow: 'none' }}>
          <Eyebrow>Brand colours</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            <ColorField label="Primary" value={brand.primary} onChange={v => setBrand({ ...brand, primary: v })} />
            <ColorField label="Secondary" value={brand.secondary} onChange={v => setBrand({ ...brand, secondary: v })} />
          </div>
          <div style={{ marginTop: 14 }}>
            <PresetSwatches value={brand.primary} onPick={p => setBrand({ primary: p.primary, secondary: p.secondary })} />
          </div>
        </Card>

        <Card radius={26} padding="18px 20px" style={{ marginTop: 14, boxShadow: 'none',
                                                       display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <Eyebrow>Practice status</Eyebrow>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 9 }}>{active ? 'Active Practice' : 'Inactive Practice'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--desk-text-muted)', marginTop: 5, textWrap: 'pretty' }}>
              {active ? 'Your booking page is live.' : 'Your booking page is hidden.'}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}><Toggle checked={active} onChange={setActive} width={58} /></div>
        </Card>

        <Card radius={26} padding="16px 18px" style={{ marginTop: 14, boxShadow: 'none',
                                                       display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--desk-surface)',
                        border: '1px solid var(--desk-border)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: 'var(--desk-text-subtle)' }}>
            <Icon d={ICON.file} size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>jane-smith-logo.svg</div>
            <div style={{ fontSize: 11, color: 'var(--desk-text-subtle)' }}>SVG or PNG · max 2 MB</div>
          </div>
          <Button variant="secondary" size="sm" style={{ marginLeft: 'auto' }}>Replace</Button>
        </Card>
      </div>
    </React.Fragment>
  );
}

function MobileBooking() {
  const { Card, Badge, Input, Button, Logo } = window.DESK;
  const dates = [['Mon','10'],['Tue','11'],['Wed','12'],['Thu','13'],['Fri','14'],['Mon','17']];
  const slots = ['9:00 AM', '11:30 AM', '2:00 PM', '4:30 PM'];
  return (
    <React.Fragment>
      <StatusBar />
      <div style={{ padding: '0 16px 10px', flex: 'none' }}>
        <div style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      background: 'var(--desk-surface-muted)', borderRadius: 12,
                      fontSize: 12, color: 'var(--desk-text-muted)' }}>
          <Icon d={ICON.lock} size={12} style={{ color: 'var(--desk-active)' }} />
          booking.drsmiththerapy.com
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
        <div style={{ padding: '22px 20px',
                      background: 'linear-gradient(140deg, var(--brand-tint), var(--brand-secondary-tint))',
                      borderBottom: '1px solid var(--brand-ring)' }}>
          <div style={{ width: 62, height: 62, borderRadius: 22, background: '#fff',
                        boxShadow: '0 8px 24px rgba(15,23,42,.10)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'var(--brand-primary)' }}>JS</div>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase',
                        color: 'var(--brand-primary)', marginTop: 14 }}>Dr. Jane Smith Therapy</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 8 }}>Dr. Jane Smith</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <Badge tone="secondary" height={20}>Clinical psychology</Badge>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--desk-text-body)' }}>
              <Icon d={ICON.star} size={13} fill="var(--desk-pine-500)" style={{ color: 'var(--desk-pine-500)' }} />
              <strong>4.9</strong>
            </span>
          </div>
        </div>

        <div style={{ padding: '18px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card radius={20} padding={16} style={{ border: '2px solid var(--brand-primary)',
                                                  boxShadow: '0 8px 24px var(--brand-ring)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>50-minute Individual Session</div>
                <div style={{ fontSize: 12, color: 'var(--desk-text-muted)', marginTop: 4 }}>One-to-one · online or in person</div>
              </div>
              <Badge tone="tenantSolid" style={{ marginLeft: 'auto', flex: 'none' }}>Selected</Badge>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 10 }}>₦30,000</div>
          </Card>

          <div style={{ display: 'flex', gap: 6 }}>
            {dates.map(([d, n], i) => (
              <div key={i} style={{ flex: 1, height: 62, borderRadius: 18, display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: 3,
                                    background: i === 1 ? 'var(--brand-primary)' : 'var(--desk-surface)',
                                    border: '1px solid ' + (i === 1 ? 'var(--brand-primary)' : 'var(--desk-border)'),
                                    color: i === 1 ? '#fff' : 'var(--desk-text)' }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, opacity: .7 }}>{d}</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{n}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {slots.map((t, i) => (
              <span key={t} style={{ height: 42, display: 'flex', alignItems: 'center', padding: '0 18px',
                                     borderRadius: 999, fontSize: 13.5, fontWeight: 700,
                                     background: i === 1 ? 'var(--brand-primary)' : '#fff',
                                     border: '1.5px solid ' + (i === 1 ? 'var(--brand-primary)' : 'var(--desk-border)'),
                                     color: i === 1 ? '#fff' : 'var(--desk-text)' }}>{t}</span>
            ))}
          </div>

          <Input label="Full name" placeholder="Adaeze Okonkwo" height={50} />
          <Input label="Email address" placeholder="adaeze@email.com" height={50} />
          <Input label="Phone number" placeholder="+234 801 234 5678" height={50} />

          <div style={{ paddingTop: 4 }}><Logo variant="poweredBy" assetBase="../../" /></div>        </div>
      </div>

      <div style={{ flex: 'none', padding: '14px 20px 26px', background: 'var(--desk-glass-bg)',
                    backdropFilter: 'var(--desk-glass-blur)', WebkitBackdropFilter: 'var(--desk-glass-blur)',
                    borderTop: '1px solid var(--desk-border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, color: 'var(--desk-text-muted)' }}>Tue 11 Aug · 11:30 AM</span>
          <span style={{ marginLeft: 'auto', fontSize: 19, fontWeight: 800, letterSpacing: '-0.03em' }}>₦30,000</span>
        </div>
        <Button variant="primary" fullWidth style={{ height: 54, borderRadius: 18, boxShadow: 'var(--desk-shadow-tenant)' }}
                iconAfter={<Icon d={ICON.arrowRight} size={17} />}>
          Confirm &amp; Book Session
        </Button>
      </div>
    </React.Fragment>
  );
}

window.M = M;
window.MobileToday = MobileToday;
window.MobileSchedule = MobileSchedule;
window.MobileClients = MobileClients;
window.MobileBrand = MobileBrand;
window.MobileBooking = MobileBooking;
