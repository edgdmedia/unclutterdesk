# Testing & Fixing Sheet

A running log of what shows up in testing, what we decide about it, and when it's fixed.

## How to use this sheet

1. **Log it.** Add the item under its area using the template at the bottom. Give it the next ID for that area (`ADM-03`, `SET-04`, …). IDs never get reused.
2. **Add it to the tracker.** Add one row to the tracker table so the whole list can be scanned at once.
3. **Triage it.** Set the type and priority. Record the decision under **Feedback / decision**.
4. **Fix it.** Move the status along. Record the commit or PR under **Fix**.
5. **Verify it.** Whoever tested it retests on the environment named in **Verified**, then marks it `Done`.

### Status

| Status | Meaning |
|---|---|
| `Open` | Logged, not triaged yet |
| `Discuss` | Needs a product decision before any work starts |
| `Ready` | Decision made, ready to build |
| `In progress` | Being worked on |
| `Fixed` | Code merged to `dev`, waiting for a retest |
| `Done` | Retested and confirmed |
| `Won't fix` | Decided against it. Record the reason in the feedback |
| `Deferred` | Valid, but moved to a later gate or release |

### Type

`Bug` means it's broken. `UX` means it works but it's poor. `Feature` means it's missing. `Question` means it needs an answer, which may turn into one of the others.

### Priority

`P0` blocks launch or testing · `P1` must fix before the next gate · `P2` should fix · `P3` nice to have

---

## Tracker

| ID | Area | Item | Type | Pri | Status |
|---|---|---|---|---|---|
| ADM-01 | Admin | Share link: custom message, send or invite by email | Feature | P1 | Fixed |
| ADM-02 | Admin | Admin sidebar doesn't match the app sidebar (account dropdown, Back to Practice) | UX | P2 | Fixed |
| ADM-03 | Admin | Admin sign-in fields don't match the rest of the app | UX | P2 | Fixed |
| NOT-01 | Notifications | Email branding has no logo | Bug | P1 | Fixed |
| NOT-02 | Notifications | Email template rendered free text as HTML | Bug | P0 | Fixed |
| NOT-03 | Notifications | Emails show the sender as no-r...@unclutterdesk.com, not the practice or Unclutter Desk | Bug | P1 | Won't fix |
| NOT-04 | Notifications | "Pay to confirm" email already gives the join link, and points to a payment link that isn't in it | Bug | P1 | Fixed |
| NOT-05 | Notifications | The notifications page stays empty, even after bookings | Bug | P1 | Fixed |
| ONB-01 | Onboarding | Does Direct Payout create a Paystack subaccount automatically? (Yes. The step's copy is wrong) | Bug | P1 | Fixed |
| ONB-02 | Onboarding | Can a practice bring its own Paystack keys? | Question | | Won't fix |
| ONB-03 | Onboarding | Setup step offers online payment and bank transfer | Feature | P1 | Fixed |
| ONB-04 | Onboarding | Payout step says payments are processed by Paystack | UX | P2 | Fixed |
| ONB-05 | Onboarding | No way to set a session as virtual or physical | Bug | | Fixed |
| ONB-06 | Onboarding | No walkthrough after "Go to Dashboard" | Feature | | Fixed |
| ONB-07 | Onboarding | Continue in setup fails with "This endpoint requires a practice profile" | Bug | P0 | Fixed |
| ONB-08 | Onboarding | Setup doesn't ask for the practice's preferred video platform | Feature | P2 | Fixed |
| SET-01 | Settings | Booking link picked during setup isn't saved, and can't be changed | Bug | P1 | Fixed |
| SET-02 | Settings | Booking subdomain should be a separate setting from the custom hostname | UX | P2 | Fixed |
| SET-03 | Settings | No custom hostname setup (add domain, DNS records, auto-configure) | Feature | P2 | Deferred |
| SET-04 | Settings | Link, logo and colours set in setup don't show afterwards | Bug | P0 | Fixed |
| SET-05 | Settings | After setup there's nowhere to change the logo or booking link | Bug | P1 | Fixed |
| SET-06 | Settings | No way to say if the practice offers online, in person or both, or to manage several locations | Feature | P1 | Fixed |
| SET-07 | Settings | Services can't have a different price online and in person | Feature | P1 | Fixed |
| SET-08 | Settings | Uploading a profile photo or practice logo shows no progress or result | UX | P2 | Fixed |
| BKG-01 | Booking page | Layout is incoherent and doesn't work | UX | | Fixed |
| BKG-02 | Booking page | Practice logo never loads | Bug | P1 | Fixed |
| BKG-03 | Booking page | "Book now" should be a step-by-step wizard | UX | | Fixed |
| BKG-04 | Booking page | Is a client's sign-in tied to one practice or shared across practices? | Question | P2 | Fixed |
| BKG-05 | Booking page | Session format should come from what the practice offers for each slot | Bug | | Fixed |
| BKG-06 | Booking page | Default intake and confidentiality form templates for every practice | Feature | | Fixed |
| BKG-07 | Booking page | Header shows a hard-coded "Lagos, Nigeria · Online & in-person" for every practice | Bug | P1 | Fixed |
| BKG-08 | Booking page | "Notify me" when a practice has no free times in the next 4 weeks | Feature | P3 | Deferred |
| BKG-09 | Booking page | An abandoned online payment keeps the time blocked for everyone | Bug | P1 | Fixed |
| BKG-10 | Booking page | After booking, clients aren't offered their account to manage the booking | UX | P1 | Fixed |
| SET-09 | Settings | A practice discount can be turned off, but not back on, edited or deleted | Bug | P1 | Fixed |
| BKG-11 | Booking page | The practice's booking link doesn't carry the new wizard design: too wide, no practice logo | Bug | P1 | Fixed |
| BKG-12 | Booking page | "Go to my bookings" and the calendar buttons should share one row; the two calendar links can be one dropdown | UX | P3 | Fixed |
| BKG-13 | Booking page | The public profile shows the same long bio twice, and there is no tagline field in the practice profile | Bug | P2 | Fixed |
| BKG-14 | Booking page | The public profile misses details from the Claude design: About headline, Learn More button, real location names | UX | P2 | Fixed |
| BKG-15 | Booking page | "Log in" on the practice's page sends clients to the staff login | Bug | P1 | Fixed |
| SET-13 | Settings | Custom domains should be self-serve via Cloudflare for SaaS | Feature | P2 | Ready |
| VID-01 | Video | The session room is a mock-up, not a real video call | Feature | P0 | Fixed |
| POR-01 | Client portal | /portal only works on app.unclutterdesk.com, not on the practice's own link | Bug | P1 | Fixed |
| POR-02 | Client portal | The portal should look like a dashboard, not a plain list | UX | P2 | Fixed |
| FRM-01 | Forms | Save forms as templates and optionally share them with other practices | Feature | | Fixed |
| FRM-02 | Forms | The Forms page is wider than a phone screen | Bug | P2 | Open |
| NOT-06 | Notifications | The bell should sit in the header with a dropdown | UX | P2 | Ready |
| NOT-07 | Notifications | Clients get no reminders | Feature | P1 | Ready |
| NOT-08 | Notifications | Booking emails failed on the live site | Bug | P0 | Fixed |
| NOT-09 | Notifications | Links in practice emails were broken (http://dashboard/sessions/8) | Bug | P1 | Fixed |
| NOT-10 | Notifications | The booking confirmation email was one run-on paragraph with raw links | UX | P1 | Fixed |
| NOT-11 | Notifications | The sender name and address differed by email provider | Bug | P1 | Fixed |
| SET-10 | Settings | Google Calendar shows "Connect" again after it was connected | Bug | P2 | Ready |
| SET-11 | Settings | A longer service can't use the normal session times | Feature | P2 | Ready |
| SET-12 | Settings | "Active sessions" lists the same browser many times | Bug | P2 | Ready |
| FRM-03 | Forms | Submissions should show everything clients send, assessments included | Feature | P2 | Ready |
| FRM-04 | Forms | The Forms page still has an "Assessment" type | UX | P2 | Ready |
| POR-03 | Client portal | The portal should use the same dashboard frame as practice and admin | UX | P2 | Fixed |
| POR-04 | Client portal | Clients can't book a session from the portal | Feature | P1 | Fixed |
| POR-05 | Client portal | No "Add to calendar" for sessions in the portal | UX | P2 | Fixed |
| POR-06 | Client portal | Portal shows your sessions and "Sign in" at the same time after a while away | Bug | P1 | Fixed |
| ADM-04 | Admin | Gross revenue counts practices' income, not Unclutter Desk's | Bug | P2 | Ready |
| BKG-13 | Sessions | Past sessions with no outcome stay "Confirmed" forever | Feature | P1 | Ready |
| VID-02 | Video | "Join session" works any time, even days before | Bug | P1 | Fixed |
| GEN-01 | Design system | Pages set their own widths and hand-write their grids | UX | P2 | Ready |
| GEN-02 | Design system | The dashboard keeps showing Profile photo and Practice branding cards | UX | P3 | Ready |
| GEN-03 | Design system | The menu feels disconnected | UX | P2 | Ready |
| GEN-04 | Design system | Settings is twelve loose pages; unrelated things share a page | UX | P2 | Ready |
| NOT-12 | Notifications | Practices can't change the wording of their emails | Feature | P2 | Ready |
| NOT-13 | Notifications | Clients can't choose their reminders | Feature | P1 | Ready |
| NOT-14 | Notifications | Practices can't see or send a session's reminders | Feature | P2 | Ready |

---

## Admin

### ADM-01 · Share link: custom message, send or invite by email
- **Type:** Feature · **Priority:** P1 · **Status:** Fixed
- **Observed:** When the admin copies the link to share it, there's no option to add a custom message, send it to an email address, or invite someone by email.
- **Feedback / decision:** Each invite code has an **Invite by email** form: an email address and an optional personal message (up to 1000 characters). The email carries the message, the signup link with the code filled in, the code, and the plan and number of free days. Every send is recorded (address, time, admin, delivered or not) and listed under the code with **Resend**. Only a live code can be sent. **Copy invite link** is still there for sharing elsewhere.
- **Fix:** `d054ed3` on `dev`. Adds the `InviteSend` table (migration `20260930120000_invite_sends`). Covered by `invite.service.spec.ts` and `AdminInvitesPage.test.tsx`. Tested end to end locally with email in preview mode.
- **Verified:**

### ADM-02 · Admin sidebar doesn't match the app sidebar
- **Type:** UX · **Priority:** P2 · **Status:** Fixed
- **Observed:** The admin sidebar doesn't look or behave like the app sidebar. The biggest gap is the account dropdown, which should include **Back to Practice**.
- **Feedback / decision:** The admin console now rides the same shared shell as the practice app: full sidebar, icon rail, phone drawer, same collapse memory. Its account menu matches the practice one and offers **Back to my practice** (only when the operator has a practice) and **Sign out**. The layout check gained an admin pass at all four widths.
- **Fix:** `a2be2d5` on `dev`. Covered by `AdminAccountMenu.test.tsx`; `check:layout` reports `/admin` and `/admin/invites` clean at 390–1280px.
- **Verified:**

### ADM-03 · Admin sign-in fields don't match the rest of the app
- **Type:** UX · **Priority:** P2 · **Status:** Fixed
- **Observed:** The fields on the admin sign-in page look different from the practice sign-in page: white fill, no fixed height, different label size and spacing.
- **Feedback / decision:** The admin page built its own field boxes. It now uses the shared `AuthField`, so both sign-in pages share one field style.
- **Fix:** see the commit "Admin sign-in uses the shared auth field" on `dev`. Checked in the browser: both pages have 52px fields, the same fill and 11.5px labels, and signing in still lands on `/admin`.
- **Verified:**

### ADM-04 · Gross revenue counts practices' income, not Unclutter Desk's
- **Type:** Bug · **Priority:** P2 · **Status:** Ready
- **Observed:** Admin "Gross revenue" adds up what clients paid every practice.
- **Feedback / decision:** Decided 2 Oct 2026. Show Unclutter Desk's own income: subscription payments, plus platform booking fees where they apply (Starter), shown separately. Each practice's earnings move to that practice's admin page.
- **Fix:** 
- **Verified:** 

## Notifications / Email

### NOT-01 · Email branding has no logo
- **Type:** Bug · **Priority:** P1 · **Status:** Fixed
- **Observed:** The email branding doesn't include the logo.
- **Feedback / decision:** The logo was stored as an inline `data:` URL, which Gmail and most clients block. Logos are now served from a real address, `GET /v1/tenant/:id/logo` (public, cached for a year, versioned by content hash; a hosted `https://` logo redirects; none or a non-image answers 404), and emails resolve that absolute URL instead.
- **Fix:** `d49d37e` on `dev`. Covered by `tenant-logo.spec.ts` and `notification.service.spec.ts`. `API_URL` documented in `docs/VPS_PREPARATION.md`.
- **Verified:**

### NOT-02 · Email template rendered free text as HTML
- **Type:** Bug · **Priority:** P0 · **Status:** Fixed
- **Observed:** Found while building ADM-01. The shared email template put the title, message, practice name and links into the HTML without escaping them, so a practice name or note containing markup would have been rendered as HTML in the email.
- **Feedback / decision:** Everything the template renders is now escaped, so all emails show it as plain text.
- **Fix:** `d054ed3` on `dev`. Covered by `email.channel.spec.ts`.
- **Verified:**

### NOT-03 · Sender shows as no-r...@unclutterdesk.com
- **Type:** Bug · **Priority:** P1 · **Status:** Won't fix (transport)
- **Observed:** Booking emails arrive from "no-r...@unclutterdesk.com" in the inbox list, not "EDGD Media" (the practice) or "Unclutter Desk".
- **Feedback / decision:** To investigate. The code does pass a display name (the practice's name, else `SMTP_FROM_NAME`, else "Unclutter Desk"; `mail.service.ts`), but locally mail goes through Gmail SMTP with `SMTP_FROM` set and `SMTP_FROM_NAME` not set. Gmail rewrites or ignores the From display name when it isn't the signed-in account or a verified "Send mail as" alias. Check what reaches the inbox, and whether production (Resend with a verified domain) shows the name correctly before changing code.
- **Fix:** Investigated: the code is right. `mail.service.spec.ts` now pins the From it builds — `"Unclutter Desk" <no-reply@unclutterdesk.com>` with no brand, `"EDGD Media" <…>` with one. What a client *shows* is the transport's doing: Gmail SMTP rewrites the display name for anything that isn't the signed-in account or a verified alias; production uses Resend with verified domains, which keeps the practice's name. Documented in `docs/VPS_PREPARATION.md` ("Email sender name"). No code change warranted — retest on production mail before reopening.
- **Verified:**

### NOT-04 · "Pay to confirm" email already gives the join link
- **Type:** Bug · **Priority:** P1 · **Status:** Open
- **Observed:** After booking (before paying), the email says "Almost there — pay to confirm your session… Join link: https://meet.jit.si/… Your payment link is on the confirmation page." So it hands out the session link before payment, and points to a payment link that isn't in the email.
- **Feedback / decision:** One email (`consult.service.ts` `createBooking`, type `bookings.confirmed`) is used for both paid and unpaid bookings. Proposed: while payment is pending, the email has no join link and its button is "Pay ₦X to confirm" (the existing pay link for the booking); bank-transfer holds get the bank details, reference and hold deadline instead. The join link goes out only in the "Your session is booked" email sent when payment is confirmed (by the webhook, the pop-up confirm, or staff marking a transfer paid). Related: BKG-09 (unpaid bookings never expire).
- **Fix:** `b0d414b`–`4de5bb8` on `dev`. One `BookingNotifier` owns every booking message: while money is due the client gets "Almost there — pay ₦X" with the pay link and no join link; a transfer hold hears only the bank details; the join link travels only in "Your session is booked", sent exactly once (webhook and pop-up confirm race through `markBookingPaid`'s boolean). Covered by `booking-notifier.spec.ts`, `booking-paystack-popup.spec.ts`, `reconciliation.spec.ts`.
- **Verified:** Browser check 1 Oct: booked online as a new client — the pay email logged with no join link, the confirmed email after the Paystack test payment with the join link, the portal link and both forms; one email, not two.

### NOT-05 · The notifications page stays empty
- **Type:** Bug · **Priority:** P1 · **Status:** Open
- **Observed:** Nothing appears under Notifications, even after successful bookings.
- **Feedback / decision:** In-app notifications are only created for rescheduled sessions and session-note reminders (`consult.service.ts` `notify(...)`). New bookings, payments received, bank transfers to confirm, cancellations and form submissions create none. Proposed: notify the session's therapist (and practice owners/admins where relevant) for: new booking, payment received, transfer marked sent / hold about to lapse, cancellation, client form submitted. Each in-app, with email/push following the existing per-type preferences.
- **Fix:** `4de5bb8` on `dev`. Staff now get in-app notices for new booking, payment received, transfer to confirm (front desk included), cancellation (both staff paths) and form submitted — therapist plus this practice's active owners/admins, tenant-scoped, no duplicates. Covered by `booking-notifier.spec.ts` and `portal-forms.spec.ts`.
- **Verified:** Browser check 1 Oct: "New booking", "Payment received" and "Form received" all appeared on `/dashboard/notifications` for the practice owner.

### NOT-06 · The bell should sit in the header with a dropdown
- **Type:** UX · **Priority:** P2 · **Status:** Ready
- **Observed:** The bell is only in the Dashboard page header; "Notifications" is also a sidebar item and a bottom-bar item.
- **Feedback / decision:** Decided 2 Oct 2026. The bell is part of the app frame: the last item on the right of the desktop header, the top-right corner on phones. Clicking opens a dropdown of the latest notifications (unread dots, "Mark all read") with **All notifications** at the bottom, leading to the page. Notifications leaves the sidebar and bottom bar; the bottom-bar slot becomes **Sessions**.
- **Fix:** 
- **Verified:** 

### NOT-07 · Clients get no reminders
- **Type:** Feature · **Priority:** P1 · **Status:** Ready
- **Observed:** The reminder queue exists (scheduled, every 30 seconds, with duplicate protection) but nothing queues a reminder, and reminder emails are off by default.
- **Feedback / decision:** Decided 2 Oct 2026. Reminders, each switchable and timed by the practice; clients can turn off the optional ones (rebook nudges, reviews), never session reminders. Email and in-app now; SMS/WhatsApp later.
  - Upcoming session: 24 hours and 1 hour before, with the join link or address.
  - Forms due before the first session: 48 hours and 24 hours before.
  - Assessment assigned, not done: 2 days after assigning, and the day before the session.
  - Unpaid booking or transfer: while the hold runs.
  - After a no-show: same day, with a rebook link.
  - After a completed session: review/feedback request; "book your next session" after a set number of days.
- **Fix:** 
- **Verified:** 

### NOT-08 · Booking emails failed on the live site
- **Type:** Bug · **Priority:** P0 · **Status:** Fixed
- **Observed:** From 1 Oct, every email to clients and practices failed (EmailLog): "The notify.unclutterdesk.com domain is not verified" (Resend). Emails up to 29 Sept had gone out.
- **Feedback / decision:** The sending domain notify.unclutterdesk.com was verified in Resend (2 Oct, by the product owner). A read-only server check, `scripts/check-email-logs.sh`, shows recent email errors.
- **Fix:** Resend domain verified (configuration, no code).
- **Verified:** 

### NOT-09 · Links in practice emails were broken (http://dashboard/sessions/8)
- **Type:** Bug · **Priority:** P1 · **Status:** Fixed
- **Observed:** Staff notifications carry in-app paths; the email put them in as-is, so mail clients made them http://dashboard/… .
- **Feedback / decision:** The email channel turns every in-app path into a full address on the app host, in one place.
- **Fix:** `014bd3d` on `dev`.
- **Verified:** Unit tests; email rendered and checked at 390px.

### NOT-10 · The booking confirmation email was one run-on paragraph with raw links
- **Type:** UX · **Priority:** P1 · **Status:** Fixed
- **Observed:** Details, the join link, the portal link and forms were all written into one paragraph.
- **Feedback / decision:** Emails gain a details block (labelled rows) and a list of further links. The confirmation shows Session, With, When, Where; a "Join the session" button; forms due and "Manage your booking" as links. Other booking emails can adopt the same layout.
- **Fix:** `014bd3d` on `dev`.
- **Verified:** Rendered preview checked at 390px.

### NOT-11 · The sender name and address differed by email provider
- **Type:** Bug · **Priority:** P1 · **Status:** Fixed
- **Observed:** The name was decided in two places, and the address came from MAIL_FROM on Resend but SMTP_FROM on Gmail, so emails showed as "no-reply@unclutterdesk.com".
- **Feedback / decision:** One function (SenderIdentityService) decides the sender for every provider: the practice's name (Unclutter Desk for platform mail), the platform address from MAIL_FROM (or the practice's verified domain when the provider can sign for it), replies to the practice. Providers only deliver.
- **Fix:** `c0ee98c` on `dev`.
- **Verified:** Unit tests; API boots.

### NOT-12 · Practices can't change the wording of their emails
- **Type:** Feature · **Priority:** P2 · **Status:** Ready
- **Observed:** Every email's wording is fixed in code.
- **Feedback / decision:** Decided 2 Oct 2026. Practices can edit the wording of every email they send to clients (subject, opening line, button label), with placeholders such as {{client_first_name}}, {{service}}, {{therapist}}, {{when}}, a preview, and "Reset to default". Platform emails (sign-in codes, password resets) stay fixed.
- **Fix:** 
- **Verified:** 

### NOT-13 · Clients can't choose their reminders
- **Type:** Feature · **Priority:** P1 · **Status:** Ready
- **Observed:** Clients have no reminder settings, and nothing to set after booking.
- **Feedback / decision:** Decided 2 Oct 2026. Clients set reminder and notification preferences in the portal (which reminders, how long before, by email or in-app; SMS later). Right after booking, the confirmation offers "Remind me" choices (1 day, 2 hours, 30 minutes before) for that session, with "Use these for all my sessions". A client's choice overrides the practice default.
- **Fix:** 
- **Verified:** 

### NOT-14 · Practices can't see or send a session's reminders
- **Type:** Feature · **Priority:** P2 · **Status:** Ready
- **Observed:** Nothing shows what a client will be reminded of, and there is no way to send a reminder by hand.
- **Feedback / decision:** Decided 2 Oct 2026. The session page lists the scheduled reminders (what, when, how) and offers "Send a reminder now".
- **Fix:** 
- **Verified:** 

## Onboarding

### ONB-01 · Does Direct Payout create a subaccount automatically?
- **Type:** Bug · **Priority:** P1 · **Status:** Fixed
- **Observed:** It's unclear whether choosing Direct Payout automatically creates a Paystack subaccount for the practice.
- **Feedback / decision:** Yes. Saving the step looks the account up with Paystack and creates a subaccount with `percentage_charge: 0` (`billing.service.ts` `saveBankSubaccount`). The platform fee is taken on each payment: 5% on Starter, 0% on Pro and Clinic. The step is optional. **Fix the step's copy:** the subtitle "Direct 0% fee settlement" is wrong on Starter, and "deposited automatically within 24 hours after completed client telehealth sessions" is wrong too, because money settles on Paystack's schedule after the payment, for every session type.
- **Fix:** `6d80603` on `dev`. The step is now "How clients pay". Covered by `OnboardingPaymentsStep.test.tsx`.
- **Verified:**

### ONB-02 · Can a practice bring its own Paystack keys?
- **Type:** Question · **Priority:** · **Status:** Won't fix
- **Observed:** There's no option for a practice to use its own Paystack keys.
- **Feedback / decision:** No. Practices get subaccounts only. Money already settles straight to the practice's bank. A practice's own keys would bypass the platform fee, need a webhook per practice, and put their secret keys in our database.
- **Fix:**
- **Verified:**

### ONB-03 · Should the Payout section offer manual payment?
- **Type:** Feature · **Priority:** P1 · **Status:** Fixed
- **Observed:** The Payout section doesn't let the practice choose manual payment.
- **Feedback / decision:** Yes. Rename the step to "How clients pay" and offer two options: pay online with Paystack (the subaccount), and bank transfer (reusing the existing manual-payment settings). The practice can turn on one or both.
- **Fix:** `6d80603` on `dev`. The step is now "How clients pay". Covered by `OnboardingPaymentsStep.test.tsx`.
- **Verified:**

### ONB-04 · Should we say "Powered by Paystack"?
- **Type:** UX · **Priority:** P2 · **Status:** Fixed
- **Observed:** The payout step doesn't say that payments are powered by Paystack.
- **Feedback / decision:** Yes. Add a small line on the payout step, "Payments processed securely by Paystack". Clients see Paystack at checkout anyway.
- **Fix:** `6d80603` on `dev`. The step is now "How clients pay". Covered by `OnboardingPaymentsStep.test.tsx`.
- **Verified:**

### ONB-05 · No way to set a session as virtual or physical
- **Type:** Bug · **Priority:** · **Status:** Ready
- **Observed:** There's nowhere to set whether a session is virtual or physical.
- **Feedback / decision:** Setup will ask "How do you see clients?" (online, in person, both) and add the first location inline (see SET-06). Design in `docs/superpowers/specs/2026-10-01-session-formats-and-locations-design.md`. **Design complete (see SET-06); ready to plan.**
- **Fix:** `c7a47d0` on `dev`. Setup now asks **"How do you see clients?"** (Online / In person / Both, default Online); In person or Both adds the first location inline (name prefilled with the practice name, address, city, optional directions — old drafts pre-fill from their address); prices are per format with "Same price for both" ticked; the default week follows the answer (Both = mornings in person, afternoons online). The Details step lost its address fields to Locations.
- **Verified:** Covered by `OnboardingServicesStep.test.tsx` (4 cases incl. the missing-address block).

### ONB-06 · No walkthrough after "Go to Dashboard"
- **Type:** Feature · **Priority:** · **Status:** Ready
- **Observed:** When the practice finishes setup and clicks **Go to Dashboard**, there's no basic walkthrough.
- **Feedback / decision:** The setup wizard already works as the checklist. What's needed is a guided walkthrough of the dashboard the first time a practice arrives, which can be replayed from the account menu (decided 30 Sep 2026). Plan Task 10.
- **Fix:** `af7c4fc`–`180d01f` on `opencode/walkthrough-uploads`. `Profile.tourCompletedAt` (migration `20261002090000_profile_tour`) travels with the signed-in profile; `POST /v1/auth/me/tour-complete` stamps it once. A shared `Tour` in the design system walks seven anchored stops (booking link, Sessions, Clients, Availability, Forms, Payouts, account menu); hidden anchors are skipped, so the phone gets the short version with a bottom sheet. **Take the tour** in the account menu replays it. Covered by `Tour.test.tsx`, `DashboardTour.test.tsx`, `tour.spec.ts`.
- **Verified:** Browser check on the worktree: all seven stops walked at 1280px with each highlight on its element (sidebar auto-scrolls), and at 390px the tour replays from the account menu with a bottom sheet, skipping the hidden anchors; `tourCompletedAt` lands in the DB and the tour stays quiet after.

### ONB-07 · Continue in setup fails with "This endpoint requires a practice profile"
- **Type:** Bug · **Priority:** P0 · **Status:** Fixed
- **Observed:** Clicking Continue on the Brand step returned a 403 from `PATCH /v1/tenant/brand`.
- **Feedback / decision:** Cause: the browser was signed in as `admin@unclutterdesk.com` (the admin console shares the browser's sign-in), and the setup page carried on with the practice's saved draft. Fix: setup needs a practice account (signed out goes to sign-in; admin or client accounts get "Sign in as the practice"); open tabs follow sign-ins made in other tabs; each practice's setup draft is stored separately, because it held bank details visible to any account in the browser.
- **Fix:** `5808ffc` on `dev`. Covered by `OnboardingAccess.test.tsx` and `AuthContext.crossTab.test.tsx`.
- **Verified:**

### ONB-08 · Setup doesn't ask for the video platform
- **Type:** Feature · **Priority:** P2 · **Status:** Fixed
- **Observed:** Practice setup has no option to choose the default video platform.
- **Feedback / decision:** It exists per therapist (`ConsultTherapistProfile.videoProvider`: Jitsi, Daily, Google Meet, Zoom; Jitsi by default), set in My profile only. Proposed: ask once in setup ("How do you run online sessions?") as the practice default, still changeable per therapist. Depends on VID-01 for which platforms run inside the app.
- **Fix:** `41d9608`. Setup's Services step says online sessions run in Unclutter Desk's own video room (no choice needed). My profile → Video sessions offers Unclutter Desk video or Google Meet; Meet needs Google connected, with a **Connect Google Calendar** button.
- **Verified:** Covered by `OnboardingServicesStep.test.tsx`, `MyProfileVideo.test.tsx` and `therapist-video.spec.ts`. Not yet clicked through in the browser.

## Settings

### SET-01 · Booking link from setup isn't saved
- **Type:** Bug · **Priority:** P1 · **Status:** Fixed
- **Observed:** The booking link chosen during setup wasn't saved, and there's nowhere in Settings to change it.
- **Feedback / decision:** Two causes. Setup's brand loader re-ran when the link was edited and put the old one back. And no settings page had a link field. Both fixed with SET-04/05.
- **Fix:** `45230c9` on `dev`. Setup no longer overwrites the link being typed, and the link can be changed in Settings → Brand & booking page.
- **Verified:**

### SET-02 · Booking subdomain vs custom hostname
- **Type:** UX · **Priority:** P2 · **Status:** Fixed
- **Observed:** The booking link setting (`demo.unclutterdesk.com` format) should be separate from the custom hostname settings.
- **Feedback / decision:** The Booking link and the Custom domain are now separate sections, each with its own save.
- **Fix:** `45230c9` on `dev`.
- **Verified:**

### SET-03 · No custom hostname setup
- **Type:** Feature · **Priority:** P2 · **Status:** Deferred
- **Observed:** There's no place to set a custom hostname: add a domain, see the DNS records to add, auto-configure it, and so on.
- **Feedback / decision:** Decided 1 Oct 2026. Today a domain can be typed and verified, but nothing provisions it, so it never goes live.
  1. **Provider: Cloudflare for SaaS** (custom hostnames). It issues each practice's certificate automatically. Needs the Cloudflare zone ID and an API token with SSL and Certificates: Edit. The first 100 custom hostnames are free, then a small fee each (confirm before building).
  2. **Plans: Pro and Clinic**, as the API already enforces. Starter keeps its unclutterdesk.com booking link.
  3. **Automatic set-up with Domain Connect:** the practice clicks "Connect automatically", is taken to their DNS provider (Cloudflare, GoDaddy and others support Domain Connect), approves, and the records are added for them. This needs our Domain Connect template published and approved by each provider. Where a provider doesn't support it, show the exact records with copy buttons and step-by-step guides (Cloudflare, GoDaddy, Namecheap, Whogohost). Either way, check automatically until the domain is live and email the practice when it is. We never ask for a practice's registrar login.
  - **Coming soon (decided 1 Oct 2026):** not built now. Until then, Brand settings shows the Custom domain section as "Coming soon" (no domain field or Verify button), and the booking link stays the practice's address.
  - Also **Remove domain**, which deletes it at Cloudflare. Booking emails, the calendar invite and CORS switch to the domain only once it's active (as today).
- **Fix:** Not built (coming soon). Until then Brand settings shows the Custom domain section as "Coming soon" and setup no longer offers a custom domain (873fd6f, with BKG-09).
- **Verified:**

### SET-04 · Link, logo and colours set in setup don't show afterwards
- **Type:** Bug · **Priority:** P0 · **Status:** Fixed
- **Observed:** The booking link, logo and colours chosen in setup didn't seem to stick, even after setup was finally completed (after several refreshes and sign-ins).
- **Feedback / decision:** They did save: the database has link `edgdmedia`, both colours and the logo. The app doesn't show them: the colours are hard-coded defaults in `App.tsx` and only change after visiting Brand settings; the logo is never loaded into the app; the booking link comes from the sign-in profile and goes stale after setup changes it. Fix: one shared practice brand, loaded from the server and refreshed after every save, used by the sidebar, links and previews.
- **Fix:** `45230c9` on `dev`. Checked in the browser: after Save, the sidebar logo and colours update straight away, and they survive a reload.
- **Verified:**

### SET-05 · After setup there's nowhere to change the logo or booking link
- **Type:** Bug · **Priority:** P1 · **Status:** Fixed
- **Observed:** Once setup is done, there's no other place to set the logo, link or colours again.
- **Feedback / decision:** Settings → Brand & booking page has the colours and the custom domain, but no logo upload and no booking-link field. Fix: that page gets the full set (logo, colours, booking link, then custom domain as its own section), sharing its pieces with setup. Covers SET-01 part 2 and SET-02.
- **Fix:** `45230c9` on `dev`. Settings → Brand & booking page now has logo, colours, name, email, booking link, and custom domain as its own section.
- **Verified:**

### SET-06 · Online, in person or both, and several locations
- **Type:** Feature · **Priority:** P1 · **Status:** Ready
- **Observed:** There's no point where a practice says whether it offers online sessions, in-person sessions or both, and only one optional address (Practice profile), which the booking form never shows. Every bookable time is created as online.
- **Feedback / decision:** Decided 1 Oct 2026. (1) A practice can have **several locations**. (2) The format is **dynamic per block of time**: for each block of hours the practice decides online, in person (at a location) or either, and a therapist who only works online only ever has online times, so their clients only see online slots. Design drafted in `docs/superpowers/specs/2026-10-01-session-formats-and-locations-design.md`. The three open questions were settled on 1 Oct 2026: length per service, set by the practice; the address, directions and a Google Maps link arrive in the booking details, with no location picker; no location hours, only therapist hours. **Design complete; ready to plan.**
- **Fix:** `32a1e79`–`9b3d375` on `dev` (the formats-and-locations plan). Practices manage named **Locations** (Settings → Locations, `4e8c242`); each therapist says what they see clients as ("Sees clients" + "Works at" on My profile); the repeating week is stored data (`TherapistWeeklyTime`) and **every session time carries its own formats and location** — the Availability page lays times out as tiles with an Online / In person / Either chooser, a per-day "Set all … times to", and an Upcoming list where one date can be changed for that day only (booked times locked, "Back to weekly" restores). Everything migrates to online, so nothing changes until a practice turns in person on.
- **Verified:** Browser check 2 Oct (local): added a second location, set Jane to both formats at Lekki, switched a weekly time to "Either · Lekki clinic" (a location she does not work at was refused with the exact message), and a client saw "Online or In person · Lekki clinic" on that time.

### SET-07 · Different prices online and in person
- **Type:** Feature · **Priority:** P1 · **Status:** Ready
- **Observed:** Some practices charge differently for online and in-person sessions, but a service has one price.
- **Feedback / decision:** Decided 1 Oct 2026: price **per service, per format** (for example Individual Therapy online ₦30,000, in person ₦35,000; they can be the same). Part of the same design, `docs/superpowers/specs/2026-10-01-session-formats-and-locations-design.md`. **Design complete (see SET-06); ready to plan.**
- **Fix:** `9b61799` on `dev`. Services have one price per format (`ConsultServiceFormat`); the settings page shows an Online row and an In-person row, each with a switch, a price and "Same price for both". `ConsultService.priceKobo` stays as the cheapest active price so older screens keep working; a legacy price-only edit reprices the online row.
- **Verified:** Browser check 2 Oct: Individual Therapy set to online ₦30,000 / in person ₦35,000; the service card and the booking summary show both.

### SET-08 · Photo and logo uploads show no progress or result
- **Type:** UX · **Priority:** P2 · **Status:** Open
- **Observed:** Uploading a profile photo or practice logo gives no sign it's working, finished or failed.
- **Feedback / decision:** Proposed: one shared image upload control (the logo field from SET-04/05 extended) with a preparing/uploading state, a preview, a clear error when the file is refused, and a confirmation once saved. Use it for both the practice logo and profile photos.
- **Fix:** `b4cab4e`–`71a7449` on `opencode/walkthrough-uploads`. One `ImageField` (preparing / saving / saved / error, previous image restored on failure) backs both the logo field and the dashboard's profile photo; the photo now posts to `/v1/consult/therapist/profile/avatar`, which validates like the logo (`cleanImageUrl`) and accepts clearing. Covered by `ImageField.test.tsx`, `DashboardProfilePhoto.test.tsx`, `therapist-avatar.spec.ts`.
- **Verified:** Browser check on the worktree (ports 3299/5273): a chosen photo shows Saving… → Saved and survives a reload; the account-menu avatar refreshes.

### SET-09 · Discounts can be turned off, but not back on, edited or deleted
- **Type:** Bug · **Priority:** P1 · **Status:** Open
- **Observed:** In Discounts & promos a practice discount can be deactivated, but once off there is no way to turn it back on, edit it, or delete it.
- **Feedback / decision:**
- **Fix:** `90fb3f0`–`b42c8e3` on `dev`. `PATCH /v1/discount/:id` now takes `isActive` (and the amount fields) and only writes the fields sent — the old update blanked label/maxUses/expiresAt when you touched one. A new `DELETE /v1/discount/:id/remove` deletes for good (past bookings keep the code text). The list gains **Turn on / Turn off / Edit / Delete** per row; the create modal doubles as the editor. Covered by `discount-manage.spec.ts` and `DiscountSettingsPage.test.tsx`.
- **Verified:** Browser check 2 Oct (local): WELCOME20 turned off and back on, label edited and saved, a throwaway code created and deleted after the confirm.

### SET-10 · Google Calendar shows "Connect" again after it was connected
- **Type:** Bug · **Priority:** P2 · **Status:** Ready
- **Observed:** The Availability page only knows it is connected right after the Google redirect (it reads ?google_connected=true from the address).
- **Feedback / decision:** Decided 2 Oct 2026. The server reports whether the therapist's Google account is connected; the page shows "Connected to Google Calendar · Disconnect".
- **Fix:** 
- **Verified:** 

### SET-11 · A longer service can't use the normal session times
- **Type:** Feature · **Priority:** P2 · **Status:** Ready
- **Observed:** Availability's length decides each slot; a service longer than the slot is hidden at those times, a shorter one takes the whole slot.
- **Feedback / decision:** Decided 2 Oct 2026. The availability length is the slot. A service up to one slot takes one; a longer one takes back-to-back slots (80 minutes at 9:00 uses the 9:00 and 10:00 slots, ends 10:20), all free and all allowing the chosen format. Clients see only start times where enough slots are free, shown as "9:00 – 10:20". Do after the formats and locations work lands.
- **Update:** 2 Oct 2026: approved to build (after the formats and locations work lands).
- **Fix:** 
- **Verified:** 

### SET-12 · "Active sessions" lists the same browser many times
- **Type:** Bug · **Priority:** P2 · **Status:** Ready
- **Observed:** Every sign-in creates a session that lasts until it expires; re-logins, switching practice/admin and closed tabs pile up.
- **Feedback / decision:** Decided 2 Oct 2026. A new sign-in from the same browser replaces its old session; sessions unused for 14 days end. The card shows this device and the two most recent, then "Show all (N)", with "Sign out other devices".
- **Fix:** 
- **Verified:** 

## Client booking link / page

### BKG-01 · Booking page layout is incoherent
- **Type:** UX · **Priority:** · **Status:** Fixed
- **Observed:** The design looks bad and doesn't work. There's empty space that serves no purpose, no visual coherence, and the elements don't work together.
- **Feedback / decision:** Designs done (1 Oct 2026): `docs/design/design_handoff_booking_wizard/` (README + screenshots). Decided: Paystack opens as a **pop-up** over the wizard; build the wizard **now**, with the format labels, filter, address and the forms section switching on once SET-06 and BKG-06 provide the data; **Notify me** is later (BKG-08). Plan Task 9.
- **Fix:** `c161e99..7b42194` on `dev` (plan `docs/superpowers/plans/2026-10-01-booking-wizard.md`). `/book` is the step-by-step wizard, with a Paystack pop-up, bank-transfer hold and confirmation. Browser-checked at 390, 820, 1024 and 1280px; the Paystack test pop-up opens with the right amount. A test-card payment wasn't completed in the browser.
- **Verified:**

### BKG-02 · Practice logo never loads
- **Type:** Bug · **Priority:** P1 · **Status:** Fixed
- **Observed:** The practice's logo never loads on the booking page.
- **Feedback / decision:** The page simply never read the saved logo. A shared `PracticeLogo` component now renders it in the booking header, falling back to the initials badge when there is no logo or the image fails.
- **Fix:** `05bb601` on `dev`, after `d49d37e` gave logos a real URL. Covered by `PracticeLogo.test.tsx`; checked live on `dr-smith.localhost:5173/book` at 1280px and 390px.
- **Verified:**

### BKG-03 · "Book now" should be a step wizard
- **Type:** UX · **Priority:** · **Status:** Fixed
- **Observed:** **Book now** shows everything at once. It should be a step-by-step wizard.
- **Feedback / decision:** Designs done (1 Oct 2026): `docs/design/design_handoff_booking_wizard/` (README + screenshots). Decided: Paystack opens as a **pop-up** over the wizard; build the wizard **now**, with the format labels, filter, address and the forms section switching on once SET-06 and BKG-06 provide the data; **Notify me** is later (BKG-08). Plan Task 9.
- **Fix:** `c161e99..7b42194` on `dev` (plan `docs/superpowers/plans/2026-10-01-booking-wizard.md`). `/book` is the step-by-step wizard, with a Paystack pop-up, bank-transfer hold and confirmation. Browser-checked at 390, 820, 1024 and 1280px; the Paystack test pop-up opens with the right amount. A test-card payment wasn't completed in the browser.
- **Verified:**

### BKG-04 · Is client sign-in tied to the practice?
- **Type:** Question · **Priority:** P2 · **Status:** Fixed
- **Observed:** It's unclear whether a client's sign-in belongs to one practice, or whether one account can book with any practice and sign in everywhere.
- **Feedback / decision:** Keep one account per client (decided 30 Sep 2026). The client sees their sessions with whichever practice they're booking with, and each practice sees only what concerns it. This is already how the data works. The booking sign-in will say so in one line. Plan Task 8.
- **Fix:** `054a8c9` on `dev`. One line under the booking sign-in/create panel; covered by `ClientAuthPanel.test.tsx`. Portal tenancy was already asserted in `consult.service.spec.ts` (queries scoped by tenant and the session's profile id).
- **Verified:**

### BKG-05 · Session format should follow the practice's slot options
- **Type:** Bug · **Priority:** · **Status:** Ready
- **Observed:** The session format on the booking form should depend on the options the practice offers for each booking slot.
- **Feedback / decision:** The format comes from each time slot, as set per block of hours (see SET-06), and the price from the service's price for that format (SET-07). Design in `docs/superpowers/specs/2026-10-01-session-formats-and-locations-design.md`. **Design complete (see SET-06); ready to plan.**
- **Fix:** `105c882`/`fc588ff` on `dev`. Slot rows carry `formats` and their location; the wizard shows each time's format, and a time that allows both asks **"How would you like to meet?"** on the pay step with both prices — Pay is disabled until a choice. The server re-checks the rules and charges the chosen format's price (discount applied to it).
- **Verified:** Browser check 2 Oct: the Either time asked the client online-or-in-person; choosing in person moved the total to ₦35,000 and the booking stored `IN_PERSON` + the Lekki location with no video room.

### BKG-06 · Default intake and confidentiality forms
- **Type:** Feature · **Priority:** · **Status:** Ready
- **Observed:** Two forms matter: **Client intake** and **Confidentiality**. We still need to decide whether they're filled in at booking or after it. Every new practice should get a default template for both, which the practice can then edit.
- **Feedback / decision:** Every practice gets both forms by default and can edit the wording. Clients receive them after booking, to complete before the first session (decided 30 Sep 2026). Plan Task 11.
- **Fix:** `a868bde`–`0179a3c` on `dev`. Every practice gets a **Client intake** and a **Confidentiality** form (`default-forms.ts`, created on signup/tenant-create, backfilled by `scripts/backfill-default-forms.mjs`); both are editable (PHQ-9/GAD-7 stay locked). The confirmed email and the wizard's **What's next** list the ones the client still owes, opening `/forms/:id` on the practice host; submissions link to the signed-in client. The session page shows "Intake: done / waiting". Covered by `default-forms.spec.ts`, `portal-forms.spec.ts`, `ClientFormPage.test.tsx`, `SessionDetailPage.test.tsx`.
- **Verified:** Browser check 1 Oct: client filled the intake from the emailed link; the session page then read "Intake: done · Confidentiality: waiting".

### BKG-07 · Hard-coded location in the booking page header
- **Type:** Bug · **Priority:** P1 · **Status:** Ready
- **Observed:** Found while checking SET-06. The booking page header says "Lagos, Nigeria · Online & in-person" for every practice, whatever it offers or wherever it is.
- **Feedback / decision:** Replace it with the practice's real cities and formats, as part of SET-06. **Parked with SET-06.**
- **Fix:** `fc588ff` on `dev`. The booking header subtitle is built from the practice's public info — its real cities and formats (`GET /v1/tenant/public/info` now returns `locations` and `formats`); the profile page's location line likewise.
- **Verified:** Browser check 2 Oct: the in-person confirmation and email carry "Lekki clinic, 20 Ozumba Mbadiwe Ave, Lagos" with an Open-in-Google-Maps link and no join link; the email log confirms it.

### BKG-08 · "Notify me" when there are no free times
- **Type:** Feature · **Priority:** P3 · **Status:** Deferred
- **Observed:** The booking wizard design offers "Notify me" (enter your email) when a practice has no free times in the next 4 weeks.
- **Feedback / decision:** Later (1 Oct 2026). Until then the wizard shows the practice's email and phone in that state. Needs a waiting list: store the email, and email the client when times open up.
- **Fix:**
- **Verified:**

### BKG-09 · An abandoned online payment keeps the time blocked
- **Type:** Bug · **Priority:** P1 · **Status:** Fixed
- **Observed:** Found in the booking wizard's final review (1 Oct 2026). A booking waiting for online payment (`PENDING_PAYMENT`) has no hold expiry, unlike bank-transfer holds (48h). If a client closes Paystack and leaves, or picks a different time, the first booking stays pending and its time can't be booked by anyone until staff cancel it. The old one-page booking form had the same gap; the wizard makes it a little more likely.
- **Feedback / decision:** Decided 1 Oct 2026. Paystack facts checked: Pay-with-Transfer account numbers expire after **30 minutes** (a transfer after that is refunded by Paystack automatically; [docs](https://support.paystack.com/hc/en-us/articles/360018995019-Pay-with-Transfer)), while a card checkout's access code can stay payable for roughly **24 hours** (no published limit). So a late payment can't be prevented, only handled. Design:
  1. **Hold 35 minutes** from Pay (30-minute transfer window plus 5 for a slow webhook), shown as a countdown on the pay step and "held until 3:42 PM" in the pay email.
  2. **Before releasing**, ask Paystack (verify the reference): paid → confirm; not paid → cancel, reopen the time, email the client "your hold ended, book again".
  3. **Late payment** (card paid after release): re-confirm automatically if the time is still free; if it's been taken, **refund automatically** through Paystack, and tell the client and the practice.
  4. **Retry** from the email or pay page: a fresh 35-minute hold if the time is still free; if not, show other times instead of taking payment.
- **Fix:** branch `fix/bkg-09-online-hold` (see the merge on dev): 35-minute online hold and Paystack refunds; one BookingPaymentSettler for webhook, pop-up and expiry job (confirm once, re-confirm a released hold whose time is free, otherwise a full refund with the reason told to client and practice); retry restarts or re-claims the hold; the expiry job asks Paystack before releasing; pay emails say until when and carry the pay-page token (the link never opened before); countdown on the pay step, "Try again" on the pay page.
- **Verified:** 2 Oct 2026, live against Paystack test mode on a copy of the local database: booking 27 held exactly 35 minutes with a 34:56 countdown; expired hold → the job asked Paystack, released it, reopened the time and emailed "Your held time was released"; the tokenised pay link offered "Try again", which re-claimed the time with a fresh 35-minute hold; paid with Paystack's test checkout; marked released with the time still free, the signed charge.success event re-confirmed it (one confirmation email, Paystack's paid time). Booking 28: paid, released with its time taken → a real test-mode refund of ₦35,000 was created at Paystack, the client was told why and the practice was notified; replaying both events did nothing more. API 1052, app 389 tests pass.

### BKG-10 · No offer to the client's account after booking
- **Type:** UX · **Priority:** P1 · **Status:** Fixed
- **Observed:** After booking, the client isn't offered their dashboard (portal) to manage the booking: reschedule, cancel, pay, forms, join link.
- **Feedback / decision:** Proposed: the confirmation screen gets a primary "Go to my bookings" (the client portal, already signed in), and the booking emails link there too.
- **Fix:** `60ba7a5` on `dev`. The confirmation screen's first action is **Go to my bookings** → `/portal`; the confirmed email carries the portal link too. Covered by `ConfirmationStep.test.tsx`.
- **Verified:** Browser check 1 Oct: the button is the confirmation screen's first action and points at `/portal`.

### BKG-11 · The booking link doesn't carry the new wizard design
- **Type:** Bug · **Priority:** P1 · **Status:** Open
- **Observed:** Opening the practice's booking link shows a page that doesn't match the new booking wizard: the layout is too wide and the practice logo is missing.
- **Feedback / decision:**
- **Fix:** `a26fa91` on `dev`. The profile page header now shows the practice's own logo (`PracticeLogo`, initials fallback) and name where the platform mark sat, and the content measure drops from 1320px to the wizard's 960px. Covered by `PublicProfilePage.test.tsx`.
- **Verified:** Browser check 2 Oct on the practice host at 1280px and 390px: header reads "Dr. Jane Smith Therapy", no horizontal overflow.

### BKG-12 · Confirmation actions should share a row; calendar links can be one dropdown
- **Type:** UX · **Priority:** P3 · **Status:** Open
- **Observed:** On the booking confirmation, "Go to my bookings" sits on its own row above the calendar buttons, and "Add to calendar" and "Google Calendar" are two separate buttons.
- **Feedback / decision:** Put "Go to my bookings" in the same row as the calendar actions, and collapse the two calendar options into one button with a dropdown of the two.
- **Fix:** `d140a51` on `dev`. **Go to my bookings** and one **Add to calendar ▾** button share a single row; the dropdown holds "Download (.ics)" and "Google Calendar" (Esc/click-away close it). Covered by `ConfirmationStep.test.tsx`.
- **Verified:** Browser check 2 Oct: after a real test payment the two actions sit in one flex row and the menu opens with both links.

### BKG-13 · The public profile shows the bio twice; no tagline anywhere
- **Type:** Bug · **Priority:** P2 · **Status:** Fixed
- **Observed:** 5 Oct 2026, live testing. On the practice's public profile the one `welcomeMessage` renders both under the hero name and in "About the Practice" — the same long paragraph twice, where a short tagline and a full bio were intended. There is no tagline field in Settings → Practice profile (its label even reads "Bio / tagline").
- **Feedback / decision:** The hero carries a one-line tagline; the About section carries the bio, once. Add a Tagline field to the practice profile (and the therapist profile, which the public page prefers).
- **Fix:** New `tagline` column on Tenant and ConsultTherapistProfile (migration `20261005100000_practice_tagline`), carried through the public info/therapists endpoints and both profile updates. The hero now renders the tagline (therapist first, then practice) and the bio appears only in About; a practice with no tagline shows no hero line. "Bio / tagline" in Settings → Profile split into **Tagline** (one line) and **Bio**; Therapist profile got the same. Covered by `PublicProfilePage.test.tsx`.
- **Verified:** 5 Oct 2026 in the browser: saved a tagline on dr-smith's practice profile; the public page shows the tagline once in the hero and the bio once in About (counts 1 and 1).

### BKG-14 · The public profile misses details from the design
- **Type:** UX · **Priority:** P2 · **Status:** Ready
- **Observed:** 5 Oct 2026, against `docs/design/Unclutter Desk Public Practice Profile.dc.html`. The About section has no headline (the design's *"A calm, evidence-based approach to therapy"* — the `welcomeTitle` field exists in the database and API but nothing renders or edits it); the hero lacks the design's secondary **Learn More** button; the Location & Format card prints a synthesised "In person in Lagos" instead of the practice's real location names (PracticeLocation records exist and ship in the public payload unused). Availability and Insurance were compared and decided against: keep "Next Available" as implemented, and "Insurance Accepted" is dropped from the design.
- **Feedback / decision:** Founder 5 Oct 2026: no insurance section; availability stays as it is. Most of the "empty" look is unfilled data — Specialty, Credentials, Years, Modalities and Languages live in **Account menu → My profile**, not the practice profile.
- **Fix:** `d807f77` and `255d676` on `dev`: the About section renders `welcomeTitle` as the design's headline — now editable as **Welcome headline** in Settings → Practice profile (the API already accepted it); the hero gained the secondary **Learn More** button which smooth-scrolls to About (only shown when there is an About to see); the Location & Format card lists the practice's real PracticeLocation records ("Lekki clinic · Lagos") plus "Online via secure video" when an online format is on. Covered by `PublicProfilePage.test.tsx`.
- **Verified:** 5 Oct 2026 browser check: set the headline on dr-smith's profile; the public page shows it, Learn More scrolls to #about, and the locations card lists both saved rooms and the online line. 

### BKG-15 · "Log in" on the practice's page sends clients to the staff login
- **Type:** Bug · **Priority:** P1 · **Status:** Ready
- **Observed:** 5 Oct 2026, live on the custom domain. On `consult.unclutter.com.ng` the client's "Log in" links to `app.unclutterdesk.com/login`, which is designed for signing in to a practice, not as one's client. Even the practice host's own `/login` renders the staff form.
- **Feedback / decision:** Clients should stay on the practice's host and get the client sign-in (the panel from the booking wizard). Staff keep their page, reachable via a quiet "Are you the practice? Staff sign in" link.
- **Fix:** On a practice host (`getAppType() === 'booking'`) `/login` now renders `ClientLoginPage.tsx` — the branded client panel (Sign in / Create account, `initialMode` added to `ClientAuthPanel`) landing on `/portal` — and the public page's "Log in" became the relative `/login`. The app host's `/login` is untouched; the client page offers staff a link back to it. Tested in `ClientLoginPage.test.tsx` and `PublicProfilePage.test.tsx`.
- **Verified:** 5 Oct 2026 browser check: on dr-smith.localhost, "Log in" opened the client page (staff link visible), creating an account landed straight on /portal signed in; app-host staff login unchanged. Test client removed afterwards. (The same fix serves the portal's "Sign in to see your sessions" card, which already links to `/login`.)

### VID-01 · The session room isn't a real video call
- **Type:** Feature · **Priority:** P0 · **Status:** Fixed
- **Observed:** The telehealth room (`TelehealthVideoRoomPage.tsx`, the designed video screen) is a mock-up labelled "Room preview" with the client's initials; there's no camera or call in it.
- **Feedback / decision:** Decided 1 Oct 2026.
  - **Daily is the default for every plan**, running inside our designed room (our own mute, camera and leave buttons; private rooms with short-lived access tokens per session). Pricing checked: 10,000 free participant-minutes a month, then $0.004 per participant-minute, about 100 one-to-one 50-minute sessions free a month, then about $0.40 a session ([Daily pricing](https://www.daily.co/pricing/video-sdk/)).
  - **JaaS (hosted Jitsi) in reserve**, behind the same provider interface: embeddable from 8x8.vc and protected (every room needs a JWT signed with our key). Free up to 25 monthly active users, then from $99/month for 300 ([JaaS](https://jitsi.org/jaas/)).
  - **The free meet.jit.si can no longer be embedded** in other sites, so it stops being the default.
  - **Google Meet stays opt-in** per therapist, created in the therapist's own Google account (as today), so the therapist is host. It opens in a new tab and can't be embedded. Free Google accounts allow one-to-one calls up to 24 hours, but 3 or more people only 60 minutes.
  - **Provider by monthly budget** (decided 1 Oct 2026): the provider is chosen when a session's room is created, so a call is never switched mid-way. (1) **Daily** until this month's participant-minutes reach a set limit (e.g. 9,500 of the free 10,000), counted from Daily's per-session participant durations (REST `/meetings` and the `meeting.ended` webhook). (2) **JaaS** in the same room until about 23 of its 25 free monthly active users (each distinct person who joins counts). (3) **Opens in a new tab**: the therapist's own Google Meet if connected, otherwise meet.jit.si. It resets to Daily each month. The limits are settings, so Daily's can be raised later (about $0.40 a session) instead of switching.
  - **Later:** replace JaaS with a self-hosted Jitsi server (same embedding API), when usage grows.
  - **Usage records** (decided 1 Oct 2026): every video session stores practice, therapist, provider, start, end and participant-minutes. The router reads the monthly totals, and the admin console shows minutes by month, practice and provider for planning.
  - To confirm in the JaaS dashboard before building: what the free plan does at the 26th user (blocked or prompted), and the paid per-user price (about $0.35 per user per a third-party summary).
  - Needs a Daily account and API key, and a JaaS app (app ID and signing key), before building. ONB-08 (setup asks for the video platform) follows from this.
- **Update:** 2 Oct 2026: the Daily and JaaS keys are set in the API .env; ready to build.
- **Fix:** `a58ff01`–`642e638` on `feat/video-rooms`. Online sessions run in the session room for therapist (`/session/:id`) and client (`/portal/sessions/:id/room`): Daily in the page first, JaaS once Daily's monthly minutes are spent, then a meet.jit.si link in a new tab (`VideoRouter`, budgets in `VIDEO_DAILY_MONTHLY_MINUTES` / `VIDEO_JAAS_MONTHLY_USERS`). The room is made on the first join, once per booking, and admits only the booking's client, its therapist and clinical staff, from 15 minutes before to 60 after. Every join and minute is recorded (`VideoParticipant`, heartbeat each minute, Daily's own durations via the `meeting.ended` webhook); Admin → Video usage shows each month by provider and practice. Emails, calendar invites and pages link into the room, never to a provider. Google Meet stays available through the therapist's own Google. Also fixed on the way: the portal, therapist bookings and session prep failed for every booking on `dev` (`e7fa44b`); the portal's next session is now the soonest and stays joinable while in progress.
- **Verified:** 2 Oct 2026, locally on a database copy (Edge): the link fallback end to end (room made once and kept for the booking, usage rows written), the therapist room with notes beside the video, the client room, and no sideways scroll at 390px. **Still to verify on the server:** a real Daily call and a JaaS call between two browsers, the budget fall-through, and the webhook. The Daily and JaaS keys are not in the local `.env` files.

## Client portal

### POR-01 · The portal only works on the app host, not on the practice's link
- **Type:** Bug · **Priority:** P1 · **Status:** Open
- **Observed:** https://unclutter.unclutterdesk.com/portal does not work; the client portal only loads on app.unclutterdesk.com. Clients who booked from a practice subdomain (and emails/confirmation links that point at /portal on the practice host) don't get their portal.
- **Feedback / decision:**
- **Fix:** `e5af52e`–`1570f5b` on `dev`. The client pages (`/portal`, `/portal/assessments/:id`, `/forms/:id`, `/login`, `/set-password`) moved into one shared fragment (`routes/clientRoutes.tsx`) that the app tree and the practice-host tree both render, wrapped in a `ClientBrandProvider` so they carry the practice's name, logo and colours from its public info. The tenant already resolves from the host and the session cookie lives on the api domain, so the signed-in client works anywhere under unclutterdesk.com. Covered by `clientRoutes.test.tsx`; the route-integrity check reads the new file too.
- **Verified:** Browser check 2 Oct: booked on dr-smith.localhost:5173, "Go to my bookings" landed on dr-smith.localhost:5173/portal — branded header, client signed in, sessions listed.

### POR-02 · The portal should look like a dashboard
- **Type:** UX · **Priority:** P2 · **Status:** Open
- **Observed:** The client portal is a plain list; it needs a better design that reads like a dashboard.
- **Feedback / decision:**
- **Fix:** `7fed377` on `dev`. The portal now leads with four dashboard tiles — Next session, Upcoming sessions, To pay, Forms to do (from `/v1/intake/mine/forms`, never blocking the page on failure) — and the header carries the practice logo. The payments tab stays lazy (its existing "not fetched until opened" test still passes). Covered by `ClientPortalPayments.test.tsx`.
- **Verified:** Browser check 2 Oct: tiles read "9 Oct 2026 / 1 / ₦0 / 2" for a fresh client on the practice host; no overflow at 390px.

### POR-03 · The portal should use the same dashboard frame as practice and admin
- **Type:** UX · **Priority:** P2 · **Status:** Fixed
- **Observed:** The portal has dashboard tiles (POR-02) but not the shared frame.
- **Feedback / decision:** Decided 2 Oct 2026. Sidebar on desktop, bottom bar on phones, in the practice's colours and logo, with the notification bell. Menu: Home, Sessions, Forms & assessments, Payments, My details.
- **Fix:** The portal is five pages inside the shared AppShell frame (plan `docs/superpowers/plans/2026-10-03-client-portal-redesign.md`). `ClientShell.tsx` + `clientNav.tsx` give the sidebar (collapsible rail), the phone bottom bar, the bell and the account menu in the practice's logo and colours; `PortalDataContext.tsx` loads the portal once for all pages; Home / Sessions (`?view=past` in the URL) / Forms & assessments / Payments (fetched only on its page) / My details replace the old tabbed `ClientPortalPage`, nested under `/portal` in `clientRoutes.tsx` so both hosts serve them. Signed out, the shell renders only the sign-in card — POR-06's guarantee moved up a level and is tested (`ClientPortalSignedOut.test.tsx`). Commits 0764694, f3ee7fc, ecb5ce6, 63fb055.
- **Verified:** 4 Oct 2026 in the browser as a new client on dr-smith.localhost at 1280px (sidebar and collapsed rail) and 390px: all five pages in the frame, practice branding, no horizontal scroll; Home's tiles matched Payments. Found and fixed while checking: the hero's buttons overflowed phones, and the booking confirmation printed the slot's default channel instead of the format chosen (1c6b69a, regression test added).

### POR-04 · Clients can't book a session from the portal
- **Type:** Feature · **Priority:** P1 · **Status:** Fixed
- **Observed:** There is no "Book a session" in the portal.
- **Feedback / decision:** Decided 2 Oct 2026. "Book a session" on the portal home and Sessions page opens the booking wizard, already signed in, for the same practice.
- **Fix:** `BookSessionButton.tsx` sits in the Home, Sessions and Payments page headers. `bookingHref` keeps the link on `/book` on a practice's own host (already signed in there) and builds the practice's full address from app.unclutterdesk.com — the session cookie lives on the api domain, so the client stays signed in across the hop (523f3cc). Unit-tested in `BookSessionButton.test.tsx`.
- **Verified:** 4 Oct 2026 in the browser: from dr-smith.localhost/portal the button stayed on the practice host and a full booking (account created in the wizard, Paystack test, online ₦30,000) landed on Home and Sessions; from localhost:5173/portal, signed in as the same client, the button's href was the practice's own host (Review Focus 3).

### POR-05 · No "Add to calendar" for sessions in the portal
- **Type:** UX · **Priority:** P2 · **Status:** Fixed
- **Observed:** Only the booking confirmation offers calendar links.
- **Feedback / decision:** Decided 2 Oct 2026. Each upcoming session in the portal has the same "Add to calendar" dropdown as the confirmation (Google Calendar, Apple/Outlook .ics).
- **Fix:** The confirmation's menu was extracted into shared `AddToCalendar.tsx` (.ics download with the booking token + prefilled Google link) and put on every upcoming, un-cancelled session card; the card's menu opens below since the card sits near the top of the page (6b50da5). Cancelled and past rows show neither it nor Reschedule. Tested in `AddToCalendar.test.tsx` and `PortalPages.test.tsx`.
- **Verified:** 4 Oct 2026 in the browser: on the Sessions page the menu opened below the button, booking-29.ics downloaded, the Google link carried title and times, and Escape closed the menu.

### POR-06 · Portal shows your sessions and "Sign in" at the same time after a while away
- **Type:** Bug · **Priority:** P1 · **Status:** Fixed
- **Observed:** 2 Oct 2026. After leaving the portal for a while, it showed "Hello, Olalekan", the next session and Join, and also "Sign in to see your sessions".
- **Feedback / decision:** Either signed in or signed out, never both.
- **Fix:** Cause: the page-load sign-in check (`/v1/auth/status`) was set never to refresh the session. The access cookie lasts 15 minutes and the refresh cookie is only sent to `/v1/auth/refresh`, so after a quiet spell (or a sleeping tab reloading), the check failed and signed the person out, while the portal's own request refreshed and loaded the sessions. Now the check refreshes and retries like every other request (`apiClient.ts`), and a signed-out portal clears everything private. Also affected staff: the dashboard signed people out the same way. Covered by `apiClient.sessionRefresh.test.ts` and `ClientPortalSignedOut.test.tsx`.
- **Verified:** 

### SET-13 · Self-serve custom domains through Cloudflare for SaaS
- **Type:** Feature · **Priority:** P2 · **Status:** Ready
- **Observed:** 5 Oct 2026. A practice's custom domain works (consult.unclutter.com.ng is live) but every domain is manual: an admin adds a Pages custom domain by hand and flips `customDomainStatus` in the database. Nothing promotes the PENDING row Settings saves, and customers cannot do it themselves.
- **Feedback / decision:** Adopt Cloudflare for SaaS — the Free plan zone includes 100 custom hostnames ($0.10/mo each after, 50k max). Cloudflare cannot fall back to a Pages project (no proxy to Cloudflare-owned hosts), so the app must be served from a Worker with the same Vite build as static assets; the API already resolves ACTIVE custom domains from the Host header. Founder 5 Oct 2026: implement — likely the next working day.
- **Scope:** Revised after recon: the tenant-router Worker already serves any host (`*.unclutterdesk.com/*` route; `router.ts` treats foreign hosts as SaaS surfaces), so no app redeploy is needed — each provisioned domain gets its own Worker route. (1) Cloudflare service for custom hostnames + routes; (2) provision on save; (3) status/verify via Cloudflare's verdict; (4) 5-minute cron promotes verified domains, retries unprovisioned, sweeps orphans; (5) Settings panel showing the exact DNS records the practice must publish.
- **Fix:** Code complete on `dev` (plan `docs/superpowers/plans/2026-10-05-self-serve-custom-domains.md`): migration `20261005110000_custom_hostname_id`, `cloudflare-saas.service.ts`, provisioning + CF-aware verify in `tenant.service.ts`, `GET /v1/tenant/brand/custom-domain`, `custom-domain.cron.ts`, `CustomDomainPanel.tsx` on the Brand settings page. All paths no-op when `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID` are absent, so dev/CI keep the old behaviour. Suites: 1200 api / 507 app tests green.
- **Verified:** Awaiting the one-time human steps (add payment method → Enable Cloudflare for SaaS on the zone → create the scoped token → set the three env vars on the VPS — see `docs/CLOUDFLARE_SETUP.md` §5) and the live migration of consult.unclutter.com.ng through the new flow. 

## Forms & templates

### FRM-01 · Save forms as templates, optionally shared
- **Type:** Feature · **Priority:** · **Status:** Fixed
- **Observed:** A practice that builds a useful form should be able to save it as a template, and choose whether to share it with other practices.
- **Feedback / decision:** Decided 1 Oct 2026. **Save as template** in the form editor. Sharing is optional: a shared template is visible to **every practice** in a "Template library" beside their own forms, after **admin approval** through the admin console's Requests queue (clinical forms must not spread unchecked). It's credited "Shared by <practice>" unless the author shares anonymously. **Use template** gives the practice its own copy, so later edits never change the original or anyone else's.
- **Fix:** branch `feat/frm-01-form-templates`: a648604 (FormTemplate model), e63534f (save, share, library, use), dd633ee (admin preview and review; template requests only move through review), 0ad31cc (Save as template, Template library), e4e0ef7 (admin review UI, shared question preview), 1ae33db (approved/not approved wording), 513a3de (built-in assessments refused).
- **Verified:** 2 Oct 2026 in the browser on a copy of the local database: Dr Jane saved Telehealth Consent as a shared template ("In review"); the admin previewed it ("Shared by Dr. Jane Smith Therapy", questions listed) and approved it; the demo practice saw it under "From other practices" with credit, pressed Use and landed in its own copy (form 60, its own practice); the template counted 1 use, the request closed as done with the note, and Dr Jane's notification read 'Form template "Telehealth Consent" is approved'. API 1010, app 378 and UI 83 tests pass, with no type errors.

---

### FRM-02 · The Forms page is wider than a phone screen
- **Type:** Bug · **Priority:** P2 · **Status:** Open
- **Observed:** At 390px the Forms page (Settings → Forms) scrolls sideways: the page has a fixed `min-w-[1192px]` and a three-column card grid, so the form cards and the template library run off the right edge. Found during FRM-01's browser check; it predates FRM-01.
- **Feedback / decision:**
- **Fix:**
- **Verified:**

### FRM-03 · Submissions should show everything clients send, assessments included
- **Type:** Feature · **Priority:** P2 · **Status:** Ready
- **Observed:** A client completed a scored assessment, but Submissions only lists forms; assessment results show only in the client's Assessments panel and on the Assessments page.
- **Feedback / decision:** Decided 2 Oct 2026. A main-menu group **Forms & assessments**: **Submissions** (one inbox for all client submissions, forms and assessment results, filterable by type and client), **Assessments** (library and assignments), **Forms** (your forms and the template library). The client's own panel keeps showing their results.
- **Fix:** 
- **Verified:** 

### FRM-04 · The Forms page still has an "Assessment" type
- **Type:** UX · **Priority:** P2 · **Status:** Ready
- **Observed:** The custom-form "Assessment" category overlaps the scored-assessment library.
- **Feedback / decision:** Decided 2 Oct 2026. Remove "Assessment" from the Forms page and editor. The five default forms exist for every practice: Intake, Review, Consent, Feedback, Confidentiality. Scored assessments live under Assessments.
- **Update:** 2 Oct 2026: the five default forms are drafted and seeded (`868cfa3`; local database backfilled). The Forms page tabs and editor types are still to change.
- **Fix:** 
- **Verified:** 

## Sessions & video

### BKG-13 · Past sessions with no outcome stay "Confirmed" forever
- **Type:** Feature · **Priority:** P1 · **Status:** Ready
- **Observed:** Only Confirmed, Completed and Cancelled exist; nothing happens when a session's time passes.
- **Feedback / decision:** Decided 2 Oct 2026. After its end time, a session without an outcome shows as **Unrecorded** (not "Pending", which already means unpaid) on the therapist's dashboard and session page, with a reminder. Outcomes: **Completed**, **No-show**, **Late cancel**. Never completed automatically. Completed keeps prompting for the session note.
- **Fix:** 
- **Verified:** 

### VID-02 · "Join session" works any time, even days before
- **Type:** Bug · **Priority:** P1 · **Status:** Fixed
- **Observed:** The portal's Join button shows whenever a room link exists and goes straight to meet.jit.si.
- **Feedback / decision:** Decided 2 Oct 2026. The room opens 15 minutes before the session and closes 60 minutes after it ends (as in the VID-01 plan). Before that the button reads "Opens at 9:45 AM". Comes with VID-01's in-app room.
- **Fix:** `5b3cd06`. One `JoinButton` everywhere (portal, confirmation page, session page, session prep): before the room opens it reads "Opens at 9:45 AM" and does nothing, it becomes Join at that minute without a reload, and disappears after. The window comes from `@unclutterdesk/shared` and matches the server's check (a test fails if they differ). Clients no longer receive a provider link.
- **Verified:** 2 Oct 2026, locally: a session starting in 10 minutes showed **Join session**; tomorrow's showed "Opens at 3:15 PM", and its room said "This room opens at 3:15 PM." with **Check again**.

## General / design system

### GEN-01 · Pages set their own widths and hand-write their grids
- **Type:** UX · **Priority:** P2 · **Status:** Ready
- **Observed:** Only 11 pages use the shared Page frame (width cap 1440px / 880px); about 17 practice pages build their own <main>. 43 places use screen-based grid classes (grid-cols-2, md:col-span-2) that ignore the sidebar.
- **Feedback / decision:** Decided 2 Oct 2026. Every page uses Page. Page gains a main-plus-side-panel layout (a sized template like [1fr_372px] for page structure); content inside uses the shared Grid (equal columns, responsive to the page area). Hand-written grids are replaced.
- **Fix:** 
- **Verified:** 

### GEN-02 · The dashboard keeps showing Profile photo and Practice branding cards
- **Type:** UX · **Priority:** P3 · **Status:** Ready
- **Observed:** Setup prompts stay on the dashboard after they are done.
- **Feedback / decision:** Decided 2 Oct 2026. Show each card only until it is done; both stay editable in settings.
- **Fix:** 
- **Verified:** 

### GEN-04 · Settings is twelve loose pages; unrelated things share a page
- **Type:** UX · **Priority:** P2 · **Status:** Ready
- **Observed:** 6 Oct 2026, live testing. Eleven `/dashboard/settings/*` pages sit as separate sidebar links; the Brand page carried custom domain *and* sending-email settings together ("Custom domain and sending email settings shouldn't be on the same page"), and Availability/Services/Discounts/Team each feel like their own app.
- **Feedback / decision:** Founder 6 Oct 2026: collapse Settings into one page with a left tab rail (top tabs on mobile), grouped — **Practice** (Profile · Locations · Brand & booking page), **Booking** (Availability · Services & pricing · Discounts), **Domain & email** (Custom domain · Notifications · Sending domain), **Team & billing** (Team · Subscription · Payouts). Sidebar shows a single Settings entry; role/tier gating moves onto the tabs. Forms keeps its own sidebar home (it is a workspace, not a setting). Implemented together with the GEN-03 menu regrouping — plan `docs/superpowers/plans/2026-10-06-settings-hub-and-menu-regroup.md`.
- **Fix:** 
- **Verified:** 

### GEN-03 · The menu feels disconnected
- **Type:** UX · **Priority:** P2 · **Status:** Ready
- **Observed:** Hours log and Notifications are main-menu items; settings groups mix concerns.
- **Feedback / decision:** Decided 2 Oct 2026. Main: Today, Schedule, Sessions, Clients. Forms & assessments: Submissions, Assessments, Forms. Settings: Booking page (Practice profile, Locations, Brand & booking page); Scheduling & pricing (Availability, Services & pricing, Discounts); Team & staff; Reports; Billing (Payouts, Subscription). Avatar menu: My profile, Hours log, Notification settings, Account & security. The bell is in the header (NOT-06).
- **Fix:** 
- **Verified:** 

## Template for new items

Copy this block under the right area. Add a matching row to the tracker.

```markdown
### XXX-00 · Short title
- **Type:** Bug | UX | Feature | Question · **Priority:** P0–P3 · **Status:** Open
- **Observed:** What happened, where, and the steps to reproduce it.
- **Feedback / decision:**
- **Fix:** commit / PR
- **Verified:** date · environment · who
```

Area prefixes: `ADM` Admin · `NOT` Notifications/Email · `ONB` Onboarding · `SET` Settings · `BKG` Booking page · `VID` Video sessions · `FRM` Forms & templates · `POR` Client portal · `GEN` General
