# Profile-first signup (§6.8): Implementation Plan

**Goal:** A therapist goes from the profiles site's "Create your free therapist profile" to a published profile in under ten minutes: sign up, enter the 6-digit code, sign in, land in the profile editor.

**Builder:** Spec Claude, branch `phase1/signup`, PR into `dev`.

## What exists

- `POST /v1/auth/register` creates the user, then the practice, profile and therapist record in separate writes (not one transaction), with a timestamp-suffixed slug, and emails a 6-digit code. `/verify-email` checks it; the person then signs in.
- `Tenant.onboardingIntent` (PROFILE | PRACTICE) exists, default PRACTICE.
- After sign-in, `LoginPage` sends an owner whose practice isn't set up to the onboarding wizard (`/register/onboarding`).
- The profiles site's `/join` sends people to `{APP}/signup?intent=profile`.

## Tasks

- [ ] **1. API: `POST /v1/auth/register-profile`.** Name, email, password, handle, kind, optional template. Same email and password rules as `/register` (shared helpers, not copies).
  - The handle is checked against handles, old handles and reserved words.
  - The practice slug is the handle when it's free and not reserved, otherwise the handle with `-2`, `-3` and so on.
  - Creates the `User`, the `Tenant` (FREE, `onboardingIntent = PROFILE`), the OWNER `Profile`, the `ConsultTherapistProfile` and the DRAFT `PractitionerProfile` in one transaction. Then default forms, then the code email.
  - Public, rate-limited; also `GET /v1/auth/handle-check?handle=` (rate-limited) for live feedback, and the active templates' titles for the form.
- [ ] **2. Sign-in routing.** `GET /v1/consult/dashboard/summary` returns `onboardingIntent`. `LoginPage` sends PROFILE-intent owners to `/dashboard/profile`, never to the practice wizard.
- [ ] **3. App: the signup form** at `/signup?intent=profile`: name, email, password, handle (with live check), kind, template (optional). Then the existing code step, then sign in, then the editor.
- [ ] **4. Profile-first dashboard.** For PROFILE intent, home is the profile editor; practice features sit under one "Set up booking" entry. After the first publish, a dismissible "Want clients to book you here?" card.
- [ ] **5. Release unverified signups after 7 days**, inside the existing daily 3 a.m. cron.
  - Covers owner self-signups only.
  - Removes them only if nothing beyond what signup created exists; otherwise flags them for an admin.
  - Everything is removed in one transaction, with an audit entry.
  - An email goes out once on day 5.
- [ ] **6. Check:** the whole flow end to end in a browser, timed against the 10-minute goal.
