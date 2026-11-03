import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { SWRConfig } from 'swr';
import { cleanup, fireEvent, renderWithApp, screen, waitFor, within } from '../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } };
});
const { AdminProfileReportsPage } = await import('../admin/AdminProfileReportsPage');

const open = {
  id: '9',
  handle: 'folake',
  type: 'IMPERSONATION',
  details: 'Not her photo.',
  reporterName: null,
  reporterEmail: null,
  relationship: null,
  status: 'OPEN',
  reviewNote: null,
  createdAt: '2026-11-03T10:00:00Z',
  reviewedAt: null,
  profile: { id: '50', handle: 'folake', displayName: 'Dr. Folake Adeyemi', status: 'PUBLISHED', openReports: 2 },
};

function renderPage() {
  return renderWithApp(
    <SWRConfig value={{ fetcher: (key: string) => get(key), provider: () => new Map(), dedupingInterval: 0 }}>
      <AdminProfileReportsPage />
    </SWRConfig>,
  );
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockResolvedValue({ reports: [open] });
  post.mockResolvedValue({});
});
afterEach(cleanup);

describe('profile reports queue', () => {
  it('lists open reports with the profile, its status and how many reports it has', async () => {
    renderPage();
    const card = await screen.findByText(/Impersonation · Dr\. Folake Adeyemi/);
    const row = card.closest('[data-report]') as HTMLElement;
    expect(get).toHaveBeenCalledWith('/v1/admin/profile-reports?status=OPEN');
    expect(within(row).getByText('Not her photo.')).toBeTruthy();
    expect(within(row).getByText(/Published · 2 open reports/)).toBeTruthy();
    expect(within(row).getByRole('link', { name: /folake/ }).getAttribute('href')).toMatch(/\/folake$/);
  });

  it('dismisses without a reason, but needs one before acting on the profile', async () => {
    renderPage();
    const row = (await screen.findByText(/Impersonation/)).closest('[data-report]') as HTMLElement;
    const suspend = within(row).getByRole('button', { name: 'Suspend' }) as HTMLButtonElement;
    expect(suspend.disabled).toBe(true);

    fireEvent.click(within(row).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/admin/profile-reports/9/resolve', { decision: 'DISMISSED' }));
  });

  it('suspends with the reason and closes this report', async () => {
    renderPage();
    const row = (await screen.findByText(/Impersonation/)).closest('[data-report]') as HTMLElement;
    fireEvent.change(within(row).getByPlaceholderText(/Reason/), { target: { value: 'Impersonating a registered psychologist.' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Suspend' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/v1/admin/profiles/50/moderate', {
        action: 'suspend',
        reason: 'Impersonating a registered psychologist.',
        reportId: '9',
      }),
    );
  });

  it('offers only lifting the suspension for a suspended profile', async () => {
    get.mockResolvedValue({ reports: [{ ...open, status: 'ACTIONED', profile: { ...open.profile, status: 'SUSPENDED' } }] });
    renderPage();
    const row = (await screen.findByText(/Impersonation/)).closest('[data-report]') as HTMLElement;
    expect(within(row).queryByRole('button', { name: 'Suspend' })).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Dismiss' })).toBeNull();
    fireEvent.change(within(row).getByPlaceholderText(/Reason/), { target: { value: 'Identity confirmed with the board.' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Lift suspension' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/v1/admin/profiles/50/moderate', { action: 'restore', reason: 'Identity confirmed with the board.' }),
    );
  });
});
