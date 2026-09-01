/* Schedule (/schedule) — see and manage the working week. */

const WEEK_DAYS = [
  { dow: 'MON', date: '3' }, { dow: 'TUE', date: '4' }, { dow: 'WED', date: '5' },
  { dow: 'THU', date: '6' }, { dow: 'FRI', date: '7' },
];

/* category: 'individual' | 'couples' | 'admin' */
const EVENTS = [
  { day: 0, start: 9 * 60,      dur: 50, title: 'Chidi Nwosu',        sub: 'Individual · Telehealth', cat: 'individual' },
  { day: 0, start: 11 * 60,     dur: 50, title: 'Adaeze Okonkwo',     sub: 'Individual · In-person',  cat: 'individual' },
  { day: 0, start: 14 * 60,     dur: 60, title: 'Supervision',        sub: 'Admin block',             cat: 'admin' },
  { day: 1, start: 9 * 60 + 30, dur: 80, title: 'Ngozi & Michael',    sub: 'Couples · Telehealth',    cat: 'couples' },
  { day: 1, start: 13 * 60,     dur: 50, title: 'Tunde Bello',        sub: 'Individual · In-person',  cat: 'individual' },
  { day: 1, start: 16 * 60,     dur: 45, title: 'Intake calls',       sub: 'Admin block',             cat: 'admin' },
  { day: 2, start: 10 * 60,     dur: 50, title: 'Fatima Bakare',      sub: 'Individual · Telehealth', cat: 'individual' },
  { day: 2, start: 12 * 60,     dur: 60, title: 'Notes & billing',    sub: 'Admin block',             cat: 'admin' },
  { day: 2, start: 15 * 60,     dur: 80, title: 'Ada & Emeka',        sub: 'Couples · In-person',     cat: 'couples' },
  { day: 3, start: 9 * 60,      dur: 50, title: 'Chidi Nwosu',        sub: 'Individual · Telehealth', cat: 'individual' },
  { day: 3, start: 11 * 60 + 30,dur: 50, title: 'Yemi Adeyemi',       sub: 'Individual · Telehealth', cat: 'individual' },
  { day: 3, start: 14 * 60,     dur: 60, title: 'Supervision',        sub: 'Admin block',             cat: 'admin' },
  { day: 4, start: 14 * 60,     dur: 60, title: 'Adaeze Okonkwo',     sub: 'Individual · Telehealth', cat: 'individual' },
  { day: 4, start: 15 * 60 + 30,dur: 50, title: 'Tunde Bello',        sub: 'Individual · In-person',  cat: 'individual' },
  { day: 4, start: 17 * 60,     dur: 60, title: 'Ngozi & Michael',    sub: 'Couples · Telehealth',    cat: 'couples' },
];

const HOURS = ['9 AM','10 AM','11 AM','12 PM','1 PM','2 PM','3 PM','4 PM','5 PM','6 PM'];
const ROW_H = 62;
const ORIGIN = 9 * 60;

function catColor(cat) {
  if (cat === 'individual') return 'var(--brand-primary)';
  if (cat === 'couples') return 'var(--brand-secondary)';
  return 'var(--desk-border-strong)';
}

function ScheduleEvent({ e }) {
  const color = catColor(e.cat);
  return (
    <div style={{
      position: 'absolute',
      left: 6, right: 6,
      top: ((e.start - ORIGIN) / 60) * ROW_H,
      height: (e.dur / 60) * ROW_H - 5,
      borderRadius: 12,
      padding: '8px 10px',
      overflow: 'hidden',
      background: `color-mix(in srgb, ${color} 8%, #fff)`,
      border: `1px solid color-mix(in srgb, ${color} 33%, #fff)`,
      borderLeft: `3px solid ${color}`,
      cursor: 'pointer',
      transition: 'filter var(--dur-color) ease-out',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
      <div style={{ fontSize: 10.5, color: 'var(--desk-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.sub}</div>
    </div>
  );
}

function Schedule() {
  const { Card, IconButton } = window.DESK;

  const legend = [
    { c: 'var(--brand-primary)', l: 'Individual' },
    { c: 'var(--brand-secondary)', l: 'Couples' },
    { c: 'var(--desk-border-strong)', l: 'Admin block' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>3 — 7 August 2026</span>
        <IconButton size={32} variant="outline" aria-label="Previous week"><Icon d={ICON.chevronLeft} size={16} /></IconButton>
        <IconButton size={32} variant="outline" aria-label="Next week"><Icon d={ICON.chevronRight} size={16} /></IconButton>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          {legend.map(g => (
            <span key={g.l} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--desk-text-muted)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 4, background: g.c }} />{g.l}
            </span>
          ))}
        </div>
      </div>

      <Card padding={0} style={{ overflow: 'hidden', flex: 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(5, 1fr)' }}>

          {/* gutter */}
          <div style={{ background: 'var(--desk-surface-alt)', borderRight: '1px solid var(--desk-border)' }}>
            <div style={{ height: 58 }} />
            {HOURS.map(h => (
              <div key={h} style={{ height: ROW_H, textAlign: 'right', paddingRight: 10,
                                    fontSize: 10.5, fontWeight: 600, color: 'var(--desk-text-subtle)',
                                    transform: 'translateY(-6px)' }}>{h}</div>
            ))}
          </div>

          {WEEK_DAYS.map((d, i) => (
            <div key={d.dow} style={{ borderRight: i < 4 ? '1px solid var(--desk-border)' : 'none' }}>
              <div style={{ height: 58, display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', gap: 3, borderBottom: '1px solid var(--desk-border)' }}>
                <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', color: 'var(--desk-text-subtle)' }}>{d.dow}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{d.date}</div>
              </div>
              <div style={{
                position: 'relative',
                height: ROW_H * HOURS.length,
                background: `repeating-linear-gradient(#fff 0 ${ROW_H - 1}px, #EEF2F6 ${ROW_H - 1}px ${ROW_H}px)`,
              }}>
                {EVENTS.filter(e => e.day === i).map((e, k) => <ScheduleEvent key={k} e={e} />)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScheduleHeaderActions({ view, setView }) {
  const { SegmentedControl, Button } = window.DESK;
  return (
    <React.Fragment>
      <SegmentedControl options={['Week', 'Day', 'Month']} value={view} onChange={setView} />
      <Button variant="secondary" size="lg">Set availability</Button>
      <Button variant="primary" size="lg" icon={<Icon d={ICON.plus} size={15} />}>New session</Button>
    </React.Fragment>
  );
}

window.Schedule = Schedule;
window.ScheduleHeaderActions = ScheduleHeaderActions;
