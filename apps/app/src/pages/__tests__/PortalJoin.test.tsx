import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderWithApp, screen, cleanup } from '../../test/renderWithApp';

/**
 * VID-02: the portal's Join waits for the room to open and says when, and an
 * in-person session has none. It never links to a video provider.
 */
const apiGet = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn() },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
  TENANT_SLUG: 'dr-smith',
  API_BASE: '',
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, profile: { email: 'ada@example.com', type: 'user' } }),
}));
const { ClientPortalPage } = await import('../client/ClientPortalPage');

const tomorrow = new Date(Date.now() + 26 * 3_600_000);
const session = (over: Record<string, unknown>) => ({
  id: '900', serviceTitle: 'Individual Therapy', therapistName: 'Dr Jane Smith', priceKobo: '0', status: 'CONFIRMED', format: 'ONLINE',
  startsAt: tomorrow.toISOString(), endsAt: new Date(tomorrow.getTime() + 50 * 60_000).toISOString(), ...over,
});
function portalWith(next: Record<string, unknown>) {
  apiGet.mockImplementation((p: string) => Promise.resolve(p === '/v1/consult/portal' ? { clientName: 'Ada Okafor', upcoming: [session(next)], past: [] } : []));
  renderWithApp(<ClientPortalPage />);
}

afterEach(() => cleanup());

describe('the portal Join button', () => {
  it('says when tomorrow\'s room opens, and links nowhere yet', async () => {
    portalWith({});
    expect(await screen.findByRole('button', { name: /^Opens at / })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /join session/i })).toBeNull();
    expect(document.body.innerHTML).not.toMatch(/meet\.jit\.si/);
  });

  it('is not offered for an in-person session', async () => {
    portalWith({ format: 'IN_PERSON' });
    await screen.findByText('Hello, Ada');
    expect(screen.queryByRole('button', { name: /^Opens at / })).toBeNull();
    expect(screen.queryByRole('link', { name: /join session/i })).toBeNull();
  });
});

describe('the session list', () => {
  it('shows each session\'s day number in dark text, readable on the white list', async () => {
    portalWith({});
    await screen.findByText('Hello, Ada');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const tiles = screen.getAllByText(new RegExp(`^0?${Number(day)}$`));
    // The hero tile is white on dark; every list tile must not be white on white.
    expect(tiles.length).toBeGreaterThanOrEqual(2);
    expect(tiles.filter((t) => t.className.includes('text-white')).length).toBe(1);
  });
});
