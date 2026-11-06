import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Settings, X, Calendar, Clock, User, Trash2, CheckCircle2, CalendarPlus } from 'lucide-react';
import { Page, PageHeader, useBrand, useToast } from '@unclutterdesk/ui';
import { StaffBookingDialog } from '../../components/booking/StaffBookingDialog';
import { api } from '../../utils/apiClient';

/** YYYY-MM-DD in the viewer's own time zone (toISOString would use UTC and can be a day off). */
function localDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
import { PaymentChip } from '../../components/booking/PaymentChip';
import { formatClock } from '../../utils/displayFormat';
import { serviceColour, servicesInView, visibleDays, visibleHours, type WeeklyTimeLite } from './scheduleView';

interface Client {
  id: string;
  name: string;
  email: string;
  care: string;
  initials: string;
}

interface CalendarEvent {
  id: string;
  clientId?: string;
  title: string;
  type: string;
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  category: 'individual' | 'couples' | 'admin';
  status?: string;
  clientEmail?: string;
  paymentMethod?: string;
  holdExpiresAt?: string | null;
  bookedBy?: string | null;
  bookingStatus?: string;
}

interface SchedulePageProps {
  sessions: CalendarEvent[];
  setSessions: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  clients: Client[];
  tenantSlug?: string;
  /** Re-fetches from the API after a mutation, so the view reflects what was saved. */
  onRefresh?: () => Promise<unknown>;
}

export function SchedulePage({ sessions, setSessions, clients, onRefresh }: SchedulePageProps) {
  const toast = useToast();
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';

  const [saving, setSaving] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'day' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const navigate = useNavigate();

  // Modals state
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [sessionCompleteEvent, setSessionCompleteEvent] = useState<CalendarEvent | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(() => localDateInput(new Date()));
  const [formTime, setFormTime] = useState('09:00');
  const [formDuration, setFormDuration] = useState(50);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [askingReview, setAskingReview] = useState(false);

  // The hours and days shown come from your weekly availability and the sessions in view.
  const [weekly, setWeekly] = useState<{ weeklyTimes: WeeklyTimeLite[]; sessionLengthMinutes: number }>({ weeklyTimes: [], sessionLengthMinutes: 50 });
  useEffect(() => {
    let live = true;
    api
      .get<{ weeklyTimes?: WeeklyTimeLite[]; sessionLengthMinutes?: number }>('/v1/consult/therapist/availability')
      .then((p) => live && setWeekly({ weeklyTimes: p.weeklyTimes ?? [], sessionLengthMinutes: p.sessionLengthMinutes ?? 50 }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  // Days the therapist is away. They show as grey blocks and close to booking.
  const [timeOff, setTimeOff] = useState<Array<{ id: string; startsOn: string; endsOn: string; note: string | null }>>([]);
  useEffect(() => {
    let live = true;
    api
      .get<{ timeOff?: Array<{ id: string; startsOn: string; endsOn: string; note: string | null }> }>('/v1/consult/therapist/time-off')
      .then((r) => live && setTimeOff(r.timeOff ?? []))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  /** The time-off period covering this date, if any. */
  const awayOn = (day: Date) => {
    const key = localDateInput(day);
    return timeOff.find((t) => key >= t.startsOn && key <= t.endsOn) ?? null;
  };

  // Helper: Get Monday of the week
  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  // Helper: Navigate date
  const handleNavigate = (direction: 'back' | 'forward') => {
    const offset = direction === 'back' ? -1 : 1;
    const newDate = new Date(currentDate);

    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + offset);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + offset * 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + offset);
    }
    setCurrentDate(newDate);
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  // Generate current view dates
  const weekStart = getStartOfWeek(currentDate);
  const weekDays = visibleDays(weekStart, sessions, weekly.weeklyTimes);

  const monthGridDays = (() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const dayOfWeek = start.getDay();
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // start from Monday
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - offset);
    return Array.from({ length: 35 }, (_, idx) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + idx);
      return d;
    });
  })();

  const activeDays = viewMode === 'day' ? [currentDate] : weekDays;
  const { startHour, endHour } = visibleHours(
    sessions.filter((s) => activeDays.some((d) => isSameDay(new Date(s.startsAt), d))),
    weekly.weeklyTimes,
    weekly.sessionLengthMinutes,
  );
  const hourRows = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const hourLabel = (h: number) => formatClock(new Date(2000, 0, 1, h, 0)).replace(':00', '');
  const services = servicesInView(sessions.filter((s) => s.category !== 'admin'));

  // Header string formatting
  const getHeaderTitle = () => {
    const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      const start = weekDays[0];
      const end = weekDays[weekDays.length - 1];
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} — ${end.getDate()} ${start.toLocaleDateString('en-US', options)}`;
      } else {
        return `${start.getDate()} ${start.toLocaleDateString('en-US', { month: 'short' })} — ${end.getDate()} ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
      }
    } else {
      return currentDate.toLocaleDateString('en-US', options);
    }
  };

  // Handle cell click
  const handleCellClick = (date: Date, hour: number) => {
    if (awayOn(date)) {
      toast.info('You are away that day. Remove the time off to add hours.');
      return;
    }
    setFormDate(localDateInput(date));
    setFormTime(`${hour.toString().padStart(2, '0')}:00`);
    setFormDuration(weekly.sessionLengthMinutes);
    setScheduleError(null);
    setShowNewSessionModal(true);
  };

  // Opens a bookable slot. This previously only pushed onto local React state,
  // so the slot vanished on refresh and a practitioner could believe their
  // calendar was open when the booking page showed nothing.
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const [hours, minutes] = formTime.split(':').map(Number);
    const start = new Date(formDate);
    start.setHours(hours, minutes, 0, 0);

    const end = new Date(start);
    end.setMinutes(start.getMinutes() + formDuration);

    setSaving(true);
    setScheduleError(null);
    try {
      await api.post('/v1/consult/therapist/availability', {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      });
      await onRefresh?.();
      setShowNewSessionModal(false);
      toast.success('Time slot added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the time slot');
      setScheduleError(err instanceof Error ? err.message : 'Could not save that slot');
    } finally {
      setSaving(false);
    }
  };

  // Same problem in reverse: deleting only filtered local state, so the slot
  // came back on refresh.
  const handleDeleteSession = async (id: string) => {
    setSaving(true);
    setScheduleError(null);
    try {
      await api.delete(`/v1/consult/therapist/availability/${id}`);
      await onRefresh?.();
      setShowDetailModal(false);
      toast.success('Time slot removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove the time slot');
      setScheduleError(err instanceof Error ? err.message : 'Could not remove that slot');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!selectedEvent) return;
    setUpdatingStatusId(selectedEvent.id);
    try {
      await api.patch(`/v1/consult/therapist/bookings/${selectedEvent.id}/status`, { status: 'COMPLETED' });
      setSessions((current) => current.map((session) => (session.id === selectedEvent.id ? { ...session, status: 'COMPLETED' } : session)));
      setSelectedEvent((current) => (current ? { ...current, status: 'COMPLETED' } : current));
      setSessionCompleteEvent(selectedEvent);
      toast.success('Session marked complete');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Never automatic: the practitioner chooses, per completed session, once.
  const handleAskForReview = async () => {
    if (!selectedEvent) return;
    setAskingReview(true);
    try {
      await api.post(`/v1/consult/practice/sessions/${selectedEvent.id}/review-request`, {});
      toast.success(`Review request emailed to ${selectedEvent.title}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the review request');
    } finally {
      setAskingReview(false);
    }
  };


  return (
    <Page
      header={
        <PageHeader
          eyebrow="PRACTICE CALENDAR"
          title="Schedule"
          actions={
            <>
              {/* Segmented Control */}
              <div className="h-[40px] p-1 bg-[var(--desk-surface-muted)] border border-[var(--desk-border)] rounded-[14px] flex gap-1">
                {(['week', 'day', 'month'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setViewMode(m)}
                    className={`px-4 rounded-[10px] text-xs font-bold capitalize transition-all cursor-pointer ${
                      viewMode === m ? 'bg-white text-[var(--desk-text)] shadow-xs' : 'text-[var(--desk-text-muted)]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <button
                onClick={() => navigate('/dashboard/settings/availability')}
                className="hidden sm:flex h-[40px] px-4 rounded-[14px] bg-white border border-[var(--desk-pine-200)] text-[var(--desk-text)] text-xs font-bold hover:bg-[var(--desk-surface)] items-center gap-1.5 cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Set availability</span>
              </button>

              <button
                onClick={() => {
                  setFormDate(localDateInput(currentDate));
                  setFormTime(`${String(startHour).padStart(2, '0')}:00`);
                  setFormDuration(weekly.sessionLengthMinutes);
                  setScheduleError(null);
                  setShowNewSessionModal(true);
                }}
                className="os-brand-btn h-[40px] px-3 md:px-4 rounded-[14px] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add open time</span>
                <span className="sm:hidden">Open time</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBooking(true)}
                className="flex h-[40px] px-3 md:px-4 rounded-[14px] bg-[var(--desk-pine-600)] text-white text-xs font-bold items-center gap-1.5 cursor-pointer"
              >
                <CalendarPlus className="h-4 w-4" />
                <span className="hidden sm:inline">New booking</span>
                <span className="sm:hidden">Book</span>
              </button>
            </>
          }
        />
      }
    >
      {/* Main Workspace */}
      <div className="p-0 space-y-4 flex-1 flex flex-col">
        {/* Title Bar & Legend */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 justify-between md:justify-start">
            <h2 className="text-[15px] font-bold text-[var(--desk-text)]">{getHeaderTitle()}</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleNavigate('back')}
                className="h-8 w-8 rounded-[9px] bg-white border border-[var(--desk-border)] flex items-center justify-center text-[var(--desk-text-muted)] hover:bg-[var(--desk-surface)] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleNavigate('forward')}
                className="h-8 w-8 rounded-[9px] bg-white border border-[var(--desk-border)] flex items-center justify-center text-[var(--desk-text-muted)] hover:bg-[var(--desk-surface)] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {services.length ? (
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[var(--desk-text-muted)] font-semibold" aria-label="Services">
              {services.map((title) => (
                <li key={title} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[4px]" style={{ backgroundColor: serviceColour(title, primaryColor) }} aria-hidden />
                  {title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* View Mode Rendering */}
        {viewMode !== 'month' ? (
          /* Week & Day Grid View */
          <div className="os-card overflow-x-auto flex-1 border border-[var(--desk-border)] w-full bg-white">
          <div className="grid min-w-[600px] md:min-w-[800px]" style={{ gridTemplateColumns: `64px repeat(${activeDays.length}, 1fr)` }}>
            {/* Hour Gutter */}
            <div className="bg-[var(--desk-surface-alt)] border-r border-[var(--desk-border)]">
              <div className="h-[58px] border-b border-[var(--desk-border)]" />
              {hourRows.map((h) => (
                <div key={h} data-hour={h} className="h-[62px] pr-3 text-right text-[10.5px] font-semibold text-[var(--desk-text-subtle)] -translate-y-1.5">
                  {hourLabel(h)}
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {activeDays.map((day, dayIdx) => {
              const dayEvents = sessions.filter((s) => isSameDay(new Date(s.startsAt), day));
              const away = awayOn(day);

              return (
                <div key={dayIdx} className="border-r border-[var(--desk-border)] last:border-r-0 relative flex flex-col">
                  {/* Day Header */}
                  <div className="h-[58px] border-b border-[var(--desk-border)] p-3 text-center bg-white shrink-0">
                    <span className="text-[9px] font-black text-[var(--desk-text-subtle)] tracking-[0.18em] block">
                      {day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                    </span>
                    <span className="text-[15px] font-bold text-[var(--desk-text)] leading-none">{day.getDate()}</span>
                    {away ? (
                      <span className="mt-0.5 inline-block rounded-full bg-slate-200 px-1.5 text-[8.5px] font-black uppercase tracking-[0.08em] text-slate-600">
                        Away
                      </span>
                    ) : null}
                  </div>

                  {/* Grid Canvas with Interactive Hourly Rows */}
                  <div className="flex-1 relative bg-white" style={{ minHeight: `${hourRows.length * 62}px` }}>
                    {/* Clickable cells background overlay */}
                    <div className="absolute inset-0 grid" style={{ gridTemplateRows: `repeat(${hourRows.length}, 1fr)` }}>
                      {hourRows.map((hour) => (
                        <div
                          key={hour}
                          onClick={() => handleCellClick(day, hour)}
                          className="border-b border-slate-100 hover:bg-slate-50/50 cursor-crosshair transition-all"
                        />
                      ))}
                    </div>

                    {/* Time off: a grey block over the whole day */}
                    {away ? (
                      <div
                        className="absolute inset-0 z-20 bg-slate-200/60 pointer-events-none flex items-start justify-center pt-2"
                        aria-label={away.note ? `Away: ${away.note}` : 'Away'}
                      >
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm">
                          {away.note ?? 'Away'}
                        </span>
                      </div>
                    ) : null}

                    {/* Scheduled Events overlay */}
                    {dayEvents.map((ev) => {
                      const startDate = new Date(ev.startsAt);
                      const endDate = new Date(ev.endsAt);
                      const startMin = (startDate.getHours() - startHour) * 60 + startDate.getMinutes();
                      const duration = (endDate.getTime() - startDate.getTime()) / 60000;

                      const top = (startMin / 60) * 62;
                      const height = (duration / 60) * 62 - 4;

                      const borderColor = serviceColour(ev.type, primaryColor);
                      const bgColor = `${borderColor}14`;

                      return (
                        <div
                          key={ev.id}
                          onClick={() => {
                            setSelectedEvent(ev);
                            setShowDetailModal(true);
                          }}
                          className="absolute inset-x-1.5 rounded-[12px] p-2 border overflow-hidden hover:brightness-95 cursor-pointer transition-all z-10"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            backgroundColor: bgColor,
                            borderColor: `${borderColor}55`,
                            borderLeftWidth: '3px',
                            borderLeftColor: borderColor,
                          }}
                        >
                          <h4 className="text-[12px] font-bold text-[var(--desk-text)] truncate leading-tight">{ev.title}</h4>
                          <p className="text-[10px] font-medium text-[var(--desk-text-muted)] truncate">
                            {ev.type} · {duration}m
                          </p>
                          <div className="mt-0.5">
                            {ev.bookingStatus ? <PaymentChip status={ev.bookingStatus} paymentMethod={ev.paymentMethod} holdExpiresAt={ev.holdExpiresAt} /> : null}
                            {ev.bookedBy ? <span className="text-[10px] text-[var(--desk-text-muted)] block truncate">Booked by {ev.bookedBy}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        ) : (
          /* Month View Grid */
          <div className="os-card overflow-hidden flex-1 border border-[var(--desk-border)] flex flex-col bg-white">
            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b border-[var(--desk-border)] bg-slate-50 shrink-0 text-center py-2">
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
                <span key={d} className="text-[9px] font-black text-[var(--desk-text-subtle)] tracking-[0.12em]">
                  {d}
                </span>
              ))}
            </div>

            {/* Grid days */}
            <div className="grid grid-cols-7 grid-rows-5 flex-1 min-h-[500px]">
              {monthGridDays.map((day, idx) => {
                const dayEvents = sessions.filter((s) => isSameDay(new Date(s.startsAt), day));
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const away = awayOn(day);

                return (
                  <div
                    key={idx}
                    onClick={() => handleCellClick(day, 9)}
                    className={`border-r border-b border-slate-100 p-2 flex flex-col gap-1 cursor-pointer transition-all min-h-[100px] ${
                      away
                        ? 'bg-slate-200/60'
                        : isCurrentMonth
                          ? 'bg-white'
                          : 'bg-slate-50/50'
                    } hover:bg-slate-50`}
                  >
                    <span
                      className={`text-xs font-bold self-end ${
                        isCurrentMonth ? 'text-slate-700' : 'text-slate-400'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {away ? (
                      <span className="self-start rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shadow-sm">
                        {away.note ?? 'Away'}
                      </span>
                    ) : null}

                    {/* Month events list */}
                    <div className="space-y-1 overflow-y-auto flex-1 max-h-[80px]">
                      {dayEvents.map((ev) => {
                        const borderColor = serviceColour(ev.type, primaryColor);
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(ev);
                              setShowDetailModal(true);
                            }}
                            className="text-[10px] font-bold p-1 rounded-md border-l-2 truncate"
                            style={{
                              backgroundColor: `${borderColor}10`,
                              borderColor: borderColor,
                              color: '#0F172A',
                            }}
                          >
                            {ev.title}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* New Session Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in">
          <form
            onSubmit={handleCreateSession}
            className="w-full max-w-[460px] bg-white rounded-[24px] p-6 shadow-2xl space-y-4 border border-slate-200 relative"
          >
            {scheduleError ? (
              <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                {scheduleError}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setShowNewSessionModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" style={{ color: primaryColor }} />
                <h3 className="text-lg font-bold text-[var(--desk-text)]">Add open time</h3>
              </div>
              <p className="mt-1 text-[12px] text-[var(--desk-text-muted)]">A time clients can book from your booking page. To book a client in yourself, use New booking.</p>
            </div>

            {/* Date & Time fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-[12px] bg-[var(--desk-surface)] border border-[var(--desk-border)] text-xs font-semibold outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Start Time</label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full h-11 px-3 rounded-[12px] bg-[var(--desk-surface)] border border-[var(--desk-border)] text-xs font-semibold outline-none"
                />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1">
              <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Duration</label>
              <select
                value={formDuration}
                onChange={(e) => setFormDuration(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-[12px] bg-[var(--desk-surface)] border border-[var(--desk-border)] text-xs font-semibold outline-none"
              >
                <option value={30}>30 minutes</option>
                <option value={50}>50 minutes (Standard)</option>
                <option value={60}>60 minutes</option>
                <option value={80}>80 minutes</option>
              </select>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowNewSessionModal(false)}
                className="flex-1 h-11 rounded-[14px] bg-[var(--desk-surface-muted)] text-[var(--desk-text-body)] font-bold text-xs hover:bg-[var(--desk-border)] cursor-pointer"
              >
                Cancel
              </button>
              <button
              type="submit"
              disabled={saving}
                className="flex-1 h-11 rounded-[14px] text-white font-bold text-xs hover:brightness-95 cursor-pointer flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                {saving ? 'Adding…' : 'Add open time'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Session Details Modal */}
      {showDetailModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="w-full max-w-[420px] bg-white rounded-[24px] p-6 shadow-2xl space-y-5 border border-slate-200 relative">
            <button
              onClick={() => setShowDetailModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <span
                className="text-[9px] font-black uppercase tracking-[0.12em] px-2.5 py-1 rounded-full border"
                style={{
                  backgroundColor: `${serviceColour(selectedEvent.type, primaryColor)}14`,
                  borderColor: `${serviceColour(selectedEvent.type, primaryColor)}40`,
                  color: serviceColour(selectedEvent.type, primaryColor),
                }}
              >
                {selectedEvent.type}
              </span>
              <h3 className="text-xl font-extrabold text-[var(--desk-text)] pt-1">{selectedEvent.title}</h3>
            </div>

            <div className="space-y-3.5 border-y border-slate-100 py-4 text-xs font-semibold text-[var(--desk-text-body)]">
              <div className="flex items-center gap-2.5">
                <Calendar className="h-4 w-4 text-[var(--desk-text-subtle)]" />
                <span>
                  {new Date(selectedEvent.startsAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-[var(--desk-text-subtle)]" />
                <span>
                  {formatClock(selectedEvent.startsAt)} — {formatClock(selectedEvent.endsAt)}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <User className="h-4 w-4 text-[var(--desk-text-subtle)]" />
                <span>Status: {selectedEvent.status || 'CONFIRMED'}</span>
                {selectedEvent.bookingStatus ? <PaymentChip status={selectedEvent.bookingStatus} paymentMethod={selectedEvent.paymentMethod} holdExpiresAt={selectedEvent.holdExpiresAt} /> : null}
              </div>
              {selectedEvent.bookedBy ? (
                <div className="flex items-center gap-2.5">
                  <span className="h-4 w-4 inline-flex items-center justify-center text-[var(--desk-text-subtle)] text-[13px] font-bold">·</span>
                  <span className="text-[11px] text-[var(--desk-text-muted)]">Booked by {selectedEvent.bookedBy}</span>
                </div>
              ) : null}
            </div>

            <div className="rounded-[16px] border border-[var(--desk-border)] bg-[var(--desk-surface)] px-4 py-3 text-xs font-medium text-[var(--desk-text-body)]">
              {selectedEvent.status === 'COMPLETED'
                ? 'This session is completed. If it feels right, you can email the client a link to leave a review. Each session is asked once.'
                : 'Once the session is completed, you can ask the client for a review. Nothing is sent unless you ask.'}
            </div>

            {/* Actions */}
            {scheduleError ? (
              <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                {scheduleError}
              </div>
            ) : null}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                disabled={saving}
                onClick={() => handleDeleteSession(selectedEvent.id)}
                className="flex-1 h-11 rounded-[14px] bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs hover:bg-rose-100 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                <span>Cancel Session</span>
              </button>
              <button
                onClick={() => navigate(`/dashboard/sessions/${selectedEvent.id}`)}
                className="flex-1 h-11 rounded-[14px] bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
              >
                Open session
              </button>
              {selectedEvent.status !== 'COMPLETED' ? (
                <button
                  onClick={() => void handleMarkCompleted()}
                  disabled={updatingStatusId === selectedEvent.id}
                  className="w-full h-11 rounded-[14px] text-white font-bold text-xs hover:brightness-95 cursor-pointer disabled:opacity-60"
                  style={{ backgroundColor: primaryColor }}
                >
                  {updatingStatusId === selectedEvent.id ? 'Updating status...' : 'Mark Session Completed'}
                </button>
              ) : (
                <button
                  onClick={() => void handleAskForReview()}
                  disabled={askingReview}
                  className="w-full h-11 rounded-[14px] text-white font-bold text-xs hover:brightness-95 cursor-pointer disabled:opacity-60"
                  style={{ backgroundColor: primaryColor }}
                >
                  {askingReview ? 'Sending...' : 'Ask for a review'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Session Complete / SOAP Note Prompt Modal */}
      {sessionCompleteEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="w-full max-w-[420px] bg-white rounded-[24px] p-8 shadow-2xl space-y-6 border border-slate-200">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-[20px] font-bold text-[var(--desk-text)] leading-tight">
                Session marked complete
              </h3>
              <p className="text-[14px] font-medium text-slate-500 max-w-[280px]">
                No clinical note recorded yet for this session. Write a SOAP note for <strong className="text-[var(--desk-text)]">{sessionCompleteEvent.title}</strong>?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setSessionCompleteEvent(null)}
                className="h-11 rounded-[14px] bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-colors"
              >
                Remind me later
              </button>
              <button
                onClick={() => {
                  navigate(`/dashboard/sessions/${sessionCompleteEvent.id}#note`);
                  setSessionCompleteEvent(null);
                }}
                className="h-11 rounded-[14px] text-white font-bold text-xs shadow-sm hover:brightness-110 transition-all cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                Write SOAP note
              </button>
            </div>
          </div>
        </div>
      )}
      {showBooking && (
        <StaffBookingDialog
          client={null}
          onClose={() => setShowBooking(false)}
          onBooked={async () => { setShowBooking(false); await onRefresh?.(); }}
        />
      )}
    </Page>
  );
}
