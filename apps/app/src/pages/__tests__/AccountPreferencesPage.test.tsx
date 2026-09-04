import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * Account & preferences.
 *
 * The page was almost entirely inert: "Save preferences" had no handler, the
 * email always wore a green "Verified" chip, the password row claimed "last
 * changed 3 months ago", a two-factor toggle said it was "required for clinical
 * records" with nothing behind it, and an "Active sessions" panel listed a
 * MacBook Pro and an iPhone 14 in Lagos to every user. The preview quoted
 * invented monthly revenue.
 */
const apiGet = vi.fn();
const apiPut = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    put: (...a: unknown[]) => apiPut(...a),
    post: (...a: unknown[]) => apiPost(...a),
    delete: (...a: unknown[]) => apiDelete(...a),
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ profile: { email: 'ada@practice.ng' } }),
}));

vi.mock('@unclutterdesk/ui', () => ({
  Eyebrow: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const { AccountPreferencesPage } = await import('../AccountPreferencesPage');

const PREFS = {
  email: 'ada@practice.ng',
  emailVerified: true,
  locale: 'en-NG',
  timezone: 'Africa/Lagos',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24-hour',
  weekStartsOn: 'Monday',
  numberFormat: '1,234.56',
  passwordChangedAt: null,
};

const SESSIONS = [
  {
    id: 'here',
    device: 'Chrome on Mac',
    ipAddress: '102.89.1.1',
    lastUsedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    current: true,
  },
  {
    id: 'elsewhere',
    device: 'Safari on iPhone',
    ipAddress: '41.58.2.2',
    lastUsedAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    startedAt: new Date(Date.now() - 9 * 86400_000).toISOString(),
    current: false,
  },
];

let prefsResponse: Record<string, unknown> = PREFS;
let sessionsResponse: () => Promise<unknown> = () => Promise.resolve(SESSIONS);

function route(path: string) {
  if (path === '/v1/auth/preferences') return Promise.resolve(prefsResponse);
  if (path === '/v1/notifications/preferences') return Promise.resolve([]);
  if (path === '/v1/auth/sessions') return sessionsResponse();
  return Promise.reject(new Error(`unexpected ${path}`));
}

async function renderPage() {
  render(<AccountPreferencesPage />);
  await screen.findByText('ada@practice.ng');
}

beforeEach(() => {
  prefsResponse = PREFS;
  sessionsResponse = () => Promise.resolve(SESSIONS);
  apiGet.mockReset().mockImplementation((p: string) => route(p));
  apiPut.mockReset().mockResolvedValue(PREFS);
  apiPost.mockReset().mockResolvedValue({ success: true });
  apiDelete.mockReset().mockResolvedValue({ success: true, endedCurrentSession: false });
});

afterEach(cleanup);

describe('loading', () => {
  it('reads the account preferences from the API', async () => {
    await renderPage();
    expect(apiGet).toHaveBeenCalledWith('/v1/auth/preferences');
  });

  it('shows the signed-in address, not a fabricated one', async () => {
    const { container } = render(<AccountPreferencesPage />);
    await screen.findByText('ada@practice.ng');
    expect(container.textContent).not.toContain('okonkwotherapy');
  });

  it('reports a failure rather than showing defaults as if they were saved', async () => {
    apiGet.mockImplementation((p: string) =>
      p === '/v1/auth/preferences'
        ? Promise.reject(new Error('Unable to load your preferences'))
        : route(p),
    );
    render(<AccountPreferencesPage />);
    expect(await screen.findByText(/Unable to load your preferences/i)).toBeTruthy();
  });
});

describe('the email verification badge', () => {
  // It was a green "Verified" chip regardless of the account's real state.
  it('says verified only when the account is', async () => {
    await renderPage();
    expect(screen.getByText('Verified')).toBeTruthy();
  });

  it('says unverified when it is not', async () => {
    apiGet.mockImplementation((p: string) =>
      p === '/v1/auth/preferences'
        ? Promise.resolve({ ...PREFS, emailVerified: false })
        : route(p),
    );
    await renderPage();
    expect(screen.getByText('Unverified')).toBeTruthy();
    expect(screen.queryByText('Verified')).toBeNull();
  });
});

describe('saving preferences', () => {
  it('sends the chosen values', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('radio', { name: '12-hour' }));
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }));

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith(
        '/v1/auth/preferences',
        expect.objectContaining({ timeFormat: '12-hour' }),
      ),
    );
  });

  it('confirms once it has actually saved', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }));
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('says nothing was saved when the request fails', async () => {
    apiPut.mockRejectedValue(new Error('Could not save your preferences'));
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('shows what the server stored, not what was sent', async () => {
    // The server clamps to values it accepts, so echoing the request would let
    // the page display a setting that was never saved.
    apiPut.mockResolvedValue({ ...PREFS, timeFormat: '24-hour' });
    await renderPage();
    fireEvent.click(screen.getByRole('radio', { name: '12-hour' }));
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }));
    await screen.findByText('Saved');
    expect((screen.getByRole('radio', { name: '24-hour' }) as HTMLElement).getAttribute('aria-checked')).toBe('true');
  });
});

describe('the preview', () => {
  it('reflects the format that is selected', async () => {
    await renderPage();
    expect(screen.getByText('14/08/2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'YYYY-MM-DD' }));
    expect(screen.getByText('2026-08-14')).toBeTruthy();
  });

  // It used to show "THIS MONTH'S REVENUE" as ₦412,000 — an invented figure,
  // per currency, on a page about date formatting.
  it('quotes no revenue', async () => {
    const { container } = render(<AccountPreferencesPage />);
    await screen.findByText('ada@practice.ng');
    expect(container.textContent).not.toMatch(/REVENUE/i);
    expect(container.textContent).not.toContain('412,000');
  });
});

describe('changing the password', () => {
  function fill(current: string, next: string, confirm: string) {
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: current } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: next } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: confirm } });
  }

  it('sends the current and new password', async () => {
    await renderPage();
    fill('old-password', 'a-new-password', 'a-new-password');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/v1/auth/change-password', {
        currentPassword: 'old-password',
        newPassword: 'a-new-password',
      }),
    );
  });

  it('refuses a mismatch before calling the API', async () => {
    await renderPage();
    fill('old-password', 'a-new-password', 'a-new-passwerd');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('refuses a short new password before calling the API', async () => {
    await renderPage();
    fill('old-password', 'short', 'short');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('surfaces a wrong current password instead of reporting success', async () => {
    apiPost.mockRejectedValue(new Error('Your current password is not correct'));
    await renderPage();
    fill('wrong', 'a-new-password', 'a-new-password');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    expect(await screen.findByText(/current password is not correct/i)).toBeTruthy();
  });

  it('clears the fields once it succeeds', async () => {
    await renderPage();
    fill('old-password', 'a-new-password', 'a-new-password');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    await screen.findByText(/password has been changed/i);
    expect((screen.getByLabelText(/current password/i) as HTMLInputElement).value).toBe('');
  });
});

describe('notification channels', () => {
  it('saves a toggle immediately', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('switch', { name: /sms notifications/i }));
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/v1/notifications/preferences', {
        module: 'all',
        channel: 'sms',
        enabled: true,
      }),
    );
  });

  // A toggle that stays switched after a failed save is a lie about what the
  // server holds.
  it('springs back when the save fails', async () => {
    apiPut.mockRejectedValue(new Error('Could not save that channel'));
    await renderPage();
    const sms = screen.getByRole('switch', { name: /sms notifications/i });
    fireEvent.click(sms);
    await screen.findByText(/Could not save that channel/i);
    expect(sms.getAttribute('aria-checked')).toBe('false');
  });
});

describe('claims the product cannot keep', () => {
  it('offers no two-factor toggle, since nothing enforces it', async () => {
    const { container } = render(<AccountPreferencesPage />);
    await screen.findByText('ada@practice.ng');
    expect(container.textContent).not.toMatch(/two-factor/i);
    expect(container.textContent).not.toMatch(/required for clinical records/i);
  });

  // The old panel listed a MacBook Pro and an iPhone 14 in Lagos to every user
  // on earth. The list is real now, so what must not come back is the invention.
  it('shows only devices the server reported', async () => {
    sessionsResponse = () => Promise.resolve([]);
    const { container } = render(<AccountPreferencesPage />);
    await screen.findByText('ada@practice.ng');
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/v1/auth/sessions'));
    expect(container.textContent).not.toMatch(/MacBook Pro|iPhone 14|Lagos, Nigeria/);
  });

  it('offers no export or deactivate button with nothing behind it', async () => {
    const { container } = render(<AccountPreferencesPage />);
    await screen.findByText('ada@practice.ng');
    expect(container.textContent).not.toMatch(/Export my data|Deactivate account/i);
  });
});

describe('active sessions', () => {
  it('lists the devices the server reported', async () => {
    await renderPage();
    expect(await screen.findByText('Chrome on Mac')).toBeTruthy();
    expect(screen.getByText('Safari on iPhone')).toBeTruthy();
  });

  it('marks the device being used, so it is not signed out by mistake', async () => {
    const { container } = render(<AccountPreferencesPage />);
    await screen.findByText('Chrome on Mac');
    const rows = container.querySelectorAll('li');
    expect(rows[0].textContent).toMatch(/This device/);
    expect(rows[1].textContent).not.toMatch(/This device/);
  });

  it('shows the address the server saw rather than a guessed location', async () => {
    await renderPage();
    expect((await screen.findByText(/41\.58\.2\.2/)).textContent).toMatch(/Last used/);
  });

  it('signs out one device and re-reads the list', async () => {
    await renderPage();
    fireEvent.click(await screen.findByLabelText('Sign out Safari on iPhone'));
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/v1/auth/sessions/elsewhere'));
    // Two loads: the first render, then the re-read after signing out.
    await waitFor(() =>
      expect(apiGet.mock.calls.filter((c) => c[0] === '/v1/auth/sessions')).toHaveLength(2),
    );
  });

  it('signs out every other device', async () => {
    await renderPage();
    fireEvent.click(await screen.findByText('Sign out other devices'));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/v1/auth/sessions/revoke-others', {}),
    );
  });

  it('offers nothing to sign out when this is the only device', async () => {
    sessionsResponse = () => Promise.resolve([SESSIONS[0]]);
    await renderPage();
    await screen.findByText('Chrome on Mac');
    expect(screen.queryByText('Sign out other devices')).toBeNull();
  });

  // "We could not check" and "no other devices" are different answers to the
  // question this panel exists to answer.
  it('says the list could not be loaded rather than showing an empty one', async () => {
    sessionsResponse = () => Promise.reject(new Error('Network unavailable'));
    await renderPage();
    expect(await screen.findByText('Network unavailable')).toBeTruthy();
    expect(screen.queryByText('Chrome on Mac')).toBeNull();
  });

  it('reports a failed sign-out instead of dropping the row from the list', async () => {
    apiDelete.mockRejectedValue(new Error('Could not reach the server'));
    await renderPage();
    fireEvent.click(await screen.findByLabelText('Sign out Safari on iPhone'));
    expect(await screen.findByText('Could not reach the server')).toBeTruthy();
    expect(screen.getByText('Safari on iPhone')).toBeTruthy();
  });
});

describe('when the password was last changed', () => {
  it('reports the recorded date', async () => {
    prefsResponse = { ...PREFS, passwordChangedAt: new Date(Date.now() - 2 * 86400_000).toISOString() };
    await renderPage();
    expect(screen.getByText(/Last changed 2 days ago/i)).toBeTruthy();
  });

  // The page used to say "last changed 3 months ago" to everyone.
  it('says so plainly when there is no date, rather than inventing one', async () => {
    await renderPage();
    expect(screen.getByText(/Last change not recorded/i)).toBeTruthy();
  });

  it('re-reads it after a change, so the page stops showing the old answer', async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'old-one' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'a-new-password' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'a-new-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() =>
      expect(apiGet.mock.calls.filter((c) => c[0] === '/v1/auth/preferences')).toHaveLength(2),
    );
  });
});
