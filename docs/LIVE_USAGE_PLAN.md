# Plan for Live Usage

## Goal

Move from a technically deployable demo to a safe, supportable launch for a small number of real practices. No phase should accept real PHI until its exit criteria pass.

## Phase 0: Freeze and protect

1. Keep signup closed or restrict it to an allow-list.
2. Do not use real client data; label existing environments as non-production until verified.
3. Rotate every credential present on developer machines: `JWT_SECRET`, `REFRESH_SECRET`, Paystack, Google OAuth, SMTP, and Sentry keys as applicable.
4. Confirm production and test Paystack credentials and plan codes cannot be mixed.
5. Confirm no demo account, test tenant, test bookings, or seeded credentials exist in production.

**Exit:** secrets rotated, production access documented, synthetic-data rule enforced, and a named incident owner exists.

## Phase 1: Authorization and privacy blockers

1. ~~Add a reusable role guard/decorator and enforce it at controller or route level.~~ **Done** — `common/roles.guard.ts`, `common/roles.ts`.
2. ~~Define the permission matrix for `OWNER`, `ADMIN`, `THERAPIST`, `RECEPTIONIST`, and `CLIENT`.~~ **Done** — applied across 56 routes; `STAFF`, `CLINICAL` and `PRACTICE_ADMIN` role sets, with `roles.spec.ts` failing the build on an unannotated authenticated route.
3. ~~Deny clients from staff dashboards, client lists, notes, submissions, billing, scheduling, staff management, tenant settings, and therapist administration.~~ **Done** — clinical routes are OWNER/ADMIN/THERAPIST only; receptionists are excluded from anything returning SOAP notes or assessment answers.
4. Add runtime integration tests for every role and every PHI-bearing route, including cross-tenant attempts.
5. ~~Replace email-only client portal lookup with a short-lived, single-use signed access token or authenticated client session. Do not return video links without authorization.~~ **Done** — `GET /v1/consult/portal` derives the client from their session; the public email lookup is removed.
6. Add expiry, revocation, and replay tests for portal access.

**Exit:** unauthorized requests return `401/403`, no client can reach staff APIs, and portal data is accessible only with a valid scoped credential.

## Phase 2: Data integrity and integration security

1. ~~Make slot reservation atomic with a database-enforced uniqueness strategy or conditional update inside the transaction.~~ **Done** — conditional `updateMany` claims the slot before anything is written.
2. ~~Add concurrency tests proving one slot produces at most one active booking.~~ **Done** — `booking-concurrency.spec.ts`; a lost race writes no booking and consumes no discount code.
3. ~~Replace OAuth state with a cryptographically random, signed or server-stored state tied to tenant, profile, browser/session, expiry, and one-time use.~~ **Done** — signed payload with a stored, single-use nonce and a 10-minute expiry.
4. ~~Validate OAuth callback ownership before storing refresh tokens.~~ **Done** — the write is scoped by tenant and profile, and fails if the practitioner is not in the state's tenant.
5. Restrict checkout redirects to known application origins and fixed route patterns; reject arbitrary URLs.
6. Remove sensitive auth logging and add a test that reset tokens, passwords, hashes, cookies, and request bodies never reach logs.

**Exit:** concurrency, OAuth CSRF, redirect validation, and log-scrubbing tests pass.

## Phase 3: Production operations

1. Complete the database migration baseline on the production host using `docs/DATABASE_MIGRATION_RUNBOOK.md`.
2. Configure scheduled off-host backups and complete a documented restore drill.
3. Put the API behind Cloudflare, install a valid origin certificate, enable Full (strict), configure real client IP handling, and firewall the origin to Cloudflare ranges.
4. Configure Sentry with a production DSN and verify a synthetic error arrives without PHI.
5. Enable HSTS carefully and promote CSP from report-only after observing real flows.
6. Add uptime checks for `/health`, API latency/error rate alerts, backup failure alerts, and payment webhook failure alerts.

**Exit:** restore is proven, monitoring pages the owner, direct-origin bypass is closed, and rollback steps are tested.

## Phase 4: Product launch verification

Run a fresh end-to-end test tenant using test payment credentials and synthetic users:

- signup, email verification, login, logout, refresh, password reset
- owner/admin/therapist/receptionist/client permissions
- tenant subdomain, custom domain, branding, and unknown-host 404
- availability, concurrent booking protection, cancellation, and payment webhook
- payout setup and payment reconciliation
- Jitsi, Google Meet, Google Calendar, and `.ics` access control
- SOAP autosave, note locking, intake, consent, PHQ-9, and GAD-7
- reminders, email delivery, in-app notifications, reviews, and account closure/export

Record evidence for each flow in the launch checklist. Remove any marketing claim that cannot be demonstrated.

## Phase 4A: Frontend truth and completion

Complete this before onboarding real users:

1. [x] Remove production fallback/demo records from `apps/app/src/App.tsx`.
   API errors now show an error state; empty tenants show empty states.
2. Remove fictional billing, client, session, staff, bank, and clinical data from
   private pages. Keep illustrative data only inside clearly labeled marketing
   mockups.
3. Wire invite claiming to the backend, validate the token, persist the profile,
   and redirect only after success. Use the invited tenant's name and email.
4. ~~Persist schedule creation, cancellation, and status changes through the API;
   re-fetch after mutation and show loading/failure states.~~ **Done.**
5. Wire or remove every visible action: Notes, notifications, reschedule,
   payment history, profile upload, practice status, and settings shortcuts.
   **Mostly done** — Notes wired, reschedule and payment history removed,
   brand settings route corrected. Dashboard notification button still unwired.
6. Add a route/link audit for every `Link`, `href`, and button in the primary
   signup, onboarding, booking, portal, and workspace flows.
7. Replace all user-visible and generated “Unclutter OS”, “unclutterOS”, and
   `unclutter.os` branding with “Unclutter Desk” and the approved domain.
8. Replace Smith Therapy, Dr. Jane Smith, Segun, Adaeze, and other fictional
   user-facing records outside intentionally labeled marketing examples.
9. Replace placeholder social/company links with real destinations or remove
   them. Replace the fake demo CTA with a real video/demo route or label it
   “Explore features”.

**Status:** Item 1 is complete. Verified with the private-data regression test;
the remaining items are still open.

### Mockup data policy

The synthetic demo workspace is now created by an idempotent Prisma data
migration on local, staging, and live databases. The migration creates the
marked `demo` tenant plus synthetic owner, client, booking, note, service, and
assessment records. It never contains a usable password.

For a local or isolated staging demo, the legacy full-reset seed remains available:

```bash
pnpm db:seed
```

`prisma/seed.js` clears and recreates the database with synthetic users, clients,
bookings, notes, assessments, and services. It must never run against production;
the seed script prints this warning and production deploys keep `SEED_DB=false`.
After migrations, provision the demo password from a server secret:

```bash
DEMO_PASSWORD='use-a-private-12-plus-character-secret' pnpm exec node scripts/provision-demo-account.mjs
```

Never commit or publish that password. Private pages do not contain an embedded
copy of this data and do not fall back to it when an API request fails.

If the first live attempt failed after the backup completed, use
`npx prisma migrate resolve --rolled-back 20260903230000_demo_workspace` once on
the server before rerunning `./deploy.sh`. Confirm the backup file exists first.

**Exit:** a fresh tenant never sees another tenant's or fictional private data;
refreshing after every supported mutation preserves the result; every visible
primary action either works or is removed; branding and links pass a scripted
route/content scan.

## Phase 5: Controlled launch

1. Launch with one or two invited practices.
2. Set conservative limits and manually review payment, booking, notification, and backup signals daily for the first two weeks.
3. Collect incidents and support issues in one log.
4. Expand access only after seven days without a P0/P1 incident and after the restore/monitoring checks have been repeated.

## Final go-live gate

Go live only when:

- all P0 findings in `LIVE_USAGE_READINESS_AUDIT_2026-09-03.md` are closed;
- all P0 findings in `LIVE_USAGE_READINESS_AUDIT_2026-09-03.md` are closed;
- frontend contains no private-page demo fallback data and no unlabelled dead
  controls;
- all public branding says “Unclutter Desk” consistently;
- role and privacy integration tests pass;
- payment and booking concurrency tests pass;
- secrets, backups, restore, monitoring, Cloudflare, and legal pages are complete;
- a production smoke test succeeds with synthetic data;
- an owner, support process, incident procedure, and rollback procedure are documented.
