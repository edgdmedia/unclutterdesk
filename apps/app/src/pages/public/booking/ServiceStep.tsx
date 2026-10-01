import React from 'react';
import { CalendarDays } from 'lucide-react';
import { formatsOffered, slotsForService, type Slot } from './bookingSlots';
import type { PublicService } from './useBookingData';
import { StateBox, naira } from './BookingShell';

const TAG = 'h-[26px] px-[11px] rounded-full bg-[#F1F5F9] text-[12px] font-semibold text-[#475569] inline-flex items-center';

/** Step 1: the practice's services as cards (README, Step 1). */
export function ServiceStep({
  status,
  services,
  slots,
  selectedId,
  onChoose,
  practiceEmail,
}: {
  status: 'loading' | 'ready' | 'error';
  services: PublicService[];
  slots: Slot[];
  selectedId: string | null;
  onChoose: (serviceId: string) => void;
  practiceEmail?: string | null;
}) {
  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} data-skeleton className="rounded-[20px] border border-[#E2E8F0] p-[18px] space-y-3 animate-pulse">
            <div className="h-4 w-1/2 rounded bg-[#F1F5F9]" />
            <div className="h-3 w-3/4 rounded bg-[#F1F5F9]" />
            <div className="h-6 w-20 rounded-full bg-[#F1F5F9]" />
          </div>
        ))}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <StateBox icon={<CalendarDays className="h-5 w-5" />} title="No sessions open for booking">
        <p className="text-[13.5px] text-[#64748B]">This practice isn't taking bookings online right now.</p>
        {practiceEmail ? (
          <a href={`mailto:${practiceEmail}`} className="text-[13.5px] font-bold" style={{ color: 'var(--brand-ink, var(--brand-primary))' }}>
            Email {practiceEmail}
          </a>
        ) : null}
      </StateBox>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {services.map((service) => {
        const selected = service.id === selectedId;
        const formats = formatsOffered(slotsForService(slots, service.id));
        return (
          <button
            key={service.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChoose(service.id)}
            className="text-left rounded-[20px] p-[18px] bg-white border transition-transform duration-150 ease-out hover:-translate-y-px cursor-pointer"
            style={{
              borderColor: selected ? 'transparent' : '#E2E8F0',
              boxShadow: selected ? '0 0 0 2px var(--brand-primary)' : undefined,
            }}
          >
            <span className="flex items-start justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-[16px] font-bold text-[#0F172A]">{service.title}</span>
                {service.description ? <span className="block mt-1 text-[13.5px] leading-[1.5] text-[#64748B]">{service.description}</span> : null}
              </span>
              <span className="text-right shrink-0">
                <span className="block text-[16px] font-bold text-[#0F172A]" style={{ fontVariantNumeric: 'tabular-nums' }}>{naira(service.priceKobo)}</span>
                <span className="block text-[12.5px] text-[#64748B]">{service.durationMinutes} min</span>
              </span>
            </span>
            {formats.length ? (
              <span className="mt-3 flex flex-wrap gap-1.5">
                {formats.map((f) => <span key={f} className={TAG}>{f}</span>)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
