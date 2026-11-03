import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';

/**
 * The frame's own header items (the notification bell) are shown inside the
 * page's header, so a page has one header, not two. AppShell provides them;
 * the PageHeader on screen renders them at the right of its title row and
 * registers itself, so the frame drops its fallback bar. Pages without a
 * PageHeader still get the bar.
 */
interface HeaderSlot {
  items: ReactNode;
  claim: () => () => void;
}

export const HeaderSlotContext = createContext<HeaderSlot | null>(null);

/** For PageHeader: the frame's items, claimed while this header is mounted. */
export function useHeaderSlot(): ReactNode {
  const slot = useContext(HeaderSlotContext);
  const claim = slot?.claim;
  useLayoutEffect(() => (claim ? claim() : undefined), [claim]);
  return slot?.items ?? null;
}
