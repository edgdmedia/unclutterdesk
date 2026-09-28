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
