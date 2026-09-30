import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { SWRConfig } from 'swr';
import { cleanup, fireEvent, renderWithApp, screen, waitFor, within } from '../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), patch: vi.fn() },
  APP_BASE_URL: 'https://app.unclutterdesk.com',
}));
const { AdminInvitesPage } = await import('../admin/AdminInvitesPage');

function invite(over: Record<string, unknown> = {}) {
  return {
    id: '1',
    code: 'DESK-AB12-CD34',
    tier: 'PRO',
    durationDays: 90,
    maxUses: 10,
    usedCount: 0,
    redeemBy: null,
    note: null,
    isActive: true,
    createdAt: '2026-09-01T10:00:00Z',
    practices: [],
    sends: [],
    ...over,
  };
}

function renderPage() {
  return renderWithApp(
    <SWRConfig value={{ fetcher: (key: string) => get(key), provider: () => new Map(), dedupingInterval: 0 }}>
      <AdminInvitesPage />
    </SWRConfig>,
  );
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});
afterEach(cleanup);

describe('AdminInvitesPage: invite by email', () => {
  it('emails the invite with a personal message and shows it in the history', async () => {
    const sent = { id: '5', email: 'ada@calm.ng', message: 'See you soon', delivered: true, sentBy: 'admin@unclutterdesk.com', createdAt: '2026-09-30T10:00:00Z' };
    get.mockResolvedValueOnce([invite()]).mockResolvedValue([invite({ sends: [sent] })]);
    post.mockResolvedValue(sent);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Invite by email' }));
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@calm.ng' } });
    fireEvent.change(screen.getByLabelText('Personal message (optional)'), { target: { value: 'See you soon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/admin/invites/1/send', { email: 'ada@calm.ng', message: 'See you soon' }));
    const history = await screen.findByRole('list', { name: 'Sent by email' });
    expect(within(history).getByText('ada@calm.ng')).toBeTruthy();
    expect(screen.queryByLabelText('Email address')).toBeNull();
  });

  it('flags an email that did not go out and resends it with the same details', async () => {
    const failed = { id: '6', email: 'bola@calm.ng', message: 'Hello again', delivered: false, sentBy: null, createdAt: '2026-09-29T10:00:00Z' };
    get.mockResolvedValue([invite({ sends: [failed] })]);
    renderPage();

    const history = await screen.findByRole('list', { name: 'Sent by email' });
    expect(within(history).getByText('Not delivered')).toBeTruthy();
    fireEvent.click(within(history).getByRole('button', { name: 'Resend' }));
    expect((screen.getByLabelText('Email address') as HTMLInputElement).value).toBe('bola@calm.ng');
    expect((screen.getByLabelText('Personal message (optional)') as HTMLTextAreaElement).value).toBe('Hello again');
  });

  it('keeps the form open and shows why when sending fails', async () => {
    get.mockResolvedValue([invite()]);
    post.mockRejectedValue(new Error('The email could not be sent. Copy the invite link and share it another way.'));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Invite by email' }));
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@calm.ng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));

    expect((await screen.findAllByText(/could not be sent/i)).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Email address')).toBeTruthy();
  });

  it('cannot email a code that is switched off or used up', async () => {
    get.mockResolvedValue([invite({ id: '1', isActive: false }), invite({ id: '2', code: 'DESK-FULL-0000', maxUses: 1, usedCount: 1 })]);
    renderPage();
    const buttons = await screen.findAllByRole('button', { name: 'Invite by email' });
    expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });
});
