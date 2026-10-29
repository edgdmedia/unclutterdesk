# Unclutter Desk Launch Feature Matrix

## Purpose

This document defines the product truth for launch.

It exists to keep three things aligned:

1. What the landing page promises
2. What pricing tiers imply
3. What the product actually supports at launch

Anything in `Must-Have Before Launch` can be marketed as current product truth.
Anything in `Coming Soon` must be clearly labeled as such.
Anything in `Do Not Market For Launch` should not appear in launch copy, pricing bullets, or testimonials as if it is already live.

---

## Must-Have Before Launch

These are the features that define the launch offer and should be completed, verified, and safe to market.

### Brand, Portal, and Booking

1. Branded booking portal
2. Practice subdomain
3. Custom domain setup
4. Booking and availability management
5. Cancellation policy and booking rules

### Payments and Payouts

1. Paystack payment flow
2. Direct payout setup

### Video and Calendar

1. Browser video sessions (Daily.co, falling back to 8x8 JaaS, then a meet.jit.si link)
2. Google Meet session links (needs Google Calendar connected; Starter and up)
3. Google Calendar push (one-way; Starter and up)
4. `.ics` calendar download

### Clinical Workflow

1. SOAP notes
2. Live SOAP autosave
3. Intake forms
4. Consent forms
5. Auto-scored PHQ-9 and GAD-7 (every plan)
6. Auto-scored PCL-5 and DASS-21 (Pro and Clinic)

### Team and Operations

1. Owner role
2. Admin role
3. Therapist role
4. Receptionist role
5. Basic practice analytics
6. Email notifications and reminders
7. In-app notifications and reminders

### Trust and Social Proof

1. Public reviews and testimonials

---

## Coming Soon

These features may appear on the landing page only inside a clearly labeled `Coming Soon` section.

1. Daily cloud recording
2. Therapist profiles (v2 Phase 1): profile pages, themes, templates, share kit, profile PDF, intro video

---

## Do Not Market For Launch

These should not appear in launch messaging as if they are already available.

1. Supervisor role
2. Finance role
3. Advanced clinic RBAC or permission matrix
4. Advanced assessment dashboards or trend analysis beyond what is actually shipped

---

## Landing Page Messaging Rules

### Core Rule

Only market `Must-Have Before Launch` features as current product truth.

### Coming Soon Rule

Use a small, explicit `Coming Soon` section for:

1. Cloud recording
2. Therapist profiles, until v2 Phase 1 ships

### Copy Guardrails

Use these rules when updating the landing page:

1. Do not mix shipped and unshipped claims in the same feature block.
2. Do not imply advanced roles beyond owner, admin, therapist, and receptionist.
3. Do not claim Daily cloud recording is already live.
4. Do not claim advanced clinic permission matrices unless they are fully implemented and verified.
5. Do not promise a free trial. There is none: practices start on the free plan.
6. Do not claim "zero platform fees" without saying it applies to paid plans; the free plan takes 5% of online payments.
7. Clinical notes: say "clinical notes are encrypted at rest", not that everything is.
8. Video: name Daily.co and 8x8 (Jitsi), not "Jitsi or Google Meet".
9. Plan figures (bookings, fees, which plan includes what) must match the table below, which matches `entitlements.ts`.

---

## Recommended Launch Positioning

The launch story should center on:

1. Branded booking and payments
2. Custom domain and white-label portal
3. Browser video sessions
4. Google Calendar sync and calendar exports
5. Integrated SOAP notes with live autosave
6. Intake and consent workflows
7. Auto-scored PHQ-9 and GAD-7
8. Team support for owner, admin, therapist, and receptionist
9. Practice analytics
10. Public reviews and testimonials

---

## Plans (v2 spec §5.2)

The source of truth is `apps/api/src/modules/entitlements/entitlements.ts`. This table must match it.

| | Free (`FREE`) | Starter | Pro | Clinic |
|---|---|---|---|---|
| Price | ₦0 | ₦5,000/mo | ₦15,000/mo | from ₦45,000/mo |
| Bookings / month | 10 | 30 | Unlimited | Unlimited |
| Platform fee on online booking payments | 5% | 0% | 0% | 0% |
| Google Calendar push | ❌ | ✅ | ✅ | ✅ |
| Assessments | PHQ-9, GAD-7 | PHQ-9, GAD-7 | + PCL-5, DASS-21 | all |
| Clinical notes, hours log, intake | ✅ | ✅ | ✅ | ✅ |
| Bank transfer payments | ❌ | ✅ | ✅ | ✅ |
| Custom domain for booking pages | ❌ | ❌ | ✅ | ✅ |
| Staff | — | — | Admin / Receptionist | + Therapists |

- New practices start on Free. There is no trial. Practices that existed before v2 keep their plan free for 90 days (with reminders 14 and 3 days before), then move to Free unless they subscribe.
- A lapsed paid plan keeps working through 7 days' grace and 14 days' notice (with the exact date), then moves to Free; staff other than the owner are paused and come back if the practice renews.
- Platform admins change a practice's plan only through Complimentary plans (a reason and an end date, or internal with none).
- The public pricing page shows Starter, Pro and Clinic, plus a line about starting free. From v2 Phase 1 that line becomes "Start with a free therapist profile".
- In-app upgrade prompts go free → Starter → Pro, never straight to Clinic.
- When a Free or Starter practice uses its month's bookings, its booking page says "Fully booked this month" (not an error) and the dashboard shows an upgrade prompt.

## Pricing Alignment Notes

Pricing tiers should only include features from `Must-Have Before Launch` as active differentiators.

If a pricing card mentions any of the following before they are shipped, it creates avoidable launch risk:

1. Daily cloud recording
2. Supervisor role
3. Finance role
4. Advanced RBAC matrix
5. Profile PDF or intro video (v2 Phase 1)

---

## Launch Verification Requirement

Before launch, every `Must-Have Before Launch` item should have an explicit verification path:

1. either a manual QA checklist
2. or a tested workflow in the codebase
3. or both

This document is the source of truth for launch scope and landing page honesty.
