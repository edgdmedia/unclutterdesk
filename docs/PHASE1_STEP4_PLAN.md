# Phase 1, step 4: practice-created bookings and emergency contact

Detailed plan for step 4 of `docs/PHASE1_PLAN.md`. It is written against the code
as it stands on `dev` (27 Sep 2026).

## What exists today

- **Bookings are client-created only.** `ConsultService.createBooking`
  (`apps/api/src/modules/consult/consult.service.ts:523`) is the one path in. It:
  - claims an open `ConsultAvailability` slot with a conditional `updateMany`,
    which is the double-booking guard;
  - finds or creates the client by email;
  - settles the price (with discount), applies the Starter monthly limit;
  - then starts Paystack, a manual transfer hold, or confirms a free booking.
- **Every booking needs a slot row** (`availabilityId` is required), and the
  practitioner comes from the slot (`availability.providerProfileId`). A custom
  time therefore has to create its own slot row.
- **Unpaid online bookings are cancelled after 30 minutes**
  (`consult.cron.ts`, `ONLINE_HOLD_MS`). A staff booking that emails a payment
  link would be cancelled long before the client opens their email.
- **Paystack webhook** (`billing.service.ts:450`) confirms by `paymentRef` and
  pushes to Google Calendar. No client email is sent on confirmation.
- **Emergency contact is a stub.** `POST /v1/tenant/clients` accepts
  `emergency`, echoes it back, and never stores it. The client page shows it in
  an amber box, which is always empty after a reload. This is a bug in its own
  right: staff type it in and it is lost.
- **Data export** (`privacy/data-export.service.ts`) has an `about` block for
  the client's own details.

## Design

### A. Emergency contact (small, ship first)

**Schema.** Three nullable columns on `Profile`, with one migration:
- `emergencyContactName` (VarChar 120);
- `emergencyContactRelationship` (VarChar 60);
- `emergencyContactPhone` (VarChar 40).

Columns on `Profile` rather than a separate table: one contact per client is
what Consult had and what the brief asks for.

**API.**
- `POST /v1/tenant/clients` stores the fields. It accepts the new structured
  fields, and keeps accepting the legacy `emergency` string, saved as the name,
  so older app builds keep working.
- New `PATCH /v1/tenant/clients/:profileId` (STAFF). It edits name, phone and
  the emergency fields. Scoped to `tenantId` and `role: 'CLIENT'`, so it can
  never edit a staff profile.
- `GET clients/:profileId` (already CLINICAL) returns `emergencyContact:
  { name, relationship, phone } | null`.
- The list endpoint (`GET clients`, STAFF, so receptionists too) does **not**
  return it. That matches "staff with clinical access can see them".
- Data export: add `emergencyContact` to `about`. Right to erasure: clear the
  three fields in `privacy.service` erase.

**App.**
- **ClientsPage:** the "new client" form gets three fields in place of the one
  `emergency` box.
- **ClientDetailPage:**
  - the amber box shows name, relationship and a `tel:` link;
  - it shows "Not recorded" when empty;
  - it has an edit button that opens a small form.

**Tests.**
- Create stores the fields, and legacy `emergency` still maps.
- PATCH refuses a staff profile and another tenant's client.
- The list omits the contact.
- The export includes it; erasure clears it.

### B. Practice-created bookings

#### Schema (one migration)

`ConsultBooking` gains:
- `createdByProfileId BigInt?`: null means the client booked. Used for audit and
  in the UI ("Booked by Ade").
- `paymentMethod` gets a new value, `"NONE"`, for a practice-waived booking. It
  keeps the existing `"PAYSTACK"` and `"MANUAL"`. The column is a free-text
  `VarChar(20)`, so there is no enum change.

`holdExpiresAt` is reused for online staff bookings (see "Hold" below).

#### Payment options

| Choice in the UI | status | paymentMethod | amountKobo | Other fields |
|---|---|---|---|---|
| Send a payment link | `PENDING_PAYMENT` | `PAYSTACK` | service price | `holdExpiresAt` set; link emailed |
| Mark as paid (cash or transfer already received) | `CONFIRMED` | `MANUAL` | service price, or an amount staff enter | `paidAt = now`, `paymentConfirmedByProfileId = actor` |
| No charge | `CONFIRMED` | `NONE` | `0` | none |

- A free service (price 0) always confirms, whatever the choice.
- Discount codes are **not** offered to staff. A staff-entered amount on "mark
  as paid" covers the same need, and is capped at the service price.
- Revenue: check `chargedKobo()` and `dashboard-revenue` treat
  `amountKobo = 0n` as zero, not as a missing value that falls back to the
  service price. A `||` there would show a no-charge session as full revenue.
  Add a test either way.

#### Hold for "send a payment link"

- `holdExpiresAt = min(now + 48h, session start − 2h)`.
- If that is already in the past (a session in under 2 hours), refuse the
  "payment link" option. The page tells staff to use mark-as-paid or no charge.
- **Cron change:** the online branch of `handleBookingExpiry` becomes:
  - expire when `holdExpiresAt < now` if it is set;
  - otherwise, when `createdAt` is older than 30 minutes, the current rule.

  Public bookings never set `holdExpiresAt` for online payment, so their
  behaviour does not change.
- When a hold lapses, the slot is released as today.
- Nice to have (can slip to later): email the client and practitioner that the
  hold lapsed.

#### Payment link

A Paystack `authorization_url` must not be emailed directly: it is single-use
and can go stale.

- The email links to `https://<practice>/pay/<bookingId>?t=<token>`.
- `t` is an HMAC of the booking id, the same pattern as
  `CalendarService.icalToken`.
- A new public endpoint, `POST /v1/consult/public/bookings/:id/pay-link`, takes
  the token (not an email) and calls the existing `getBookingPaymentUrl` logic.
  That logic starts a fresh Paystack checkout at the agreed `amountKobo`.
- The new `/pay/:id` page shows the session details and a "Pay ₦X" button. If
  the booking is no longer pending, it says "already paid" or "this booking
  lapsed".
- The existing webhook confirms it; nothing changes there.

#### Picking the time

Two modes in the booking form:
1. **Open slot.** The practitioner's open slots, from the existing
   `GET public/availability?providerProfileId&serviceId`. The server claims the
   slot with the same conditional `updateMany` as public booking.
2. **Custom time.** A date, a start time and the service's duration. The server:
   - takes `pg_advisory_xact_lock(tenantId, providerProfileId)` inside the
     transaction, so two custom bookings for one practitioner are serialised;
   - rejects the time if it overlaps any non-cancelled booking of that
     practitioner ("Ade already has a session 10:00–10:50");
   - **deactivates any open slots that overlap it**, so the public page cannot
     sell the same hour;
   - creates a new `ConsultAvailability` row (`isActive: false`,
     `serviceId` = the chosen service) and books against it.

   The public path also takes the same advisory lock before claiming a slot.
   Otherwise a public claim and a custom booking over an overlapping open slot
   could interleave. That is one line in `createBooking`, and its concurrency
   spec gets a case for it.
3. The custom time must be in the future. It can fall outside the
   practitioner's working hours, which is the point of this mode; the UI shows a
   warning, not a block.

#### Who may do what (server-enforced)

| Role | Book for | Payment choices |
|---|---|---|
| OWNER, ADMIN | any active practitioner in the practice | all three |
| RECEPTIONIST | any active practitioner | all three (they already mark transfers paid) |
| THERAPIST | themselves only; `providerProfileId` is forced to self | payment link or no charge; mark as paid is front desk only, the same as the existing mark-paid endpoint |

Other checks:
- The client must be a `role: 'CLIENT'` profile in the same tenant, with status
  active.
- The practitioner must have an active `ConsultTherapistProfile` in the tenant.
- The service must be active in the tenant, and fit the slot's length (the same
  check as public booking).
- The Starter tier monthly limit applies; staff bookings count the same.

#### Code layout

- **New `consult/staff-booking.service.ts`**, so `consult.service.ts`
  (1,448 lines) does not grow further. It holds `createForClient(actor, dto)`.
- **Shared helpers**, pulled out of `createBooking` and reused by both paths,
  with no change to public behaviour:
  - `resolveService(slot, serviceId)`;
  - `assertWithinTierLimit(tenant)`;
  - `claimSlot(tx, slot)`;
  - `resolveVideoRoomLink` (already separate).
- **Endpoint:** `POST /v1/consult/practice/bookings`, `@Roles(...STAFF)`. Body:
  ```ts
  {
    clientProfileId: string;
    serviceId: string;
    providerProfileId?: string;      // forced to self for THERAPIST
    availabilityId?: string;         // either this…
    startsAt?: string;               // …or a custom time (ISO)
    payment: 'LINK' | 'PAID' | 'NONE';
    amountKobo?: string;             // PAID only, ≤ service price
    note?: string;                   // stored in booking.notes
    notifyClient?: boolean;          // default true
  }
  ```
  It returns the booking row in the same shape as `therapist/bookings`, so the
  schedule can insert it without a refetch.
- **After commit, never failing the booking** (as `announce` does today):
  - LINK: email the client the pay link, service, time and practitioner.
  - PAID or NONE: email a confirmation with the time, video link and `.ics`
    link, then `calendar.pushBookingToGoogle`.
  - `notifyClient: false` skips the email. For example, a booking made during a
    phone call where the client was told directly.
  - Emails use the step 2 mail service, so they go from the practice's verified
    domain when it has one.
- **Mark a pending link booking as paid later.** Cash turns up after a link was
  sent. Widen `ManualPaymentService.markPaid` to accept a `PENDING_PAYMENT`
  booking with `createdByProfileId` set, whatever its method, recording the
  actor. Public Paystack bookings stay excluded, so staff cannot confirm a
  booking a client is in the middle of paying.

#### App

- **New `components/booking/StaffBookingDialog.tsx`**, in four steps on one
  panel:
  1. Client: fixed when opened from a client page, a search box when opened
     from the schedule.
  2. Service and practitioner: practitioner hidden for a therapist.
  3. Time: an "Open slots" or "Custom time" toggle, with a slot list grouped by
     day and a date plus time input for custom.
  4. Payment: three radio cards, the amount for mark as paid, the "Email the
     client" checkbox and a note.
- **Entry points:**
  - a "Book a session" button on ClientDetailPage;
  - a "New booking" button on SchedulePage.
- The schedule and client bookings list show a "Booked by …" line and a
  payment state chip: Awaiting payment (with its expiry), Paid, No charge.
- **New `pages/public/PayBookingPage.tsx`** at `/pay/:bookingId`, on the tenant
  public routes.

#### Tests

- **`staff-booking.spec.ts`:**
  - each payment choice gives the right status, method, amount and hold;
  - a free service always confirms;
  - a therapist cannot book for someone else, or choose mark as paid;
  - a client from another tenant, or a staff profile as the client, is refused;
  - an inactive service is refused;
  - a slot too short for the service is refused;
  - the Starter limit is enforced;
  - "payment link" is refused under 2 hours before the session.
- **Custom time:**
  - an overlap with a booking is refused;
  - overlapping open slots are deactivated;
  - two concurrent custom bookings produce exactly one (extend
    `booking-concurrency.spec.ts`).
- **Cron:**
  - a staff link booking survives past 30 minutes and expires at
    `holdExpiresAt`;
  - public online bookings still expire at 30 minutes.
- **Pay link:**
  - a bad token gives 404;
  - a paid or cancelled booking cannot be paid again;
  - the charge equals `amountKobo`.
- **markPaid:** accepts a pending staff link booking, still refuses a public
  Paystack one.
- **Revenue:** a no-charge booking counts as 0.
- **`client-surface.spec`:** the new practice route is not reachable by
  clients.
- **Browser (playwright, local):**
  - book from a client page with each payment choice;
  - a custom time hides the overlapping public slot;
  - open the pay link, see the amount, and confirm the page handles
    already-paid.

## Order of work

1. **Emergency contact:** schema, API, export and erasure, app, tests. It can
   ship on its own PR, which fixes the lost-data bug sooner.
2. Extract the shared booking helpers from `createBooking`. No behaviour
   change; the existing consult specs must stay green.
3. Schema for `createdByProfileId`. Add `StaffBookingService` and the endpoint
   for open slots and all three payment choices.
4. Custom time: advisory lock, overlap check, slot deactivation, plus the lock
   in the public path.
5. Hold and cron change, the signed pay link endpoint and page, and the
   widened markPaid.
6. Client emails and the Google Calendar push.
7. App: the dialog, entry points, chips and the pay page.
8. Full test run, browser run, PR from dev to main.

Rough size: part A is half a day. Part B is two to three days, with the custom
time and hold changes the parts that need the most care.

## Decisions to confirm

1. **Therapists and "mark as paid".** Recommended: front desk and admins only,
   matching the current mark-paid permission. A solo practitioner is the OWNER,
   so it does not affect them.
2. **Payment link hold of 48 hours** (and never later than 2 hours before the
   session). Shorter frees slots sooner; longer suits clients who pay late.
3. **Custom times outside working hours:** allowed, with a warning.
   Recommended, since the reason for a custom time is usually an exception.
4. **Receptionists can see the emergency contact?** The brief says clinical
   staff only. A front desk that phones clients may want it; keeping it
   clinical is the safer default.

## Out of scope

- Recurring bookings (a weekly series). Worth a later step; the custom time
  path is the base it would build on.
- Booking for someone who is not yet a client. Staff create the client first
  (the existing form), then book.
- Discount codes on staff bookings.
- Hold-lapsed emails, if they slip from step 5 of the order of work.
