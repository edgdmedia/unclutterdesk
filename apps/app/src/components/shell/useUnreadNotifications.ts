import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../utils/apiClient';

export interface NotificationItem {
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
 * NOT-06: the bell's data. The unread count and the latest items live here so
 * every surface (practice header, portal header) shows the same thing. The
 * SSE stream pushes updates; where EventSource is unavailable the count is
 * polled instead, and a failed stream falls back to polling too.
 */
export function useUnreadNotifications() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, unread] = await Promise.all([
        api.get<{ items: NotificationItem[] }>('/v1/notifications?pageSize=8'),
        api.get<number>('/v1/notifications/unread-count'),
      ]);
      setItems(list.items ?? []);
      setCount(typeof unread === 'number' ? unread : 0);
    } catch {
      // Signed out or offline: the bell simply shows nothing new.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(() => {
        void api.get<number>('/v1/notifications/unread-count')
          .then((n) => setCount(typeof n === 'number' ? n : 0))
          .catch(() => undefined);
      }, 30_000);
    };
    if (typeof EventSource !== 'function') {
      startPolling();
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
    const src = new EventSource(`${api.baseUrl}/v1/notifications/stream`, { withCredentials: true });
    src.addEventListener('unread', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setCount(data.total ?? 0);
        if (Array.isArray(data.items)) setItems(data.items.slice(0, 8));
      } catch {
        // A malformed event must not break the bell.
      }
    });
    src.onerror = () => startPolling();
    return () => {
      src.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status: 'read' } : x)));
    setCount((n) => Math.max(0, n - 1));
    await api.patch(`/v1/notifications/${id}/read`, {}).catch(() => undefined);
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((xs) => xs.map((x) => ({ ...x, status: 'read' })));
    setCount(0);
    await api.post('/v1/notifications/read-all', {}).catch(() => undefined);
  }, []);

  return { count, items, refresh, markRead, markAllRead };
}
