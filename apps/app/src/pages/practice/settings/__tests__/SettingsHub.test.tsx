import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithApp, screen, cleanup } from '../../../../test/renderWithApp';

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
    expect(await screen.findByText('profile tab')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/dashboard/settings/profile');
    expect(screen.getAllByRole('link', { name: /Practice profile/ }).every((l) => l.getAttribute('aria-current'))).toBe(true);
  });

  it('shows the grouped rail to owners', async () => {
    hubAt('/dashboard/settings/availability');
    await screen.findByText('availability tab');
    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByText('Booking')).toBeTruthy();
    expect(screen.getByText('Domain & email')).toBeTruthy();
    expect(screen.getByText('Team & billing')).toBeTruthy();
  });

  it('an unknown tab falls back to the first visible one', async () => {
    hubAt('/dashboard/settings/nonsense');
    expect(await screen.findByText('profile tab')).toBeTruthy();
  });

  it('receptionists only manage themselves', async () => {
    profile = { role: 'RECEPTIONIST', type: 'receptionist', plan: 'CLINIC' };
    hubAt('/dashboard/settings');
    expect(await screen.findByText('availability tab')).toBeTruthy();
    expect(screen.queryByText('Practice profile')).toBeNull();
    expect(screen.queryByText('Team & staff')).toBeNull();
  });
});
