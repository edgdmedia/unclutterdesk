import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/**
 * §6.14 "Set up your own booking in one step": the page the emailed link opens
 * when a therapist's last place has gone. Real router and auth provider; only
 * the network is faked.
 */
const get = vi.fn();
const post = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
  setSessionExpiredHandler: vi.fn(),
}));

const { AuthProvider, useAuth } = await import('../../../context/AuthContext');
const { OwnBookingPage } = await import('../OwnBookingPage');

const TOKEN = 'a'.repeat(64);
const PROFILE = { id: '99', email: 'folake@example.com', type: 'therapist', role: 'OWNER', status: 'active', tenantId: '9' };

function Landed({ name }: { name: string }) {
  const { profile } = useAuth();
  return <p>{`${name} as ${profile?.email ?? 'nobody'}`}</p>;
}

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`/own-booking/${TOKEN}`]}>
        <Routes>
          <Route path="/own-booking/:token" element={<OwnBookingPage />} />
          <Route path="/onboarding" element={<Landed name="booking set-up" />} />
          <Route path="/dashboard/profile" element={<Landed name="profile editor" />} />
          <Route path="/login" element={<p>sign in page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  // Opened from an email: usually nobody is signed in.
  get.mockReset().mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
  post.mockReset();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('own booking in one step (§6.14)', () => {
  it('says what it does before anything is created', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /set up your own booking/i })).toBeTruthy();
    expect(screen.getByText(/free practice/i)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it('creates the practice with the link, signs in, and goes to the booking set-up', async () => {
    post.mockResolvedValue({ profile: PROFILE, createdPractice: true, csrfToken: 'c' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /set up my own booking/i }));
    expect(await screen.findByText('booking set-up as folake@example.com')).toBeTruthy();
    expect(post).toHaveBeenCalledWith('/v1/auth/own-booking/claim', { token: TOKEN });
  });

  it('goes to the profile when they already own a practice', async () => {
    post.mockResolvedValue({ profile: PROFILE, createdPractice: false, csrfToken: 'c' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /set up my own booking/i }));
    expect(await screen.findByText('profile editor as folake@example.com')).toBeTruthy();
  });

  it("shows the API's answer for a used or expired link, with a way to sign in", async () => {
    post.mockRejectedValue(new Error('This link is invalid or has expired. Sign in to set up booking from your profile.'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /set up my own booking/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/invalid or has expired/);
    fireEvent.click(screen.getByRole('link', { name: /sign in/i }));
    expect(await screen.findByText('sign in page')).toBeTruthy();
  });

  it('sends the link once, even on a double click', async () => {
    let finish!: (v: unknown) => void;
    post.mockReturnValue(new Promise((r) => (finish = r)));
    renderPage();
    const button = await screen.findByRole('button', { name: /set up my own booking/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(post).toHaveBeenCalledTimes(1);
    finish({ profile: PROFILE, createdPractice: true, csrfToken: 'c' });
    expect(await screen.findByText(/booking set-up/)).toBeTruthy();
  });
});
