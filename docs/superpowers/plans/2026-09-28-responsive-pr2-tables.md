# Responsive PR 2: Shared Responsive Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared `ResponsiveTable` to `packages/ui`. It shows fewer columns on narrow screens, and each row opens to reveal the rest. It can sort and filter. Use it on the Hours log, the clients list, the team list and the discount codes, and move those four pages onto the shared `Page` and `PageHeader`.

**Architecture:**
- **`ResponsiveTable`** is a real `<table>` inside a named container (`@container/table`). Columns hide themselves with container queries, and a toggle appears only while some column is hidden. Everything is CSS: nothing is measured in JavaScript.
- **Sorting and filtering** run inside the table by default.
- **Controlled mode:** a page that pages its rows (the clients list) holds the search and sort itself, and uses the exported `sortRows`, so sorting covers every page of results, not just the one on screen.
- **The four pages** are also moved onto `Page` and `PageHeader`, because two of them still force a 1192px width that no table could fix. They join the layout rule check and the strict layout check.

**Not in this PR:**
- the shared form controls (PR 3). The table's search box and sort dropdown are plain elements inside the package, and PR 3 swaps them for `Input` and `Select`;
- the remaining pages (PR 4);
- the admin tables (PR 5).

**Tech Stack:** React 18, React Router 6, Tailwind CSS 4 (container queries), Vitest 2 with Testing Library and jsdom, and a pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-28-responsive-layout-shared-components-design.md`, sections 7 and 9 (PR 2). The PR 1 plan (`docs/superpowers/plans/2026-09-28-responsive-pr1-shell-and-layout.md`) shows the package conventions this plan builds on.

## Global Constraints

- **Column priority:** `always` columns always show. `md` columns show once the table itself is at least 640px wide, and `lg` columns from 960px. These are the table's width (`@container/table`), not the screen's.
- **Expanding rows:** the "›" toggle shows only while some column is hidden. An opened row lists the hidden columns as label/value lines.
- **Row actions are rendered once,** in their own last column, which is always visible. They are never duplicated into the opened row. Two copies of a control confuse screen readers and break tests that look for one.
- **Sorting:**
  - a header with a `sort` function is a button that cycles ascending → descending → off, and carries `aria-sort`;
  - on narrow tables, a "Sort by" dropdown lists every sortable column, including hidden ones;
  - sorting is stable: equal values keep their original order.
- **Filtering:** shown for 8 rows or more (`minRows`), with "Showing X of Y" and a Clear button. Matching is case-insensitive and ignores surrounding spaces.
- **Built-in states:** `loading` shows skeleton rows, `error` shows the error, and no rows shows `empty`. A search with no results says so, and names the search.
- **Out of scope:** sorting, filtering or paging on the server. The clients list keeps its own browser-side paging.
- **Package code:**
  - typed, with no `@ts-nocheck`;
  - Tailwind classes over the `--desk-*` tokens;
  - every class written out as a literal string, because Tailwind can't see classes built by concatenation;
  - no routes or roles; links go through `LinkComponent`.
- **Pages never set their own width.** The layout rule test enforces this for every page in `MIGRATED`.
- **Tests use the real app.**
  - Page tests render through `renderWithApp` (Task 3), inside the real router, `BrandProvider` and `ToastProvider`.
  - Never stub `@unclutterdesk/ui` or any other code of ours. A test that swaps our components for fakes only proves the page works against the fakes.
  - The one thing tests fake is the network (`utils/apiClient`), because unit tests run without a server. The layout check (`check:layout`) exercises the real API.
- **Git:**
  - work on `dev`, never push to `main`;
  - every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - the PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
  - no model IDs in commits or PRs.
- **Commands (from the repo root):** `pnpm --filter @unclutterdesk/ui test`, `pnpm --filter @unclutterdesk/app test` and `pnpm --recursive run typecheck`.

## Review Focus

1. **A click on a control inside a row** (the team page's on/off switch, a row menu, an edit or delete button). Expected: it does its own job and does not also open the row or follow the row's link.
   - Test: Task 2, "a click on a control inside the row does not open it".
2. **Rows with equal sort values,** such as two hours entries on the same date. Expected: they keep their original order and never shuffle between renders.
   - Test: Task 1, "`sortRows` is stable".
3. **A search typed with capitals or stray spaces,** such as " Ada ". Expected: it matches "ada@example.com".
   - Test: Task 2, "matches ignoring case and surrounding spaces".
4. **Sorting or filtering while a row is open.** Expected: the same row stays open, because open rows are tracked by row key, not by position.
   - Test: Task 2, "an opened row stays open when the order changes".
5. **Sorting the clients list, which spans several pages.** Expected: sorting covers every client, not just the 25 on screen, and a new search goes back to page 1.
   - Test: Task 5, "sorts every client, not just the page on screen" and "a new search starts again at page 1".

---

## File map

**`packages/ui`**
- Create `src/data/sort.ts`: `SortState`, `nextSort` and `sortRows`, all pure.
- Create `src/data/ResponsiveTable.tsx`.
- Modify `src/index.ts`: export both.
- Tests: `src/data/sort.test.ts` and `src/data/ResponsiveTable.test.tsx`.

**`apps/app`**
- Create `src/test/renderWithApp.tsx`: renders a page inside the real router, brand and toast providers. Its test is `src/test/renderWithApp.test.tsx`.
- Modify the four tests that stub the design system so they use it instead: `src/pages/__tests__/TeamSettingsPage.test.tsx`, `AccountPreferencesPage.test.tsx`, `PublicProfilePage.test.tsx` and `ClientPortalPayments.test.tsx`.
- Modify `src/pages/practice/HoursLogPage.tsx`.
- Modify `src/pages/practice/ClientsPage.tsx`, and create its test `src/pages/__tests__/ClientsPage.test.tsx`.
- Modify `src/pages/practice/settings/TeamSettingsPage.tsx`.
- Modify `src/pages/practice/settings/DiscountSettingsPage.tsx`.
- Modify `src/test/layout-rules.test.ts` (`MIGRATED`) and `scripts/check-layout.mjs` (`STRICT`).

---

### Task 0: Preconditions

- [ ] **Step 1: Check the starting point**

Run: `git checkout dev && git pull --ff-only origin dev && git status --short && git log --oneline -3`

Expected:
- a clean tree;
- the responsive PR 1 commits are present, the latest being "Add a layout check that loads pages at four widths…" or something after it;
- `packages/ui/src/layout/Page.tsx` and `packages/ui/src/navigation/links.tsx` exist.

- [ ] **Step 2: Know where these commits will land**

Run: `gh pr list --head dev --state open`

- If PR #36 (or another dev→main PR) is open, these commits join it. Task 8 updates its description.
- If none is open, Task 8 opens a new PR.

---

### Task 1: Sorting helpers

**Files:**
- Create: `packages/ui/src/data/sort.ts`
- Test: `packages/ui/src/data/sort.test.ts`

**Interfaces:**
- Produces:
  - `export type SortDir = 'asc' | 'desc'`
  - `export interface SortState { key: string; dir: SortDir }`
  - `export function nextSort(current: SortState | null | undefined, key: string): SortState | null`
  - `export function sortRows<Row>(rows: Row[], columns: Array<{ key: string; sort?: (a: Row, b: Row) => number }>, sort: SortState | null | undefined): Row[]`
  - `export const byText: <Row>(get: (row: Row) => string | null | undefined) => (a: Row, b: Row) => number`
  - `export const byNumber: <Row>(get: (row: Row) => number | null | undefined) => (a: Row, b: Row) => number`
  - `export const byDate: <Row>(get: (row: Row) => string | Date | null | undefined) => (a: Row, b: Row) => number`

- [ ] **Step 1: Write the failing test**

`packages/ui/src/data/sort.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { byDate, byNumber, byText, nextSort, sortRows } from './sort';

type Row = { id: string; name: string; n: number | null; at: string };
const rows: Row[] = [
  { id: 'a', name: 'bola', n: 2, at: '2026-09-02' },
  { id: 'b', name: 'Ade', n: null, at: '2026-09-01' },
  { id: 'c', name: 'chidi', n: 2, at: '2026-09-03' },
  { id: 'd', name: 'ade', n: 1, at: '2026-09-01' },
];
const columns = [
  { key: 'name', sort: byText<Row>((r) => r.name) },
  { key: 'n', sort: byNumber<Row>((r) => r.n) },
  { key: 'at', sort: byDate<Row>((r) => r.at) },
  { key: 'plain' },
];
const ids = (list: Row[]) => list.map((r) => r.id).join('');

describe('nextSort', () => {
  it('cycles ascending, descending, off', () => {
    expect(nextSort(null, 'name')).toEqual({ key: 'name', dir: 'asc' });
    expect(nextSort({ key: 'name', dir: 'asc' }, 'name')).toEqual({ key: 'name', dir: 'desc' });
    expect(nextSort({ key: 'name', dir: 'desc' }, 'name')).toBeNull();
  });
  it('starts ascending on a different column', () => {
    expect(nextSort({ key: 'name', dir: 'desc' }, 'n')).toEqual({ key: 'n', dir: 'asc' });
  });
});

describe('sortRows', () => {
  it('sorts text without regard to case', () => {
    expect(ids(sortRows(rows, columns, { key: 'name', dir: 'asc' }))).toBe('bdac');
  });
  it('is stable: equal values keep their original order', () => {
    expect(ids(sortRows(rows, columns, { key: 'at', dir: 'asc' }))).toBe('bdac');
    expect(ids(sortRows(rows, columns, { key: 'n', dir: 'desc' }))).toBe('acdb');
  });
  it('puts empty values last in either direction', () => {
    expect(sortRows(rows, columns, { key: 'n', dir: 'asc' }).at(-1)!.id).toBe('b');
    expect(sortRows(rows, columns, { key: 'n', dir: 'desc' }).at(-1)!.id).toBe('b');
  });
  it('leaves the order alone with no sort, or a column that cannot sort', () => {
    expect(ids(sortRows(rows, columns, null))).toBe('abcd');
    expect(ids(sortRows(rows, columns, { key: 'plain', dir: 'asc' }))).toBe('abcd');
  });
  it('never changes the list it was given', () => {
    const copy = [...rows];
    sortRows(rows, columns, { key: 'name', dir: 'desc' });
    expect(rows).toEqual(copy);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @unclutterdesk/ui test`
Expected: FAIL, "Failed to resolve import './sort'".

- [ ] **Step 3: Implement**

`packages/ui/src/data/sort.ts`:

```ts
export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: string;
  dir: SortDir;
}

/** A header click: ascending, then descending, then back to the original order. */
export function nextSort(current: SortState | null | undefined, key: string): SortState | null {
  if (!current || current.key !== key) return { key, dir: 'asc' };
  return current.dir === 'asc' ? { key, dir: 'desc' } : null;
}

/**
 * A sorted copy. Stable, so rows that compare equal keep their order. Comparators
 * from byText, byNumber and byDate put empty values last in both directions.
 */
export function sortRows<Row>(
  rows: Row[],
  columns: Array<{ key: string; sort?: (a: Row, b: Row) => number }>,
  sort: SortState | null | undefined,
): Row[] {
  const column = sort ? columns.find((c) => c.key === sort.key && c.sort) : undefined;
  if (!sort || !column?.sort) return [...rows];
  const compare = column.sort;
  const dir = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const result = compare(a.row, b.row);
      // EMPTY_LAST marks "one side is empty": keep it last whatever the direction.
      if (Math.abs(result) === EMPTY_LAST) return result;
      return result * dir || a.index - b.index;
    })
    .map((x) => x.row);
}

const EMPTY_LAST = 1e9;

function emptyLast<V>(a: V | null | undefined, b: V | null | undefined): number | null {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return EMPTY_LAST;
  if (bEmpty) return -EMPTY_LAST;
  return null;
}

export const byText =
  <Row,>(get: (row: Row) => string | null | undefined) =>
  (a: Row, b: Row): number => {
    const x = get(a);
    const y = get(b);
    return emptyLast(x, y) ?? String(x).localeCompare(String(y), undefined, { sensitivity: 'base', numeric: true });
  };

export const byNumber =
  <Row,>(get: (row: Row) => number | null | undefined) =>
  (a: Row, b: Row): number => {
    const x = get(a);
    const y = get(b);
    return emptyLast(x, y) ?? (x as number) - (y as number);
  };

export const byDate =
  <Row,>(get: (row: Row) => string | Date | null | undefined) =>
  (a: Row, b: Row): number => {
    const x = get(a);
    const y = get(b);
    return emptyLast(x, y) ?? new Date(x as string | Date).getTime() - new Date(y as string | Date).getTime();
  };
```

The "is stable" case for descending `n` expects `acdb`: `a` and `c` both have 2 and keep their order, then `d` (1), then `b` (empty, last).

- [ ] **Step 4: Run it and confirm it passes**

Run: `pnpm --filter @unclutterdesk/ui test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/data/sort.ts packages/ui/src/data/sort.test.ts
git commit -m "Add stable sorting helpers for shared tables

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `ResponsiveTable`

**Files:**
- Create: `packages/ui/src/data/ResponsiveTable.tsx`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/data/ResponsiveTable.test.tsx`

**Interfaces:**
- Consumes: `SortState`, `nextSort` and `sortRows` (Task 1); `LinkLike` and `PlainLink` (from `../navigation/links`, built in PR 1).
- Produces:

```ts
export type ColumnPriority = 'always' | 'md' | 'lg';
export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  priority?: ColumnPriority;          // default 'always'
  align?: 'start' | 'end';
  sort?: (a: Row, b: Row) => number;  // presence makes the column sortable
  className?: string;                 // extra classes for this column's cells
}
export type TableFilter<Row> =
  | { placeholder: string; match: (row: Row, query: string) => boolean; minRows?: number }   // the table filters
  | { placeholder: string; query: string; onQueryChange: (query: string) => void };          // the page filters
export interface ResponsiveTableProps<Row> {
  rows: Row[];
  rowKey: (row: Row) => string;
  columns: Column<Row>[];
  caption: string;
  actions?: (row: Row) => ReactNode;
  rowHref?: (row: Row) => string;     // the first cell links there; the whole row is clickable
  rowLabel?: (row: Row) => string;    // names the row for screen readers, e.g. "Show more for Ada Ola"
  LinkComponent?: LinkLike;
  defaultSort?: SortState;
  sort?: SortState | null;            // controlled when onSortChange is given
  onSortChange?: (sort: SortState | null) => void;
  filter?: TableFilter<Row>;
  state?: 'ready' | 'loading' | 'error';
  empty: ReactNode;
  error?: ReactNode;
  footer?: ReactNode;
}
export function ResponsiveTable<Row>(props: ResponsiveTableProps<Row>): JSX.Element
```

- [ ] **Step 1: Write the failing tests**

`packages/ui/src/data/ResponsiveTable.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ResponsiveTable, type Column } from './ResponsiveTable';
import { byDate, byText } from './sort';

type Entry = { id: string; date: string; category: string; hours: number; client: string | null; notes: string };
const ENTRIES: Entry[] = [
  { id: '1', date: '2026-09-03', category: 'Session', hours: 1, client: 'Ada Ola', notes: 'first' },
  { id: '2', date: '2026-09-01', category: 'Supervision', hours: 1.5, client: null, notes: 'case review' },
  { id: '3', date: '2026-09-02', category: 'Session', hours: 0.8, client: 'Bola Ade', notes: 'follow-up' },
];
const COLUMNS: Column<Entry>[] = [
  { key: 'date', header: 'Date', cell: (e) => e.date, sort: byDate((e) => e.date) },
  { key: 'category', header: 'Category', cell: (e) => e.category, sort: byText((e) => e.category) },
  { key: 'hours', header: 'Hours', cell: (e) => String(e.hours), align: 'end' },
  { key: 'client', header: 'Client', cell: (e) => e.client ?? '—', priority: 'md', sort: byText((e) => e.client) },
  { key: 'notes', header: 'Notes', cell: (e) => e.notes, priority: 'lg' },
];

function table(props: Partial<Parameters<typeof ResponsiveTable<Entry>>[0]> = {}) {
  return render(
    <ResponsiveTable<Entry> rows={ENTRIES} rowKey={(e) => e.id} columns={COLUMNS} caption="Hours log" empty="No hours yet." {...props} />,
  );
}
const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
const firstCells = () => bodyRows().filter((r) => !r.hasAttribute('data-detail')).map((r) => within(r).getAllByRole('cell')[0].textContent);

describe('structure', () => {
  it('is a real table with a caption and column headers', () => {
    table();
    expect(screen.getByRole('table', { name: 'Hours log' })).toBeTruthy();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(
      expect.arrayContaining(['Date', 'Category', 'Hours', 'Client', 'Notes']),
    );
  });

  it('hides lower-priority columns with container queries on the table', () => {
    const { container } = table();
    expect(container.firstElementChild!.className).toContain('@container/table');
    const client = screen.getByRole('columnheader', { name: /Client/ });
    const notes = screen.getByRole('columnheader', { name: /Notes/ });
    expect(client.className).toContain('hidden @min-[640px]/table:table-cell');
    expect(notes.className).toContain('hidden @min-[960px]/table:table-cell');
    expect(screen.getByRole('columnheader', { name: /Date/ }).className).not.toContain('hidden');
  });
});

describe('opening a row', () => {
  it('offers a toggle only up to the width where every column shows', () => {
    table();
    const toggle = screen.getAllByRole('button', { name: /Show more for/ })[0];
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.closest('td')!.className).toContain('@min-[960px]/table:hidden');
  });

  it('lists the hidden columns when opened', () => {
    table();
    fireEvent.click(screen.getAllByRole('button', { name: /Show more for/ })[0]);
    const detail = bodyRows().find((r) => r.hasAttribute('data-detail'))!;
    expect(within(detail).getByText('Client')).toBeTruthy();
    expect(within(detail).getByText('Ada Ola')).toBeTruthy();
    expect(within(detail).getByText('Notes')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Show more for/ })[0].getAttribute('aria-expanded')).toBe('true');
  });

  it('opens when the row itself is tapped', () => {
    table();
    fireEvent.click(screen.getByText('first'));
    expect(bodyRows().some((r) => r.hasAttribute('data-detail'))).toBe(true);
  });

  it('a click on a control inside the row does not open it', () => {
    const onEdit = vi.fn();
    table({ actions: (e) => <button onClick={onEdit}>Edit {e.id}</button> });
    fireEvent.click(screen.getByRole('button', { name: 'Edit 1' }));
    expect(onEdit).toHaveBeenCalled();
    expect(bodyRows().some((r) => r.hasAttribute('data-detail'))).toBe(false);
  });

  it('names each row for screen readers', () => {
    table({ rowLabel: (e) => `${e.date} ${e.category}` });
    expect(screen.getByRole('button', { name: 'Show more for 2026-09-03 Session' })).toBeTruthy();
  });

  it('has no toggle when every column always shows', () => {
    table({ columns: COLUMNS.slice(0, 3) });
    expect(screen.queryByRole('button', { name: /Show more for/ })).toBeNull();
  });

  it('an opened row stays open when the order changes', () => {
    table();
    fireEvent.click(screen.getByText('follow-up')); // row 3
    fireEvent.click(screen.getByRole('button', { name: /^Date/ }));
    const detail = bodyRows().find((r) => r.hasAttribute('data-detail'))!;
    expect(within(detail).getByText('Bola Ade')).toBeTruthy();
  });
});

describe('actions', () => {
  it('renders each row’s actions once, in their own column', () => {
    table({ actions: (e) => <button>Edit {e.id}</button> });
    fireEvent.click(screen.getAllByRole('button', { name: /Show more for/ })[0]);
    expect(screen.getAllByRole('button', { name: 'Edit 1' })).toHaveLength(1);
  });
});

describe('links', () => {
  it('links the first cell when rows open a page, and a row tap does not also expand it', () => {
    const Link = ({ href, children, ...rest }: any) => <a data-router href={href} {...rest}>{children}</a>;
    table({ rowHref: (e) => `/entries/${e.id}`, LinkComponent: Link });
    const link = screen.getAllByRole('link')[0];
    expect(link.getAttribute('href')).toBe('/entries/1');
    expect(link.hasAttribute('data-router')).toBe(true);
    fireEvent.click(screen.getByText('first'));
    expect(bodyRows().some((r) => r.hasAttribute('data-detail'))).toBe(false);
  });
});

describe('sorting', () => {
  it('cycles a header through ascending, descending and off, and says so', () => {
    table();
    const header = () => screen.getByRole('columnheader', { name: /Date/ });
    const button = screen.getByRole('button', { name: /^Date/ });
    fireEvent.click(button);
    expect(header().getAttribute('aria-sort')).toBe('ascending');
    expect(firstCells()).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    fireEvent.click(button);
    expect(header().getAttribute('aria-sort')).toBe('descending');
    expect(firstCells()[0]).toBe('2026-09-03');
    fireEvent.click(button);
    expect(header().getAttribute('aria-sort')).toBe('none');
    expect(firstCells()).toEqual(['2026-09-03', '2026-09-01', '2026-09-02']);
  });

  it('offers every sortable column in a "Sort by" list for narrow tables', () => {
    table();
    const select = screen.getByLabelText('Sort by') as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Client, A to Z', 'Client, Z to A', 'Date, oldest first', 'Date, newest first']));
    fireEvent.change(select, { target: { value: 'date:desc' } });
    expect(firstCells()[0]).toBe('2026-09-03');
    expect(select.closest('div')!.className).toContain('@min-[960px]/table:hidden');
  });

  it('starts from a default sort', () => {
    table({ defaultSort: { key: 'date', dir: 'asc' } });
    expect(firstCells()[0]).toBe('2026-09-01');
  });

  it('hands control to the page when asked', () => {
    const onSortChange = vi.fn();
    table({ sort: null, onSortChange });
    fireEvent.click(screen.getByRole('button', { name: /^Date/ }));
    expect(onSortChange).toHaveBeenCalledWith({ key: 'date', dir: 'asc' });
    // Controlled: the page decides the order, so nothing moves until it does.
    expect(firstCells()[0]).toBe('2026-09-03');
  });
});

describe('filtering', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ ...ENTRIES[i % 3], id: String(i + 1), client: i === 4 ? 'ada@example.com' : `Client ${i}` }));
  const match = (e: Entry, q: string) => [e.client, e.notes].some((v) => v?.toLowerCase().includes(q));

  it('matches ignoring case and surrounding spaces, and counts what it shows', () => {
    table({ rows: many, filter: { placeholder: 'Search hours', match } });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search hours' }), { target: { value: '  ADA@ ' } });
    expect(firstCells()).toHaveLength(1);
    expect(screen.getByText('Showing 1 of 10')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(firstCells()).toHaveLength(10);
  });

  it('names the search when nothing matches', () => {
    table({ rows: many, filter: { placeholder: 'Search hours', match } });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nothing matches “zzz”.')).toBeTruthy();
  });

  it('stays out of the way for short lists', () => {
    table({ filter: { placeholder: 'Search hours', match } });
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('only shows the box when the page does the filtering', () => {
    const onQueryChange = vi.fn();
    table({ filter: { placeholder: 'Search clients', query: 'ad', onQueryChange } });
    const box = screen.getByRole('searchbox', { name: 'Search clients' }) as HTMLInputElement;
    expect(box.value).toBe('ad');
    fireEvent.change(box, { target: { value: 'ada' } });
    expect(onQueryChange).toHaveBeenCalledWith('ada');
    expect(firstCells()).toHaveLength(3);
  });
});

describe('states', () => {
  it('shows the empty message', () => {
    table({ rows: [] });
    expect(screen.getByText('No hours yet.')).toBeTruthy();
  });
  it('shows a loading table as busy', () => {
    table({ rows: [], state: 'loading' });
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByText('No hours yet.')).toBeNull();
  });
  it('shows the error', () => {
    table({ rows: [], state: 'error', error: 'Could not load hours.' });
    expect(screen.getByText('Could not load hours.')).toBeTruthy();
  });
  it('renders a footer, for paging', () => {
    table({ footer: <span>Page 1 of 2</span> });
    expect(screen.getByText('Page 1 of 2')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm --filter @unclutterdesk/ui test`
Expected: FAIL, "Failed to resolve import './ResponsiveTable'".

- [ ] **Step 3: Implement**

`packages/ui/src/data/ResponsiveTable.tsx`:

```tsx
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

const TH = 'px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--desk-text-muted)] bg-[var(--desk-surface-alt)] border-b border-[var(--desk-border)] whitespace-nowrap';
const TD = 'px-4 py-3 align-middle text-[12.5px] text-[var(--desk-text-body)]';
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
                      <span aria-hidden="true" className="text-[9px]">{active ? (active.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
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
```

The toggle's accessible name is "Show more for …" followed by `rowLabel(row)`, so every page passes a `rowLabel` that a person would recognise.

In `packages/ui/src/index.ts`, add:

```ts
export * from './data/sort';
export * from './data/ResponsiveTable';
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `pnpm --filter @unclutterdesk/ui test && pnpm --filter @unclutterdesk/ui typecheck`
Expected: PASS, no errors.

If the "Sort by" test fails on `select.closest('div')`, the `<label>` is inside a `<div>` carrying `HIDE_FROM[widest]`, as written above. Keep that wrapper.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/data/ResponsiveTable.tsx packages/ui/src/data/ResponsiveTable.test.tsx packages/ui/src/index.ts
git commit -m "Add a shared table that keeps its key columns on narrow screens and opens rows for the rest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Page tests run inside the real app

**Why:** four page tests replace the whole design system (`@unclutterdesk/ui`) with fakes. They pass even when a real component, such as the `ResponsiveTable` this PR adds, would break the page. From here on, tests render pages the way the app does, and fake only the network.

**Files:**
- Create: `apps/app/src/test/renderWithApp.tsx`
- Test: `apps/app/src/test/renderWithApp.test.tsx`
- Modify: `apps/app/src/pages/__tests__/TeamSettingsPage.test.tsx`, `AccountPreferencesPage.test.tsx`, `PublicProfilePage.test.tsx` and `ClientPortalPayments.test.tsx`

**Interfaces:**
- Produces: `export function renderWithApp(ui: ReactElement, options?: { route?: string; brand?: TenantBrandConfig | null }): RenderResult`, plus a re-export of everything from `@testing-library/react`.

- [ ] **Step 1: Write the failing test**

`apps/app/src/test/renderWithApp.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { useLocation } from 'react-router-dom';
import { useBrand, useToast } from '@unclutterdesk/ui';
import { renderWithApp, screen, fireEvent } from './renderWithApp';

function Probe() {
  const brand = useBrand();
  const toast = useToast();
  const location = useLocation();
  return (
    <div>
      <span>{`brand:${brand.name}`}</span>
      <span>{`at:${location.pathname}`}</span>
      <button onClick={() => toast.success('Saved')}>Toast</button>
    </div>
  );
}

describe('renderWithApp', () => {
  it('provides the real router, brand and toasts', async () => {
    renderWithApp(<Probe />, { route: '/dashboard/clients', brand: { name: 'Calm Practice', primaryColor: '#123456' } as any });
    expect(screen.getByText('brand:Calm Practice')).toBeTruthy();
    expect(screen.getByText('at:/dashboard/clients')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Toast' }));
    expect(await screen.findByText('Saved')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/test/renderWithApp.test.tsx`
Expected: FAIL, "Failed to resolve import './renderWithApp'".

- [ ] **Step 3: Implement**

`apps/app/src/test/renderWithApp.tsx`:

```tsx
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderResult } from '@testing-library/react';
import { BrandProvider, ToastProvider, type TenantBrandConfig } from '@unclutterdesk/ui';

export * from '@testing-library/react';

/**
 * Renders a page the way the app does: inside the router, the practice's brand
 * and the toast system, all real. Tests fake only the network (utils/apiClient);
 * nothing of ours is swapped for a stand-in.
 */
export function renderWithApp(
  ui: ReactElement,
  { route = '/', brand = null }: { route?: string; brand?: TenantBrandConfig | null } = {},
): RenderResult {
  const Providers = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>
      <BrandProvider brand={brand}>
        <ToastProvider>{children}</ToastProvider>
      </BrandProvider>
    </MemoryRouter>
  );
  return render(ui, { wrapper: Providers });
}
```

If `TenantBrandConfig` is not exported from the package, check with `grep -n "TenantBrandConfig" packages/ui/src/BrandProvider.tsx` and add `export` to its declaration there. It is the brand shape the app already passes to `BrandProvider`.

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/test/renderWithApp.test.tsx`
Expected: PASS.

- [ ] **Step 4: Move the four tests onto it**

In each of `TeamSettingsPage.test.tsx`, `AccountPreferencesPage.test.tsx`, `PublicProfilePage.test.tsx` and `ClientPortalPayments.test.tsx`:
1. Delete the whole `vi.mock('@unclutterdesk/ui', …)` block.
2. Keep the `vi.mock` of `utils/apiClient` (the network) exactly as it is.
3. Import the render helpers from the new file instead of Testing Library:

```tsx
import { renderWithApp, screen, waitFor, cleanup, fireEvent } from '../../test/renderWithApp';
```

   Keep whichever of these names the file already uses.
4. Change each `render(<Page … />)` to `renderWithApp(<Page … />)`. If the file wrapped the page in its own `<MemoryRouter initialEntries={[x]}>`, drop that wrapper and pass `{ route: x }` instead.

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/pages/__tests__`

Expected: PASS. If an assertion fails, it was written against a fake:
- for example, a fake `StatusBadge` that printed its children where the real one prints a formatted label;
- change the assertion to what the real component shows (find it by role or by the visible text);
- never bring the fake back.

Note each changed assertion in the commit message.

- [ ] **Step 5: Stop fakes coming back**

Append to `apps/app/src/test/layout-rules.test.ts`:

```ts
describe('tests use the real app', () => {
  it('no test replaces the shared design system with fakes', () => {
    const testFiles = (function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return walk(path);
        return /\.test\.tsx?$/.test(name) ? [path] : [];
      });
    })(SRC);
    const offenders = testFiles
      .filter((f) => /vi\.mock\(\s*['"]@unclutterdesk\/ui['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
```

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/test/layout-rules.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/test apps/app/src/pages/__tests__ packages/ui/src/BrandProvider.tsx
git commit -m "Run page tests inside the real app providers instead of faking the design system

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Hours log

**Files:**
- Modify: `apps/app/src/pages/practice/HoursLogPage.tsx` (imports at line 3; the layout from `return (` at about line 179 to the closing `</div>` at about line 333)

**Interfaces:**
- Consumes: `Page`, `PageHeader`, `ResponsiveTable`, `Column`, `byDate`, `byText` and `byNumber` from `@unclutterdesk/ui`.

- [ ] **Step 1: Swap the imports**

Line 3 becomes:

```tsx
import { Card, Eyebrow, useBrand, useToast, Page, PageHeader, ResponsiveTable, byDate, byNumber, byText, type Column } from '@unclutterdesk/ui';
```

- [ ] **Step 2: Define the columns** (inside the component, just before `return (`)

```tsx
  const clientLabel = (e: HoursEntry) => e.clientName ?? (e.source === 'MANUAL' ? '—' : 'Client');
  const detailText = (e: HoursEntry) => [e.supervisorName, e.notes].filter(Boolean).join(' · ');
  const columns: Column<HoursEntry>[] = [
    { key: 'date', header: 'Date', cell: (e) => <span className="whitespace-nowrap font-semibold text-[#0F172A]">{day(e.date)}</span>, sort: byDate((e) => e.date) },
    {
      key: 'category',
      header: 'Category',
      cell: (e) => (
        <>
          {CATEGORY_LABEL[e.category] ?? e.category}
          {e.source === 'BOOKING' ? <span className="ml-1.5 text-[10px] font-bold text-[#64748B] bg-[#F1F5F9] rounded-full px-1.5 py-0.5">Session</span> : null}
        </>
      ),
      sort: byText((e) => CATEGORY_LABEL[e.category] ?? e.category),
    },
    { key: 'hours', header: 'Hours', align: 'end', cell: (e) => <span className="font-bold text-[#0F172A]">{hours(e.durationMinutes)}</span>, sort: byNumber((e) => e.durationMinutes) },
    { key: 'client', header: 'Client', priority: 'md', cell: clientLabel, sort: byText((e) => e.clientName) },
    { key: 'notes', header: 'Notes', priority: 'lg', className: 'max-w-[220px] truncate', cell: (e) => <span title={detailText(e)}>{detailText(e)}</span> },
  ];
```

- [ ] **Step 3: Replace the layout**

1. Replace everything from `<div className="flex-1 flex flex-col bg-[#F8FAFC] min-w-0">` down to and including `<main className="p-4 md:p-[24px_26px_30px] grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">` with:

```tsx
    <Page
      header={
        <PageHeader
          eyebrow="CLINICAL"
          title="Hours log"
          actions={
            <>
              <button type="button" onClick={() => void download('csv')} disabled={downloading !== null} className="h-9 px-3 rounded-[10px] border border-[#E2E8F0] bg-white text-xs font-bold text-[#0F172A] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                <Download className="h-3.5 w-3.5" /> {downloading === 'csv' ? 'Preparing…' : 'CSV'}
              </button>
              <button type="button" onClick={() => void download('pdf')} disabled={downloading !== null} className="h-9 px-3 rounded-[10px] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50" style={{ backgroundColor: primary }}>
                <FileText className="h-3.5 w-3.5" /> {downloading === 'pdf' ? 'Preparing…' : 'PDF'}
              </button>
            </>
          }
          secondaryActions={
            <label className="flex items-center gap-1.5 px-2 py-1.5 text-[11.5px] font-semibold text-[#64748B] cursor-pointer">
              <input type="checkbox" checked={fullNames} onChange={(e) => setFullNames(e.target.checked)} />
              Full client names
            </label>
          }
        />
      }
    >
      <p className="text-xs text-[#64748B] font-medium -mt-1">
        Completed sessions are logged for you. Add supervision, group work and training by hand.
      </p>
      <div className="grid grid-cols-1 @min-[1200px]/page:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 md:gap-6 items-start">
```

2. The error alert's class `lg:col-span-12` becomes `@min-[1200px]/page:col-span-2`.
3. Change `<div className="lg:col-span-8 space-y-4">` to `<div className="space-y-4 min-w-0">`, and `<div className="lg:col-span-4 space-y-4">` to `<div className="space-y-4 min-w-0">`.
4. Replace the entries card, from `<Card padding="p-0" className="overflow-hidden">` to its closing `</Card>`, with:

```tsx
          <Card padding="p-0" className="overflow-hidden">
            <ResponsiveTable<HoursEntry>
              caption="Hours log entries"
              rows={log?.entries ?? []}
              rowKey={(e) => e.id}
              rowLabel={(e) => `${day(e.date)}, ${CATEGORY_LABEL[e.category] ?? e.category}`}
              columns={columns}
              state={log ? 'ready' : 'loading'}
              empty="No hours yet. Completed sessions appear here automatically."
              filter={{
                placeholder: 'Search hours',
                match: (e, q) => [clientLabel(e), detailText(e), CATEGORY_LABEL[e.category] ?? e.category].some((v) => v.toLowerCase().includes(q)),
              }}
              actions={(e) => (
                <>
                  <button type="button" aria-label="Edit entry" onClick={() => startEdit(e)} className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"><Pencil className="h-3.5 w-3.5" /></button>
                  {e.source === 'MANUAL' ? (
                    <button type="button" aria-label="Delete entry" onClick={() => void removeEntry(e)} className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                  ) : null}
                </>
              )}
            />
          </Card>
```

5. At the end, replace `</main>` then `</div>` with `</div>` then `</Page>`. The inner grid `<div>` closes where `</main>` was.

The target form's `grid grid-cols-1 sm:grid-cols-3` stays: its base is one column, so it passes the rule.

- [ ] **Step 4: Typecheck, test, and check in a browser**

Run: `pnpm --filter @unclutterdesk/app typecheck && pnpm --filter @unclutterdesk/app test`
Expected: PASS.

Open `/dashboard/hours` as `dr.jane@smiththerapy.ng` at 390px and 1280px.

Expected:
- on the phone: Date, Category, Hours and the actions show, and a row opens to show Client and Notes;
- at 1280px: every column shows, and there is no toggle;
- the Edit and Delete buttons still work.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/practice/HoursLogPage.tsx
git commit -m "Move the hours log onto the shared page and responsive table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Clients list (controlled search, sort and paging)

**Files:**
- Modify: `apps/app/src/pages/practice/ClientsPage.tsx` (imports, the filtering and paging block at lines 39–51, the layout from `return (` at about line 139, and the add-client modal grids at about lines 315 and 340)
- Test: `apps/app/src/pages/__tests__/ClientsPage.test.tsx`

**Interfaces:**
- Consumes: `Page`, `PageHeader`, `Grid`, `ResponsiveTable`, `Column`, `SortState`, `sortRows`, `byText`, `byNumber` and `AvatarChip` from `@unclutterdesk/ui`; `RouterLink` from `../../components/shell/RouterLink`.

- [ ] **Step 1: Write the failing test**

`apps/app/src/pages/__tests__/ClientsPage.test.tsx`:

```tsx
import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, within } from '../../test/renderWithApp';

// The network is the only thing faked: there is no server in a unit test.
vi.mock('../../utils/apiClient', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

const { ClientsPage } = await import('../practice/ClientsPage');

// 30 clients named Client 01 … Client 30, so the list spans two pages of 25.
const clients = Array.from({ length: 30 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    id: String(i + 1), name: `Client ${n}`, email: `c${n}@example.com`, care: 'Individual Therapy',
    sessions: String(i), next: 'None scheduled', status: 'Active', initials: 'C', phone: '',
    since: 'Sep 2026', emergency: '', notes: [], intake: [],
  };
});

const renderPage = () =>
  renderWithApp(<ClientsPage clients={clients as any} setClients={() => undefined} onRefresh={async () => undefined} />, {
    route: '/dashboard/clients',
  });
const names = () =>
  within(screen.getByRole('table')).getAllByRole('link').map((a) => a.textContent ?? '');

afterEach(cleanup);

describe('ClientsPage', () => {
  it('fits the page instead of forcing a width', () => {
    const { container } = renderPage();
    expect(container.innerHTML).not.toContain('min-w-[800px]');
    expect(screen.getByRole('heading', { level: 1, name: 'Clients' })).toBeTruthy();
  });

  it('sorts every client, not just the page on screen', () => {
    renderPage();
    expect(names()[0]).toContain('Client 01');
    fireEvent.click(screen.getByRole('button', { name: /^Client/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Client/ })); // descending
    expect(names()[0]).toContain('Client 30');
    expect(names()).toHaveLength(25);
  });

  it('searches from a box every screen size can reach', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search clients' }), { target: { value: 'c07@' } });
    expect(names()).toHaveLength(1);
    expect(names()[0]).toContain('Client 07');
  });

  it('a new search starts again at page 1', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(names()[0]).toContain('Client 26');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search clients' }), { target: { value: 'Client' } });
    expect(names()[0]).toContain('Client 01');
  });

  it('opens a client from the row', () => {
    renderPage();
    expect(within(screen.getByRole('table')).getAllByRole('link')[0].getAttribute('href')).toBe('/dashboard/clients/1');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/pages/__tests__/ClientsPage.test.tsx`
Expected: FAIL. The page renders no `<table>` and still carries `min-w-[800px]`.

- [ ] **Step 3: Implement the data flow**

1. Change the `@unclutterdesk/ui` import so it also brings in `Page, PageHeader, Grid, ResponsiveTable, sortRows, byText, byNumber, type Column, type SortState`. Keep the names already imported: `Card`, `Eyebrow`, `AvatarChip`, `StatusBadge`, `useToast` and `useBrand`.
2. Add `import { RouterLink } from '../../components/shell/RouterLink';`.
3. Replace the block from `// Filter clients` through `const pageClients = filteredClients.slice(pageStart, pageStart + PAGE_SIZE);` with:

```tsx
  const [sort, setSort] = useState<SortState | null>(null);

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Client',
      sort: byText((c) => c.name),
      cell: (c) => (
        <span className="flex items-center gap-3 min-w-0">
          <AvatarChip initials={c.initials} size="sm" />
          <span className="min-w-0">
            <span className="block text-[14px] font-bold text-[#0F172A] leading-tight truncate">{c.name}</span>
            <span className="block text-[11.5px] text-[#94A3B8] font-medium truncate">{c.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'next', header: 'Next session', cell: (c) => <span className="text-[13px] font-medium text-[#475569]">{c.next}</span> },
    { key: 'care', header: 'Care type', priority: 'md', cell: (c) => <span className="text-[13px] font-medium text-[#475569]">{c.care}</span>, sort: byText((c) => c.care) },
    { key: 'sessions', header: 'Sessions', priority: 'md', align: 'end', cell: (c) => <span className="text-[13px] font-bold text-[#0F172A]">{c.sessions}</span>, sort: byNumber((c) => Number(c.sessions)) },
    { key: 'status', header: 'Status', priority: 'lg', cell: (c) => <StatusBadge status={c.status} />, sort: byText((c) => c.status) },
  ];

  // Search, then sort, then page: sorting covers every client, not only the 25 on screen.
  const q = searchQuery.trim().toLowerCase();
  const filteredClients = q ? clients.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) : clients;
  const sortedClients = sortRows(filteredClients, columns, sort);

  const PAGE_SIZE = 25;
  const lastPage = Math.max(0, Math.ceil(sortedClients.length / PAGE_SIZE) - 1);
  // A search that shortens the list can strand the reader past the end.
  const currentPage = Math.min(page, lastPage);
  const pageStart = currentPage * PAGE_SIZE;
  const pageClients = sortedClients.slice(pageStart, pageStart + PAGE_SIZE);

  const onSearch = (value: string) => {
    setSearchQuery(value);
    setPage(0);
  };
```

4. In `exportClients`, change `...filteredClients.map(` to `...sortedClients.map(`, so the CSV matches the order on screen.

- [ ] **Step 4: Replace the layout**

1. Replace everything from `<div className="flex-1 min-w-0 flex flex-col bg-[#F8FAFC]">` through the closing `</main>` with:

```tsx
    <Page
      header={
        <PageHeader
          eyebrow="CASELOAD ROSTER"
          title="Clients"
          actions={
            <button
              onClick={() => setShowAddModal(true)}
              className="os-brand-btn h-[40px] px-3 md:px-4 rounded-[14px] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="h-4 w-4" />
              <span>Add client</span>
            </button>
          }
          secondaryActions={
            <button
              type="button"
              onClick={exportClients}
              disabled={filteredClients.length === 0}
              className="flex h-[40px] px-4 rounded-[14px] bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold hover:bg-[#F8FAFC] items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
          }
        />
      }
    >
      <Grid cols={{ base: 2, lg: 4 }}>
        {kpis.map((kpi, idx) => (
          <Card key={idx} padding="p-[16px_18px]">
            <Eyebrow>{kpi.label}</Eyebrow>
            <span className="text-[26px] font-extrabold tracking-[-0.03em] text-[#0F172A] block mt-1 leading-none">{kpi.value}</span>
          </Card>
        ))}
      </Grid>

      <Card padding="p-0" className="overflow-hidden border border-[#E2E8F0] bg-white">
        <ResponsiveTable<Client>
          caption="Clients"
          rows={pageClients}
          rowKey={(c) => c.id}
          rowLabel={(c) => c.name}
          columns={columns}
          rowHref={(c) => `/dashboard/clients/${c.id}`}
          LinkComponent={RouterLink}
          sort={sort}
          onSortChange={setSort}
          filter={{ placeholder: 'Search clients', query: searchQuery, onQueryChange: onSearch }}
          empty="No clients yet."
          footer={
            <div className="p-[14px_22px] bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-[#94A3B8] font-medium">
                {sortedClients.length === 0
                  ? `No clients${q ? ' match that search' : ' yet'}`
                  : `Showing ${pageStart + 1}–${pageStart + pageClients.length} of ${sortedClients.length}${
                      sortedClients.length !== clients.length ? ` (filtered from ${clients.length})` : ''
                    }`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="h-[30px] px-3 rounded-[9px] bg-white border border-[#E2E8F0] text-xs font-bold text-[#475569] flex items-center gap-1 hover:bg-[#F8FAFC] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(lastPage, currentPage + 1))}
                  disabled={currentPage >= lastPage}
                  className="h-[30px] px-3 rounded-[9px] bg-white border border-[#E2E8F0] text-xs font-bold text-[#475569] flex items-center gap-1 hover:bg-[#F8FAFC] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          }
        />
      </Card>
```

2. Replace the final `</div>` before `);` with `</Page>`. The add-client modal stays inside `Page`; it is a `fixed` overlay.
3. In the add-client modal, change both `<div className="grid grid-cols-2 gap-3">` to `<Grid cols={{ base: 1, sm: 2 }} gap="sm">`, with their closing `</div>`s becoming `</Grid>`.
4. Remove `Search` from the `lucide-react` import if nothing else uses it: `grep -n "Search" src/pages/practice/ClientsPage.tsx`.

- [ ] **Step 5: Run the tests and typecheck**

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/pages/__tests__/ClientsPage.test.tsx && pnpm --filter @unclutterdesk/app typecheck`
Expected: PASS.

`names()` reads the row links. Each row's first cell holds one link, and its text includes the client's name and email. That is why the tests use `toContain`.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/pages/practice/ClientsPage.tsx apps/app/src/pages/__tests__/ClientsPage.test.tsx
git commit -m "Move the clients list onto the shared table: search on phones, sort across every page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Team list

**Files:**
- Modify: `apps/app/src/pages/practice/settings/TeamSettingsPage.tsx` (imports, and the layout from `return (` at about line 199 to `</main>` at about line 377)
- Modify: `apps/app/src/pages/__tests__/TeamSettingsPage.test.tsx` (one new test)

**Interfaces:**
- Consumes: `Page`, `PageHeader`, `ResponsiveTable`, `Column` and `byText` from `@unclutterdesk/ui`.

- [ ] **Step 1: Confirm the test runs against the real package**

Task 3 moved this test onto `renderWithApp` and removed its fakes.

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/pages/__tests__/TeamSettingsPage.test.tsx`
Expected: PASS against the unchanged page.

- [ ] **Step 2: Add a failing test for the new layout** (append to the file's top-level `describe`, using its existing render helper; check its name with `grep -n "function render\|const render" src/pages/__tests__/TeamSettingsPage.test.tsx`)

```tsx
  it('fits the page, as a table with each member’s switch and menu shown once', () => {
    const { container } = renderPage();
    expect(container.innerHTML).not.toContain('min-w-[1192px]');
    expect(screen.getByRole('table', { name: 'Team members' })).toBeTruthy();
    expect(screen.getAllByLabelText('Segun Ade active')).toHaveLength(1);
    expect(screen.getAllByLabelText('Actions for Segun Ade')).toHaveLength(1);
  });
```

Run it. Expected: FAIL, the page still carries `min-w-[1192px]`.

- [ ] **Step 3: Implement**

1. Change the imports: `import { Eyebrow, Card, StatusBadge, Button, useToast, Page, PageHeader, ResponsiveTable, byText, type Column } from '@unclutterdesk/ui';`. Keep the separate `useBrand` import as it is.
2. Just before `return (`, add the three cell renderers and the columns. The JSX is the page's existing markup, moved into functions:

```tsx
  const memberCell = (m: StaffMember) => (
    <div className="flex items-center gap-3 min-w-0">
      <div className={`h-[40px] w-[40px] rounded-[13px] font-extrabold text-[13.5px] flex items-center justify-center border shrink-0 ${
        m.role === 'OWNER'
          ? 'bg-gradient-to-br from-[#1B5375] to-[#0F3A53] text-[#E3B341] border-[#E3B341]/30'
          : 'bg-[#F1F5F9] text-[#0F3A53] border-slate-200'
      }`}>
        {m.initials}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-bold text-[#0F172A] leading-tight truncate">{m.name}</h3>
          {m.pending && (
            <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {m.invitedAt ? `INVITED ${formatDate(m.invitedAt)}` : 'INVITE PENDING'}
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-[#64748B] font-medium truncate">{m.title}</p>
      </div>
    </div>
  );

  const statusCell = (m: StaffMember) =>
    m.pending ? (
      // Nothing to switch on: there is no account until the invitation is claimed.
      <span className="text-[11.5px] font-bold text-amber-700">
        {m.expiresAt ? `Expires ${formatDate(m.expiresAt)}` : 'Awaiting acceptance'}
      </span>
    ) : (
      <button
        type="button"
        role="switch"
        aria-checked={m.status === 'Active'}
        aria-label={`${m.name} active`}
        onClick={() => toggleStaffStatus(m)}
        disabled={m.role === 'OWNER' || statusPendingId !== null}
        className={`w-[40px] h-[22px] rounded-full p-[2px] transition-colors block ${
          m.status === 'Active' ? 'bg-[#15803D]' : 'bg-[#E2E8F0]'
        } ${m.role === 'OWNER' || statusPendingId !== null ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className={`w-[18px] h-[18px] rounded-full bg-white shadow-xs transition-transform ${m.status === 'Active' ? 'translate-x-[18px]' : 'translate-x-0'}`} />
      </button>
    );

  const roleCell = (m: StaffMember) => (
    <span
      className="h-6 px-2.5 rounded-full text-[10px] font-black tracking-wider uppercase inline-flex items-center"
      style={{
        backgroundColor: m.role === 'OWNER' ? '#0F172A' : m.role === 'ADMIN' ? '#EFF6FB' : '#F1F5F9',
        color: m.role === 'OWNER' ? '#E3B341' : m.role === 'ADMIN' ? '#0F3A53' : '#475569',
      }}
    >
      {m.role}
    </span>
  );

  // Status stays in view with the member: it is a switch people use, not a detail.
  const columns: Column<StaffMember>[] = [
    { key: 'member', header: 'Member', cell: memberCell, sort: byText((m) => m.name) },
    { key: 'status', header: 'Status', cell: statusCell },
    { key: 'role', header: 'Role', priority: 'md', cell: roleCell, sort: byText((m) => m.role) },
    { key: 'email', header: 'Email', priority: 'lg', cell: (m) => <span className="text-[13px] font-medium text-[#475569]">{m.email}</span>, sort: byText((m) => m.email) },
  ];
```

3. Replace everything from `<div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">` through `<main className="p-[24px_26px_30px] flex-1">` with:

```tsx
    <Page
      header={
        <PageHeader
          eyebrow="SETTINGS"
          title="Team & staff roster"
          actions={
            <button
              onClick={() => setInviteModalOpen(true)}
              className="os-brand-btn h-[44px] px-5 rounded-[14px] font-bold text-xs flex items-center gap-2 cursor-pointer text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <UserPlus className="h-4 w-4" />
              <span>Invite staff member</span>
            </button>
          }
        />
      }
    >
      {/* Claimed a Group Clinic plan and a ten-seat limit to every practice,
          including one on the free plan that cannot invite anyone. The count
          is the part that was true. */}
      <p className="text-xs text-[#64748B] font-medium -mt-1">
        {memberCount} {memberCount === 1 ? 'team member' : 'team members'}
        {pendingCount > 0 && `, ${pendingCount} invited`}
      </p>
```

4. Keep the `statusError` and `rosterNotice` alerts as they are, but remove their `mb-4`, because `Page` spaces its children.
5. Replace the whole staff card, from `{/* Staff Table */}` through its closing `</Card>`, with the code below. The `actions` function body is the page's existing actions cell, moved unchanged: the `<div className="text-right relative">` with the `Actions for …` button and its dropdown menu.

```tsx
        <Card padding="p-0" className="border border-[#E2E8F0] relative bg-white">
          <ResponsiveTable<StaffMember>
            caption="Team members"
            rows={staff}
            rowKey={(m) => m.id}
            rowLabel={(m) => m.name}
            columns={columns}
            empty="No team members yet."
            actions={(m) => (
              <div className="text-right relative">
                <button
                  onClick={() => setActiveMenuId(activeMenuId === m.id ? null : m.id)}
                  aria-label={`Actions for ${m.name}`}
                  className="h-8 w-8 rounded-[9px] hover:bg-[#F1F5F9] text-[#64748B] flex items-center justify-center ml-auto cursor-pointer"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {activeMenuId === m.id && (
                  <div className="absolute right-0 top-10 w-44 bg-white rounded-[14px] shadow-xl border border-slate-200 py-1 z-30 text-left">
                    {m.pending ? (
                      <>
                        <button
                          onClick={() => { void resendInvite(m); setActiveMenuId(null); }}
                          disabled={invitePendingId !== null}
                          className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          <span>Send invitation again</span>
                        </button>
                        <button
                          onClick={() => { void revokeInvite(m); setActiveMenuId(null); }}
                          disabled={invitePendingId !== null}
                          className="w-full px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 text-left disabled:opacity-50"
                        >
                          Withdraw invitation
                        </button>
                      </>
                    ) : m.role === 'OWNER' ? (
                      <p className="px-3 py-2 text-xs font-medium text-slate-500">The owner cannot be deactivated.</p>
                    ) : (
                      <button
                        onClick={() => { void toggleStaffStatus(m); setActiveMenuId(null); }}
                        disabled={statusPendingId !== null}
                        className="w-full px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 text-left disabled:opacity-50"
                      >
                        {m.status === 'Active' ? 'Deactivate Member' : 'Activate Member'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          />
        </Card>
```

   Keep any explanatory comments that sat inside the old actions cell above the `{m.pending ? (` line.

   The card loses `overflow-hidden`: the row menu is absolutely positioned and would otherwise be clipped at the bottom row.
6. Replace the `</main>` after the card with nothing. Replace the final `</div>` before `);` with `</Page>`. The invite modal stays inside `Page`.
7. If the invite modal has a bare `grid grid-cols-2`, make it `<Grid cols={{ base: 1, sm: 2 }} gap="sm">` and add `Grid` to the import. Check with `grep -n "grid-cols-2" src/pages/practice/settings/TeamSettingsPage.tsx`.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/pages/__tests__/TeamSettingsPage.test.tsx && pnpm --filter @unclutterdesk/app typecheck`
Expected: PASS, the new test and every existing one: the switch, the menu, the owner rules and invites.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/practice/settings/TeamSettingsPage.tsx apps/app/src/pages/__tests__/TeamSettingsPage.test.tsx
git commit -m "Move the team list onto the shared page and table; stop forcing 1192px

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Discount codes

**Files:**
- Modify: `apps/app/src/pages/practice/settings/DiscountSettingsPage.tsx` (imports at line 3, the layout from `return (` at about line 108 to `</main>` at about line 210, and the modal grid at about line 239)

**Interfaces:**
- Consumes: `Page`, `PageHeader`, `Grid`, `ResponsiveTable`, `Column`, `byText`, `byNumber` and `byDate` from `@unclutterdesk/ui`.

- [ ] **Step 1: Imports and columns**

Line 3 becomes:

```tsx
import { Eyebrow, useBrand, useToast, Page, PageHeader, Grid, ResponsiveTable, byDate, byNumber, byText, type Column } from '@unclutterdesk/ui';
```

Just before `return (`, add:

```tsx
  const statusOf = (d: DiscountCode) => {
    const expired = Boolean(d.expiresAt && new Date(d.expiresAt) < new Date());
    const exhausted = Boolean(d.maxUses && d.usedCount >= d.maxUses);
    if (d.isActive && !expired && !exhausted) return 'Active';
    return !d.isActive ? 'Inactive' : expired ? 'Expired' : 'Depleted';
  };
  const valueOf = (d: DiscountCode) =>
    d.discountType === 'PERCENT' ? `${d.discountPercent}% OFF` : `₦${(parseInt(d.discountAmountKobo || '0', 10) / 100).toLocaleString()} OFF`;

  const columns: Column<DiscountCode>[] = [
    {
      key: 'code',
      header: 'Code',
      sort: byText((d) => d.code),
      cell: (d) => (
        <>
          <div className="text-[13px] font-bold text-[#0F172A] tracking-wide">{d.code}</div>
          {d.label && <div className="text-[11px] text-slate-500 mt-0.5">{d.label}</div>}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sort: byText(statusOf),
      cell: (d) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
          statusOf(d) === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {statusOf(d)}
        </span>
      ),
    },
    { key: 'value', header: 'Value', priority: 'md', cell: (d) => <span className="text-[13px] font-bold text-[#0F3A53]">{valueOf(d)}</span> },
    {
      key: 'usage',
      header: 'Usage',
      priority: 'md',
      sort: byNumber((d) => d.usedCount),
      cell: (d) => <span className="text-[12px] font-medium text-slate-600">{d.usedCount} {d.maxUses ? `/ ${d.maxUses}` : 'uses'}</span>,
    },
    {
      key: 'expiry',
      header: 'Expiry',
      priority: 'lg',
      sort: byDate((d) => d.expiresAt ?? null),
      cell: (d) => <span className="text-[12px] font-medium text-slate-600">{d.expiresAt ? new Date(d.expiresAt).toLocaleDateString('en-GB') : 'Never'}</span>,
    },
  ];
```

- [ ] **Step 2: Replace the layout**

1. Replace everything from `<div className="flex-1 min-w-[1192px] flex flex-col bg-[#F8FAFC]">` through `<main className="p-[24px_26px_30px] space-y-6 flex-1">` with:

```tsx
    <Page
      header={
        <PageHeader
          eyebrow="SETTINGS"
          title="Discounts & Promos"
          actions={
            <button
              onClick={() => setShowModal(true)}
              className="h-10 px-4 rounded-[12px] text-white text-xs font-bold flex items-center gap-2 hover:brightness-110 transition-all cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="h-4 w-4" />
              Create Code
            </button>
          }
        />
      }
    >
      <p className="text-xs text-[#64748B] font-medium -mt-1">Manage promotional codes and discounts for your practice.</p>
```

2. Keep the error alert, the loading block and the empty-state block exactly as they are.
3. Replace the table branch, from `<div className="rounded-[24px] border border-[#E2E8F0] bg-white overflow-hidden">` to its closing `</div>` after `</table>`, with:

```tsx
          <div className="rounded-[24px] border border-[#E2E8F0] bg-white overflow-hidden">
            <ResponsiveTable<DiscountCode>
              caption="Discount codes"
              rows={discounts}
              rowKey={(d) => d.id}
              rowLabel={(d) => d.code}
              columns={columns}
              empty="No discount codes."
              filter={{ placeholder: 'Search codes', match: (d, q) => [d.code, d.label ?? ''].some((v) => v.toLowerCase().includes(q)) }}
              actions={(d) =>
                d.isActive ? (
                  <button
                    onClick={() => handleToggleStatus(d.id, d.isActive)}
                    className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer inline-flex p-1.5"
                    title="Deactivate code"
                    aria-label={`Deactivate ${d.code}`}
                  >
                    <PowerOff className="h-4 w-4" />
                  </button>
                ) : null
              }
            />
          </div>
```

4. Replace `</main>` with nothing, and the final `</div>` before `);` with `</Page>`.
5. In the create modal, change `<div className="grid grid-cols-2 gap-4">` to `<Grid cols={{ base: 1, sm: 2 }}>`, and its closing `</div>` to `</Grid>`.

- [ ] **Step 3: Typecheck and test**

Run: `pnpm --filter @unclutterdesk/app typecheck && pnpm --filter @unclutterdesk/app test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/pages/practice/settings/DiscountSettingsPage.tsx
git commit -m "Move discount codes onto the shared page and table; stop forcing 1192px

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Hold the four pages to the rules, verify, and ship

**Files:**
- Modify: `apps/app/src/test/layout-rules.test.ts` (`MIGRATED`)
- Modify: `apps/app/scripts/check-layout.mjs` (`STRICT` and `REPORT`)

- [ ] **Step 1: Add the pages to the rule check**

In `layout-rules.test.ts`, change `MIGRATED` to:

```ts
const MIGRATED = [
  'pages/practice/ClientDetailPage.tsx',
  'pages/practice/AnalyticsPage.tsx',
  'pages/practice/DashboardPage.tsx',
  'pages/practice/HoursLogPage.tsx',
  'pages/practice/ClientsPage.tsx',
  'pages/practice/settings/TeamSettingsPage.tsx',
  'pages/practice/settings/DiscountSettingsPage.tsx',
];
```

Run: `pnpm --filter @unclutterdesk/app exec vitest run src/test/layout-rules.test.ts`

Expected: PASS for all seven. If one fails, the message names the class; fix it in the page:
- a bare `grid-cols-N` becomes `Grid`;
- a page-width wrapper is removed.

- [ ] **Step 2: Make their layout checks strict**

In `scripts/check-layout.mjs`:

```js
const STRICT = [
  '/dashboard', '/dashboard/analytics', 'CLIENT',
  '/dashboard/clients', '/dashboard/hours', '/dashboard/settings/team', '/dashboard/settings/discounts',
];
const REPORT = [
  '/dashboard/schedule', '/dashboard/submissions', '/dashboard/notifications', '/dashboard/profile',
  '/dashboard/settings/account', '/dashboard/settings/availability',
];
```

- [ ] **Step 3: Run everything**

Run: `pnpm --recursive run typecheck && pnpm --filter @unclutterdesk/api test && pnpm --filter @unclutterdesk/ui test && pnpm --filter @unclutterdesk/app test && pnpm --filter @unclutterdesk/app build`
Expected: all pass, and the build succeeds.

Run: `grep -o '@container table (min-width:640px)' apps/app/dist/assets/*.css | head -1`
Expected: a match, which shows the table's container queries were generated.

- [ ] **Step 4: Layout check**

1. Start the API (`cd apps/api && npx nest build && PORT=3099 node dist/src/main.js`) and the app (`cd apps/app && VITE_API_URL=http://localhost:3099 npx vite --port 5173 --strictPort`).
2. Run `pnpm --filter @unclutterdesk/app check:layout`. Set `CHROME_PATH` to the Chrome for Testing binary under `~/Library/Caches/ms-playwright/` if Playwright's browser is not installed.

Expected: every STRICT line shows ✓, and the exit code is 0.

3. By hand at 390px, as `dr.jane@smiththerapy.ng`:
   - Hours log: open a row;
   - Clients: search, sort by name, page forward;
   - Team: flip a switch, and open a row menu on the last row, which must not be clipped;
   - Discounts: open a row.

   At 1280px the tables should look as they did, with a sort arrow on sortable headers.
4. Stop the servers.

- [ ] **Step 5: Commit, push, and describe**

```bash
git add apps/app/src/test/layout-rules.test.ts apps/app/scripts/check-layout.mjs
git commit -m "Hold the hours, clients, team and discount pages to the layout rules at every width

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin dev
```

**If a dev→main PR is open (Task 0):** add this section to its description with `gh pr edit <number> --body-file <file>`, keeping everything already there:

```markdown
## 5. Responsive layout, part 2: a shared table
- `ResponsiveTable` in `packages/ui`: a real table that keeps its key columns on narrow screens and opens each row to show the rest; sortable headers (with a "Sort by" list on phones) and a search box, run by the table or by the page.
- Hours log, clients list, team list and discount codes now use it, and sit on the shared `Page`. Team and Discounts no longer force 1192px, and the clients search now works on phones (it was hidden there).
- All four pages are held to the layout rules and the strict layout check at 390, 820, 1024 and 1280px.
```

**If none is open:**

```bash
gh pr create --base main --head dev --title "Responsive layout, part 2: shared table on hours, clients, team and discounts" --body "$(cat <<'EOF'
## What
- `ResponsiveTable` in `packages/ui`: a real table that keeps its key columns on narrow screens and opens each row to show the rest. Headers sort (with a "Sort by" list on phones), and a search box can be run by the table or by the page.
- Hours log, clients list, team list and discount codes use it, and sit on the shared `Page`. Team and Discounts no longer force 1192px, and the clients search now works on phones.
- All four pages are held to the layout rules and to the strict layout check at 390, 820, 1024 and 1280px.

## Checks
- Package, app and API tests pass; every package typechecks; the build contains the table's container queries.
- `pnpm --filter @unclutterdesk/app check:layout` passes for every strict route.

Spec: `docs/superpowers/specs/2026-09-28-responsive-layout-shared-components-design.md` (PR 2).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
