import { describe, expect, it } from 'vitest';
import { activeNavKey, practiceSections, planIncludes, settingsTabsFor } from '../practiceNav';

const hrefsOf = (s: ReturnType<typeof practiceSections>) => s.flatMap((x) => x.groups.flatMap((g) => g.items.map((i) => i.href)));

describe('practiceSections (GEN-03)', () => {
  it('gives owners the regrouped menu: Main, Forms & assessments, Settings, Reports, Payouts', () => {
    const sections = practiceSections({ role: 'OWNER' }, 'clinic');
    expect(sections.map((s) => s.key)).toEqual(['main', 'forms', 'settings', 'insights']);
    const hrefs = hrefsOf(sections);
    expect(hrefs).toEqual([
      '/dashboard',
      '/dashboard/schedule',
      '/dashboard/sessions',
      '/dashboard/clients',
      '/dashboard/submissions',
      '/dashboard/assessments',
      '/dashboard/settings/forms',
      '/dashboard/settings',
      '/dashboard/analytics',
      '/dashboard/settings/payouts',
    ]);
  });

  it('the settings area is ONE entry, and Notifications and Hours log are not in the sidebar', () => {
    const hrefs = hrefsOf(practiceSections({ role: 'OWNER' }, 'clinic'));
    expect(hrefs).not.toContain('/dashboard/hours');
    expect(hrefs).not.toContain('/dashboard/notifications');
    expect(hrefs.filter((h) => h === '/dashboard/settings')).toHaveLength(1);
  });

  it('renames Analytics to Reports and keeps the tour ids that still have a home', () => {
    const items = practiceSections({ role: 'OWNER' }, 'clinic').flatMap((s) => s.groups.flatMap((g) => g.items));
    expect(items.find((i) => i.href === '/dashboard/analytics')?.label).toBe('Reports');
    for (const tour of ['nav-sessions', 'nav-clients', 'nav-forms', 'nav-payouts']) {
      expect(items.some((i) => i.tourId === tour)).toBe(true);
    }
  });

  it('receptionists keep the same menu shape; deep settings are gated by tabs, not the sidebar', () => {
    const hrefs = hrefsOf(practiceSections({ role: 'RECEPTIONIST', type: 'receptionist' }, 'clinic'));
    expect(hrefs).not.toContain('/dashboard/hours');
    expect(hrefs).toContain('/dashboard/settings');
  });

  it('tags features outside the plan, and only those', () => {
    const items = practiceSections({ role: 'OWNER' }, 'starter').flatMap((s) => s.groups.flatMap((g) => g.items));
    expect(items.find((i) => i.href === '/dashboard/settings/forms')?.badge).toBeTruthy();
    expect(items.find((i) => i.href === '/dashboard/settings')?.badge).toBeFalsy();
    const clinic = practiceSections({ role: 'OWNER' }, 'clinic').flatMap((s) => s.groups.flatMap((g) => g.items));
    expect(clinic.every((i) => !i.badge)).toBe(true);
  });

  it('keeps planIncludes as it was', () => {
    expect(planIncludes('pro', 'pro')).toBe(true);
    expect(planIncludes('starter', 'clinic')).toBe(false);
  });
});

describe('settingsTabsFor (GEN-04)', () => {
  it('shows owners every tab, grouped in rail order', () => {
    const tabs = settingsTabsFor({ role: 'OWNER' });
    expect(tabs.map((t) => t.group)).toEqual(['Practice', 'Practice', 'Practice', 'Booking', 'Booking', 'Booking', 'Domain & email', 'Domain & email', 'Domain & email', 'Team & billing', 'Team & billing', 'Team & billing']);
    expect(tabs.map((t) => t.href)).toEqual([
      '/dashboard/settings/profile',
      '/dashboard/settings/locations',
      '/dashboard/settings/brand',
      '/dashboard/settings/availability',
      '/dashboard/settings/services',
      '/dashboard/settings/discounts',
      '/dashboard/settings/domain',
      '/dashboard/settings/notifications',
      '/dashboard/settings/sending-domain',
      '/dashboard/settings/team',
      '/dashboard/settings/subscription',
      '/dashboard/settings/account',
    ]);
  });

  it('receptionists and therapists only get their own availability and account', () => {
    for (const role of ['RECEPTIONIST', 'THERAPIST']) {
      const tabs = settingsTabsFor({ role: role as never, type: role.toLowerCase() });
      expect(tabs.map((t) => t.href)).toEqual([
        '/dashboard/settings/availability',
        '/dashboard/settings/account',
      ]);
    }
  });

  it('tags tabs outside the plan', () => {
    const tabs = settingsTabsFor({ role: 'OWNER' }, 'starter');
    expect(tabs.find((t) => t.href.endsWith('/team'))?.badgeTier).toBe('clinic');
    expect(tabs.find((t) => t.href.endsWith('/profile'))?.badgeTier).toBeUndefined();
  });
});

describe('activeNavKey', () => {
  const hrefs = ['/dashboard', '/dashboard/clients', '/dashboard/settings', '/dashboard/settings/payouts'];
  it('matches Overview only on its own path', () => {
    expect(activeNavKey('/dashboard', hrefs)).toBe('/dashboard');
    expect(activeNavKey('/', hrefs)).toBe('/dashboard');
    expect(activeNavKey('/dashboard/unknown', hrefs)).toBeUndefined();
  });
  it('highlights the parent of a nested page', () => {
    expect(activeNavKey('/dashboard/clients/53', hrefs)).toBe('/dashboard/clients');
    expect(activeNavKey('/dashboard/settings/brand', hrefs)).toBe('/dashboard/settings');
    expect(activeNavKey('/dashboard/settings/payouts', hrefs)).toBe('/dashboard/settings/payouts');
  });
  it('does not confuse a shared prefix', () => {
    expect(activeNavKey('/dashboard/clientsarchive', hrefs)).toBeUndefined();
  });
});
