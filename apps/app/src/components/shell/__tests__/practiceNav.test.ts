import { describe, expect, it } from 'vitest';
import { activeNavKey, practiceSections, planIncludes } from '../practiceNav';

const hrefsOf = (s: ReturnType<typeof practiceSections>) => s.flatMap((x) => x.groups.flatMap((g) => g.items.map((i) => i.href)));

describe('practiceSections', () => {
  it('gives owners the main menu and the full practice settings', () => {
    const hrefs = hrefsOf(practiceSections({ role: 'OWNER' }, 'clinic'));
    expect(hrefs).toContain('/dashboard/hours');
    expect(hrefs).toContain('/dashboard/settings/team');
    expect(hrefs).toContain('/dashboard/settings/payouts');
  });

  it('hides the hours log from receptionists and gives them availability only', () => {
    const hrefs = hrefsOf(practiceSections({ role: 'RECEPTIONIST', type: 'receptionist' }, 'clinic'));
    expect(hrefs).not.toContain('/dashboard/hours');
    expect(hrefs.filter((h) => h.startsWith('/dashboard/settings'))).toEqual(['/dashboard/settings/availability']);
  });

  it('tags features outside the plan, and only those', () => {
    const items = practiceSections({ role: 'OWNER' }, 'starter').flatMap((s) => s.groups.flatMap((g) => g.items));
    expect(items.find((i) => i.href === '/dashboard/settings/team')?.badge).toBeTruthy();
    expect(items.find((i) => i.href === '/dashboard/settings/profile')?.badge).toBeFalsy();
    const clinic = practiceSections({ role: 'OWNER' }, 'clinic').flatMap((s) => s.groups.flatMap((g) => g.items));
    expect(clinic.every((i) => !i.badge)).toBe(true);
  });

  it('keeps planIncludes as it was', () => {
    expect(planIncludes('pro', 'pro')).toBe(true);
    expect(planIncludes('starter', 'clinic')).toBe(false);
  });
});

describe('activeNavKey', () => {
  const hrefs = ['/dashboard', '/dashboard/clients', '/dashboard/settings/team', '/dashboard/settings/profile'];
  it('matches Overview only on its own path', () => {
    expect(activeNavKey('/dashboard', hrefs)).toBe('/dashboard');
    expect(activeNavKey('/', hrefs)).toBe('/dashboard');
    expect(activeNavKey('/dashboard/unknown', hrefs)).toBeUndefined();
  });
  it('highlights the parent of a nested page', () => {
    expect(activeNavKey('/dashboard/clients/53', hrefs)).toBe('/dashboard/clients');
    expect(activeNavKey('/dashboard/settings/team/', hrefs)).toBe('/dashboard/settings/team');
  });
  it('does not confuse a shared prefix', () => {
    expect(activeNavKey('/dashboard/clientsarchive', hrefs)).toBeUndefined();
  });
});
