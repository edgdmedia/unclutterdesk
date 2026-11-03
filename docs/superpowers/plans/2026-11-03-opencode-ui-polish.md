# Dashboard UI polish (owner feedback, 3 Nov 2026): plan for opencode

**Builder:** opencode. Branch `phase1/ui-polish` from `dev`, PR into `dev`.

**Before asking for review**, follow `AGENTS.md`: run the full suites and `pnpm typecheck`, and post the totals. One commit per task, each with tests.

## Tasks

- [ ] **1. One page header everywhere.** These pages still draw their own header. Move each to the shared `PageHeader` from `@unclutterdesk/ui`, so the notification bell appears there (it's passed in automatically by `AppShell`):
  - Practice pages: `AssessmentsPage`, `MyProfilePage`, `NotificationsPage`, `RequestsPage`, `SchedulePage`, `SessionPrepPage`, `SubmissionsPage`.
  - Settings pages: `AccountPreferencesPage` (Preferences), `PayoutSettingsPage`, `PracticeProfilePage`, `BrandSettingsPage` (Brand & bookings), `ServicesSettingsPage`, `SubscriptionSettingsPage`, `FormsManagerPage`, `FormEditorPage`, `SettingsPage`.
  - Leave out `OnboardingWizardPage` and `TelehealthVideoRoomPage`, which are full-screen.
  - Each page ends with exactly one header. Test: for each page, one `<header>` and the frame's bell inside it (see `packages/ui/src/layout/AppShell.test.tsx` for the pattern).
- [ ] **2. Availability page layout.**
  - The page header spans the full width; the page's own side menu sits below it, not beside or over it.
  - "Weekly hours" and "Upcoming times" become two tabs. Use the existing tab component, and put the tab in the URL (`?tab=`) so it survives a reload.
- [ ] **3. "Forms & assessments" in the sidebar does nothing when clicked.** It's a collapsible group (`practiceNav.tsx`, key `forms`). Clicking the label must expand or collapse it, by keyboard too (`aria-expanded`). Find why the toggle doesn't fire in `packages/ui` `Sidebar`, fix it there, and add a test.
- [ ] **4. Public profile preview.**
  - Reuse the Brand page's live scaled preview pane (find its component; don't copy it). Give it a phone, tablet and desktop width switch, and a "View full screen" button that opens the real preview at full size.
  - Make it a shared component in `@unclutterdesk/ui` if both pages need it.

## Out of scope (Spec Claude has these)

The dashboard's Upcoming list, time format, schedule types and hours, session status and join timing, intake answer labels, and holidays.
