import { useEffect } from 'react';
import { api } from '../../utils/apiClient';

const EVERY_MS = 60_000;

/**
 * VID-01: while someone is in the room, tell the server once a minute so their
 * minutes are counted to the last sign of life, never to "now". One more beat
 * goes out when the tab is hidden, since it may not come back.
 */
export function useHeartbeat(participantId: string | null | undefined) {
  useEffect(() => {
    if (!participantId) return;
    const beat = () => {
      void api.post(`/v1/video/participants/${participantId}/heartbeat`, {}).catch(() => undefined);
    };
    const timer = window.setInterval(beat, EVERY_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') beat();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [participantId]);
}
