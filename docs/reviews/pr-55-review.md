# Review: PR #55, custom-domain `/api` proxy

**Reviewer:** Spec Claude, 2 Nov 2026
**Branch:** `phase1/custom-domain-api-proxy` (head `52c1b16`)
**Implementer:** opencode. Make the fixes on this branch, one commit per item or group, and push. Spec Claude re-reviews.

## Verdict

**Changes requested.** The design matches §6.16 and the Q-1-1 to Q-1-5 answers. Five issues must be fixed before merge. Four more are should-fix in this PR.

Q-1 answers checked and met:
- Q-1-1: `ROUTER_PROXY_SECRET` is compared timing-safe, and it's in `apps/api/.env.example`, `apps/tenant-router/.dev.vars.example`, `CLOUDFLARE_SETUP.md` and `VPS_PREPARATION.md`.
- Q-1-2: `Path=/v1/` is rewritten to `/api/v1/`, and the logout clearing cookie is covered (`api-proxy.spec.ts:123`).
- Q-1-3: a test gives two forwarded IPs separate buckets, and an IP sent with a wrong secret is ignored (`throttling.spec.ts:58,64`).
- Q-1-4: `/api` is a 404 on hosts that aren't custom domains.
- Q-1-5: the end-to-end test runs in CI, but see M5.

## Must fix

**M1. Origin request keeps the incoming port.** `apps/tenant-router/src/router.ts:89`
`url.host = config.originHost` replaced `url.hostname = …; url.port = ''`. Setting `host` without a port keeps the old one, so `https://dr-smith.unclutterdesk.com:8443/book` goes to `https://app-unclutterdesk.pages.dev:8443/book` and fails. Cloudflare proxies 8443, 2053 and other ports.
Fix: if `originHost` includes a port (the e2e setup needs that), use it. Otherwise clear the port. Add a test for both cases.

**M2. A failed API fetch escapes the Worker.** `apps/tenant-router/src/index.ts:116`
`await fetch(apiRequest(...))` has no try/catch and no timeout. If the API is down, the client gets Cloudflare's HTML error page instead of JSON, and a hung API holds requests open with no limit.
Fix: wrap it, add a timeout (`AbortSignal.timeout`, about 25 s), and return a JSON 502 (or 504 on timeout) in the same shape as `apiNotFound()`. Add a test.

**M3. Public routes aren't checked against the allow-list.** `apps/api/src/router-proxy/client-api-routes.spec.ts:55`
The coverage test only checks `reachableBy('CLIENT')`, which keeps authenticated routes. A new public booking or availability endpoint would pass CI and return 404 on every custom domain.
Fix: also check every public (unauthenticated) route that the booking pages call. Do it by enumerating the public controllers, or with a pinned list that fails when a new public route under the client-facing modules isn't classified as either allowed or deliberately excluded.

**M4. A trailing-dot host makes the two practice checks disagree.** `apps/tenant-router/src/router.ts:18`
`chente.com.` is classed as a custom domain, and the exists probe strips the dot and finds the practice. But `practiceHost: 'chente.com.'` is then forwarded, and `TenantMiddleware`'s exact match finds nothing. Because the request is router-proxied, the `X-Tenant-Slug` fallback is skipped and the request runs with no practice.
Fix: normalise the host once at the Worker's entry (lowercase, strip one trailing dot) and use that value everywhere. Add a test.

**M5. The e2e workflow never runs on `dev`.** `.github/workflows/e2e-custom-domain.yml:23`
It triggers only on push to `main` and on PRs into `main`. On push to `main` it also races the deploy workflows, so it can't stop a bad deploy. This PR targets `dev`.
Fix: add `dev` to the `push` and `pull_request` branches.

## Should fix in this PR

**S1. The access cookie is host-wide on the custom domain.** `apps/tenant-router/src/api-proxy.ts:103`
`Path=/` is left alone, so the httpOnly access JWT goes with every page and asset request, and the Worker forwards it to the Pages origin. Only the CSRF cookie needs `Path=/` (the page reads it with `document.cookie`).
Fix: on proxied responses, scope httpOnly auth cookies (`unclutter_access`) that have `Path=/` to `Path=/api`. Leave the CSRF cookie as it is. Also strip the `Cookie` header from requests to the Pages origin on custom domains, if nothing there needs it. Check this against the e2e test.

**S2. The Worker repeats the ACTIVE check before every API call.** `apps/tenant-router/src/index.ts:113`
`lookupTenant` runs in sequence before the real call on every `/api` request, but the API re-checks ACTIVE itself, as the comment there says. On a cache miss this adds up to 1.2 s to sign-in and booking.
Fix: drop the probe on `/api` and rely on the API's check. Today a proxied request with no ACTIVE practice runs with no practice (`TenantMiddleware` just calls `next()`), so `TenantMiddleware` must return a 404 for it. Test both. (The probe also fails open, so it was never a reliable gate.)

**S3. Header names and timing-safe compares are duplicated.** `apps/api/src/common/middleware/router-proxy.middleware.ts:26`
The `x-ud-*` header names are defined in both apps and kept in sync only by a comment, and `secretMatches` duplicates `tokensMatch` in `csrf.guard.ts`.
Fix: one timing-safe compare helper in the API. For the header names, use a cross-app test that pins the API's and the router's constants equal, the same way `client-api-routes.spec.ts` reads the router's JSON. `packages/shared` isn't a dependency of either app, and the API is built with `tsc`, so moving them there costs more than it saves.

**S4. A junk secret header writes a warning log.** `router-proxy.middleware.ts:60`
Any direct caller that sends `x-ud-router-secret` triggers a warning before throttling, so the logs can be flooded at no cost. The message also says "did not match" when the secret was right but the practice header was missing.
Fix: log a secret mismatch at debug level, or rate-limit the log, and give a missing or blank practice header its own message.

## Deferred to item 2

- `isPracticeCustomDomain` in `apps/app/src/utils/apiClient.ts:27` repeats the host classification already in `getAppType` and `getSubdomainTenantSlug`, and takes the root domain from a different source. Item 2 (configurable domains) rewrites this file's host handling into one shared classifier, so fix it there, not here.

## Done means

- All must-fix and should-fix items are addressed, or each has a reply on the PR saying why not.
- `pnpm test` passes for api, app and tenant-router, and the e2e job passes on the PR.
- Nothing is pushed to `main`.
