import { describe, expect, it } from 'vitest';
import { canContinue, initialState, stepFromUrl, wizardReducer as r } from '../bookingWizard';

const s0 = initialState({});
const withTime = [
  { type: 'chooseService', serviceId: 's1' },
  { type: 'next' },
  { type: 'chooseDate', date: '2026-10-06' },
  { type: 'chooseSlot', slotId: 't1' },
].reduce((s, a) => r(s, a as any), s0);

describe('booking wizard', () => {
  it('starts on the service step, or on time when the practice has one service', () => {
    expect(s0.step).toBe(1);
    const single = initialState({ singleServiceId: 's1' });
    expect(single.step).toBe(2);
    expect(single.serviceId).toBe('s1');
  });

  it('only continues once the step is complete', () => {
    expect(canContinue(s0, false)).toBe(false);
    expect(canContinue(r(s0, { type: 'chooseService', serviceId: 's1' }), false)).toBe(true);
    expect(canContinue({ ...withTime, step: 2, slotId: null }, false)).toBe(false);
    expect(canContinue(withTime, false)).toBe(true);
    expect(canContinue({ ...withTime, step: 3 }, false)).toBe(false);
    expect(canContinue({ ...withTime, step: 3 }, true)).toBe(true);
  });

  it('changing the service clears the time and resets the filter', () => {
    const s = r({ ...withTime, formatFilter: 'Online' }, { type: 'chooseService', serviceId: 's2' });
    expect(s.slotId).toBeNull();
    expect(s.formatFilter).toBe('All');
  });

  it('changing the day clears the time', () => {
    expect(r(withTime, { type: 'chooseDate', date: '2026-10-07' }).slotId).toBeNull();
  });

  it('Back keeps every earlier choice, and never goes before the first step', () => {
    const back = r({ ...withTime, step: 3 }, { type: 'back' });
    expect(back.step).toBe(2);
    expect(back.slotId).toBe('t1');
    expect(back.serviceId).toBe('s1');
    expect(r(s0, { type: 'back' }).step).toBe(1);
    expect(r(initialState({ singleServiceId: 's1' }), { type: 'back' }).step).toBe(2);
  });

  it('a taken slot sends the client back to times with the banner and no time chosen', () => {
    const s = r({ ...withTime, step: 4 }, { type: 'slotTaken' });
    expect(s.step).toBe(2);
    expect(s.slotId).toBeNull();
    expect(s.slotTaken).toBe(true);
    expect(r(s, { type: 'chooseSlot', slotId: 't2' }).slotTaken).toBe(false);
  });

  it('a failed payment stays on pay, keeping the booking so a retry reuses it', () => {
    const booked = r({ ...withTime, step: 4 }, { type: 'booked', bookingId: '900' });
    const failed = r(booked, { type: 'paymentFailed' });
    expect(failed.step).toBe(4);
    expect(failed.paymentStatus).toBe('failed');
    expect(failed.bookingId).toBe('900');
    expect(r(failed, { type: 'paid' }).step).toBe(5);
  });

  it('jumps back to a finished step but not ahead', () => {
    expect(r({ ...withTime, step: 3 }, { type: 'goTo', step: 1 }).step).toBe(1);
    expect(r(s0, { type: 'goTo', step: 3 }).step).toBe(1);
  });

  it('restores a step from the URL only when its earlier steps are complete', () => {
    expect(stepFromUrl('pay', withTime)).toBe(3);
    expect(stepFromUrl('time', s0)).toBe(1);
    expect(stepFromUrl('nonsense', withTime)).toBe(withTime.step);
  });
});
