# Handoff to opencode (4 Nov 2026)

Spec Claude stopped mid-work. Follow `AGENTS.md`: full suites, `pnpm typecheck`, post totals.

## 1. Finish the Schedule (branch `phase1/schedule-real-data`, work in progress, pushed)
Done so far (uncommitted design is in the branch):
- `scheduleView.ts` with tests: visible hours from weekly availability and sessions (at least 8 AM to 6 PM), weekend days only when worked, one colour per service.
- `SchedulePage.tsx`:
  - Hours, days and colours come from that module.
  - "New session" is now **"Add open time"**, with only date, time and length, because that is all it ever saved. The fake client, category and video choices are removed.
  - The colour key lists the real services.
  - Dates are taken in local time, not UTC.

To do:
- Run the full app suite. One failure was seen in `BookingWizardPage.test.tsx` ("books and pays online, end to end", 6 s timeout). Check whether it's caused by this branch or is a flaky timeout; it doesn't touch Schedule code.
- Add a SchedulePage test:
  - Hours follow the weekly availability.
  - Saturday shows when worked.
  - The key shows real service names.
  - "Add open time" posts only `startsAt` and `endsAt`.
- Open the PR into `dev`.

## 2. Holidays / time off (owner request, item 8)
- **Settings:** Availability gets "Time off": a single date or a date range, with an optional note.
- **Booking:** those days close to booking. Mark the open slots inactive, and generation skips them.
- **Existing bookings:** bookings already on those days are listed for the therapist to move. Never cancel them automatically.
- **Schema:** a model is needed (`TimeOff { tenantId, profileId, startsOn, endsOn, note }`). Add a migration, API routes under `/v1/consult/therapist/time-off`, and tests.
- **Schedule:** time off shows as grey blocks.

## 3. Shared public page (`docs/superpowers/plans/2026-11-03-shared-public-page.md`)
Tasks 1–6 were Spec Claude's and haven't started. Start with task 1, `brandTokens(hex)` in `packages/ui` with contrast tests, then 7–8.

## Open PRs for the owner to merge
- #98: session status labels and the room-opening setting. Already resolved against #92.
- #99: intake answer labels.
- #94: Settings in one place, yours. Rebase on dev.
