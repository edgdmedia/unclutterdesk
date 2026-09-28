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
