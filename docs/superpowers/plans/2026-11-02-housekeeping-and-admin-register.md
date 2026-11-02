# Housekeeping + admin-only practice registration: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the finished Phase 1 item 1, tidy the repo, and make `POST /v1/tenant/register` platform-admin only.

**Architecture:** NestJS API (`apps/api`). `PlatformAdminGuard` (`apps/api/src/modules/admin/platform-admin.guard.ts`) authenticates the platform admin's cookie session and checks it is still live. CSRF is double-submit (`apps/api/src/modules/auth/csrf.guard.ts`), with an explicit exempt list of unauthenticated entry points.

**Tech Stack:** TypeScript, NestJS, Vitest, pnpm.

**Spec:** `docs/unclutter-desk-v2-spec.md` §6.8 ("`POST /v1/tenant/register` becomes platform-admin only… Keep it as an admin tool for setting up a practice directly, behind `PlatformAdminGuard`") and the Phase 1 acceptance list.

## Global Constraints

- Start: `git checkout dev && git pull --ff-only && git checkout -b phase1/admin-register`. **Never push to `main`** (a push there deploys to production). Open the PR into `dev`.
- **Run `git pull --ff-only` before you start, and report only what is in the code.** The last review found claimed work that wasn't there.
- One commit per task, message prefix `Phase 1:`. Push after each.
- Tests: `pnpm --filter @unclutterdesk/api test`; typecheck: `pnpm typecheck`. Both must pass.
- **Don't edit the spec** except the one checkbox in Task 1. Spec Claude owns the rest of it and is editing §6 in parallel.
- Another branch (Spec Claude's profile work) is open at the same time. Stay out of `prisma/schema.prisma` and `apps/api/src/modules/tenant/reserved-slugs.ts`.

## Review Focus

1. A signed-in **practice owner** (not a platform admin) calls `POST /v1/tenant/register`: it must be refused (403), not create a practice.
2. An **anonymous** caller: 401, and nothing is created.
3. A platform admin's request **without the CSRF header**: refused by the CSRF guard, now that the route is no longer exempt.
4. A platform admin whose session was revoked: refused (the guard's `assertSessionLive`).

---

### Task 1: Housekeeping

**Files:**
- Modify: `docs/unclutter-desk-v2-spec.md`, only the line starting `- [ ] **First item:** custom-domain \`/api\` proxy built` in "Phase 1 acceptance"
- Add (already on disk, untracked): `docs/reviews/`, `docs/superpowers/`

- [ ] **Step 1:** Change that one line's `- [ ]` to `- [x]` and append ` — done 2 Nov 2026 (PRs #55, #58; checked by Olalekan in Safari, Edge and Chrome)`. Change nothing else in the spec.
- [ ] **Step 2:** `git add docs/reviews docs/superpowers docs/unclutter-desk-v2-spec.md`, then commit: `Phase 1: record item 1 done; keep the PR #55 review record`.
- [ ] **Step 3:** Delete the three remote branches already merged into `dev`. First confirm each has no commits outside `dev`. Each of these must print nothing:
  - `git log --oneline origin/dev..origin/claude/tender-wozniak-i510hy`
  - `git log --oneline origin/dev..origin/fix/worker-routes-survive-deploy`
  - `git log --oneline origin/dev..origin/opencode/walkthrough-uploads`

  Delete only the ones that printed nothing: `git push origin --delete <branch>`. If any printed commits, **don't delete it**; list it in your report.

### Task 2: `POST /v1/tenant/register` is platform-admin only

**Files:**
- Modify: `apps/api/src/modules/tenant/tenant.controller.ts` (the `@Post('register')` handler)
- Modify: `apps/api/src/modules/auth/csrf.guard.ts` (remove `'POST /v1/tenant/register'` from the exempt set; the comment at line 15 stays as history)
- Modify: `apps/api/src/modules/auth/csrf.guard.spec.ts` (move `/v1/tenant/register` from the exempt list to a "protected" case)
- Modify: `apps/api/src/router-proxy/client-api-routes.spec.ts`. The route is no longer public, so remove it from `NEVER_PROXIED` if the "classifies every public route" test then complains about an unknown entry. Otherwise leave it.
- Test: `apps/api/src/modules/tenant/tenant-register.spec.ts` (new)

**Interfaces:**
- `PlatformAdminGuard` from `../admin/platform-admin.guard`. Check how `apps/api/src/modules/admin/admin.controller.ts` uses it. The tenant module must be able to inject `PrismaService` for the guard; if Nest can't resolve it, follow how the admin module provides it, and don't create a second guard.

- [ ] **Step 1: Write the failing tests** in `tenant-register.spec.ts`. Use the same approach as the existing guard tests (find them with `grep -rln "PlatformAdminGuard" apps/api/src --include=*.spec.ts`), or a route-metadata check like `apps/api/src/test-support/routes.ts`:
  - `it('guards POST /v1/tenant/register with PlatformAdminGuard')`: read the guards metadata on `TenantController.prototype.createTenant` (`Reflect.getMetadata('__guards__', …)`) and expect it to contain `PlatformAdminGuard`.
  - `it('is no longer CSRF-exempt')`: build the guard's context for `POST /v1/tenant/register` with an access cookie and no `x-csrf-token`, and expect `ForbiddenException`. Follow the existing cases in `csrf.guard.spec.ts`.
  - `it('is not reachable by a practice role')`: using `allRoutes()` from `apps/api/src/test-support/routes.ts`, expect the route's `platformAdmin` to be `true`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Add `@UseGuards(PlatformAdminGuard)` and `@ApiBearerAuth()` to the handler, and change the summary to `'Platform admin: set up a practice directly (e.g. a clinic onboarded in person)'`. Remove the route from the CSRF exempt set.
- [ ] **Step 4: Run the whole API suite and the typecheck.** Expected: PASS. Fix any test that relied on the old open or exempt behaviour by updating its expectation, not by weakening the guard.
- [ ] **Step 5: Commit:** `Phase 1: POST /v1/tenant/register is platform-admin only`.

### Task 3: PR and report

- [ ] **Step 1:** Open the PR into `dev`: `gh pr create --base dev --title "Phase 1: admin-only practice registration + housekeeping"`. The body lists each task, the commit for each, the test counts, and which branches were deleted.
- [ ] **Step 2:** In your final report give the PR URL, the four Review Focus cases with the test that covers each, and the branch-deletion result. Don't merge. Spec Claude reviews.
