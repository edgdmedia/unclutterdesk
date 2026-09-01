/* Brand Settings (/brand) — the two tenant hexes, and a live scaled preview
   of the public booking page they drive. */

function BrandSettings({ brand, setBrand, active, setActive, preview, setPreview }) {
  const { Card, Eyebrow, Badge, StatusPill, Button, Input, Toggle, ColorField, PresetSwatches, SegmentedControl } = window.DESK;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '400px minmax(0,1fr)', gap: 20, alignItems: 'start' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
            <div style={{ marginLeft: 'auto' }}><Toggle checked={active} onChange={setActive} /></div>
          </div>
        </Card>
      </div>

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--desk-border)' }}>
          <div>
            <Eyebrow>Live preview</Eyebrow>
            <div style={{ fontSize: 13, color: 'var(--desk-text-muted)', marginTop: 7 }}>
              booking.drsmiththerapy.com — updates as you pick
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <SegmentedControl options={['Booking', 'Confirmed']} value={preview} onChange={setPreview} height={36} />
          </div>
        </div>
        <div style={{ height: 620, overflow: 'hidden', background: 'var(--desk-surface-alt)' }}>
          <iframe
            title="Booking preview"
            src={`../booking/index.html?embed=1&screen=${preview === 'Confirmed' ? 'confirmed' : 'booking'}&primary=${encodeURIComponent(brand.primary)}&secondary=${encodeURIComponent(brand.secondary)}`}
            style={{ width: 1180, height: 1030, border: 'none', transform: 'scale(.6)', transformOrigin: 'top left' }}
          />
        </div>
      </Card>
    </div>
  );
}

function BrandHeaderActions() {
  const { Button } = window.DESK;
  return (
    <React.Fragment>
      <Button variant="secondary" size="lg" icon={<Icon d={ICON.globe} size={15} />}>View live page</Button>
      <Button variant="primary" size="lg">Save changes</Button>
    </React.Fragment>
  );
}

window.BrandSettings = BrandSettings;
window.BrandHeaderActions = BrandHeaderActions;
