# Unclutter Desk — Live Launch Readiness Audit

**Date:** 2026-09-03 · **Branch audited:** `dev` (3 commits ahead of `main`) · **Verdict: LIVE AND PUBLIC, BUT NOT SAFE TO PROMOTE**

## Status of this audit

Findings 1, 2, 5, 6 and 10 have been **fixed on branch `dev`** (see the commit accompanying this report); everything else remains open. The fixes are not live until `dev` is merged to `main` and deployed.

## Is it released to the public?

Yes — all three surfaces are reachable on the open internet right now:

| Surface | Host | Status |
| --- | --- | --- |
| Landing | `https://unclutterdesk.com` | 200, Cloudflare |
| App | `https://app.unclutterdesk.com` | 200, Cloudflare Pages |
| API | `https://api.unclutterdesk.com` | 200 `{"status":"ok"}`, nginx/1.24.0 on `169.58.3.186` |
| Swagger | `https://api.unclutterdesk.com/docs` | 404 — correctly disabled in prod |
| `www.unclutterdesk.com` | — | **NXDOMAIN** |
| `<tenant>.unclutterdesk.com` | — | **NXDOMAIN (no wildcard)** |

Nothing gates access — no maintenance page, no beta flag, no Cloudflare Access. Anyone with the URL can sign up today.

---

## P0 — Blockers. Fix before any public promotion.

### 1. Stripe webhook accepts forged events (unauthenticated payment fraud) — FIXED on `dev`
`apps/api/src/modules/billing/stripe.controller.ts:39-53` — signature verification is commented out and replaced with `const event = payload;`.

Anyone can POST `{"type":"checkout.session.completed","data":{"object":{"metadata":{"bookingId":"<id>"}}}}` to the live endpoint and `stripe.service.ts:132` will flip that booking from `PENDING_PAYMENT` to `CONFIRMED` with `paidAt` set — free paid sessions, at scale, with no payment. `STRIPE_WEBHOOK_SECRET` is already in `.env`; it is simply unused.

**Fix:** enable `rawBody` on the Nest app, call `stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret)`, reject on failure. Paystack (`paystack.service.ts:108`) already does this correctly — mirror it.

### 2. CORS allow-list is bypassable, with credentials — FIXED on `dev`
`apps/api/src/main.ts:28-38`. Two of the four rules are wide open:
- `origin.endsWith('.pages.dev')` — every Cloudflare Pages site on the internet.
- `origin.includes('localhost')` — matches `https://localhost.attacker.example.com`.

Verified live against production:

```
https://attacker-controlled.pages.dev  -> 204  ACAO: <reflected>  allow-credentials: true
https://localhost.evil-example.com     -> 204  ACAO: <reflected>  allow-credentials: true
```

Cookies are `sameSite: 'none'` (`auth.config.ts:52`), so they ride along on cross-site requests. An attacker page opened by a logged-in therapist can read authenticated API responses — client records, SOAP notes, intake forms. For a mental-health product this is the most serious finding in the audit.

**Fix:** exact allow-list from `CORS_ORIGINS`, plus a strict `^https://[a-z0-9-]+\.unclutterdesk\.com$` regex, plus verified custom domains from the DB. Drop the `.pages.dev` and `localhost` substring rules; gate any dev origin behind `NODE_ENV !== 'production'`.

### 3. Tenant booking subdomains do not resolve — the public booking surface is offline
`docs/launch-checklist.md` §4 states public booking lives at `https://<tenant>.unclutterdesk.com/`. DNS says otherwise:

```
demo.unclutterdesk.com          NXDOMAIN
randomtest123.unclutterdesk.com NXDOMAIN
www.unclutterdesk.com           NXDOMAIN
```

No wildcard record, no Cloudflare for SaaS custom-hostname setup. Every therapist who signs up gets a booking link that 404s at DNS level. This is the product's core promise.

**Fix:** wildcard `*.unclutterdesk.com` CNAME to the app Pages project, and add `www`. Custom domains need Cloudflare for SaaS (see `docs/CUSTOM_DOMAIN_PLAN.md`, still open).

### 4. Production schema is managed by `prisma db push`, with no migrations and no backup
`deploy.sh:34` runs `npx prisma db push` on **every** API deploy. `prisma/` has no `migrations/` directory. `db push` resolves drift by dropping columns/tables without a prompt in non-interactive mode. There is no `pg_dump` step anywhere in the deploy path.

Once real clinical notes exist, one renamed field ships as silent data loss with no restore point.

**Fix (in order):** take a verified backup → `prisma migrate diff` to baseline the live DB → `prisma migrate resolve --applied` → switch `deploy.sh` to `prisma migrate deploy` → add an automated nightly Postgres backup with a tested restore.

### 5. The entire API is rate-limited to 10 requests/minute — shared by every user on earth

**Corrects an earlier finding in this report, which stated auth endpoints had no rate limit. The reality is the inverse, and worse.**

Two compounding defects in `app.module.ts:21-33` and `main.ts`:

- `ThrottlerGuard` enforces **every** named throttler on **every** route — it ANDs the results (`@nestjs/throttler@6.5.0`, `throttler.guard.js:67`, `return continues.every(...)`). Defining a `strict` 10/min tier alongside `default` did not restrict it to sensitive routes; it capped the whole API at 10/min.
- `trust proxy` was never set, so behind nginx `req.ip` is the proxy's own socket address for every request. The limiter therefore buckets *all traffic from all users* into one counter.

Verified live against production — eleven unauthenticated requests from a single machine:

```
401,401,401,401,401,401,401,401,401,401,429
{"statusCode":429,"message":"ThrottlerException: Too Many Requests"}
```

Ten requests exhausted the quota for **every therapist and client on the platform** for the next 60 seconds. A single dashboard load fans out to more than ten calls. This is very likely the root cause behind the `[auth/status]` and `[root-redirect]` debug commits currently sitting on `dev`.

**Fixed in this branch:** collapsed to a single 200/min `default` tier, set `trust proxy`, and moved strict limits onto the auth routes individually via `@Throttle`.

---

---

## P1 — High. Fix in the first week.

5. *(Corrected — see P0.5 above. The original finding said auth had no rate limit; the truth is the whole API is limited to 10 req/min shared across all users.)*

6. **Zero security headers.** *(API side fixed on `dev` via helmet; the two Pages projects still need `_headers`.)* No `helmet` in `main.ts`. Live checks return `null` for HSTS, CSP, X-Frame-Options and X-Content-Type-Options on the API, and no HSTS/CSP on the app or landing. Add helmet to the API; add a `_headers` file to both Pages projects; enable Strict Transport Security in Cloudflare.

7. **API origin is not behind Cloudflare.** `api.unclutterdesk.com` resolves straight to `169.58.3.186` with `server: nginx/1.24.0 (Ubuntu)` — no WAF, no DDoS protection, no bot rules, and the origin IP is published. Proxy it (orange-cloud) and firewall the origin to Cloudflare ranges only.

8. **Rejected CORS origins return HTTP 500.** The rejection callback throws an unhandled `Error` rather than returning `callback(null, false)`. Noisy, and it surfaces as a server error.

9. **No error monitoring or structured logging.** No Sentry, no pino/winston, only ad-hoc `Logger` calls. Production failures will be discovered by therapists, not by you. `apps/api/src/modules/auth/auth.service.ts:24` also defines an `authDebug` helper that JSON-dumps auth detail into logs — audit what it receives before it is used.

10. **No CI quality gate.** *(Fixed on `dev`: a `verify` job now runs recursive typecheck plus API and app tests, and all three deploy jobs `needs: verify`.)* All three workflows deploy on push to `main` with no typecheck, no lint and no tests. `pnpm typecheck` and vitest both exist and are never run. Add them as required steps before the deploy job.

11. **Test coverage is five files** *(17 CORS regression tests added on `dev`; 28 API tests now pass)* for the entire product (`tenant.service.spec.ts`, `intake.service.spec.ts`, `apiClient.test.ts`, one autosave test). Nothing covers authentication, cross-tenant isolation, billing, or bookings — the four areas where a bug is a breach.

12. **PM2 runs a single fork-mode process** (`ecosystem.config.js`) with no health check. One unhandled rejection takes the whole API down until someone notices. Add `instances: 2` / cluster mode, `max_restarts`, and an uptime monitor on `GET /`.

---

## P2 — Launch hygiene.

13. **No Privacy Policy, Terms of Service, or DPA.** `apps/landing/src/pages/` contains only `index.astro`; `/privacy` and `/terms` return the landing page with a 200. Handling client mental-health data without a published privacy policy is a legal exposure in every jurisdiction you operate in, and both Stripe and Paystack require live policy URLs for account review.

14. **Soft 404s everywhere.** Every unknown path on both the landing site and the app returns 200 with HTML. Broken links stay invisible and Google indexes garbage. Return a real 404.

15. **No sitemap.** `/sitemap.xml` and `/sitemap-index.xml` return the landing page HTML with 200. Add `@astrojs/sitemap` and reference it from `robots.txt`.

16. **Debug commits sit on `dev`, unmerged.** `effb5ae` adds `console.log('[auth/status] success', p)` — the full user profile printed to the browser console in production — and `bab1e58` adds seven `[root-redirect]` logs. Strip both before merging to `main`.

17. **Secrets live in a working-tree `.env`.** Not tracked by git (verified), but `apps/api/.env` and the root `.env` hold live Stripe, Paystack, Google OAuth, JWT and SMTP credentials on a laptop, and `deploy.sh:11` copies one to the other on the server. Rotate anything that has been on a developer machine and move production secrets to the host's secret store.

18. **Confirm the seeded demo account is absent from production.** `docs/launch-checklist.md` §6 documents `dr.jane@smiththerapy.ng / password123` as a pre-verified login. CI sets `SEED_DB=false`, which is correct, but the seed may have been run manually during setup. Verify directly against the production DB and delete if present. *(Not verifiable from here — live credential testing was out of scope for this audit.)*

19. **Tighten the CSRF guard.** `csrf.guard.ts` exempts any path *containing* `/auth/`, `/login`, `/invite`, etc. as a substring, and returns `true` when no session cookie is present. Combined with `sameSite: 'none'`, the CSRF token is the only cross-site defence. Switch to exact route matching.

---

## Things that are already right

- Swagger disabled in production; seeding disabled in CI.
- Tenant scoping derives from the JWT (`authenticated-tenant.ts`), not from client-supplied headers, and services filter on `tenantId` (`notes.service.ts`, `billing.service.ts`).
- Controller-level `@UseGuards(JwtAuthGuard)` on every PHI-bearing controller; `PlatformAdminGuard` correctly extends it with a type check.
- Paystack webhook signature verification is implemented correctly.
- Access/refresh cookies are `httpOnly` and `secure` in production; no secrets tracked in git.
- Deploys are path-filtered with concurrency groups — a good foundation once a test gate is added.

## Recommended sequence

1. Stripe webhook signature (#1) — hours.
2. CORS allow-list (#2) — hours.
3. Auth rate limits (#5) + helmet (#6) — hours.
4. Database backup, then migration baseline (#4) — half a day.
5. Wildcard DNS + `www` (#3) — hours, plus propagation.
6. Privacy/Terms pages (#13) — blocks payment-processor review.
7. CI typecheck/test gate (#10), Cloudflare-proxy the API (#7), Sentry (#9).

Items 1-5 are the difference between "deployed" and "safe to hand to a therapist with real client data."
