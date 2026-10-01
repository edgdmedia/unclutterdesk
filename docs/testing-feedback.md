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
| NOT-03 | Notifications | Emails show the sender as no-r...@unclutterdesk.com, not the practice or Unclutter Desk | Bug | P1 | Open |
| NOT-04 | Notifications | "Pay to confirm" email already gives the join link, and points to a payment link that isn't in it | Bug | P1 | Open |
| ONB-01 | Onboarding | Does Direct Payout create a Paystack subaccount automatically? (Yes. The step's copy is wrong) | Bug | P1 | Fixed |
| ONB-02 | Onboarding | Can a practice bring its own Paystack keys? | Question | | Won't fix |
| ONB-03 | Onboarding | Setup step offers online payment and bank transfer | Feature | P1 | Fixed |
| ONB-04 | Onboarding | Payout step says payments are processed by Paystack | UX | P2 | Fixed |
| ONB-05 | Onboarding | No way to set a session as virtual or physical | Bug | | Discuss |
| ONB-06 | Onboarding | No walkthrough after "Go to Dashboard" | Feature | | Ready |
| ONB-07 | Onboarding | Continue in setup fails with "This endpoint requires a practice profile" | Bug | P0 | Fixed |
| SET-01 | Settings | Booking link picked during setup isn't saved, and can't be changed | Bug | P1 | Fixed |
| SET-02 | Settings | Booking subdomain should be a separate setting from the custom hostname | UX | P2 | Fixed |
| SET-03 | Settings | No custom hostname setup (add domain, DNS records, auto-configure) | Feature | | Open |
| SET-04 | Settings | Link, logo and colours set in setup don't show afterwards | Bug | P0 | Fixed |
| SET-05 | Settings | After setup there's nowhere to change the logo or booking link | Bug | P1 | Fixed |
| SET-06 | Settings | No way to say if the practice offers online, in person or both, or to manage several locations | Feature | P1 | Discuss |
| SET-07 | Settings | Services can't have a different price online and in person | Feature | P1 | Discuss |
| BKG-01 | Booking page | Layout is incoherent and doesn't work | UX | | Fixed |
| BKG-02 | Booking page | Practice logo never loads | Bug | P1 | Fixed |
| BKG-03 | Booking page | "Book now" should be a step-by-step wizard | UX | | Fixed |
| BKG-04 | Booking page | Is a client's sign-in tied to one practice or shared across practices? | Question | P2 | Fixed |
| BKG-05 | Booking page | Session format should come from what the practice offers for each slot | Bug | | Discuss |
| BKG-06 | Booking page | Default intake and confidentiality form templates for every practice | Feature | | Ready |
| BKG-07 | Booking page | Header shows a hard-coded "Lagos, Nigeria · Online & in-person" for every practice | Bug | P1 | Discuss |
| BKG-08 | Booking page | "Notify me" when a practice has no free times in the next 4 weeks | Feature | P3 | Deferred |
| BKG-09 | Booking page | An abandoned online payment keeps the time blocked for everyone | Bug | P1 | Discuss |
| FRM-01 | Forms | Save forms as templates and optionally share them with other practices | Feature | | Open |

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
- **Type:** Bug · **Priority:** P1 · **Status:** Open
- **Observed:** Booking emails arrive from "no-r...@unclutterdesk.com" in the inbox list, not "EDGD Media" (the practice) or "Unclutter Desk".
- **Feedback / decision:** To investigate. The code does pass a display name (the practice's name, else `SMTP_FROM_NAME`, else "Unclutter Desk"; `mail.service.ts`), but locally mail goes through Gmail SMTP with `SMTP_FROM` set and `SMTP_FROM_NAME` not set. Gmail rewrites or ignores the From display name when it isn't the signed-in account or a verified "Send mail as" alias. Check what reaches the inbox, and whether production (Resend with a verified domain) shows the name correctly before changing code.
- **Fix:**
- **Verified:**

### NOT-04 · "Pay to confirm" email already gives the join link
- **Type:** Bug · **Priority:** P1 · **Status:** Open
- **Observed:** After booking (before paying), the email says "Almost there — pay to confirm your session… Join link: https://meet.jit.si/… Your payment link is on the confirmation page." So it hands out the session link before payment, and points to a payment link that isn't in the email.
- **Feedback / decision:** One email (`consult.service.ts` `createBooking`, type `bookings.confirmed`) is used for both paid and unpaid bookings. Proposed: while payment is pending, the email has no join link and its button is "Pay ₦X to confirm" (the existing pay link for the booking); bank-transfer holds get the bank details, reference and hold deadline instead. The join link goes out only in the "Your session is booked" email sent when payment is confirmed (by the webhook, the pop-up confirm, or staff marking a transfer paid). Related: BKG-09 (unpaid bookings never expire).
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
- **Type:** Bug · **Priority:** · **Status:** Discuss
- **Observed:** There's nowhere to set whether a session is virtual or physical.
- **Feedback / decision:** Setup will ask "How do you see clients?" (online, in person, both) and add the first location inline (see SET-06). Design in `docs/superpowers/specs/2026-10-01-session-formats-and-locations-design.md`. **Parked.**
- **Fix:**
- **Verified:**

### ONB-06 · No walkthrough after "Go to Dashboard"
- **Type:** Feature · **Priority:** · **Status:** Ready
- **Observed:** When the practice finishes setup and clicks **Go to Dashboard**, there's no basic walkthrough.
- **Feedback / decision:** The setup wizard already works as the checklist. What's needed is a guided walkthrough of the dashboard the first time a practice arrives, which can be replayed from the account menu (decided 30 Sep 2026). Plan Task 10.
- **Fix:**
- **Verified:**

### ONB-07 · Continue in setup fails with "This endpoint requires a practice profile"
- **Type:** Bug · **Priority:** P0 · **Status:** Fixed
- **Observed:** Clicking Continue on the Brand step returned a 403 from `PATCH /v1/tenant/brand`.
- **Feedback / decision:** Cause: the browser was signed in as `admin@unclutterdesk.com` (the admin console shares the browser's sign-in), and the setup page carried on with the practice's saved draft. Fix: setup needs a practice account (signed out goes to sign-in; admin or client accounts get "Sign in as the practice"); open tabs follow sign-ins made in other tabs; each practice's setup draft is stored separately, because it held bank details visible to any account in the browser.
- **Fix:** `5808ffc` on `dev`. Covered by `OnboardingAccess.test.tsx` and `AuthContext.crossTab.test.tsx`.
- **Verified:**

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
- **Type:** Feature · **Priority:** · **Status:** Open
- **Observed:** There's no place to set a custom hostname: add a domain, see the DNS records to add, auto-configure it, and so on.
- **Feedback / decision:**
- **Fix:**
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
- **Type:** Feature · **Priority:** P1 · **Status:** Discuss
- **Observed:** There's no point where a practice says whether it offers online sessions, in-person sessions or both, and only one optional address (Practice profile), which the booking form never shows. Every bookable time is created as online.
- **Feedback / decision:** Decided 1 Oct 2026. (1) A practice can have **several locations**. (2) The format is **dynamic per block of time**: for each block of hours the practice decides online, in person (at a location) or either, and a therapist who only works online only ever has online times, so their clients only see online slots. Design drafted in `docs/superpowers/specs/2026-10-01-session-formats-and-locations-design.md`. **Parked: come back to it before building.**
- **Fix:**
- **Verified:**

### SET-07 · Different prices online and in person
- **Type:** Feature · **Priority:** P1 · **Status:** Discuss
- **Observed:** Some practices charge differently for online and in-person sessions, but a service has one price.
- **Feedback / decision:** Decided 1 Oct 2026: price **per service, per format** (for example Individual Therapy online ₦30,000, in person ₦35,000; they can be the same). Part of the same design, `docs/superpowers/specs/2026-10-01-session-formats-and-locations-design.md`. **Parked.**
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
- **Type:** Bug · **Priority:** · **Status:** Discuss
- **Observed:** The session format on the booking form should depend on the options the practice offers for each booking slot.
- **Feedback / decision:** The format comes from each time slot, as set per block of hours (see SET-06), and the price from the service's price for that format (SET-07). Design in `docs/superpowers/specs/2026-10-01-session-formats-and-locations-design.md`. **Parked.**
- **Fix:**
- **Verified:**

### BKG-06 · Default intake and confidentiality forms
- **Type:** Feature · **Priority:** · **Status:** Ready
- **Observed:** Two forms matter: **Client intake** and **Confidentiality**. We still need to decide whether they're filled in at booking or after it. Every new practice should get a default template for both, which the practice can then edit.
- **Feedback / decision:** Every practice gets both forms by default and can edit the wording. Clients receive them after booking, to complete before the first session (decided 30 Sep 2026). Plan Task 11.
- **Fix:**
- **Verified:**

### BKG-07 · Hard-coded location in the booking page header
- **Type:** Bug · **Priority:** P1 · **Status:** Discuss
- **Observed:** Found while checking SET-06. The booking page header says "Lagos, Nigeria · Online & in-person" for every practice, whatever it offers or wherever it is.
- **Feedback / decision:** Replace it with the practice's real cities and formats, as part of SET-06. **Parked with SET-06.**
- **Fix:**
- **Verified:**

### BKG-08 · "Notify me" when there are no free times
- **Type:** Feature · **Priority:** P3 · **Status:** Deferred
- **Observed:** The booking wizard design offers "Notify me" (enter your email) when a practice has no free times in the next 4 weeks.
- **Feedback / decision:** Later (1 Oct 2026). Until then the wizard shows the practice's email and phone in that state. Needs a waiting list: store the email, and email the client when times open up.
- **Fix:**
- **Verified:**

### BKG-09 · An abandoned online payment keeps the time blocked
- **Type:** Bug · **Priority:** P1 · **Status:** Discuss
- **Observed:** Found in the booking wizard's final review (1 Oct 2026). A booking waiting for online payment (`PENDING_PAYMENT`) has no hold expiry, unlike bank-transfer holds (48h). If a client closes Paystack and leaves, or picks a different time, the first booking stays pending and its time can't be booked by anyone until staff cancel it. The old one-page booking form had the same gap; the wizard makes it a little more likely.
- **Feedback / decision:** Needs a decision: (1) how long an unpaid online booking holds its time (e.g. 30 minutes), and (2) what happens if Paystack confirms a payment after that hold has lapsed and the time has gone to someone else (refund, or offer the client another time). Proposed: a 30-minute online hold released by the existing hold-expiry job, with a late payment flagged to the practice to refund or rebook.
- **Fix:**
- **Verified:**

## Forms & templates

### FRM-01 · Save forms as templates, optionally shared
- **Type:** Feature · **Priority:** · **Status:** Open
- **Observed:** A practice that builds a useful form should be able to save it as a template, and choose whether to share it with other practices.
- **Feedback / decision:**
- **Fix:**
- **Verified:**

---

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

Area prefixes: `ADM` Admin · `NOT` Notifications/Email · `ONB` Onboarding · `SET` Settings · `BKG` Booking page · `FRM` Forms & templates · `POR` Client portal · `GEN` General
