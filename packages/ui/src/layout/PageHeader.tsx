import { useState, type ReactNode } from 'react';
import { Eyebrow } from '../components/Eyebrow';

export interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  /** Shown before the title, e.g. a link back to the list. */
  breadcrumb?: ReactNode;
  /** The main actions; always visible, wrapping under the title when there is no room. */
  actions?: ReactNode;
  /** Shown inline on wide pages, and in a "More actions" menu on narrow ones. */
  secondaryActions?: ReactNode;
}

export function PageHeader({ title, eyebrow, breadcrumb, actions, secondaryActions }: PageHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="bg-[var(--desk-card)] border-b border-[var(--desk-border)] print:hidden">
      <div className="min-h-[70px] px-4 md:px-6 xl:px-[26px] py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-0 flex-1 basis-[240px]">
          {eyebrow ? <Eyebrow className="block">{eyebrow}</Eyebrow> : null}
          <div className="flex items-center gap-2 min-w-0">
            {breadcrumb ? (
              <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm shrink-0">
                {breadcrumb}
              </nav>
            ) : null}
            <h1 className="min-w-0 truncate text-[17px] md:text-[20px] font-bold tracking-[-0.02em] text-[var(--desk-text)]">
              {title}
            </h1>
          </div>
        </div>
        {actions || secondaryActions ? (
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {actions}
            {secondaryActions ? (
              <>
                <div className="hidden @min-[640px]/page:contents">{secondaryActions}</div>
                <div className="relative @min-[640px]/page:hidden">
                  <button
                    type="button"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                    className="h-10 w-10 inline-flex items-center justify-center rounded-[12px] border border-[var(--desk-border)] bg-[var(--desk-card)] text-[var(--desk-text-body)] cursor-pointer"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="5" cy="12" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="19" cy="12" r="1.8" />
                    </svg>
                  </button>
                  {menuOpen ? (
                    <div
                      role="menu"
                      onClick={() => setMenuOpen(false)}
                      className="absolute right-0 top-full mt-2 z-30 min-w-[200px] rounded-[14px] bg-[var(--desk-card)] border border-[var(--desk-border)] shadow-[var(--desk-shadow-lg)] p-1.5 flex flex-col gap-1 [&>*]:w-full"
                    >
                      {secondaryActions}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
