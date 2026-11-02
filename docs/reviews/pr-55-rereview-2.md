# Re-review 2: PR #55 review fixes

**Reviewer:** Spec Claude, 2 Nov 2026
**Reviewed:** `phase1/custom-domain-api-proxy` at `70ee517` (pushed; PR head matches)

## Verdict

**Approved once one item is fixed.** I've checked the code for every finding from the review and re-review 1, and it's in the code. Tests and checks:
- Tests pass: api 1383, tenant-router 105, app 560.
- `pnpm typecheck` passes.
- The `Sign-in + booking through the custom-domain proxy` CI job passes on the PR.

## One item left

**Header-pin test, `apps/api/src/router-proxy/router-headers.spec.ts`.** You were right that the API can't import from `apps/tenant-router`: `build-layout.spec.ts` forbids it, and my re-review 1 was wrong to ask for that. But the test still compares the API's constants against literals typed into the test, so a rename in the router would pass.
Fix:
- Read `../../../tenant-router/src/api-proxy.ts` as text with `readFileSync` (that isn't an import, so `build-layout` allows it; `client-api-routes.spec.ts` already reads the router's JSON this way).
- Extract each value with a regex, e.g. `/export const ROUTER_SECRET_HEADER = '([^']+)'/`.
- Assert each one equals the API's constant, and that the regex matched.
- Fix the comment at the top of the file, which says that drift goes unnoticed and can only be fixed by editing both places.

Commit as `PR #55 review: header-pin test reads the router's source (S3)` and push.

## Then

Post the PR #55 summary comment from plan Task 9. Don't merge.
