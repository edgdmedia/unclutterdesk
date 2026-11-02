# Re-review 1: PR #55 review fixes

**Reviewer:** Spec Claude, 2 Nov 2026
**Reviewed:** the uncommitted working tree on `phase1/custom-domain-api-proxy`, local branch at `9b745e0`
**Plan:** `docs/superpowers/plans/2026-11-02-pr55-review-fixes.md` (task numbers below refer to it)

## Verdict

**Not ready.** The tenant-router (94 tests) and API (1376 tests) test suites pass and typecheck is clean. But two reported fixes (S1, M5) aren't in the code, two plan tasks are only partly done, and the changes introduce three bugs. Fix everything below, then report back for re-review 2.

## Before anything else: get onto the right branch state

1. The local branch is **two commits behind** `origin/phase1/custom-domain-api-proxy` (`9dd720d`, `52c1b16`). That's why the workflow file seemed missing. Those commits touch only `e2e/**` and the workflow, which your changes don't, so run `git pull --ff-only` now. It applies cleanly over your uncommitted work.
2. **Nothing is committed yet.** Commit per task as the plan says (`PR #55 review: … (M1)`, etc.) and push after each. Never push to `main`.
3. Report only what is in the code. The summary said S1 and M5 were done. They aren't.

## Bugs introduced (fix first)

**B1. `safeEqual` can crash with a 500.** `apps/api/src/common/timing-safe.ts`
It compares `sent.length !== expected.length`, which counts **characters**. `timingSafeEqual` needs equal **byte** lengths. A one-character header like `é` against a one-character secret passes the length check, then `timingSafeEqual` throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`. Any direct caller can trigger this with a non-ASCII `x-ud-router-secret` (or `x-csrf-token`, once CSRF uses the helper). I checked this in Node.
Fix:
- Compare the `Buffer` lengths after `Buffer.from(…, 'utf8')`, the way `tokensMatch` already does.
- Replace the inline `require('crypto')` with `import { timingSafeEqual } from 'crypto'`.
- Add the test `expect(safeEqual('é', 'e')).toBe(false)`.

**B2. A coverage test was deleted.** `apps/api/src/router-proxy/client-api-routes.spec.ts`
The rewrite removed `'covers everything a client can reach, so the client portal works through the proxy'`. That test is what makes CI fail when a client-portal route is missing from the allow-list. The new public-route test was meant to be **added** next to it (Task 6), not replace it.
Fix:
- Restore that test as it was.
- Keep the new public-route test.
- Remove the unused `staffRoutes` variable.
- Put back a one-line reason per `NEVER_PROXIED` entry.
- Report the Task 6 classification: which public routes, if any, you added to which list. If there were none, say so.

**B3. Subdomain lookups became case-sensitive.** `apps/api/src/common/middleware/tenant.middleware.ts`
In the Host branch, `.toLowerCase()` was dropped from `host.split(':')[0]`. `activeCustomDomain` still lowercases, but the subdomain slug lookup (`parts[0]` into `findUnique({ where: { slug } })`) no longer does.
Fix: use `const domain = normalizeHost(host.split(':')[0])`. Add a test where `DrJane.localhost` resolves the `drjane` practice.

## Not done, or only partly done

**M5 (Task 8): the workflow isn't changed.** The file is at `.github/workflows/e2e-custom-domain.yml` (it exists at `9b745e0` as well). Add `- dev` under both `branches:` lists.

**S1 (Task 5): not implemented.**
- `rewriteSetCookie` is unchanged. HttpOnly cookies with `Path=/` must become `Path=/api`; the CSRF cookie (not HttpOnly) stays `Path=/`.
- `originRequest` must drop the `cookie` and `authorization` request headers.
- Write the three tests in Task 5, including the changed expectation in the existing three-cookie test (`'unclutter_access=a; Path=/api; HttpOnly'`).
- Then run `e2e/custom-domain/run.sh`.

**M2 (Task 3): the tests are missing, and two details are off.**
- None of the three tests exist (JSON 502 on a network error, 504 on `TimeoutError`, `AbortSignal.timeout` called with `API_TIMEOUT_MS`). Add them.
- `index.ts` uses a literal `30_000`. Use the exported `API_TIMEOUT_MS`.
- `apiUnavailable` is missing `'cache-control': 'no-store'`. It must have the same headers as `apiNotFound()`.

**S3 (Task 7): the header-pin test doesn't test anything.** `apps/api/src/router-proxy/router-headers.spec.ts` compares the API constants against string literals written in the test, so a rename in the router would still pass.
- Import the three constants from `../../../tenant-router/src/api-proxy` (aliased) and compare them with the API's. `client-api-routes.spec.ts` already reads that app's files the same way.
- `csrf.guard.ts` still has its own `tokensMatch`. Make it call `safeEqual`, or remove it in favour of `safeEqual`.
- Drop the now-pointless `secretMatches` wrapper, or keep it un-exported.

**M1 (Task 1): one test is missing.** Add `'keeps a port given in originHost (the local e2e setup)'` from the plan.

**M4 (Task 2): one change is missing.** `RouterProxyMiddleware` still sets `practiceHost` as `.trim().toLowerCase()` without stripping the trailing dot. Use one `normalizeHost` in `apps/api/src/common/` (move it out of `tenant.middleware.ts`) and use it in both middlewares. Add the plan's middleware test (`'Chente.com.'` becomes `'chente.com'`).

## Small cleanups

- In `router-proxy.middleware.ts`, the final `else` branch ("Router proxy request ignored") can't be reached. Remove it, along with its comment. The two comment lines above the `if` chain also contradict the code (they say debug-level, then it warns), so rewrite them in one sentence.
- In `api-proxy.spec.ts`, the S2 test's three inline comments repeat the test name. Cut them to one line at most, matching the rest of the file.
- In `index.ts`, write the S2 comment for a reader who hasn't seen the review: "The API checks the custom domain is ACTIVE and answers 404 otherwise, so there's no probe here." Don't put review IDs in code comments.

## Accepted as is

- M1's port handling in `originRequest`.
- `normalizeHost` in the router and its tests.
- The S2 router change, and the `TenantMiddleware` 404 for proxied requests with no ACTIVE practice, with its tests.
- The S4 log levels, apart from the cleanup above.

## Done means

All of the above is done, every task is committed separately and pushed to `phase1/custom-domain-api-proxy`, `pnpm typecheck` and the three test suites pass, `e2e/custom-domain/run.sh` passes, and you post the PR comment from plan Task 9.
