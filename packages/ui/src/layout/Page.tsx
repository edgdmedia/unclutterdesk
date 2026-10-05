import type { ReactNode } from 'react';

export interface PageProps {
  /** `narrow` is for pages that are only a form, so fields do not stretch across a wide screen. */
  size?: 'default' | 'narrow';
  /** `main-aside` gives the page a sized structure: a flexible column and a 372px side panel. */
  layout?: 'single' | 'main-aside';
  /** The side panel of `main-aside`; stacks under the main column on narrow page areas. */
  aside?: ReactNode;
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
export function Page({ size = 'default', layout = 'single', aside, header, className = '', children }: PageProps) {
  const cap = size === 'narrow' ? 'max-w-[880px]' : 'max-w-[1440px]';
  const body = layout === 'main-aside' ? (
    <div className="grid grid-cols-1 @min-[1200px]/page:grid-cols-[minmax(0,1fr)_372px] gap-4 md:gap-5 items-start">
      <div className="min-w-0 space-y-5">{children}</div>
      <div className="min-w-0 space-y-5">{aside}</div>
    </div>
  ) : children;
  return (
    <div className="@container/page flex-1 min-w-0 flex flex-col bg-[var(--desk-surface)]">
      {header}
      <main className={`w-full mx-auto ${cap} flex-1 px-4 py-4 md:px-6 md:py-6 xl:px-[26px] xl:pt-6 xl:pb-[30px] ${layout === 'main-aside' ? '' : 'space-y-5'} ${className}`.trim()}>
        {body}
      </main>
    </div>
  );
}
