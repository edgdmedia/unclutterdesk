# App Frame and Navigation Implementation Plan (GEN-01, GEN-02, GEN-03, NOT-06, POR-03)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Every signed-in page (practice, admin, client portal) sits in the same frame: one page width, one way of laying out columns, one menu structure, and the notification bell in the header.
- The client portal uses that frame too, in the practice's brand.

**Architecture:**
- **`Page` stays the one place a page's width is decided.** It gains a `layout="main-aside"` option (a sized template: flexible main column plus a 372px side panel, responsive to the page area via the `page` container), so no page hand-writes `grid-cols-[1fr_372px]`.
- **Shell header:** the shell gets a header slot with a shared `NotificationBell` (dropdown plus link to the full page).
- **Menus are data:** the practice menu is reorganised in `practiceNav.tsx`, and a new `clientNav.tsx` defines the portal's menu, rendered by the same `AppShell`, `Sidebar` and `BottomNav`.

**Tech Stack:** React, Vite, Tailwind container queries (`@container/page`), `packages/ui` (`Page`, `Grid`, `AppShell`, `Sidebar`, `BottomNav`, `PageHeader`), vitest.

**Spec:** `docs/testing-feedback.md` → GEN-01, GEN-02, GEN-03, NOT-06, POR-03 (decisions of 2 Oct 2026).

## Global Constraints

- **Widths:** pages never set their own width. `Page` caps content at 1440px (880px with `size="narrow"`).
- **Two kinds of grid:**
  - **Page structure** (main column plus side panel) uses `Page layout="main-aside"`.
  - **Content inside** (tiles, cards, fields side by side) uses `Grid` from `packages/ui`, whose breakpoints follow the page area: `sm` 480, `md` 640, `lg` 960, `xl` 1200.
  - Screen-width classes (`md:grid-cols-2`, `md:col-span-2`) are not used for layout in signed-in pages.
- **Practice menu** (exact labels and order):
  - **Main:** Today (`/dashboard`), Schedule, Sessions, Clients.
  - **Forms & assessments:** Submissions, Assessments, Forms (`/dashboard/settings/forms`).
  - **Settings:**
    - *Booking page:* Practice profile, Locations, Brand & booking page;
    - *Scheduling & pricing:* Availability, Services & pricing, Discounts;
    - Team & staff;
    - Reports (today's Analytics, `/dashboard/analytics`);
    - *Billing:* Payouts, Subscription.
  - **Avatar menu:** My profile, Hours log, Notification settings, Account & security, plus what's there today (switch practice, sign out).
  - Role and plan rules stay as today: receptionists don't see clinical items, plan badges stay, and therapists without settings rights see only Availability.
- **Phone bottom bar:** Today, Schedule, Sessions, Clients (Notifications moves to the header bell).
- **Bell:**
  - **Position:** the last item on the right of the desktop header; the top-right corner on phones.
  - **Dropdown:** the latest 8 notifications (unread dot, title, one line, time ago), "Mark all read", and **All notifications** at the bottom, linking to the notifications page.
  - **Badges:** the unread count updates live from the existing `/v1/notifications/stream`, falling back to `/v1/notifications/unread-count`.
- **Client portal menu:** Home, Sessions, Forms & assessments, Payments, My details. It uses the practice's logo and colours (`usePracticeBrand`/`tenantBrandStyle`), with the bell in the header.
- **Dashboard setup cards** (Profile photo, Practice branding): each shows only while unfinished (no profile photo; practice still on default colours and no logo).
- **Tests:** `renderWithApp` with real providers; fake only `utils/apiClient` and `context/AuthContext`. Run with `--maxWorkers=2 --minWorkers=1`. Every changed page is checked at 390px and 1280px.

## Review Focus

1. **The sidebar open on a 1024px laptop:** the dashboard's side panel drops below the main column (the page area is under 1200px), with no horizontal scroll.
2. **A receptionist:** no Assessments, Submissions details or Hours log in any menu; the bell still works.
3. **A notification with an in-app link** clicked in the dropdown navigates within the app and marks it read; an external link opens in a new tab.
4. **The portal on a custom practice host:** brand colours and logo load before the menu renders (no flash of Unclutter Desk colours).
5. **A therapist with an unread count of 120:** the badge shows "99+" and the dropdown still shows the latest 8.

---

## File Structure

- `packages/ui/src/layout/Page.tsx`: the `layout` prop (`'single' | 'main-aside'`) and an `aside` slot.
- `packages/ui/src/layout/AppShell.tsx`: a `header` slot rendered above the content on every viewport.
- `apps/app/src/components/shell/NotificationBell.tsx` (new) and `useUnreadNotifications.ts` (new hook).
- `apps/app/src/components/shell/practiceNav.tsx`: the regrouped menus and bottom bar.
- `apps/app/src/components/shell/AccountMenu.tsx`: My profile, Hours log, Notification settings, Account & security.
- `apps/app/src/components/shell/PracticeShell.tsx`: passes the header with the bell.
- `apps/app/src/components/shell/ClientShell.tsx` (new) and `clientNav.tsx` (new).
- `apps/app/src/App.tsx`: portal routes wrapped in `ClientShell`.
- `apps/app/src/pages/client/ClientPortalPage.tsx`: split into `pages/client/PortalHomePage.tsx`, `PortalSessionsPage.tsx`, `PortalFormsPage.tsx`, `PortalPaymentsPage.tsx`, `PortalDetailsPage.tsx`. Each section of today's 661-line page moves into its own page, unchanged in behaviour.
- The 16 practice pages with their own `<main>` move onto `Page`: `AssessmentsPage`, `MyProfilePage`, `NotificationsPage`, `RequestsPage`, `SchedulePage`, `SessionPrepPage`, and the settings pages `AccountPreferences`, `BrandSettings`, `FormEditor`, `FormsManager` (also fixes FRM-02), `PayoutSettings`, `PracticeProfile`, `ServicesSettings` and `SubscriptionSettings`. `TelehealthVideoRoomPage` stays full-bleed on purpose and is documented as the one exception.
- `apps/app/src/pages/practice/DashboardPage.tsx`: `Page layout="main-aside"`, its own bell removed, setup cards conditional.

---

### Task 1: `Page` gets the main-plus-side-panel layout

**Files:** `packages/ui/src/layout/Page.tsx`, `Page.test.tsx`; export from `packages/ui/src/index.ts` if a new type is added.

**Interfaces:** `Page({ size?, layout?: 'single' | 'main-aside', aside?: ReactNode, header?, className?, children })`. With `main-aside`, children go in the main column and `aside` in the 372px panel. Classes: `grid grid-cols-1 @min-[1200px]/page:grid-cols-[minmax(0,1fr)_372px] gap-4 md:gap-5 items-start`. On narrow page areas, the aside stacks under the main column.

- [ ] **Step 1: Failing test** (`Page.test.tsx`): renders `aside` in a second grid cell with the container class `@min-[1200px]/page:grid-cols-[minmax(0,1fr)_372px]`; without `layout` the markup is unchanged (the existing tests still pass).
- [ ] **Step 2:** Run `cd packages/ui && npx vitest run src/layout/Page.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `"Page: a main-plus-side-panel layout, so pages never hand-write their structure"`.

### Task 2: Every signed-in practice page uses `Page` (GEN-01)

**Files:** the 15 pages listed in File Structure, plus `DashboardPage.tsx` and `HoursLogPage.tsx` (both switch to `layout="main-aside"`).

For each page:
1. Replace the outer `<div className="flex-1 …"><header …/><main className="… max-w-… px-…">` with `<Page header={<PageHeader title=… eyebrow=… actions=… />}>`.
2. Replace screen-based grids (`grid-cols-1 md:grid-cols-2`, `md:col-span-2`) with `<Grid cols={{ base: 1, md: 2 }}>` / `<GridItem span={{ md: 2 }}>` (see `packages/ui/src/layout/Grid.tsx` for the exact names).
3. Keep behaviour and copy unchanged.

- [ ] **Step 1: Failing test.** Add `apps/app/src/pages/__tests__/PageFrame.test.tsx`. For each page component above, render it with its usual mocked data and assert `container.querySelector('[class*="@container/page"]')` exists and no element's class contains `max-w-[` except the `Page` main. Use a table of `[name, component, apiMocks]`.
- [ ] **Step 2:** Run it. Expected: FAIL for the 15 pages.
- [ ] **Step 3:** Convert the pages one at a time. After each, run its existing test file, then commit in small groups (`"GEN-01: settings pages use the shared Page frame"`, and so on).
- [ ] **Step 4:** Run the full app suite and `npx tsc --noEmit -p .`. Expected: PASS, 0 errors.
- [ ] **Step 5:** Check each converted page at 390px and 1280px, with the sidebar open and collapsed, for no horizontal scroll (Review Focus 1). FormsManager at 390px closes FRM-02.

### Task 3: The notification bell in the header (NOT-06)

**Files:**
- `packages/ui/src/layout/AppShell.tsx` (a `header` slot; on phones it renders top-right; on desktop it's a slim bar above the page, right-aligned);
- `apps/app/src/components/shell/useUnreadNotifications.ts`, `NotificationBell.tsx`;
- `PracticeShell.tsx`;
- `DashboardPage.tsx` (remove its own bell);
- tests `apps/app/src/components/shell/__tests__/NotificationBell.test.tsx`.

**Interfaces:**
- `useUnreadNotifications(): { count: number; items: NotificationItem[]; refresh(): Promise<void>; markRead(id: string): Promise<void>; markAllRead(): Promise<void> }`. It uses `GET /v1/notifications?pageSize=8`, `GET /v1/notifications/unread-count`, `PATCH /v1/notifications/:id/read` and `POST /v1/notifications/read-all`, and subscribes to `/v1/notifications/stream` (`EventSource` with credentials), refetching on each event.
- `NotificationBell({ allHref }: { allHref: string })`: the icon button (aria-label "Notifications, 3 unread"), a red dot or count badge ("99+"), and a dropdown with the list, "Mark all read" and the **All notifications** link. Escape and click-outside close it; focus is trapped while it's open (`useFocusTrap`).

- [ ] **Step 1: Failing tests:**
  - shows "3 unread" from the count;
  - opening lists the latest items, with unread ones marked;
  - clicking an item with link `/dashboard/sessions/8` navigates there and marks it read;
  - "Mark all read" posts `read-all` and clears the badge;
  - **All notifications** links to `/dashboard/notifications`;
  - 120 unread shows "99+".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Wire it into `PracticeShell` via the new `header` slot, and remove the dashboard's own bell.
- [ ] **Step 4:** Run the app and UI suites. Check the bell's position at 390px (top-right) and 1280px (last on the right).
- [ ] **Step 5:** Commit `"NOT-06: the notification bell lives in the header, with a dropdown and a link to all notifications"`.

### Task 4: The regrouped practice menu and avatar menu (GEN-03)

**Files:** `apps/app/src/components/shell/practiceNav.tsx`, `AccountMenu.tsx`, `__tests__/practiceNav.test.tsx` (extend or create).

**Interfaces:** `practiceNavSections(profile)` returns the sections in the order given in Global Constraints, and `PRACTICE_BOTTOM_NAV` returns Today, Schedule, Sessions, Clients. The avatar menu items are those in Global Constraints.

- [ ] **Step 1: Failing tests:**
  - an owner's sections and labels exactly as in Global Constraints;
  - no "Notifications" or "Hours log" in the sidebar;
  - "Hours log" is in the avatar menu for clinical roles only;
  - a receptionist sees no Assessments or Hours log;
  - the bottom bar is Today, Schedule, Sessions, Clients;
  - plan badges still show (Forms Pro, Team Clinic).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Routes are unchanged; only labels and grouping move ("Analytics" becomes "Reports" in the menu and page title).
- [ ] **Step 4:** Run the app suite, plus the onboarding tour tests (tour ids `nav-sessions`, `nav-clients`, `nav-forms`, `nav-availability` and `nav-payouts` must still exist on their items).
- [ ] **Step 5:** Commit `"GEN-03: the menu is regrouped: Main, Forms & assessments, Settings; personal items move to the avatar menu"`.

### Task 5: Dashboard setup cards show only until done (GEN-02)

**Files:** `apps/app/src/pages/practice/DashboardPage.tsx`, `apps/app/src/pages/__tests__/DashboardProfilePhoto.test.tsx` (extend).

- [ ] **Step 1: Failing tests:**
  - with an avatar, the Profile photo card is absent;
  - without one, it shows;
  - with a logo or non-default colours, the Practice branding card is absent;
  - otherwise it shows.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Read the brand from `usePracticeBrand()`; "default colours" means the same values `DEFAULT_TENANT_BRAND` uses.
- [ ] **Step 4:** Run the app suite.
- [ ] **Step 5:** Commit `"GEN-02: setup cards leave the dashboard once they are done"`.

### Task 6: The client portal in the same frame (POR-03)

> **Moved to `2026-10-03-client-portal-redesign.md`.** Do not implement here.

**Files:**
- `apps/app/src/components/shell/ClientShell.tsx`, `clientNav.tsx`;
- `apps/app/src/pages/client/Portal*.tsx` (split from `ClientPortalPage.tsx`);
- `App.tsx` routes `/portal` (Home), `/portal/sessions`, `/portal/forms`, `/portal/payments` and `/portal/details`. The existing `/portal/assessments/:id` and `/forms/:id` routes stay;
- tests `apps/app/src/pages/__tests__/ClientPortalShell.test.tsx`.

**Interfaces:**
- `ClientShell({ children })`: `AppShell` with `Sidebar` (practice logo and name at the top, items from `clientNav`), `BottomNav` on phones (Home, Sessions, Forms, Payments), the header with `NotificationBell allHref="/portal/notifications"` (add that route, reusing `NotificationsPage` in client mode), and the account menu (My details, Sign out).
- The brand comes from `usePracticeBrand()` / `tenantBrandStyle()`, applied before the first paint (Review Focus 4).

- [ ] **Step 1: Failing tests:**
  - `/portal` renders the shell with the menu items Home, Sessions, Forms & assessments, Payments, My details and the practice name;
  - each item navigates to its page, which shows the same content the old single page showed for that section (reuse the existing ClientPortal tests' fixtures);
  - the bell is present;
  - at 390px the bottom bar shows.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement: move code, don't rewrite it. The existing `ClientPortalPayments.test.tsx` and `ClientFormPage.test.tsx` must keep passing (update their import paths only).
- [ ] **Step 4:** Run the app suite. Check on the practice host (`http://dr-smith.localhost:5173/portal`) at 390px and 1280px.
- [ ] **Step 5:** Commit `"POR-03: the client portal uses the same frame as the practice dashboard, in the practice's brand"`.

### Task 7: Browser check and the testing sheet

- [ ] **Step 1:** Start the servers.
- [ ] **Step 2:** As the owner, walk every menu item at 1280px (sidebar open and collapsed) and at 390px, checking for no horizontal scroll. As a receptionist, check the menus (Review Focus 2).
- [ ] **Step 3:** Create a notification (book a session as a client), then open the bell: the item appears live; click it, it navigates and marks read; "All notifications" opens the page.
- [ ] **Step 4:** As a client, walk the portal pages at both sizes on the practice host.
- [ ] **Step 5:** In `docs/testing-feedback.md`, set GEN-01/02/03, NOT-06, POR-03 and FRM-02 to **Fixed**, with commits and what was seen. Commit.
