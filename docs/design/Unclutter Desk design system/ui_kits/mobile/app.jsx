/* Mobile kit board — the five screens side by side, each with the shared
   frosted bottom navigation (the public booking screen has none). */

function MobileApp() {
  const { BottomNav } = window.DESK;
  /* House defaults, so the frames agree with the Desk chrome out of the box. */
  const [brand, setBrand] = React.useState({ primary: '#24614F', secondary: '#8A5A3C' });
  const [active, setActive] = React.useState(true);

  const tabs = [
    { label: 'Today',    icon: <Icon d={ICON.home} size={20} /> },
    { label: 'Schedule', icon: <Icon d={ICON.calendar} size={20} /> },
    { label: 'Clients',  icon: <Icon d={ICON.users} size={20} /> },
    { label: 'Brand',    icon: <Icon d={ICON.brush} size={20} /> },
  ];

  const screens = [
    { tab: 'Today',    label: '1 · Today',           node: <MobileToday /> },
    { tab: 'Schedule', label: '2 · Schedule',        node: <MobileSchedule /> },
    { tab: 'Clients',  label: '3 · Clients',         node: <MobileClients /> },
    { tab: 'Brand',    label: '4 · Brand & link',    node: <MobileBrand brand={brand} setBrand={setBrand} active={active} setActive={setActive} /> },
    { tab: null,       label: '5 · Client booking',  node: <MobileBooking /> },
  ];

  return (
    <div className="desk-tenant" style={{
      display: 'flex', gap: 32, padding: '40px 44px', alignItems: 'flex-start',
      '--brand-primary': brand.primary, '--brand-secondary': brand.secondary,
    }}>
      {screens.map(s => (
        <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.22em', textTransform: 'uppercase',
                        color: 'var(--desk-text-subtle)' }}>{s.label}</div>
          <div style={M.frame}>
            {s.node}
            {s.tab && <BottomNav items={tabs} active={s.tab} />}
          </div>
        </div>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MobileApp />);
