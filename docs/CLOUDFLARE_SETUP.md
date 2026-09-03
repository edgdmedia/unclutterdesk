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

### Option B — put a Worker in front (recommended)

1. Proxied wildcard DNS record: `CNAME  *  →  <app-project>.pages.dev`, **Proxied**.
   (Or an originless `AAAA * 100::` — the Worker answers before the origin is used.)
2. A Worker on route `*.unclutterdesk.com/*` that serves the app bundle.

Two ways to build the Worker:

- **Proxy to the existing Pages deployment** — roughly twenty lines: rewrite the
  request to `<app-project>.pages.dev` and stream the response back. Keeps the
  current Pages deploy pipeline exactly as it is.
- **Migrate the app to Workers static assets** — Workers support wildcard routes
  natively, so the Worker *is* the site. This is the direction Cloudflare is
  steering static hosting, and it removes the Pages custom-domain limit
  permanently.

Either way there is no tenant ceiling and one thing to configure.

**Option B also solves item 5.** Cloudflare for SaaS routes customer custom
hostnames (`booking.drjane.com`) to a *fallback origin*, and this Worker is a
natural fallback origin — so wildcard subdomains and customer domains end up on
one code path.

**Recommendation:** Option B. Decide between proxy-Worker and the Workers
static-assets migration based on appetite; the proxy-Worker ships faster and can
be swapped later.

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
3. Tenant subdomains, Option B (item 1). The actual launch blocker.
4. HSTS at 6 months (item 3).
5. Cloudflare for SaaS (item 5), when custom domains are actually marketed.
6. WAF and edge rate limiting (item 6).

Items 1 and 2 are the ones that change whether the product works and whether the
origin is exposed. The rest is hardening.
