# Domain move checklist (spec §4.1a, §4.1b)

Every production address in the code is a setting with today's address as its default (spec §4.1a table). This page lists what a move to new domains touches: the settings, the files that can't read a setting, and the outside services that hold one of our URLs. Nothing here has been changed yet. Fill in the new values at the move.

## 0. The new domains live in a different Cloudflare account

`therapysts.com` and `therapysts.app` are zones in a different Cloudflare account from `unclutterdesk.com`. The R2 buckets are created there from the start (spec §4.4), so the public bucket's custom domain sits on a new-account zone and no files ever need copying between accounts. Everything else still in the current account moves at the switch, and each piece is recreated rather than transferred:

- **Tenant router Worker:** deploy it to the new account (`wrangler login` as the new account, then deploy). Set `ROUTER_PROXY_SECRET` there with `wrangler secret put`, using the same value as the API.
- **Pages projects** for the app and the landing site: create them in the new account and add the new custom domains. Update the GitHub secrets the deploy workflows use (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, the Pages project names).
- **Cloudflare for SaaS** on the `.app` zone: enable it, create the fallback origin and the CNAME target, then set the API's `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_AUTH_EMAIL`, `CLOUDFLARE_API_KEY` and `CUSTOM_DOMAIN_TARGET` to the new account's values. Each Pro custom domain is created again by the API when its practice re-saves it. Tell those practices to re-point their CNAME before the switch.
- **Worker routes** are recreated by the API's custom-domain cron from `TENANT_ROOT_DOMAIN` once the API points at the new zone (`CLOUDFLARE_SETUP.md`). Delete the old account's routes by hand afterwards.

## 1. Settings

**API `.env`** (`apps/api/src/common/origins.ts`):
- `TENANT_ROOT_DOMAIN`: practice subdomains, CORS, the CSRF cookie domain and the `no-reply@` fallback all follow it.
- `MARKETING_URL`, `APP_URL`, `API_URL`, `PROFILE_PUBLIC_URL`.
- `MAIL_FROM`: the platform sender on the new sending domain.
- `R2_*`: already on the new account (section 0); nothing to change at the switch.
- `CUSTOM_DOMAIN_TARGET`: the new CNAME target. Remove `CLOUDFLARE_SAAS_CNAME_TARGET` once this is set.
- `COOKIE_DOMAIN`: leave unset unless the cookie must differ from `.<TENANT_ROOT_DOMAIN>`.
- `GOOGLE_REDIRECT_URI`, if set (otherwise it follows `API_URL`).

**App build** (GitHub secrets used by `deploy-app.yml`): `VITE_API_URL`, `VITE_APP_URL`, `VITE_MARKETING_URL`, `VITE_TENANT_ROOT_DOMAIN`.

**Landing build** (`deploy-landing.yml` env): `PUBLIC_MARKETING_URL`, `PUBLIC_APP_URL`, `PUBLIC_TENANT_ROOT_DOMAIN`, `PUBLIC_CUSTOM_DOMAIN_TARGET`, `PUBLIC_CONTACT_EMAIL_DOMAIN`.

## 2. Files edited by hand

These can't read a setting. Each is a listed exception in `apps/api/src/domain-literals.spec.ts`.
- `apps/tenant-router/wrangler.jsonc`: `APEX_HOST`, `API_BASE`, `MARKETING_URL`. The Worker routes aren't in this file: the API's custom-domain cron creates `*.<TENANT_ROOT_DOMAIN>/*` from the setting, in the zone named by `CLOUDFLARE_ZONE_ID`, so set that to the new zone. Delete the old zone's routes by hand afterwards. The apex rule changes too (§4.1b: the bare `.app` domain is the app).
- `apps/app/public/_headers`: the CSP `connect-src` API host.
- `deploy/nginx/api-unclutterdesk.com.conf`: `server_name` and the certificate paths, plus a new certificate.
- The defaults in the three config modules (`apps/api/src/common/origins.ts`, `apps/app/src/config/domains.ts`, `apps/landing/src/config/domains.ts`) and `apps/landing/astro.config.mjs`, once the new domains are the only ones. Then update any test that asserts an old address.
- Not changed: `ICAL_UID_DOMAIN` stays `unclutterdesk.com` for good, so subscribed calendars don't duplicate bookings.

## 3. Outside services that hold our URLs

| Service | What to change | Where |
|---|---|---|
| Paystack | Webhook URL `<API>/v1/billing/paystack-webhook` | Paystack dashboard. Payment callbacks are built per request from the settings. |
| Google OAuth | Authorised redirect URI `<API>/v1/calendar/google/callback`; authorised domains | Google Cloud console |
| Daily.co | Webhook `<API>/v1/video/webhooks/daily` | Re-run `scripts/create-daily-webhook.mjs` with the new `API_URL` |
| Resend | Sending domain (DNS records) and webhook `<API>/v1/webhooks/resend` | Resend dashboard |
| Cloudflare for SaaS | Fallback origin and the CNAME target. Existing Pro custom domains must re-point their CNAME. | Cloudflare dashboard; tell Pro practices before the switch |
| Cloudflare Pages | Custom domains for the app and landing projects | Cloudflare dashboard |
| Old domains | 301 redirects to the new addresses (profiles: §4.1) | Cloudflare redirect rules |
