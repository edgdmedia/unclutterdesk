import React, { useMemo } from 'react';
import { CalendarX, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { Button, SegmentedControl } from '@unclutterdesk/ui';
import {
  dayKeyWAT,
  formatOf,
  formatsOffered,
  nextDayWithSlots,
  slotsForService,
  slotsOnDay,
  timeLabelWAT,
  weekDays,
  weekLabel,
  WINDOW_DAYS,
  addDays,
  type Slot,
} from './bookingSlots';
import type { WizardAction, WizardState, FormatFilter } from './bookingWizard';
import type { PublicService } from './useBookingData';
import { AlertBanner, StateBox, naira } from './BookingShell';

const ZONE = 'Africa/Lagos';
const weekdayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, weekday: 'short' });
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, day: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, month: 'short' });
const noon = (key: string) => new Date(`${key}T12:00:00Z`);

/** "Tue, 6 Oct" */
export function dayLabel(key: string): string {
  const d = noon(key);
  return `${weekdayFmt.format(d)}, ${dayFmt.format(d)} ${monthFmt.format(d)}`;
}

function daysBetween(fromKey: string, toKey: string) {
  return Math.round((noon(toKey).getTime() - noon(fromKey).getTime()) / 86_400_000);
}

const BRAND_INK = 'var(--brand-ink, var(--brand-primary))';

/** Step 2: pick a day and a time (README, Step 2). */
export function TimeStep({
  service,
  slots,
  today,
  state,
  dispatch,
  practiceAddress,
  practiceContact,
  singleService,
  onChangeService,
}: {
  service: PublicService;
  slots: Slot[];
  today: Date;
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  practiceAddress?: string | null;
  practiceContact?: { email?: string | null; phone?: string | null };
  singleService: boolean;
  onChangeService: () => void;
}) {
  const todayKey = dayKeyWAT(today);
  const lastKey = addDays(todayKey, WINDOW_DAYS - 1);
  const serviceSlots = useMemo(
    () => slotsForService(slots, service.id).filter((s) => {
      const d = dayKeyWAT(s.startsAt);
      return d >= todayKey && d <= lastKey;
    }),
    [slots, service.id, todayKey, lastKey],
  );
  const days = weekDays(today, state.weekIndex);
  const hasTimes = (day: string) => slotsOnDay(serviceSlots, day, 'All').length > 0;
  const dayFormats = state.date ? formatsOffered(slotsOnDay(serviceSlots, state.date, 'All')) : [];
  const times = state.date ? slotsOnDay(serviceSlots, state.date, dayFormats.length > 1 ? state.formatFilter : 'All') : [];
  const chosen = serviceSlots.find((s) => s.id === state.slotId) ?? null;
  const weekHasTimes = days.some(hasTimes);
  const nextDay = weekHasTimes ? null : nextDayWithSlots(serviceSlots, days[6]);

  function goTo(day: string) {
    const week = Math.min(3, Math.max(0, Math.floor(daysBetween(todayKey, day) / 7))) as 0 | 1 | 2 | 3;
    dispatch({ type: 'setWeek', weekIndex: week });
    dispatch({ type: 'chooseDate', date: day });
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {state.slotTaken ? (
        <AlertBanner title="That time was just booked">Here are the nearest free times. Nothing has been charged.</AlertBanner>
      ) : null}

      <div className={`rounded-[18px] bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-3 flex items-center justify-between gap-3 ${singleService ? '' : 'min-[1024px]:hidden'}`}>
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-[#0F172A] truncate">{service.title}</div>
          <div className="text-[12.5px] text-[#64748B]">{service.durationMinutes} min · {naira(service.priceKobo)}</div>
        </div>
        {!singleService ? (
          <button type="button" onClick={onChangeService} className="h-11 px-2 text-[13px] font-bold cursor-pointer" style={{ color: BRAND_INK }}>
            Change
          </button>
        ) : null}
      </div>

      {serviceSlots.length === 0 ? (
        <StateBox icon={<CalendarX className="h-5 w-5" />} title="No free times in the next 4 weeks">
          <p className="text-[13.5px] text-[#64748B]">The practice hasn't opened any times yet. Get in touch and they'll find one for you.</p>
          {practiceContact?.email ? (
            <a href={`mailto:${practiceContact.email}`} className="text-[13.5px] font-bold" style={{ color: BRAND_INK }}>{practiceContact.email}</a>
          ) : null}
          {practiceContact?.phone ? (
            <a href={`tel:${practiceContact.phone.replace(/\s+/g, '')}`} className="text-[13.5px] font-bold" style={{ color: BRAND_INK }}>{practiceContact.phone}</a>
          ) : null}
        </StateBox>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[14px] font-bold text-[#0F172A]">{weekLabel(days)}</span>
            <div className="flex gap-2">
              {(['Previous week', 'Next week'] as const).map((label, i) => {
                const target = state.weekIndex + (i === 0 ? -1 : 1);
                const disabled = target < 0 || target > 3;
                return (
                  <button
                    key={label}
                    type="button"
                    aria-label={label}
                    disabled={disabled}
                    onClick={() => dispatch({ type: 'setWeek', weekIndex: target as 0 | 1 | 2 | 3 })}
                    className="h-11 w-11 rounded-[14px] border border-[#E2E8F0] bg-white inline-flex items-center justify-center cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    {i === 0 ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-[5px] min-[601px]:gap-2">
            {days.map((day) => {
              const available = hasTimes(day);
              const selected = day === state.date;
              const d = noon(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={dayLabel(day)}
                  aria-pressed={selected}
                  disabled={!available}
                  onClick={() => dispatch({ type: 'chooseDate', date: day })}
                  className="h-[68px] rounded-[16px] border flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    background: selected ? 'var(--brand-primary)' : '#FFFFFF',
                    color: selected ? 'var(--brand-on-primary)' : '#0F172A',
                    borderColor: selected ? 'transparent' : '#E2E8F0',
                  }}
                >
                  <span className="text-[11px] font-semibold opacity-80">{weekdayFmt.format(d)}</span>
                  <span className="text-[17px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{dayFmt.format(d)}</span>
                  <span className="h-[5px] w-[5px] rounded-full" style={{ background: available ? (selected ? 'var(--brand-on-primary)' : 'var(--brand-dot)') : 'transparent' }} />
                </button>
              );
            })}
          </div>

          {!weekHasTimes ? (
            <StateBox title="No times this week">
              {nextDay ? (
                <>
                  <p className="text-[13.5px] text-[#64748B]">The next free time is on {dayLabel(nextDay)}.</p>
                  <Button variant="secondary" size="lg" onClick={() => goTo(nextDay)}>{`Go to ${dayLabel(nextDay)} →`}</Button>
                </>
              ) : null}
            </StateBox>
          ) : null}

          {state.date && dayFormats.length > 1 ? (
            <SegmentedControl
              options={['All', 'Online', 'In person']}
              value={state.formatFilter}
              onChange={(f: FormatFilter) => dispatch({ type: 'setFilter', filter: f })}
              style={{ display: 'flex', width: '100%' }}
            />
          ) : null}

          {state.date && times.length ? (
            <div className="flex flex-col gap-2">
              <span className="text-[12.5px] text-[#64748B]">{dayLabel(state.date)} · West Africa Time</span>
              <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(104px,1fr))] min-[601px]:grid-cols-[repeat(auto-fill,minmax(132px,1fr))]">
                {times.map((slot) => {
                  const selected = slot.id === state.slotId;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => dispatch({ type: 'chooseSlot', slotId: slot.id })}
                      className="h-[52px] rounded-full border flex flex-col items-center justify-center cursor-pointer transition-colors duration-150"
                      style={{
                        background: selected ? 'var(--brand-primary)' : '#FFFFFF',
                        color: selected ? 'var(--brand-on-primary)' : '#0F172A',
                        borderColor: selected ? 'transparent' : '#CBD5E1',
                      }}
                    >
                      <span className="text-[14px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{timeLabelWAT(slot.startsAt)}</span>
                      <span className="text-[11px] font-semibold" style={{ opacity: 0.78 }}>{formatOf(slot.channel)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {chosen && formatOf(chosen.channel) === 'In person' && practiceAddress ? (
            <div className="rounded-[18px] px-4 py-3.5 flex gap-3" style={{ background: 'var(--brand-fill)' }}>
              <MapPin className="h-[18px] w-[18px] shrink-0 mt-0.5" style={{ color: BRAND_INK }} aria-hidden="true" />
              <div>
                <div className="text-[14px] font-bold text-[#0F172A]">In person at the practice</div>
                <div className="text-[13px] text-[#475569]">{practiceAddress}</div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
