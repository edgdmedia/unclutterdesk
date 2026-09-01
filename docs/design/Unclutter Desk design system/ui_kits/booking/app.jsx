/* Public booking page — presented inside browser chrome purely to communicate
   that this is a page on the therapist's own domain. Do not build the chrome. */

const params = new URLSearchParams(location.search);
const embed = params.get('embed') === '1';
if (embed) document.body.dataset.embed = '1';

function BookingApp() {
  const [screen, setScreen] = React.useState(params.get('screen') === 'confirmed' ? 'confirmed' : 'booking');
  const [state, setState] = React.useState({
    service: 'individual', date: 14, slot: '11:30 AM', format: 'Online',
  });
  const set = patch => setState(s => ({ ...s, ...patch }));

  const primary   = params.get('primary')   || '#24614F';
  const secondary = params.get('secondary') || '#8A5A3C';

  return (
    <div className="desk-tenant" style={{ '--brand-primary': primary, '--brand-secondary': secondary }}>
      <div style={{ width: 1180, margin: embed ? 0 : '28px auto', background: '#fff',
                    borderRadius: embed ? 0 : 18, overflow: 'hidden',
                    boxShadow: embed ? 'none' : 'var(--desk-shadow-frame)' }}>
        <div className="chrome">
          <span className="dot" style={{ background: '#FF5F57' }} />
          <span className="dot" style={{ background: '#FEBC2E' }} />
          <span className="dot" style={{ background: '#28C840' }} />
          <span style={{ margin: '0 auto', display: 'flex', alignItems: 'center', gap: 7,
                         background: 'var(--desk-surface-muted)', borderRadius: 999, padding: '5px 16px',
                         fontSize: 12, color: 'var(--desk-text-muted)' }}>
            <Icon d={ICON.lock} size={12} style={{ color: 'var(--desk-active)' }} />
            booking.drsmiththerapy.com
          </span>
        </div>

        {screen === 'booking'
          ? <BookingPortal state={state} set={set} onConfirm={() => setScreen('confirmed')} />
          : <BookingConfirmed state={state} onReschedule={() => setScreen('booking')} />}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<BookingApp />);
