import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, renderWithApp, screen } from '../../../../test/renderWithApp';
import { ConfirmationStep } from '../ConfirmationStep';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const booking = {
  bookingId: '900',
  icalToken: 'tok',
  startsAt: '2026-10-06T10:30:00Z',
  endsAt: '2026-10-06T11:20:00Z',
  therapistName: 'Sarah Smith',
  serviceTitle: 'Individual therapy',
};

describe('ConfirmationStep', () => {
  it('confirms a paid online session, with calendar links and the video note', () => {
    renderWithApp(<ConfirmationStep booking={booking} channel="VIDEO" mode="paid" apiBase="https://api.x" />);
    expect(screen.getByRole('heading', { name: "You're booked" })).toBeTruthy();
    expect(screen.getByText('Tue, 6 Oct · 11:30 AM WAT')).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText('Sarah Smith')).toBeTruthy();
    expect(screen.getByText(/Your video link will be emailed/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Add to calendar/ }).getAttribute('href')).toBe('https://api.x/v1/calendar/bookings/900/ical?token=tok');
    const google = screen.getByRole('link', { name: /Google Calendar/ }).getAttribute('href')!;
    expect(google).toContain('calendar.google.com');
    expect(google).toContain('dates=20261006T103000Z%2F20261006T112000Z');
    expect(screen.queryByText("What's next")).toBeNull();
  });

  it('holds a transfer booking with a countdown and copyable details', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } }); // a browser API, not ours
    renderWithApp(
      <ConfirmationStep
        booking={{ ...booking, manualPayment: { bankName: 'GTBank', accountName: 'Smith Therapy', accountNumber: '0123456789', reference: 'UD-900', amountKobo: '3500000', holdExpiresAt: '2026-10-03T10:00:00Z' } }}
        channel="VIDEO"
        mode="transfer"
        apiBase="https://api.x"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Your time is held' })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('47:59:59')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy reference' }));
    });
    expect(writeText).toHaveBeenCalledWith('UD-900');
    expect(screen.getByRole('button', { name: 'Copy reference' }).textContent).toBe('Copied');
  });

  it("lists the forms to fill in before the first session when there are any", () => {
    renderWithApp(
      <ConfirmationStep
        booking={{ ...booking, forms: [{ title: 'About you', kind: 'Intake', minutes: 8, href: '/forms/1' }] }}
        channel="VIDEO"
        mode="paid"
        apiBase="https://api.x"
      />,
    );
    expect(screen.getByText("What's next")).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start About you' }).getAttribute('href')).toBe('/forms/1');
  });
});
