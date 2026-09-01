# Unclutter Desk — Functional Requirements Document (FRD)

**Product Name**: Unclutter Desk  
**Document Version**: 1.0.0  

---

## 1. System Scope & Functional Architecture

This document defines the exact functional behavior, API endpoint specifications, data flows, and execution contracts for the **Unclutter Desk** multi-tenant platform.

---

## 2. Multi-Tenant Resolution & Routing Specs

### 2.1 Host & Tenant Resolution Workflow
1. When an HTTP request enters the gateway (or Web UI), the system extracts the `Host` header (e.g. `drjane.unclutterdesk.com` or `booking.drjanetherapy.com`).
2. The `TenantMiddleware` checks the host against database indexes:
   - Matches `Tenant.slug` (e.g. `drjane`) OR `Tenant.customDomain` (e.g. `booking.drjanetherapy.com`).
3. If matched, `req.tenantId` and `req.tenant` are attached to the execution context.
4. If unmatched, the gateway redirects to the primary landing page `unclutterdesk.com`.

### 2.2 API Header Fallback
For mobile applications or API calls, `x-tenant-id` or `x-tenant-slug` header can be passed explicitly in requests.

---

## 3. Detailed Functional Modules

### 3.1 Authentication & Auth Verification
* **Unified SSO Session**: Auth state initializes synchronously from `localStorage` (`PROFILE_KEY`) on client app mount.
* **Non-blocking Revalidation**: Background session verification via `authApi.status()` executes silently without unmounting the UI layout.
* **Email Verification Policy**: Therapists created by clinic admins or invited via link automatically have `emailVerified: true`, `status: 'active'`, and `role: 'therapist'`.

### 3.2 Practitioner Profile & Avatar Management
* **Image Upload Spec**:
  * Maximum file size: **2MB** (2,097,152 bytes).
  * Allowed formats: `image/jpeg`, `image/png`, `image/webp`.
  * Selection vs Upload: Selecting an image generates a local Base64 preview with notice *"New photo selected (Not uploaded yet)"*.
  * Execution: Image is sent to server **only** when clicking the explicit **"Upload Photo"** button.
* **Practitioner Status Spec**:
  * Statuses: `active` (bookable & public) vs `inactive` (deactivated & hidden).
  * One-click toggle button on Detail page (`Activate Practitioner` / `Deactivate Practitioner`) and inline status selector on Admin Table.

### 3.3 Availability & Booking Engine
* **Slot Generation**: Therapists define weekly recurring availability blocks (e.g. Mon 9:00 AM - 5:00 PM).
* **Double-Booking Prevention**: PostgreSQL atomic transactions ensure availability slots cannot be double-booked concurrently.
* **Video Room Generation**: Upon booking confirmation, a unique room ID (e.g. `unclutterdesk-session-{bookingId}`) is generated and attached to the booking record.

---

## 4. API Endpoints Specification

### Tenant & Public Endpoints
```
GET   /v1/tenant/public/info                 -> Resolves current tenant brand config & logo
GET   /v1/consult/public/therapists          -> Lists public active therapists for tenant
GET   /v1/consult/public/availability        -> Returns open availability slots
POST  /v1/consult/public/bookings            -> Create client booking & generate room link
```

### Practitioner Endpoints
```
GET   /v1/consult/therapist/profile          -> Fetch therapist profile
POST  /v1/consult/therapist/profile          -> Update therapist profile text data
POST  /v1/consult/therapist/profile/avatar   -> Upload 2MB profile photo
GET   /v1/consult/therapist/availability     -> Fetch therapist availability
POST  /v1/consult/therapist/availability     -> Create availability slot / block time
```

### Admin Endpoints
```
GET   /v1/consult/admin/therapists           -> List all practitioners with status
PATCH /v1/consult/admin/therapists/:id/status -> Update status (active/inactive)
POST  /v1/consult/admin/therapists/invite    -> Send therapist email invite
```
