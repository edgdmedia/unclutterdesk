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

1. Jitsi session links
2. Google Meet session links
3. Google Calendar sync
4. `.ics` calendar download

### Clinical Workflow

1. SOAP notes
2. Live SOAP autosave
3. Intake forms
4. Consent forms
5. Auto-scored PHQ-9
6. Auto-scored GAD-7

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

1. DASS-21
2. Daily video rooms
3. Daily cloud recording

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

1. DASS-21 scoring
2. Daily-powered video rooms
3. Cloud recording

### Copy Guardrails

Use these rules when updating the landing page:

1. Do not mix shipped and unshipped claims in the same feature block.
2. Do not imply advanced roles beyond owner, admin, therapist, and receptionist.
3. Do not claim DASS-21 is already supported.
4. Do not claim Daily cloud recording is already live.
5. Do not claim advanced clinic permission matrices unless they are fully implemented and verified.

---

## Recommended Launch Positioning

The launch story should center on:

1. Branded booking and payments
2. Custom domain and white-label portal
3. Jitsi and Google Meet session workflows
4. Google Calendar sync and calendar exports
5. Integrated SOAP notes with live autosave
6. Intake and consent workflows
7. Auto-scored PHQ-9 and GAD-7
8. Team support for owner, admin, therapist, and receptionist
9. Practice analytics
10. Public reviews and testimonials

---

## Pricing Alignment Notes

Pricing tiers should only include features from `Must-Have Before Launch` as active differentiators.

If a pricing card mentions any of the following before they are shipped, it creates avoidable launch risk:

1. DASS-21
2. Daily cloud recording
3. Supervisor role
4. Finance role
5. Advanced RBAC matrix

---

## Launch Verification Requirement

Before launch, every `Must-Have Before Launch` item should have an explicit verification path:

1. either a manual QA checklist
2. or a tested workflow in the codebase
3. or both

This document is the source of truth for launch scope and landing page honesty.
