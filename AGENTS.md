# Working in this repo (all coding agents, including opencode)

The product spec is `docs/unclutter-desk-v2-spec.md`. Plans for each piece of work are in `docs/superpowers/plans/`.

## Before asking for review

Run the **full** suites and the root typecheck, not only the tests for the files you changed. A change in one module regularly breaks a test somewhere else.

```
pnpm typecheck                      # every package
pnpm --filter @unclutterdesk/api test
pnpm --filter @unclutterdesk/app test
pnpm --filter @unclutterdesk/ui test
pnpm --filter @unclutterdesk/profiles test
```

Post the totals (test files, tests, failures) in the PR or the hand-off message. **Do not ask for review with a failing suite.** If a failure exists on `dev` already, say so and name it.

- **When you change behaviour, update the tests that describe it** in the same commit. A test that only stops matching the new code is not a fix. Change it only if the new behaviour is the intended one.
- **Do not weaken a rule to make a test pass.** For example, sending a stock "reason" to get around a required reason is not allowed.

## Branches and pull requests

- **Never push to `main`;** a push there deploys to production. Work goes to a branch, then a PR into `dev`. The owner merges; don't merge your own PR.
- **Once a PR is merged, its branch is finished.** Put follow-up commits on a new branch and open a new PR. Commits pushed to a merged PR's branch never reach `dev`.
- **Branches are shared between git worktrees and agents.** Don't check out, reset or force-push a branch another agent is working on. If you must rewrite your own branch, use `git push --force-with-lease`, never `--force`.
- **The git stash is shared too.** Never run a bare `git stash pop`; apply your own entry by its SHA.

## Code rules

- **Enterprise grade, no workarounds.** Use the real shared components (`@unclutterdesk/ui`). Tests fake only the network; never stub our own pages, components or services.
- **No hard-coded production domains** in code or comments (`apps/api/src/domain-literals.spec.ts` enforces this; spec files are exempt).
- **Every admin write is audited** with who, what, which record and why. The change and its audit entry go in the same transaction (`AuditService.record(entry, tx)`).
