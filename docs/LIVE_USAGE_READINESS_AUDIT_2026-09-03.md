# Live Usage Readiness Audit

**Audit date:** 2026-09-03  
**Branch:** `dev`  
**Verdict:** **NO-GO for real clinical users**

> **Update 2026-09-03, later:** P0 #1 (role authorization) and #2 (client
> portal) are fixed — see those sections. P0 #3-#6 remain open. The verdict
> stands until they are closed.

The repository builds and its automated tests pass, but the current authorization and privacy model is not safe for production use with real client records, clinical notes, or therapy-session links.

## Verification performed

- `pnpm --recursive run typecheck` passed.
- `pnpm --filter @unclutterdesk/api test` passed: 13 files, 185 tests.
- `pnpm --filter @unclutterdesk/app test` passed: 2 files, 5 tests.
- `pnpm --filter @unclutterdesk/tenant-router test` passed: 2 files, 32 tests.
- `pnpm --recursive run build` passed for API, app, and landing.
- Worktree was clean at audit start.

## P0 blockers

### 1. Staff routes authenticate identity, not role — **FIXED**

Controllers use `JwtAuthGuard` without a role guard. A valid client JWT can therefore reach staff/admin operations and PHI-bearing endpoints.

Evidence:

- `apps/api/src/modules/tenant/tenant.controller.ts:75-175`
- `apps/api/src/modules/notes/notes.controller.ts:8-40`
- `apps/api/src/modules/intake/intake.controller.ts:27-103`
- `apps/api/src/modules/billing/billing.controller.ts:27-87`
- `apps/api/src/modules/consult/consult.controller.ts:20-197`

Impact: a client may read or modify practice data, clinical notes, forms, scheduling, staff, or billing data. This is a direct confidentiality and authorization blocker.

**Resolved.** `RolesGuard` (`apps/api/src/common/roles.guard.ts`) plus `@Roles` /
`@AnyAuthenticated` decorators now cover all 56 authenticated routes that
previously had no role check. The role is read from the database rather than the
token, because the practice access token carries no role at all — `generateTokens`
sets only `sub`, `profileId`, `tenantId` and `type`, so `jwt.strategy` falls back
to `['client']` and a token-based check would have read every owner as a client.
Reading the profile also means a deactivated or demoted account loses access
immediately rather than when its 15-minute token expires.

Clinical routes — SOAP notes, assessment submissions, client detail, booking prep
— are restricted to OWNER/ADMIN/THERAPIST, so receptionists and clients cannot
reach them. `apps/api/src/roles.spec.ts` fails the build if any authenticated
route lacks a role declaration, so a new endpoint cannot inherit the old
"any authenticated user" behaviour.

### 2. Public client portal is email-only — **FIXED**

`GET /v1/consult/public/client-portal?email=...` accepts an email address as the lookup credential and returns session history and video links.

Evidence:

- `apps/api/src/modules/consult/consult.controller.ts:156-161`
- `apps/api/src/modules/consult/consult.service.ts:624-688`

Impact: anyone who knows or guesses an email can access appointment information and potentially join an unauthenticated Jitsi room.

**Resolved.** The route is replaced by `GET /v1/consult/portal`, behind
`JwtAuthGuard` and `RolesGuard`, which identifies the client from their session
rather than a query parameter — `getClientPortal(tenantId, profileId)` takes no
email at all. The client-side email box that let a visitor type any address is
gone; unauthenticated visitors now see a prompt to sign in with the address they
booked under, which the app already directs them to do at account setup.

### 3. Google OAuth state is forgeable

The OAuth state is the predictable string `${tenantId}_${profileId}` and the callback updates a profile by `profileId` without validating an initiating session or tenant ownership.

Evidence: `apps/api/src/modules/calendar/calendar.service.ts:22-49`.

Impact: account-linking CSRF and possible cross-tenant token writes.

### 4. Booking availability is not reserved atomically

Availability is checked before the transaction and then deactivated with an unconditional update. Concurrent requests can both create bookings for one slot.

Evidence: `apps/api/src/modules/consult/consult.service.ts:412-491`.

Impact: double bookings, duplicate payment attempts, and unreliable clinical scheduling.

### 5. Frontend can present demo records as real practice data

The app supplies hardcoded clients, sessions, staff, and billing history as SWR
`fallbackData`, including when the API request fails. It also starts billing state
with a fictional Pro subscription and bank account.

Evidence: `apps/app/src/App.tsx:189-240,291-338`.

Impact: an outage or an unconfigured tenant can display fictional client names,
clinical notes, payment history, and bank details in a live workspace. This is a
data-trust and privacy blocker, not merely a visual issue.

**Status:** Fixed on the current working tree. Private app fallback records and
fictional billing state were removed. Failed API loads now show an error state;
the synthetic account remains available only through the explicit database seed.
Regression coverage was added in `apps/app/src/utils/__tests__/private-data.test.ts`.

### 6. Several user-facing actions are visibly present but non-functional

Verified examples include:

- Invite claim only calls `navigate('/dashboard')`; it does not call an API or
  validate the invite, and it displays fixed Smith Therapy / Segun data:
  `apps/app/src/pages/auth/InvitePage.tsx:15-34,45-52,149-205`.
- Schedule create and delete only mutate local React state and do not persist to
  the API: `apps/app/src/pages/SchedulePage.tsx:151-185`.
- The Notes action has no click handler: `apps/app/src/pages/DashboardPage.tsx:373-376`.
- The dashboard notification button has no click handler:
  `apps/app/src/pages/DashboardPage.tsx:216-220`.
- Client portal Reschedule has no action and Payments explicitly says it is not
  wired: `apps/app/src/pages/ClientPortalPage.tsx:226-229,327-330`.
- Dashboard branding Settings navigates to `/settings/brand`, which is not the
  registered workspace route (`/dashboard/settings/brand`):
  `apps/app/src/pages/DashboardPage.tsx:497-503`.

Impact: users can believe bookings, staff changes, or settings succeeded when
they will disappear on refresh, or encounter dead-end controls in core workflows.

## P1 high-priority risks

- Caller-controlled `callbackUrl` is passed to payment checkout. Validate against an allow-list in `apps/api/src/modules/billing/billing.controller.ts:79-87` and booking checkout code.
- Authentication logs include password lengths, hash prefixes, and full password-reset links. Remove these from `apps/api/src/modules/auth/auth.service.ts:159-169,397-473`.
- Production secrets exist in local `.env` files. Rotate Paystack, Google, JWT, refresh, and SMTP credentials and move them to managed production secret storage.
- Off-host backups, restore drills, API Cloudflare proxying/origin firewall, HSTS/CSP enforcement, and production Sentry configuration remain operational work. See `docs/GO_LIVE_CHECKLIST.md:162-201`.
- Existing tests do not cover role authorization, client portal privacy, OAuth state, concurrent booking exclusivity, callback URL validation, or end-to-end payment reconciliation.
- Frontend tests do not cover persistence of scheduling/invite actions, route/link
  integrity, or the no-demo-data guarantee after API errors.

## Branding and content defects

- The app legal pages still say “Unclutter OS” instead of “Unclutter Desk”:
  `apps/app/src/pages/PrivacyPolicyPage.tsx:13,22` and
  `apps/app/src/pages/TermsOfServicePage.tsx:20,26,44,57,60,71`.
- Invite UI still says “Smith Therapy Ltd”, “segun@smiththerapy.ng”, and
  “unclutterOS”: `apps/app/src/pages/auth/InvitePage.tsx:50,80,151,201,204`.
- Login and platform-admin screens still use “unclutterOS”:
  `apps/app/src/pages/auth/LoginPage.tsx:75`,
  `apps/app/src/pages/admin/AdminTenantsPage.tsx:50`,
  `apps/app/src/pages/admin/PlatformAdminLoginPage.tsx:39,55`, and
  `apps/app/src/pages/admin/PlatformAdminLayout.tsx:117`.
- Calendar downloads still emit `Unclutter OS` and `unclutter.os` metadata:
  `apps/api/src/modules/calendar/calendar.service.ts:196,200`.
- The marketing page uses a fictional Dr. Jane Smith booking mockup and a
  “Watch 2-Min Demo” link that only jumps to `#features`:
  `apps/landing/src/components/LandingPage.tsx:161-164,176-295`.
- Marketing footer social/company links are placeholders (`href="#"`):
  `apps/landing/src/components/LandingPage.tsx:531-554`.

These must be corrected or explicitly labeled as illustrative before public
launch. A product mockup may remain on the landing page, but it must not be
mistaken for live data and its CTA must either work or be removed.

## What is already in good shape

- Typecheck, tests, and builds are currently green.
- Paystack webhook signature verification uses the raw request body.
- Tenant IDs are derived from JWT context and several known cross-tenant write defects were fixed.
- CSRF, helmet, exception handling, migration backups, tenant routing, and Sentry scrubbing have meaningful implementation and unit coverage.

## Decision

Do not onboard real practices or allow real PHI until all P0 blockers are fixed and the phase-gated plan in `docs/LIVE_USAGE_PLAN.md` is completed. A private demo with synthetic data is acceptable only if access is restricted and no real client data is entered.
