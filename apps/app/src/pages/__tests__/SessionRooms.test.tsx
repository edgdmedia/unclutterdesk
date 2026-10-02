import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { renderWithApp, screen, fireEvent, cleanup } from '../../test/renderWithApp';

/**
 * VID-01: both session rooms run the real video stage. The network refuses
 * the join here ("opens at"), so no video SDK is needed to see the page.
 */
const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), post: (...a: unknown[]) => apiPost(...a), patch: vi.fn() },
  API_BASE: '',
  TENANT_SLUG: 'dr-smith',
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
}));
let signedIn = true;
vi.mock('../../context/AuthContext', () => ({
  useAuth: () =>
    signedIn
      ? { isAuthenticated: true, isLoading: false, profile: { email: 'ada@example.com', type: 'user' } }
      : { isAuthenticated: false, isLoading: false, profile: null },
}));

const { TelehealthVideoRoomPage } = await import('../practice/TelehealthVideoRoomPage');
const { ClientSessionRoomPage } = await import('../client/ClientSessionRoomPage');

const PREP = {
  booking: {
    id: '900', clientProfileId: '7', clientName: 'Ada Okafor', clientEmail: 'ada@example.com',
    startsAt: '2026-10-06T09:00:00Z', endsAt: '2026-10-06T09:50:00Z', serviceTitle: 'Individual Therapy', status: 'CONFIRMED', videoRoomLink: '/session/900',
  },
  latestNote: null,
  submissions: [],
};
const PORTAL = {
  clientName: 'Ada Okafor',
  upcoming: [{ id: '900', serviceTitle: 'Individual Therapy', startsAt: '2026-10-06T09:00:00Z', endsAt: '2026-10-06T09:50:00Z', status: 'CONFIRMED', priceKobo: '0', therapistName: 'Dr Jane Smith', format: 'ONLINE' }],
  past: [],
};

beforeEach(() => {
  signedIn = true;
  apiGet.mockImplementation((path: string) => Promise.resolve(path.includes('/prep') ? PREP : path === '/v1/consult/portal' ? PORTAL : []));
  apiPost.mockImplementation((path: string) =>
    path.endsWith('/join') ? Promise.reject(new Error('This room opens at 9:45 AM.')) : Promise.resolve({ id: 'note-1', isLocked: false }),
  );
});
afterEach(() => cleanup());

describe("the therapist's session room", () => {
  function open() {
    renderWithApp(
      <Routes>
        <Route path="/session/:id" element={<TelehealthVideoRoomPage />} />
        <Route path="/dashboard/clients" element={<p>Client records</p>} />
      </Routes>,
      { route: '/session/900' },
    );
  }

  it('runs the real room, not the old preview tile', async () => {
    open();
    expect(await screen.findByText('This room opens at 9:45 AM.')).toBeTruthy();
    expect(apiPost).toHaveBeenCalledWith('/v1/video/bookings/900/join', {});
    expect(screen.queryByText(/room preview/i)).toBeNull();
    expect(screen.queryByText(/placeholder/i)).toBeNull();
  });

  it('keeps the notes drawer on the NOTES button', async () => {
    open();
    await screen.findByText('SOAP Notes');
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.queryByText('SOAP Notes')).toBeNull();
  });

  it('asks before ending the session', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'End session' }));
    expect(screen.getByText('End this session?')).toBeTruthy();
  });
});

describe("the client's session room", () => {
  function open() {
    renderWithApp(
      <Routes>
        <Route path="/portal/sessions/:id/room" element={<ClientSessionRoomPage />} />
        <Route path="/portal" element={<p>My sessions</p>} />
      </Routes>,
      { route: '/portal/sessions/900/room' },
    );
  }

  it('shows the session and its room', async () => {
    open();
    expect(await screen.findByText(/Dr Jane Smith/)).toBeTruthy();
    expect(await screen.findByText('This room opens at 9:45 AM.')).toBeTruthy();
    expect(apiPost).toHaveBeenCalledWith('/v1/video/bookings/900/join', {});
  });

  it('goes back to the portal on Leave', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Leave' }));
    expect(await screen.findByText('My sessions')).toBeTruthy();
  });

  it('asks a signed-out visitor to sign in, and asks for no room', async () => {
    signedIn = false;
    open();
    expect(await screen.findByText(/sign in to join your session/i)).toBeTruthy();
    expect(apiPost).not.toHaveBeenCalled();
  });
});
