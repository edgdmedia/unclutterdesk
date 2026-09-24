# Cloudflare setup

Everything on the `unclutterdesk.com` zone: what is live, and what is left.

## Where things stand

Checked against public DNS on 2026-09-24.

| | Status |
| --- | --- |
| `unclutterdesk.com` (landing) | ✅ Live, proxied |
| `www.unclutterdesk.com` | ✅ Live, proxied |
| `app.unclutterdesk.com` | ✅ Live, proxied |
| `<practice>.unclutterdesk.com` | ✅ Live: wildcard record plus the tenant-router Worker (§1) |
| `api.unclutterdesk.com` | ✅ Proxied (2026-09-24). Remaining: real-IP nginx change and origin firewall (§2 steps 3 and 6) |
| GitHub deploy token | ❌ App and landing deploys fail with auth error 10000 (§3) |
| HSTS at the zone | ⬜ Not yet (§4) |
| CSP enforced | ⬜ Report-only for now (§4) |
| Practice custom domains | ⬜ Off until Cloudflare for SaaS is set up (§5) |

Do them in this order: §3 (unblocks deploys), §2 (protects the server), §4, then §5
once custom domains are being offered.

---

## §1. Practice subdomains — done

Every practice is served at `https://<slug>.unclutterdesk.com` by the Worker in
`apps/tenant-router/`, on the route `*.unclutterdesk.com/*`. It forwards each
request to the app's Pages project (`app-unclutterdesk.pages.dev`), 301s `www` to
the apex, and returns a real 404 for an address that belongs to no practice.
Background on why it is a Worker is in the appendix.

**One trap:** that route also matches `api.unclutterdesk.com`. It does no harm
while `api` is DNS-only, because Worker routes only run on proxied records. The
moment `api` is proxied, the Worker would answer every API call with a 404 — so
§2 step 1 adds an exclusion first.

---

## §2. Put the API behind Cloudflare — to do

Today `api.unclutterdesk.com` points straight at `169.58.3.186`. Proxying it hides
that address and puts Cloudflare's DDoS and bot protection in front of the API.
About 15 minutes; **do the steps in this order**. To undo at any point, set the
`api` record back to DNS only (grey cloud) — it takes effect within a minute.

1. **Exclude `api` from the Worker.** Workers & Pages → your zone's
   **Workers Routes** → Add route: `api.unclutterdesk.com/*`, Worker **None**.
   The more specific route wins over `*.unclutterdesk.com/*`.

2. **SSL/TLS mode: Full (strict).** SSL/TLS → Overview. The server already has a
   valid certificate (the app would not work otherwise), so strict connects.
   Never *Flexible*: it sends traffic to the server unencrypted.

3. **nginx: pass the visitor's real address.** Install
   `deploy/nginx/cloudflare-realip.conf` as `/etc/nginx/conf.d/cloudflare-realip.conf`,
   and in the API's server block change
   `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` to
   `proxy_set_header X-Forwarded-For $remote_addr;`. Then
   `sudo nginx -t && sudo systemctl reload nginx`.
   `deploy/nginx/api-unclutterdesk.com.conf` is the server's block with that
   change. Keep its `listen 169.58.3.186:443`: other sites on the server bind to
   specific addresses, and a bare `listen 443` would not be picked for `api`.

   Without this, once proxied, the API sees a Cloudflare address for every
   visitor and the login rate limiter treats them as a handful of people.
   Tested on nginx 1.24: forged `X-Forwarded-For` and `CF-Connecting-IP`
   headers from outside Cloudflare are ignored.

4. **Proxy the record.** DNS → `api` → Proxy status **Proxied** (orange cloud).

5. **Check:**
   - Sign in to the app (rate limiter and cookies).
   - Make one small real booking (the Paystack webhook reaches
     `/v1/billing/paystack-webhook`).
   - Watch the notification bell update without a refresh (the live stream is
     not buffered).
   - `curl -s https://api.unclutterdesk.com/health` returns JSON.

6. **After a day of it working, close the back door.** The old IP is still known,
   so anyone can bypass Cloudflare until the server only accepts Cloudflare:

   ```bash
   for r in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
     sudo ufw allow proto tcp from "$r" to any port 443
     sudo ufw allow proto tcp from "$r" to any port 80
   done
   sudo ufw delete allow 'Nginx Full' 2>/dev/null; sudo ufw delete allow 443 2>/dev/null; sudo ufw delete allow 80 2>/dev/null
   sudo ufw status numbered   # SSH must still be allowed before you log out
   ```

   If `sudo ufw status` says *inactive*, run `sudo ufw allow OpenSSH` first and
   `sudo ufw enable` after the rules above, or you lock yourself out of SSH.
   Not before step 5 passes: a mistake here locks everyone out.

**Keeping it current:** `deploy/nginx/update-cloudflare-ips.sh` refreshes the
nginx list from Cloudflare and only reloads if `nginx -t` passes. Run it monthly
from cron.

**Once proxied, worth adding:** WAF managed rules on `api`, an edge rate limit on
`/v1/auth/*`, and Bot Fight Mode with `/v1/billing/paystack-webhook` excluded so
Paystack is never challenged.

---

## §3. Deploy token — fix now

Since the Sep 24 merges, **Deploy App** and **Deploy Landing** fail at
`wrangler pages deploy` with `Authentication error [code: 10000]`. The workflows
have not changed since the last successful deploy (Sep 3); the token has.

1. Cloudflare → My Profile → **API Tokens**: the token used by GitHub needs
   - Account → **Cloudflare Pages → Edit** (app and landing)
   - Account → **Workers Scripts → Edit** (tenant router)

   Create a new one with both if in doubt.
2. GitHub → repo Settings → Secrets and variables → Actions:
   - `CLOUDFLARE_API_TOKEN` → the token above
   - `CLOUDFLARE_ACCOUNT_ID` → `c575ebebbd9ed1b0e97f00b9fe521702`
3. Re-run the failed **Deploy App** and **Deploy Landing** runs.

---

## §4. HSTS and CSP

**HSTS.** SSL/TLS → Edge Certificates → HSTS: 6 months, `includeSubDomains`
**off**. Turn `includeSubDomains` on only once every subdomain, including `api`,
serves HTTPS without problems; add `preload` last, as it is effectively permanent.
The two Pages sites already send HSTS from their `_headers` files.

**CSP.** `apps/app/public/_headers` and `apps/landing/public/_headers` send
`Content-Security-Policy-Report-Only`. Watch the browser console across a few real
bookings; when there are no violations, rename the header to
`Content-Security-Policy`. A wrong CSP breaks Paystack checkout silently, which is
why it is not enforced yet.

---

## §5. Practice custom domains — when offered

For practices on their own domain (`booking.drjane.com`). The app side is done;
what is missing is Cloudflare for SaaS.

1. Enable **Cloudflare for SaaS** on the zone.
2. **Fallback origin:** a proxied record, e.g. `fallback.unclutterdesk.com`, where
   custom-hostname traffic lands; add a Worker route for it to the tenant router.
3. **CNAME target** for practices to point at, e.g. `customers.unclutterdesk.com`.
4. Set `CUSTOM_DOMAIN_TARGET=customers.unclutterdesk.com` in the API's `.env` and
   restart. Until then the app tells practices custom domains are not available.
5. Per practice: add the custom hostname in Cloudflare; the practice adds a CNAME
   to the target and presses **Verify** in Brand settings. Verify checks the
   CNAME and that HTTPS works (certificate issued) before marking it `ACTIVE`;
   only then does the domain appear in links, emails and CORS.

Priced per custom hostname — check current rates before including it in a plan.

---

## Appendix: why practice subdomains use a Worker

Cloudflare Pages cannot serve a wildcard custom domain (`*.unclutterdesk.com`),
and registering each practice's subdomain on the Pages project caps the number of
practices (100 on Free, 250 Pro, 500 Business) and puts a Cloudflare API call in
signup. The app resolves the practice from the browser's hostname, so every
practice gets byte-identical files; a Worker that forwards any subdomain to the
one Pages project is therefore enough, with no limit on practices.

The Worker fails open: if its "does this practice exist" check (cached 300s for
yes, 30s for no) errors or times out, it serves the app rather than a 404, since a
wrong 404 takes a real practice offline. A deactivated practice is served, so
clients with bookings reach the "practice inactive" page. Behaviour is covered by
`apps/tenant-router/src/router.spec.ts`.

Moving `apps/app` from Pages to Workers static assets would remove the forwarding
hop; it is optional and does not need DNS changes.
