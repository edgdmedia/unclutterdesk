import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { cleanup, renderWithApp, screen } from '../../test/renderWithApp';

/* /signup: signed-in people go home; others get the right signup form. */
let auth: any = { profile: null, isLoading: false };
vi.mock('../../context/AuthContext', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../context/AuthContext')>();
  return { ...real, useAuth: () => auth };
});
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: async () => [] } };
});
const { SignupEntry } = await import('../auth/SignupEntry');

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}
const at = (route: string) =>
  renderWithApp(
    <Routes>
      <Route path="/signup" element={<SignupEntry />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { route },
  );
afterEach(cleanup);

describe('/signup', () => {
  it.each([
    [{ type: 'therapist', role: 'OWNER' }, '/dashboard'],
    [{ type: 'platform_admin' }, '/admin'],
    [{ type: 'user', role: 'CLIENT' }, '/portal'],
  ])('sends a signed-in %o to %s', async (profile, home) => {
    auth = { profile, isLoading: false };
    at('/signup?intent=profile');
    expect((await screen.findByTestId('where')).textContent).toBe(home);
  });

  it('shows the profile form, or the practice signup, to people who are signed out', async () => {
    auth = { profile: null, isLoading: false };
    at('/signup?intent=profile');
    expect(await screen.findByRole('heading', { name: 'Create your free therapist profile' })).toBeTruthy();
    cleanup();
    at('/signup?plan=pro');
    expect((await screen.findByTestId('where')).textContent).toBe('/auth/signup?plan=pro');
  });
});
