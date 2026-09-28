import type { ReactNode } from 'react';
import { PlainLink, type LinkLike } from './links';

export interface BottomNavItem {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
}

export interface BottomNavProps {
  items: BottomNavItem[];
  active?: string;
  onSelect?: (key: string) => void;
  LinkComponent?: LinkLike;
  /** Adds a "More" button, which opens the full menu. */
  onMore?: () => void;
  moreLabel?: string;
  className?: string;
}

const CELL = 'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 text-[10.5px] font-bold cursor-pointer';

/** The phone's bottom bar: a few main destinations, and "More" for the rest. */
export function BottomNav({ items, active, onSelect, LinkComponent = PlainLink, onMore, moreLabel = 'More', className = '' }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={`flex items-stretch h-[68px] px-2 pb-[env(safe-area-inset-bottom)] bg-white/90 backdrop-blur-md border-t border-[var(--desk-border)] ${className}`.trim()}
    >
      {items.map((item) => {
        const isActive = item.key === active;
        const tone = isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--desk-text-muted)]';
        const content = (
          <>
            <span className="flex [&_svg]:h-5 [&_svg]:w-5">{item.icon}</span>
            <span className="truncate max-w-full">{item.label}</span>
          </>
        );
        return item.href ? (
          <LinkComponent key={item.key} href={item.href} aria-current={isActive ? 'page' : undefined} className={`${CELL} ${tone}`}>
            {content}
          </LinkComponent>
        ) : (
          <button key={item.key} type="button" aria-current={isActive ? 'page' : undefined} onClick={() => onSelect?.(item.key)} className={`${CELL} ${tone}`}>
            {content}
          </button>
        );
      })}
      {onMore ? (
        <button type="button" aria-haspopup="dialog" onClick={onMore} className={`${CELL} text-[var(--desk-text-muted)]`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <span>{moreLabel}</span>
        </button>
      ) : null}
    </nav>
  );
}
