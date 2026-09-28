# Responsive layout and shared components: design

**Date:** 28 Sep 2026
**Status:** approved in conversation, section by section; awaiting review of this written spec
**Covers:** practice dashboard, platform admin console, client portal, public booking pages (`apps/app`)
**Shared code:** `packages/ui` (`@unclutterdesk/ui`)

## 1. Why

The app does not fit the screen it is on.

- **Client page (`/dashboard/clients/:id`) and Analytics** scroll sideways at every width. They are 802px too wide on a phone, 620px on a tablet, 416px at 1024px, and still 160px at 1280px.
  - Cause: each page wraps itself in `min-w-[1192px]`.
  - Thirteen practice pages carry that wrapper. Ten more (admin, portal, public, onboarding) set their own `max-w-[1040–1400px]`.
- **Overview** overflows by 306px on a tablet. The revenue figure overlaps the "Scheduled" tile, and the booking-link box in the header is cut off.
- **The sidebar** stays at its full 248px from 768px upward, a third of an iPad's width. It never collapses on its own.
- **Phones** get a bottom bar with four items: Today, Schedule, Clients and Brand.
  - Hours log, Analytics, Notifications, the other settings pages and the account menu (sign out, Platform admin) cannot be reached.
  - Each tap reloads the whole app (`window.location.href`).
- **Tables** are squeezed on phones rather than laid out for them.
- **There are three sidebars:** the app's `components/Sidebar.tsx`, a hand-built one inside `PlatformAdminLayout`, and an unused one in `packages/ui`.
- **The shared package is barely used.** All 27 components in `packages/ui/src/components` are `@ts-nocheck` with inline styles, ported from the design handoff. The app uses a handful (`useToast`, `Eyebrow`, `Card`, `useBrand`) and rebuilds the rest.
- **Forms are hand-built:** 136 `<input>`, 34 `<select>` and 17 `<textarea>` across 42 files, in at least six height and corner combinations (40–48px tall, 12–16px corners).
- **The design spec itself asks for this.** `docs/DESIGN_SPECIFICATION.md` sets a desktop shell minimum width of 1440px, with a separate phone layout only below 768px. The page wrappers are that rule leaking into code: 1440 minus the 248px sidebar is 1192.

## 2. Goals

1. No page scrolls sideways at any width from 360px up, in all four areas.
2. **Pages never set their own width.** The shell and one `Page` component own content width and padding.
3. One reusable version of every structural and repeated piece (shell, sidebar, page, header, grid, table, stat tile, form controls), living in `packages/ui`. Practice, admin, portal and public pages share them and read as one product.
4. On tablets and small laptops the sidebar collapses to an icon rail by itself.
5. Side-by-side layouts fall back to fewer columns when there is no room.
6. Tables keep a real table on narrow screens: fewer columns, with the rest one tap away in an expandable row. They can be sorted and filtered.
7. Every page is reachable on a phone.
8. The rules are enforced by checks, so the problems cannot creep back.

**Not goals:**
- dark mode and a visual restyle, each with its own brief (see section 12);
- validation libraries;
- sorting, filtering or paging on the server;
- changing any screen's desktop appearance beyond removing overflow.

## 3. Widths

Defined once in `packages/ui`. They match Tailwind's `md` and `xl` breakpoints.

| Name | Screen width | Sidebar | Content padding |
|---|---|---|---|
| Phone | < 768px | hidden; a drawer from the bottom bar's "More" | 16px |
| Tablet | 768–1279px | 76px icon rail, always | 24px |
| Desktop | ≥ 1280px | 248px full, or the rail if the user collapsed it (the saved `unclutter_sidebar_collapsed` setting, as today) | 26px (the current design value) |

**Inside a page**, layouts respond to the width of the content area, not the screen, using Tailwind 4 container queries (`@container`). That way the sidebar is always accounted for. The content-width steps are:
- `sm` 480px;
- `md` 640px;
- `lg` 960px;
- `xl` 1200px.

## 4. Package structure and rules

New and rebuilt components in `packages/ui` follow these rules:
- They are typed; no `@ts-nocheck`.
- They are styled with Tailwind classes over the existing tokens (`--desk-*`, `--space-*`, `--desk-radius-*`, `--desk-h-*`). No inline style objects, except values that only exist at runtime, such as a brand colour.
- They know nothing about the app: no routes, auth or roles. The app passes data and callbacks.

`apps/app/src/index.css` gains `@source "../../../packages/ui/src";` so Tailwind generates the package's classes.

| Group | Component | Replaces |
|---|---|---|
| `layout/` | `AppShell` | the shell in `App.tsx`, `PlatformAdminLayout`, the portal's own shell |
| `layout/` | `Page` | the 23 per-page width wrappers |
| `layout/` | `PageHeader` | per-page headers |
| `layout/` | `Grid`, `FormGrid` | hand-written `grid-cols-N` |
| `navigation/` | `Sidebar` (rebuilt) | all three sidebars |
| `navigation/` | `BottomNav` (rebuilt, same props plus `href`) | the current four-item bar |
| `data/` | `ResponsiveTable` | 5 `<table>`s, plus 2 lists laid out as tables |
| `data/` | `StatTile`, `MetricTile` (rebuilt) | hand-made stat cards on the client page, Overview, Analytics and admin overview |
| `forms/` | `Field`, `Input`, `Textarea`, `Select`, `Toggle`, `SegmentedControl` (rebuilt), `Radio`, `Checkbox` | 187 hand-built controls |

**Existing imports keep their props:** `Card`, `Eyebrow`, `StatusBadge`, `Button`, `useToast` and `BrandProvider`. Their internals change only where this work needs it.

**Rules**, enforced by the checks in section 10:
1. A file under `apps/app/src/pages` never sets its own width. That means no `min-w-[…]` or `max-w-[…]` of 900px or more (every page wrapper found was 1040px or wider; inner reading widths such as a 720px note card are fine), no `max-w-{4..7}xl` and no `max-w-screen-*`. Small internal widths (avatars, badges, dialogs, text truncation) are fine.
2. Page and component files in `apps/app` do not write `<table>`, `<aside>`, `<select>`, `<textarea>` or `<input>`. Exceptions: `type="file"` and `type="hidden"`.
3. Multi-column layouts use `Grid` or `FormGrid`. There is no bare `grid-cols-N` (N ≥ 2) without a narrower fallback.

## 5. Shell and navigation

**`AppShell`** props:
- `sidebar?`, `header?`, `bottomNav?`, `children`;
- `mode: 'workspace' | 'portal' | 'public'`.

It lays out the sidebar slot (by width, per section 3), a content column that fills the rest (`min-w-0`, so nothing inside can force it wider), and the bottom bar on phones only. Content gets bottom padding so the bottom bar never covers it.

- **workspace:** practice and admin. Sidebar plus content, and a bottom bar on phones.
- **portal:** client portal. A branded header plus content at every width, and a bottom bar on phones. No sidebar.
- **public:** the practice profile and booking flow. Header, content, and an optional sticky action bar on phones for "Book" and "Confirm", matching the mobile design's sticky price and confirm bar.

**`Sidebar`** props:
- `groups: { label?: string; items: NavItem[] }[]`, where
  `NavItem = { key; label; icon; href; badge?; tier?; disabled? }`;
- `activeKey`, `brand` (the lockup or practice logo), `account` (a slot for the account menu);
- `mode: 'full' | 'rail' | 'drawer'`, chosen by `AppShell`;
- `onToggleCollapse?`.

How it behaves:
- **Full:** as today: labels, group headings, plan badges, and the tenant-colour active highlight. The background stays slate in every practice; tenant colour only reaches the active item.
- **Rail (76px):**
  - Icons only. Each has an `aria-label` and a tooltip on hover and keyboard focus.
  - Group headings become dividers, and the list scrolls if it is taller than the screen.
  - The account avatar sits at the bottom and opens the same account menu.
  - On a tablet, the expand button opens the full sidebar as an overlay *over* the content, so the page does not reflow. It closes on a selection, a tap outside, or Esc.
  - On desktop, expand toggles between full and rail and saves the choice.
- **Drawer (phone):** the full sidebar slides in over the page from "More" and closes the same ways. Focus is trapped inside while open and returns to "More" on close.
- **Items are router links (`href`),** so navigation stays inside the app. The app passes an `onNavigate` from React Router, so there are no full reloads.

**What the app provides:**
- **Practice:** the practice nav, already filtered by role (for example, Hours log hidden for receptionists) and plan. The account menu includes the Platform admin switch.
- **Admin:** the admin nav, through the same `Sidebar`.
- **Portal and public:** no sidebar.

**`BottomNav` on phones**, in the practice and admin areas:
- Practice: Today, Schedule, Clients, Notifications, More.
- Admin: Overview, Practices, Requests, More.
- "More" opens the sidebar drawer, which also holds the account menu.
- Portal bottom bar: one item per section the portal already has (its tabs today), plus Account. PR 5's plan lists them from `ClientPortalPage`.

**`Page`** props:
- `size?: 'default' | 'narrow'`, `header?`, `children`.
- It fills the content column, with the padding for the current width from section 3.
- It caps content at 1440px and centres it on very wide screens. This is the only maximum width in the app.
- `narrow` caps it at 880px, for form-only pages such as Account preferences. It is a fixed option, not a number a page picks.

**`PageHeader`** props:
- `title`, `eyebrow?`, `breadcrumb?`, `actions?` (the main ones), `secondaryActions?`.

It shows the breadcrumb and title on the left and the actions on the right. When the actions don't fit, they wrap to their own row under the title. On phones, `secondaryActions` fold into a "⋯" menu.

## 6. Grid and stat tiles

**`Grid`** props:
- `cols: { base: n; sm?: n; md?: n; lg?: n; xl?: n }`;
- `gap?: 'sm' | 'md' | 'lg'` (from the spacing tokens);
- `as?`.

Column counts respond to the content-area container, per section 3. Each item can span columns through `<Grid.Item span={{ base: 1, lg: 2 }}>`.

**`StatTile` and `MetricTile`** are rebuilt, typed and on tokens, and used by the client page, Overview, Analytics and admin overview in place of the hand-made cards.
- Long values truncate with a tooltip rather than overflow.
- Example: the four client-page tiles use `cols={{ base: 1, sm: 2, lg: 4 }}`.

## 7. ResponsiveTable

```ts
interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  priority: 'always' | 'md' | 'lg';          // md: table ≥ 640px wide; lg: ≥ 960px
  align?: 'start' | 'end';
  sort?: (a: Row, b: Row) => number;          // presence makes the column sortable
}
interface ResponsiveTableProps<Row> {
  rows: Row[];
  rowKey: (row: Row) => string;
  columns: Column<Row>[];
  caption: string;                            // screen-reader caption
  actions?: (row: Row) => ReactNode;
  onRowClick?: (row: Row) => void;            // for tables whose rows open a page
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  sortState?: { key: string; dir: 'asc' | 'desc' } | null;   // controlled mode, for future server-side sort
  onSortChange?: (s: { key: string; dir: 'asc' | 'desc' } | null) => void;
  filter?: { placeholder: string; match: (row: Row, query: string) => boolean; minRows?: number /* default 8 */ };
  state?: 'ready' | 'loading' | 'error';
  empty: ReactNode;
  error?: ReactNode;
}
```

**How it behaves:**
- **Markup:** a real `<table>` with `<caption>` and `<th scope="col">`, inside a `@container`.
- **Column visibility:** CSS only. `md` columns carry `hidden @min-[640px]:table-cell`, and `lg` columns `hidden @min-[960px]:table-cell`. Nothing is measured in JavaScript.
- **Expandable rows:**
  - When the table has `md` or `lg` columns, each row gets a toggle button (›) with `aria-expanded` and `aria-controls`.
  - The toggle is hidden by the same container rule once the widest priority used is visible, so it only appears when something is actually hidden.
  - Opening a row inserts a detail row that shows the hidden columns as label/value lines, plus `actions`.
  - A tap on the row also toggles it, unless `onRowClick` is set; then the row opens its page and only the toggle expands it.
- **Actions:** in their own last column while that column fits. Otherwise they appear inside the opened row. Either way they are always reachable.
- **Sorting:**
  - Sortable headers are buttons that cycle ascending, descending, then off, and carry `aria-sort`.
  - On narrow tables, a "Sort by" `Select` above the table lists every sortable column, including hidden ones.
  - Sorting runs in the browser on `rows` by default. With `sortState` and `onSortChange` set, control passes to the page.
- **Filtering:** shown when `filter` is set and there are at least `minRows` rows. A search `Input` sits above the table, with "Showing X of Y" and a clear button. Filtering runs in the browser.
- **States:** `loading` shows skeleton rows, `error` shows `error`, and no rows shows `empty`.

**Where it's used, with the columns always shown on narrow screens:**

| Table | Always | Opened row |
|---|---|---|
| Hours log | Date, Category, Hours | Client, Notes, actions |
| Clients list | Name, Next session | Email, Phone, Sessions, Status |
| Team list | Name, Role | Email, Status, actions |
| Discounts | Code, Status | Value, Usage, Expiry, actions |
| Admin practices | Practice, Status | Plan, Clients, Bookings, Revenue, Joined, Manage |
| Admin overview (practices) | Practice, Status | Plan, Clients, Bookings, Revenue, Joined |
| Admin practice detail (bookings) | Client, Scheduled | Service, Status |

Each table's sortable columns and filter are listed in the plan. As a default, dates, names and amounts are sortable, and lists that can exceed 8 rows get a filter.

## 8. Form controls

- **`Field`** props: `label`, `optional?`, `hint?`, `error?`, and `children` (the control).
  - It generates an id, connects `htmlFor`, `aria-describedby` (hint and error) and `aria-invalid`, and shows the error under the control.
  - Every control below can be used inside `Field` or alone with its own `aria-label`.
- **`Input`:** all native types; `size: 'md' | 'lg'` (44px workspace and 46px portal/public, from `--desk-h-*`); `icon?` and `trailing?`; `mono?`; `readOnly` styling.
- **`Textarea`:** the same styling, plus `autoGrow?`.
- **`Select`:** a native `<select>` with the same styling, so phones use their own picker.
- **`Toggle`:** `role="switch"` with `aria-checked`.
- **`SegmentedControl`:** rebuilt, with its current props.
- **`Radio`** and **`Checkbox`:** native inputs with styled labels. `RadioCards` is a radio group laid out as selectable cards, as used by the booking dialog's service and payment choices.
- **`FormGrid`:** `Grid` with form spacing, 2 columns from `md` content width and 1 below. `FormGrid.Full` spans both columns.
- **Focus:** one focus ring in the tenant colour (`--brand-*` token) on every control.
- **State:** pages keep their own form state. The controls are controlled or uncontrolled like native elements, and forward refs.

**Where they're used:** every form in all four areas, including the booking dialog and emergency contact card from the Phase 1 step 4 work.

## 9. Rollout: five PRs, each shippable on its own

| # | Contents | Pages |
|---|---|---|
| 1 | `@source` and package test setup; `AppShell`, `Page`, `PageHeader`, `Grid`, `Sidebar`, `BottomNav`, `StatTile`, `MetricTile`; practice shell with rail, drawer and in-app navigation; phone "More"; rule checks in warning mode; the layout check script | Client page, Analytics, Overview |
| 2 | `ResponsiveTable` with sorting and filtering | Hours log, clients list, team list, discounts |
| 3 | Form controls | Every practice form |
| 4 | Remaining practice pages on `Page` and `Grid`; rule checks fail the build for `pages/practice` | 10 settings pages, Submissions, My profile, Notifications, Schedule, Session prep, Onboarding |
| 5 | Admin shell on the shared `Sidebar`; admin tables; portal and public on `AppShell`, `Page`, `Grid` and form controls; rule checks fail the build everywhere; old `Sidebar`s and `packages/ui/src/new_components` deleted; `DESIGN_SPECIFICATION.md` updated to section 3's widths | Admin, portal, public profile, booking flow, booking confirmed, pay page |

**Sequencing with the booking work:**
- The Phase 1 step 4 work (staff booking dialog, pay page) is being built in another session and edits `ClientDetailPage`, `SchedulePage` and `App.tsx`.
- PR 1 starts after that work merges, or rebases onto it; it is never built in parallel on those files.
- Its new components (`StaffBookingDialog`, `EmergencyContactCard`, `PaymentChip`, `PayBookingPage`) move to the shared controls in PR 3 and PR 5.

## 10. Testing

1. **Package tests** (Vitest and Testing Library in `packages/ui`, added to CI):
   - `ResponsiveTable`:
     - caption and header cells render;
     - the column classes follow priority;
     - the toggle carries `aria-expanded` and opens the detail row with the hidden columns and actions;
     - there's no toggle when every column is `always`;
     - sort cycles and sets `aria-sort`;
     - the "Sort by" select lists hidden sortable columns;
     - the filter narrows rows and shows "Showing X of Y";
     - the filter is hidden under `minRows`;
     - loading, empty and error states render.
   - `Grid`: the classes for each column count.
   - `Sidebar`:
     - full, rail and drawer render;
     - rail icons have labels;
     - Esc and a tap outside close the overlay and drawer;
     - focus is trapped in the drawer;
     - items render from `groups`.
   - `AppShell`: the bottom bar only when given; `Page` sizes.
   - Form controls: `Field` wires ids and ARIA; `Toggle` has the switch role; `Input` sizes.
2. **Rule checks** (Vitest in `apps/app`): scan `src/pages` and `src/components` for the patterns in section 4's rules.
   - In PR 1–3 they report without failing. From PR 4 they fail for practice pages, and from PR 5 everywhere.
   - There is an allow-list for justified exceptions, each with a written reason.
3. **Layout check** (`pnpm --filter app check:layout`, playwright-core with the local seed accounts):
   - Visits every route in the four areas at 390, 820, 1024 and 1280px.
   - Fails on sideways scroll and on any element past the screen edge (it names the element), and checks the sidebar is the right kind for the width.
   - Runs locally before each PR. It needs a running API and seeded database, so it is not in CI yet.
4. **Desktop unchanged:** screenshots at 1280px, before and after each PR, compared by eye. Only overflow fixes are expected.
5. **Unit tests for each migrated page** are kept green. Tests that look for raw elements are updated to use roles and labels.

## 11. Risks

| Risk | Handling |
|---|---|
| Clashing with the booking work in the other session | PR 1 waits for, or rebases onto, the booking PR (section 9). |
| Package components the app already uses | `Card`, `Eyebrow`, `StatusBadge`, `Button`, `BottomNav` and `useToast` keep their props. |
| Tenant branding | Colour enters only through `BrandProvider` and the brand tokens; the sidebar background stays slate. |
| Container query support | Tailwind 4 has it built in. All current browsers support it (Safari 16+, Chrome 105+). There's no fallback for older browsers, which is acceptable for a staff and client web app in 2026. |
| Duplicates left behind | PR 5 deletes the old sidebars and `new_components`. The rule checks stop new ones. |

## 12. Related documents

- `docs/superpowers/specs/2026-09-28-dark-mode-brief.md`: dark mode. Depends on this work.
- `docs/superpowers/specs/2026-09-28-visual-restyle-brief.md`: visual restyle. Depends on this work.
- `docs/DESIGN_SPECIFICATION.md`: updated in PR 5.
- `docs/design/design_handoff_mobile_and_collapsed_sidebar`: the design source for the rail and phone layouts.
