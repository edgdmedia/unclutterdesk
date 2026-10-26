# Unclutter Desk — Current State (for v2 planning)

As of 26 Oct 2026. Taken from the code on `dev`, which is fully merged into `origin/main` (last merge: PR #53, 7 Oct 2026). Where the docs disagree with the code, this file goes by the code.

**How this was checked:** by reading the code. I could not run the tests locally because `node_modules` is broken (`vitest/vitest.mjs` missing in each app). The 8 most recent GitHub Actions runs all passed, and each one runs typecheck plus the api, ui, app and tenant-router test suites. The repo has about 188 spec/test files.

---

## 1. Repo structure (pnpm workspace)

| Path | What it is |
|---|---|
| `apps/api` | NestJS REST API. Handles every tenant, auth, booking, billing, clinical feature, cron and webhook |
| `apps/app` | Vite + React SPA. One bundle serves the practice dashboard (`/dashboard/*`), the client portal, the public booking pages and the platform admin (`/admin/*`) |
| `apps/landing` | Astro marketing site (`index`, `privacy`, `terms`, `404`). It is almost all one React component, `LandingPage.tsx` |
| `apps/tenant-router` | Cloudflare Worker on `*.unclutterdesk.com/*`. It proxies to the app's Pages project, 404s unknown practices, and adds `X-Robots-Tag: noindex` |
| `packages/shared` | Shared TypeScript types and helpers |
| `packages/ui` | Shared React components (has its own tests) |
| `prisma/` | **The real schema** (`schema.prisma`, 917 lines, 35 models), 27 migrations, `seed.js` |
| `apps/prisma/` | **Stray and untracked.** It holds one duplicate migration folder. Delete it or explain it |
| `deploy.sh`, `ecosystem.config.js` | Deploys the API on the VPS (pg_dump backup first, then pm2) |

## 2. Stack and versions

| Layer | Tech |
|---|---|
| API | NestJS ^10.4, Express, passport-jwt, @nestjs/schedule (cron), @nestjs/throttler (in-memory store), Swagger, Sentry ^10, googleapis, nodemailer, Resend client, web-push, pdfkit, jose |
| Frontend | React 18.3, Vite 5.4, Tailwind 4.3, TypeScript 5.5 |
| Landing | Astro ^7.2 with a React island, Tailwind 4.3 |
| DB / ORM | PostgreSQL, Prisma ^5.22. IDs are `BigInt`. Money is stored as `*Kobo` BigInt |
| Tests | Vitest 2.1 |
| Hosting | **API:** a single VPS (`/home/unclutterdesk/app`) running pm2 with **1 instance on purpose** (throttler is in-memory; cluster mode needs Redis). It deploys by SSH from GitHub Actions on push to `main`. **App and landing:** Cloudflare Pages via `wrangler pages deploy`. **Tenant router:** Cloudflare Worker. **Custom domains:** Cloudflare for SaaS custom hostnames |
| Node | 22 in CI, `>=20` in engines |

There are no WebSockets, no Redis and no job queue. Background work runs on in-process `@Cron` jobs: consult every 5 min, custom-domain check every 5 min, invite/complimentary expiry every hour. Notification dispatch goes through a `NotificationDispatch` table.

## 3. Data model (35 models)

Most string "enums" are plain `String` columns, not Prisma enums.

**Tenancy and identity**
- **Tenant**: `slug` (unique), `customDomain` (unique) + `customDomainStatus` (PENDING/ACTIVE…) + `customHostnameId`/`customHostnameError`. Branding: `logoUrl`, `faviconUrl`, `primaryColor`, `secondaryColor`, `tagline`, `welcomeTitle/Message`, `shortName`, public contact fields, `category`. `currency`="NGN", `cancellationHours`, `isDemo`, `isActive`, `closureRequestedAt`. **Plan fields:** `subscriptionTier`="STARTER", `subscriptionStatus`, `subscriptionRenewsAt`, `paystackCustomerCode`/`SubscriptionCode`/`SubscriptionToken`, `complimentaryUntil`, `inviteCodeId → InviteCode`. Payments: `manualPaymentsEnabled`, `manualPaymentDetails` (Json). Also `notificationChannels` (Json) and `ecosystemIntegrationEnabled`.
- **User**: the global login. `email`/`username` unique, `password` (bcrypt), lockout fields, `platformRole` (non-null means platform admin). Has many `Profile`.
- **Profile**: one row per person per tenant. `@@unique([tenantId,email])`. `role` (OWNER/ADMIN/THERAPIST/RECEPTIONIST/CLIENT, default CLIENT), `permissions String[]` (extra grants), `status`, demographics, emergency contact, locale/timezone/format prefs, `accountTokenHash` (client set-password link), `tourCompletedAt`. `userId` is nullable, so a client can exist before they have a login.
- **Token**: refresh sessions, reset/verify codes and OAuth state, all stored hashed (`type`, `tokenHash`, `revokedAt`, UA/IP).
- **InviteCode / InviteSend**: platform invite codes. Each grants a `tier` for `durationDays` (default 90). `maxUses`, `redeemBy`.
- **ConsultPendingInvite**: staff invite (`role`, `claimToken`, expires after 7 days).

**Practitioner**
- **ConsultTherapistProfile**: PK `profileId`, 1:1 with Profile. `publicUsername` (unique per tenant), `bookingEmail`, `notificationEmail`, bio fields (`tagline`, `specialty`, `modalities[]`, `credentials`, `yearsExperience`, `languages[]`), `isPublic`, `acceptsGeneralBooking`, `isVerified`, `offersOnline`/`offersInPerson`, `sessionLengthMinutes`=50, `gapMinutes`=10, `videoProvider`="BUILT_IN", `dailyApiKey`, `googleRefreshToken`.
- **PracticeLocation** ↔ **TherapistLocation** (join table) ↔ therapist.
- **TherapistWeeklyTime**: a weekly template (`weekday`, `start`, online/in-person, location).
- **ConsultAvailability**: a concrete slot (`startsAt`/`endsAt`, `serviceId?`, online/in-person, `locationId`, `customised`, `createdForBooking`).

**Booking and money**
- **ConsultService**: `title`, `durationMinutes`, `priceKobo`. Has many **ConsultServiceFormat** (`format` ONLINE/IN_PERSON with its own `priceKobo`).
- **ConsultBooking**: belongs to service, availability and client Profile. `status` (default PENDING_PAYMENT), `paymentMethod` (PAYSTACK/manual), hold fields (`holdExpiresAt`/`holdReleasedAt`), refund fields, `paymentRef` (unique), `amountKobo`, `discountCodeUsed`, `format`, `locationId`, `videoRoomName`/`videoProvider`, `internalSummary`, `clientRecap`/`clientRecapSentAt`.
- **DiscountCode**: PERCENT or amount, `maxUses`, `expiresAt`.
- **BankSubaccount**: one per tenant. Bank details + `paystackCode` (the Paystack split subaccount).

**Clinical**
- **UniversalForm**: `targetType` (INTAKE…), `schemaJson`, `systemKey`, `isDefault`, plus review-publication settings. Feeds **UniversalFormSubmission** (`answersJson`, `derivedJson`, `status` UNREAD…, `bookingId?`).
- **FormTemplate**: a shareable template (`shareStatus` PRIVATE → reviewed by the platform admin).
- **ClinicalNote**: SOAP fields (`subjective`/`objective`/`assessment`/`plan`, **AES-256-GCM encrypted in the app**), `diagnosisCode`, `isLocked`, `bookingId?`.
- **AssessmentInstrument**: PK `key`, `definition` Json, `builtIn`, `version`. Linked via **TenantAssessment** (enabled per tenant), **AssessmentAssignment** (token link sent to a client) and **AssessmentResponse** (`totalScore`, `severityLabel/Level`, `result`, `hasFlags`).
- **PractitionerHoursEntry** (`category`, `source` MANUAL or from a booking, `supervisorName`) and **PractitionerHoursTarget**.

**Comms and ops**
- **Notification** (in-app), **NotificationDispatch** (outbox with `triggerAt`, `attempts`, `dedupeKey`), **NotificationPreference**, **EmailLog**, **WebPushSubscription**, **TenantSendingDomain** (a Resend domain per tenant, with DNS records).
- **VideoParticipant**: join/leave minutes, used to track usage for each provider.
- **PlatformRequest**: a practice-to-platform support/feature request (`type`, `status`, `adminNote`).

## 4. Multi-tenancy

- **Isolation:** row-level by `tenantId` on every model. There is no Postgres RLS, so isolation is enforced in the services. `tenant-isolation.spec.ts` and `roles.spec.ts` guard it, and the build fails if an authenticated route has no permission annotation.
- **Subdomains:** the `tenant-router` Worker answers `{slug}.unclutterdesk.com` and serves the **same SPA bundle** from `app-unclutterdesk.pages.dev`. Before serving booking surfaces it calls `GET /v1/tenant/public/exists/:slugOrDomain` (result cached). Unknown slug → a "practice not found" 404. Inactive practice → still served (the app shows `/booking/inactive`).
- **The SPA** works out the tenant client-side from `window.location.hostname` and sends **`X-Tenant-Slug`** on API calls to `api.unclutterdesk.com`. On a custom domain the "slug" it sends is the full hostname.
- **API `TenantMiddleware`:**
  1. If `X-Tenant-Slug` is present: match `slug`. If there is no match and the value contains a dot, match `customDomain` with status ACTIVE.
  2. Otherwise use the `Host` header: exact ACTIVE `customDomain` first, then the first label as the slug (skipping `www`, `app`, `api`; `*.localhost` works in dev).
  3. `/v1/discount/validate` is skipped; it takes `tenantId` in the body.
- For signed-in requests, `authenticatedTenantId(req)` takes the tenant from the JWT, not the header.
- **Custom domains:** these are live (SET-13 fixed). They go through Cloudflare for SaaS (`cloudflare-saas.service.ts`), a cron polls status every 5 min, and they are **blocked on STARTER**. The onboarding wizard still hides the option ("SET-03: coming soon").
- The reserved-slug list is in `modules/tenant/reserved-slugs.ts`.

## 5. Public pages (what a client sees)

**SPA routes on a practice host:** `/` (PublicProfilePage), `/book`, `/booking/confirmed`, `/booking/inactive`, `/review` (public review form), `/assessment/:token`, `/set-password`, `/client/create-account`, client login, a pay-link page, and `/session/:id` (video room).

**PublicProfilePage** has these sections:
- Hero: practice name, tagline, logo, brand colours, CTA
- About: welcome message, address/contact
- Therapists and services cards
- Closing CTA into `/book`
- Published client reviews

**Booking flow** (`pages/public/booking/useBookingData.ts`): choose service → format (online or in-person + location) → therapist → slot → intake form → client signs up or signs in → payment (Paystack pop-up, or manual bank transfer with "I've sent it").

**No-auth endpoints:**
- Tenant: `GET /v1/tenant/public/info`, `GET /v1/tenant/public/info/:slugOrDomain`, `GET /v1/tenant/public/exists/:slugOrDomain`, `GET /v1/tenant/public/invite/:claimToken`, `GET /v1/tenant/:id/logo`, `POST /v1/tenant/register`
- Consult: `GET /v1/consult/public/therapists`, `GET /v1/consult/public/services`, `GET /v1/consult/public/availability`, `GET /v1/consult/public/payment-options`, `POST /v1/consult/public/bookings/:id/transfer-sent`, `GET`/`POST /v1/consult/public/bookings/:id/pay-link`, `POST /v1/consult/public/bookings/:id/pay`
- Intake: `GET /v1/intake/public/forms`, `GET /v1/intake/public/reviews`, `POST /v1/intake/public/submissions`
- Assessments: `GET`/`POST /v1/assessments/public/:token`
- Other: `POST /v1/discount/validate`, `GET /v1/invites/check/:code`, `GET /v1/calendar/bookings/:id/ical` (signed token), `GET /v1/calendar/google/callback`
- Auth: all `/v1/auth/*` (register, login, refresh, logout, verify-email, resend-verification, forgot/reset-password, invite/claim, client-signup, client-set-password), `POST /v1/admin/auth/login`
- Webhooks: `POST /v1/billing/paystack-webhook`, `POST /v1/video/webhooks/daily`
- `GET /health`

Creating a booking (`POST /v1/consult/public/bookings`) and confirming payment **need a signed-in client** (`any.authenticated`).

## 6. Plans and billing

| Tier (code) | Price (`subscription-plans.ts`) | Gates found in code |
|---|---|---|
| `STARTER` (default) | ₦5,000/mo | **20 bookings per calendar month** (`booking-limits.ts`); no custom domain; no staff invites; **5% platform fee** on booking payments; PHQ-9 and GAD-7 only |
| `PRO` | ₦15,000/mo | Unlimited bookings, custom domain, can invite ADMIN/RECEPTIONIST but **not** another THERAPIST, 0% fee, PRO assessments (PCL-5, DASS-21) |
| `CLINIC` | ₦45,000/mo | Multiple therapists; everything else |

- **Gating is ad hoc.** Checks like `tier === 'STARTER'` are scattered through services (tenant, billing, booking-limits). Assessments use `tierIncludes(plan, needed)` (`assessments/engine.ts`) with rank STARTER < PRO < CLINIC. There is no central entitlement map, and the frontend mostly relies on API errors.
- **Free tier: no.** Starter is priced at ₦5,000, yet comments call it "Free", and Starter tenants get the default tier without paying. Nothing forces a Starter practice to subscribe: `subscriptionStatus` stays `unpaid` and they keep working. **In practice Starter is a free tier with a 5% booking fee.**
- **14-day trial: UI only.** The signup page and onboarding wizard say "Everything is unlocked for 14 days, no card". The API has no trial logic. A new practice is simply STARTER. The only time-boxed upgrade is **invite codes**: admin-issued, giving PRO or CLINIC free for N days (default 90). An hourly cron moves practices back to STARTER when the period ends.
- **Paystack (built):**
  - Subscriptions: `POST /v1/billing/subscribe` returns an authorization URL. The tier changes **only from the webhook**.
  - Webhook events handled: `charge.success` (refs `booking-*` and `subscription-*`), `subscription.create`, `invoice.payment_failed` (flags the practice; does not downgrade), `subscription.disable` / `subscription.not_renew`.
  - Booking payments go through a Paystack **split subaccount** for each practice (`BankSubaccount`; bank list and account resolve endpoints).
  - Manual bank-transfer payments: the client reports payment, then the front desk marks it paid.
  - Plan codes come from the env vars `PAYSTACK_PLAN_STARTER/PRO/CLINIC`.
  - Downgrades are blocked while extra staff exist.

## 7. Feature inventory

| Feature | Status | Notes |
|---|---|---|
| Booking | **BUILT** | Services with online and in-person prices, locations, weekly templates and slots, payment holds that expire (cron), Paystack and manual payment, discount codes, staff-created bookings, cancellation window, iCal download. Gaps: past sessions stay "Confirmed" forever (BKG-13); no "notify me when free" (BKG-08, deferred) |
| Intake & consent | **BUILT** | Universal form engine with default intake forms seeded per tenant, required consent, submissions inbox, public review forms |
| Form engine | **BUILT** | JSON-schema forms, conditional logic, shareable templates reviewed by the platform admin. Open: FRM-02 (too wide on phones), FRM-03, FRM-04 |
| Google Calendar sync | **PARTIAL** | One-way **push** only: OAuth `calendar.events` scope, `events.insert/patch` when a booking is confirmed. No free/busy read, so outside events don't block slots, and no two-way sync. SET-10: the UI shows "Connect" again after connecting |
| Video | **BUILT (not plain Jitsi)** | `VideoRouter` order is **Daily.co** (up to 9,500 min/mo) → **JaaS (8x8 Jitsi, signed JWT)** (up to 23 MAU) → **public meet.jit.si link** as last resort. Join windows, participant-minute tracking, admin usage report. No Google Meet provider |
| Session notes | **BUILT** | SOAP notes with live autosave in the video room, locking, encrypted at rest. Session page has an internal summary and a client recap the therapist can send |
| Reports | **PARTIAL** | Practice `/dashboard/analytics` page; admin stats and video-usage report; hours CSV/PDF export. No clinical outcome reports or report builder. ADM-04: admin "gross revenue" counts practice income |
| Assignments | **PARTIAL** | Only **assessment** assignments, sent as a token link. **No homework or worksheet assignments** |
| Assessments | **BUILT** | Instruments defined in data, scored by an engine. Built in: PHQ-9 and GAD-7 (Starter), **PCL-5 and DASS-21 (Pro)**. Risk flags (PHQ-9 item 9). Platform admin can author instruments with a preview. Per-tenant enable, client results history |
| Hours log | **BUILT** | Manual entries plus entries created from bookings, categories, supervisor, targets, CSV/PDF export |
| Notifications: email | **BUILT** | Resend or SMTP transports, a per-tenant sending domain (verified with Resend), EmailLog, outbox with retries and dedupe |
| Notifications: in-app / push | **BUILT** | In-app bell, Web Push (VAPID) |
| Notifications: SMS | **PARTIAL** | Termii channel, used only when `SMS_*` env vars are set |
| Notifications: WhatsApp | **NOT BUILT** | No code at all |
| Client reminders | **NOT BUILT** | NOT-07, NOT-13, NOT-14 are "Ready" but unbuilt |
| Editable email wording | **NOT BUILT** | NOT-12 |
| Roles / RBAC | **BUILT** | 5 practice roles mapped to permissions (`practice.admin`, `practice.staff`, `clinical.record`, `payments.desk`, `any.authenticated`), extra grants per profile (`Profile.permissions`), `RolesGuard` reads role from the DB on every request |
| Admin panel | **BUILT** | `/admin`: overview stats, tenants (change tier, activate/deactivate), invite codes (create, email), platform requests, template review, assessment instruments, video usage. Admins can switch into a practice |
| Privacy / data | **BUILT** | Data export, practice closure flow |

## 8. Auth

- **Mechanism:** email + password (bcrypt). JWT access token (15 min) and refresh token in **httpOnly cookies** (Bearer also accepted). Refresh sessions are stored in `Token` and listed as "Active sessions". CSRF guard, account lockout, email verification required before first sign-in, password reset by emailed token.
- **Therapists/staff:** an owner signs up (`/v1/auth/register` or `/v1/tenant/register`, optionally with an invite code). That creates the Tenant, then the User, then a Profile with role OWNER. Other staff join via `ConsultPendingInvite` → `POST /v1/auth/invite/claim`.
- **Clients:** create an account during booking (`client-signup`). Staff can also create a client with no login, and the client later uses a `client-set-password` token link. A client Profile belongs to one tenant, and the same User can hold profiles in several tenants.
- **Platform admins:** `User.platformRole` non-null, separate `POST /v1/admin/auth/login`. Their token carries `roles: [platformRole]`. `PlatformAdminGuard` re-checks the DB.
- **JWT payload:** `{ sub (userId), profileId, tenantId, type, sid }`, plus `roles` **only for platform admins**. **Practice roles are not in the JWT.** `jwt.strategy` defaults `roles` to `['client']`, and `RolesGuard` ignores that and reads `Profile.role` + `permissions` from the DB. Anyone adding a new check must not trust `req.user.roles`.

## 9. Known gaps, fragile spots, half-finished

1. **The trial is a UI promise with no backend behind it** (see §6). It needs a product decision before v2.
2. **Plan gating is scattered string comparisons.** There is no entitlements module. Different numbers already disagree: Starter is 20 bookings in code and 25 on the landing page.
3. **Single API process.** In-memory rate limiter, in-process cron, no queue, all on one VPS. Scaling out needs Redis and a job runner first.
4. **No Postgres RLS.** Tenant isolation rests on every service query including `tenantId`.
5. **Clinical-note key:** losing `FIELD_ENCRYPTION_KEY` means losing every note, with no recovery. Only the 4 SOAP fields are encrypted. Intake answers, assessment answers and session summaries are **plaintext**.
6. **Google Calendar push is fire-and-forget** (`.catch(() => undefined)` in 3 call sites). Failures are silent.
7. **Client reminders, editable email wording, and booking outcome states** (BKG-13) are not built.
8. **Repo hygiene:**
   - Stray untracked `apps/prisma/migrations/` duplicates `prisma/migrations/20261004090000_formats_and_locations`.
   - `fix_ts.mjs` and `fix_ts2.mjs` are deleted but the deletion isn't committed.
   - A screenshot sits untracked in `docs/`.
   - Local `node_modules` is broken, so tests won't run until `pnpm install`.
9. **Two "free" concepts collide:** Starter's comment says "Free", Paystack has a Starter plan code, and the UI says "trial".
10. **Strings instead of enums** for status, role, tier and format. A typo is not caught by the DB.

## 10. Where the docs disagree with the code

| Claim | Where | Reality |
|---|---|---|
| "Next.js 14 / Vite React", `apps/web/`, "REST API & **WebSockets** Gateway" | `docs/ARCHITECTURE.md` | Vite + React only, the app lives in `apps/app`, and there are **no WebSockets**. The doc also omits `landing` and `tenant-router` |
| Starter "Free / Transactional, 5% fee"; Pro **₦25,000**; Group Clinic **₦75,000**; Pro includes Google Calendar sync | `docs/PRD.md` §pricing | Code: Starter ₦5,000, Pro ₦15,000, Clinic ₦45,000. Calendar sync isn't gated by tier. The 5% Starter fee does match |
| "Up to **25** bookings per month" on Starter | Landing pricing | Code limit is **20** |
| "Start 14-day trial", "Everything unlocked for 14 days, no card" | Landing, signup, onboarding | No trial in the backend (§6) |
| "Run secure **Jitsi or Google Meet** sessions" | Landing features | No Google Meet. Default is **Daily.co**, then JaaS, then meet.jit.si |
| "By default, sessions link to Jitsi Meet on meet.jit.si" | `terms.astro` §8, `privacy.astro` §6 | meet.jit.si is the **last-resort** fallback; Daily.co is first choice. **The privacy policy's processor table needs Daily.co added** (legal accuracy) |
| "Auto-scored PHQ-9 and GAD-7" sold as a **Pro Solo** feature | Landing pricing | PHQ-9 and GAD-7 are on **Starter**. Pro adds PCL-5 and DASS-21 |
| "Do not claim DASS-21 is supported" | `docs/LAUNCH_FEATURE_MATRIX.md` | DASS-21 **is built** (Pro). The matrix is out of date |
| "Advanced clinic RBAC… do not claim" | `LAUNCH_FEATURE_MATRIX.md` | Permission grants per profile exist (`Profile.permissions`, `GRANTABLE`) |
| "Pro Solo: 1 receptionist login" | Landing | Code doesn't cap the number of receptionists/admins on Pro; it blocks only extra therapists |
| "Clinic plans include… analytics"; "practice-wide reporting" | Landing FAQ | The analytics page isn't tier-gated |
| "Clinical notes encrypted at rest" | Landing FAQ | True for SOAP narrative fields only (§9.5) |
| "Group Clinic: supervisor oversight, custom intake form builder" | PRD | No supervisor role or oversight feature. The form builder isn't Clinic-gated |
| "Built-in WebRTC video (Jitsi / Daily.co / Google Meet)" | PRD | Daily + JaaS + Jitsi link; no Google Meet |
