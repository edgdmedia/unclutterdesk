# One home per fact (§6.17): Implementation Plan

**Builder:** Spec Claude, branch `phase1/one-home-per-fact`, PR into `dev`.

## Tasks

- [x] **1. Every therapist has a profile.**
  - `PractitionerProfileService.ensureDraft(userId, therapistProfileId)` creates a DRAFT profile if there's none. The handle comes from the name, then `-2`, `-3` and so on until free. Fields are filled from the practice record, and the welcome message becomes `about`.
  - `createOwn` shares the same create path.
  - Practice signup (`auth.service` register) calls `ensureDraft`. Profile-first signup already creates one.
- [x] **2. Back-fill existing data**, as a background job you can run again safely (`profile.ensure-drafts`):
  - Create missing drafts.
  - For existing profiles, fill only **empty** fields (about, headline, credentials, years, photo) from the practice record.
  - Each run is audited.
- [x] **3. One reader for person facts.** `personFacts()` returns display name, photo, headline, about, credentials, years, specialties, modalities, languages, and online / in person, from `PractitionerProfile`. It falls back to the old fields only when there's no profile.
  - `GET /v1/consult/public/therapists` (booking page) and `GET /v1/consult/therapist/profile` use it.
  - Contract test: the booking page response takes these from the profile.
- [x] **4. One writer.**
  - `PATCH/POST /v1/consult/therapist/profile` no longer accepts person fields: welcomeMessage, tagline, specialty, credentials, yearsExperience, modalities, languages, firstName and lastName. A request with them gets a 400 naming My profile.
  - Practice-only fields stay.
  - `syncPracticeRecords` is removed.
- [x] **5. Screens.**
  - Profile → "This practice" shows only practice settings, with an "Edited in My profile" note and link.
  - The dashboard's photo upload sets the profile photo.
  - The booking page renders display name, headline, about and photo.
- [x] **6. Solo practices.**
  - `Tenant.useProfileForPractice` (migration, default true) — only applies while the practice is solo (§6.16 definition).
  - While on, the practice's name, welcome and city fall back to the owner's profile wherever the practice record's field is empty.
  - Practice profile shows "Using your profile", with each field overridable.
- [x] **7. Check:** full suites, plus a real-database smoke test of the back-fill and the booking page response.
