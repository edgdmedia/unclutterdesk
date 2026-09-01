/* Analytics (/analytics) — practice performance over time and where bookings come from. */

const MONTHS_12 = [
  { label:'Sep', value:238 }, { label:'Oct', value:262 }, { label:'Nov', value:251 },
  { label:'Dec', value:305 }, { label:'Jan', value:288 }, { label:'Feb', value:331 },
  { label:'Mar', value:318 }, { label:'Apr', value:372 }, { label:'May', value:355 },
  { label:'Jun', value:401 }, { label:'Jul', value:380 }, { label:'Aug', value:450, current:true },
];

const SOURCES = [
  { label:'Direct booking link',        meta:'1,412 views', percent:48 },
  { label:'booking.drsmiththerapy.com', meta:'926 views',   percent:32 },
  { label:'Referral from GP network',   meta:'412 views',   percent:14 },
  { label:'Instagram bio',              meta:'190 views',   percent:6  },
];

function Analytics() {
  const { Card, Eyebrow, StatTile, BarChart, ProgressRow } = window.DESK;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <StatTile label="Revenue · 12 mo"    value="₦4.28M" delta="+31.4%" />
        <StatTile label="Sessions delivered" value="618"    delta="+12.9%" />
        <StatTile label="Client retention"   value="78%"    delta="+4.1 pts" />
        <StatTile label="No-show rate"       value="6%"     delta="−2.3 pts" />
        <StatTile label="Booking page views" value="2,940"  delta="+58%" />
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="d-card-title">Revenue by month</span>
          <span style={{ fontSize: 12.5, color: 'var(--desk-text-muted)' }}>
            Sep 2025 — Aug 2026 · ₦4,281,000 total
          </span>
        </div>
        <div style={{ marginTop: 22 }}>
          <BarChart data={MONTHS_12} height={200} gap={14} showValues formatValue={v => '₦' + v + 'k'} />
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <Card>
          <Eyebrow>Session mix</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <ProgressRow label="Individual · 50 min" meta="412 sessions" percent={67} />
            <ProgressRow label="Couples · 80 min"    meta="128 sessions" percent={21} tone="secondary" />
            <ProgressRow label="Intake consults"     meta="78 sessions"  percent={12} tone="muted" />
          </div>
        </Card>

        <Card>
          <Eyebrow>Where bookings come from</Eyebrow>
          <div style={{ marginTop: 8 }}>
            {SOURCES.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '13px 0',
                                          borderTop: i === 0 ? 'none' : '1px solid var(--desk-border-soft)' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                <span style={{ fontSize: 12, color: 'var(--desk-text-subtle)', whiteSpace: 'nowrap' }}>{s.meta}</span>
                <span style={{ marginLeft: 'auto', width: 40, textAlign: 'right', fontSize: 13.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {s.percent}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function AnalyticsHeaderActions({ range, setRange }) {
  const { SegmentedControl, Button } = window.DESK;
  return (
    <React.Fragment>
      <SegmentedControl options={['30 days', '90 days', '12 months']} value={range} onChange={setRange} />
      <Button variant="secondary" size="lg" icon={<Icon d={ICON.download} size={15} />}>Download report</Button>
    </React.Fragment>
  );
}

window.Analytics = Analytics;
window.AnalyticsHeaderActions = AnalyticsHeaderActions;
