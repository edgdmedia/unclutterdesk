import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithApp, screen, cleanup, within } from '../../../../test/renderWithApp';

let profile: Record<string, unknown> = { role: 'OWNER', type: 'owner', plan: 'CLINIC' };
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ profile }),
}));

const { SettingsHub: SettingsPage, SettingsIndex } = await import('../SettingsPage');

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname}</p>;
}

function hubAt(path: string) {
  return renderWithApp(
    <Routes>
      <Route path="/dashboard/settings" element={<SettingsPage />}>
        <Route index element={<SettingsIndex />} />
        <Route path="profile" element={<><p>profile tab</p><Where /></>} />
        <Route path="availability" element={<><p>availability tab</p><Where /></>} />
        <Route path="account" element={<><p>account tab</p><Where /></>} />
        <Route path="team" element={<><p>team tab</p><Where /></>} />
        <Route path="notifications" element={<><p>notifications tab</p><Where /></>} />
        <Route path="*" element={<SettingsIndex />} />
      </Route>
    </Routes>,
    { route: path },
  );
}

beforeEach(() => {
  profile = { role: 'OWNER', type: 'owner', plan: 'CLINIC' };
});
afterEach(cleanup);

describe('the settings hub', () => {
  it('lands on the first tab and marks it active in the rail', async () => {
    hubAt('/dashboard/settings');
    // First internal tab for owner is "Account & preferences" (You group)
    expect(await screen.findByText('account tab')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/dashboard/settings/account');
    expect(screen.getAllByRole('link', { name: /Account & preferences/ }).every((l) => l.getAttribute('aria-current'))).toBe(true);
  });

  it('shows the grouped rail to owners with new groups', async () => {
    hubAt('/dashboard/settings/availability');
    await screen.findByText('availability tab');
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByText('Booking page')).toBeTruthy();
    expect(screen.getByText('Money')).toBeTruthy();
  });

  it('an unknown tab falls back to the first visible one', async () => {
    hubAt('/dashboard/settings/nonsense');
    // First internal tab for owner is "Account & preferences" (You group)
    expect(await screen.findByText('account tab')).toBeTruthy();
  });

  it('receptionists only manage themselves', async () => {
    profile = { role: 'RECEPTIONIST', type: 'receptionist', plan: 'CLINIC' };
    hubAt('/dashboard/settings');
    // First internal tab for receptionist is "Account & preferences" (You group)
    expect(await screen.findByText('account tab')).toBeTruthy();
    // But they can navigate to availability - find it within the Practice group
    const practiceNav = screen.getByRole('navigation', { name: 'Practice' });
    const availabilityLink = within(practiceNav).getByRole('link', { name: /Availability/i });
    expect(availabilityLink).toBeTruthy();
    expect(screen.queryByText('Practice profile')).toBeNull();
    expect(screen.queryByText('Team')).toBeNull();
  });
});
