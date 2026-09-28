import type { ElementType, ReactNode } from 'react';

export type GridCols = 1 | 2 | 3 | 4 | 5 | 6;
export type ResponsiveCols = { base: GridCols; sm?: GridCols; md?: GridCols; lg?: GridCols; xl?: GridCols };
type Step = keyof ResponsiveCols;

const STEPS: Step[] = ['base', 'sm', 'md', 'lg', 'xl'];

// Written out in full so Tailwind can find every class. The widths are the
// page's content area (the `page` container <Page> sets), not the screen,
// so the sidebar is always accounted for.
const COLS: Record<Step, Record<GridCols, string>> = {
  base: { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6' },
  sm: {
    1: '@min-[480px]/page:grid-cols-1', 2: '@min-[480px]/page:grid-cols-2', 3: '@min-[480px]/page:grid-cols-3',
    4: '@min-[480px]/page:grid-cols-4', 5: '@min-[480px]/page:grid-cols-5', 6: '@min-[480px]/page:grid-cols-6',
  },
  md: {
    1: '@min-[640px]/page:grid-cols-1', 2: '@min-[640px]/page:grid-cols-2', 3: '@min-[640px]/page:grid-cols-3',
    4: '@min-[640px]/page:grid-cols-4', 5: '@min-[640px]/page:grid-cols-5', 6: '@min-[640px]/page:grid-cols-6',
  },
  lg: {
    1: '@min-[960px]/page:grid-cols-1', 2: '@min-[960px]/page:grid-cols-2', 3: '@min-[960px]/page:grid-cols-3',
    4: '@min-[960px]/page:grid-cols-4', 5: '@min-[960px]/page:grid-cols-5', 6: '@min-[960px]/page:grid-cols-6',
  },
  xl: {
    1: '@min-[1200px]/page:grid-cols-1', 2: '@min-[1200px]/page:grid-cols-2', 3: '@min-[1200px]/page:grid-cols-3',
    4: '@min-[1200px]/page:grid-cols-4', 5: '@min-[1200px]/page:grid-cols-5', 6: '@min-[1200px]/page:grid-cols-6',
  },
};

const SPAN: Record<Step, Record<GridCols, string>> = {
  base: { 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4', 5: 'col-span-5', 6: 'col-span-6' },
  sm: {
    1: '@min-[480px]/page:col-span-1', 2: '@min-[480px]/page:col-span-2', 3: '@min-[480px]/page:col-span-3',
    4: '@min-[480px]/page:col-span-4', 5: '@min-[480px]/page:col-span-5', 6: '@min-[480px]/page:col-span-6',
  },
  md: {
    1: '@min-[640px]/page:col-span-1', 2: '@min-[640px]/page:col-span-2', 3: '@min-[640px]/page:col-span-3',
    4: '@min-[640px]/page:col-span-4', 5: '@min-[640px]/page:col-span-5', 6: '@min-[640px]/page:col-span-6',
  },
  lg: {
    1: '@min-[960px]/page:col-span-1', 2: '@min-[960px]/page:col-span-2', 3: '@min-[960px]/page:col-span-3',
    4: '@min-[960px]/page:col-span-4', 5: '@min-[960px]/page:col-span-5', 6: '@min-[960px]/page:col-span-6',
  },
  xl: {
    1: '@min-[1200px]/page:col-span-1', 2: '@min-[1200px]/page:col-span-2', 3: '@min-[1200px]/page:col-span-3',
    4: '@min-[1200px]/page:col-span-4', 5: '@min-[1200px]/page:col-span-5', 6: '@min-[1200px]/page:col-span-6',
  },
};

const GAP = { sm: 'gap-3', md: 'gap-4', lg: 'gap-5' } as const;

function classesFrom(table: Record<Step, Record<GridCols, string>>, cols: ResponsiveCols): string {
  return STEPS.filter((s) => cols[s] !== undefined)
    .map((s) => table[s][cols[s] as GridCols])
    .join(' ');
}

export function gridClasses(cols: ResponsiveCols): string {
  return classesFrom(COLS, cols);
}

interface GridProps {
  cols: ResponsiveCols;
  gap?: keyof typeof GAP;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

/**
 * Columns that fall back as the page narrows. Use this instead of a bare
 * grid-cols-N, which has no narrow fallback and pushes the page wider.
 */
export function Grid({ cols, gap = 'md', as: Tag = 'div', className = '', children }: GridProps) {
  return <Tag className={`grid ${gridClasses(cols)} ${GAP[gap]} ${className}`.trim()}>{children}</Tag>;
}

function GridItem({ span, as: Tag = 'div', className = '', children }: { span: ResponsiveCols; as?: ElementType; className?: string; children: ReactNode }) {
  return <Tag className={`min-w-0 ${classesFrom(SPAN, span)} ${className}`.trim()}>{children}</Tag>;
}

Grid.Item = GridItem;
