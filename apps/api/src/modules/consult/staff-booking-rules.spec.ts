import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { paidAmount, parseStaffPayment, paymentsAllowed, staffLinkHold } from './staff-booking-rules';

describe('the hold on a payment link', () => {
  const now = new Date('2026-10-01T09:00:00Z');
  it('lasts 48 hours for a session well ahead', () => {
    expect(staffLinkHold(now, new Date('2026-10-10T09:00:00Z'))?.toISOString()).toBe('2026-10-03T09:00:00.000Z');
  });
  it('ends 2 hours before a session that is sooner', () => {
    expect(staffLinkHold(now, new Date('2026-10-02T09:00:00Z'))?.toISOString()).toBe('2026-10-02T07:00:00.000Z');
  });
  it('is impossible for a session under 2 hours away', () => {
    expect(staffLinkHold(now, new Date('2026-10-01T10:30:00Z'))).toBeNull();
  });
});

describe('who may choose which payment', () => {
  it('front desk and admins may use all three', () => {
    for (const role of ['OWNER', 'ADMIN', 'RECEPTIONIST']) expect(paymentsAllowed(role)).toEqual(['LINK', 'PAID', 'NONE']);
  });
  it('a therapist may send a link or waive, not mark paid', () => {
    expect(paymentsAllowed('THERAPIST')).toEqual(['LINK', 'NONE']);
  });
  it('a client may not use any', () => {
    expect(paymentsAllowed('CLIENT')).toEqual([]);
  });
});

describe('reading the payment choice', () => {
  it('accepts the three values in any case', () => {
    expect(parseStaffPayment('link')).toBe('LINK');
    expect(parseStaffPayment('PAID')).toBe('PAID');
    expect(parseStaffPayment('None')).toBe('NONE');
  });
  it('refuses anything else', () => {
    expect(() => parseStaffPayment('FREE')).toThrow(BadRequestException);
    expect(() => parseStaffPayment(undefined)).toThrow(BadRequestException);
  });
});

describe('the amount recorded as paid', () => {
  it('defaults to the service price', () => {
    expect(paidAmount(undefined, 2500000n)).toBe(2500000n);
    expect(paidAmount('', 2500000n)).toBe(2500000n);
  });
  it('takes a smaller amount staff actually received', () => {
    expect(paidAmount('2000000', 2500000n)).toBe(2000000n);
  });
  it('refuses more than the price, and non-numbers', () => {
    expect(() => paidAmount('3000000', 2500000n)).toThrow(BadRequestException);
    expect(() => paidAmount('12.5', 2500000n)).toThrow(BadRequestException);
  });
});
