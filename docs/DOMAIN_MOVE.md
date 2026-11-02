# Domain move checklist (spec §4.1a, §4.1b)

Every production address in the code is a setting with today's address as its default (spec §4.1a table). This page lists what a move to new domains touches: the settings, the files that can't read a setting, and the outside services that hold one of our URLs. Nothing here has been changed yet. Fill in the new values at the move.

## 1. Settings

**API `.env`** (`apps/api/src/common/origins.ts`):
- `TENANT_ROOT_DOMAIN`: practice subdomains, CORS, the CSRF cookie domain and the `no-reply@` fallback all follow it.
- `MARKETING_URL`, `APP_URL`, `API_URL`, `PROFILE_PUBLIC_URL`.
- `MAIL_FROM`: the platform sender on the new sending domain.
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
