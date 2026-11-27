# Handoff to opencode: Phase 1 gaps (16 Nov 2026)

On 16 Nov the code was audited against the v2 spec's checklists (see the annotated Phase 1 acceptance list in `docs/unclutter-desk-v2-spec.md`). Phase 0 is fully built. This file splits the Phase 1 gaps between Claude Code and opencode.

Follow `AGENTS.md`: work in your own fresh worktree from `origin/dev`, never on `main`. Run the full suites and `pnpm typecheck`, post the totals in the PR, and open PRs into `dev`.

## Who does what

| Work | Owner | Branch |
|---|---|---|
| §6.14 Leaving a practice: one `onMembershipEnded` handler on all four exit paths, place removal, main-place promotion, fallback to NONE, purge, emails, reactivation email | **Claude Code** | `phase1/leaving-a-practice` |
| Task A: per-place consent (§6.9) | **opencode** | `phase1/per-place-consent` |
| Task B: slug rename when switching to DESK (§6.2, §6.9) | **opencode** | `phase1/desk-slug-rename` |
| Task C: Lighthouse / axe accessibility check in CI for `apps/profiles` | **opencode** | `phase1/profiles-a11y-ci` |
| Task D: manual "publish in 10 minutes" test script | **opencode** | can go with C |

**Don't touch** the files Claude Code is changing, to avoid conflicts:
- `ConsultService.adminUpdateTherapistStatus`
- `SubscriptionLapseService` (pause/reactivate)
- `AdminService.updateTenant`
- `practice-closure.service.ts`
- any new `practitioner-profile/membership-ended*` files

If a task needs one of these, say so in the PR and leave a TODO instead.

## Task A: per-place consent (§6.9, spec line "Per-place consent")

The schema already has `ConsultTherapistProfile.allowProfileBooking Boolean @default(true)`, but nothing reads or sets it.

1. **API:** a route for an OWNER/ADMIN of the practice to set `allowProfileBooking` for one of their therapists (tenant-scoped `updateMany`, same pattern as `adminUpdateTherapistStatus`; 403 for other roles, 404 across tenants). Audit the change.
2. **Public profile:** `public-profile.service.ts` returns, per place, whether it takes online bookings. A place with `allowProfileBooking = false` or an inactive tenant shows **"Not taking online bookings here right now"**, with no broken link. If the main place is unavailable, the primary Book button offers the next available place, or none.
3. **Profiles renderer:** shows that line in "Where I practise" and in the primary button logic. Render it as plain text.
4. **Practice dashboard:** a toggle on the team/staff page, worded as "Show this practice as a booking place on {name}'s profile". The practice cannot edit or hide the therapist's profile; only this toggle exists.
5. **Purge:** changing the toggle queues a purge with `queuePurge(jobs, [profileTag(handle)])`.
6. **Tests:**
   - role and tenant checks
   - public shape for each place state
   - next-place fallback
   - renderer copy
   - the toggle

## Task B: slug rename when switching to DESK

§6.9's DESK set-up says "confirm or rename the booking address (slug, §6.2)". The switch-to-DESK block in `practitioner-profile.service.ts` (around the `onboardingIntent: 'PRACTICE'` update) has no rename step.

- Add the confirm/rename step in the editor's DESK set-up, using the existing slug checks in `handles.ts` / `reserved-slugs.ts` across both namespaces.
- While you're there, confirm the slug suffix on collision (§6.2) is actually applied at profile-first signup. Add a test if it's missing.
- A rename must keep the old address working: check §6.2/§6.3 for redirect rules and follow them.

## Task C: accessibility check in CI

Phase 1 needs "Lighthouse accessibility ≥ 95" on the public page. The design-system plan also asks for this on home, pricing and each layout × palette.

- Add a CI job, either in `ci.yml` or a new workflow, that builds `apps/profiles`, serves it with fixture data, and runs axe (or Lighthouse CI). It should fail below 95, or on any serious/critical axe violation.
- Cover home, pricing, and one profile per layout × palette.
- The job must run without network access to the real API: fake only the API, using a fixture server.

## Task D: manual test script

Write `docs/testing/publish-profile-in-10-minutes.md`. It should give the steps a person follows to time a brand-new therapist:
- sign up, including the 6-digit code
- pick a template
- pick a theme
- publish

It also needs pass criteria and a place to record the time and the browser. Olalekan runs it.

## When you finish

Tick the matching boxes in the spec's Phase 1 acceptance list in your PR, with the PR number.
