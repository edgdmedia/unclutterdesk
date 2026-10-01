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
| ADM-02 | Admin | Admin sidebar doesn't match the app sidebar (account dropdown, Back to Practice) | UX | | Open |
| ADM-03 | Admin | Admin sign-in fields don't match the rest of the app | UX | P2 | Fixed |
| NOT-01 | Notifications | Email branding has no logo | Bug | | Open |
| NOT-02 | Notifications | Email template rendered free text as HTML | Bug | P0 | Fixed |
| ONB-01 | Onboarding | Does Direct Payout create a Paystack subaccount automatically? (Yes. The step's copy is wrong) | Bug | P1 | Fixed |
| ONB-02 | Onboarding | Can a practice bring its own Paystack keys? | Question | | Won't fix |
| ONB-03 | Onboarding | Setup step offers online payment and bank transfer | Feature | P1 | Fixed |
| ONB-04 | Onboarding | Payout step says payments are processed by Paystack | UX | P2 | Fixed |
| ONB-05 | Onboarding | No way to set a session as virtual or physical | Bug | | Open |
| ONB-06 | Onboarding | No walkthrough after "Go to Dashboard" | Feature | | Ready |
| ONB-07 | Onboarding | Continue in setup fails with "This endpoint requires a practice profile" | Bug | P0 | Fixed |
| SET-01 | Settings | Booking link picked during setup isn't saved, and can't be changed | Bug | P1 | Fixed |
| SET-02 | Settings | Booking subdomain should be a separate setting from the custom hostname | UX | P2 | Fixed |
| SET-03 | Settings | No custom hostname setup (add domain, DNS records, auto-configure) | Feature | | Open |
| SET-04 | Settings | Link, logo and colours set in setup don't show afterwards | Bug | P0 | Fixed |
| SET-05 | Settings | After setup there's nowhere to change the logo or booking link | Bug | P1 | Fixed |
| BKG-01 | Booking page | Layout is incoherent and doesn't work | UX | | Discuss |
| BKG-02 | Booking page | Practice logo never loads | Bug | | Open |
| BKG-03 | Booking page | "Book now" should be a step-by-step wizard | UX | | Discuss |
| BKG-04 | Booking page | Is a client's sign-in tied to one practice or shared across practices? | Question | | Ready |
| BKG-05 | Booking page | Session format should come from what the practice offers for each slot | Bug | | Open |
| BKG-06 | Booking page | Default intake and confidentiality form templates for every practice | Feature | | Ready |
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
- **Type:** UX · **Priority:** · **Status:** Open
- **Observed:** The admin sidebar doesn't look or behave like the app sidebar. The biggest gap is the account dropdown, which should include **Back to Practice**.
- **Feedback / decision:**
- **Fix:**
- **Verified:**

### ADM-03 · Admin sign-in fields don't match the rest of the app
- **Type:** UX · **Priority:** P2 · **Status:** Fixed
- **Observed:** The fields on the admin sign-in page look different from the practice sign-in page: white fill, no fixed height, different label size and spacing.
- **Feedback / decision:** The admin page built its own field boxes. It now uses the shared `AuthField`, so both sign-in pages share one field style.
- **Fix:** see the commit "Admin sign-in uses the shared auth field" on `dev`. Checked in the browser: both pages have 52px fields, the same fill and 11.5px labels, and signing in still lands on `/admin`.
- **Verified:**

## Notifications / Email

### NOT-01 · Email branding has no logo
- **Type:** Bug · **Priority:** · **Status:** Open
- **Observed:** The email branding doesn't include the logo.
- **Feedback / decision:**
- **Fix:**
- **Verified:**

### NOT-02 · Email template rendered free text as HTML
- **Type:** Bug · **Priority:** P0 · **Status:** Fixed
- **Observed:** Found while building ADM-01. The shared email template put the title, message, practice name and links into the HTML without escaping them, so a practice name or note containing markup would have been rendered as HTML in the email.
- **Feedback / decision:** Everything the template renders is now escaped, so all emails show it as plain text.
- **Fix:** `d054ed3` on `dev`. Covered by `email.channel.spec.ts`.
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
- **Type:** Bug · **Priority:** · **Status:** Open
- **Observed:** There's nowhere to set whether a session is virtual or physical.
- **Feedback / decision:**
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

## Client booking link / page

### BKG-01 · Booking page layout is incoherent
- **Type:** UX · **Priority:** · **Status:** Discuss
- **Observed:** The design looks bad and doesn't work. There's empty space that serves no purpose, no visual coherence, and the elements don't work together.
- **Feedback / decision:** Approved as a step-by-step wizard (30 Sep 2026). The designs are coming from Claude Design, using the brief in `docs/design/booking-wizard-design-prompt.md`. Plan Task 9.
- **Fix:**
- **Verified:**

### BKG-02 · Practice logo never loads
- **Type:** Bug · **Priority:** · **Status:** Open
- **Observed:** The practice's logo never loads on the booking page.
- **Feedback / decision:**
- **Fix:**
- **Verified:**

### BKG-03 · "Book now" should be a step wizard
- **Type:** UX · **Priority:** · **Status:** Discuss
- **Observed:** **Book now** shows everything at once. It should be a step-by-step wizard.
- **Feedback / decision:** Approved (30 Sep 2026): Service, then Time, then Your details, then Review and pay, then a confirmation screen. Waiting on the designs, then plan Task 9.
- **Fix:**
- **Verified:**

### BKG-04 · Is client sign-in tied to the practice?
- **Type:** Question · **Priority:** · **Status:** Ready
- **Observed:** It's unclear whether a client's sign-in belongs to one practice, or whether one account can book with any practice and sign in everywhere.
- **Feedback / decision:** Keep one account per client (decided 30 Sep 2026). The client sees their sessions with whichever practice they're booking with, and each practice sees only what concerns it. This is already how the data works. The booking sign-in will say so in one line. Plan Task 8.
- **Fix:**
- **Verified:**

### BKG-05 · Session format should follow the practice's slot options
- **Type:** Bug · **Priority:** · **Status:** Open
- **Observed:** The session format on the booking form should depend on the options the practice offers for each booking slot.
- **Feedback / decision:**
- **Fix:**
- **Verified:**

### BKG-06 · Default intake and confidentiality forms
- **Type:** Feature · **Priority:** · **Status:** Ready
- **Observed:** Two forms matter: **Client intake** and **Confidentiality**. We still need to decide whether they're filled in at booking or after it. Every new practice should get a default template for both, which the practice can then edit.
- **Feedback / decision:** Every practice gets both forms by default and can edit the wording. Clients receive them after booking, to complete before the first session (decided 30 Sep 2026). Plan Task 11.
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
