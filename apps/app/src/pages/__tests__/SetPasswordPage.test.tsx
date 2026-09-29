import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const post = vi.fn();
vi.mock('../../utils/apiClient', () => ({ api: { get: vi.fn(), post: (...a: unknown[]) => post(...a) } }));
const { SetPasswordPage } = await import('../public/SetPasswordPage');

beforeEach(() => post.mockReset());
afterEach(cleanup);

function renderPage() {
  return renderWithApp(
    <Routes><Route path="/set-password" element={<SetPasswordPage />} /></Routes>,
    { route: '/set-password?t=tok' },
  );
}

describe('SetPasswordPage', () => {
  it('sends the token with the chosen password', async () => {
    post.mockResolvedValue({ profile: { id: '40', role: 'CLIENT' } });
    renderPage();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set password' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/auth/client-set-password', expect.objectContaining({ token: 'tok', password: 'password1234' })));
  });
  it('explains an expired link', async () => {
    post.mockRejectedValue(new Error('That link has expired. Ask the practice to send it again.'));
    renderPage();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set password' }));
    await waitFor(() => expect(screen.getByText(/expired/i)).toBeTruthy());
  });
});
