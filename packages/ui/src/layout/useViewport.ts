import { useEffect, useState } from 'react';

export type Viewport = 'phone' | 'tablet' | 'desktop';

export const TABLET_QUERY = '(min-width: 768px)';
export const DESKTOP_QUERY = '(min-width: 1280px)';

function read(): Viewport {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop';
  if (window.matchMedia(DESKTOP_QUERY).matches) return 'desktop';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'phone';
}

/**
 * Which of the three layouts the screen is in. Only the shell uses this; inside
 * a page, layouts follow the page's own width through container queries.
 */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(read);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const lists = [window.matchMedia(TABLET_QUERY), window.matchMedia(DESKTOP_QUERY)];
    const update = () => setViewport(read());
    lists.forEach((l) => l.addEventListener('change', update));
    update();
    return () => lists.forEach((l) => l.removeEventListener('change', update));
  }, []);
  return viewport;
}
