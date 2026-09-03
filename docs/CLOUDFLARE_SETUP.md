# Cloudflare Setup — what needs doing before launch

Everything here is dashboard/DNS work on the `unclutterdesk.com` zone. Ordered by
risk. Item 1 is a launch blocker with an architectural catch.

Current state, measured 2026-09-03:

| Host | Resolves to | Proxied? |
| --- | --- | --- |
| `unclutterdesk.com` | 172.67.177.241 / 104.21.67.156 | Yes (Cloudflare) |
| `app.unclutterdesk.com` | same | Yes (Cloudflare) |
| `api.unclutterdesk.com` | 169.58.3.186 | **No — DNS only** |
| `www.unclutterdesk.com` | NXDOMAIN | — |
| `*.unclutterdesk.com` | NXDOMAIN | — |

---

## 1. Tenant booking subdomains — Pages cannot do this with a wildcard

The launch plan serves every practice at `https://<tenant>.unclutterdesk.com`.
Adding a wildcard DNS record alone will **not** work, and neither will adding
`*.unclutterdesk.com` as a Pages custom domain. From Cloudflare's own Pages
known-issues page:

> It is currently not possible to add a custom domain with a wildcard, for
> example, `*.domain.com`.

Pages routes requests by matching the `Host` header against domains explicitly
registered on the project. A proxied wildcard CNAME pointing at the project
returns a Pages "not found" for any host that is not registered.

The one piece of good news: `apps/app/src/utils/apiClient.ts` resolves the tenant
client-side from `window.location.hostname`, so **every tenant host serves
byte-identical assets**. There is no per-tenant build. Any mechanism that returns
the same bundle for an arbitrary `Host` is correct.

### Option A — register each subdomain as a Pages custom domain at signup

Call the Pages API when a practice is created, adding `<slug>.unclutterdesk.com`
to the project.

- Works with the current architecture; no new moving parts at request time.
- **Hard ceiling on tenants:** 100 custom domains per project on Free, 250 on
  Pro, 500 on Business. This caps how many practices can exist.
- Puts a third-party API call and certificate issuance (seconds to minutes) into
  the signup path, with a new failure mode to handle and retry.

Reasonable only as a stopgap, and only if you are confident about the ceiling.

### Option B — put a Worker in front (recommended, and now built)

Implemented in `apps/tenant-router/`. It sits on `*.unclutterdesk.com/*`, rewrites
the request onto the app's Pages origin, and streams the response back. No
per-tenant registration, no ceiling on tenant count.

Behaviour (see `src/router.ts`, 13 tests in `src/router.spec.ts`):

| Host | Result |
| --- | --- |
| `dr-smith.unclutterdesk.com` | serves the app bundle |
| `app.unclutterdesk.com` | serves the app bundle — identical assets, so this is correct |
| `booking.drjane.com` (custom domain via Cloudflare for SaaS) | serves the app bundle |
| `www.unclutterdesk.com` | 301 to the apex |
| `api.unclutterdesk.com` | **404, deliberately** — see step 4 |
| `a.b.unclutterdesk.com` | 404 |

The Worker does not check whether the slug is a real tenant. That would cost a
lookup on every request; instead an unknown slug loads the SPA, which asks the
API and gets a 404 back. Same outcome, no added latency.

#### Deploying it

1. **Check `ORIGIN_HOST`.** `wrangler.jsonc` assumes the app project is
   `unclutterdesk-app.pages.dev`. Confirm against the actual project name (the
   `CLOUDFLARE_PAGES_APP_PROJECT` secret used by `deploy-app.yml`) and correct it
   if it differs — everything else depends on this being right.

2. **Deploy.** `.github/workflows/deploy-tenant-router.yml` deploys on pushes to
   `main` touching `apps/tenant-router/**`, using the existing
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets. The token needs
   the *Workers Scripts: Edit* permission — the current token may only have Pages
   permissions, so check before the first run. To deploy by hand:

   ```bash
   pnpm --filter @unclutterdesk/tenant-router deploy
   ```

3. **Add the wildcard DNS record.** A Worker route only fires on a proxied
   record, so this must exist and be orange-clouded:

   | Type | Name | Target | Proxy |
   | --- | --- | --- | --- |
   | CNAME | `*` | `unclutterdesk-app.pages.dev` | **Proxied** |

   The Worker answers before the origin is consulted, so the target is mostly a
   formality — an originless `AAAA * 100::` works equally well.

4. **Exclude the API host — do this at the same time as proxying the API**
   (item 2 below). While `api.unclutterdesk.com` stays DNS-only, Worker routes
   do not apply to it and nothing is needed. The moment it is proxied, the
   wildcard route would capture it, so add a more specific route
   `api.unclutterdesk.com/*` with **Worker = None**; more specific routes win.
   Until that exclusion exists the Worker returns a 404 for `api` rather than
   serving the SPA, so a missed step fails loudly instead of corrupting API
   traffic.

5. **Add the explicit `www` record**, or `www` falls into the wildcard. The
   Worker 301s `www` to the apex either way, but an explicit record is clearer.

6. **Verify** — all three should serve the app, and `api` should still be JSON:

   ```bash
   curl -sI https://demo.unclutterdesk.com | head -1
   curl -sI https://app.unclutterdesk.com | head -1
   curl -s  https://api.unclutterdesk.com | head -c 80
   ```

#### If you would rather not run a proxy Worker

Migrating `apps/app` from Pages to **Workers static assets** gets wildcard routes
natively, with the Worker serving assets directly instead of proxying. It is the
direction Cloudflare is steering static hosting and removes the Pages custom-domain
limit permanently. It is a larger change — new build output config and a rewritten
deploy workflow — so the proxy Worker above ships first and can be swapped later
without touching DNS.

### Also: `www`

`www.unclutterdesk.com` is NXDOMAIN today — anyone typing `www` gets nothing.
Add `www` to the **landing** Pages project as a custom domain, or create a
redirect rule sending `www.unclutterdesk.com/*` → `https://unclutterdesk.com/$1`
with a 301.

Note the interaction: once the wildcard from Option B exists, `www` matches it
and would otherwise land on the app. Add the explicit `www` record — a specific
record always wins over the wildcard.

---

## 2. Put the API behind Cloudflare

`api.unclutterdesk.com` currently resolves straight to the origin at
`169.58.3.186`, advertising `nginx/1.24.0 (Ubuntu)`. There is no WAF, no DDoS
protection, no bot filtering, and the origin IP is published in public DNS.

**Sequence matters — doing these out of order takes the API down.**

1. Get a valid certificate onto the origin first: either Let's Encrypt via
   certbot, or a Cloudflare **Origin Certificate** installed in nginx.
2. Set SSL/TLS encryption mode to **Full (strict)**. Anything less (Flexible in
   particular) either breaks or silently downgrades origin traffic to plaintext.
3. Only then switch the `api` record to **Proxied** (orange cloud).
4. Configure nginx to recover the real client IP, or the rate limiter added in
   `apps/api/src/main.ts` (`trust proxy`) will bucket all traffic together
   again — the exact bug that limited the whole platform to 10 requests/minute:

   ```nginx
   # Trust Cloudflare and use CF-Connecting-IP as the client address.
   # Keep the IP list current: https://www.cloudflare.com/ips/
   real_ip_header CF-Connecting-IP;
   set_real_ip_from 173.245.48.0/20;
   # ... remaining Cloudflare ranges ...

   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header Host $host;
   ```

5. Firewall the origin so it only accepts 80/443 from Cloudflare ranges. The IP
   is already public, so proxying without this just leaves the bypass open.

### Two things to verify after proxying

- **Webhooks.** Stripe and Paystack must still reach `/v1/stripe/webhook` and
  `/v1/billing/paystack-webhook`. They will, but confirm with a test event —
  especially since Stripe signature verification now fails closed.
- **SSE.** `notification.controller.ts` exposes `GET /v1/notifications/stream`.
  Cloudflare proxies Server-Sent Events, but confirm the stream is not buffered;
  if it is, disable Cloudflare buffering for that path.

---

## 3. HSTS

Not currently sent by any host. Enable at **SSL/TLS → Edge Certificates → HSTS**.

Start at **6 months** with `includeSubDomains` **off**. Only turn
`includeSubDomains` on once every subdomain — including tenant subdomains and the
API — serves HTTPS correctly, because it makes any non-HTTPS subdomain
unreachable. Move to 12 months and `preload` after that has been stable; preload
is effectively irreversible on the timescale of browser releases.

The `_headers` files in this repo also set HSTS at the Pages level, which covers
the two static sites regardless of the zone setting.

---

## 4. Security headers on the Pages projects

Already committed — `apps/app/public/_headers` and
`apps/landing/public/_headers`. They ship on the next deploy; no dashboard work.

They set `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, HSTS, and cache rules for hashed assets and the service
worker.

**CSP is deliberately `Content-Security-Policy-Report-Only` for now.** A wrong
CSP breaks Paystack and Stripe checkout silently. Deploy, watch the browser
console across a few real bookings, then rename the header to
`Content-Security-Policy` to enforce it.

---

## 5. Cloudflare for SaaS — tenant custom domains

For practices on their own domain (`booking.drjane.com`). The schema is already
shaped for it: `Tenant.customDomain` and `Tenant.customDomainStatus`
(`PENDING` / `ACTIVE` / `FAILED`), and the CORS allow-list added in
`apps/api/src/common/cors.ts` only trusts an origin once its status is `ACTIVE` —
so this flow is what promotes a domain to trusted.

1. Enable Cloudflare for SaaS on the zone.
2. Create a **fallback origin** — a proxied record where custom-hostname traffic
   lands. If you take Option B above, point it at that Worker.
3. Create a **CNAME target** for customers to point at, e.g.
   `customers.unclutterdesk.com`.
4. Per tenant: create a custom hostname via API, have the practice add a CNAME
   from their domain to your CNAME target, then flip `customDomainStatus` to
   `ACTIVE` once Cloudflare reports the certificate as issued.

Limits are generous — 50,000 custom hostnames on pay-as-you-go — so this scales
past Option A's ceiling. Pricing is per custom hostname; check current rates
before marketing custom domains as an included feature.

---

## 6. Once the API is proxied

Worth doing, but only meaningful after item 2:

- **WAF managed rules** on `api.unclutterdesk.com`.
- **Edge rate limiting** on `/v1/auth/*`, as defence in depth alongside the
  application throttler. Edge limiting rejects before traffic reaches the origin.
- **Bot Fight Mode** — but exclude the webhook paths, or Stripe and Paystack
  callbacks may be challenged.

---

## Suggested order

1. `www` record — minutes, no risk.
2. Origin certificate → Full (strict) → proxy the API → nginx real IP → origin
   firewall (item 2). Highest security payoff.
3. Tenant subdomains (item 1) — the Worker is written and tested; this is the
   DNS record, the route exclusion, and a deploy. The actual launch blocker.
4. HSTS at 6 months (item 3).
5. Cloudflare for SaaS (item 5), when custom domains are actually marketed.
6. WAF and edge rate limiting (item 6).

Items 1 and 2 are the ones that change whether the product works and whether the
origin is exposed. The rest is hardening.
