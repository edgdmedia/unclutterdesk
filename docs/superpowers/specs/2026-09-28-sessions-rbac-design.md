# Sessions Register, Session Page and Permissions RBAC — Design

**Date:** 2026-09-28
**Status:** Approved by the product owner during brainstorming
**Parents:** Phase 1 plan (`docs/PHASE1_PLAN.md`); builds on the responsive shell (PRs 1–2) and staff bookings (step 4).

## 1. Goal

Four things, one release:

1. **A permission system (RBAC).** Every authenticated route is gated by a named
   permission, not a raw role list. A person's effective permissions are their
   role's permissions plus any per-person grants. A practice owner or admin can
   add or remove grants on the team page.
2. **A Sessions page** (`/dashboard/sessions`): every session, upcoming and
   history, filtered by status, practitioner (practice-wide viewers only) and
   search.
3. **A session page** (`/dashboard/sessions/:id`): one session as a hub —
   details, status, payment, Start / Prep / Note links into the existing flows,
   staff reschedule and cancel, an internal summary and a client recap that can
   be emailed.
4. **The client page shows what happened**: a real session history list and a
   payment history tab.

## 2. Who sees what (agreed rules)

- **Owner / Admin** — the whole practice everywhere: all sessions, all edits,
  the permissions editor.
- **Therapist** — their own sessions only. They can complete their own sessions,
  write notes and summaries; to move someone else's session they ask an admin.
  A solo practice owner who is also the therapist has both, because OWNER covers
  everything.
- **Receptionist** — the practice-wide session list, booking, reschedule,
  cancel, mark-paid; never clinical notes or summaries.
- **Client** — unchanged: only their own portal.

Multiple roles per person are not a new concept: `Profile.permissions` already
exists in the schema and has never been used. It becomes the grant list.

## 3. Permission system

### 3.1 Catalog (`apps/api/src/common/permissions.ts`)

```
practice.owner        OWNER only (the routes that are truly owner-only)
practice.admin        OWNER, ADMIN          — practice settings, billing, staff
practice.staff        OWNER, ADMIN, THERAPIST, RECEPTIONIST
clinical.record       OWNER, ADMIN, THERAPIST — SOAP notes, assessments, prep
payments.desk         OWNER, ADMIN, RECEPTIONIST — mark paid, payout views
any.authenticated     every role, CLIENT included — portal and self-service
sessions.view-all     OWNER, ADMIN, RECEPTIONIST — every practitioner's diary
sessions.edit         OWNER, ADMIN, RECEPTIONIST — staff status/reschedule/cancel
sessions.summary      OWNER, ADMIN, THERAPIST — internal summary and client recap
staff.manage          OWNER, ADMIN — change roles and grants
```

`ROLE_PERMISSIONS: Record<PracticeRole, Permission[]>` holds the table above.
Effective set = `ROLE_PERMISSIONS[profile.role] ∪ (profile.permissions ∩
GRANTABLE)`, where `GRANTABLE` excludes `practice.owner`, `any.authenticated`
and `staff.manage` — you cannot grant away ownership or the admin-only ability
to grant.

### 3.2 Enforcement

- `@Permissions(...keys)` decorator; a route passes when the caller holds **any
  one** of the listed keys — the same "any of" semantics `@Roles` has today.
- `RolesGuard` keeps its name and its place in every `@UseGuards(...)` line but
  reads `PERMISSIONS_KEY` instead of `ROLES_KEY`, loads `role`, `status` and
  `permissions` from the profile row (as today, so a demotion takes effect at
  once), and checks the effective set. Platform-admin bypass and the
  session-liveness check are unchanged.
- `@Roles`, `ROLES_KEY` and `@AnyAuthenticated` are deleted with the migration;
  the role arrays stay in `roles.ts` as the input to `ROLE_PERMISSIONS`.
- `roles.spec.ts` and `test-support/routes.ts` are updated so the build still
  fails on an authenticated route with no `@Permissions` (and no
  `@AllowPlatformAdmin` escape). `client-surface.spec.ts` keeps its meaning:
  routes a client may reach are exactly those with `any.authenticated` or none.

### 3.3 Migration mapping (mechanical, one pass)

| today | becomes |
|---|---|
| `@Roles(...PRACTICE_ADMIN)` | `@Permissions('practice.admin')` |
| `@Roles(...CLINICAL)` | `@Permissions('clinical.record')` |
| `@Roles(...STAFF)` | `@Permissions('practice.staff')` |
| `@Roles(...FRONT_DESK)` | `@Permissions('payments.desk')` |
| `@Roles('OWNER')` | `@Permissions('practice.owner')` |
| `@AnyAuthenticated()` | `@Permissions('any.authenticated')` |

Counts today: 33 / 27 / 26 / 16 / 1 / 26. Behaviour is identical because
`ROLE_PERMISSIONS` reproduces each group exactly; the new fine-grained keys are
only used by the new session routes.

### 3.4 Grants API and editor

- `GET /v1/tenant/staff` rows gain `permissions: string[]`.
- `PATCH /v1/tenant/staff/:profileId/permissions` (`staff.manage`) replaces the
  grant list; validates against `GRANTABLE`; refuses to edit the OWNER's grants
  (an owner already has everything); returns the updated row.
- Team page: each member row gets a "Permissions" action opening a dialog of
  grouped tick boxes (Session, Clinical, Money, Practice), with a one-line
  description per permission. Only OWNER/ADMIN see it.

## 4. Sessions feature

### 4.1 Data

`ConsultBooking` gains three columns (hand-written migration
`<ts>_session_summaries`):

```
internalSummary   String? @db.Text   // staff-only recap of what happened
clientRecap       String? @db.Text   // written for the client
clientRecapSentAt DateTime?          // when the recap email went out
```

The booking's own `notes` field stays "the note taken at booking time".

### 4.2 API (all new consult routes)

| route | permission | notes |
|---|---|---|
| `GET practice/sessions?scope&status&q&providerProfileId` | `sessions.view-all`, `practice.staff` | holders of `sessions.view-all` get the practice (optional provider filter); everyone else is forced to their own diary |
| `GET practice/sessions/:id` | same | detail + `can` flags; 404 for a therapist's non-own session |
| `PATCH practice/sessions/:id/status` | `sessions.edit`, `clinical.record` | desk may confirm/cancel; a therapist may complete **their own** only (service rule) |
| `POST practice/sessions/:id/reschedule` | `sessions.edit` | body `{ availabilityId }`; same-provider open slot, future, right service; old slot returns to the pool |
| `PATCH practice/sessions/:id/summary` | `sessions.summary` | sets/clears both summary fields |
| `POST practice/sessions/:id/recap-email` | `sessions.summary` | requires `clientRecap`; emails the client; stamps `clientRecapSentAt` |
| `GET practice/clients/:profileId/sessions` | `practice.staff` | one client's sessions, newest first |
| `GET practice/clients/:profileId/payments` | `payments.desk` | the same rows the client portal shows |

Reschedule reuses the booking/slot rules from the portal flow, rewritten for a
staff actor (no email lookup). Cancelling releases the slot exactly as the cron
does.

### 4.3 App

- **Sessions page** — nav item "Sessions" after Schedule. Tabs Upcoming / Past /
  All over a `ResponsiveTable` (Date+time, Client, Service, Practitioner
  (view-all only), Status+payment chips, Hours). Row → session page. Search
  box; "Showing X of Y" comes from the shared table.
- **Session page** — header with client name and status; cards:
  *Session* (service, practitioner, time, channel, room), *Payment* (method,
  amount, hold, "Mark as paid" when `payments.desk` and pending), *Summary*
  (internal + recap, Save, Send recap with sent timestamp), and actions:
  **Start session** (telehealth → `/session/:id`, in-person → mark started is
  not a thing; button only for VIDEO), **Prep** (`/session/:id/prep`),
  **Write note** (opens the SOAP editor dialog against the notes API, same
  rules as the client page), **Reschedule**, **Cancel session**, status
  buttons. Everything on the page is driven by the `can` flags from the API —
  the UI never re-implements the rules.
- **Client page** — "Session history" tab becomes the real list (date, service,
  practitioner, status, payment chip, link to the session page); new
  "Payments" tab (only for `payments.desk` members — the app shows it from
  `profile.permissions`… see 4.4) listing what the client paid, when, and the
  reference.

### 4.4 The app knows the flags

`GET /v1/auth/status` (and the login response) gains `permissions: string[]` —
the effective set computed server-side once. The app uses it for nav
(Sessions is visible to staff) and to hide the Payments tab / Permissions
editor. API guards remain the enforcement; the app flags are for showing and
hiding.

## 5. Errors and copy

Plain English, as everywhere: "That session belongs to another practitioner's
diary." / "Pick an open time from the same practitioner." / "Write the recap
before sending it." A therapist opening someone else's session id gets the same
404 as a stranger — nothing leaks.

## 6. Testing

- **Catalog and guard:** unit tests for `ROLE_PERMISSIONS` reproducing the old
  groups (the migration is provably behaviour-preserving), "any of" semantics,
  grants union, non-grantable keys rejected.
- **Route rule:** the rewritten `roles.spec.ts` fails any authenticated route
  without `@Permissions`.
- **Grants endpoint:** validation, owner protection, `staff.manage` gate.
- **Sessions service:** scope rules (therapist own vs desk all), status rules
  (therapist completes own; cannot complete another's), reschedule slot rules
  including the old slot returning to the pool, summary + recap (send refuses
  without text, stamps time, emails once with the right type).
- **Pages:** SessionsPage table tabs and row links; SessionPage actions per
  `can` flags; client page history + payments tabs; permissions editor saves.
- **Live check:** the layout checker still passes for the two new routes; a
  manual pass as owner and as a therapist in a group practice.

## 7. Out of scope

Custom roles (a role builder UI), per-client data in the sessions search,
changing the client portal, and moving the video room or prep pages. The
sessions list pages nothing (browser-side paging can come later if a practice
outgrows 500 rows).
