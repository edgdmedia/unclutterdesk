import React, { useMemo, useState } from 'react';
import { Download, TrendingUp } from 'lucide-react';
import { Eyebrow, Card, SegmentedControl } from '@unclutterdesk/ui';

interface AnalyticsPageProps {
  clients?: Array<{ status?: string }>;
  sessions?: Array<{ type?: string; startsAt?: string; status?: string }>;
}

function monthKey(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
}

const RANGES = {
  '30d': { label: '30 days', months: 1, days: 30 },
  '90d': { label: '90 days', months: 3, days: 90 },
  '12m': { label: '12 months', months: 12, days: 365 },
} as const;

type RangeKey = keyof typeof RANGES;

export function AnalyticsPage({ clients = [], sessions = [] }: AnalyticsPageProps) {
  const [range, setRange] = useState<RangeKey>('12m');
  const primaryColor = '#0F3A53';
  const secondaryColor = '#E3B341';

  /*
   * The range control set state that nothing read. Picking "30 days" left every
   * figure on the page identical — a filter that reports the same answer for
   * every question is worse than no filter, because it looks like it worked.
   */
  const since = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - RANGES[range].days);
    return from;
  }, [range]);

  const sessionsInRange = useMemo(
    () =>
      sessions.filter((session) => {
        if (!session.startsAt) return false;
        return new Date(session.startsAt) >= since;
      }),
    [sessions, since],
  );

  const activeClients = clients.filter((client) => client.status === 'Active').length;
  const completedSessions = sessionsInRange.filter((session) => session.status === 'COMPLETED').length;
  const upcomingSessions = sessionsInRange.filter((session) => session.status !== 'COMPLETED').length;
  const clientRetention = clients.length > 0 ? Math.round((activeClients / clients.length) * 100) : 0;
  const completionRate =
    sessionsInRange.length > 0 ? Math.round((completedSessions / sessionsInRange.length) * 100) : 0;

  const kpis = [
    { label: 'TOTAL CLIENTS', value: clients.length.toString(), delta: `${activeClients} active` },
    { label: 'ACTIVE ROSTER', value: activeClients.toString(), delta: `${clientRetention}% retained` },
    {
      label: 'SESSIONS TRACKED',
      value: sessionsInRange.length.toString(),
      delta: `${completedSessions} completed`,
    },
    { label: 'UPCOMING SESSIONS', value: upcomingSessions.toString(), delta: `${completionRate}% completion rate` },
  ];

  const monthlyBars = useMemo(() => {
    const span = RANGES[range].months;
    const buckets = new Map<string, number>();
    for (let offset = span - 1; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - offset);
      buckets.set(monthKey(date), 0);
    }
    for (const session of sessionsInRange) {
      if (!session.startsAt) continue;
      const key = monthKey(new Date(session.startsAt));
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    return Array.from(buckets.entries()).map(([month, val], index, arr) => ({
      month,
      val,
      current: index === arr.length - 1,
    }));
  }, [sessionsInRange, range]);

  const maxBar = Math.max(1, ...monthlyBars.map((bar) => bar.val));

  /**
   * The report, as a CSV of what is on screen.
   *
   * "Download report" had no handler at all — it was a button that looked
   * enabled, took the click and did nothing. Everything it needs is already in
   * the browser, so it downloads the figures being shown, for the range being
   * shown, rather than promising a document that does not exist.
   */
  function downloadReport() {
    const rows = [
      ['Unclutter Desk — practice analytics'],
      ['Range', RANGES[range].label],
      ['Generated', new Date().toISOString()],
      [],
      ['Measure', 'Value', 'Detail'],
      ...kpis.map((k) => [k.label, k.value, k.delta]),
      [],
      ['Month', 'Sessions'],
      ...monthlyBars.map((bar) => [bar.month, String(bar.val)]),
      [],
      ['Session type', 'Count', 'Share'],
      ...distribution.map((d) => [d.label, String(d.count), `${d.percent}%`]),
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','),
      )
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const distribution = useMemo(() => {
    const total = Math.max(1, sessionsInRange.length);
    const has = (session: { type?: string }, word: string) =>
      (session.type || '').toLowerCase().includes(word);
    const buckets = [
      { label: 'Individual', count: sessionsInRange.filter((s) => has(s, 'individual')).length, color: primaryColor },
      { label: 'Couples', count: sessionsInRange.filter((s) => has(s, 'couples')).length, color: secondaryColor },
      {
        label: 'Other',
        count: sessionsInRange.filter((s) => !has(s, 'individual') && !has(s, 'couples')).length,
        color: '#94A3B8',
      },
    ];
    return buckets.map((bucket) => ({ ...bucket, percent: Math.round((bucket.count / total) * 100) }));
  }, [sessionsInRange]);

  const clientMix = useMemo(() => {
    const total = Math.max(1, clients.length);
    const active = activeClients;
    const pending = clients.filter((client) => client.status === 'Pending Intake').length;
    const paused = clients.filter((client) => client.status === 'Paused').length;
    return [
      { source: 'Active clients', views: `${active} clients`, share: `${Math.round((active / total) * 100)}%` },
      { source: 'Pending intake', views: `${pending} clients`, share: `${Math.round((pending / total) * 100)}%` },
      { source: 'Paused clients', views: `${paused} clients`, share: `${Math.round((paused / total) * 100)}%` },
      { source: 'Completed sessions', views: `${completedSessions} sessions`, share: `${completionRate}%` },
    ];
  }, [clients, activeClients, completedSessions, completionRate]);

  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      <header className="h-[80px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center justify-between gap-5 shrink-0">
        <div>
          <Eyebrow>PRACTICE ANALYTICS</Eyebrow>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Analytics</h1>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <SegmentedControl
            options={['30 days', '90 days', '12 months']}
            value={RANGES[range].label}
            onChange={(next: string) => {
              const found = (Object.keys(RANGES) as RangeKey[]).find(
                (key) => RANGES[key].label === next,
              );
              if (found) setRange(found);
            }}
          />

          <button
            type="button"
            onClick={downloadReport}
            className="h-[40px] px-4 rounded-[14px] bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold hover:bg-[#F8FAFC] flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download report</span>
          </button>
        </div>
      </header>

      <main className="p-[24px_26px_30px] space-y-5 flex-1">
        <div className="grid grid-cols-4 gap-3.5">
          {kpis.map((kpi) => (
            <Card key={kpi.label} padding="p-[16px_18px]">
              <Eyebrow>{kpi.label}</Eyebrow>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-[26px] font-extrabold tracking-[-0.035em] text-[#0F172A] leading-none">{kpi.value}</span>
                <span className="h-[22px] px-2 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] text-[11.5px] font-bold flex items-center gap-0.5">
                  <TrendingUp className="h-3 w-3" />
                  <span>{kpi.delta}</span>
                </span>
              </div>
            </Card>
          ))}
        </div>

        <Card padding="p-[24px_26px]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Eyebrow>LIVE SESSION VOLUME</Eyebrow>
              <h3 className="text-[17px] font-bold text-[#0F172A]">Sessions by month</h3>
            </div>
            <span className="text-[12.5px] text-[#64748B] font-medium">Derived from real scheduled sessions currently loaded</span>
          </div>

          <div className="h-[220px] flex items-end gap-3.5 pt-4">
            {monthlyBars.map((bar) => (
              <div key={bar.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[11px] font-bold text-[#64748B]">{bar.val}</span>
                <div
                  className="w-full rounded-t-[10px] rounded-b-[4px] transition-all duration-300 min-h-[8px]"
                  style={{
                    height: `${(bar.val / maxBar) * 100}%`,
                    backgroundColor: bar.current ? primaryColor : `${primaryColor}2E`,
                  }}
                />
                <span className="text-[10.5px] font-semibold text-[#94A3B8]">{bar.month}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-5">
          <Card padding="p-[22px_24px]">
            <Eyebrow className="mb-1">SERVICE DISTRIBUTION</Eyebrow>
            <h3 className="text-[17px] font-bold text-[#0F172A] mb-4">Session mix</h3>

            <div className="space-y-4">
              {distribution.map((bucket) => (
                <div key={bucket.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0F172A]">{bucket.label}</span>
                    <span className="text-[#94A3B8]">{bucket.count} sessions</span>
                    <strong className="font-extrabold text-[#0F172A]">{bucket.percent}%</strong>
                  </div>
                  <div className="h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${bucket.percent}%`, backgroundColor: bucket.color }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="p-[22px_24px]">
            <Eyebrow className="mb-1">LIVE MIX</Eyebrow>
            <h3 className="text-[17px] font-bold text-[#0F172A] mb-4">Roster and completion snapshot</h3>

            <div className="divide-y divide-[#F1F5F9]">
              {clientMix.map((item) => (
                <div key={item.source} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                  <div>
                    <h4 className="text-[13.5px] font-semibold text-[#0F172A] leading-tight truncate">{item.source}</h4>
                    <span className="text-[12px] text-[#94A3B8] font-medium">{item.views}</span>
                  </div>
                  <span className="text-[13.5px] font-extrabold text-[#0F172A] text-right w-[40px] shrink-0">{item.share}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
