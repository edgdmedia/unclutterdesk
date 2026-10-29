# Claude ↔ Claude hand-off

A shared notebook between the two Claude sessions on this project:

- **Spec Claude** (Olalekan's local session) writes and owns `docs/unclutter-desk-v2-spec.md`. Any change to the spec is made there, by that session.
- **Build Claude** (the cloud session building v2) implements the spec and raises questions here instead of guessing.

How to use it:
- Newest entries at the top of **Open**. Each entry has an ID (`Q-<item>-<n>`), who asked, the question, the context, and the asker's recommendation.
- Answer **inline under the question** (`**Answer (Spec Claude, date):** ...`). If the answer changes the spec, update the spec too and name the section changed.
- When answered, move the entry to **Answered** (keep it; it's the record).
- Olalekan has the final say on anything marked DECISION in the spec.

---

## Open

### Phase 1, item 1: custom-domain `/api` proxy (§6.16 "Client sign-in on custom domains")

**Asked by:** Build Claude, 29 Oct 2026
**Status:** Check-before-building done; no code written. Waiting on Q-1-1 to Q-1-5.

**What the code already does (matches the spec):**
- Custom-domain traffic passes through `tenant-router`: each custom domain gets a Worker route (`apps/api/src/modules/tenant/cloudflare-saas.service.ts`). The router serves non-zone hosts as practice hosts and checks `GET /v1/tenant/public/exists/:host`, which only matches a custom domain that is `ACTIVE`.
- API CORS already admits only `ACTIVE` custom domains of active practices (`apps/api/src/common/cors.ts`).
- The API already resolves a practice from a custom domain via `X-Tenant-Slug`, `ACTIVE` only (`common/middleware/tenant.middleware.ts`).
- CSRF is double-submit (`X-CSRF-Token` header vs the `unclutter_csrf` cookie, `modules/auth/csrf.guard.ts`). Its exempt list is keyed on `/v1/...` paths, so it works through the proxy as long as the router strips the `/api` prefix.
- The app works out its practice from `window.location.hostname` (`apps/app/src/utils/apiClient.ts`), so it can pick the API base the same way.

**Where the code differs from what the spec assumes:**
1. The refresh cookie is path-scoped: `unclutter_refresh` is set with `Path=/v1/auth/refresh` (`modules/auth/auth.controller.ts`). Through the proxy the browser calls `/api/v1/auth/refresh`, so it would never send the cookie, and clients would be signed out when the 15-minute access cookie expires. Stripping `Domain` alone isn't enough.
2. "A header the browser can't set" isn't true on its own: a browser can call `api.unclutterdesk.com` directly and set any header. The API can only trust the router's practice header if the router proves it sent it.
3. Rate limits: nginx takes the client IP from `CF-Connecting-IP` (`deploy/nginx/cloudflare-realip.conf`). On a Worker's subrequest to the API that header very likely holds the Worker's address, not the visitor's. Login is limited to 5 tries a minute per IP, so every client on every custom domain could share one bucket and lock each other out.
4. Why it fails today (consistent with the Edge report): besides third-party cookies, the app keeps the CSRF token in memory from the login response and otherwise reads it from a cookie set for `.unclutterdesk.com`, which a custom-domain page can never read. Any write after a page reload fails. The proxy fixes both.

**Planned build (one PR, branched from `dev`, rebased onto `main` after #54 merges):**
- **Router:**
  - On custom-domain hosts only, forward `/api/*` to the API with the prefix stripped. Use an explicit allow-list built from the client routes pinned in `apps/api/src/client-surface.spec.ts`, plus the public booking, availability, pay-link, intake/assessment-by-token, video-join and client auth routes. Everything else (admin, platform, dashboard) gets a 404.
  - Strip any incoming practice / client-IP headers and set the router's own.
  - On responses, strip `Domain` from every `Set-Cookie` and rewrite `Path=/v1/` to `Path=/api/v1/`.
- **API:** trust the router's practice header (and client IP) only when the shared secret matches (timing-safe). On those requests the practice comes from that header, still `ACTIVE` only, and the rate limiter uses the forwarded IP.
- **App:** `apiClient` uses `https://{host}/api` on custom domains, `API_ORIGIN` elsewhere.
- **Tests:**
  - Router unit tests: allow-list, refusals, header stripping, cookie rewriting.
  - API tests: secret check, practice header, CSRF through the proxy.
  - End-to-end in Playwright (Chromium is the only browser available in the build environment): local Postgres + API + built app + router via `wrangler dev`, with a fake custom domain mapped to localhost, covering sign-in, booking and CSRF.

#### Q-1-1: Router secret
May the router and API share a new secret setting (`ROUTER_PROXY_SECRET`), so the API trusts the router-set practice header only when it arrives with the secret?
**Recommendation:** Yes. Without it, the "router-only" header can be forged by calling the API directly. Olalekan sets the same value in the Worker and the API env at deploy.

#### Q-1-2: Refresh cookie path rewrite
The spec says to strip `Domain` from proxied `Set-Cookie`. May the router also rewrite `Path=/v1/...` to `Path=/api/v1/...`?
**Recommendation:** Yes. Otherwise the refresh cookie is never sent through the proxy and clients are signed out after 15 minutes. (The alternative, changing the refresh cookie's path to `/` everywhere, widens where that cookie is sent; I'd rather not.)

#### Q-1-3: Client IP for rate limiting
Should the router pass the visitor's real IP to the API behind the same secret, with the rate limiter using it for proxied requests?
**Recommendation:** Yes. Otherwise all custom-domain clients may share one login rate-limit bucket (5/minute).

#### Q-1-4: `/api` on practice subdomains
The spec says to reserve `/api` on practice hosts. On `{slug}.unclutterdesk.com`, should `/api/*` return 404, with the proxy enabled on custom domains only?
**Recommendation:** Yes. Subdomains already work against `api.unclutterdesk.com`; proxying there too adds surface for no gain.

#### Q-1-5: Where the end-to-end test runs
Should the end-to-end test (sign-in + booking + CSRF through the proxy) run in CI, which needs a new workflow job with a Postgres service, or as a documented local script for now?
**Recommendation:** A documented local script now, with the CI job as a follow-up. Either way, the acceptance check in Safari (macOS and iOS), Edge and Chrome on `consult.unclutter.com.ng` after deploy has to be Olalekan's: those browsers aren't available in the build environment.

---

## Answered

_(none yet)_
