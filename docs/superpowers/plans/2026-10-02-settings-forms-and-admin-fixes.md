# Settings, Forms and Admin Fixes Implementation Plan (SET-10, SET-12, FRM-03, FRM-04, ADM-04)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five independent fixes:
- Google Calendar shows when it's connected, and can be disconnected.
- "Active sessions" stays short and accurate.
- Submissions becomes one inbox for everything clients send.
- The Forms page offers the five agreed default forms and no "Assessment" type.
- Admin revenue shows Unclutter Desk's own income.

**Architecture:** Each task stands alone and ships on its own. ADM-04 adds a `PlatformPayment` ledger, written by the billing webhook for subscription charges (first payment and renewals) and by booking confirmation for Starter platform fees. The admin overview sums that ledger.

**Tech Stack:** NestJS, Prisma, React, vitest.

**Spec:** `docs/testing-feedback.md` → SET-10, SET-12, FRM-03, FRM-04, ADM-04 (decisions of 2 Oct 2026).

## Global Constraints

- **Secrets never leave the server.** The Google refresh token is reported only as `googleConnected: boolean`.
- **Sessions:**
  - Device identity is a random `unclutter_device` cookie (httpOnly, `SameSite=lax` in development and `none` in production, like the auth cookies; 1 year), set on sign-in if missing.
  - A sign-in from a device that already has an active session for the same user revokes that older session.
  - Sessions unused for 14 days are treated as ended (excluded from the list and refused on refresh).
- **Submissions** lists form submissions **and** completed assessment results, newest first. Each row is labelled by kind: "Intake", "Consent", "Review", "Feedback", or the assessment's name with its score and severity.
- **Default forms:** Intake, Review, Consent, Feedback, Confidentiality. Every practice gets all five (`DefaultFormsService.ensureFor`). The form types offered in the editor are those five; "Assessment" is not offered, and existing custom forms of that type keep working and are shown under "Other".
- **Platform income:**
  - **Subscription payments:** every successful Paystack charge for a practice's plan.
  - **Booking fees:** the platform fee (5% on Starter) on each confirmed paid booking.
  - Both are recorded once (unique on reference), from now on. There's no backfill; the admin page says "Recorded since 2 Oct 2026".
- **Tests:** API specs use Prisma stand-ins; app tests use `renderWithApp`. Run with `--maxWorkers=2 --minWorkers=1`. Migrations are generated with `prisma migrate diff`.

## Review Focus

1. **Two browsers for the same user** (laptop and phone): both stay signed in; only repeated sign-ins from the *same* browser replace each other.
2. **A Google token Google has revoked:** the page shows "Reconnect Google Calendar", not "Connected".
3. **A Paystack renewal charge** (a reference not starting with `subscription-`) is still recorded as subscription income for the right practice.
4. **The same Paystack event delivered twice** records one platform payment.
5. **A client with three assessments and two forms** appears five times in Submissions, filterable down to one client.

---

### Task 1: Google Calendar connection status (SET-10)

**Files:**
- API: `consult.service.ts` (`getTherapistProfile` adds `googleConnected: !!googleRefreshToken`);
- `calendar.controller.ts`: `DELETE /v1/calendar/google` clears the token after a best-effort revoke at Google;
- `calendar.service.ts`: `disconnect(profileId)`; when Google refuses the stored token (`invalid_grant`), clear it and log;
- App: `AvailabilitySettingsPage.tsx`;
- Tests: `calendar.service.spec.ts` (create or extend), `AvailabilitySettingsPage.test.tsx`.

- [ ] **Step 1: Failing tests:**
  - the profile view reports `googleConnected: true` when a token is stored and never includes the token;
  - disconnect clears it;
  - an `invalid_grant` while pushing an event clears the token (Review Focus 2);
  - the app shows "Connected to Google Calendar · Disconnect" from the profile (no `?google_connected` in the address), and Disconnect calls DELETE and switches to "Connect Google Calendar".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run both suites.
- [ ] **Step 5:** Commit `"SET-10: Availability shows whether Google Calendar is connected, and can disconnect it"`.

### Task 2: Active sessions stay short and accurate (SET-12)

**Files:**
- `prisma/schema.prisma` (`Token.deviceId String? @db.VarChar(64)`, index `[userId, deviceId]`) and a migration;
- `apps/api/src/modules/auth/session.service.ts`: `create` takes `deviceId` and revokes earlier active sessions with the same user and device; `listForUser` excludes sessions idle for more than 14 days; refresh refuses them;
- `auth.controller.ts`: read or set the `unclutter_device` cookie on sign-in (all sign-in routes: practice, client, admin, switch);
- `apps/app/src/pages/practice/settings/AccountPreferencesPage.tsx`: show the current device plus the two most recent, then "Show all (N)";
- Tests: `session.service.spec.ts`, `auth` sign-in spec, `AccountPreferencesPage.test.tsx`.

- [ ] **Step 1: Failing tests:**
  - signing in twice with the same `deviceId` leaves one active session;
  - a different `deviceId` keeps both (Review Focus 1);
  - a session last used 15 days ago isn't listed, and its refresh is refused;
  - sign-in sets the device cookie when missing and keeps it when present;
  - the card shows 3 rows and "Show all (7)", which expands to 7; "Sign out other devices" is unchanged.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run both suites.
- [ ] **Step 5:** Commit `"SET-12: one session per browser, idle sessions end after 14 days, and the list shows the latest three"`.

### Task 3: Submissions is one inbox (FRM-03)

**Files:**
- API: `intake.service.ts`: `getTenantSubmissions` merges completed `AssessmentResponse` rows (tenant-scoped, with the client, instrument name, `totalScore`, `severityLabel`, `hasFlags`, `completedAt`) as items of `kind: 'ASSESSMENT'`. Form items get `kind` from their `targetType`. A shared item shape: `{ id: 'form:12' | 'assessment:7', kind, title, client, submittedAt, status, score?, severity?, flagged?, href }`;
- App: `SubmissionsPage.tsx`:
  - filters: All, Forms, Assessments, Reviews, plus a client search;
  - assessment rows show the score and severity, and flagged results are marked;
  - the detail pane for an assessment links to the full result in the client's Assessments panel;
- Tests: `intake.service.spec.ts`, `SubmissionsPage.test.tsx` (create).

- [ ] **Step 1: Failing tests:**
  - a tenant with 2 form submissions and 3 completed assessments returns 5 items, newest first, each with the right `kind`;
  - another tenant's assessments are never included;
  - the page filters to Assessments and shows "PHQ-9 · 14 · Moderate";
  - searching a client's name narrows the list (Review Focus 5).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Keep the existing review publishing actions working for review items.
- [ ] **Step 4:** Run both suites.
- [ ] **Step 5:** Commit `"FRM-03: Submissions shows every form and assessment clients send, in one place"`.

### Task 4: The five default forms, and no "Assessment" type (FRM-04)

**Files:**
- `apps/api/src/modules/intake/default-forms.ts`: add `REVIEW` (targetType `REVIEW`: a 1–5 rating plus "What would you like others to know?"), `CONSENT` (targetType `CONSENT`: treatment consent with signature) and `FEEDBACK` (targetType `FEEDBACK`: a 1–5 rating for the session plus an open comment), each with a `systemKey`;
- `DEFAULT_FORMS` becomes the five, in the order Intake, Consent, Confidentiality, Feedback, Review;
- `ensureFor` already creates the missing ones idempotently. Run it for every existing practice in a data migration or a one-off startup task; the existing pattern in `DefaultFormsService` decides which;
- App: `FormsManagerPage.tsx` (category tabs ALL, INTAKE, CONSENT, FEEDBACK, REVIEW, OTHER) and `FormEditorPage.tsx` (type options without ASSESSMENT; an existing ASSESSMENT form shows its type as read-only "Other");
- Tests: `default-forms.spec.ts`, `FormTemplates.test.tsx` or new tests for the manager and editor.

- [ ] **Step 1: Failing tests:**
  - `ensureFor` on a practice with only Intake creates the other four, and running it twice creates nothing more;
  - the editor offers no Assessment type;
  - the manager has no ASSESSMENT tab;
  - an existing custom form of type ASSESSMENT shows under OTHER and still saves.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Pending-forms logic (`listPendingForms`) keeps counting only the forms a client must complete before a first session (Intake, Consent, Confidentiality), not Review or Feedback. Add that rule to its spec.
- [ ] **Step 4:** Run both suites.
- [ ] **Step 5:** Commit `"FRM-04: five default forms for every practice; Assessment leaves the Forms page"`.

### Task 5: Admin revenue is Unclutter Desk's income (ADM-04)

**Files:**
- Schema and migration:
  - `PlatformPayment { id, tenantId, kind ('SUBSCRIPTION' | 'BOOKING_FEE'), amountKobo BigInt, reference String @unique, bookingId BigInt?, paidAt DateTime, createdAt }`;
  - `ConsultBooking.platformFeeKobo BigInt?`.
- `consult.service.ts` (`startOnlinePayment` / `createBooking` / `restartOnlinePayment`): store the split's `platformFeeKobo` on the booking when payment starts.
- `billing/booking-payment-settler.service.ts`: on `confirmed` or `reconfirmed`, record a `BOOKING_FEE` PlatformPayment when the fee is above 0 (reference `fee:<booking reference>`). A refunded booking records nothing.
- `billing.service.ts` (webhook):
  - **subscription charges:** for `charge.success` with a `subscription-` reference, **or** with `data.plan` and a customer code matching a tenant's `paystackCustomerCode` (renewals; Review Focus 3), record a `SUBSCRIPTION` PlatformPayment (`amount`, `paid_at`, `reference`);
  - **duplicates:** upsert on `reference` (Review Focus 4);
  - **renewal tier:** also apply the tier, as the first payment does, if the plan maps to one.
- `admin.service.ts`:
  - `stats()`: `revenueKobo` is the sum of PlatformPayment, split as `subscriptionKobo` and `bookingFeeKobo`, plus `recordedSince`;
  - the tenant detail: that practice's own collected booking revenue (the old figure) and its payments to the platform.
- App:
  - `AdminOverviewPage.tsx`: the "Platform revenue" tile shows the total and the two parts, with "Recorded since 2 Oct 2026";
  - `AdminTenantDetailPage.tsx`: "Practice earnings" (clients' payments) and "Paid to Unclutter Desk".
- Tests: `billing` webhook specs, settler spec, `admin.service` spec, admin page tests.

- [ ] **Step 1: Failing tests:**
  - a subscription `charge.success` records one SUBSCRIPTION payment, and a replay records nothing more;
  - a renewal charge with a plan and a known customer code is recorded against that tenant;
  - a Starter booking confirmed at ₦35,000 records a ₦1,750 BOOKING_FEE, while a Pro booking records none;
  - a refunded late payment records none;
  - admin stats sum the ledger, not booking payments;
  - the tenant detail shows the practice's own earnings;
  - the admin tile reads "Platform revenue ₦X · Subscriptions ₦Y · Booking fees ₦Z".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run both suites; check the tenant-isolation spec still passes (the admin queries are platform-wide by design; keep them in `AdminService`, which that spec already allows).
- [ ] **Step 5:** Commit `"ADM-04: admin revenue is Unclutter Desk's income: subscriptions and booking fees, recorded from now on"`.

### Task 6: Browser check and the testing sheet

- [ ] **Step 1:** Connect Google on Availability, reload, and see "Connected"; disconnect.
- [ ] **Step 2:** Sign in three times in one browser and once in another: Active sessions shows 2.
- [ ] **Step 3:** As a client, complete an assessment and a form: both appear in Submissions.
- [ ] **Step 4:** The Forms page shows five defaults and no Assessment tab.
- [ ] **Step 5:** In Paystack test mode, pay a Starter booking and a subscription: the admin overview shows both parts.
- [ ] **Step 6:** In `docs/testing-feedback.md`, set SET-10, SET-12, FRM-03, FRM-04 and ADM-04 to **Fixed**, with commits and what was seen. Commit.
