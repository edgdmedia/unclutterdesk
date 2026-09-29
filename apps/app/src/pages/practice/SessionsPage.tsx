import { useEffect, useState } from 'react';
import { Page, PageHeader, ResponsiveTable, StatusBadge, type Column } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import { RouterLink } from '../../components/shell/RouterLink';
import { PaymentChip } from '../../components/booking/PaymentChip';

export interface SessionRow {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  paymentMethod: string;
  amountKobo: string | null;
  holdExpiresAt: string | null;
  bookedBy: string | null;
  client: { id: string; name: string };
  serviceTitle: string;
  provider: { id: string; name: string };
  channel: string;
}

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

const TABS = ['Upcoming', 'Past', 'All'] as const;

export function SessionsPage({ can }: { can: { viewAll: boolean } }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Upcoming');
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tab !== 'All') params.set('status', tab.toLowerCase());
    if (q.trim()) params.set('q', q.trim());
    api
      .get<SessionRow[]>(`/v1/consult/practice/sessions?${params.toString()}`)
      .then((r) => { setRows(r); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the sessions'))
      .finally(() => setLoading(false));
  }, [tab, q]);

  const columns: Column<SessionRow>[] = [
    {
      key: 'client',
      header: 'Client',
      sort: (a, b) => a.client.name.localeCompare(b.client.name),
      cell: (r) => (
        <span className="flex items-center gap-2 min-w-0">
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-[#0F172A] truncate">{r.client.name}</span>
            <span className="block text-[11.5px] text-[#94A3B8] truncate">{r.serviceTitle}</span>
          </span>
        </span>
      ),
      className: 'w-full max-w-0',
    },
    { key: 'when', header: 'When', sort: (a, b) => a.startsAt.localeCompare(b.startsAt), cell: (r) => <span className="whitespace-nowrap">{when(r.startsAt)}</span> },
    ...(can.viewAll ? [{ key: 'provider', header: 'Practitioner', priority: 'md' as const, cell: (r: SessionRow) => <span className="truncate">{r.provider.name}</span> }] : []),
    { key: 'status', header: 'Status', priority: 'md', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'payment', header: 'Payment', priority: 'lg', cell: (r) => <PaymentChip status={r.status} paymentMethod={r.paymentMethod} holdExpiresAt={r.holdExpiresAt} /> },
  ];

  return (
    <Page
      header={
        <PageHeader
          eyebrow="THE REGISTER"
          title="Sessions"
          actions={
            <div role="tablist" className="h-[40px] p-1 bg-[#EEF2F7] rounded-[14px] inline-flex gap-1 border border-[#E2E8F0]">
              {TABS.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`px-4 shrink-0 whitespace-nowrap rounded-[10px] text-xs font-bold cursor-pointer ${tab === t ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          }
        />
      }
    >
      {error ? (
        <div role="alert" className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      ) : null}
      <div className="rounded-[20px] border border-[#E2E8F0] bg-white overflow-hidden">
        <ResponsiveTable<SessionRow>
          caption="Sessions"
          rows={rows}
          rowKey={(r) => r.id}
          rowLabel={(r) => `${r.client.name}, ${when(r.startsAt)}`}
          columns={columns}
          rowHref={(r) => `/dashboard/sessions/${r.id}`}
          LinkComponent={RouterLink}
          state={loading ? 'loading' : 'ready'}
          empty={tab === 'Upcoming' ? 'Nothing scheduled ahead.' : 'No sessions here yet.'}
          filter={{ placeholder: 'Search sessions', query: q, onQueryChange: setQ }}
        />
      </div>
    </Page>
  );
}
