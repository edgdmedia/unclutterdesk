import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const switchToPractice = vi.fn().mockResolvedValue(undefined);
const logout = vi.fn().mockResolvedValue(undefined);
let hasPractice = true;
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ profile: { email: 'admin@unclutterdesk.com', platformRole: 'SUPER_ADMIN', hasPractice }, logout, switchToPractice }),
}));
const { AdminAccountMenu } = await import('../shell/AdminAccountMenu');

afterEach(() => {
  cleanup();
  hasPractice = true;
});

describe('AdminAccountMenu', () => {
  it('opens to Back to my practice and Sign out, like the practice menu', async () => {
    renderWithApp(<AdminAccountMenu mode="full" />);
    fireEvent.click(screen.getByRole('button', { name: /admin@unclutterdesk.com/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Back to my practice' }));
    await waitFor(() => expect(switchToPractice).toHaveBeenCalled());
  });

  it('leaves out Back to my practice for an admin with no practice', async () => {
    hasPractice = false;
    renderWithApp(<AdminAccountMenu mode="full" />);
    fireEvent.click(screen.getByRole('button', { name: /admin@unclutterdesk.com/ }));
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to my practice' })).toBeNull();
  });
});
