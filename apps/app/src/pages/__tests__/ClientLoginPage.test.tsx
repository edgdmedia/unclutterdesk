import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { fireEvent, renderWithApp, screen, waitFor, cleanup } from '../../test/renderWithApp';

const apiPost = vi.fn();
const login = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: vi.fn(), post: (...a: unknown[]) => apiPost(...a) },
  APP_BASE_URL: 'https://app.unclutterdesk.com',
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login }),
}));

const { ClientLoginPage } = await import('../public/ClientLoginPage');

afterEach(() => {
  cleanup();
  apiPost.mockReset();
  login.mockReset();
});

describe('the client login page', () => {
  it('opens on Sign in and takes the client to their portal', async () => {
    login.mockResolvedValue({ type: 'user' });
    renderWithApp(<ClientLoginPage />);
    const email = screen.getByLabelText(/Email/i);
    fireEvent.change(email, { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByRole('button', { name: /Sign in and continue/ }).closest('form')!);
    await waitFor(() => expect(login).toHaveBeenCalledWith('ada@example.com', 'password123'));
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('offers staff their own sign-in page', async () => {
    renderWithApp(<ClientLoginPage />);
    const staff = screen.getByRole('link', { name: /Staff sign in/ });
    expect(staff.getAttribute('href')).toBe('https://app.unclutterdesk.com/login');
  });
});
