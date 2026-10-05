import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useFocusTrap } from '@unclutterdesk/ui';
import { useUnreadNotifications, type NotificationItem } from './useUnreadNotifications';

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * NOT-06: the bell in the app frame's header. The dropdown lists the latest
 * eight; in-app links navigate (and mark read), external ones open a new tab;
 * "All notifications" leads to the full page.
 */
export function NotificationBell({ allHref }: { allHref: string }) {
  const { count, items, markRead, markAllRead } = useUnreadNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useFocusTrap(ref, open);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  async function choose(item: NotificationItem) {
    if (item.status === 'unread') await markRead(item.id);
    setOpen(false);
    if (!item.link) return;
    if (/^https?:\/\//.test(item.link)) window.open(item.link, '_blank', 'noopener');
    else navigate(item.link);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        className="relative h-10 w-10 rounded-[12px] border border-[#E2E8F0] bg-white grid place-items-center cursor-pointer hover:bg-[#F8FAFC]"
      >
        <Bell className="h-[18px] w-[18px] text-[#475569]" aria-hidden="true" />
        {count > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E11D48] text-white text-[10px] font-bold grid place-items-center">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div role="menu" aria-label="Notifications" className="absolute right-0 top-full mt-2 w-[340px] max-w-[90vw] rounded-[16px] border border-[#E2E8F0] bg-white shadow-xl overflow-hidden z-50">
          <ul className="max-h-[340px] overflow-auto m-0 p-0 list-none">
            {items.length === 0 ? <li className="px-4 py-6 text-center text-[13px] text-[#64748B]">Nothing new yet.</li> : null}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void choose(n)}
                  className="w-full text-left px-4 py-3 hover:bg-[#F8FAFC] cursor-pointer flex gap-2.5 border-b border-[#F1F5F9] last:border-b-0"
                >
                  <span aria-hidden="true" className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.status === 'unread' ? 'bg-[#0F3A53]' : 'bg-transparent'}`} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-[#0F172A] truncate">{n.title}</span>
                    <span className="block text-[12.5px] text-[#64748B] truncate">{n.message}</span>
                    <span className="block text-[11px] text-[#94A3B8] mt-0.5">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <button type="button" onClick={() => void markAllRead()} className="text-[12.5px] font-bold text-[#0F3A53] cursor-pointer">Mark all read</button>
            <Link to={allHref} onClick={() => setOpen(false)} className="text-[12.5px] font-bold text-[#0F3A53] underline">All notifications</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
