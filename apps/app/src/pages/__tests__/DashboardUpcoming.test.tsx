import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, within } from '../../test/renderWithApp';
import type { CalendarEvent } from '../../App';

/* The dashboard's Upcoming list: real page, only the network stubbed. */
let timeFormat = '12-hour';
const get = vi.fn(async (url: string) => {
  if (url === '/v1/auth/preferences') return { locale: 'en-NG', timezone: 'Africa/Lagos', dateFormat: 'D MMM YYYY', timeFormat };
  if (url === '/v1/consult/dashboard/summary') return { revenueThisMonthNaira: 0, monthlyRevenue: [], revenueChangePercent: null, scheduledSessionsCount: 0, totalClientsCount: 0, activeRosterCount: 1, upcomingSessions: [] };
  if (url === '/v1/tenant/notifications') return [];
  if (url === '/v1/consult/therapist/profile') return { firstName: 'Jane', lastName: 'Smith' };
  return {};
});
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (u: string) => get(u), post: vi.fn(async () => ({})) } };
});
vi.mock('../../context/AuthContext', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../context/AuthContext')>();
  return { ...real, useAuth: () => ({ profile: { id: '55', type: 'therapist', tenantId: '27', tenantSlug: 'smith', plan: 'PRO', firstName: 'Jane' }, refreshProfile: vi.fn() }) };
});
const { DashboardPage } = await import('../practice/DashboardPage');

const inHours = (h: number, mins = 50, over: Partial<CalendarEvent> = {}): CalendarEvent => {
  const s = new Date(Date.now() + h * 3_600_000);
  return { id: `b${h}`, title: `Client ${h}`, type: 'Individual Therapy', startsAt: s.toISOString(), endsAt: new Date(s.getTime() + mins * 60_000).toISOString(), category: 'individual', status: 'CONFIRMED', format: 'ONLINE', ...over };
};

beforeEach(() => {
  timeFormat = '12-hour';
});
afterEach(cleanup);

function renderDashboard(sessions: CalendarEvent[]) {
  return renderWithApp(
    <Routes>
      <Route path="/" element={<DashboardPage sessions={sessions} clients={[]} {...({} as any)} />} />
      <Route path="/dashboard/sessions/:id" element={<p>Session page</p>} />
    </Routes>,
  );
}

describe('dashboard Upcoming', () => {
  it('leaves out sessions that have already ended, and links to all sessions', async () => {
    renderDashboard([inHours(-30, 50, { id: 'old', title: 'Past Client' }), inHours(3, 50, { id: 'soon', title: 'Soon Client' })]);
    expect(await screen.findByRole('link', { name: 'Soon Client' })).toBeTruthy();
    expect(screen.queryByText('Past Client')).toBeNull();
    expect(screen.getByRole('link', { name: /All sessions/ }).getAttribute('href')).toBe('/dashboard/sessions');
  });

  it('opens the session when its card is chosen', async () => {
    renderDashboard([inHours(3, 50, { id: 'b77', title: 'Ada Obi' })]);
    fireEvent.click(await screen.findByRole('link', { name: 'Ada Obi' }));
    expect(await screen.findByText('Session page')).toBeTruthy();
  });

  it('shows times in the person\'s chosen clock', async () => {
    timeFormat = '12-hour';
    renderDashboard([inHours(3, 50, { title: 'Ada Obi' })]);
    const card = (await screen.findByRole('link', { name: 'Ada Obi' })).closest('div.relative') as HTMLElement;
    await within(card).findAllByText(/\d{1,2}:\d{2}\s?(am|pm|AM|PM)/);
  });
});
