/* Clients (/clients) — the caseload roster: volume, status, next appointment. */

const ROSTER = [
  { initials:'AO', name:'Adaeze Okonkwo',  email:'adaeze@email.com',    care:'Individual · 50 min', sessions:14, next:'Thu, 7 Aug · 14:00', status:'active',   label:'Active',  tone:'tenant' },
  { initials:'TB', name:'Tunde Bello',     email:'tunde.b@email.com',   care:'Individual · 50 min', sessions:22, next:'Thu, 7 Aug · 15:30', status:'active',   label:'Active',  tone:'tenant' },
  { initials:'NM', name:'Ngozi & Michael', email:'ngozi.m@email.com',   care:'Couples · 80 min',    sessions:3,  next:'Thu, 7 Aug · 17:00', status:'pending',  label:'In intake', tone:'secondary' },
  { initials:'CN', name:'Chidi Nwosu',     email:'chidi.n@email.com',   care:'Individual · 50 min', sessions:31, next:'Mon, 11 Aug · 09:00',status:'active',   label:'Active',  tone:'tenant' },
  { initials:'FB', name:'Fatima Bakare',   email:'fatima@email.com',    care:'Individual · 50 min', sessions:8,  next:'Wed, 13 Aug · 10:00',status:'active',   label:'Active',  tone:'tenant' },
  { initials:'AE', name:'Ada & Emeka',     email:'ada.e@email.com',     care:'Couples · 80 min',    sessions:11, next:'Wed, 13 Aug · 15:00',status:'inactive', label:'Paused',  tone:'secondary' },
  { initials:'YA', name:'Yemi Adeyemi',    email:'yemi.a@email.com',    care:'Individual · 50 min', sessions:5,  next:'—',                  status:'pending',  label:'In intake', tone:'tenant' },
];

const COLS = '2.2fr 1fr .7fr 1.1fr .9fr 90px';

function Clients() {
  const { Card, StatTile, StatusPill, AvatarChip, IconButton, Button } = window.DESK;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatTile label="Active clients"  value="128" />
        <StatTile label="In intake"       value="7" />
        <StatTile label="Paused"          value="12" />
        <StatTile label="New this month"  value="9" />
      </div>

      <Card padding={0} style={{ overflow: 'hidden', flex: 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 16, padding: '14px 22px',
                      background: 'var(--desk-surface-alt)', borderBottom: '1px solid var(--desk-border)' }}>
          {['Client','Care type','Sessions','Next session','Status',''].map((h, i) => (
            <div key={i} style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                                  letterSpacing: '0.18em', color: 'var(--desk-text-subtle)' }}>{h}</div>
          ))}
        </div>

        {ROSTER.map(c => (
          <div key={c.name}
               onMouseEnter={e => e.currentTarget.style.background = 'var(--desk-surface-alt)'}
               onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
               style={{ display: 'grid', gridTemplateColumns: COLS, gap: 16, alignItems: 'center',
                        padding: '14px 22px', borderBottom: '1px solid var(--desk-border-soft)',
                        transition: 'background var(--dur-color) ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <AvatarChip initials={c.initials} size={38} tone={c.tone} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--desk-text-subtle)' }}>{c.email}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--desk-text-muted)' }}>{c.care}</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.sessions}</div>
            <div style={{ fontSize: 13, color: 'var(--desk-text-body)', fontVariantNumeric: 'tabular-nums' }}>{c.next}</div>
            <div><StatusPill status={c.status}>{c.label}</StatusPill></div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <IconButton size={32} variant="muted" aria-label="Edit"><Icon d={ICON.pencil} size={15} /></IconButton>
              <IconButton size={32} variant="muted" aria-label="More"><Icon d={ICON.more} size={15} /></IconButton>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 22px' }}>
          <span style={{ fontSize: 12, color: 'var(--desk-text-subtle)' }}>Showing 7 of 128 clients</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" style={{ height: 30, borderRadius: 9 }}>Previous</Button>
            <Button variant="secondary" size="sm" style={{ height: 30, borderRadius: 9 }}>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ClientsHeaderActions() {
  const { Input, Button } = window.DESK;
  return (
    <React.Fragment>
      <Input muted height={40} icon={<Icon d={ICON.search} size={15} />} placeholder="Search clients" wrapperStyle={{ width: 240 }} />
      <Button variant="secondary" size="lg" icon={<Icon d={ICON.download} size={15} />}>Export</Button>
      <Button variant="primary" size="lg" icon={<Icon d={ICON.plus} size={15} />}>Add client</Button>
    </React.Fragment>
  );
}

window.Clients = Clients;
window.ClientsHeaderActions = ClientsHeaderActions;
