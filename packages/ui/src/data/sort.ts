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
