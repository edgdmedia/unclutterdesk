import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { SWRConfig } from 'swr';
import { cleanup, fireEvent, renderWithApp, screen, waitFor, within } from '../../test/renderWithApp';

/** VID-01: super admins see each month's video minutes against the budgets. */
const get = vi.fn();
vi.mock('../../utils/apiClient', () => ({ api: { get: (...a: unknown[]) => get(...a) } }));
const { AdminVideoUsagePage } = await import('../admin/AdminVideoUsagePage');

const REPORT = {
  month: '2026-10',
  limits: { dailyMinutes: 9500, jaasUsers: 23 },
  totals: [
    { provider: 'DAILY', minutes: 4750, participants: 40 },
    { provider: 'JAAS', minutes: 120, participants: 6 },
  ],
  practices: [
    { tenantId: '1', name: 'Calm Harbor', provider: 'DAILY', minutes: 4000, sessions: 50 },
    { tenantId: '2', name: 'Dr Smith', provider: 'JAAS', minutes: 120, sessions: 3 },
  ],
};

function renderPage() {
  return renderWithApp(
    <SWRConfig value={{ fetcher: (key: string) => get(key), provider: () => new Map(), dedupingInterval: 0 }}>
      <AdminVideoUsagePage />
    </SWRConfig>,
  );
}

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue(REPORT);
});
afterEach(cleanup);

describe('Admin → Video usage', () => {
  it('shows the budgets used and each practice', async () => {
    renderPage();
    expect(await screen.findByText('4,750 of 9,500 minutes')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Daily minutes used' }).getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByText('6 of 23 people')).toBeTruthy();
    const row = screen.getByRole('row', { name: /Calm Harbor/ });
    expect(within(row).getByText('4,000')).toBeTruthy();
    expect(within(row).getByText('50')).toBeTruthy();
  });

  it('asks for the month picked', async () => {
    renderPage();
    await screen.findByText('Calm Harbor');
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-09' } });
    await waitFor(() => expect(get).toHaveBeenCalledWith('/v1/admin/video-usage?month=2026-09'));
  });
});
