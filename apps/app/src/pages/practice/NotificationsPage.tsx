import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, CheckCircle2, CreditCard, FileText, Loader2 } from 'lucide-react';
import { Eyebrow, Card } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';

/**
 * The practice's real notification feed.
 *
 * This page used to render three hardcoded rows — a named client, a PHQ-9 score
 * of 14, and a ₦450,000 settlement — inside whichever practice was signed in.
 * Fabricated clinical and financial activity attributed to a named person is
 * not a placeholder; a therapist could act on it. The API behind it already
 * existed (`GET /v1/notifications`), so the page now reads it.
 */
interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  actionLabel: string | null;
  status: string;
  createdAt: string;
}

/**
 * The icon is chosen from the event's module — the segment before the "." in
 * types like "consult.booking_confirmed" — so a new event type still gets a
 * sensible icon rather than none.
 */
function iconFor(type: string): { Icon: typeof Bell; cls: string } {
  const module = type.split('.')[0];
  if (module === 'consult') return { Icon: Calendar, cls: 'text-blue-600 bg-blue-50' };
  if (module === 'intake' || module === 'notes') return { Icon: FileText, cls: 'text-amber-600 bg-amber-50' };
  if (module === 'billing' || module === 'payout') return { Icon: CreditCard, cls: 'text-emerald-600 bg-emerald-50' };
  return { Icon: Bell, cls: 'text-slate-600 bg-slate-100' };
}

function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ items: Notification[] }>('/v1/notifications?pageSize=50');
      setItems(res.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your notifications');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function open(notification: Notification) {
    // Mark read optimistically: the badge should clear the moment it is opened,
    // and a failed mark is not worth blocking navigation for.
    if (notification.status === 'unread') {
      setItems((current) =>
        (current ?? []).map((n) => (n.id === notification.id ? { ...n, status: 'read' } : n)),
      );
      api.patch(`/v1/notifications/${notification.id}/read`, {}).catch(() => undefined);
    }
    if (notification.link) navigate(notification.link);
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await api.post('/v1/notifications/read-all', {});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark them all read');
    } finally {
      setMarkingAll(false);
    }
  }

  const unread = (items ?? []).filter((n) => n.status === 'unread').length;

  return (
    <div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">
      <header className="h-[80px] bg-white border-b border-[#E2E8F0] px-[26px] flex items-center justify-between gap-5 shrink-0">
        <div>
          <Eyebrow>PRACTICE ACTIVITY</Eyebrow>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">
            Notifications &amp; Alerts
          </h1>
        </div>
        {unread > 0 ? (
          <button
            type="button"
            onClick={markAllRead}
            disabled={markingAll}
            className="h-[38px] px-4 rounded-[12px] border border-[#E2E8F0] bg-white text-[13px] font-bold text-[#475569] hover:bg-[#F8FAFC] cursor-pointer disabled:opacity-60"
          >
            {markingAll ? 'Marking…' : `Mark all read (${unread})`}
          </button>
        ) : null}
      </header>

      <main className="p-[24px_26px_30px] space-y-4 flex-1">
        {error ? (
          <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        <Card padding="p-0" className="overflow-hidden border border-[#E2E8F0]">
          {items === null && !error ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#94A3B8]" aria-label="Loading notifications" />
            </div>
          ) : (items ?? []).length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto h-12 w-12 rounded-[16px] bg-[#F1F5F9] text-[#94A3B8] flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-[#0F172A]">You are all caught up</p>
              <p className="mt-1 text-xs font-medium text-[#64748B]">
                Bookings, intake submissions and settlements will appear here as they happen.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {(items ?? []).map((notification) => {
                const { Icon, cls } = iconFor(notification.type);
                const unopened = notification.status === 'unread';
                return (
                  <div
                    key={notification.id}
                    role={notification.link ? 'button' : undefined}
                    tabIndex={notification.link ? 0 : undefined}
                    onClick={() => open(notification)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void open(notification);
                      }
                    }}
                    className={`p-4 flex items-start gap-4 hover:bg-[#FCFDFE] ${
                      notification.link ? 'cursor-pointer' : ''
                    } ${unopened ? 'bg-[#F8FBFF]' : ''}`}
                  >
                    <div className={`h-10 w-10 rounded-[12px] flex items-center justify-center shrink-0 ${cls}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h4 className="text-sm font-bold text-[#0F172A]">{notification.title}</h4>
                        <span className="text-[11px] text-[#94A3B8] font-medium">
                          {timeAgo(notification.createdAt)}
                        </span>
                        {unopened ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#0F3A53]" aria-label="Unread" />
                        ) : null}
                      </div>
                      <p className="text-xs text-[#475569] font-medium">{notification.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
