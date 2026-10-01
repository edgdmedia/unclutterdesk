# Booking Emails, Notifications and Default Forms: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, chosen by the product owner). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close five items from `docs/testing-feedback.md`:
- **NOT-04:** the "pay to confirm" email gives out the join link.
- **NOT-05:** the notifications page stays empty.
- **NOT-03:** the sender shows as `no-r…`.
- **BKG-10:** no offer of the client's account after booking.
- **BKG-06:** default intake and confidentiality forms, sent after booking.

**Architecture:** one `BookingNotifier` service owns every message about a booking: emails to the client and in-app notices to staff. It lives in the global notifications module, so `consult`, `billing` (the webhook) and the manual-payment code can all call it without a circular module import. Booking status changes call it at three moments: booked, confirmed, cancelled.

**Runs on:** `dev`, by this session. **opencode works in parallel** in its own worktree on ONB-06 and SET-08 (`docs/superpowers/plans/2026-10-01-opencode-walkthrough-and-uploads.md`). It touches `DashboardPage`, `AccountMenu`, `practiceNav`, `Sidebar`, `LogoField`/`ImageField`, `auth.*`, `Profile`, and `uploadTherapistAvatar` in `consult.service.ts`. Avoid those.

**Spec:** the entries for these items in `docs/testing-feedback.md`, and BKG-06's decision (editable wording; sent after booking).

## Global constraints

- Test-first. API specs use test stand-ins for Prisma; app tests use `renderWithApp`, faking only `utils/apiClient` and `AuthContext`.
- Run suites with `--maxWorkers=2 --minWorkers=1`. API build: `NODE_OPTIONS=--max-old-space-size=8192 npx nest build`.
- Any manual email check runs with `SMTP_HOST= SMTP_USER= SMTP_PASS=` (log only).
- Emails go through `NotificationService.sendEmail` (it escapes everything). In-app notices go through `NotificationService.notify`.
- Stage only this plan's files: other sessions may have work in the tree.

## Review focus

1. **Paystack confirms a booking twice** (webhook, then pop-up confirm): the client must get exactly one "Your session is booked" email. `markBookingPaid` returns `false` for the second call; send only on `true`.
2. **A bank-transfer hold** must never receive the join link until staff mark it paid.
3. **A free or fully discounted booking** is confirmed at once and gets the confirmed email straight away.
4. **Staff notices go to people in this practice only**: the session's therapist plus active owners and admins of the booking's tenant, never another practice.
5. **A returning client who already filled in the forms** for this practice isn't asked again.

---

### Task 1: BookingNotifier, the client emails (NOT-04)

**Files:**
- Create: `apps/api/src/modules/notifications/booking-notifier.service.ts`, provided and exported by `NotificationModule`, which is global.
- Modify: `apps/api/src/modules/consult/consult.service.ts`. Replace the single `bookings.confirmed` email in `createBooking` (around lines 748–770) with `notifier.booked(bookingId)`. In `confirmPublicPayment`, call `notifier.confirmed(bookingId)` when `markBookingPaid` returns `true`.
- Modify: `apps/api/src/modules/billing/billing.service.ts`. In the webhook `charge.success` booking branch, call `notifier.confirmed(bookingId)` only when `markBookingPaid` returns `true`.
- Modify: `apps/api/src/modules/consult/manual-payment.service.ts`. `markPaid` calls `notifier.confirmed`, replacing its own email if it sends one; check lines ~164–200 and keep any staff-facing message.
- Test: `apps/api/src/modules/notifications/booking-notifier.spec.ts`

**Emails, by booking state:**
- **Online, awaiting payment.** Title "Almost there — pay ₦35,000 to confirm your session". The body gives the practice, service, therapist and time (WAT), then "Your time is held while you pay." **No join link.** The button is "Pay ₦35,000" → `${tenantWebOrigin(tenant)}/pay/${bookingId}` (the existing `PayBookingPage`).
- **Bank transfer held.** Skipped here, because `manualPayments.announce` already sends the bank details. Check that and make sure it doesn't include the join link.
- **Confirmed** (paid, free, or transfer marked paid). Title "Your session is booked". It includes the join link for online sessions, the button "Join the session" (or "View my bookings" for in-person ones), and a second link to the portal (`${tenantWebOrigin}/portal`, BKG-10).

**Tests:**
- An online pending booking gets the pay email: link `/pay/900`, no `meet.jit.si`.
- A free booking gets the confirmed email with the join link.
- `confirmed()` after `markBookingPaid` → `true` sends once; the second webhook delivery (`false`) sends nothing.
- A transfer hold: `booked()` sends nothing, and `announce` doesn't contain the join link (assert on the manual-payment spec).

**Commit:** "Clients get the join link only once their session is confirmed".

### Task 2: Staff notices (NOT-05)

**Files:**
- `booking-notifier.service.ts`: add `notifyStaff(bookingId, event)`.
- Its callers: `createBooking` (event `booked`), `confirmed`, `clientReportsPaid` (`transfer_sent`), the cancel paths in `consult.service.ts` (`cancelled`; find them with `grep -n "status: 'CANCELLED'"`), and form submission in `intake.service.ts` `submitIntakeAnswers` (`form_submitted`).

**Recipients:** the slot's therapist (`availability.providerProfileId`), plus active profiles in the tenant with role OWNER or ADMIN, without duplicates. RECEPTIONIST as well for the `transfer_sent` event, because they confirm transfers.

**Types and copy:**

| Type | Title | Message |
|---|---|---|
| `consult.booking_created` | New booking | "Ada Okafor booked Individual Therapy for Tue, 6 Oct · 11:30 AM." Add " Waiting for payment." when pending. |
| `consult.booking_paid` | Payment received | "Ada Okafor paid ₦35,000 for Tue, 6 Oct · 11:30 AM." |
| `consult.transfer_sent` | Transfer to confirm | "Ada Okafor says they've sent ₦35,000 (ref UD-900). Check your account and mark it paid." |
| `consult.booking_cancelled` | Session cancelled | "Ada Okafor's session on Tue, 6 Oct · 11:30 AM was cancelled." |
| `intake.form_submitted` | Form received | "Ada Okafor completed About you." |

The link is `/dashboard/sessions/<bookingId>` (or `/dashboard/clients/<id>` for forms). Use `preferenceCategory: 'activity'`.

**Tests:** recipients for each event (therapist + owners/admins, tenant-scoped: assert the Prisma `where` includes `tenantId`); no duplicate when the therapist is also the owner; the copy above.

**App check:** with the API restarted, make a booking and open `/dashboard/notifications`. "New booking" appears.

**Commit:** "Staff are notified of bookings, payments, transfers, cancellations and forms".

### Task 3: Sender name (NOT-03)

- [ ] **Reproduce:** send any email in preview mode and log the full `From` that `formatSender` builds. Then run with real SMTP to edgdmedia@gmail.com's own inbox, only if the product owner agrees at the time.
- [ ] **Test** (`mail.service.spec.ts`): with no tenant and `SMTP_FROM=no-reply@unclutterdesk.com`, the From is `"Unclutter Desk" <no-reply@unclutterdesk.com>`. With a tenant brand, it's `"EDGD Media" <…>`.
- [ ] **If the code is right and Gmail is rewriting it:** document it in `docs/VPS_PREPARATION.md`. Gmail SMTP only keeps the display name for the signed-in address or a verified "Send mail as" alias; production uses Resend with a verified domain. Mark NOT-03 accordingly, with evidence. **If the code is wrong**, fix it test-first.
- **Commit:** as appropriate.

### Task 4: "Go to my bookings" after booking (BKG-10)

**Files:**
- `apps/app/src/pages/public/booking/ConfirmationStep.tsx`: add a primary `Button` "Go to my bookings" linking to `/portal`, the client portal on the practice host, where the client is already signed in. It goes above **Add to calendar**.
- Tests in `ConfirmationStep.test.tsx`.

**Copy:** "Manage your booking any time: reschedule, cancel, pay or fill in your forms."

**Commit:** "After booking, clients are pointed to their bookings".

### Task 5: Default intake and confidentiality forms, sent after booking (BKG-06)

**Decided:** every practice gets both forms, can edit the wording, and clients get them after booking.

1. **Templates.** `apps/api/src/modules/intake/default-forms.ts` exports `CLIENT_INTAKE` and `CONFIDENTIALITY`: `{ systemKey, title, description, targetType, schemaJson }`.
   - **Intake** (`targetType: 'INTAKE'`): preferred name, date of birth, phone, emergency contact name and phone, what brings you to therapy, previous therapy (yes/no + details), current medication, anything else, consent to be contacted by phone or email.
   - **Confidentiality** (`'CONSENT'`): text blocks on what's kept confidential, its limits (serious risk to self or others, safeguarding, court order), and how notes are stored; then "I have read and understood" (required) and a signature with date.
   - Field types follow the `schemaJson` convention in `prisma/schema.prisma` (`text | textarea | single_choice | multiple_choice | scale | signature | file_upload`).
2. **Editable system forms.** In `intake.service.ts`, `export const EDITABLE_SYSTEM_KEYS = ['CLIENT_INTAKE', 'CONFIDENTIALITY']`. The lock in `updateForm` (lines ~255–265) skips them. PHQ_9 and GAD_7 stay locked. **Test:** editing `CLIENT_INTAKE`'s schema succeeds; editing `PHQ_9`'s still throws.
3. **Every practice has them.** `DefaultFormsService.ensureFor(tenantId)` creates the missing ones by `(tenantId, systemKey)`. It's called after tenant creation (both `tenant.service.ts` `createTenant` and `auth.service.ts` around line 141, where signup creates the tenant), plus `scripts/backfill-default-forms.mjs` for existing practices. **Tests:** creates both; a second call creates nothing; never overwrites an edited form.
4. **How clients fill them in.** First find whether a client-facing form page exists: search `apps/app/src` for the routes that call `POST /v1/intake/public/submissions`, and the portal's forms section. If one exists, link to it with `?form=<id>&booking=<id>`. If not, build `/forms/:formId` on the practice host (signed-in client), rendering the schema and posting to `/v1/intake/public/submissions` with `bookingId`. That's a separate commit with its own tests.
5. **Send after booking.** `BookingNotifier.confirmed()` (from Task 1) adds a "Before your first session" section listing the practice's active default forms the client hasn't already submitted for this practice, each with its link. The booking response and `GET` confirm include `forms: [{ title, kind, minutes, href }]`, so the wizard's existing **What's next** block (already built, hidden while empty) shows them. **Tests:** a confirmed booking lists both forms; a returning client who submitted both gets none; a paused form isn't listed.
6. **Status for staff.** The session page shows "Intake: done / waiting" and "Confidentiality: done / waiting", using `getBookingSubmissions`. **Test** with `renderWithApp`.

**Commits:** one per numbered step that changes behaviour.

---

## Finish

- All suites green and type checks clean. Rebuild the API, restart both servers (app **without** `VITE_API_URL`).
- **Browser check:** book a session, pay in the pop-up with a Paystack test card, then confirm:
  - one confirmed email in the log, with the join link and the forms;
  - "New booking" and "Payment received" in staff notifications;
  - **Go to my bookings** works.
- Update the sheet: NOT-03 (with evidence), NOT-04, NOT-05, BKG-10 and BKG-06 → `Fixed`.
- Merge opencode's PR into `dev` once it's green. Run the suites again after merging.
