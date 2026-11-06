import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';
import { api } from '../../../utils/apiClient';
import { RescheduleDialog, type OpenPlanSession } from '../../../components/RescheduleDialog';

type PlanSessionRow = OpenPlanSession & { serviceId: string; format: string; paymentMethod: string };

/**
 * §11.2: sessions already paid for that have no time yet. The client sees
 * sessions, not credits: "Individual Therapy with Segun Ade · Paid · Not
 * scheduled", and chooses a time from the practitioner's open times. The
 * time is booked straight away, with no payment step.
 */
export function ToSchedulePanel({ onBooked }: { onBooked: () => void }) {
  const brand = useBrand();
  const accent = brand.primaryColor || '#0F3A53';
  const [rows, setRows] = useState<PlanSessionRow[]>([]);
  const [choosing, setChoosing] = useState<PlanSessionRow | null>(null);

  const load = useCallback(() => {
    api.get<PlanSessionRow[]>('/v1/consult/portal/plan-sessions').then((r) => setRows(r ?? [])).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  if (!rows.length) return null;
  return (
    <section aria-label="To schedule" className="bg-white rounded-[22px] border border-[var(--desk-border)] overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <div className="text-[10.5px] font-black uppercase tracking-[0.14em] text-[var(--desk-text-subtle)]">To schedule</div>
        <p className="mt-1 text-[12.5px] text-[var(--desk-text-muted)]">
          {rows.length === 1 ? 'A session you have paid for is waiting for a time.' : `${rows.length} sessions you have paid for are waiting for a time.`}
        </p>
      </div>
      <ul className="divide-y divide-[var(--desk-border-soft)]">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-[14px]">
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-[var(--desk-text)]">{r.serviceTitle}</div>
              <div className="text-[12px] text-[var(--desk-text-muted)] font-medium">
                with {r.provider.name} · {r.paymentMethod === 'NONE' ? 'No charge' : 'Paid'} · Not scheduled
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChoosing(r)}
              className="h-[38px] px-4 rounded-[12px] text-white text-[12.5px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: accent }}
            >
              <CalendarPlus className="h-4 w-4" /> Choose a time
            </button>
          </li>
        ))}
      </ul>
      {choosing ? (
        <RescheduleDialog
          planSession={choosing}
          primaryColor={accent}
          onClose={() => setChoosing(null)}
          onRescheduled={() => {
            setChoosing(null);
            load();
            onBooked();
          }}
        />
      ) : null}
    </section>
  );
}
