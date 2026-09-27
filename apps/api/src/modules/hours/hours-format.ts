/**
 * Pure helpers for the hours log: categories, totals and the CSV export.
 * Kept free of Nest and Prisma so they are easy to test.
 */

export const HOURS_CATEGORIES = ['DIRECT_CLIENT', 'GROUP', 'SUPERVISION', 'INDIRECT', 'OTHER'] as const;
export type HoursCategory = (typeof HOURS_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<HoursCategory, string> = {
  DIRECT_CLIENT: 'Direct client work',
  GROUP: 'Group work',
  SUPERVISION: 'Supervision',
  INDIRECT: 'Indirect (notes, prep, training)',
  OTHER: 'Other',
};

export function isHoursCategory(value: unknown): value is HoursCategory {
  return typeof value === 'string' && (HOURS_CATEGORIES as readonly string[]).includes(value);
}

export interface HoursRow {
  date: Date;
  durationMinutes: number;
  category: string;
  source: string;
  clientName: string | null;
  notes: string | null;
  supervisorName: string | null;
}

export interface HoursTotals {
  totalMinutes: number;
  /** Direct and group client work: what most bodies count as client hours. */
  clientMinutes: number;
  supervisionMinutes: number;
  byCategory: Record<HoursCategory, number>;
}

export function totalsOf(rows: Array<Pick<HoursRow, 'durationMinutes' | 'category'>>): HoursTotals {
  const byCategory = Object.fromEntries(HOURS_CATEGORIES.map((c) => [c, 0])) as Record<HoursCategory, number>;
  let totalMinutes = 0;
  for (const row of rows) {
    const category = isHoursCategory(row.category) ? row.category : 'OTHER';
    byCategory[category] += row.durationMinutes;
    totalMinutes += row.durationMinutes;
  }
  return {
    totalMinutes,
    clientMinutes: byCategory.DIRECT_CLIENT + byCategory.GROUP,
    supervisionMinutes: byCategory.SUPERVISION,
    byCategory,
  };
}

/** "Adaeze Okonkwo" → "A.O."; the log leaves the clinic, so names are initials by default. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return parts
    .slice(0, 3)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join('');
}

export function hoursText(minutes: number): string {
  return (minutes / 60).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

/**
 * One CSV cell. Quotes when needed, and defuses values a spreadsheet would
 * run as a formula (=, +, -, @), since notes are free text.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function hoursCsv(rows: HoursRow[], { fullNames = false }: { fullNames?: boolean } = {}): string {
  const header = ['Date', 'Client', 'Category', 'Minutes', 'Hours', 'Source', 'Supervisor', 'Notes'];
  const lines = rows.map((r) =>
    [
      isoDate(r.date),
      fullNames ? r.clientName ?? '' : initialsOf(r.clientName),
      isHoursCategory(r.category) ? CATEGORY_LABEL[r.category] : r.category,
      r.durationMinutes,
      hoursText(r.durationMinutes),
      r.source === 'BOOKING' ? 'Session' : 'Manual',
      r.supervisorName ?? '',
      r.notes ?? '',
    ]
      .map(csvCell)
      .join(','),
  );
  // A BOM makes Excel read the file as UTF-8 (names with accents).
  return `﻿${[header.join(','), ...lines].join('\r\n')}\r\n`;
}
