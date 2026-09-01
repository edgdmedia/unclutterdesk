# Unclutter Desk — Technical Architecture & Security Specifications

**Product Name**: Unclutter Desk  
**Document Version**: 1.0.0  

---

## 1. System Architecture Overview

Unclutter Desk uses a modern, high-performance **Monorepo Architecture** powered by `pnpm`, `NestJS`, `Next.js 14 / Vite React`, and `Prisma ORM` with PostgreSQL.

```
/Users/olalekan/Projects/unclutter-os/
├── apps/
│   ├── api/              # NestJS Multi-Tenant REST API & WebSockets Gateway
│   └── web/              # Next.js 14 / Vite React White-Label Client Portal & Admin
├── packages/
│   ├── shared/           # Shared Types, DTOs, API Contracts & Utilities
│   └── ui/               # White-Label UI Primitives & CSS Token Engine
└── prisma/
    └── schema.prisma     # PostgreSQL Multi-Tenant Database Schema
```

---

## 2. Multi-Tenant Data Isolation Strategy

### 2.1 Database Isolation via `tenantId`
Every database model (excluding global system auth users) contains a mandatory `tenantId: BigInt` reference linked to `Tenant.id`.

### 2.2 Prisma Middleware Enforcement
To eliminate the risk of cross-tenant data leaks, Prisma query extensions automatically inject `tenantId` filter into every read, write, update, and delete operation:

```typescript
// Prisma Extension for Tenant Filtering
prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const tenantId = Context.getTenantId();
        if (tenantId && isTenantModel(model)) {
          args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
    },
  },
});
```

---

## 3. White-Label Design System & CSS Token Engine

### 3.1 Custom Property Injection
When a client portal loads, the `BrandProvider` fetches the tenant's brand configuration (`logoUrl`, `primaryColor`, `secondaryColor`) and injects it into `:root`:

```tsx
export function BrandProvider({ brand, children }: { brand: TenantBrand; children: ReactNode }) {
  useEffect(() => {
    if (!brand) return;
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', brand.primaryColor || '#0F3A53');
    root.style.setProperty('--brand-secondary', brand.secondaryColor || '#E3B341');
  }, [brand]);

  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}
```

---

## 4. Security & Compliance (HIPAA / GDPR / Data Protection)

1. **Session & Media Encryption**:
   - All video and audio streams run over WebRTC with Datagram Transport Layer Security (DTLS) and Secure Real-time Transport Protocol (SRTP).
   - Database connections enforce SSL/TLS with encrypted storage at rest.

2. **Session Security & Account Lockout**:
   - Account lockout after 5 failed login attempts (15-minute cooldown).
   - Explicit authentication check on all protected controller routes using NestJS `JwtAuthGuard` and `RolesGuard`.

3. **Data Retention & Soft Deletion**:
   - Clinical intake records and session logs use soft deletion (`deletedAt`) to preserve medical audit trails required by health regulators.
