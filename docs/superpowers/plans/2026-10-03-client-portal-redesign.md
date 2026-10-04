# Client Portal Redesign Implementation Plan (POR-03, POR-04, POR-05)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The client portal stops being one 662-line tabbed page and becomes a small branded dashboard in the same frame as the practice and admin apps: sidebar on desktop, bottom bar on phones, the bell in the header, five pages (Home, Sessions, Forms & assessments, Payments, My details), "Book a session", and "Add to calendar" on every upcoming session.

**Architecture:**
- **One data source, many pages.** A `PortalDataProvider` mounted once in `ClientShell` loads the portal payload, forms to do and assessments, and clears all of it the moment the person is signed out (keeps the POR-06 fix). Pages read it with `usePortalData()`, so moving between pages never refetches or flashes empty. Payments stays lazy: fetched only when the Payments page mounts.
- **Menus are data, rendered by the shared shell.** `clientNav.tsx` defines the menu; `ClientShell` renders it with the same `AppShell`, `Sidebar` and `BottomNav` the practice uses, branded by `useBrand()`.
- **Move code, don't rewrite it.** Each section of `ClientPortalPage.tsx` moves into its page with its markup and behaviour intact; only the tab bar and the outer `<main>` go away (pages use `Page` from `packages/ui`).
- **Reuse, don't duplicate.** The confirmation step's `CalendarMenu` and `googleCalendarUrl` move into one shared `AddToCalendar` component used by both the booking wizard and the portal.

**Tech Stack:** React 18, React Router 6, Vite, Tailwind (container queries via `Page`), `packages/ui` (`AppShell`, `Sidebar`, `BottomNav`, `Page`, `Grid`, `MetricTile`, `useBrand`), vitest + `renderWithApp`.

**Spec:** `docs/testing-feedback.md` → POR-03, POR-04, POR-05 (decisions of 2 Oct 2026). Read those three entries, and POR-01, POR-02, POR-06 for what must not regress.

**Depends on:** `docs/superpowers/plans/2026-10-02-app-frame-and-navigation.md` Task 1 (`Page layout="main-aside"`, done in `267a754`) and **Task 3** (`AppShell` `header` slot, `NotificationBell`, `useUnreadNotifications`). Do Task 3 of that plan first. This plan **replaces** that plan's Task 6 and Task 6 of `2026-10-02-sessions-and-reminders.md` (Task 1 below marks both as moved here).

**Not in this plan:** the client's reminder settings (NOT-13) stay in `2026-10-02-sessions-and-reminders.md` Task 7. That task adds its "Reminders and notifications" card to the `PortalDetailsPage` built here and its per-session "Reminders: … · Change" line to `PortalSessionCard`.

## Global Constraints

- **Menu (exact labels, order, routes):** Home `/portal`, Sessions `/portal/sessions`, Forms & assessments `/portal/forms`, Payments `/portal/payments`, My details `/portal/details`.
- **Phone bottom bar:** Home, Sessions, Forms, Payments. My details is reached from the account menu and "More".
- **Routes kept unchanged:** `/portal/assessments/:id`, `/portal/sessions/:id/room` (full-screen, no shell), `/forms/:id`, `/login`, `/set-password`. Added: `/portal/notifications`.
- **Both hosts:** every portal route lives in `routes/clientRoutes.tsx` (`CLIENT_PORTAL_ROUTES`), rendered by both the app tree and the practice-host tree (POR-01).
- **Brand:** the practice's logo, name and colours from `useBrand()` (`ClientBrandProvider` on the practice host). No Unclutter Desk logo in the client frame.
- **Signed out:** no shell, no menu, no private data. `/portal/*` shows the existing "Sign in to see your sessions" card on its own, branded (POR-06: never signed in and signed out at once).
- **Book a session:** on the practice host, `/book`; on `app.unclutterdesk.com`, `${getBookingUrl(brand.slug)}/book`. Same tab.
- **Add to calendar:** a dropdown with "Download (.ics)" → `${API_BASE}/v1/calendar/bookings/:id/ical?token=<icalToken>` and "Google Calendar" (title "<service> with <therapist>", the session's start/end). Only on upcoming sessions that aren't cancelled. The portal payload already carries `icalToken` (`consult.service.ts:1655`); no API change.
- **Copy:** sentence case, plain words, no "Oops". Empty states say what to do next.
- **Tests:** `renderWithApp` with real providers; fake only `utils/apiClient` and `context/AuthContext` (house rule: enterprise grade, fake only the network). Run app tests with `cd apps/app && npx vitest run --maxWorkers=2 --minWorkers=1`. Every page checked at 390px and 1280px, on the practice host.

## Review Focus

1. **Signed out mid-visit on a sub-page** (`/portal/payments`, cookie expired): the shell and the payments disappear together and only the sign-in card shows. Pinned in Task 2.
2. **A client with no sessions at all** (signed up, never booked): Home shows "Book your first session" as the main action, not an empty hero or "undefined". Pinned in Task 3.
3. **The portal on app.unclutterdesk.com** (no practice subdomain): "Book a session" points at the practice's own host, never `https://.unclutterdesk.com`. Pinned in Task 5.
4. **A cancelled or past session:** no "Add to calendar", no Reschedule. Pinned in Task 6.
5. **Rescheduling from the Sessions page** refreshes Home's next-session tile too (shared data reloads; payments marked stale). Pinned in Task 4.

---

## File Structure

- `apps/app/src/components/shell/clientNav.tsx` (new): `CLIENT_NAV`, `CLIENT_BOTTOM_NAV`, `clientSections()`.
- `apps/app/src/components/shell/ClientShell.tsx` (new): the frame; renders the sign-in card instead when signed out.
- `apps/app/src/components/shell/ClientAccountMenu.tsx` (new): name, email, My details, Sign out.
- `apps/app/src/pages/client/portal/PortalDataContext.tsx` (new): `PortalDataProvider`, `usePortalData()`, the shared types.
- `apps/app/src/pages/client/portal/portalFormat.ts` (new): `formatDay`, `formatMoney`, `formatDateParts`, `formatTimeRange`, `paymentState` (moved verbatim).
- `apps/app/src/pages/client/portal/DateTile.tsx`, `PortalSessionCard.tsx`, `BookSessionButton.tsx`, `PortalSignIn.tsx` (new, moved or extracted).
- `apps/app/src/pages/client/portal/PortalHomePage.tsx`, `PortalSessionsPage.tsx`, `PortalFormsPage.tsx`, `PortalPaymentsPage.tsx`, `PortalDetailsPage.tsx` (new).
- `apps/app/src/pages/public/booking/AddToCalendar.tsx` (new): extracted from `ConfirmationStep.tsx`.
- `apps/app/src/routes/clientRoutes.tsx`: nested portal routes under `ClientShell`.
- `apps/app/src/pages/client/ClientPortalPage.tsx`: deleted at the end of Task 4.
- Tests: `apps/app/src/pages/client/portal/__tests__/*.test.tsx`, `apps/app/src/components/shell/__tests__/clientNav.test.ts`, `apps/app/src/pages/public/booking/AddToCalendar.test.tsx`; the three existing portal tests (`ClientPortalPayments`, `ClientPortalSignedOut`, `PortalJoin`) move their imports to the new pages.

---

### Task 1: The client menu as data

**Files:**
- Create: `apps/app/src/components/shell/clientNav.tsx`
- Test: `apps/app/src/components/shell/__tests__/clientNav.test.ts`
- Modify: `docs/superpowers/plans/2026-10-02-app-frame-and-navigation.md` (Task 6 heading gets "— moved to 2026-10-03-client-portal-redesign.md"), `docs/superpowers/plans/2026-10-02-sessions-and-reminders.md` (Task 6 likewise)

**Interfaces:**
- Produces:
  - `CLIENT_NAV: { href: string; label: string; icon: LucideIcon }[]` (five items, Global Constraints order)
  - `CLIENT_BOTTOM_NAV: { href: string; label: string; icon: LucideIcon }[]` (four items)
  - `clientSections(formsTodo?: number): SidebarSection[]` (one section, one group; Forms & assessments gets a count badge when `formsTodo > 0`)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { CLIENT_NAV, CLIENT_BOTTOM_NAV, clientSections } from '../clientNav';

describe('client menu', () => {
  it('lists the five portal pages in order', () => {
    expect(CLIENT_NAV.map((i) => [i.label, i.href])).toEqual([
      ['Home', '/portal'],
      ['Sessions', '/portal/sessions'],
      ['Forms & assessments', '/portal/forms'],
      ['Payments', '/portal/payments'],
      ['My details', '/portal/details'],
    ]);
  });

  it('gives phones Home, Sessions, Forms and Payments', () => {
    expect(CLIENT_BOTTOM_NAV.map((i) => i.label)).toEqual(['Home', 'Sessions', 'Forms', 'Payments']);
  });

  it('badges Forms & assessments only when something is waiting', () => {
    const item = (n?: number) => clientSections(n)[0].groups[0].items.find((i) => i.href === '/portal/forms')!;
    expect(item(0).badge).toBeUndefined();
    expect(item(undefined).badge).toBeUndefined();
    expect(item(2).badge).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd apps/app && npx vitest run src/components/shell/__tests__/clientNav.test.ts`
Expected: FAIL, cannot resolve `../clientNav`.

- [ ] **Step 3: Implement**

```tsx
import { ClipboardList, CreditCard, FileText, Home, UserRound, type LucideIcon } from 'lucide-react';
import type { SidebarSection } from '@unclutterdesk/ui';

interface ClientNavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** POR-03: the portal menu, decided 2 Oct 2026. */
export const CLIENT_NAV: ClientNavEntry[] = [
  { href: '/portal', label: 'Home', icon: Home },
  { href: '/portal/sessions', label: 'Sessions', icon: ClipboardList },
  { href: '/portal/forms', label: 'Forms & assessments', icon: FileText },
  { href: '/portal/payments', label: 'Payments', icon: CreditCard },
  { href: '/portal/details', label: 'My details', icon: UserRound },
];

/** The phone's bottom bar; My details is under "More" and the account menu. */
export const CLIENT_BOTTOM_NAV: ClientNavEntry[] = [
  { href: '/portal', label: 'Home', icon: Home },
  { href: '/portal/sessions', label: 'Sessions', icon: ClipboardList },
  { href: '/portal/forms', label: 'Forms', icon: FileText },
  { href: '/portal/payments', label: 'Payments', icon: CreditCard },
];

export function clientSections(formsTodo?: number): SidebarSection[] {
  return [
    {
      key: 'portal',
      groups: [
        {
          key: 'main',
          items: CLIENT_NAV.map((i) => ({
            key: i.href,
            label: i.label,
            href: i.href,
            icon: <i.icon strokeWidth={2.5} />,
            badge:
              i.href === '/portal/forms' && formsTodo && formsTodo > 0 ? (
                <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--brand-primary,#0F3A53)] text-white text-[11px] font-bold grid place-items-center">
                  {formsTodo}
                </span>
              ) : undefined,
          })),
        },
      ],
    },
  ];
}
```

- [ ] **Step 4: Run it**

Run: `cd apps/app && npx vitest run src/components/shell/__tests__/clientNav.test.ts`
Expected: PASS.

- [ ] **Step 5: Mark the two superseded tasks** in the two older plans (one line each under the heading: "Moved to `2026-10-03-client-portal-redesign.md`.").

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/components/shell/clientNav.tsx apps/app/src/components/shell/__tests__/clientNav.test.ts docs/superpowers/plans/2026-10-02-app-frame-and-navigation.md docs/superpowers/plans/2026-10-02-sessions-and-reminders.md
git commit -m "POR-03: the client portal's menu as data: Home, Sessions, Forms & assessments, Payments, My details"
```

---

### Task 2: Shared portal data and the client frame

**Files:**
- Create: `apps/app/src/pages/client/portal/PortalDataContext.tsx`, `apps/app/src/pages/client/portal/PortalSignIn.tsx`, `apps/app/src/components/shell/ClientShell.tsx`, `apps/app/src/components/shell/ClientAccountMenu.tsx`
- Test: `apps/app/src/pages/client/portal/__tests__/ClientShell.test.tsx`

**Interfaces:**
- Consumes: `clientSections`, `CLIENT_BOTTOM_NAV` (Task 1); `activeNavKey(pathname, hrefs)` from `practiceNav.tsx`; `RouterLink`; `AppShell` `header` slot and `NotificationBell({ allHref })` (app-frame plan Task 3).
- Produces:
  - Types `PortalSession`, `PortalPayload`, `Payment`, `PaymentsPayload` (moved verbatim from `ClientPortalPage.tsx:16-53`).
  - `PortalDataProvider({ children })` and `usePortalData(): { portal: PortalPayload; loading: boolean; error: string | null; reload(): Promise<void>; formsTodo: number | null; assessments: MyAssessment[]; waitingAssessments: MyAssessment[]; hasReviewForm: boolean; paymentsStale: number; markPaymentsStale(): void }`. `paymentsStale` is a counter the Payments page lists in its effect dependencies, so a reschedule elsewhere forces a refetch.
  - `ClientShell({ children })`: signed out → `<PortalSignIn />` only; signed in → `PortalDataProvider` + `AppShell`.
  - `PortalSignIn()`: the "Sign in to see your sessions" card from `ClientPortalPage.tsx:~325-345`, moved verbatim, plus the practice logo.

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { useSyncExternalStore } from 'react';
import { act } from 'react';
import { Routes, Route } from 'react-router-dom';
import { renderWithApp, screen, waitFor, cleanup, within } from '../../../../test/renderWithApp';

const apiGet = vi.fn();
vi.mock('../../../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), patch: vi.fn() },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
  getAppType: () => 'booking',
  TENANT_SLUG: 'dr-smith',
  API_BASE: '',
}));

let signedIn = true;
const listeners = new Set<() => void>();
const setSignedIn = (v: boolean) => { signedIn = v; listeners.forEach((l) => l()); };
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => {
    const on = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => signedIn);
    return on
      ? { isAuthenticated: true, profile: { email: 'ada@example.com', type: 'user', firstName: 'Ada' }, logout: vi.fn() }
      : { isAuthenticated: false, profile: null, logout: vi.fn() };
  },
}));

const { ClientShell } = await import('../../../../components/shell/ClientShell');
const { usePortalData } = await import('../PortalDataContext');

function Probe() {
  const { portal } = usePortalData();
  return <p>{portal.upcoming.length} upcoming</p>;
}

apiGet.mockImplementation((path: string) => {
  if (path === '/v1/consult/portal') return Promise.resolve({ clientName: 'Ada Obi', upcoming: [{ id: '9' }], past: [] });
  if (path === '/v1/intake/mine/forms') return Promise.resolve([{ id: '1' }, { id: '2' }]);
  return Promise.resolve([]);
});

afterEach(() => { cleanup(); signedIn = true; apiGet.mockClear(); });

const renderAt = (path: string) =>
  renderWithApp(
    <Routes><Route path="/portal/*" element={<ClientShell><Probe /></ClientShell>} /></Routes>,
    { route: path },
  );

describe('ClientShell', () => {
  it('shows the five menu items, the bell and the shared data', async () => {
    renderAt('/portal');
    for (const label of ['Home', 'Sessions', 'Forms & assessments', 'Payments', 'My details']) {
      expect(await screen.findAllByRole('link', { name: new RegExp(label) })).not.toHaveLength(0);
    }
    expect(screen.getByRole('button', { name: /Notifications/ })).toBeInTheDocument();
    expect(await screen.findByText('1 upcoming')).toBeInTheDocument();
  });

  it('loads the portal once, not once per page', async () => {
    renderAt('/portal/payments');
    await screen.findByText('1 upcoming');
    expect(apiGet.mock.calls.filter(([p]) => p === '/v1/consult/portal')).toHaveLength(1);
  });

  it('drops the frame and the data together when the person is signed out (Review Focus 1)', async () => {
    renderAt('/portal/payments');
    await screen.findByText('1 upcoming');
    act(() => setSignedIn(false));
    await waitFor(() => expect(screen.queryByText('1 upcoming')).not.toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /My details/ })).not.toBeInTheDocument();
    expect(screen.getByText('Sign in to see your sessions')).toBeInTheDocument();
  });
});
```

Check `renderWithApp`'s option name for the initial route in `apps/app/src/test/renderWithApp.tsx` and use it (the test above assumes `{ route }`).

- [ ] **Step 2: Run them**

Run: `cd apps/app && npx vitest run src/pages/client/portal/__tests__/ClientShell.test.tsx --maxWorkers=2 --minWorkers=1`
Expected: FAIL, cannot resolve `ClientShell`.

- [ ] **Step 3: Implement `PortalDataContext.tsx`.** Move the four effects from `ClientPortalPage.tsx:135-223` (review-form availability, portal load with signed-out clearing, forms to do, assessments) into the provider unchanged, including the comments. Add:

```tsx
const [paymentsStale, setPaymentsStale] = useState(0);
const markPaymentsStale = useCallback(() => setPaymentsStale((n) => n + 1), []);
const waitingAssessments = useMemo(() => assessments.filter((a) => a.status === 'SENT'), [assessments]);

const PortalDataContext = createContext<PortalData | null>(null);
export function usePortalData(): PortalData {
  const value = useContext(PortalDataContext);
  if (!value) throw new Error('usePortalData must be used inside PortalDataProvider');
  return value;
}
```

- [ ] **Step 4: Implement `ClientAccountMenu.tsx`** by copying the shape of `AdminAccountMenu.tsx` (same trigger, same menu primitives): the client's name and email, **My details** (`/portal/details`) and **Sign out** (`useAuth().logout()`, then `navigate('/portal')`).

- [ ] **Step 5: Implement `ClientShell.tsx`.**

```tsx
import { useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell, useBrand } from '@unclutterdesk/ui';
import { useAuth } from '../../context/AuthContext';
import { PracticeLogo } from '../public/PracticeLogo';
import { PortalDataProvider, usePortalData } from '../../pages/client/portal/PortalDataContext';
import { PortalSignIn } from '../../pages/client/portal/PortalSignIn';
import { CLIENT_BOTTOM_NAV, CLIENT_NAV, clientSections } from './clientNav';
import { activeNavKey } from './practiceNav';
import { RouterLink } from './RouterLink';
import { ClientAccountMenu } from './ClientAccountMenu';
import { NotificationBell } from './NotificationBell';

const HREFS = CLIENT_NAV.map((i) => i.href);

/**
 * POR-03: the portal in the same frame as the practice and admin apps, in the
 * practice's brand. Signed out there is no frame at all: only the sign-in card,
 * so the page can never claim both states at once (POR-06).
 */
export function ClientShell({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <PortalSignIn />;
  return (
    <PortalDataProvider>
      <ClientFrame>{children}</ClientFrame>
    </PortalDataProvider>
  );
}

function ClientFrame({ children }: { children: ReactNode }) {
  const brand = useBrand();
  const { formsTodo } = usePortalData();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const sections = useMemo(() => clientSections(formsTodo ?? undefined), [formsTodo]);
  const activeKey = activeNavKey(location.pathname, HREFS);

  return (
    <AppShell
      sidebar={{
        sections,
        activeKey,
        LinkComponent: RouterLink,
        brand: (mode) => (
          <div className="flex items-center gap-2.5 min-w-0">
            <PracticeLogo size={mode === 'rail' ? 32 : 36} />
            {mode !== 'rail' ? <span className="truncate text-[14.5px] font-bold text-[#0F172A]">{brand.name}</span> : null}
          </div>
        ),
        account: (mode) => <ClientAccountMenu mode={mode} />,
      }}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      bottomNav={{
        items: CLIENT_BOTTOM_NAV.map((i) => ({ key: i.href, label: i.label, href: i.href, icon: <i.icon strokeWidth={2.5} /> })),
        active: activeKey,
        LinkComponent: RouterLink,
      }}
      header={<NotificationBell allHref="/portal/notifications" />}
    >
      {children}
    </AppShell>
  );
}
```

Check `PracticeLogo`'s props in `components/public/PracticeLogo.tsx` and match them; check `activeNavKey` picks `/portal` only for exactly `/portal` (longest-prefix match), otherwise every page highlights Home. If it doesn't, add a case to `practiceNav.test.ts` and fix `activeNavKey` there.

- [ ] **Step 6: Implement `PortalSignIn.tsx`** by moving the sign-in card markup verbatim, wrapped in a centred branded column with `PracticeLogo`.

- [ ] **Step 7: Run the tests**

Run: `cd apps/app && npx vitest run src/pages/client/portal/__tests__/ClientShell.test.tsx src/components/shell --maxWorkers=2 --minWorkers=1`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/app/src/components/shell/ClientShell.tsx apps/app/src/components/shell/ClientAccountMenu.tsx apps/app/src/pages/client/portal
git commit -m "POR-03: ClientShell and shared portal data; signed out shows only the sign-in card"
```

---

### Task 3: Home page

**Files:**
- Create: `apps/app/src/pages/client/portal/portalFormat.ts`, `DateTile.tsx`, `PortalHomePage.tsx`, `BookSessionButton.tsx`
- Test: `apps/app/src/pages/client/portal/__tests__/PortalHomePage.test.tsx`

**Interfaces:**
- Consumes: `usePortalData()` (Task 2).
- Produces: `PortalHomePage()`; `DateTile({ startsAt, size })`; `BookSessionButton({ variant?: 'primary' | 'secondary'; label?: string })` (Task 5 fills in its href logic; here it links to `/book`).

Home, top to bottom, inside `<Page layout="main-aside" header={<PageHeader eyebrow={brand.name} title={`Hello, ${firstName}`} actions={<BookSessionButton />} />} aside={…}>`:
- **Main:** the incomplete-booking banner (moved from `ClientPortalPage.tsx:~285-322`), the four POR-02 tiles in `<Grid cols={{ base: 2, lg: 4 }}>`, the next-session hero (moved from `~348-385`, with Reschedule and `JoinButton`), and "Your practitioner sent you …" assessment prompts (moved from `~390-408`).
- **Aside:** "Coming up" (the next three upcoming sessions after the hero, each a link to `/portal/sessions`) and a "Forms to do" card linking to `/portal/forms` when `formsTodo > 0`.
- **No sessions at all** (Review Focus 2): the hero becomes a card "You have no sessions booked yet" with `<BookSessionButton label="Book your first session" />`.

- [ ] **Step 1: Write the failing tests** (same mocks as Task 2's test; render `<ClientShell><PortalHomePage /></ClientShell>` at `/portal`):

```tsx
it('greets the client and shows the four tiles and the next session', async () => {
  renderHome({ upcoming: [SESSION], past: [] });
  expect(await screen.findByRole('heading', { name: 'Hello, Ada' })).toBeInTheDocument();
  for (const t of ['Next session', 'Upcoming sessions', 'To pay', 'Forms to do']) expect(screen.getByText(t)).toBeInTheDocument();
  expect(screen.getByText('Individual Therapy')).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /Book a session/ })[0]).toHaveAttribute('href', '/book');
});

it('offers the first booking when there are no sessions (Review Focus 2)', async () => {
  renderHome({ upcoming: [], past: [] });
  expect(await screen.findByText('You have no sessions booked yet')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Book your first session' })).toHaveAttribute('href', '/book');
  expect(screen.queryByText(/undefined|NaN/)).not.toBeInTheDocument();
});
```

`renderHome(payload)` sets `apiGet` for `/v1/consult/portal` to resolve `{ clientName: 'Ada Obi', ...payload }`. `SESSION` is the fixture from `ClientPortalSignedOut.test.tsx` plus `priceKobo: '2500000'`, `icalToken: 'tok'`.

- [ ] **Step 2: Run them.** `cd apps/app && npx vitest run src/pages/client/portal/__tests__/PortalHomePage.test.tsx --maxWorkers=2 --minWorkers=1`. Expected: FAIL.

- [ ] **Step 3: Implement.** Move the helpers at `ClientPortalPage.tsx:55-112` verbatim into `portalFormat.ts` and `DateTile.tsx` (export each). Build `PortalHomePage` from the moved blocks. Keep `RescheduleDialog` handling local to the page: on success call `reload()` and `markPaymentsStale()`, and show the notice "Your session has been moved. The new time is below."

- [ ] **Step 4: Run them.** Expected: PASS.

- [ ] **Step 5: Commit** `"POR-03: portal Home: greeting, tiles, next session, coming up, forms to do"`.

---

### Task 4: Sessions, Forms & assessments, Payments and My details; routes; old page removed

**Files:**
- Create: `apps/app/src/pages/client/portal/PortalSessionCard.tsx`, `PortalSessionsPage.tsx`, `PortalFormsPage.tsx`, `PortalPaymentsPage.tsx`, `PortalDetailsPage.tsx`
- Modify: `apps/app/src/routes/clientRoutes.tsx`, `apps/app/src/routes/clientRoutes.test.tsx`
- Move tests: `apps/app/src/pages/__tests__/ClientPortalPayments.test.tsx`, `ClientPortalSignedOut.test.tsx`, `PortalJoin.test.tsx` → `apps/app/src/pages/client/portal/__tests__/` (imports only)
- Test: `apps/app/src/pages/client/portal/__tests__/PortalPages.test.tsx`
- Delete: `apps/app/src/pages/client/ClientPortalPage.tsx`

**Interfaces:**
- Consumes: `usePortalData()`, `DateTile`, `portalFormat`, `BookSessionButton`.
- Produces: `PortalSessionCard({ session, onReschedule }: { session: PortalSession; onReschedule(id: string): void })` (Task 6 adds Add to calendar to it; NOT-13 adds its reminder line to it).

Pages:
- **Sessions:** header action `BookSessionButton`; a two-option segmented control "Upcoming" / "Past" (state in the `?view=past` search param, so Back works); upcoming rows are `PortalSessionCard` (moved from the old Upcoming tab, `~424-453`); past rows are moved from `~455-486`, with the review link where `hasReviewForm`.
- **Forms & assessments:** "To do": the forms from `/v1/intake/mine/forms` (each links to `/forms/:id`; extend `PortalDataContext` to keep the list as `formsList: Array<{ id: string; title?: string }>` and derive `formsTodo` from it), then the assessments list moved from `~488-521`. Empty: "Nothing to fill in. Your practitioner will send forms here when they need them."
- **Payments:** moved from `~523-611`, with its own lazy effect: `useEffect(() => { … api.get('/v1/consult/portal/payments') … }, [paymentsStale])`.
- **My details:** the client's name and email (read-only, from `useAuth().profile`), the Preferences block moved from `~613-641`, and **Sign out**. NOT-13 adds its reminder card here later.

Routes in `clientRoutes.tsx`:

```tsx
<Route path="/portal" element={<ClientShell><Outlet /></ClientShell>}>
  <Route index element={<PortalHomePage />} />
  <Route path="sessions" element={<PortalSessionsPage />} />
  <Route path="forms" element={<PortalFormsPage />} />
  <Route path="payments" element={<PortalPaymentsPage />} />
  <Route path="details" element={<PortalDetailsPage />} />
  <Route path="notifications" element={<NotificationsPage />} />
  <Route path="assessments/:id" element={<PortalAssessmentPage />} />
</Route>
<Route path="/portal/sessions/:id/room" element={<ClientSessionRoomPage />} />
```

The room stays outside the shell (full-screen video). Check `NotificationsPage` works for a client (it calls `/v1/notifications`, which has no role restriction); if it hard-codes `/dashboard` links, give it an `allHref`/`basePath` prop rather than copying it.

- [ ] **Step 1: Write the failing tests** in `PortalPages.test.tsx`, one `it` per page, rendering `CLIENT_PORTAL_ROUTES` inside `<Routes>` at the page's path:
  - `/portal/sessions` lists the upcoming session with Reschedule and Join; `?view=past` lists the past one;
  - `/portal/forms` lists "Client intake" linking to `/forms/1`, and an assessment linking to `/portal/assessments/:id`;
  - `/portal/payments` fetches `/v1/consult/portal/payments` only on this page, and shows the totals;
  - `/portal/details` shows ada@example.com and a Sign out button;
  - `/portal/sessions/9/room` renders without the menu;
  - **Review Focus 5:** rescheduling on `/portal/sessions` (mock `RescheduleDialog`'s `onRescheduled` by clicking through, or call the API mock) causes a second `/v1/consult/portal` call, and then navigating to `/portal/payments` fetches payments again.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the pages by moving code. Update `clientRoutes.tsx` (lazy imports like the existing ones) and `clientRoutes.test.tsx`. Move the three existing portal tests, changing only imports and the rendered element (`CLIENT_PORTAL_ROUTES` at the right path). Delete `ClientPortalPage.tsx`; `grep -rn "ClientPortalPage" apps/app/src` must return nothing.
- [ ] **Step 4: Run** the whole app suite and the type check: `cd apps/app && npx vitest run --maxWorkers=2 --minWorkers=1 && npx tsc --noEmit -p .`. Expected: PASS, 0 errors. The route-integrity test (`utils/__tests__/route-integrity.test.ts`) must pass with the new routes.
- [ ] **Step 5: Commit** `"POR-03: the portal is five pages in the shared frame; the tabbed page is gone"`.

---

### Task 5: Book a session from the portal (POR-04)

**Files:**
- Modify: `apps/app/src/pages/client/portal/BookSessionButton.tsx`
- Test: `apps/app/src/pages/client/portal/__tests__/BookSessionButton.test.tsx`

**Interfaces:**
- Consumes: `getAppType()`, `getBookingUrl(slug)` from `utils/apiClient`; `useBrand().slug`.
- Produces: `bookingHref(appType: string, slug: string | null | undefined): string` (exported for the test).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
vi.mock('../../../../utils/apiClient', () => ({
  getAppType: vi.fn(),
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
}));
const { bookingHref } = await import('../BookSessionButton');

describe('bookingHref', () => {
  it('stays on the practice host', () => {
    expect(bookingHref('booking', 'dr-smith')).toBe('/book');
  });
  it("goes to the practice's own host from app.unclutterdesk.com (Review Focus 3)", () => {
    expect(bookingHref('app', 'dr-smith')).toBe('https://dr-smith.unclutterdesk.com/book');
  });
  it('never builds a host with no practice', () => {
    expect(bookingHref('app', '')).toBe('/book');
    expect(bookingHref('app', null)).toBe('/book');
  });
});
```

- [ ] **Step 2: Run it.** Expected: FAIL (`bookingHref` not exported).

- [ ] **Step 3: Implement**

```tsx
/**
 * POR-04: the booking wizard lives on the practice's host. There the client is
 * already signed in on the same origin; from app.unclutterdesk.com we send
 * them to the practice's own address (the session cookie is on the api
 * domain, so they stay signed in).
 */
export function bookingHref(appType: string, slug: string | null | undefined): string {
  if (appType === 'booking' || !slug) return '/book';
  return `${getBookingUrl(slug)}/book`;
}

export function BookSessionButton({ variant = 'primary', label = 'Book a session' }: { variant?: 'primary' | 'secondary'; label?: string }) {
  const brand = useBrand();
  const href = bookingHref(getAppType(), brand.slug);
  const cls = variant === 'primary'
    ? 'h-11 px-5 rounded-[14px] text-white text-[14px] font-semibold inline-flex items-center gap-2'
    : 'h-11 px-5 rounded-[14px] border border-[#CBD5E1] bg-white text-[14px] font-semibold text-[#0F172A] inline-flex items-center gap-2';
  const style = variant === 'primary' ? { background: brand.primaryColor || '#0F3A53' } : undefined;
  return href.startsWith('/')
    ? <Link to={href} className={cls} style={style}><CalendarPlus className="h-4 w-4" aria-hidden="true" />{label}</Link>
    : <a href={href} className={cls} style={style}><CalendarPlus className="h-4 w-4" aria-hidden="true" />{label}</a>;
}
```

Note: `/book` is only routed in the practice-host tree; with `slug` empty on the app host that link 404s. If the Home test in Task 3 shows `useBrand().slug` is empty on the app host, read the slug from `/v1/auth/status`'s tenant instead and add that case to this test.

- [ ] **Step 4: Run** the test and the Task 3 and Task 4 tests. Expected: PASS.
- [ ] **Step 5: Commit** `"POR-04: Book a session from the portal, on the practice's own host"`.

---

### Task 6: "Add to calendar" on each upcoming session (POR-05)

**Files:**
- Create: `apps/app/src/pages/public/booking/AddToCalendar.tsx`
- Modify: `apps/app/src/pages/public/booking/ConfirmationStep.tsx` (remove `gcalTime`, `googleCalendarUrl`, `CalendarMenu`; import `AddToCalendar`), `apps/app/src/pages/client/portal/PortalSessionCard.tsx`
- Test: `apps/app/src/pages/public/booking/AddToCalendar.test.tsx`, extend `PortalPages.test.tsx`; `ConfirmationStep.test.tsx` must pass unchanged.

**Interfaces:**
- Produces: `AddToCalendar({ bookingId, icalToken, serviceTitle, therapistName, startsAt, endsAt, placement? }: { …; placement?: 'above' | 'below' })` and `googleCalendarUrl({ serviceTitle, therapistName, startsAt, endsAt }): string`. `placement` defaults to `'above'` (today's confirmation behaviour, `bottom-full`); the portal card uses `'below'` (`top-full`), since a card near the top of the page would open its menu off-screen.

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect } from 'vitest';
import { renderWithApp, screen, fireEvent } from '../../../test/renderWithApp';
import { AddToCalendar, googleCalendarUrl } from './AddToCalendar';

const S = { bookingId: '9', icalToken: 'tok', serviceTitle: 'Individual Therapy', therapistName: 'Dr Bello', startsAt: '2030-10-02T13:00:00Z', endsAt: '2030-10-02T14:00:00Z' };

describe('AddToCalendar', () => {
  it('builds the Google link with title and times', () => {
    const url = new URL(googleCalendarUrl(S));
    expect(url.searchParams.get('text')).toBe('Individual Therapy with Dr Bello');
    expect(url.searchParams.get('dates')).toBe('20301002T130000Z/20301002T140000Z');
  });

  it('opens a menu with the .ics download carrying the token, and closes on Escape', () => {
    renderWithApp(<AddToCalendar {...S} />);
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/ }));
    expect(screen.getByRole('menuitem', { name: 'Download (.ics)' }).getAttribute('href')).toMatch(/\/v1\/calendar\/bookings\/9\/ical\?token=tok$/);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
```

In `PortalPages.test.tsx` add (Review Focus 4): an upcoming CONFIRMED session shows "Add to calendar"; an upcoming CANCELLED one and every past one show neither "Add to calendar" nor "Reschedule".

- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Move `gcalTime`, `googleCalendarUrl` and `CalendarMenu` from `ConfirmationStep.tsx:39-119` into `AddToCalendar.tsx`, build `icsHref` inside it as ConfirmationStep does today (find that expression near `ConfirmationStep.tsx:192` and move it), and add `placement`. In `PortalSessionCard`, render `<AddToCalendar … placement="below" />` when `session.status !== 'CANCELLED' && session.icalToken`.
- [ ] **Step 4: Run** the app suite. Expected: PASS, with `ConfirmationStep.test.tsx` untouched.
- [ ] **Step 5: Commit** `"POR-05: Add to calendar on every upcoming session in the portal, shared with the booking confirmation"`.

---

### Task 7: Browser check and the testing sheet

- [ ] **Step 1:** Start the API and app (`npm run dev` at the root, as in `docs/VPS_PREPARATION.md`'s local section).
- [ ] **Step 2:** As a client on `http://dr-smith.localhost:5173/portal` at 1280px (sidebar open and collapsed) and 390px: walk all five pages; no horizontal scroll; the practice's logo and colours, never Unclutter Desk's; Home's tiles and next session match what the old page showed.
- [ ] **Step 3:** Press **Book a session**, book a time, press **Go to my bookings**: the new session is on Home and Sessions. Use **Add to calendar** on it: the `.ics` downloads and Google opens prefilled.
- [ ] **Step 4:** Reschedule from Sessions; Home's next-session tile and Payments show the new time.
- [ ] **Step 5:** Open `http://localhost:5173/portal` (app host) signed in as the same client: **Book a session** goes to `dr-smith.localhost:5173/book` (Review Focus 3).
- [ ] **Step 6:** Sign out from the account menu on `/portal/payments`: only the sign-in card remains.
- [ ] **Step 7:** In `docs/testing-feedback.md`, set POR-03, POR-04 and POR-05 to **Fixed** in the tracker and their entries, with the commits and what was seen. Commit `"Testing sheet: POR-03, POR-04, POR-05 fixed"`.
