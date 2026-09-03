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

vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    put: (...a: unknown[]) => apiPut(...a),
    post: (...a: unknown[]) => apiPost(...a),
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
};

function route(path: string) {
  if (path === '/v1/auth/preferences') return Promise.resolve(PREFS);
  if (path === '/v1/notifications/preferences') return Promise.resolve([]);
  return Promise.reject(new Error(`unexpected ${path}`));
}

async function renderPage() {
  render(<AccountPreferencesPage />);
  await screen.findByText('ada@practice.ng');
}

beforeEach(() => {
  apiGet.mockReset().mockImplementation((p: string) => route(p));
  apiPut.mockReset().mockResolvedValue(PREFS);
  apiPost.mockReset().mockResolvedValue({ success: true });
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

  // The panel a person would check after suspecting a break-in was invented.
  it('lists no active sessions or devices', async () => {
    const { container } = render(<AccountPreferencesPage />);
    await screen.findByText('ada@practice.ng');
    expect(container.textContent).not.toMatch(/Active sessions/i);
    expect(container.textContent).not.toMatch(/MacBook|iPhone/);
  });

  it('claims no password age it does not track', async () => {
    const { container } = render(<AccountPreferencesPage />);
    await screen.findByText('ada@practice.ng');
    expect(container.textContent).not.toMatch(/last changed/i);
  });

  it('offers no export or deactivate button with nothing behind it', async () => {
    const { container } = render(<AccountPreferencesPage />);
    await screen.findByText('ada@practice.ng');
    expect(container.textContent).not.toMatch(/Export my data|Deactivate account/i);
  });
});
