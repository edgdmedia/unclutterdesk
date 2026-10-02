# Session Outcomes, Reminders, Email Wording and Portal Booking Implementation Plan (BKG-13, NOT-07, NOT-12, NOT-13, NOT-14, POR-04, POR-05)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- A session whose time has passed without an outcome shows as **Unrecorded** until the therapist records Completed, No-show or Late cancel.
- Clients get timely reminders before and after sessions, and choose their own reminders (including right after booking).
- Practices see each session's reminders, can send one by hand, set the default timings, and edit the wording of every email they send.
- Clients can book and add sessions to their calendar from the portal.

**Architecture:**
- **Outcomes:** two new stored statuses, `NO_SHOW` and `LATE_CANCEL`. "Unrecorded" is never stored: it's computed (`CONFIRMED` and past its end) by one shared helper, used by the API views and the app.
- **Reminders:** a new `SessionReminderService` queues reminders in the existing `NotificationService.queueReminder` queue (scheduled, deduplicated, processed every 30 seconds) whenever a booking is confirmed, rescheduled or cancelled. Timings come from, in order: the client's choice for that booking, the client's own preference, then the practice's `reminderSettings`.
- **Email wording:** one `MessageComposer` builds every practice-to-client message from a registry of default templates (subject, opening line, button label, with placeholders). A practice's saved overrides win. Senders pass the template key and its values instead of writing copy inline, so wording lives in one place and is editable.
- **Portal:** booking reuses the booking wizard, and calendar links reuse the wizard's "Add to calendar" dropdown.

**Tech Stack:** NestJS, Prisma, React, vitest.

**Spec:** `docs/testing-feedback.md` → BKG-13, NOT-07, NOT-12, NOT-13, NOT-14, POR-04, POR-05 (decisions of 2 Oct 2026).

## Global Constraints

- **Statuses:** `PENDING_PAYMENT`, `CONFIRMED`, `COMPLETED`, `NO_SHOW`, `LATE_CANCEL`, `CANCELLED`. The labels shown are "Awaiting payment", "Confirmed", "Completed", "No-show", "Late cancel", "Cancelled" and, computed, **"Unrecorded"** (`CONFIRMED` and `endsAt < now`).
- **Outcomes are recorded by people, never automatically.** A therapist may record their own sessions' outcomes; staff with the view-all right may record any.
- **No-show and late cancel** keep the time closed (unlike Cancelled, which reopens it), keep the payment (refunds are a practice decision outside this plan), and count in reports separately from Completed.
- **Reminder defaults** (practice can switch each one off and change its timing):

| Key | When | To | Optional for the client? |
|---|---|---|---|
| `session_24h` | 24 h before | client | no |
| `session_1h` | 1 h before | client | no |
| `forms_due` | 48 h and 24 h before the client's first session, while default forms are outstanding | client | no |
| `assessment_due` | 2 days after assigning, and the day before the next session, while not completed | client | no |
| `no_show_followup` | when the outcome is recorded as No-show | client | yes |
| `review_request` | 2 hours after the outcome is recorded as Completed | client | yes |
| `rebook_nudge` | N days (default 14) after the last completed session, if no future booking | client | yes |
| `outcome_needed` | 1 hour after the session ends, while Unrecorded | therapist | no |

- **Channels:** client reminders go by **email and in-app** (`channels: { email: true, in_app: true }`), overriding the `reminders` category's email-off default. Optional ones respect the client's `follow_ups` preference (a new category).
- **Dedupe keys:** `reminder:<kind>:<bookingId>:<startsAt ISO>`. A rescheduled booking gets new keys, and the old ones are cancelled.
- **Content:** times are in Africa/Lagos. Session reminders carry the join link (online) or the address (in person, once formats land), and links are full addresses (the email channel already does this).
- **Tests:** API specs use Prisma stand-ins; app tests use `renderWithApp`. Run with `--maxWorkers=2 --minWorkers=1`. Migrations are generated with `prisma migrate diff`.

## Review Focus

1. **A session rescheduled from Tuesday to Thursday.** Tuesday's reminders never fire, and Thursday's are queued.
2. **A session booked 30 minutes before it starts.** No 24 h reminder (its time is in the past); the 1 h reminder is skipped too, since it would fire immediately for a session starting soon.
3. **A booking cancelled after its reminders were queued.** None fire.
4. **A client who turned off follow-ups.** Session reminders still arrive; review requests and rebook nudges don't.
5. **The outcome changed from No-show to Completed (a correction).** The no-show follow-up, if not yet sent, is cancelled; the review request is queued.

---

## File Structure

- `prisma/schema.prisma` and its migration: `Tenant.reminderSettings Json?`, `ConsultBooking.outcomeRecordedAt DateTime?`, `outcomeRecordedByProfileId BigInt?`.
- `apps/api/src/common/session-status.ts` (new): `STATUSES`, `displayStatus(b, now)`, `isUnrecorded(b, now)`, `OUTCOMES`.
- `apps/api/src/modules/consult/session-directory.service.ts`: `setStatus` accepts the new outcomes, with rules.
- `apps/api/src/modules/consult/consult.controller.ts`: the accepted statuses.
- `apps/api/src/modules/notifications/session-reminder.service.ts` (new): `schedule(bookingId)`, `cancel(bookingId)`, `onOutcome(bookingId, outcome)`, `sweep()` (the outcome-needed and rebook-nudge passes).
- The callers that schedule reminders: `BookingNotifier.confirmed`, `booked` (when it's confirmed at once), the reschedule service, cancellation paths, and the outcome recording.
- `apps/api/src/modules/tenant/tenant.service.ts`: reminder settings read and write; `/v1/tenant/reminders` GET/PATCH.
- **App:**
  - `pages/practice/SessionDetailPage.tsx` and `SessionsPage.tsx` (outcome buttons, Unrecorded badge);
  - `DashboardPage.tsx` (an "Unrecorded sessions" card);
  - `pages/practice/settings/RemindersSettingsPage.tsx` (new; under Settings → Scheduling & pricing);
  - the client notification preferences (a follow-ups toggle);
  - `pages/client/*` ("Book a session", "Add to calendar");
  - `pages/public/booking/AddToCalendar.tsx` (extracted from `ConfirmationStep`).

---

### Task 1: Statuses and the Unrecorded rule

**Files:** `apps/api/src/common/session-status.ts`, `session-status.spec.ts`; schema and migration (`outcomeRecordedAt`, `outcomeRecordedByProfileId`, `Tenant.reminderSettings`).

**Interfaces:**

```ts
export const OUTCOMES = ['COMPLETED', 'NO_SHOW', 'LATE_CANCEL'] as const;
export type Outcome = (typeof OUTCOMES)[number];
export type DisplayStatus = 'AWAITING_PAYMENT' | 'CONFIRMED' | 'UNRECORDED' | 'COMPLETED' | 'NO_SHOW' | 'LATE_CANCEL' | 'CANCELLED';
export function displayStatus(b: { status: string; endsAt: Date }, now?: Date): DisplayStatus;
export function isUnrecorded(b: { status: string; endsAt: Date }, now?: Date): boolean;
```

- [ ] **Step 1: Failing tests:**
  - `CONFIRMED` ending 1 minute ago → `UNRECORDED`;
  - `CONFIRMED` ending in an hour → `CONFIRMED`;
  - `PENDING_PAYMENT` → `AWAITING_PAYMENT`;
  - `NO_SHOW` and `LATE_CANCEL` pass through.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Add the schema fields by hand, generate the migration with `prisma migrate diff`, and run `prisma generate`.
- [ ] **Step 4:** Run. Expected: PASS; `tsc` 0 errors.
- [ ] **Step 5:** Commit `"BKG-13: session outcomes and the Unrecorded rule"`.

### Task 2: Recording an outcome (API)

**Files:**
- `session-directory.service.ts` (`setStatus`), `consult.controller.ts` (line ~340, the accepted statuses), `consult.service.ts` (`updateBookingStatus`, the therapist route);
- the session views (`getSessions`, session detail) add `displayStatus`;
- tests: extend `session-directory.spec.ts`.

**Rules:**
- An outcome (`COMPLETED`, `NO_SHOW`, `LATE_CANCEL`) can be recorded only once the session has started ("You can record what happened once the session has started.") and only from `CONFIRMED` or another outcome (corrections allowed).
- It sets `outcomeRecordedAt` and `outcomeRecordedByProfileId`.
- **Completed** keeps today's note prompt. **No-show** and **Late cancel** keep the time closed.
- Therapists may record outcomes on their own sessions; staff with view-all on any.
- After recording: `SessionReminderService.onOutcome(bookingId, outcome)` (Task 4; until then a no-op stub, ledgered).

- [ ] **Step 1: Failing tests:**
  - a therapist records No-show on their past session, and it's stored with who and when;
  - recording before the start is refused;
  - Late cancel doesn't reopen the time, while Cancelled still does;
  - a therapist can't record on another therapist's session;
  - a correction from No-show to Completed is allowed;
  - views return `displayStatus: 'UNRECORDED'` for a past `CONFIRMED` session.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the API suite.
- [ ] **Step 5:** Commit `"BKG-13: therapists record Completed, No-show or Late cancel"`.

### Task 3: Unrecorded in the app

**Files:**
- `SessionDetailPage.tsx`: for a started session, an "Outcome" block with three buttons (Completed, No-show, Late cancel); after recording, it shows "Recorded by Jane, 3:12 PM" and "Change".
- `SessionsPage.tsx`: badges from `displayStatus`, and a filter "Unrecorded".
- `DashboardPage.tsx`: a card "Unrecorded sessions (3)" listing each with quick outcome buttons. It's hidden when there are none.
- Shared `apps/app/src/components/SessionStatusBadge.tsx`, using the labels in Global Constraints.
- Tests: extend `SessionDetailPage.test.tsx` and `SessionsPage.test.tsx`; dashboard test.

- [ ] **Step 1: Failing tests:**
  - a past `CONFIRMED` session shows "Unrecorded" and the three buttons;
  - clicking No-show PATCHes `status: 'NO_SHOW'` and then shows "No-show · Recorded by …";
  - the Sessions filter "Unrecorded" lists only those;
  - the dashboard card shows the count.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the app suite. Check 390px and 1280px.
- [ ] **Step 5:** Commit `"BKG-13: Unrecorded sessions show on the dashboard and session pages, with one-tap outcomes"`.

### Task 4: Client reminders (NOT-07)

**Files:**
- `apps/api/src/modules/notifications/session-reminder.service.ts`, `session-reminder.spec.ts`;
- `notification.module.ts` (provide and export);
- the callers listed in File Structure;
- `apps/api/src/modules/tenant/reminder-settings.ts` (defaults and validation) and the `/v1/tenant/reminders` routes;
- a `follow_ups` preference category in `notification.service.ts` (`PreferenceCategory`), whose defaults are on for email and in-app.

**Interfaces:**

```ts
export type ReminderKind = 'session_24h' | 'session_1h' | 'forms_due' | 'assessment_due' | 'no_show_followup' | 'review_request' | 'rebook_nudge' | 'outcome_needed';
export interface ReminderSettings { [K in ReminderKind]?: { enabled: boolean; offsetHours?: number; afterDays?: number } }
export const DEFAULT_REMINDERS: Required<Record<ReminderKind, { enabled: boolean; offsetHours?: number; afterDays?: number }>>;
class SessionReminderService {
  schedule(bookingId: bigint): Promise<void>;          // after a booking is confirmed or rescheduled
  cancel(bookingId: bigint): Promise<void>;            // on cancel and before re-scheduling
  onOutcome(bookingId: bigint, outcome: Outcome): Promise<void>;
  sweep(now?: Date): Promise<void>;                    // @Cron every 15 minutes: outcome_needed, rebook_nudge, assessment_due
}
```

Behaviour:
- `schedule`:
  - loads the booking (start time, client, therapist, tenant, settings) and cancels any reminders for this booking with other start times;
  - for each enabled pre-session kind whose trigger time is still in the future (more than 5 minutes ahead), queues `queueReminder({ tenantId, profileId: client, type: 'bookings.reminder_24h', title: 'Your session is tomorrow', message, link, actionLabel, preferenceCategory: 'reminders', channels: { email: true, in_app: true }, triggerAt }, key)`;
  - **message:** "Individual Therapy with Jane Smith, Tuesday 6 October at 11:30.";
  - **link:** the in-app room or the join link for online; the portal session otherwise.
- `forms_due` is queued only when `pendingFormsFor(...)` is non-empty at scheduling. `sweep` (every 15 minutes) cancels any queued `forms_due` reminder whose client has since completed the forms.
- `onOutcome`:
  - **No-show:** cancels any queued `review_request` for the booking and queues `no_show_followup` now (category `follow_ups`), saying "We missed you today" with a rebook link to the practice's `/book`;
  - **Completed:** cancels `no_show_followup` and queues `review_request` 2 hours later (category `follow_ups`), linking to the practice's review form, if one is active.
- `sweep`:
  - `outcome_needed`: past sessions (ended more than 1 hour ago) still `CONFIRMED`; notifies the therapist once per booking (dedupe key);
  - `rebook_nudge`: clients whose last completed session ended `afterDays` ago with no future booking;
  - `assessment_due`: assignments `SENT` 2 days ago, or whose client's next session is tomorrow.

- [ ] **Step 1: Failing tests:**
  - booking confirmed 3 days ahead: queues `session_24h` and `session_1h` at the right times, with both channels;
  - rescheduled: old keys cancelled, new ones queued (Review Focus 1);
  - booked 30 minutes ahead: no reminders (Review Focus 2);
  - cancelled: all cancelled (Review Focus 3);
  - a practice that turned `session_1h` off: only 24 h is queued;
  - No-show queues the follow-up, and a later correction to Completed cancels it and queues the review (Review Focus 5);
  - follow-up kinds use category `follow_ups`, and a client with that category off gets nothing (Review Focus 4; asserted through `notify`'s preference resolution in `notification.service.spec.ts`);
  - `sweep` notifies the therapist once for an unrecorded session ended 2 hours ago, never twice;
  - `forms_due` is cancelled by the sweep once the forms are complete.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Wire `schedule` and `cancel` into every confirm, reschedule and cancel path; find them with `grep -rn "status: 'CANCELLED'\|confirmed(\|reschedule" apps/api/src/modules/consult apps/api/src/modules/billing`. `BookingPaymentSettler` confirms through `BookingNotifier.confirmed`, so hooking `confirmed()` covers paid bookings.
- [ ] **Step 4:** Run the API suite.
- [ ] **Step 5:** Commit `"NOT-07: clients get session, form and assessment reminders; follow-ups after no-shows and completed sessions"`.

### Task 5: Reminder settings and the client's follow-ups toggle

**Files:**
- `pages/practice/settings/RemindersSettingsPage.tsx` (route `/dashboard/settings/reminders`, menu item under Scheduling & pricing);
- the client's notification preferences (portal My details): "Follow-ups and review requests", on or off;
- tests.

- [ ] **Step 1: Failing tests:**
  - the page lists each reminder with its switch and timing (24 hours / 1 hour / 2 days / 14 days), and saving PATCHes `/v1/tenant/reminders`;
  - the client toggle PATCHes the `follow_ups` preference;
  - session reminders aren't offered as switchable to clients.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the app suite.
- [ ] **Step 5:** Commit `"NOT-07: practices tune reminders; clients can turn off follow-ups"`.

### Task 6: Book from the portal, and "Add to calendar" there (POR-04, POR-05)

**Files:**
- `apps/app/src/pages/public/booking/AddToCalendar.tsx` (extract the confirmation's dropdown: Google Calendar link, Apple/Outlook `.ics` via `/v1/calendar/bookings/:id/ical?token=…`);
- `ConfirmationStep.tsx` uses it;
- the portal Home and Sessions pages: a "Book a session" button linking to the practice's `/book` (the wizard is already signed in on the same host), and `AddToCalendar` on each upcoming session;
- tests.
- **API:** the portal's upcoming sessions include `icalToken` (`CalendarService.icalToken(bookingId)`), as the booking response already does.

- [ ] **Step 1: Failing tests:**
  - the portal Home shows "Book a session", linking to `/book`;
  - each upcoming session shows "Add to calendar" with a Google link (the right title, dates and details) and an `.ics` link carrying its token;
  - the confirmation step still renders the same dropdown;
  - the API portal sessions include `icalToken`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run both suites.
- [ ] **Step 5:** Commit `"POR-04/05: book a session and add sessions to a calendar from the portal"`.

### Task 7: Clients choose their reminders, including right after booking (NOT-13)

**Files:**
- **Schema:**
  - `ClientReminderPreference { id, tenantId, profileId, offsetsMinutes Int[] (default [1440, 60]), email Boolean @default(true), inApp Boolean @default(true), followUps Boolean @default(true) }`, `@@unique([tenantId, profileId])`;
  - `ConsultBooking.reminderOffsetsMinutes Int[]` (empty means "use my preference").
- **API:**
  - `GET/PUT /v1/consult/public/reminder-preference` (the signed-in client, this practice);
  - `PUT /v1/consult/public/bookings/:id/reminders` with `{ offsetsMinutes: number[]; applyToAll?: boolean }`;
  - `SessionReminderService.schedule` reads, in order: booking offsets, then client preference, then practice settings; the channels come from the client preference.
- **App:**
  - the booking wizard's `ConfirmationStep`: a "Remind me" block with three toggles (1 day, 2 hours, 30 minutes before), pre-set from the client's preference, plus "Use these for all my sessions";
  - the portal **My details**: "Reminders and notifications" (which reminders, how long before, email or in-app, follow-ups on or off);
  - each upcoming session in the portal: "Reminders: 1 day and 2 hours before · Change".
- **Tests:** API spec for the order of precedence and validation (offsets between 15 minutes and 7 days, at most 3); wizard and portal tests.

- [ ] **Step 1: Failing tests:**
  - with no client choices, the practice's 24 h and 1 h are queued;
  - a client preference of 2 hours only replaces them for all their sessions;
  - a booking-level choice of 30 minutes wins for that booking only;
  - turning email off sends in-app only;
  - an offset of 2 minutes or 8 days is refused;
  - the confirmation's "Remind me" saves the booking's offsets, and "Use these for all" also updates the preference;
  - changing a session's reminders in the portal re-schedules them (the old ones are cancelled).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run both suites.
- [ ] **Step 5:** Commit `"NOT-13: clients choose their reminders, for one session or all of them, right after booking or in the portal"`.

### Task 8: Practices see a session's reminders and can send one now (NOT-14)

**Files:**
- **API:**
  - `GET /v1/consult/practice/sessions/:id/reminders`: the queued and sent `NotificationDispatch` rows for that booking (matched by dedupe key prefix `reminder:%:<bookingId>:`), with kind, when and status;
  - `POST /v1/consult/practice/sessions/:id/reminders/send`: sends the session reminder now (template `session_reminder`), at most once every 10 minutes per booking ("A reminder was just sent.");
- **App:** `SessionDetailPage.tsx`, a "Reminders" card: the list ("1 day before · Mon 5 Oct, 11:30 · Scheduled", "Sent", "Cancelled") and **Send a reminder now**.
- **Tests:** API spec (tenant and actor scoping; the 10-minute guard); page test.

- [ ] **Step 1: Failing tests:**
  - the list shows only this booking's reminders, never another tenant's;
  - "Send now" queues a dispatch with `triggerAt` now and both channels;
  - a second send within 10 minutes is refused;
  - a therapist can see and send only for their own sessions;
  - the card renders the list and the button.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run both suites.
- [ ] **Step 5:** Commit `"NOT-14: the session page shows its reminders and can send one now"`.

### Task 9: Practices edit the wording of every email they send (NOT-12)

**Files:**
- `apps/api/src/modules/notifications/templates/registry.ts` (new): `MESSAGE_TEMPLATES`: for each key, a group (Bookings, Payments, Reminders, Forms & assessments, Follow-ups), a description, `placeholders`, and defaults for `subject`, `intro` and `actionLabel`. The keys cover every practice-to-client email in the code today; find them with `grep -rn "sendEmail({\|queueReminder(" apps/api/src/modules | grep -v spec`. Examples: `booking_confirmed`, `payment_due`, `hold_released`, `payment_refunded`, `transfer_details`, `session_reminder_24h`, `session_reminder_1h`, `forms_due`, `assessment_sent`, `assessment_due`, `no_show_followup`, `review_request`, `rebook_nudge`, `session_recap`. Auth and platform emails are **not** in the registry.
- `apps/api/src/modules/notifications/templates/message-composer.service.ts` (new): `compose(tenantId, key, values) → { title, message, actionLabel }`. It reads `MessageTemplateOverride { tenantId, key, subject?, intro?, actionLabel? }` (new model, `@@unique([tenantId, key])`), fills `{{placeholders}}` (unknown placeholders stay visible as text, never errors), and escapes nothing (the email channel already escapes).
- **Senders:** `BookingNotifier`, `ManualPaymentService`, `SessionReminderService`, the assessments and intake senders, and the session recap sender all call `composer.compose(...)` for title, message and button label, keeping their `details` and `links`. Copy moves from inline strings into the registry, unchanged in wording.
- **API:** `GET /v1/tenant/messages` (the registry with this practice's values and the defaults), `PUT /v1/tenant/messages/:key`, `DELETE /v1/tenant/messages/:key` (reset), `POST /v1/tenant/messages/:key/preview` (renders sample values through the real email channel `render`, returning HTML). Owners and admins only.
- **App:** `pages/practice/settings/MessagesSettingsPage.tsx` (route `/dashboard/settings/messages`, menu "Emails & reminders" under Scheduling & pricing, next to Reminders), which shows:
  - the templates grouped as in the registry;
  - for each one: subject, opening line and button fields, the placeholder chips (click to insert), a live preview, Save and "Reset to default".
- **Tests:** composer spec (an override wins; placeholders filled; an unknown placeholder is left as is; another tenant's override never applies); a registry spec that every key used by senders exists (scan the senders' `compose('...')` keys); senders' specs keep passing with unchanged default wording; page test.

- [ ] **Step 1: Failing tests** (composer, registry coverage, the settings page).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the registry and composer, then move each sender onto it one file at a time. Their existing tests must stay green with the same default wording.
- [ ] **Step 4:** Run both suites.
- [ ] **Step 5:** Commit `"NOT-12: practices edit the wording of every email they send, with placeholders, preview and reset"`.

### Task 10: Browser check and the testing sheet

- [ ] **Step 1:** On a copy of the local database with log-only email: confirm a booking 25 hours ahead; check that `NotificationDispatch` holds the 24 h and 1 h reminders; move the 24 h `triggerAt` to now; within 30 seconds the logged email shows; reschedule, and the old rows show `CANCELLED`.
- [ ] **Step 2:** End a session, wait (or move `endsAt`): the dashboard shows it as Unrecorded and the therapist gets the outcome-needed notification once. Record No-show: the follow-up email is logged. Correct to Completed: the review request is queued 2 hours later.
- [ ] **Step 3:** As the client: book from the portal, and use "Add to calendar" (Google opens prefilled; the `.ics` downloads).
- [ ] **Step 4:** As the client, set "2 hours before" after booking and check the queued reminders; in the portal, switch reminders to in-app only. As the practice, open the session's Reminders card and send one now; edit the confirmation email's opening line, preview it, book again, and check the logged email uses the new wording; reset it.
- [ ] **Step 5:** In `docs/testing-feedback.md`, set BKG-13, NOT-07, NOT-12, NOT-13, NOT-14, POR-04 and POR-05 to **Fixed**, with commits and what was seen. Commit.
