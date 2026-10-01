import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const post = vi.fn();
const refreshProfile = vi.fn();
let profile: Record<string, unknown> = {
  id: '55',
  type: 'therapist',
  role: 'OWNER',
  tenantId: '27',
  tenantSlug: 'smith-therapy',
  plan: 'PRO',
  firstName: 'Jane',
  lastName: 'Smith',
  tourCompletedAt: null,
};
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, post: (...a: unknown[]) => post(...a) } };
});
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ profile, refreshProfile }),
}));
const { DashboardTour } = await import('../onboarding/DashboardTour');
const { AccountMenu } = await import('../shell/AccountMenu');

const ANCHOR_IDS = ['booking-link', 'nav-sessions', 'nav-clients', 'nav-availability', 'nav-forms', 'nav-payouts', 'account-menu'];

function Anchors() {
  return (
    <div>
      {ANCHOR_IDS.map((id) => (
        <div key={id} data-tour={id}>
          {id}
        </div>
      ))}
    </div>
  );
}

function walkToTheEnd() {
  for (;;) {
    const next = screen.queryByRole('button', { name: 'Next' });
    if (!next) break;
    fireEvent.click(next);
  }
}

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ tourCompletedAt: '2026-10-01T08:00:00.000Z' });
  refreshProfile.mockReset();
  refreshProfile.mockResolvedValue(undefined);
  profile = {
    id: '55', type: 'therapist', role: 'OWNER', tenantId: '27', tenantSlug: 'smith-therapy',
    plan: 'PRO', firstName: 'Jane', lastName: 'Smith', tourCompletedAt: null,
  };
});
afterEach(cleanup);

describe('the dashboard walkthrough', () => {
  it('shows the first stop for someone who has not taken it', async () => {
    renderWithApp(
      <>
        <Anchors />
        <DashboardTour />
      </>,
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Your booking link');
  });

  it('finishing remembers it, on the server and in the profile', async () => {
    renderWithApp(
      <>
        <Anchors />
        <DashboardTour />
      </>,
    );
    await screen.findByRole('dialog');
    walkToTheEnd();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/auth/me/tour-complete', expect.anything()));
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('stays quiet once taken', async () => {
    profile = { ...profile, tourCompletedAt: '2026-10-01T08:00:00.000Z' };
    renderWithApp(
      <>
        <Anchors />
        <DashboardTour />
      </>,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the account menu starts it again', async () => {
    profile = { ...profile, tourCompletedAt: '2026-10-01T08:00:00.000Z' };
    renderWithApp(
      <>
        <Anchors />
        <DashboardTour />
        <AccountMenu mode="full" />
      </>,
      { route: '/dashboard' },
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Jane Smith/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Take the tour/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Your booking link');
  });
});
