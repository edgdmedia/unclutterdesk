/* Workspace shell — sidebar navigation across the five therapist screens. */

function App() {
  const { Sidebar, AppHeader } = window.DESK;

  const [screen, setScreen]   = React.useState('dashboard');
  /* House defaults, so the sidebar's pine chrome and the dashboard accents
     agree out of the box. Pick a preset in Brand Settings to see a tenant. */
  const [brand, setBrand]     = React.useState({ primary: '#24614F', secondary: '#8A5A3C' });
  const [active, setActive]   = React.useState(true);
  const [view, setView]       = React.useState('Week');
  const [range, setRange]     = React.useState('12 months');
  const [preview, setPreview] = React.useState('Booking');

  const items = [
    { key: 'dashboard', label: 'Dashboard',      icon: <Icon d={ICON.home} /> },
    { key: 'schedule',  label: 'Schedule',       icon: <Icon d={ICON.calendar} />, count: '4', countTone: 'pine' },
    { key: 'clients',   label: 'Clients',        icon: <Icon d={ICON.users} />,    count: '128' },
    { key: 'brand',     label: 'Brand Settings', icon: <Icon d={ICON.brush} /> },
    { key: 'analytics', label: 'Analytics',      icon: <Icon d={ICON.chart} /> },
  ];

  const meta = {
    dashboard: { eyebrow: 'Practice',    title: 'Dashboard',      actions: <DashboardHeaderActions /> },
    schedule:  { eyebrow: 'This week',   title: 'Schedule',       actions: <ScheduleHeaderActions view={view} setView={setView} /> },
    clients:   { eyebrow: 'Caseload',    title: 'Clients',        actions: <ClientsHeaderActions /> },
    brand:     { eyebrow: 'White label', title: 'Brand Settings', actions: <BrandHeaderActions /> },
    analytics: { eyebrow: 'Performance', title: 'Analytics',      actions: <AnalyticsHeaderActions range={range} setRange={setRange} /> },
  }[screen];

  const body = {
    dashboard: <Dashboard brand={brand} setBrand={setBrand} active={active} setActive={setActive} />,
    schedule:  <Schedule />,
    clients:   <Clients />,
    brand:     <BrandSettings brand={brand} setBrand={setBrand} active={active} setActive={setActive}
                              preview={preview} setPreview={setPreview} />,
    analytics: <Analytics />,
  }[screen];

  return (
    <div className="desk-tenant" style={{
      display: 'flex', height: '100%', minWidth: 1440,
      '--brand-primary': brand.primary,
      '--brand-secondary': brand.secondary,
    }}>
      <Sidebar items={items} active={screen} onSelect={setScreen} assetBase="../../"
               user={{ initials: 'JS', name: 'Dr. Jane Smith', role: 'Clinical Psychologist' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppHeader eyebrow={meta.eyebrow} title={meta.title}>{meta.actions}</AppHeader>
        <main style={{ flex: 1, overflow: 'auto', padding: '24px 26px 30px' }}>{body}</main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
