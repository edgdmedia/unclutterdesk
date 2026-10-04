import { describe, it, expect, vi } from 'vitest';
vi.mock('../../../../utils/apiClient', () => ({
  getAppType: vi.fn(),
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
}));
const { bookingHref } = await import('../BookSessionButton');

describe('bookingHref', () => {
  it('stays on the practice host', () => {
    expect(bookingHref('booking', 'dr-smith')).toBe('/book');
  });
  it("goes to the practice's own host from app.unclutterdesk.com (Review Focus 3)", () => {
    expect(bookingHref('app', 'dr-smith')).toBe('https://dr-smith.unclutterdesk.com/book');
  });
  it('never builds a host with no practice', () => {
    expect(bookingHref('app', '')).toBe('/book');
    expect(bookingHref('app', null)).toBe('/book');
  });
});
