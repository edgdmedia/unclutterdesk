import { describe, expect, it } from 'vitest';
import { lagosDayStart, lagosMonthStart, lagosTomorrowStart } from './lagos-time';

describe('Lagos time', () => {
  it('counts 00:30 on the 1st in Lagos as the new month, though it is still the 31st in UTC', () => {
    expect(lagosMonthStart(new Date('2026-10-31T23:30:00Z')).toISOString()).toBe('2026-10-31T23:00:00.000Z');
  });

  it('counts 23:30 on the 31st in Lagos as the old month', () => {
    expect(lagosMonthStart(new Date('2026-10-31T22:30:00Z')).toISOString()).toBe('2026-09-30T23:00:00.000Z');
  });

  it('crosses the year correctly', () => {
    expect(lagosMonthStart(new Date('2027-01-01T00:10:00Z')).toISOString()).toBe('2026-12-31T23:00:00.000Z');
  });

  it('starts today and tomorrow at Lagos midnight', () => {
    const now = new Date('2026-11-05T23:30:00Z'); // 00:30 on the 6th in Lagos
    expect(lagosDayStart(now).toISOString()).toBe('2026-11-05T23:00:00.000Z');
    expect(lagosTomorrowStart(now).toISOString()).toBe('2026-11-06T23:00:00.000Z');
  });
});
