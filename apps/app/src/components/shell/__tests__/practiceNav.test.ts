import { describe, expect, it } from 'vitest';
import { activeNavKey, bottomNavFor, practiceSections, settingsTabsFor } from '../practiceNav';
import { summary } from '../../../test/entitlementSummary';

const CLINIC = summary({ customDomain: true, bankTransferPayments: true, googleCalendarSync: true, staffInviteRoles: ['ADMIN', 'RECEPTIONIST', 'THERAPIST'] });
const hrefsOf = (s: ReturnType<typeof practiceSections>) => s.flatMap((x) => x.groups.flatMap((g) => g.items.map((i) => i.href)));

describe('practiceSections (GEN-03)', () => {
  it('gives owners the regrouped menu: Main (with My profile), Forms & assessments, Settings, Reports', () => {
    const sections = practiceSections({ role: 'OWNER' }, CLINIC);
    expect(sections.map((s) => s.key)).toEqual(['main', 'forms', 'settings', 'insights']);
    const hrefs = hrefsOf(sections);
    expect(hrefs).toEqual([
      '/dashboard',
      '/dashboard/profile',
      '/dashboard/schedule',
      '/dashboard/sessions',
      '/dashboard/clients',
      '/dashboard/submissions',
      '/dashboard/assessments',
      '/dashboard/settings',
      '/dashboard/analytics',
    ]);
  });

  it('the settings area is ONE entry, and Notifications and Hours log are not in the sidebar', () => {
    const hrefs = hrefsOf(practiceSections({ role: 'OWNER' }, CLINIC));
    expect(hrefs).not.toContain('/dashboard/hours');
    expect(hrefs).not.toContain('/dashboard/notifications');
    expect(hrefs.filter((h) => h === '/dashboard/settings')).toHaveLength(1);
  });

  it('renames Analytics to Reports and keeps the tour ids that still have a home', () => {
    const items = practiceSections({ role: 'OWNER' }, CLINIC).flatMap((s) => s.groups.flatMap((g) => g.items));
    expect(items.find((i) => i.href === '/dashboard/analytics')?.label).toBe('Reports');
    for (const tour of ['nav-sessions', 'nav-clients', 'nav-settings']) {
      expect(items.some((i) => i.tourId === tour)).toBe(true);
    }
  });

  it('receptionists keep the same menu shape; deep settings are gated by tabs, not the sidebar', () => {
    const hrefs = hrefsOf(practiceSections({ role: 'RECEPTIONIST', type: 'receptionist' }, CLINIC));
    expect(hrefs).not.toContain('/dashboard/hours');
    expect(hrefs).toContain('/dashboard/settings');
  });

  it('tags nothing the API does not gate: Forms is on every plan', () => {
    const items = practiceSections({ role: 'OWNER' }, summary()).flatMap((s) => s.groups.flatMap((g) => g.items));
    expect(items.every((i) => !i.badge)).toBe(true);
  });
});

describe('settingsTabsFor (GEN-04)', () => {
  it('shows owners every tab, grouped in rail order', () => {
    const tabs = settingsTabsFor({ role: 'OWNER' });
    expect(tabs.map((t) => t.group)).toEqual(['You', 'You', 'You', 'Practice', 'Practice', 'Practice', 'Practice', 'Practice', 'Practice', 'Booking page', 'Booking page', 'Booking page', 'Booking page', 'Money', 'Money']);
    expect(tabs.map((t) => t.href)).toEqual([
      '/dashboard/profile',
      '/dashboard/settings/account',
      '/dashboard/settings/notifications',
      '/dashboard/settings/profile',
      '/dashboard/settings/locations',
      '/dashboard/settings/team',
      '/dashboard/settings/services',
      '/dashboard/settings/availability',
      '/dashboard/settings/discounts',
      '/dashboard/settings/brand',
      '/dashboard/settings/domain',
      '/dashboard/settings/sending-domain',
      '/dashboard/settings/forms',
      '/dashboard/settings/payouts',
      '/dashboard/settings/subscription',
    ]);
  });

  it('receptionists and therapists only get their own availability and account', () => {
    for (const role of ['RECEPTIONIST', 'THERAPIST']) {
      const tabs = settingsTabsFor({ role: role as never, type: role.toLowerCase() });
      // Receptionists/therapists see: You group (My profile external, Account & preferences, Notifications), Practice group (Availability)
      // Internal tabs only: Account & preferences, Notifications, Availability
      expect(tabs.filter((t) => t.href.startsWith('/dashboard/settings/')).map((t) => t.href)).toEqual([
        '/dashboard/settings/account',
        '/dashboard/settings/notifications',
        '/dashboard/settings/availability',
      ]);
    }
  });

  it('tags tabs the plan does not include, with the plan that does', () => {
    const tabs = settingsTabsFor({ role: 'OWNER' }, summary());
    expect(tabs.find((t) => t.href.endsWith('/team'))?.badgeTier).toBe('Pro');
    expect(tabs.find((t) => t.href.endsWith('/domain'))?.badgeTier).toBe('Pro');
    expect(tabs.find((t) => t.href.endsWith('/brand'))?.badgeTier).toBeUndefined();
    expect(tabs.find((t) => t.href.endsWith('/profile'))?.badgeTier).toBeUndefined();
    const clinic = settingsTabsFor({ role: 'OWNER' }, CLINIC);
    expect(clinic.every((t) => !t.badgeTier)).toBe(true);
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

describe('profile-first practices (§6.8)', () => {
  const owner = { role: 'OWNER', type: 'therapist', onboardingIntent: 'PROFILE' };
  const hrefs = (sections: ReturnType<typeof practiceSections>) => sections.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => i.href)));

  it('lead with the profile and keep practice features under one "Set up booking" entry', () => {
    const sections = practiceSections(owner, null);
    expect(sections[0].groups[0].items.map((i) => i.href)).toEqual(['/dashboard/profile']);
    const booking = sections.find((s) => s.key === 'booking')!;
    expect(booking.label).toBe('Set up booking');
    expect(booking.collapsible).toBe(true);
    expect(booking.groups[0].items.map((i) => i.href)).toEqual(expect.arrayContaining(['/dashboard', '/dashboard/schedule', '/dashboard/clients']));
    expect(hrefs(sections)).toContain('/dashboard/settings');
    expect(bottomNavFor(owner).map((i) => i.href)).toEqual(['/dashboard/profile', '/dashboard/settings']);
  });

  it('go back to the full practice menu once booking is switched on', () => {
    const practice = { ...owner, onboardingIntent: 'PRACTICE' };
    expect(practiceSections(practice, null).find((s) => s.key === 'booking')).toBeUndefined();
    expect(practiceSections(practice, null)[0].groups[0].items[0].href).toBe('/dashboard');
    expect(bottomNavFor(practice)[0].href).toBe('/dashboard');
  });
});
