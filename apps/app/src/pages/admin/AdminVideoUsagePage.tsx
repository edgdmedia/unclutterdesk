import { useState } from 'react';
import useSWR from 'swr';
import { Card, Eyebrow } from '@unclutterdesk/ui';

type VideoUsageReport = {
  month: string;
  limits: { dailyMinutes: number; jaasUsers: number };
  totals: Array<{ provider: string; minutes: number; participants: number }>;
  practices: Array<{ tenantId: string; name: string; provider: string; minutes: number; sessions: number }>;
};

const PROVIDER_LABEL: Record<string, string> = { DAILY: 'Daily', JAAS: 'JaaS', LINK: 'New-tab link', GOOGLE_MEET: 'Google Meet' };
const n = (v: number) => v.toLocaleString('en-US');

/** This month in Lagos, as YYYY-MM. */
function thisMonth(): string {
  const wat = new Date(Date.now() + 60 * 60 * 1000);
  return `${wat.getUTCFullYear()}-${String(wat.getUTCMonth() + 1).padStart(2, '0')}`;
}

function Budget({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <Card className="p-5 space-y-3">
      <Eyebrow>{label}</Eyebrow>
      <p className="text-[20px] font-bold text-[var(--desk-text)]">{`${n(used)} of ${n(limit)} ${unit}`}</p>
      <div
        role="progressbar"
        aria-label={`${label} used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2.5 w-full rounded-full bg-[var(--desk-border)] overflow-hidden"
      >
        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-[var(--desk-danger)]' : pct >= 70 ? 'bg-[var(--ds-sky)]' : 'bg-[var(--desk-pine-600)]'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[12px] text-[var(--desk-text-muted)]">{pct}% of this month's budget. New rooms move to the next provider when it runs out.</p>
    </Card>
  );
}

/**
 * VID-01: each month's video minutes, against the Daily and JaaS budgets the
 * router works to, and by practice for planning.
 */
export function AdminVideoUsagePage() {
  const [month, setMonth] = useState(thisMonth);
  const { data, isLoading, error } = useSWR<VideoUsageReport>(`/v1/admin/video-usage?month=${month}`);
  const total = (provider: string) => data?.totals.find((t) => t.provider === provider);

  return (
    <div className="flex-1 min-w-0 px-4 md:px-[32px] py-[28px] max-w-[1200px] w-full">
      <Eyebrow>Platform console</Eyebrow>
      <h1 className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-[var(--desk-text)]">Video usage</h1>
      <p className="mt-1 text-[13.5px] text-[var(--desk-text-muted)]">Minutes spent in session rooms, by provider and by practice. Google Meet time isn't counted.</p>

      <label className="mt-5 inline-flex flex-col gap-1 text-[11.5px] font-bold text-[var(--desk-text-body)]">
        Month
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="h-[40px] rounded-[12px] border border-[var(--desk-border)] bg-white px-3 text-[13px] font-semibold text-[var(--desk-text)]"
        />
      </label>

      {error ? <p className="mt-6 text-[13px] text-[var(--desk-danger)]">Could not load video usage.</p> : null}
      {isLoading && !data ? <p className="mt-6 text-[13px] text-[var(--desk-text-muted)]">Loading…</p> : null}

      {data ? (
        <>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Budget label="Daily minutes" used={total('DAILY')?.minutes ?? 0} limit={data.limits.dailyMinutes} unit="minutes" />
            <Budget label="JaaS people" used={total('JAAS')?.participants ?? 0} limit={data.limits.jaasUsers} unit="people" />
          </div>

          <Card className="mt-6 p-0 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[var(--desk-surface)] text-[11px] font-black tracking-wider uppercase text-[var(--desk-text-muted)]">
                <tr>
                  <th className="px-4 py-3">Practice</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3 text-right">Minutes</th>
                  <th className="px-4 py-3 text-right">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {data.practices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[var(--desk-text-muted)]">No video sessions this month.</td>
                  </tr>
                ) : (
                  data.practices.map((p) => (
                    <tr key={`${p.tenantId}-${p.provider}`} className="border-t border-[var(--desk-border)]">
                      <td className="px-4 py-3 font-semibold text-[var(--desk-text)]">{p.name}</td>
                      <td className="px-4 py-3 text-[var(--desk-text-body)]">{PROVIDER_LABEL[p.provider] ?? p.provider}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{n(p.minutes)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{n(p.sessions)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}
    </div>
  );
}
