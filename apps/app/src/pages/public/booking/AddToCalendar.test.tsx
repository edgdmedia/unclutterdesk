import { describe, it, expect } from 'vitest';
import { renderWithApp, screen, fireEvent } from '../../../test/renderWithApp';
import { AddToCalendar, googleCalendarUrl } from './AddToCalendar';

const S = { bookingId: '9', icalToken: 'tok', serviceTitle: 'Individual Therapy', therapistName: 'Dr Bello', startsAt: '2030-10-02T13:00:00Z', endsAt: '2030-10-02T14:00:00Z' };

describe('AddToCalendar', () => {
  it('builds the Google link with title and times', () => {
    const url = new URL(googleCalendarUrl(S));
    expect(url.searchParams.get('text')).toBe('Individual Therapy with Dr Bello');
    expect(url.searchParams.get('dates')).toBe('20301002T130000Z/20301002T140000Z');
  });

  it('opens a menu with the .ics download carrying the token, and closes on Escape', () => {
    renderWithApp(<AddToCalendar {...S} />);
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/ }));
    expect(screen.getByRole('menuitem', { name: 'Download (.ics)' }).getAttribute('href')).toMatch(/\/v1\/calendar\/bookings\/9\/ical\?token=tok$/);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens below when asked, so a card near the top of the page stays on screen', () => {
    renderWithApp(<AddToCalendar {...S} placement="below" />);
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/ }));
    expect(screen.getByRole('menu').className).toContain('top-full');
  });
});
