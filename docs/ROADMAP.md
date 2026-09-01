# Unclutter Desk — Execution Roadmap

**Product Name**: Unclutter Desk  
**Document Version**: 1.0.0  

---

## Sprint Execution Timeline

```
[ Sprint 1 ] ──► [ Sprint 2 ] ──► [ Sprint 3 ] ──► [ Sprint 4 ] ──► [ Sprint 5 ] ──► [ Launch ]
 Workspace        Multi-Tenant       White-Label      Telehealth &      Paystack/Stripe   MVP Beta
 Scaffolding        Gateway          UI Engine        Intake Forms       Subaccounts       Public
```

---

## 1. Sprint Breakdown

### Sprint 1: Workspace Scaffolding & Database Setup (Completed)
- [x] Create root workspace with `pnpm-workspace.yaml` and `package.json`.
- [x] Write standalone multi-tenant Prisma schema (`Tenant`, `Profile`, `ConsultTherapistProfile`, `ConsultBooking`, `ConsultAvailability`).
- [x] Create `docs/` folder with PRD, FRD, Architecture, and Roadmap documentation.

### Sprint 2: Multi-Tenant Gateway & API Layer
- [ ] Scaffold `apps/api` with NestJS framework.
- [ ] Implement `TenantMiddleware` for host & `x-tenant-id` header resolution.
- [ ] Implement multi-tenant authentication controller & JWT guards.

### Sprint 3: White-Label UI Token Engine & Client Booking Portal
- [ ] Scaffold `apps/web` client application.
- [ ] Implement `BrandProvider` CSS custom property engine.
- [ ] Build 3-click client booking flow with interactive calendar & practitioner filter.
- [ ] Add 1-click booking link copy button for therapists.

### Sprint 4: Practitioner Dashboard & Telehealth Integration
- [ ] Build therapist dashboard, schedule manager, and availability block builder.
- [ ] Implement 2MB profile picture upload with explicit **Upload Photo** button.
- [ ] Integrate Jitsi / Daily.co WebRTC video room links for confirmed bookings.

### Sprint 5: SaaS Billing & Split Payouts
- [ ] Integrate Paystack Subaccounts / Stripe Connect for client booking payouts.
- [ ] Build SaaS subscription management for therapist plans (Starter, Pro, Clinic).

### Sprint 6: QA, Cloudflare DNS & Production Launch
- [ ] Cloudflare for SaaS custom domain CNAME setup.
- [ ] Load testing, security audit, and HIPAA data isolation checks.
- [ ] Deploy production environment to server & launch beta.
