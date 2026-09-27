import { describe, expect, it } from 'vitest';
import { csvCell, hoursCsv, hoursText, initialsOf, totalsOf } from './hours-format';

describe('totalsOf', () => {
  it('adds minutes by category and separates client and supervision time', () => {
    const t = totalsOf([
      { durationMinutes: 50, category: 'DIRECT_CLIENT' },
      { durationMinutes: 90, category: 'GROUP' },
      { durationMinutes: 60, category: 'SUPERVISION' },
      { durationMinutes: 30, category: 'something-old' },
    ]);
    expect(t.totalMinutes).toBe(230);
    expect(t.clientMinutes).toBe(140);
    expect(t.supervisionMinutes).toBe(60);
    expect(t.byCategory.OTHER).toBe(30);
  });
});

describe('initialsOf', () => {
  it.each([
    ['Adaeze Okonkwo', 'A.O.'],
    ['  mary  jane  watson  smith ', 'M.J.W.'],
    ['', ''],
    [null, ''],
  ])('%s → %s', (name, expected) => expect(initialsOf(name as any)).toBe(expected));
});

describe('hoursText', () => {
  it.each([
    [60, '1'],
    [50, '0.83'],
    [90, '1.5'],
    [0, '0'],
  ])('%i minutes → %s', (m, expected) => expect(hoursText(m)).toBe(expected));
});

describe('csvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
  });

  it('defuses spreadsheet formulas in free text', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });
});

describe('hoursCsv', () => {
  const rows = [
    {
      date: new Date('2026-09-01T10:00:00Z'),
      durationMinutes: 50,
      category: 'DIRECT_CLIENT',
      source: 'BOOKING',
      clientName: 'Adaeze Okonkwo',
      notes: null,
      supervisorName: null,
    },
    {
      date: new Date('2026-09-02T10:00:00Z'),
      durationMinutes: 60,
      category: 'SUPERVISION',
      source: 'MANUAL',
      clientName: null,
      notes: 'Group supervision, case review',
      supervisorName: 'Dr. Bello',
    },
  ];

  it('uses initials unless full names are asked for', () => {
    const csv = hoursCsv(rows);
    expect(csv.startsWith('﻿Date,Client,Category,Minutes,Hours,Source,Supervisor,Notes\r\n')).toBe(true);
    expect(csv).toContain('2026-09-01,A.O.,Direct client work,50,0.83,Session,,');
    expect(csv).not.toContain('Adaeze');
    expect(hoursCsv(rows, { fullNames: true })).toContain('Adaeze Okonkwo');
  });

  it('writes manual entries with supervisor and notes', () => {
    expect(hoursCsv(rows)).toContain('2026-09-02,,Supervision,60,1,Manual,Dr. Bello,"Group supervision, case review"');
  });
});
