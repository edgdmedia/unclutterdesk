import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SlotDayPicker } from '../booking/SlotDayPicker';

/** Open times as a row of days, then only the chosen day's times. */
const at = (day: number, hourUtc: number) => new Date(Date.UTC(2026, 11, day, hourUtc)).toISOString();
const SLOTS = [
  { id: 'b', startsAt: at(2, 9) },
  { id: 'a', startsAt: at(1, 8) },
  { id: 'c', startsAt: at(2, 11) },
  { id: 'd', startsAt: at(3, 10) },
];

afterEach(cleanup);

describe('SlotDayPicker', () => {
  it('shows one button per day, with its count, and only the first day’s times', () => {
    render(<SlotDayPicker name="t" slots={SLOTS} value="" onChange={() => {}} />);
    const days = screen.getAllByRole('button');
    expect(days).toHaveLength(3);
    expect(days[1].textContent).toContain('2 times');
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByTestId('slot-a')).toBeTruthy();
    expect(screen.queryByTestId('slot-b')).toBeNull();
  });

  it('switching day shows that day’s times; picking one reports it', () => {
    const onChange = vi.fn();
    render(<SlotDayPicker name="t" slots={SLOTS} value="" onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(screen.getByTestId('slot-b')).toBeTruthy();
    expect(screen.getByTestId('slot-c')).toBeTruthy();
    expect(screen.queryByTestId('slot-a')).toBeNull();
    fireEvent.click(screen.getByTestId('slot-c').querySelector('input')!);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }));
  });

  it('opens on the day of the time already chosen', () => {
    render(<SlotDayPicker name="t" slots={SLOTS} value="d" onChange={() => {}} />);
    expect(screen.getByTestId('slot-d')).toBeTruthy();
    expect(screen.queryByTestId('slot-a')).toBeNull();
  });
});
