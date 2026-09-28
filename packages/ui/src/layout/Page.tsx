import type { ReactNode } from 'react';

export interface PageProps {
  /** `narrow` is for pages that are only a form, so fields do not stretch across a wide screen. */
  size?: 'default' | 'narrow';
  header?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * The one place a page's width is decided. It fills the space the shell gives
 * it, caps content at 1440px (880px when narrow) and names the `page`
 * container that Grid and PageHeader respond to. Pages never set their own
 * width.
 */
export function Page({ size = 'default', header, className = '', children }: PageProps) {
  const cap = size === 'narrow' ? 'max-w-[880px]' : 'max-w-[1440px]';
  return (
    <div className="@container/page flex-1 min-w-0 flex flex-col bg-[var(--desk-surface)]">
      {header}
      <main className={`w-full mx-auto ${cap} flex-1 px-4 py-4 md:px-6 md:py-6 xl:px-[26px] xl:pt-6 xl:pb-[30px] space-y-5 ${className}`.trim()}>
        {children}
      </main>
    </div>
  );
}
