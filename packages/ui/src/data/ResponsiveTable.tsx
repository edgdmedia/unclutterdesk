import { Fragment, useId, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { PlainLink, type LinkLike } from '../navigation/links';
import { nextSort, sortRows, type SortState } from './sort';

export type ColumnPriority = 'always' | 'md' | 'lg';

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  priority?: ColumnPriority;
  align?: 'start' | 'end';
  sort?: (a: Row, b: Row) => number;
  className?: string;
}

export type TableFilter<Row> =
  | { placeholder: string; match: (row: Row, query: string) => boolean; minRows?: number }
  | { placeholder: string; query: string; onQueryChange: (query: string) => void };

export interface ResponsiveTableProps<Row> {
  rows: Row[];
  rowKey: (row: Row) => string;
  columns: Column<Row>[];
  caption: string;
  actions?: (row: Row) => ReactNode;
  rowHref?: (row: Row) => string;
  /** Names the row for screen readers: "Show more for Ada Ola". Defaults to the row key. */
  rowLabel?: (row: Row) => string;
  LinkComponent?: LinkLike;
  defaultSort?: SortState;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  filter?: TableFilter<Row>;
  state?: 'ready' | 'loading' | 'error';
  empty: ReactNode;
  error?: ReactNode;
  footer?: ReactNode;
}

// Written out in full so Tailwind finds them. Widths are the table's own (the
// `table` container), so a table in a narrow card behaves like one on a phone.
const SHOW_FROM: Record<ColumnPriority, string> = {
  always: '',
  md: 'hidden @min-[640px]/table:table-cell',
  lg: 'hidden @min-[960px]/table:table-cell',
};
// Hides the toggle, the opened row and the "Sort by" list once every column shows.
const HIDE_FROM = { md: '@min-[640px]/table:hidden', lg: '@min-[960px]/table:hidden' } as const;
// In the opened row, a md column's line hides once that column is back in the row.
const DETAIL_HIDE_FROM: Record<ColumnPriority, string> = { always: '', md: '@min-[640px]/table:hidden', lg: '' };

const TH = 'px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--desk-text-muted)] bg-[var(--desk-surface-alt)] border-b border-[var(--desk-border)]';
const TD = 'px-3 py-3 align-middle text-[12.5px] text-[var(--desk-text-body)]';
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="switch"], [role="menu"], [role="menuitem"]';

function isControlled<Row>(f: TableFilter<Row>): f is Extract<TableFilter<Row>, { onQueryChange: unknown }> {
  return 'onQueryChange' in f;
}

function sortLabels(header: string, key: string): { asc: string; desc: string } {
  if (/date|expir|joined|since|when/i.test(`${header} ${key}`)) return { asc: `${header}, oldest first`, desc: `${header}, newest first` };
  if (/hour|session|usage|value|amount|count|revenue|number/i.test(`${header} ${key}`)) return { asc: `${header}, lowest first`, desc: `${header}, highest first` };
  return { asc: `${header}, A to Z`, desc: `${header}, Z to A` };
}

/**
 * A table that stays a table on narrow screens: lower-priority columns step
 * out as the table narrows, and each row opens to show them. Sorting and a
 * search box are built in, or can be driven by the page.
 */
export function ResponsiveTable<Row>({
  rows,
  rowKey,
  columns,
  caption,
  actions,
  rowHref,
  rowLabel,
  LinkComponent = PlainLink,
  defaultSort,
  sort: sortProp,
  onSortChange,
  filter,
  state = 'ready',
  empty,
  error,
  footer,
}: ResponsiveTableProps<Row>) {
  const detailId = useId();
  const [ownSort, setOwnSort] = useState<SortState | null>(defaultSort ?? null);
  const [ownQuery, setOwnQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const sortControlled = onSortChange !== undefined;
  const sort = sortControlled ? sortProp ?? null : ownSort;
  const setSort = (next: SortState | null) => (sortControlled ? onSortChange!(next) : setOwnSort(next));

  const widest: 'md' | 'lg' | null = columns.some((c) => c.priority === 'lg') ? 'lg' : columns.some((c) => c.priority === 'md') ? 'md' : null;
  const hidden = columns.filter((c) => (c.priority ?? 'always') !== 'always');
  const sortable = columns.filter((c) => c.sort);

  const ownFilter = filter && !isControlled(filter) ? filter : null;
  const showSearch = filter ? (isControlled(filter) ? true : rows.length >= (filter.minRows ?? 8)) : false;
  const query = filter && isControlled(filter) ? filter.query : ownQuery;
  const needle = ownQuery.trim().toLowerCase();

  const visible = useMemo(() => {
    const filtered = ownFilter && needle ? rows.filter((r) => ownFilter.match(r, needle)) : rows;
    return sortControlled ? filtered : sortRows(filtered, columns, sort);
  }, [rows, ownFilter, needle, sortControlled, columns, sort]);

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const onRowClick = (key: string) => (e: MouseEvent<HTMLTableRowElement>) => {
    if (!widest || rowHref) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    toggle(key);
  };

  const totalColumns = columns.length + (widest ? 1 : 0) + (actions ? 1 : 0);
  const busy = state === 'loading';

  return (
    <div className="@container/table min-w-0">
      {showSearch || (widest && sortable.length) ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--desk-border)]">
          {showSearch && filter ? (
            <div className="flex items-center gap-2 min-w-0 flex-1 basis-[220px] h-[38px] px-3 rounded-[12px] bg-[var(--desk-surface-muted)] border border-[var(--desk-border)]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="text-[var(--desk-text-muted)] shrink-0">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                aria-label={filter.placeholder}
                placeholder={filter.placeholder}
                value={query}
                onChange={(e) => (isControlled(filter) ? filter.onQueryChange(e.target.value) : setOwnQuery(e.target.value))}
                className="min-w-0 flex-1 bg-transparent text-[12.5px] font-medium text-[var(--desk-text)] outline-none"
              />
              {ownFilter && ownQuery ? (
                <button type="button" aria-label="Clear search" onClick={() => setOwnQuery('')} className="text-[11px] font-bold text-[var(--desk-text-muted)] cursor-pointer">
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}
          {ownFilter && needle ? (
            <span className="text-[11.5px] font-medium text-[var(--desk-text-muted)]">
              Showing {visible.length} of {rows.length}
            </span>
          ) : null}
          {widest && sortable.length ? (
            <div className={`ml-auto ${HIDE_FROM[widest]}`}>
              <label className="flex items-center gap-2 text-[11.5px] font-semibold text-[var(--desk-text-muted)]">
                Sort by
                <select
                  aria-label="Sort by"
                  value={sort ? `${sort.key}:${sort.dir}` : ''}
                  onChange={(e) => {
                    const [key, dir] = e.target.value.split(':');
                    setSort(key ? { key, dir: dir as SortState['dir'] } : null);
                  }}
                  className="h-[34px] px-2 rounded-[10px] bg-[var(--desk-card)] border border-[var(--desk-border)] text-[12px] text-[var(--desk-text)]"
                >
                  <option value="">Original order</option>
                  {sortable.map((c) => {
                    const l = sortLabels(c.header, c.key);
                    return (
                      <Fragment key={c.key}>
                        <option value={`${c.key}:asc`}>{l.asc}</option>
                        <option value={`${c.key}:desc`}>{l.desc}</option>
                      </Fragment>
                    );
                  })}
                </select>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <table aria-busy={busy || undefined} className="w-full text-left border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key ? sort : null;
              const ariaSort = c.sort ? (active ? (active.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined;
              return (
                <th key={c.key} scope="col" aria-sort={ariaSort} className={`${TH} ${SHOW_FROM[c.priority ?? 'always']} ${c.align === 'end' ? 'text-right' : ''}`.trim()}>
                  {c.sort ? (
                    <button type="button" onClick={() => setSort(nextSort(sort, c.key))} className="inline-flex items-center gap-1 uppercase tracking-[0.06em] font-bold cursor-pointer hover:text-[var(--desk-text)]">
                      {c.header}
                      {/* An svg, not a text glyph: the header's accessible name stays just its title. */}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" className={active && active.dir === 'desc' ? 'rotate-180' : ''}>
                        {active ? <path d="m6 15 6-6 6 6" /> : <path d="m6 9 6 6 6-6" opacity={0.5} />}
                      </svg>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
            {widest ? (
              <th scope="col" className={`${TH} w-[44px] ${HIDE_FROM[widest]}`}>
                <span className="sr-only">Details</span>
              </th>
            ) : null}
            {actions ? (
              <th scope="col" className={`${TH} text-right`}>
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {busy ? (
            [0, 1, 2].map((i) => (
              <tr key={i} aria-hidden="true">
                <td colSpan={totalColumns} className={TD}>
                  <div className="h-4 rounded bg-[var(--desk-surface-muted)] animate-pulse" />
                </td>
              </tr>
            ))
          ) : state === 'error' ? (
            <tr>
              <td colSpan={totalColumns} className={`${TD} text-rose-700 font-medium`}>{error ?? 'Could not load this list.'}</td>
            </tr>
          ) : visible.length === 0 ? (
            <tr>
              <td colSpan={totalColumns} className={`${TD} py-6 text-[var(--desk-text-muted)] font-medium`}>
                {query.trim() ? `Nothing matches “${query.trim()}”.` : empty}
              </td>
            </tr>
          ) : (
            visible.map((row) => {
              const key = rowKey(row);
              const isOpen = open.has(key);
              const href = rowHref?.(row);
              return (
                <Fragment key={key}>
                  <tr
                    onClick={onRowClick(key)}
                    className={`relative border-b border-[var(--desk-border-soft)] hover:bg-[var(--desk-surface-alt)] ${widest && !href ? 'cursor-pointer' : ''}`}
                  >
                    {columns.map((c, i) => (
                      <td key={c.key} className={`${TD} ${SHOW_FROM[c.priority ?? 'always']} ${c.align === 'end' ? 'text-right' : ''} ${c.className ?? ''}`.trim()}>
                        {i === 0 && href ? (
                          // The link covers the whole row, so a tap anywhere opens it;
                          // buttons in the row sit above it.
                          <LinkComponent href={href} className="after:absolute after:inset-0 after:content-['']">
                            {c.cell(row)}
                          </LinkComponent>
                        ) : (
                          c.cell(row)
                        )}
                      </td>
                    ))}
                    {widest ? (
                      <td className={`${TD} w-[44px] ${HIDE_FROM[widest]}`}>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={`${detailId}-${key}`}
                          aria-label={`Show more for ${rowLabel ? rowLabel(row) : key}`}
                          onClick={() => toggle(key)}
                          className="relative z-10 h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[var(--desk-text-muted)] hover:bg-[var(--desk-surface-muted)] cursor-pointer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                            <path d="m9 6 6 6-6 6" />
                          </svg>
                        </button>
                      </td>
                    ) : null}
                    {actions ? (
                      <td className={`${TD} relative z-10 text-right whitespace-nowrap`}>{actions(row)}</td>
                    ) : null}
                  </tr>
                  {widest && isOpen ? (
                    <tr data-detail="" id={`${detailId}-${key}`} className={`border-b border-[var(--desk-border-soft)] bg-[var(--desk-surface-alt)] ${HIDE_FROM[widest]}`}>
                      <td colSpan={totalColumns} className="px-4 pb-3 pt-1">
                        <dl className="grid grid-cols-[minmax(80px,auto)_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
                          {hidden.map((c) => (
                            <Fragment key={c.key}>
                              <dt className={`font-semibold text-[var(--desk-text-muted)] ${DETAIL_HIDE_FROM[c.priority ?? 'always']}`}>{c.header}</dt>
                              <dd className={`min-w-0 text-[var(--desk-text-body)] break-words ${DETAIL_HIDE_FROM[c.priority ?? 'always']}`}>{c.cell(row)}</dd>
                            </Fragment>
                          ))}
                        </dl>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
