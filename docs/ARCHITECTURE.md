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
- **What each plan includes lives in one table:**
  `apps/api/src/modules/entitlements/entitlements.ts` (`ENTITLEMENTS`,
  `entitlementsFor(tenant)`). Booking limits, the platform fee, custom domains,
  staff invites, assessments, Google Calendar push and bank-transfer payments
  all read it. `entitlements.spec.ts` fails the build if a tier is compared with
  a string anywhere else in the API.
- A feature the plan lacks fails with HTTP 402
  `{ code: 'ENTITLEMENT_REQUIRED', feature, requiredTier }`.
- `GET /v1/tenant/entitlements` returns the plan, what it includes and this
  month's booking usage, so the app can show a feature as locked before the API
  refuses it (`apps/app/src/utils/entitlements.ts`).
- A paid plan changes only from a signature-verified Paystack webhook. A
  cancelled subscription drops to `FREE` when its paid month ends; a failed
  renewal drops after a grace period (`BILLING_GRACE_DAYS`, default 7). A
  practice with staff `FREE` cannot hold keeps its plan and the owner is told.
- Invite codes grant `PRO` or `CLINIC` for a set number of days, then the
  practice returns to `FREE` unless it is paying.

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
