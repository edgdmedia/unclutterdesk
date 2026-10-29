# Unclutter Desk — Architecture

How the system is built today. When this file and the code disagree, the code
is right and this file needs fixing in the same PR.

---

## 1. Repo layout (pnpm workspace)

```
apps/
  api/            NestJS REST API: tenants, auth, booking, billing, clinical
                  features, crons and webhooks
  app/            Vite + React SPA: practice dashboard (/dashboard/*), client
                  portal, public booking pages, platform admin (/admin/*)
  landing/        Astro marketing site (index, privacy, terms, 404)
  tenant-router/  Cloudflare Worker on *.unclutterdesk.com: proxies the SPA,
                  404s unknown practices, adds X-Robots-Tag: noindex
packages/
  shared/         Shared TypeScript types and helpers
  ui/             Shared React components
prisma/
  schema.prisma   The schema. Migrations live in prisma/migrations
```

There are no WebSockets, no Redis and no job queue.

## 2. Runtime

| Piece | Where it runs |
|---|---|
| API | One VPS, pm2 with **one instance on purpose**: the rate limiter is in memory and crons run in-process. Running more than one needs Redis and a job runner first |
| App, landing | Cloudflare Pages |
| Practice subdomains | `tenant-router` Worker, serving the same SPA bundle |
| Custom domains | Cloudflare for SaaS custom hostnames |
| Database | PostgreSQL via Prisma. IDs are `BigInt`; money is `*Kobo` `BigInt` |

Background work is `@Cron` jobs inside the API (bookings every 5 min, custom
domains every 5 min, invite-code expiry hourly, lapsed subscriptions daily).
Notification dispatch goes through the `NotificationDispatch` table.

## 3. Multi-tenancy

- Tenant-scoped rows carry `tenantId`. There is **no Postgres RLS and no Prisma
  middleware**: every service query filters by `tenantId` itself.
  `tenant-isolation.spec.ts` and `roles.spec.ts` guard this.
- The SPA works out the practice from the hostname and sends `X-Tenant-Slug`.
  `TenantMiddleware` resolves it (slug, then ACTIVE custom domain, then `Host`).
- Signed-in requests take the tenant from the JWT via `authenticatedTenantId(req)`,
  never from the header.

## 4. Auth and permissions

- The JWT carries `sub`, `profileId`, `tenantId`, `type`, `sid`, and `roles` only
  for platform admins. **Practice roles are not in the JWT.**
- `RolesGuard` reads `Profile.role` + `Profile.permissions` from the database.
  Every authenticated route needs a `@Permissions(...)` annotation; the build
  fails without one.

## 5. Plans and entitlements

- `Tenant.subscriptionTier` is one of `FREE`, `STARTER`, `PRO`, `CLINIC`. New
  practices start on `FREE`.
- **What each plan includes lives in one place:**
  `apps/api/src/modules/entitlements/entitlements.ts`, in two scopes. Practice
  entitlements (`practiceEntitlements(tenant)`: booking limit, platform fee,
  bank transfer, custom domain, staff invites, assessments, Google Calendar)
  come from the practice's plan. Profile entitlements (PDF, intro video) come
  from the best plan among the practices where the person is an active OWNER
  or THERAPIST (`EntitlementsService.forProfile`).
- `effectiveTier(tenant)` is the plan in force: a paid tier needs a Paystack
  subscription (active, or lapsing) or a complimentary plan in force;
  otherwise, or if the stored value is empty or unknown, it is `FREE`. Queries
  select `PLAN_SELECT` so no field is forgotten.
- `entitlements.spec.ts` fails the build if a tier is compared with a string,
  or `subscriptionTier` is read, anywhere else in the API.
- A feature the plan lacks fails with HTTP 402
  `{ code: 'ENTITLEMENT_REQUIRED', scope, feature, requiredTier }`.
- `GET /v1/tenant/entitlements` (practice) and `GET /v1/me/profile-entitlements`
  (person) let the app show a feature as locked before the API refuses it
  (`apps/app/src/utils/entitlements.ts`).
- **Booking limits** count bookings created since midnight on the 1st in
  Africa/Lagos time (`common/lagos-time.ts`), excluding cancelled ones. Staff
  entries for today or earlier are never blocked; future ones follow the limit.
- **Complimentary plans** (`complimentaryReason`): `INVITE_CODE`, `MIGRATION`
  (90 days of Starter for practices that existed before v2), `INTERNAL` (no end
  date when `complimentaryUntil` is null: the founder's and the demo practice).
  An hourly cron ends expired periods (to `FREE` unless paying) and queues the
  "free until" and 14-/3-day reminder emails. A payment clears both fields.
  `pnpm tsx scripts/set-internal-tenant.ts --tenant <id> --tier <tier>` sets
  INTERNAL. Admins change plans only through Complimentary plans
  (`POST /v1/admin/tenants/:id/complimentary`).
- **Paid plans** change only from a signature-verified Paystack webhook. A
  failed renewal, or the end of a paid period after cancellation, starts the
  lapse timeline (`billing/subscription-lapse.service.ts`): grace
  (`BILLING_GRACE_DAYS`, 7), then notice with the exact date
  (`BILLING_NOTICE_DAYS`, 14), then `FREE` with every active membership except
  the owner paused (`Profile.pausedByDowngradeAt`). Paying again stops it and
  reactivates only the paused memberships. Nothing is ever downgraded on the
  spot; a missing renewal date is fetched from Paystack.

## 6. Video

Rooms are created on Daily.co while its monthly budget lasts, then on 8x8's
Jitsi as a Service, then as a plain meet.jit.si link (`video-router.service.ts`).
A therapist with Google Calendar connected (Starter and up) can use Google Meet
links instead.

## 7. Security

- Clinical note narrative fields (the four SOAP fields) are encrypted in the
  application with AES-256-GCM (`common/field-encryption.ts`). Losing
  `FIELD_ENCRYPTION_KEY` loses those notes. Intake answers, assessment answers
  and session summaries are stored as plaintext today.
- Backups are encrypted with AES-256 before they leave the server. The database
  volume itself is not encrypted at rest.
- Account lockout after repeated failed logins; CSRF protection on cookie
  sessions.
