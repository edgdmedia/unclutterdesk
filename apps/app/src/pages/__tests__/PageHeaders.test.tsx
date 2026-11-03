import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup } from '@testing-library/react';
import { AppShell } from '@unclutterdesk/ui';
import { AuthProvider } from '../../context/AuthContext';
import { BrandProvider } from '@unclutterdesk/ui';

// Mock the API client
const get = vi.fn();
const post = vi.fn();
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } };
});

// Default profile for auth
const defaultProfile = {
  id: 'p1',
  firstName: 'Ada',
  lastName: 'Eze',
  email: 'ada@example.com',
  role: 'OWNER',
  permissions: [],
  practiceId: 'pr1',
};

// Default tenant locations
const defaultLocations = [{ id: 'loc1', name: 'Main', city: 'London', addressLine1: '1 High St', addressLine2: '', postcode: 'SW1 1AA', timezone: 'Europe/London' }];

// Default entitlements (FREE tier)
const defaultEntitlements = {
  tier: 'FREE',
  tierName: 'Free',
  upgradeTo: 'STARTER',
  upgradeToName: 'Starter',
  entitlements: {
    monthlyBookingLimit: 50,
    platformFeeBps: 0,
    bankTransferPayments: false,
    customDomain: false,
    staffInviteRoles: [],
    assessmentRank: 0,
    googleCalendarSync: false,
  },
  requiredTiers: {
    bankTransferPayments: 'PRO',
    customDomain: 'PRO',
    googleCalendarSync: 'STARTER',
    staff: 'STARTER',
    therapists: 'STARTER',
  },
  usage: { bookingsThisMonth: 0, bookingLimitReached: false },
};

const sidebar = {
  sections: [
    { key: 'main', groups: [{ key: 'main', items: [{ key: '/a', label: 'Overview', href: '/a', icon: <svg /> }] }] },
  ],
  brand: () => <span>brand</span>,
};
const bottomNav = { items: [{ key: '/a', label: 'Today', icon: <svg />, href: '/a' }] };

// matchMedia helper for jsdom (copied from @unclutterdesk/ui/test/matchMedia)
let _viewportWidth = 1280;
const _listeners = new Set<() => void>();
function installMatchMedia(initial = 1280) {
  _viewportWidth = initial;
  _listeners.clear();
  window.matchMedia = ((query: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0);
    return {
      get matches() {
        return _viewportWidth >= min;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, l: () => void) => _listeners.add(l),
      removeEventListener: (_type: string, l: () => void) => _listeners.delete(l),
      addListener: (l: () => void) => _listeners.add(l),
      removeListener: (l: () => void) => _listeners.delete(l),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}
function setViewportWidth(next: number) {
  _viewportWidth = next;
  _listeners.forEach((l) => l());
}

function shell(ui: React.ReactNode, { route = '/', profile = defaultProfile, locations = defaultLocations, entitlements = defaultEntitlements } = {}) {
  installMatchMedia(1440);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <BrandProvider brand={null}>
        <AuthProvider>
          <AppShell sidebar={sidebar} bottomNav={bottomNav} header={<button data-testid="bell">bell</button>}>
            {ui}
          </AppShell>
        </AuthProvider>
      </BrandProvider>
    </MemoryRouter>,
  );
}

function setupMocks({ profile = defaultProfile, locations = defaultLocations, entitlements = defaultEntitlements } = {}) {
  get.mockImplementation((p: string) => {
    if (p === '/v1/auth/status') return Promise.resolve({ profile });
    if (p === '/v1/tenant/locations') return Promise.resolve(locations);
    if (p === '/v1/entitlements') return Promise.resolve(entitlements);
    if (p === '/v1/assessments/library') return Promise.resolve([]);
    if (p === '/v1/assessments/sent') return Promise.resolve([]);
    if (p === '/v1/notifications') return Promise.resolve([]);
    if (p === '/v1/support/requests') return Promise.resolve([]);
    if (p === '/v1/schedule/sessions') return Promise.resolve([]);
    if (p === '/v1/calendar/clients') return Promise.resolve([]);
    if (p === '/v1/intake/submissions') return Promise.resolve([]);
    if (p === '/v1/practice/profile') return Promise.resolve({ name: 'Test Practice', description: '' });
    if (p === '/v1/practice/brand') return Promise.resolve({ primaryColor: '#0F3A53', logoUrl: null, welcomeMarkdown: '' });
    if (p === '/v1/practice/booking-link') return Promise.resolve({ slug: 'test-practice' });
    if (p === '/v1/practice/services') return Promise.resolve([]);
    if (p === '/v1/billing/subscription') return Promise.resolve({ subscriptionTier: 'FREE', complimentaryUntil: null, nextBillingDate: null, nextChargeAmount: null });
    if (p === '/v1/forms/templates') return Promise.resolve([]);
    return Promise.resolve({});
  });
  post.mockImplementation(() => Promise.resolve({}));
}

describe('PageHeader on practice pages (Task 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });
  afterEach(() => cleanup());

  it('AssessmentsPage renders one header with bell', async () => {
    const { AssessmentsPage } = await import('../practice/AssessmentsPage');
    shell(<AssessmentsPage />);
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('MyProfilePage (standalone) renders one header with bell', async () => {
    const { MyProfilePage } = await import('../practice/MyProfilePage');
    shell(<MyProfilePage />, { route: '/dashboard/profile?tab=practice' });
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('NotificationsPage renders one header with bell', async () => {
    const { NotificationsPage } = await import('../practice/NotificationsPage');
    shell(<NotificationsPage />);
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('RequestsPage renders one header with bell', async () => {
    const { RequestsPage } = await import('../practice/RequestsPage');
    shell(<RequestsPage />);
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('SchedulePage renders one header with bell', async () => {
    const { SchedulePage } = await import('../practice/SchedulePage');
    const sessions: any[] = [];
    const setSessions = vi.fn();
    const clients: any[] = [];
    shell(<SchedulePage sessions={sessions} setSessions={setSessions} clients={clients} tenantSlug="test" onRefresh={vi.fn()} />);
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('SessionPrepPage renders one header with bell', async () => {
    const { SessionPrepPage } = await import('../practice/SessionPrepPage');
    // SessionPrepPage uses useParams, so provide the route
    shell(<SessionPrepPage />, { route: '/session/abc123/prep' });
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('SubmissionsPage renders one header with bell', async () => {
    const { SubmissionsPage } = await import('../practice/SubmissionsPage');
    shell(<SubmissionsPage />);
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });
});

describe('PageHeader on settings pages (Task 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });
  afterEach(() => cleanup());

  it('AccountPreferencesPage renders one header with bell', async () => {
    const { AccountPreferencesPage } = await import('../practice/settings/AccountPreferencesPage');
    shell(<AccountPreferencesPage />);
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('PayoutSettingsPage renders one header with bell', async () => {
    const { PayoutSettingsPage } = await import('../practice/settings/PayoutSettingsPage');
    shell(<PayoutSettingsPage />);
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('PracticeProfilePage renders one header with bell', async () => {
    const { PracticeProfilePage } = await import('../practice/settings/PracticeProfilePage');
    shell(<PracticeProfilePage />);
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('BrandSettingsPage renders one header with bell', async () => {
    const { BrandSettingsPage } = await import('../practice/settings/BrandSettingsPage');
    shell(<BrandSettingsPage />);
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('ServicesSettingsPage renders one header with bell', async () => {
    const { ServicesSettingsPage } = await import('../practice/settings/ServicesSettingsPage');
    shell(<ServicesSettingsPage />);
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('SubscriptionSettingsPage renders one header with bell', async () => {
    const { SubscriptionSettingsPage } = await import('../practice/settings/SubscriptionSettingsPage');
    shell(<SubscriptionSettingsPage />);
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('FormsManagerPage renders one header with bell', async () => {
    const { FormsManagerPage } = await import('../practice/settings/FormsManagerPage');
    shell(<FormsManagerPage />);
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('FormEditorPage renders one header with bell', async () => {
    const { FormEditorPage } = await import('../practice/settings/FormEditorPage');
    shell(<FormEditorPage />, { route: '/dashboard/settings/forms/new' });
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('[data-testid="bell"]')).toBeTruthy();
  });

  it('SettingsPage (SettingsHub shell) is headerless by design', async () => {
    const { SettingsHub } = await import('../practice/settings/SettingsPage');
    shell(<SettingsHub />);
    await vi.waitFor(() => expect(screen.getByTestId('bell')).toBeTruthy());
    // SettingsHub is a shell; the frame header bar appears (no PageHeader inside)
    const appHeaderBar = screen.getByTestId('app-header');
    expect(appHeaderBar).toBeTruthy();
    expect(appHeaderBar.textContent).toBe('bell');
  });
});