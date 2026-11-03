import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

/*
 * Profile-first signup (§6.8): the form, then the code step, then sign-in
 * straight into the profile editor. Real router, brand and toasts; only the
 * network (and, for the sign-in test, the auth context's network call) is faked.
 */
const get = vi.fn();
const post = vi.fn();
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } };
});
const login = vi.fn();
vi.mock('../../context/AuthContext', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../context/AuthContext')>();
  return { ...real, useAuth: () => ({ login, isLoading: false }) };
});

const { ProfileSignupPage, suggestHandle } = await import('../auth/ProfileSignupPage');
const { LoginPage } = await import('../auth/LoginPage');

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname} ${JSON.stringify(location.state ?? {})}`}</p>;
}

beforeEach(() => {
  get.mockImplementation(async (url: string) => {
    if (url === '/v1/auth/profile-templates') return [{ key: 'private-practice-counsellor', title: 'Counsellor in private practice', description: '' }];
    if (url.startsWith('/v1/auth/handle-check')) {
      const handle = new URL(url, 'https://x').searchParams.get('handle');
      return handle === 'taken-name' ? { handle, available: false, message: 'That handle is taken' } : { handle, available: true };
    }
    return {};
  });
  post.mockResolvedValue({ email_sent: true });
});
afterEach(() => {
  cleanup();
  get.mockReset();
  post.mockReset();
  login.mockReset();
});

function fill() {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Folake' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Adeyemi' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'folake@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!pass' } });
  fireEvent.change(screen.getByLabelText('What kind of practitioner are you?'), { target: { value: 'PSYCHOLOGIST' } });
  fireEvent.click(screen.getByRole('checkbox'));
}

describe('profile-first signup', () => {
  it('suggests an address from the name, checks it, and signs up into the code step', async () => {
    renderWithApp(
      <Routes>
        <Route path="/signup" element={<ProfileSignupPage />} />
        <Route path="/verify-email" element={<Where />} />
      </Routes>,
      { route: '/signup?intent=profile' },
    );
    fill();
    expect((screen.getByLabelText('Your profile address') as HTMLInputElement).value).toBe('folake-adeyemi');
    await screen.findByText(/is yours to take/);
    fireEvent.change(await screen.findByLabelText('Start from a template (optional)'), { target: { value: 'private-practice-counsellor' } });

    const submit = screen.getByRole('button', { name: 'Create my free profile' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/v1/auth/register-profile', {
        firstName: 'Folake', lastName: 'Adeyemi', email: 'folake@example.com', password: 'Str0ng!pass',
        handle: 'folake-adeyemi', kind: 'PSYCHOLOGIST', templateKey: 'private-practice-counsellor',
      }),
    );
    expect((await screen.findByTestId('where')).textContent).toBe('/verify-email {"email":"folake@example.com","emailSent":true,"returnTo":"/dashboard/profile"}');
  });

  it('keeps the button off for a taken address and a weak password, and shows why', async () => {
    renderWithApp(<ProfileSignupPage />, { route: '/signup?intent=profile' });
    fill();
    fireEvent.change(screen.getByLabelText('Your profile address'), { target: { value: 'Taken Name' } });
    expect((screen.getByLabelText('Your profile address') as HTMLInputElement).value).toBe('takenname');
    fireEvent.change(screen.getByLabelText('Your profile address'), { target: { value: 'taken-name' } });
    expect(await screen.findByText('That handle is taken')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Create my free profile' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Your profile address'), { target: { value: 'folake' } });
    await screen.findByText(/is yours to take/);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'weak' } });
    expect((screen.getByRole('button', { name: 'Create my free profile' }) as HTMLButtonElement).disabled).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it('shows the API’s reason when signup is refused', async () => {
    post.mockRejectedValue(new Error('An account with this email already exists. Please log in or reset your password.'));
    renderWithApp(<ProfileSignupPage />, { route: '/signup?intent=profile' });
    fill();
    await screen.findByText(/is yours to take/);
    fireEvent.click(screen.getByRole('button', { name: 'Create my free profile' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/already exists/);
  });

  it('makes a sensible address from a name', () => {
    expect(suggestHandle('Dr. Folake', 'Adéyẹmí')).toBe('folake-adeyemi');
    expect(suggestHandle('  ', '')).toBe('');
  });
});

describe('signing in after a profile-first signup', () => {
  it('goes straight to the profile editor, never the practice wizard', async () => {
    login.mockResolvedValue({ type: 'therapist', role: 'OWNER', tenantId: '3', onboardingIntent: 'PROFILE' });
    renderWithApp(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Where />} />
      </Routes>,
      { route: '/login' },
    );
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'folake@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'Str0ng!pass' } });
    fireEvent.submit(screen.getByLabelText(/Email/i).closest('form')!);
    expect((await screen.findByTestId('where')).textContent).toMatch(/^\/dashboard\/profile /);
  });
});
