import { describe, expect, it, afterEach } from 'vitest';
import React, { useReducer } from 'react';
import { cleanup, fireEvent, renderWithApp, screen } from '../../../../test/renderWithApp';
import { TimeStep } from '../TimeStep';
import { initialState, wizardReducer, type WizardState } from '../bookingWizard';
import type { Slot } from '../bookingSlots';

afterEach(cleanup);

const today = new Date('2026-10-01T08:00:00Z');
const service = { id: '2', title: 'Individual therapy', durationMinutes: 50, priceKobo: '3500000' };
const s = (id: string, startsAt: string, channel = 'VIDEO'): Slot => ({ id, serviceId: null, therapistName: 'Sarah Smith', startsAt, endsAt: startsAt, channel });

function Harness({ slots, start, address = null }: { slots: Slot[]; start?: Partial<WizardState>; address?: string | null }) {
  const [state, dispatch] = useReducer(wizardReducer, { ...initialState({}), serviceId: '2', step: 2, ...start } as WizardState);
  return (
    <TimeStep
      service={service}
      slots={slots}
      today={today}
      state={state}
      dispatch={dispatch}
      practiceAddress={address}
      practiceContact={{ email: 'hi@smith.ng', phone: '0801 234 5678' }}
      singleService={false}
      onChangeService={() => {}}
    />
  );
}

describe('TimeStep', () => {
  it('pages through four weeks', () => {
    renderWithApp(<Harness slots={[s('a', '2026-10-06T10:30:00Z')]} />);
    expect(screen.getByText('1 Oct – 7 Oct')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Previous week' }) as HTMLButtonElement).disabled).toBe(true);
    const next = screen.getByRole('button', { name: 'Next week' });
    fireEvent.click(next);
    expect(screen.getByText('8 Oct – 14 Oct')).toBeTruthy();
    fireEvent.click(next);
    fireEvent.click(next);
    expect((next as HTMLButtonElement).disabled).toBe(true);
  });

  it('only lets the client pick days with times, and lists their times with the format', () => {
    renderWithApp(<Harness slots={[s('a', '2026-10-06T10:30:00Z')]} />);
    expect((screen.getByRole('button', { name: /Fri, 2 Oct/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Tue, 6 Oct/ }));
    const time = screen.getByRole('button', { name: /11:30 AM/ });
    expect(time.textContent).toContain('Online');
    fireEvent.click(time);
    expect(time.getAttribute('aria-pressed')).toBe('true');
  });

  it('offers a format filter only when the day has both', () => {
    renderWithApp(<Harness slots={[s('a', '2026-10-06T08:00:00Z'), s('b', '2026-10-06T12:00:00Z', 'IN_PERSON')]} start={{ date: '2026-10-06' }} />);
    fireEvent.click(screen.getByRole('tab', { name: 'In person' }));
    expect(screen.queryByRole('button', { name: /9:00 AM/ })).toBeNull();
    expect(screen.getByRole('button', { name: /1:00 PM/ })).toBeTruthy();
    cleanup();
    renderWithApp(<Harness slots={[s('a', '2026-10-06T08:00:00Z')]} start={{ date: '2026-10-06' }} />);
    expect(screen.queryByRole('tab', { name: 'In person' })).toBeNull();
  });

  it('shows the address once an in-person time is picked', () => {
    renderWithApp(<Harness slots={[s('b', '2026-10-06T12:00:00Z', 'IN_PERSON')]} start={{ date: '2026-10-06' }} address="14 Admiralty Way, Lekki Phase 1, Lagos" />);
    fireEvent.click(screen.getByRole('button', { name: /1:00 PM/ }));
    expect(screen.getByText('In person at the practice')).toBeTruthy();
    expect(screen.getByText('14 Admiralty Way, Lekki Phase 1, Lagos')).toBeTruthy();
  });

  it('points to the next free day when this week has none', () => {
    renderWithApp(<Harness slots={[s('a', '2026-10-13T09:00:00Z')]} />);
    expect(screen.getByText('No times this week')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Tue, 13 Oct →' }));
    expect(screen.getByText('8 Oct – 14 Oct')).toBeTruthy();
    expect(screen.getByRole('button', { name: /10:00 AM/ })).toBeTruthy();
  });

  it('gives the practice contact details when nothing is free for four weeks', () => {
    renderWithApp(<Harness slots={[]} />);
    expect(screen.getByText('No free times in the next 4 weeks')).toBeTruthy();
    expect(screen.getByRole('link', { name: /hi@smith.ng/ })).toBeTruthy();
  });

  it('explains when the chosen time was just taken', () => {
    renderWithApp(<Harness slots={[s('a', '2026-10-06T10:30:00Z')]} start={{ slotTaken: true, date: '2026-10-06' }} />);
    expect(screen.getByText('That time was just booked')).toBeTruthy();
    expect(screen.getByText(/Nothing has been charged/)).toBeTruthy();
  });
});
