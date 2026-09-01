# Unclutter Desk — Product Requirements Document (PRD)

**Product Name**: Unclutter Desk  
**Product Category**: B2B Multi-Tenant Practice Management & White-Label Telehealth SaaS  
**Target Market**: Independent Psychotherapists, Clinical Psychologists, Executive Life Coaches, Group Counseling Practices  
**Document Version**: 1.0.0  

---

## 1. Executive Summary

**Unclutter Desk** is an all-in-one operating system and practice management platform that empowers mental health professionals and clinics to operate their private practice under their own white-labeled brand. 

Unlike generic practice management tools, Unclutter Desk gives therapists a dedicated white-label client portal, custom subdomains (`drjane.unclutterdesk.com`) or custom domains (`booking.drjanetherapy.com`), customizable brand styling (colors, logos, favicons), automated scheduling, clinical intake questionnaires, WebRTC video telehealth, and split-payout billing.

---

## 2. Target User Personas

### Persona A: Independent Private Practitioner ("Solo Therapist")
* **Profile**: Licensed therapist operating independently.
* **Pain Points**: High administrative overhead, fragmented tools (WhatsApp, Zoom links, spreadsheets), lack of professional branded booking page.
* **Goal**: A single link to share with clients that handles booking, payments, intake, and automated video sessions under their brand.

### Persona B: Group Practice Owner ("Clinic Lead")
* **Profile**: Director of a multi-practitioner clinic (5–20 therapists).
* **Pain Points**: Managing supervisor reviews, client assignments, central billing payouts, and team schedule availability.
* **Goal**: Centralized clinic administration dashboard with individual therapist logins, unified billing, and clinic branding.

### Persona C: Therapy Client
* **Profile**: Individual seeking counseling or therapy.
* **Pain Points**: Confusing booking steps, hard to join video calls, lack of privacy.
* **Goal**: Frictionless 3-click booking, transparent scheduling, instant calendar invites, and 1-click video session access.

---

## 3. Product Core Features & Modules

### 3.1 White-Label Branding & Custom Domains
* **Custom Subdomain**: Every practice receives a slug (e.g. `dr-smith.unclutterdesk.com`).
* **Custom Domain Support**: CNAME mapping (e.g. `booking.drsmiththerapy.com`) via Cloudflare for SaaS.
* **Brand Token Engine**: Customize Primary Color, Secondary Color, Accent Color, Logo, Favicon, Welcome Copy, and Custom Cancellation Policy.

### 3.2 Client Booking & Scheduling Portal
* **Direct Booking Page**: Interactive calendar showing real-time practitioner availability.
* **1-Click Booking Link**: Quick action button for therapists to copy their link directly to clipboard.
* **Service Packages**: 50-min Initial Consultation, 60-min Follow-up Session, Couples Counseling, etc., with configurable pricing.
* **Discount Code Engine**: Custom coupon codes (percentage off or fixed amount).

### 3.3 Practitioner Dashboard & Management
* **Instant Profile Picture Upload**: Separate, explicit upload for profile pictures (up to 2MB).
* **Active / Inactive Status Management**: One-click status toggle to make practitioner profiles active or inactive.
* **Availability & Blocked Time Manager**: Flexible recurring slot builder and one-off vacation block time.
* **Client Record & Clinical Notes**: SOAP notes, session notes, client history, and assessment attachments.

### 3.4 Integrated Telehealth & Video Sessions
* **Built-in WebRTC Video**: Automated creation of secure video rooms (Jitsi / Daily.co / Google Meet) for every confirmed booking.
* **No Software Download Needed**: Clients join sessions directly in their mobile or desktop browser with 1 click.

### 3.5 Automated SaaS Billing & Split Payouts
* **Paystack Subaccounts & Stripe Connect**: Client session payments are routed directly to the therapist's bank account, automatically deducting platform fees.
* **Subscription Tiers**:
  * **Starter Tier (Free / Transactional)**: 5% platform fee per booking.
  * **Pro Practice (₦25,000 / $30 per month)**: 0% transaction fee, custom domain, Google Calendar sync.
  * **Group Clinic (₦75,000 / $90 per month)**: Multi-practitioner support, supervisor oversight, custom intake form builder.

---

## 4. Non-Functional Requirements

1. **Security & HIPAA/GDPR Compliance**: End-to-end SSL/TLS encryption for all video sessions and database records. Multi-tenant data isolation via mandatory `tenantId` query filters.
2. **Performance**: Initial page load under **1.2s** on 3G/4G connections. Instant (0ms) client-side route navigation with cached session state.
3. **Availability**: 99.9% API uptime with PM2 auto-restart and GitHub Actions CI/CD auto-deployment.
