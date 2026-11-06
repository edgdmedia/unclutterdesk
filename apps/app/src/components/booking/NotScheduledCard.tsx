import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, X } from 'lucide-react';
import { Card, Eyebrow, useToast } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import { formatWhen } from '../../utils/displayFormat';
import { MoveSessionPanel } from './MoveSessionPanel';

type PlanSessionRow = {
  id: string;
  serviceId: string;
  serviceTitle: string;
  durationMinutes: number | null;
  provider: { id: string; name: string };
  format: string;
  paymentMethod: string;
};

/**
 * §11.2 on the client page: sessions paid for with no time yet. The client
 * chooses in their portal; staff can choose for them here, from the open
 * times or a custom time, with the same rules as any booking.
 */
export function NotScheduledCard({ client, onScheduled }: { client: { id: string; name: string }; onScheduled?: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<PlanSessionRow[]>([]);
  const [choosing, setChoosing] = useState<PlanSessionRow | null>(null);

  const load = useCallback(() => {
    api.get<PlanSessionRow[]>(`/v1/consult/practice/clients/${client.id}/plan-sessions`).then((r) => setRows(r ?? [])).catch(() => setRows([]));
  }, [client.id]);
  useEffect(load, [load]);

  if (!rows.length) return null;
  return (
    <Card padding="p-[22px]" className="space-y-3">
      <Eyebrow>NOT SCHEDULED</Eyebrow>
      <p className="text-[12.5px] text-[var(--desk-text-muted)]">
        Paid for, waiting for a time. {client.name} can choose one in their portal, or you can choose it here.
      </p>
      <ul className="divide-y divide-[var(--desk-border-soft)]">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-[var(--desk-text)]">{r.serviceTitle}</div>
              <div className="text-[11.5px] text-[var(--desk-text-muted)]">
                with {r.provider.name} · {r.format === 'IN_PERSON' ? 'In person' : 'Online'} · {r.paymentMethod === 'NONE' ? 'No charge' : 'Paid'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChoosing(r)}
              className="h-[36px] px-3 rounded-[10px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-[12px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CalendarPlus className="h-4 w-4" /> Choose time
            </button>
          </li>
        ))}
      </ul>

      {choosing ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--desk-sidebar)]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="choose-time-title">
          <div className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-[20px] bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <h2 id="choose-time-title" className="text-[16px] font-bold text-[var(--desk-text)]">Choose a time for {client.name}</h2>
              <button type="button" onClick={() => setChoosing(null)} aria-label="Close" className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[var(--desk-text-muted)] hover:bg-[var(--desk-surface-muted)] cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <MoveSessionPanel
              session={{ id: choosing.id, serviceId: choosing.serviceId, serviceTitle: choosing.serviceTitle, startsAt: null, durationMinutes: choosing.durationMinutes, format: choosing.format, client, provider: choosing.provider }}
              submitPath={`/v1/consult/practice/plan-sessions/${choosing.id}/schedule`}
              onMoved={(r) => {
                setChoosing(null);
                toast.success(`Booked for ${formatWhen(r.startsAt, 'long')}. ${client.name} has been emailed.`);
                load();
                onScheduled?.();
              }}
            />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
