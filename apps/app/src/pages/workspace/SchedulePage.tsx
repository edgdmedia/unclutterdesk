import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Settings, X, Calendar, Clock, User, Trash2, CheckCircle2 } from 'lucide-react';
import { useBrand } from '@unclutterdesk/ui';
import { api, getBookingUrl, TENANT_SLUG } from '../../utils/apiClient';

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
}

interface SchedulePageProps {
  sessions: CalendarEvent[];
  setSessions: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  clients: Client[];
  tenantSlug?: string;
  /** Re-fetches from the API after a mutation, so the view reflects what was saved. */
  onRefresh?: () => Promise<unknown>;
}

export function SchedulePage({ sessions, setSessions, clients, tenantSlug, onRefresh }: SchedulePageProps) {
  const brand = useBrand();
  const primaryColor = brand.primaryColor || '#0F3A53';
  const secondaryColor = brand.secondaryColor || '#E3B341';

  const [saving, setSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'day' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date('2026-08-03T09:00:00'));
  const navigate = useNavigate();

  // Modals state
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [sessionCompleteEvent, setSessionCompleteEvent] = useState<CalendarEvent | null>(null);

  // Form state
  const [formClientName, setFormClientName] = useState('');
  const [formType, setFormType] = useState('Individual Therapy');
  const [formDate, setFormDate] = useState('2026-08-03');
  const [formTime, setFormTime] = useState('09:00');
  const [formDuration, setFormDuration] = useState(50);
  const [formVideoProvider, setFormVideoProvider] = useState('DEFAULT');
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [reviewLinkCopied, setReviewLinkCopied] = useState(false);

  const hours = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM'];

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

  // Helper: Format Date strings
  const getLocalDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
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
  const weekDays = Array.from({ length: 5 }, (_, idx) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + idx);
    return d;
  });

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

  // Header string formatting
  const getHeaderTitle = () => {
    const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      const start = weekDays[0];
      const end = weekDays[4];
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
    const formattedDate = date.toISOString().split('T')[0];
    const formattedTime = `${hour.toString().padStart(2, '0')}:00`;
    setFormDate(formattedDate);
    setFormTime(formattedTime);
    setFormClientName(clients[0]?.name || '');
    setFormType('Individual Therapy');
    setFormDuration(50);
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
    } catch (err) {
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
    } catch (err) {
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
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleCopyReviewLink = async () => {
    const effectiveSlug = tenantSlug || TENANT_SLUG;
    if (!effectiveSlug) return;
    const reviewUrl = `${getBookingUrl(effectiveSlug)}/review`;
    await navigator.clipboard.writeText(reviewUrl);
    setReviewLinkCopied(true);
    window.setTimeout(() => setReviewLinkCopied(false), 2000);
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#F8FAFC]">
      {/* Top Header Bar */}
      <header className="h-[80px] bg-white border-b border-[#E2E8F0] px-4 md:px-[26px] flex items-center justify-between gap-3 md:gap-5 shrink-0">
        <div>
          <span className="os-eyebrow block hidden md:block">PRACTICE CALENDAR</span>
          <h1 className="text-[16px] md:text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">Schedule</h1>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Segmented Control */}
          <div className="h-[40px] p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-[14px] flex gap-1">
            {(['week', 'day', 'month'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-4 rounded-[10px] text-xs font-bold capitalize transition-all cursor-pointer ${
                  viewMode === m ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate('/dashboard/settings/availability')}
            className="hidden sm:flex h-[40px] px-4 rounded-[14px] bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold hover:bg-[#F8FAFC] items-center gap-1.5 cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Set availability</span>
          </button>

          <button
            onClick={() => {
              setFormDate(currentDate.toISOString().split('T')[0]);
              setFormTime('09:00');
              setFormClientName(clients[0]?.name || '');
              setFormType('Individual Therapy');
              setFormDuration(50);
              setShowNewSessionModal(true);
            }}
            className="os-brand-btn h-[40px] px-3 md:px-4 rounded-[14px] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: primaryColor }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">+ New session</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="p-4 md:p-[24px_26px_30px] space-y-4 flex-1 flex flex-col">
        {/* Title Bar & Legend */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 justify-between md:justify-start">
            <h2 className="text-[15px] font-bold text-[#0F172A]">{getHeaderTitle()}</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleNavigate('back')}
                className="h-8 w-8 rounded-[9px] bg-white border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleNavigate('forward')}
                className="h-8 w-8 rounded-[9px] bg-white border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11.5px] text-[#64748B] font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[4px]" style={{ backgroundColor: primaryColor }} />
              Individual Therapy
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[4px]" style={{ backgroundColor: secondaryColor }} />
              Couples Therapy
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[4px] bg-[#CBD5E1]" />
              Admin Block
            </span>
          </div>
        </div>

        {/* View Mode Rendering */}
        {viewMode !== 'month' ? (
          /* Week & Day Grid View */
          <div className="os-card overflow-x-auto flex-1 border border-[#E2E8F0] w-full bg-white">
          <div className="grid min-w-[600px] md:min-w-[800px]" style={{ gridTemplateColumns: `64px repeat(${activeDays.length}, 1fr)` }}>
            {/* Hour Gutter */}
            <div className="bg-[#FCFDFE] border-r border-[#E2E8F0]">
              <div className="h-[58px] border-b border-[#E2E8F0]" />
              {hours.map((h, i) => (
                <div key={i} className="h-[62px] pr-3 text-right text-[10.5px] font-semibold text-[#94A3B8] -translate-y-1.5">
                  {h}
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {activeDays.map((day, dayIdx) => {
              const dayEvents = sessions.filter((s) => isSameDay(new Date(s.startsAt), day));

              return (
                <div key={dayIdx} className="border-r border-[#E2E8F0] last:border-r-0 relative flex flex-col">
                  {/* Day Header */}
                  <div className="h-[58px] border-b border-[#E2E8F0] p-3 text-center bg-white shrink-0">
                    <span className="text-[9px] font-black text-[#94A3B8] tracking-[0.18em] block">
                      {day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                    </span>
                    <span className="text-[15px] font-bold text-[#0F172A] leading-none">{day.getDate()}</span>
                  </div>

                  {/* Grid Canvas with Interactive Hourly Rows */}
                  <div className="flex-1 min-h-[620px] relative bg-white">
                    {/* Clickable cells background overlay */}
                    <div className="absolute inset-0 grid grid-rows-10">
                      {Array.from({ length: 10 }).map((_, hourIdx) => (
                        <div
                          key={hourIdx}
                          onClick={() => handleCellClick(day, hourIdx + 9)}
                          className="border-b border-slate-100 hover:bg-slate-50/50 cursor-crosshair transition-all"
                        />
                      ))}
                    </div>

                    {/* Scheduled Events overlay */}
                    {dayEvents.map((ev) => {
                      const startDate = new Date(ev.startsAt);
                      const endDate = new Date(ev.endsAt);
                      const startMin = (startDate.getHours() - 9) * 60 + startDate.getMinutes();
                      const duration = (endDate.getTime() - startDate.getTime()) / 60000;

                      const top = (startMin / 60) * 62;
                      const height = (duration / 60) * 62 - 4;

                      const bgColor =
                        ev.category === 'individual'
                          ? `${primaryColor}14`
                          : ev.category === 'couples'
                          ? `${secondaryColor}1F`
                          : '#F1F5F9';
                      const borderColor =
                        ev.category === 'individual'
                          ? primaryColor
                          : ev.category === 'couples'
                          ? secondaryColor
                          : '#CBD5E1';

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
                          <h4 className="text-[12px] font-bold text-[#0F172A] truncate leading-tight">{ev.title}</h4>
                          <p className="text-[10px] font-medium text-[#64748B] truncate">
                            {ev.type} · {duration}m
                          </p>
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
          <div className="os-card overflow-hidden flex-1 border border-[#E2E8F0] flex flex-col bg-white">
            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b border-[#E2E8F0] bg-slate-50 shrink-0 text-center py-2">
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
                <span key={d} className="text-[9px] font-black text-[#94A3B8] tracking-[0.12em]">
                  {d}
                </span>
              ))}
            </div>

            {/* Grid days */}
            <div className="grid grid-cols-7 grid-rows-5 flex-1 min-h-[500px]">
              {monthGridDays.map((day, idx) => {
                const dayEvents = sessions.filter((s) => isSameDay(new Date(s.startsAt), day));
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();

                return (
                  <div
                    key={idx}
                    onClick={() => handleCellClick(day, 9)}
                    className={`border-r border-b border-slate-100 p-2 flex flex-col gap-1 cursor-pointer transition-all min-h-[100px] ${
                      isCurrentMonth ? 'bg-white' : 'bg-slate-50/50'
                    } hover:bg-slate-50`}
                  >
                    <span
                      className={`text-xs font-bold self-end ${
                        isCurrentMonth ? 'text-slate-700' : 'text-slate-400'
                      }`}
                    >
                      {day.getDate()}
                    </span>

                    {/* Month events list */}
                    <div className="space-y-1 overflow-y-auto flex-1 max-h-[80px]">
                      {dayEvents.map((ev) => {
                        const borderColor =
                          ev.category === 'individual'
                            ? primaryColor
                            : ev.category === 'couples'
                            ? secondaryColor
                            : '#CBD5E1';
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
      </main>

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

            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <Calendar className="h-5 w-5" style={{ color: primaryColor }} />
              <h3 className="text-lg font-bold text-[#0F172A]">Schedule New Session</h3>
            </div>

            {/* Client Selection */}
            <div className="space-y-1">
              <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Client / Description</label>
              <select
                value={formClientName}
                onChange={(e) => setFormClientName(e.target.value)}
                className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                <option value="Clinical Supervision">Clinical Supervision (Admin Block)</option>
                <option value="Notes & Billing">Notes & Billing (Admin Block)</option>
              </select>
            </div>

            {/* Session Type */}
            <div className="space-y-1">
              <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Session Category</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
              >
                <option value="Individual Therapy">Individual Therapy</option>
                <option value="Couples Therapy">Couples Therapy</option>
                <option value="Admin Block">Admin Block / Busy Time</option>
              </select>
            </div>

            {/* Date & Time fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Start Time</label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
                />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1">
              <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Duration</label>
              <select
                value={formDuration}
                onChange={(e) => setFormDuration(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
              >
                <option value={30}>30 minutes</option>
                <option value={50}>50 minutes (Standard)</option>
                <option value={60}>60 minutes</option>
                <option value={80}>80 minutes</option>
              </select>
            </div>

            {/* Video Provider */}
            <div className="space-y-1">
              <label className="text-[11.5px] font-bold text-slate-500 block uppercase">Video Platform</label>
              <select
                value={formVideoProvider}
                onChange={(e) => setFormVideoProvider(e.target.value)}
                className="w-full h-11 px-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold outline-none"
              >
                <option value="DEFAULT">Use my Default Profile Setting</option>
                <option value="JITSI">Jitsi (Built-in)</option>
                <option value="GOOGLE_MEET">Google Meet</option>
              </select>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowNewSessionModal(false)}
                className="flex-1 h-11 rounded-[14px] bg-[#F1F5F9] text-[#475569] font-bold text-xs hover:bg-[#E2E8F0] cursor-pointer"
              >
                Cancel
              </button>
              <button
              type="submit"
              disabled={saving}
                className="flex-1 h-11 rounded-[14px] text-white font-bold text-xs hover:brightness-95 cursor-pointer flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                Schedule Session
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
                  backgroundColor:
                    selectedEvent.category === 'individual'
                      ? `${primaryColor}14`
                      : selectedEvent.category === 'couples'
                      ? `${secondaryColor}1F`
                      : '#F1F5F9',
                  borderColor:
                    selectedEvent.category === 'individual'
                      ? `${primaryColor}40`
                      : selectedEvent.category === 'couples'
                      ? `${secondaryColor}40`
                      : '#CBD5E1',
                  color:
                    selectedEvent.category === 'individual'
                      ? primaryColor
                      : selectedEvent.category === 'couples'
                      ? secondaryColor
                      : '#64748B',
                }}
              >
                {selectedEvent.type}
              </span>
              <h3 className="text-xl font-extrabold text-[#0F172A] pt-1">{selectedEvent.title}</h3>
            </div>

            <div className="space-y-3.5 border-y border-slate-100 py-4 text-xs font-semibold text-[#475569]">
              <div className="flex items-center gap-2.5">
                <Calendar className="h-4 w-4 text-[#94A3B8]" />
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
                <Clock className="h-4 w-4 text-[#94A3B8]" />
                <span>
                  {new Date(selectedEvent.startsAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  —{' '}
                  {new Date(selectedEvent.endsAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <User className="h-4 w-4 text-[#94A3B8]" />
                <span>Status: {selectedEvent.status || 'CONFIRMED'}</span>
              </div>
            </div>

            <div className="rounded-[16px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs font-medium text-[#475569]">
              {selectedEvent.status === 'COMPLETED'
                ? 'This session is completed. You can now send the review request link to the client.'
                : 'Once the session is completed, you can immediately copy the public review link for the client.'}
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
                onClick={() => setShowDetailModal(false)}
                className="flex-1 h-11 rounded-[14px] bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
              >
                Close Details
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
                  onClick={() => void handleCopyReviewLink()}
                  className="w-full h-11 rounded-[14px] text-white font-bold text-xs hover:brightness-95 cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  {reviewLinkCopied ? 'Review link copied' : 'Copy Review Link'}
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
              <h3 className="text-[20px] font-bold text-[#0F172A] leading-tight">
                Session marked complete
              </h3>
              <p className="text-[14px] font-medium text-slate-500 max-w-[280px]">
                No clinical note recorded yet for this session. Write a SOAP note for <strong className="text-[#0F172A]">{sessionCompleteEvent.title}</strong>?
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
                  if (sessionCompleteEvent.clientId) {
                    navigate(`/dashboard/clients/${sessionCompleteEvent.clientId}?tab=notes&booking=${sessionCompleteEvent.id}`);
                  }
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
    </div>
  );
}
