# Unclutter Desk Pre-Launch Implementation Plan

## Goal

Close the gap between current product reality and the agreed launch promise, so the landing page, pricing, and shipped product are aligned before launch.

This plan focuses only on missing or not-yet-safe launch-critical features.

---

## Scope

This plan covers the work needed to make the following launch claims true and defensible:

1. Custom domain setup
2. Live SOAP autosave
3. Auto-scored PHQ-9
4. Auto-scored GAD-7
5. Public reviews and testimonials as a polished launch feature
6. End-to-end verification for marketed launch workflows

This plan does not include `Coming Soon` features such as:

1. DASS-21
2. Daily video rooms
3. Daily cloud recording

---

## Workstreams

## Workstream 1: Landing Page Truth Alignment

### Objective

Update the landing page so every claim matches the agreed launch matrix.

### Outcomes

1. Unsupported launch claims are removed or softened.
2. `Coming Soon` features are isolated into a clearly labeled section.
3. Pricing bullets and feature language align to actual launch scope.

### Key Changes

1. Replace any mention of DASS-21 as a current feature with `Coming Soon` language.
2. Remove Daily cloud recording from active pricing features.
3. Replace supervisor/finance role references with owner/admin/therapist/receptionist.
4. Rewrite clinical workflow copy to reflect live SOAP autosave and scored PHQ-9/GAD-7 only.
5. Ensure custom domain is only marketed if Workstream 2 is completed.

### Primary Files

1. `apps/landing/src/components/LandingPage.tsx`

### Definition of Done

1. The landing page markets only launch-real features.
2. `Coming Soon` appears as a separate, small section.
3. Pricing bullets do not imply unsupported functionality.

---

## Workstream 2: Custom Domain Launch Completion

### Objective

Finish the product and operational path required to market custom domains at launch.

### Outcomes

1. A practice can configure a custom domain.
2. DNS/CNAME setup is documented and operational.
3. The branded booking experience works correctly on the custom domain.

### Key Areas

1. Tenant brand/domain persistence
2. Domain verification and routing behavior
3. Cloudflare for SaaS or equivalent setup completion
4. Booking portal behavior under custom domains
5. SSL/TLS and environment configuration

### Likely Files and Areas

1. `apps/app/src/pages/OnboardingWizardPage.tsx`
2. `apps/api/src/modules/tenant/*`
3. tenant public brand resolution endpoints
4. hosting and deployment configuration
5. `docs/launch-checklist.md`
6. `docs/ROADMAP.md`

### Definition of Done

1. A tenant can use a custom domain end-to-end.
2. Branding resolves correctly on the custom domain.
3. The launch checklist includes exact setup and verification steps.

---

## Workstream 3: Live SOAP Autosave

### Objective

Turn SOAP note editing into a reliable, launch-quality autosave workflow.

### Outcomes

1. Notes save automatically while the therapist types.
2. The UI clearly communicates save state.
3. Locked notes cannot continue autosaving.

### Existing Foundation

1. SOAP note CRUD exists in the notes API.
2. The telehealth room page already edits note content.
3. The session prep flow already loads note context.

### Required Implementation

1. Add debounced autosave to the telehealth note editor.
2. Track dirty, saving, saved, and failed UI states.
3. Handle first-save note creation and subsequent updates reliably.
4. Prevent autosave after note lock.
5. Add failure handling and user-visible retry messaging.
6. Optionally save on blur in addition to debounce.

### Primary Files

1. `apps/app/src/pages/TelehealthVideoRoomPage.tsx`
2. `apps/api/src/modules/notes/notes.service.ts`
3. `apps/api/src/modules/notes/notes.controller.ts`

### Verification

1. Typing into SOAP fields triggers background save after debounce.
2. UI shows `Saving...` and `Saved` states.
3. After lock, fields stop autosaving and become read-only.
4. Refreshing the page preserves saved note content.

---

## Workstream 4: Auto-Scored PHQ-9 and GAD-7

### Objective

Ship trustworthy scored assessments using locked system templates and server-side scoring.

### Scope Decision

For launch, PHQ-9 and GAD-7 should be implemented as system-defined templates only.

Do not allow arbitrary custom forms to claim PHQ-9 or GAD-7 scoring behavior.

### Outcomes

1. PHQ-9 can be assigned, submitted, scored, and displayed.
2. GAD-7 can be assigned, submitted, scored, and displayed.
3. Scoring is generated server-side and stored as structured derived data.

### Required Architecture

1. Locked assessment template definitions for PHQ-9 and GAD-7
2. A scoring engine with:
   - answer normalization
   - total score calculation
   - severity band mapping
3. Storage for derived scoring results
4. API response support for returning scored output alongside submissions
5. UI display in session prep and client history

### Required Implementation

1. Define PHQ-9 system template
2. Define GAD-7 system template
3. Add derived result model or JSON shape for scored submissions
4. Add scoring service/module in the API
5. Trigger scoring on submission save
6. Expose score, severity, and metadata in submission payloads
7. Surface latest scores in clinician-facing views
8. Add tests for scoring boundaries and invalid input

### Primary Files and Areas

1. `apps/api/src/modules/intake/intake.service.ts`
2. `apps/api/src/modules/intake/intake.controller.ts`
3. Prisma schema for derived score storage if needed
4. `apps/app/src/pages/FormEditorPage.tsx` or related forms manager flows
5. `apps/app/src/pages/SessionPrepPage.tsx`
6. `apps/app/src/pages/ClientDetailPage.tsx`

### Verification

1. A PHQ-9 submission returns a total score and severity band.
2. A GAD-7 submission returns a total score and severity band.
3. Clinicians can view recent scores without manual interpretation.
4. Invalid or incomplete submissions fail safely.

---

## Workstream 5: Public Reviews and Testimonials

### Objective

Make reviews/testimonials a polished and launch-safe proof point.

### Outcomes

1. Review forms can be published intentionally.
2. Public reviews are displayed cleanly on booking surfaces.
3. Landing-page testimonials can be grounded in a real system feature.

### Existing Foundation

1. Review form types already exist.
2. Review publication modes already exist.
3. Public reviews endpoint already exists.
4. Booking page already consumes reviews.

### Remaining Work

1. Verify moderation/publication workflow UX.
2. Ensure reviewer display rules are clear and safe.
3. Decide whether launch testimonials on the marketing site are static copy, dynamic feed, or a hybrid.
4. Ensure rating/testimonial formatting is launch-ready.

### Primary Files and Areas

1. `apps/api/src/modules/intake/*`
2. `apps/app/src/pages/ClientBookingPage.tsx`
3. any marketing-site testimonial copy in `apps/landing/src/components/LandingPage.tsx`

### Definition of Done

1. Reviews can be collected, approved/published, and displayed intentionally.
2. The launch story around testimonials is supported by a real workflow.

---

## Workstream 6: Launch Verification Pass

### Objective

Prove that every marketed launch feature actually works end-to-end.

### Verification Areas

1. Custom domain routing and branding
2. Public booking flow
3. Availability and booking rules
4. Paystack payment flow
5. Direct payout setup
6. Jitsi session links
7. Google Meet session links
8. Google Calendar sync
9. `.ics` download
10. SOAP notes and autosave
11. Intake and consent forms
12. PHQ-9 and GAD-7 scoring
13. Role restrictions for owner/admin/therapist/receptionist
14. Basic analytics wording vs actual screens
15. Email and in-app reminders
16. Public reviews/testimonials

### Deliverables

1. An updated launch checklist
2. Manual verification steps for each launch claim
3. Fixes for any copy/product mismatch found during verification

---

## Recommended Delivery Order

1. Landing page truth alignment
2. Custom domain completion
3. Live SOAP autosave
4. PHQ-9 scoring
5. GAD-7 scoring
6. Public reviews/testimonials polish
7. Full launch verification pass

---

## Suggested Ownership Breakdown

If multiple workstreams can move in parallel, this is the cleanest split:

1. Product messaging / landing page truth alignment
2. Domain and brand infrastructure
3. Clinical workflow improvements (SOAP autosave)
4. Assessment scoring engine (PHQ-9 and GAD-7)
5. Launch QA and verification

---

## Exit Criteria

This plan is complete when:

1. Every `Must-Have Before Launch` feature in `docs/LAUNCH_FEATURE_MATRIX.md` is either shipped and verified or intentionally removed from launch claims.
2. The landing page, pricing, and testimonials do not overstate the product.
3. Launch-critical workflows are documented and testable end-to-end.
