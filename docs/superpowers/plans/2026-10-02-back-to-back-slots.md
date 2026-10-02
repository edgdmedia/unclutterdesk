# Back-to-Back Slots for Longer Services Implementation Plan (SET-11)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A service longer than one slot can still be booked: it takes as many back-to-back slots as it needs. Clients see only start times where enough slots are free, shown with the real end time ("9:00 – 10:20").

**Architecture:**
- **One rules function decides which slots a session needs:** `chainFor(slots, firstSlot, durationMinutes, format, gapMinutes)` in `apps/api/src/modules/consult/slot-chain.ts`. Public availability, booking, staff booking, reschedule and payment re-claims all use it.
- **Bookings record every slot they hold:** a new `BookingSlot` join table. The booking keeps `availabilityId` as its first slot, so nothing that reads it breaks, and gains `sessionEndsAt` for the real end time.
- **One helper claims and one releases all of a booking's slots,** replacing every place that flips a single slot's `isActive`.

**Tech Stack:** NestJS, Prisma, React, vitest.

**Spec:** `docs/testing-feedback.md` → SET-11 (decided 2 Oct 2026, approved to build). It builds on the session formats and locations work (`docs/superpowers/plans/2026-10-02-session-formats-and-locations.md`), whose Tasks 1–6 are on `dev`.

## Global Constraints

- **The slot is the unit.** Its length is the availability length (for example 50 minutes), and slots are separated by the therapist's gap (for example 10 minutes).
- **A session fits in one slot** when `durationMinutes <= slot length`; it takes only that slot, as today.
- **A longer session** starting at slot S takes S and the next slots of **the same therapist**, in time order, until the session's end is covered: `S.startsAt + durationMinutes <= last.endsAt`. Every slot in the chain must be:
  - **active** (free);
  - **adjacent:** each next slot starts no later than the previous slot's end plus the therapist's gap (no hole such as lunch);
  - **in the right format:** each allows the chosen format;
  - **at the same place:** for in person, all at the same location.
- **The session ends at `S.startsAt + durationMinutes`** (stored as `ConsultBooking.sessionEndsAt`), not at the last slot's end. Shown to everyone as "9:00 – 10:20".
- **Formats offered at a start time** are the intersection of the chain's formats, still limited by the therapist and the service (formats rules 1–2).
- **Claiming is all-or-nothing:** in one transaction, `updateMany({ where: { id: { in: chainIds }, isActive: true }, data: { isActive: false } })` must return the chain's length; otherwise the transaction rolls back with "The selected time slot is no longer available" (the wizard's slot-taken path).
- **Releasing frees every slot the booking holds,** except slots `createdForBooking` (as today).
- **Old bookings** (no `BookingSlot` rows) behave as single-slot bookings: the helpers fall back to `availabilityId`.
- **Tests:** API specs use Prisma stand-ins; app tests use `renderWithApp`. Run with `--maxWorkers=2 --minWorkers=1`. Migrations are generated with `prisma migrate diff`.

## Review Focus

1. **Two clients race for overlapping chains** (an 80-minute session at 9:00 and a 50-minute one at 10:00): exactly one wins; the loser gets "no longer available" and nothing is half-claimed.
2. **A lunch break:** a 9:00–12:00 morning and 14:00–17:00 afternoon; an 80-minute session can't start at 11:00 (the chain would cross the break).
3. **A chain whose second slot is online-only** while the client chose in person: that start time isn't offered for in person, but is still offered online if both slots allow it.
4. **An 80-minute booking cancelled, or its payment hold released:** both slots reopen; a later late payment re-claims both or refunds (BKG-09).
5. **Rescheduling an 80-minute session:** the old two slots reopen; the new chain is claimed atomically.

---

## File Structure

- `prisma/schema.prisma` and its migration: `BookingSlot { bookingId BigInt, availabilityId BigInt, @@id([bookingId, availabilityId]), @@index([availabilityId]) }` with relations; `ConsultBooking.sessionEndsAt DateTime?`.
- `apps/api/src/modules/consult/slot-chain.ts` (new, pure): `chainFor(...)`, `startTimesFor(...)`.
- `apps/api/src/modules/consult/booking-slots.ts` (new): `claimChain(tx, tenantId, ids)`, `releaseBookingSlots(tx, tenantId, bookingId)`, `slotIdsOf(tx, bookingId)`.
- **Modify:**
  - `consult.service.ts`: `getPublicAvailability`, `createBooking`, `restartOnlinePayment` (re-claim), `rescheduleBooking`;
  - `staff-booking.service.ts` (`resolveTime` and claim);
  - `session-directory.service.ts` (`rescheduleByStaff`, cancel);
  - `consult.cron.ts` (release);
  - `billing/booking-payment-settler.service.ts` (re-claim);
  - every other place that sets a slot active or inactive for a booking. Find them with `grep -rn "consultAvailability.updateMany" apps/api/src/modules | grep -v spec` and route each one through the helpers.
- **Views and emails** (session lists, session detail, portal, `BookingNotifier`, calendar/ICS): the end time comes from `sessionEndsAt ?? availability.endsAt`.
- **App:** `pages/public/booking/TimeStep.tsx`, `ReviewPayStep.tsx`, `ConfirmationStep.tsx` show "9:00 – 10:20" for multi-slot sessions (from the API's `endsAt`).

---

### Task 1: Data model

**Files:** `prisma/schema.prisma`; the migration `2026100xxxxxxx_booking_slots` (timestamp after the latest on `dev`), generated with `prisma migrate diff`. Add a backfill in the same migration: `INSERT INTO "BookingSlot" ("bookingId","availabilityId") SELECT id, "availabilityId" FROM "ConsultBooking"` and `UPDATE "ConsultBooking" b SET "sessionEndsAt" = a."endsAt" FROM "ConsultAvailability" a WHERE a.id = b."availabilityId"`.

- [ ] **Step 1:** Edit the schema by hand; generate the migration; append the backfill SQL; run `prisma migrate deploy` on a copy of the local database and check that the `BookingSlot` count equals the bookings count.
- [ ] **Step 2:** `prisma generate`; `npx tsc --noEmit -p .` gives 0 errors.
- [ ] **Step 3:** Commit `"SET-11: bookings can hold several back-to-back slots, and record when the session really ends"`.

### Task 2: The chain rules (pure)

**Files:** `apps/api/src/modules/consult/slot-chain.ts`, `slot-chain.spec.ts`.

**Interfaces:**

```ts
export interface ChainSlot { id: bigint; providerProfileId: bigint; startsAt: Date; endsAt: Date; isActive: boolean; formats: Format[]; locationId: bigint | null }
/** The slots a session starting at `first` needs, or null when it can't be done. */
export function chainFor(slots: ChainSlot[], first: ChainSlot, durationMinutes: number, gapMinutes: number, format?: Format): ChainSlot[] | null;
/** For each slot that can start this service, the formats possible across its chain and the session end. */
export function startTimesFor(slots: ChainSlot[], durationMinutes: number, gapMinutes: number): Array<{ first: ChainSlot; chain: ChainSlot[]; formats: Format[]; endsAt: Date }>;
```

- [ ] **Step 1: Failing tests** (slots 9:00, 10:00, 11:00, 14:00, 15:00, 50 minutes each, 10-minute gap):
  - a 50-minute service at 9:00 gives a chain of [9:00] ending 9:50;
  - 80 minutes at 9:00 gives [9:00, 10:00] ending 10:20;
  - 80 minutes at 11:00 gives null (the chain would cross the lunch break; Review Focus 2);
  - 80 minutes when 10:00 is taken (inactive) gives null at 9:00;
  - 9:00 both formats and 10:00 online-only give `formats` ['ONLINE'] for the chain, so in person is null (Review Focus 3);
  - in person across two different locations gives null;
  - another therapist's 10:00 never joins the chain;
  - a slot already longer than the service gives a chain of one;
  - `startTimesFor` lists 9:00, 10:00 and 14:00 for 80 minutes, with the right ends.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement: sort the therapist's slots by `startsAt`; walk forward from `first` while the cover is short; stop on a gap greater than `gapMinutes`, an inactive slot, an incompatible format or location. `formats` is the intersection.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `"SET-11: one rules function decides which back-to-back slots a longer session needs"`.

### Task 3: Claiming and releasing all of a booking's slots

**Files:** `apps/api/src/modules/consult/booking-slots.ts`, `booking-slots.spec.ts`; then route every slot flip through it.

**Interfaces:**
- `claimChain(tx, tenantId, ids: bigint[]): Promise<void>`: throws `BadRequestException('The selected time slot is no longer available')` unless all are claimed.
- `releaseBookingSlots(tx, tenantId, bookingId): Promise<void>`: reopens every `BookingSlot` slot except `createdForBooking` ones (falls back to `availabilityId` when there are no rows).
- `slotIdsOf(tx, bookingId): Promise<bigint[]>`.

- [ ] **Step 1: Failing tests:**
  - claiming 2 of 2 succeeds;
  - when one is already taken, it throws and the transaction rolls back (assert the `updateMany` count check);
  - release reopens both, but not a `createdForBooking` slot;
  - an old booking with no rows releases its `availabilityId`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the helpers. Then replace each single-slot flip found by the grep in File Structure: the expiry job, cancellations (client, staff, outcome Cancelled), the settler's re-claim, `restartOnlinePayment`'s re-claim, and reschedules. Each replacement keeps its existing test green, plus one new test per path with an 80-minute booking (Review Focus 4).
- [ ] **Step 4:** Run the API suite.
- [ ] **Step 5:** Commit `"SET-11: every place that claims or frees a booking's time handles all its slots"`.

### Task 4: Public availability and booking use chains

**Files:** `consult.service.ts` (`getPublicAvailability`, `createBooking`); `booking-formats.spec.ts` and a new `booking-chains.spec.ts`.

- **`getPublicAvailability`:**
  - replace `longEnough` with `startTimesFor`, using the therapist's `gapMinutes` (on `ConsultTherapistProfile` since formats Task 1);
  - return one entry per possible start, with `endsAt` = the session end and `formats` = the chain's formats (then the existing rules 1–2 filters);
  - a `format` query keeps only starts whose chain allows it.
- **`createBooking`:**
  - recompute the chain for the chosen first slot with the chosen format;
  - in the transaction, `claimChain`, create the booking with `availabilityId` = first and `sessionEndsAt`, and insert `BookingSlot` rows;
  - the price and the rest are unchanged.

- [ ] **Step 1: Failing tests:**
  - an 80-minute service lists 9:00 ("ends 10:20"), not 11:00;
  - booking 9:00 claims 9:00 and 10:00 and stores both `BookingSlot` rows and `sessionEndsAt` 10:20;
  - a concurrent booking of 10:00 then fails, and vice versa (Review Focus 1, simulated with the `updateMany` count);
  - a 50-minute booking still claims one slot;
  - choosing in person where the chain is online-only is refused.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the API suite.
- [ ] **Step 5:** Commit `"SET-11: longer services can be booked across back-to-back slots"`.

### Task 5: Staff booking and reschedule

**Files:** `staff-booking.service.ts` (`resolveTime`: for a chosen slot, use `chainFor`; a custom time is unchanged), `consult.service.ts` (`rescheduleBooking`), `session-directory.service.ts` (`rescheduleByStaff`), and their specs.

- [ ] **Step 1: Failing tests:**
  - staff booking an 80-minute service at a slot claims the chain;
  - rescheduling an 80-minute booking frees the old two slots and claims the new two in one transaction (Review Focus 5);
  - a reschedule target that can't fit is refused with "That time is too short for this session. Choose another." and nothing changes.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the API suite.
- [ ] **Step 5:** Commit `"SET-11: staff booking and rescheduling handle longer sessions"`.

### Task 6: Real end times everywhere

**Files:** the session views (`session-directory.service.ts`, the portal bookings in `consult.service.ts`), `booking-notifier.service.ts`, `calendar.service.ts` (Google event and `.ics` end), the app's `TimeStep.tsx`, `ReviewPayStep.tsx`, `ConfirmationStep.tsx`, `bookingSlots.ts` (`rangeLabelWAT(start, end)`), the session pages; tests.

- [ ] **Step 1: Failing tests:**
  - API views return `endsAt` = `sessionEndsAt` for an 80-minute booking;
  - the `.ics` DTEND is 10:20;
  - the time tile reads "9:00 – 10:20 AM" for a multi-slot start (and only the start time for single-slot ones, as today);
  - the summary and confirmation show the range.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run both suites.
- [ ] **Step 5:** Commit `"SET-11: sessions show their real end time across the app, emails and calendars"`.

### Task 7: Browser check and the testing sheet

- [ ] **Step 1:** On a copy of the local database:
  - give Couples Therapy 80 minutes;
  - set Monday 9:00–12:00 and 14:00–17:00 (50 + 10).
- [ ] **Step 2:** As a client, Couples Therapy shows 9:00 – 10:20, 10:00 – 11:20, 14:00 – 15:20 and 15:00 – 16:20, and no 11:00. Book 9:00; Individual Therapy then no longer offers 9:00 or 10:00.
- [ ] **Step 3:** Cancel it: both times come back. Reschedule a booking: old times free, new ones taken.
- [ ] **Step 4:** In `docs/testing-feedback.md`, set SET-11 to **Fixed**, with commits and what was seen. Commit.
