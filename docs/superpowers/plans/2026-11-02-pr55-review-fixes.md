# PR #55 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every must-fix and should-fix finding in the PR #55 review, so the custom-domain `/api` proxy can merge into `dev`.

**Architecture:** The tenant router (a Cloudflare Worker, `apps/tenant-router`) serves the app bundle for every practice host. On practice custom domains it also forwards allow-listed `/api/*` client routes to the API (NestJS, `apps/api`), adding `x-ud-*` headers that the API trusts only when `ROUTER_PROXY_SECRET` matches. These fixes harden that path: the origin URL, host normalisation, upstream failures, cookie scope, allow-list coverage, the API's handling of proxied requests, and CI.

**Tech Stack:** TypeScript, Cloudflare Workers, NestJS + Express, Prisma, Vitest, pnpm workspaces, GitHub Actions, Playwright (e2e).

**Spec:** `docs/unclutter-desk-v2-spec.md` §6.16 "Client sign-in on custom domains". Review: `docs/reviews/pr-55-review.md` (finding IDs M1–M5, S1–S4 below refer to it). Q&A record: `docs/claude-handoff.md` (Answered, Q-1-1 to Q-1-5).

## Global Constraints

- Work on branch `phase1/custom-domain-api-proxy`. The PR targets `dev`. **Never push to `main`**: a push there deploys to production.
- Before starting: `git fetch && git checkout phase1/custom-domain-api-proxy && git pull --ff-only && pnpm install`.
- Tests use the real code paths; only the network is faked (Vitest `vi.stubGlobal('fetch', …)` as the existing specs already do). No skipped tests, no `it.only`.
- Match the surrounding style: explanatory doc comments on exported functions, the short why-comments the files already use, and no new dependencies.
- The router's `x-ud-*` header names and `/api` prefix don't change.
- Test commands: `pnpm --filter @unclutterdesk/tenant-router test`, `pnpm --filter @unclutterdesk/api test`, `pnpm --filter @unclutterdesk/app test`; typecheck with `pnpm typecheck`.
- One commit per task, with a message starting `PR #55 review:`. Push after each task.

## Review Focus

Inputs no current test covers, most likely to bite first. Each one has a test added in the task named.

1. A visitor on a non-default HTTPS port (`:8443`): the page should load, not fail at the origin (Task 1).
2. The API down, restarting or hanging: the client should get a JSON 502/504 within a bounded time, not Cloudflare's HTML error page (Task 3).
3. A host with a trailing dot (`chente.com.`): it should behave exactly like `chente.com` (Task 2).
4. A proxied request for a custom domain that isn't ACTIVE (or was just deactivated, within the cache window): it should get a 404 from the API and never run without a practice (Task 4).
5. A new public route that the booking pages call: CI should fail until it's classified (Task 6).

---

### Task 1: Origin request uses the origin's port, not the visitor's (M1)

**Files:**
- Modify: `apps/tenant-router/src/router.ts` (`originRequest`, around line 86)
- Test: `apps/tenant-router/src/router.spec.ts` (`describe('originRequest')`)

**Interfaces:**
- Produces: `originRequest(request: Request, config: RouterConfig): Request`, with the signature unchanged.

- [ ] **Step 1: Write the failing tests** in `describe('originRequest')`:

```ts
it('drops a non-default port the visitor used', () => {
  const url = new URL(originRequest(new Request('https://dr-smith.unclutterdesk.com:8443/book'), config).url);
  expect(url.host).toBe('app-unclutterdesk.pages.dev');
  expect(url.port).toBe('');
});

it('keeps a port given in originHost (the local e2e setup)', () => {
  const url = new URL(
    originRequest(new Request('https://chente.com:8443/book'), { ...config, originHost: 'localhost:5173', originProtocol: 'http:' }).url,
  );
  expect(url.host).toBe('localhost:5173');
});
```

- [ ] **Step 2: Run them:** `pnpm --filter @unclutterdesk/tenant-router test -- router.spec`. Expected: the first test FAILS (the port `8443` is kept).
- [ ] **Step 3: Implement.** After `url.host = config.originHost`, clear the port when `originHost` has no `:` (`url.port = ''`). Update the comment above it to say why.
- [ ] **Step 4: Run them again.** Expected: PASS, along with the rest of `router.spec`.
- [ ] **Step 5: Commit:** `PR #55 review: origin request drops the visitor's port (M1)`

### Task 2: One normalised host everywhere (M4)

**Files:**
- Modify: `apps/tenant-router/src/router.ts` (add `normalizeHost`)
- Modify: `apps/tenant-router/src/index.ts` (`fetch` entry and `proxyClientApi`)
- Modify: `apps/api/src/common/middleware/router-proxy.middleware.ts` (the `practiceHost` value)
- Test: `apps/tenant-router/src/router.spec.ts`, `apps/tenant-router/src/api-proxy.spec.ts` (`describe('the Worker on /api')`), `apps/api/src/common/middleware/router-proxy.middleware.spec.ts`

**Interfaces:**
- Produces: `export function normalizeHost(hostname: string): string` in `router.ts`. It lowercases the host and removes **one** trailing dot. `proxyClientApi(request, host: string, url, env)` takes the normalised host. Tasks 3 and 4 edit this same function.

- [ ] **Step 1: Write the failing tests:**
  - `router.spec.ts`: `expect(normalizeHost('Chente.COM.')).toBe('chente.com')`, `expect(normalizeHost('chente.com')).toBe('chente.com')`.
  - `api-proxy.spec.ts`: `it('treats chente.com. exactly like chente.com')`. Call `POST https://chente.com./api/v1/auth/refresh`, then expect status 200, `apiCalls()` equal to `[`${API}/v1/auth/refresh`]`, and the sent `PRACTICE_HOST_HEADER` equal to `'chente.com'`.
  - `router-proxy.middleware.spec.ts`: with `fromRouter({ [PRACTICE_HOST_HEADER]: 'Chente.com.' })`, expect `req.routerProxy?.practiceHost` to be `'chente.com'`.
- [ ] **Step 2: Run them.** Expected: FAIL (`normalizeHost` isn't defined, and the header is `'chente.com.'`).
- [ ] **Step 3: Implement.**
  - Add `normalizeHost`.
  - In `index.ts` `fetch`, compute `const host = normalizeHost(url.hostname)` once and pass it to `decide`, `isCustomDomainHost`, `lookupTenant` and `apiRequest`'s `practiceHost`.
  - In the API middleware, strip one trailing dot after `.trim().toLowerCase()`.
- [ ] **Step 4: Run all router and API middleware tests.** Expected: PASS.
- [ ] **Step 5: Commit:** `PR #55 review: normalise the host once, trailing dot included (M4)`

### Task 3: Upstream failures return JSON, within a time limit (M2)

**Files:**
- Modify: `apps/tenant-router/src/api-proxy.ts` (add `apiUnavailable`, next to `apiNotFound`)
- Modify: `apps/tenant-router/src/index.ts` (`proxyClientApi`)
- Test: `apps/tenant-router/src/api-proxy.spec.ts`

**Interfaces:**
- Consumes: `proxyClientApi(request, host, url, env)` from Task 2.
- Produces:
  - `export const API_TIMEOUT_MS = 30_000` in `api-proxy.ts`.
  - `export function apiUnavailable(status: 502 | 504): Response`, with body `{"statusCode":<status>,"message":"Service unavailable"}` (502) or `"Gateway timeout"` (504), and the same headers as `apiNotFound()`.

- [ ] **Step 1: Write the failing tests** in `describe('the Worker on /api')`:
  - `it('answers a JSON 502 when the API cannot be reached')`. Make `fetchMock` reject with `new TypeError('network')` for non-`exists` URLs. Expect status 502, `content-type` containing `application/json`, and the body's `statusCode` to be 502.
  - `it('answers a JSON 504 when the API does not answer in time')`. Make `fetchMock` reject with `new DOMException('timed out', 'TimeoutError')`. Expect status 504.
  - `it('bounds the API call with API_TIMEOUT_MS')`. Spy on `AbortSignal.timeout`, then expect it to have been called with `API_TIMEOUT_MS` and the forwarded request's `signal` to be the spy's return value.
- [ ] **Step 2: Run them.** Expected: FAIL (the rejection propagates).
- [ ] **Step 3: Implement.**
  - In `proxyClientApi`, build the API request with `signal: AbortSignal.timeout(API_TIMEOUT_MS)`. Add an optional `signal?: AbortSignal` to `apiRequest`'s `opts` and pass it into the `RequestInit`.
  - Wrap `fetch` in try/catch: a `TimeoutError` gives `apiUnavailable(504)`, anything else gives `apiUnavailable(502)`.
  - Don't log request bodies.
- [ ] **Step 4: Run the router tests.** Expected: PASS.
- [ ] **Step 5: Commit:** `PR #55 review: JSON 502/504 and a timeout on the API call (M2)`

### Task 4: The API refuses proxied requests with no ACTIVE practice, and the router stops probing (S2)

**Files:**
- Modify: `apps/api/src/common/middleware/tenant.middleware.ts` (the `if (req.routerProxy)` branch)
- Modify: `apps/tenant-router/src/index.ts` (`proxyClientApi`: remove `lookupTenant` and its import if nothing else uses it there; page serving keeps its own lookup)
- Test: `apps/api/src/common/middleware/tenant.middleware.spec.ts`, `apps/tenant-router/src/api-proxy.spec.ts`

**Interfaces:**
- Consumes: `proxyClientApi` from Task 3.
- Produces: on a router-proxied request whose `practiceHost` has no ACTIVE custom domain, `TenantMiddleware.use` throws `NotFoundException('Not found')` and doesn't call `next()`.

- [ ] **Step 1: Write the failing tests:**
  - `tenant.middleware.spec.ts`: `it('refuses a router-proxied request whose custom domain is not ACTIVE')`. Set `req.routerProxy = { practiceHost: 'gone.example', clientIp: null }` and have the Prisma mock return `null`. Expect `use(...)` to reject with `NotFoundException`, and `next` not to have been called.
  - `tenant.middleware.spec.ts`: the matching ACTIVE case still sets `req.tenant`. Keep or extend the existing test.
  - `api-proxy.spec.ts`: replace `'refuses a custom domain that is not ACTIVE (the lookup says it does not exist)'` with `it('forwards without probing /v1/tenant/public/exists first')`. After `POST https://chente.com/api/v1/auth/refresh`, expect no `fetchMock` call to contain `/public/exists/`. Drop the `/public/exists/` filter from `apiCalls()` once nothing on `/api` calls it.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement both changes.** Rewrite the comment in `proxyClientApi` to say the API is the check. This also closes the window where a just-deactivated domain was still forwarded.
- [ ] **Step 4: Run the API and router tests.** Expected: PASS.
- [ ] **Step 5: Commit:** `PR #55 review: API 404s proxied requests without an ACTIVE practice; no probe on /api (S2)`

### Task 5: Narrow the cookie scope on custom domains (S1)

**Files:**
- Modify: `apps/tenant-router/src/api-proxy.ts` (`rewriteSetCookie`)
- Modify: `apps/tenant-router/src/router.ts` (`originRequest`: drop `cookie` and `authorization` request headers)
- Test: `apps/tenant-router/src/api-proxy.spec.ts`, `apps/tenant-router/src/router.spec.ts`

**Interfaces:**
- Produces: `rewriteSetCookie(value: string): string`, with the signature unchanged. New rule: a cookie that is `HttpOnly` **and** has `Path=/` exactly gets `Path=/api`. Cookies that aren't `HttpOnly` keep `Path=/`, because the page reads `unclutter_csrf` with `document.cookie`.

- [ ] **Step 1: Write the failing tests:**
  - Change the expectation in the existing three-cookie test: `'unclutter_access=a; Path=/api; HttpOnly'`. Refresh stays `Path=/api/v1/auth/refresh`, and CSRF stays `'unclutter_csrf=c; Path=/'`.
  - `it('scopes a clearing HttpOnly cookie the same way')`: `'unclutter_access=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly'` becomes `Path=/api` with the rest unchanged.
  - `router.spec.ts`: `it('does not send cookies or Authorization to the app origin')`. Build a request with `cookie: 'unclutter_access=a'` and `authorization: 'Bearer x'`, then expect both headers to be `null` on `originRequest(...)`, and other headers kept (extend the existing `x-custom` test).
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement both.** Update the `api-proxy.ts` header comment to list the new rule.
- [ ] **Step 4: Run the router tests**, then run the e2e test locally (`e2e/custom-domain/run.sh`). Sign-in must survive a page reload and the 15-minute refresh path. Expected: PASS.
- [ ] **Step 5: Commit:** `PR #55 review: access cookie scoped to /api; no cookies to the app origin (S1)`

### Task 6: The allow-list test covers public routes (M3)

**Files:**
- Modify: `apps/api/src/router-proxy/client-api-routes.spec.ts`
- Modify (as the new test requires): `apps/tenant-router/src/client-api-routes.json`, and `NEVER_PROXIED` in the spec

**Interfaces:**
- Consumes: `allRoutes(): Route[]` from `apps/api/src/test-support/routes.ts` (`Route` has `target`, `authenticated` and `platformAdmin`).

- [ ] **Step 1: Write the failing test:**

```ts
it('classifies every public route: proxied, or deliberately never proxied', () => {
  const unclassified = ROUTES
    .filter((r) => !r.authenticated && !r.platformAdmin)
    .map((r) => r.target)
    .filter((t) => !LIST.routes.includes(t) && !NEVER_PROXIED.includes(t));
  expect(unclassified).toEqual([]);
});
```

- [ ] **Step 2: Run it:** `pnpm --filter @unclutterdesk/api test -- client-api-routes`. If it fails, the output lists the unclassified routes.
- [ ] **Step 3: Classify each listed route.**
  - If `apps/app/src` calls it from booking, portal, pay, intake, assessment or video pages, add it to `client-api-routes.json`.
  - Otherwise add it to `NEVER_PROXIED` with a trailing `//` reason (for example `// staff only`, `// health check`).
  - Don't add anything admin-, platform- or dashboard-facing to the JSON.
  - List every route you added, and which side it went to, in the commit body. The reviewer checks each one.
- [ ] **Step 4: Run the API and router tests.** Expected: PASS. The router's `isAllowedClientRoute` reads the same JSON.
- [ ] **Step 5: Commit:** `PR #55 review: allow-list test covers public routes (M3)`

### Task 7: Header names pinned across apps, one timing-safe compare, quieter logs (S3, S4)

**Files:**
- Create: `apps/api/src/common/timing-safe.ts`
- Modify: `apps/api/src/common/middleware/router-proxy.middleware.ts` (replace `secretMatches`, change logging)
- Modify: `apps/api/src/modules/auth/csrf.guard.ts` (replace `tokensMatch`'s body)
- Create: `apps/api/src/router-proxy/router-headers.spec.ts`
- Test: `apps/api/src/common/middleware/router-proxy.middleware.spec.ts`

**Interfaces:**
- Produces: `export function safeEqual(sent: unknown, expected: unknown): boolean` in `timing-safe.ts`. It returns false unless both are non-empty strings of equal byte length, then uses `crypto.timingSafeEqual`. Use the comments that are in `tokensMatch` today. `tokensMatch` and `secretMatches` both call it, or are replaced by it.

Shared package decision: `packages/shared` isn't a dependency of either the API or the router, and the API is a `tsc`-built Nest app, so moving the header names there is a bigger change than it saves. Instead, pin them with a cross-app test, the same way `client-api-routes.spec.ts` already reads the router's JSON.

- [ ] **Step 1: Write the failing tests:**
  - `router-headers.spec.ts`: import `ROUTER_SECRET_HEADER`, `PRACTICE_HOST_HEADER` and `CLIENT_IP_HEADER` from both `../common/middleware/router-proxy.middleware` and `../../../tenant-router/src/api-proxy` (aliased), and `expect` each pair to be equal. Also check that `safeEqual('a', 'a')` is true and that `safeEqual('a', 'b')`, `safeEqual('', '')`, `safeEqual(['a'], 'a')` and `safeEqual('a', 'ab')` are false.
  - `router-proxy.middleware.spec.ts`:
    - A wrong secret logs with `Logger.prototype.debug`, not `warn` (spy on both).
    - A correct secret with a blank `PRACTICE_HOST_HEADER` logs `warn` with a message containing `practice host header missing`. That case is a router bug, so it stays visible. The "did not match" message is reserved for a mismatch.
- [ ] **Step 2: Run them.** Expected: FAIL (`timing-safe` doesn't exist, and the log level is wrong).
- [ ] **Step 3: Implement.** Update the header comment in `router-proxy.middleware.ts` to point at `router-headers.spec.ts` instead of "must match".
- [ ] **Step 4: Run the API tests, including the CSRF guard specs.** Expected: PASS.
- [ ] **Step 5: Commit:** `PR #55 review: one timing-safe compare, header names pinned by test, debug-level mismatch log (S3, S4)`

### Task 8: The e2e workflow runs on `dev` (M5)

**Files:**
- Modify: `.github/workflows/e2e-custom-domain.yml` (the `push.branches` and `pull_request.branches` lists)

- [ ] **Step 1: Add `- dev`** under both `branches:` lists, keeping `main`.
- [ ] **Step 2: Check it:** `grep -n -A3 'branches:' .github/workflows/e2e-custom-domain.yml`. Expected: both lists show `main` and `dev`.
- [ ] **Step 3: Commit and push.** After the push, `gh pr checks 55` shows the `E2E Custom-Domain Proxy` job running on the PR. Expected: it passes.
  Commit message: `PR #55 review: run the custom-domain e2e on dev too (M5)`

### Task 9: Final verification and reply

- [ ] **Step 1:** Run `pnpm typecheck` and the three test commands from Global Constraints. Expected: all pass, with no skipped tests added.
- [ ] **Step 2:** Run `e2e/custom-domain/run.sh` locally, or confirm the CI job passed on the latest push. Expected: PASS.
- [ ] **Step 3:** Post one comment on PR #55 listing M1–M5 and S1–S4 with the commit that fixes each, plus the Task 6 route classifications. Don't merge. Spec Claude re-reviews.
