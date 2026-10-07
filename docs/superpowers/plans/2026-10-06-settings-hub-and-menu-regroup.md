# Settings hub and menu regroup (GEN-03 + GEN-04)

**Specs:** `docs/testing-feedback.md` → GEN-01…GEN-04. This plan implements frame-plan Task 4 (the regroup, previously unimplemented) folded together with the Settings hub, because they both land in `practiceNav.tsx`.

**Goal:** the sidebar shrinks to a few meaningful entries; everything under Settings becomes one page with a left tab rail (top tabs on mobile), grouped by intent. No page is rewritten — existing settings pages mount as tab contents as they are.

## Target structure

**Sidebar (owner):**
- **Main:** Today (`/dashboard`), Schedule, Sessions, Clients
- **Forms & assessments:** Submissions, Assessments, Forms (`/dashboard/settings/forms` — a workspace, stays a direct link)
- **Settings** (single entry → `/dashboard/settings`)
- Reports (`/dashboard/analytics`, label change from "Analytics"), Payouts (`/dashboard/settings/payouts` keeps its direct link for the tour)

Bottom bar: Today, Schedule, Sessions, Clients. Avatar menu: My profile, Availability shortcut (tourId `nav-availability` moves here), Notifications shortcut, Hours log (clinical roles only), Sign out. `Notifications` leaves the sidebar (bell in the header already owns that route).

**Settings hub** — `Page` with `layout="main-aside"`, the rail as the `aside`; route `/dashboard/settings/:tab?`; tab order and groups:

| Rail group | Tabs (path → component, existing unless noted) |
|---|---|
| Practice | `profile` → PracticeProfilePage · `locations` → LocationsSettingsPage · `brand` → BrandSettingsPage |
| Booking | `availability` → AvailabilitySettingsPage · `services` → ServicesSettingsPage · `discounts` → DiscountSettingsPage |
| Domain & email | `domain` → **new** SettingsDomainPage (CustomDomainPanel + BookingLinkCard) · `notifications` → NotificationsPage · `sending-domain` → **new** SettingsEmailPage (SendingDomainCard) |
| Team & billing | `team` → TeamSettingsPage · `subscription` → SubscriptionSettingsPage · `account` → AccountPreferencesPage |

Role/tier gating becomes tab filtering (receptionist: no `team`/`subscription`; STARTER: no `brand`/`discounts`/`domain`/`sending-domain`… mirror the current sidebar `tier` flags exactly). `/dashboard/settings` with no tab renders the first visible tab. All current deep links keep working because the tab segment equals today's last path segment; the two new paths (`domain`, `sending-domain`) are new.

Contents moves: **SendingDomainCard out of BrandSettingsPage** into `SettingsEmailPage`; **CustomDomainPanel out of BrandSettingsPage** into `SettingsDomainPage` with the `BookingLinkCard` (the booking address and its custom override belong together).

## Global constraints

- `PRACTICE_SECTIONS` in `practiceNav.tsx` remains the single source for the sidebar; add `SETTINGS_TABS` (label, path, icon, role/tier) exported for the hub and tests.
- Tour ids must survive: `nav-sessions`, `nav-clients`, `nav-forms` stay on sidebar items; `nav-availability` moves to the avatar-menu shortcut; `nav-payouts` stays. DashboardTour steps are re-pointed in this plan's Task 3, not left broken.
- Pages do not set their own width; the hub uses `Page`/`Page layout="main-aside"`; mobile (<1024px in-container) renders the rail as a horizontal scrollable tab strip above the content.
- Existing pages stay untouched except the two content moves on BrandSettingsPage; each mounted page keeps its own PageHeader (that is the tab title — no second header).

### Task 1: Menus as data (`practiceNav.tsx` + tests)

- [ ] Failing tests in `practiceNav.test.tsx`: owner's sidebar sections exactly as above (Settings is ONE entry; Notifications and Hours log absent; Reports label); avatar menu items; receptionist sees no `team`/`subscription` tab definitions; tier filtering of SETTINGS_TABS mirrors today's sidebar flags; bottom nav unchanged.
- [ ] Implement: rewrite `practiceNavSections`, add `SETTINGS_TABS`, export both. Delete the old Settings groups.
- [ ] App suite + commit `"GEN-03: the menu is regrouped; settings becomes tab data"`.

### Task 2: The hub (`SettingsPage.tsx` + routes)

- [ ] Failing test `SettingsHub.test.tsx`: `/dashboard/settings` renders the rail and defaults to the first visible tab; `/dashboard/settings/services` mounts ServicesSettingsPage inside the hub; `/dashboard/settings` for a receptionist offers no Team tab; unknown tab falls back to the first.
- [ ] Implement `apps/app/src/pages/practice/settings/SettingsPage.tsx` (rail aside + `<Outlet/>`), nest the routes in `App.tsx` under `/dashboard/settings` (children: `profile`, `locations`, `brand`, `availability`, `services`, `discounts`, `domain`, `notifications`, `sending-domain`, `team`, `subscription`, `account`), keep `forms`, `forms/:id`, `payouts` as siblings (workspace/tour), redirect bare `/dashboard/settings/:unknown` → first visible.
- [ ] New `SettingsDomainPage.tsx` (BookingLinkCard + CustomDomainPanel) and `SettingsEmailPage.tsx` (SendingDomainCard); strip those two from BrandSettingsPage.
- [ ] route-integrity, app suite, commit `"GEN-04: settings is one page with grouped tabs"`.

### Task 3: Tour, links, and the sidebar entry points

- [ ] DashboardTour steps for availability/payouts: target the avatar-menu shortcut / sidebar item that exists at step time (or navigate directly to the tab URL). Update tour tests.
- [ ] Audit hardcoded `/dashboard/settings/*` links (BookingLinkCard, dashboard setup cards, toast CTAs, ClientPortal leftovers) — retarget renamed/removed paths (`notifications` → `/dashboard/settings/notifications` still fine as tab; anything linking `?` differently fixed here).
- [ ] App suite, commit `"GEN-04: tour and links follow the new settings structure"`.

### Task 4: Browser check and the sheet

- [ ] Owner + receptionist + clinician at 1280 and 390: rail vs top tabs, deep links from notifications bell and avatar menu, tour completes, plan badges (Forms Pro / Team Clinic) still gate tabs.
- [ ] GEN-03 + GEN-04 → **Fixed** with what was seen; commit `"Testing sheet: GEN-03, GEN-04 fixed"`.
