# Admin: profile templates, taxonomy and guidance (§12): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Platform admins edit profile templates, the taxonomy (specialties, modalities, populations, languages) and the per-section guidance text in the admin console, with every change audited.

**Architecture:** A new admin controller inside the practitioner-profile module (`apps/api/src/modules/practitioner-profile/admin-profile-content.controller.ts`), guarded by the existing `PlatformAdminGuard`. It reads and writes the existing `ProfileTemplate` and `TaxonomyTerm` tables. Guidance already lives in the database: it's the `sections.guidance` object of the `general` template (see `prisma/migrations/20261103090000_profile_templates/migration.sql`). Admin pages live under `/admin/profiles/…` in `apps/app`.

**Tech Stack:** TypeScript, NestJS, Prisma, React, Vitest.

**Spec:** `docs/unclutter-desk-v2-spec.md` §12 ("Templates", "Taxonomy", "Guidance text"), §6.6, §6.7, §4.4 (`AdminAuditLog`), and the Phase 1 acceptance line "Templates and guidance editable in admin; unchanged-template-text warning works".

## Global Constraints

- Start: `git checkout dev && git pull --ff-only && git checkout -b phase1/admin-profile-content`. **Never push to `main`.** Open the PR into `dev`.
- **Report only what is in the code.** Run `git pull --ff-only` before you start.
- One commit per task, prefix `Phase 1:`. Push after each.
- Tests: `pnpm --filter @unclutterdesk/api test`, `pnpm --filter @unclutterdesk/app test`; `pnpm typecheck`. All must pass.
- **No schema changes** (no edits to `prisma/schema.prisma`, no migrations). Spec Claude has a migration open.
- **Don't edit the spec**, and don't edit `apps/api/src/modules/admin/admin.controller.ts`. Spec Claude is adding a profile reports controller in parallel; keep your code in the new files named here.
- Every write goes through `AuditService.record` (`apps/api/src/modules/audit/audit.service.ts`): actions `profile-template.create`, `profile-template.update`, `profile-template.activate`, `profile-template.deactivate`, `taxonomy.create`, `taxonomy.rename`, `taxonomy.activate`, `taxonomy.deactivate`, `taxonomy.reorder`, `profile-guidance.update`. `meta` holds the before and after values that changed.
- **Enterprise grade, no workarounds:** reuse `PlatformAdminGuard` (don't write a second guard), the app's API client and the existing admin layout components. Tests fake only the network.

## Rules the code must enforce

- **Template keys never change** after creation; they're referenced by `PractitionerProfile.templateKey`. Format `^[a-z][a-z0-9-]{2,59}$`. There's no delete: deactivate instead. The `general` template can't be deactivated (it holds the guidance).
- **Template `sections`** must only use the section keys in `SECTION_ORDER` (find it with `grep -rn "SECTION_ORDER" apps/api/src`). Each section is `{ prompt?: string, example?: string }`, plain text: prompt ≤ 300 characters, example ≤ 3,000. `suggested` taxonomy keys must exist and be active. Reject anything else with a 400 that names the field.
- **Taxonomy keys never change**; renames change `label` only. Key format `^[a-z][a-z0-9-]{1,59}$`, unique per kind. Labels 1–60 characters, trimmed.
- **Deactivating a term** removes it from the editor's pickers (`activeTaxonomy()` already filters `isActive`). Profiles that already have it keep it. Check what `public-profile.service.ts` does with an inactive term and pin that behaviour with a test; if it hides inactive terms today, keep that.
- **A rename or deactivation changes public pages**, so purge every published profile that uses the term: call the existing purge path in `PractitionerProfileService` (`purgeIfPublished` or `purge`; read how they work) for each affected profile. Template and guidance edits don't change public pages, so no purge.
- **Guidance:** one text per section key, plain text, ≤ 500 characters; all section keys must be present.

## Review Focus

1. A practice owner (not a platform admin) calling any of the new routes gets 403; an anonymous caller gets 401.
2. Renaming a term keeps its `key`, writes an audit entry with old and new labels, and enqueues a purge for each published profile using it.
3. A template with an unknown section key, an over-long example, or an unknown suggested key is refused with a 400.
4. The `general` template can't be deactivated, and template keys can't be changed through `PATCH`.
5. The editor's unchanged-template-text warning still works after an admin edits a template's example text. Read `unchangedTemplateSections` in `practitioner-profile.service.ts` first. If it compares against the current template text, a later admin edit would make old inserted text look "changed"; report what it does and add a test for whatever it does.

---

### Task 1: Admin API for templates and guidance

**Files:**
- Create: `apps/api/src/modules/practitioner-profile/admin-profile-content.controller.ts`
- Create: `apps/api/src/modules/practitioner-profile/admin-profile-content.service.ts`
- Create: `apps/api/src/modules/practitioner-profile/profile-content.validation.ts`
- Modify: `apps/api/src/modules/practitioner-profile/practitioner-profile.module.ts` (register the controller and service; import `AuditModule`; provide `PlatformAdminGuard` the way `apps/api/src/modules/admin/admin.module.ts` does)
- Test: `admin-profile-content.service.spec.ts`, `profile-content.validation.spec.ts`

Routes (all `@UseGuards(PlatformAdminGuard)`, under `v1/admin/profile-content`):
- `GET templates` (all, including inactive), `GET templates/:key`, `POST templates`, `PATCH templates/:key` (title, description, kind, sections, suggested, sortOrder), `POST templates/:key/activate`, `POST templates/:key/deactivate`
- `GET guidance`, `PUT guidance`

- [ ] **Step 1:** Write failing tests for the validation rules above (pure functions), then for the service against the test database (follow how `practitioner-profile.service.spec.ts` sets up), including the audit entries.
- [ ] **Step 2:** Run them; they fail.
- [ ] **Step 3:** Implement. Validation returns typed errors that the controller turns into 400s naming the field.
- [ ] **Step 4:** Add route-guard tests: read the guards metadata on each handler and expect `PlatformAdminGuard`, the same way `apps/api/src/modules/tenant/tenant-register.spec.ts` does. Check `allRoutes()` in `apps/api/src/test-support/routes.ts` marks them `platformAdmin`.
- [ ] **Step 5:** Full API suite and typecheck. Commit `Phase 1: admin API for profile templates and guidance`.

### Task 2: Admin API for taxonomy

**Files:** the same controller and service; test in the same specs.

Routes: `GET taxonomy?kind=`, `POST taxonomy` (kind, key, label), `PATCH taxonomy/:id` (label only), `POST taxonomy/:id/activate`, `POST taxonomy/:id/deactivate`, `PUT taxonomy/order` (kind plus the ordered ids of that kind; must be exactly that kind's ids).

- [ ] **Step 1:** Failing tests: create, duplicate key per kind (409), rename keeps key and purges, deactivate purges and hides from `activeTaxonomy()`, reorder rejects a partial or mixed-kind list. The purge test checks a `BackgroundJob` row of the purge type is created per published profile, and none for drafts.
- [ ] **Step 2:** Run; fail. **Step 3:** Implement. **Step 4:** Suite and typecheck. Commit `Phase 1: admin API for taxonomy`.

### Task 3: Admin pages

**Files:**
- Create: `apps/app/src/pages/admin/profiles/AdminProfileTemplatesPage.tsx`, `AdminProfileTemplateEditPage.tsx`, `AdminTaxonomyPage.tsx`, `AdminGuidancePage.tsx`, `profileContentApi.ts`
- Modify: `apps/app/src/App.tsx` (routes `/admin/profiles/templates`, `/admin/profiles/templates/:key`, `/admin/profiles/taxonomy`, `/admin/profiles/guidance`)
- Modify: `apps/app/src/pages/admin/PlatformAdminLayout.tsx` (one nav item "Profiles" → `/admin/profiles/templates`; the three pages share a small tab bar)
- Test: `apps/app/src/pages/admin/profiles/__tests__/*.test.tsx`

- [ ] **Step 1:** Failing tests: the template editor shows every section in `SECTION_ORDER` order with prompt and example fields and character counters; save sends only changed fields; a 400 shows the field error beside the field; the taxonomy page groups by kind, renames inline, and asks for confirmation before deactivating ("Profiles that use it keep it; it won't be offered to new profiles"); reorder with up/down buttons (keyboard accessible; no drag-only control).
- [ ] **Step 2:** Run; fail. **Step 3:** Implement with the existing admin page components (look at `AdminAssessmentsPage.tsx`). **Step 4:** Check at 1280 px and 768 px, keyboard only. App suite and typecheck. Commit `Phase 1: admin pages for profile templates, taxonomy and guidance`.

### Task 4: PR and report

- [ ] **Step 1:** `gh pr create --base dev --title "Phase 1: admin profile content (§12)"`. The body lists each task, its commit, the test counts, and screenshots.
- [ ] **Step 2:** Final report: PR URL, the test for each Review Focus case, and what you found for Review Focus 5. Don't merge. Spec Claude reviews.
</content>
</invoke>
