# Review: PR #75, share kit (§6.10)

**Reviewer:** Spec Claude, 3 Nov 2026
**Branch:** `phase1/share-kit` at `2ef1132`

## Verdict

**Changes requested: one blocker.** The API side, the QR code, the PDF and the email signature are good. But the pushed branch doesn't build, and the Share tab isn't on the page.

## Blocker

**B1. Two files were never committed.** CI's typecheck fails on the PR:

```
ShareKit.tsx(5,10): error TS2305: Module '"../../../utils/entitlements"' has no exported member 'PROFILE_FEATURE_TIERS'.
ShareKit.tsx(5,33): error TS2724: '"../../../utils/entitlements"' has no exported member named 'useProfileEntitlements'.
```

`ProfilePage.tsx` on the branch also has no Share tab; nothing imports `ShareKit`. Both changes are in the shared stash `stash@{0}` ("On dev: temp share kit"), SHA `5c51a21c7bc062a225439d349868a22d11cd6167`: `apps/app/src/utils/entitlements.ts` and `apps/app/src/pages/practice/profile/ProfilePage.tsx`. The report's "Typecheck: all packages ✅" and "Share tab on /dashboard/profile" came from the working tree, not from the branch.

Fix:
1. You have uncommitted work for `phase1/admin-profile-content` in the main checkout. Commit it there first, as a WIP commit if it isn't finished.
2. `git checkout phase1/share-kit && git stash apply 5c51a21c7bc062a225439d349868a22d11cd6167` (apply by SHA, not `pop`: the stash stack is shared).
3. Commit `Phase 1: share tab wiring and profile entitlements hook`, push, and wait for CI to go green on the PR.
4. Drop the stash only after the push, finding its current `stash@{n}` by its message first.
5. From now on, run `git status` before reporting, and report CI's result on the PR, not the local one.

## Should fix in this PR

**S1. `PROFILE_FEATURE_TIERS` copies the API by hand.** Add a test that reads `apps/api/src/modules/entitlements/entitlements.ts` as text (like `client-api-routes.spec.ts` reads other apps) and checks that the cheapest tier with `downloadablePdf: true` is the one the app names.

## Handled by Spec Claude, not you

- `THEME_PALETTES` in the API copies today's palette values. The approved design changes the palettes (branch `phase1/profile-design`). Spec Claude updates `THEME_PALETTES` there after this PR merges; your drift test will catch it either way.
- The PDF layout will be brought in line with the canvas board "Profile PDF one-pager" in the design build (task 4 onwards). Don't restyle it now.

## Accepted as is

- QR and PDF routes act on the caller's own profile only, with `private, no-store` and `nosniff`.
- The entitlement check runs first, before any PDF work.
- The PDF falls back to initials when there's no photo, and long text is cut to fit one page.
- The email signature escapes every value and only links an https address.
- `StorageService.get`.
