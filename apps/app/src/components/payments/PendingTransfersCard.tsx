import { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { Card, useToast } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';

interface PendingTransfer {
  id: string;
  reference: string;
  amountKobo: string;
  serviceTitle: string;
  startsAt: string;
  holdExpiresAt: string | null;
  clientReportedPaidAt: string | null;
  client: { name: string; email: string };
}

const naira = (kobo: string) => `₦${(Number(kobo) / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/** Bookings waiting for a bank transfer, for whoever confirms payments. Hidden when there are none. */
export function PendingTransfersCard({ color }: { color: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<PendingTransfer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.get<PendingTransfer[]>('/v1/consult/manual-payments/pending').then(setRows).catch(() => setRows([]));
  }, []);

  async function markPaid(row: PendingTransfer) {
    setBusy(row.id);
    try {
      await api.post(`/v1/consult/bookings/${row.id}/mark-paid`, {});
      setRows((current) => current.filter((r) => r.id !== row.id));
      toast.success(`${row.client.name}'s session is confirmed. They have been emailed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not confirm the payment');
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) return null;
  return (
    <Card padding="p-[20px_22px]" className="bg-white border border-amber-200">
      <div className="flex items-center gap-2">
        <Landmark className="h-4 w-4 text-[#B45309]" />
        <h2 className="text-[14px] font-bold text-[#0F172A]">Awaiting bank transfer</h2>
        <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-[#FFFBEB] text-[#B45309]">{rows.length}</span>
      </div>
      <p className="mt-1 text-xs text-[#64748B]">Check your account for the reference, then mark it paid. Unpaid holds are released automatically.</p>
      <ul className="mt-3 divide-y divide-[#F1F5F9]">
        {rows.map((row) => (
          <li key={row.id} className="py-2.5 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <p className="text-[13.5px] font-bold text-[#0F172A]">
                {row.client.name} · {naira(row.amountKobo)} <span className="font-mono text-[12px] text-[#475569]">{row.reference}</span>
              </p>
              <p className="text-[11.5px] text-[#64748B]">
                {row.serviceTitle} on {when(row.startsAt)}
                {row.holdExpiresAt ? ` · held until ${when(row.holdExpiresAt)}` : ''}
              </p>
              {row.clientReportedPaidAt ? <p className="text-[11.5px] font-semibold text-[#047857]">Client says they paid, {when(row.clientReportedPaidAt)}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => void markPaid(row)}
              disabled={busy === row.id}
              className="h-9 px-3.5 rounded-[10px] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              style={{ backgroundColor: color }}
            >
              {busy === row.id ? 'Confirming…' : 'Mark paid'}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
