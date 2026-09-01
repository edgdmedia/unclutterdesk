# Custom Domain Plan

## Purpose

This document defines two paths for custom-domain support:

1. the smallest launch-ready implementation
2. the longer-term full SaaS domain control plane

The immediate goal is to finish a launch-safe custom-domain workflow without overbuilding. The longer-term goal is to preserve the roadmap for a stronger self-serve domain platform when demand justifies it.

---

## Current Status

The codebase already includes core custom-domain foundations:

1. `Tenant.customDomain` exists in the schema
2. tenant creation and brand update flows accept `customDomain`
3. middleware resolves tenant by exact custom-domain host
4. public tenant info can be resolved by slug or custom domain
5. onboarding UI exposes custom-domain input
6. the client app already treats non-platform hosts as custom domains

What is still missing is the launch-safe operational layer:

1. strong domain validation
2. explicit setup status
3. verification/check flow
4. clear tenant-facing setup feedback
5. updated launch checklist and smoke tests

---

## Recommendation

Use the **Launch-Ready Path** now.

Do not attempt to build the full SaaS domain control plane before launch.

Reason:

1. the product already has enough domain foundations to finish a safe MVP
2. the full control plane is a much larger platform investment
3. the launch need is narrow: validate, verify, route, and communicate status clearly

---

## Path 1: Launch-Ready Custom Domain Flow

### Goal

Ship a credible, supportable custom-domain workflow for launch.

### Scope

This path should cover:

1. store custom domain safely
2. validate domain format
3. prevent obviously invalid or reserved hosts
4. track status of setup
5. provide a `verify domain` action
6. show setup state clearly in the UI
7. confirm host-based tenant routing works end-to-end

### Suggested Domain Status Model

Add a lightweight status field on `Tenant`:

1. `PENDING`
2. `ACTIVE`
3. `FAILED`

Optional future values can be added later, but keep launch small.

### Launch-Ready Features

#### 1. Validation

At minimum:

1. lowercase and trim input
2. reject protocol prefixes like `https://`
3. reject paths and query strings
4. reject obvious reserved/internal domains
5. reject domains that match platform-owned hosts like:
   - `api.unclutterdesk.com`
   - `app.unclutterdesk.com`
   - `www.unclutterdesk.com`
6. reject malformed hostnames

#### 2. Conflict Handling

1. ensure duplicate custom domains cannot be claimed by multiple tenants
2. return clear, domain-specific error messages

#### 3. Verification Endpoint

Add an explicit backend action such as:

1. `POST /v1/tenant/custom-domain/verify`

It should:

1. read the saved custom domain for the current tenant
2. check that the requested host resolves in the expected direction
3. confirm the app can identify the tenant correctly under that host assumption
4. update `customDomainStatus` accordingly

For launch, this verification can be intentionally simple. It does not need to be a full automated provisioning system.

#### 4. UI Feedback

The onboarding or brand settings UI should show:

1. current custom domain value
2. current status
3. a short setup instruction
4. a `Verify domain` action
5. a clear success/failure state

#### 5. Launch Checklist Update

Move custom domain out of deferred items once this path is complete.

Add smoke-test steps for:

1. saving a custom domain
2. verifying it
3. loading the booking page on that domain
4. confirming branding and tenant routing

---

## Launch-Ready Implementation Breakdown

### Backend

1. schema field for `customDomainStatus`
2. validation helper for domain normalization and reserved-host rejection
3. update `updateTenantBrand()` to enforce validation
4. add a domain verification service method
5. add a controller endpoint for verification
6. return status through tenant brand/public payloads where needed

### Frontend

1. show saved custom domain status in onboarding/brand settings
2. add `Verify domain` action
3. show success/failure messaging
4. show setup guidance in-product

### Verification

1. backend tests for validation and verification logic
2. app build verification
3. manual smoke-test on a real domain or realistic staging domain

---

## Path 2: Full SaaS Domain Control Plane

### Goal

Build a fully self-serve domain onboarding and management system for scale.

### What it includes

1. domain onboarding wizard
2. DNS target generation
3. ownership verification
4. automatic polling/retries
5. status transitions and diagnostics
6. TLS/SSL provisioning visibility
7. apex vs subdomain guidance
8. `www` and redirect rules
9. re-verification flows
10. safe release/reassignment of domains
11. operator/admin dashboard for domain issues
12. support tooling and logs

### Why not build this before launch

1. it is a separate platform surface
2. it adds substantial engineering and QA complexity
3. it increases launch risk
4. it is not required to make the launch claim credible

### When to revisit it

Build this after launch if:

1. many customers want custom domains quickly
2. support burden from manual setup is high
3. custom domains become a major conversion/retention driver

---

## Tradeoff Summary

### Launch-Ready Path

Pros:

1. ships faster
2. easier to verify
3. lower risk before launch
4. sufficient for launch messaging

Cons:

1. more manual support
2. less polished self-serve experience
3. limited operational tooling

### Full Control Plane

Pros:

1. strong self-serve UX
2. scalable for many tenants
3. better diagnostics and lifecycle handling

Cons:

1. much larger build scope
2. more failure modes
3. higher launch risk

---

## Decision

**Build Path 1 now. Preserve Path 2 as the roadmap.**

That gives the product a truthful, working custom-domain launch story without turning pre-launch work into an infrastructure program.
