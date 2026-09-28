# Staff Bookings and Emergency Contact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two things:
- Practice staff can book a session for an existing client, with the payment
  sent as a link, marked as paid, or waived.
- Every client record stores an emergency contact.

**Architecture:**
- **Emergency contact:** three nullable `Profile` columns, set through the
  existing client endpoints plus a new PATCH. They are included in the data
  export and cleared on erasure.
- **Staff bookings:** a new `StaffBookingService` in the consult module. It
  reuses the existing booking row, slot claim, video room and Paystack helpers.
  - A custom time creates its own locked slot. It is serialised per
    practitioner with a Postgres advisory lock.
  - A payment-link booking holds for up to 48 hours through `holdExpiresAt`.
  - The client pays through a signed link to a new public page, which starts a
    fresh Paystack checkout.

**Tech Stack:** NestJS 10 with Prisma 5.22 on Postgres (`apps/api`), React with
Vite, Tailwind and SWR (`apps/app`), and Vitest with Testing Library.

**Spec:** `docs/PHASE1_STEP4_PLAN.md` (design and decisions). Its parent is
`docs/PHASE1_PLAN.md`, step 4.

## Global Constraints

- **Branch and PRs:** work on `dev`; commit, then `git push origin dev`, then
  open a PR from `dev` to `main` with `gh`. Never push to `main`, because
  merging to `main` deploys to production.
- **Commit trailer:** every commit message ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **PR trailer:** every PR body ends with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Model IDs:** none in commits or PRs.
- **Migrations:** hand-written SQL in
  `prisma/migrations/<timestamp>_<name>/migration.sql`. Apply locally with
  `npx prisma migrate deploy --schema prisma/schema.prisma` from the repo root,
  then `npx prisma generate --schema prisma/schema.prisma`.
- **Commands (all from the repo root):**
  - API tests: `cd apps/api && npx vitest run <path>`.
  - App tests: `cd apps/app && npx vitest run <path>`.
  - Typecheck: `cd apps/api && npx tsc --noEmit -p tsconfig.json` and
    `cd apps/app && npx tsc --noEmit`.
- **Password hashing:** use `bcryptjs`, not `bcrypt`.
- **Roles:** from `apps/api/src/common/roles.ts`.
  - `STAFF` = OWNER, ADMIN, THERAPIST, RECEPTIONIST.
  - `CLINICAL` = OWNER, ADMIN, THERAPIST.
  - `FRONT_DESK` = OWNER, ADMIN, RECEPTIONIST.

  Every new route carries `@Roles(...)`. `roles.spec.ts` and
  `client-surface.spec.ts` fail otherwise.
- **Tenant scoping:** every query is scoped by `tenantId` taken from the
  session (`authenticatedTenantId(req)`), never from the request body.
- **Money:** always in kobo, as `BigInt`. `amountKobo` on a booking is the
  amount agreed, and `chargedKobo()` (`common/revenue.ts`) reads it.
- **Emergency contact visibility:** CLINICAL roles only. The client list
  (STAFF) never includes it.
- **Decisions still open.** These defaults are used until the user says
  otherwise:
  - (a) mark as paid is FRONT_DESK only;
  - (b) the payment-link hold is 48 hours, capped at 2 hours before the
    session;
  - (c) custom times outside working hours are allowed;
  - (d) emergency contact is clinical only.
- **Copy:** plain English, short sentences, no jargon. Error messages tell
  staff what to do next.

## Review Focus

1. **A staff custom time racing a public booking of an overlapping open
   slot.** Expected: only one of them succeeds.
   - How: the custom path deactivates overlapping open slots *before* reading
     bookings for clashes.
   - Test: Task 7, "deactivates overlapping open slots before it checks for
     clashes".
2. **A payment link opened after the booking was paid, cancelled or lapsed.**
   Expected: a clear message ("already paid" or "no longer held") and no second
   charge.
   - Test: Task 9, "refuses a booking that is not waiting for payment".
3. **A therapist in a group practice tries to book for a colleague, or to mark
   a session paid.** Expected: 403 with a plain message.
   - Test: Task 6, "therapist limits".
4. **A tampered payment link token, or a token for another booking.**
   Expected: 404, the same as a missing booking, so nothing leaks.
   - Test: Task 9, "rejects a token made for a different booking".
5. **A client record from another practice, or a staff profile passed as the
   client.** Expected: 404 "Client not found".
   - Tests: Task 2 (PATCH) and Task 6 (booking).

---

## File map

**API: emergency contact**
- Modify `prisma/schema.prisma`: three `Profile` columns.
- Create `prisma/migrations/20260928090000_client_emergency_contact/migration.sql`.
- Create `apps/api/src/modules/tenant/emergency-contact.ts`: parse, clean and
  shape helpers.
- Modify `apps/api/src/modules/tenant/tenant.service.ts`:
  - `createClient` stores the contact;
  - `getClientById` returns it;
  - new `updateClient`.
- Modify `apps/api/src/modules/tenant/tenant.controller.ts`: `PATCH clients/:profileId`.
- Modify `apps/api/src/modules/privacy/data-export.service.ts`: `about.emergencyContact`.
- Modify `apps/api/src/modules/privacy/privacy.service.ts`: clear the columns on erase.
- Tests: `apps/api/src/modules/tenant/client-record.spec.ts` (new), plus the
  existing `privacy/data-export.spec.ts` and `privacy/privacy.service.spec.ts`.

**App: emergency contact**
- Create `apps/app/src/components/clients/EmergencyContactCard.tsx`: show and edit.
- Modify `apps/app/src/App.tsx`: `Client` type.
- Modify `apps/app/src/pages/practice/ClientsPage.tsx`: three form fields.
- Modify `apps/app/src/pages/practice/ClientDetailPage.tsx`: use the card.
- Test: `apps/app/src/components/__tests__/EmergencyContactCard.test.tsx`.

**API: staff bookings**
- Modify `prisma/schema.prisma`: `ConsultBooking.createdByProfileId`.
- Create `prisma/migrations/20260928100000_staff_bookings/migration.sql`.
- Create `apps/api/src/modules/consult/staff-booking-rules.ts`: pure rules
  (payment parse, hold, amount, role allowances, pay-link token).
- Create `apps/api/src/modules/consult/booking-limits.ts`: the Starter monthly
  limit, moved out of `createBooking`.
- Create `apps/api/src/modules/consult/staff-booking.service.ts`: create, pay
  link lookup and pay, emails.
- Modify `apps/api/src/modules/consult/consult.service.ts`:
  - use `booking-limits`;
  - make `resolveVideoRoomLink` and `startOnlinePayment` public;
  - `getTherapistBookings` returns payment fields.
- Modify `apps/api/src/modules/consult/consult.cron.ts`: honour `holdExpiresAt`
  on online bookings.
- Modify `apps/api/src/modules/consult/manual-payment.service.ts`: `markPaid`
  accepts staff link bookings.
- Modify `apps/api/src/modules/consult/consult.controller.ts`: three routes.
- Modify `apps/api/src/modules/consult/consult.module.ts`: provide `StaffBookingService`.
- Tests: `consult/staff-booking-rules.spec.ts`, `consult/staff-booking.spec.ts`,
  `consult/staff-pay-link.spec.ts` (all new), plus the existing
  `consult/manual-payment.spec.ts`.

**App: staff bookings**
- Create `apps/app/src/components/booking/StaffBookingDialog.tsx`.
- Create `apps/app/src/pages/public/PayBookingPage.tsx`.
- Modify `apps/app/src/App.tsx`: the `/pay/:bookingId` route on the public
  router, and the `Session` type fields.
- Modify `apps/app/src/pages/practice/ClientDetailPage.tsx`: "Book a session"
  button.
- Modify `apps/app/src/pages/practice/SchedulePage.tsx`: "New booking" button
  and payment chips.
- Tests: `apps/app/src/components/__tests__/StaffBookingDialog.test.tsx` and
  `apps/app/src/pages/public/__tests__/PayBookingPage.test.tsx`.

---

## Part A: Emergency contact (PR 1)

### Task 1: Store and return the emergency contact

**Files:**
- Modify: `prisma/schema.prisma` (model `Profile`, after `dateOfBirth`)
- Create: `prisma/migrations/20260928090000_client_emergency_contact/migration.sql`
- Create: `apps/api/src/modules/tenant/emergency-contact.ts`
- Modify: `apps/api/src/modules/tenant/tenant.service.ts` (`createClient` at
  about line 891, `getClientById` at about line 792)
- Test: `apps/api/src/modules/tenant/client-record.spec.ts`

**Interfaces:**
- Produces:
  - `export interface EmergencyContact { name: string; relationship: string | null; phone: string | null }`
  - `export interface EmergencyContactInput { name?: string | null; relationship?: string | null; phone?: string | null }`
  - `export function emergencyContactData(input: EmergencyContactInput | undefined, legacy?: string): { emergencyContactName?: string | null; emergencyContactRelationship?: string | null; emergencyContactPhone?: string | null }`.
    It returns `{}` when there is nothing to set. Blank strings become `null`.
  - `export function emergencyContactOf(p: { emergencyContactName: string | null; emergencyContactRelationship: string | null; emergencyContactPhone: string | null }): EmergencyContact | null`
  - `export function emergencyContactText(c: EmergencyContact | null): string`,
    for example `"Tolu Ade (sister) · +234 801 000 0000"`, or `''`.
  - `TenantService.createClient` accepts `emergencyContact?: EmergencyContactInput`
    and keeps accepting `emergency?: string`.
  - `getClientById` and `createClient` responses gain
    `emergencyContact: EmergencyContact | null`. `emergency` is now
    `emergencyContactText(...)`.

- [ ] **Step 1: Add the columns and migration**

In `prisma/schema.prisma`, model `Profile`, after `dateOfBirth DateTime?`:

```prisma
  // Who to call in a crisis. Seen by clinical staff only.
  emergencyContactName         String? @db.VarChar(120)
  emergencyContactRelationship String? @db.VarChar(60)
  emergencyContactPhone        String? @db.VarChar(40)
```

`prisma/migrations/20260928090000_client_emergency_contact/migration.sql`:

```sql
ALTER TABLE "Profile"
  ADD COLUMN "emergencyContactName" VARCHAR(120),
  ADD COLUMN "emergencyContactRelationship" VARCHAR(60),
  ADD COLUMN "emergencyContactPhone" VARCHAR(40);
```

Run (repo root):
`npx prisma migrate deploy --schema prisma/schema.prisma && npx prisma generate --schema prisma/schema.prisma`

Expected: "1 migration applied", then "Generated Prisma Client".

- [ ] **Step 2: Write the failing tests**

`apps/api/src/modules/tenant/client-record.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { emergencyContactData, emergencyContactOf, emergencyContactText } from './emergency-contact';

/**
 * The client record's emergency contact.
 *
 * The new-client form has asked for one since launch, but the server threw it
 * away: staff typed a name and number and the client page showed an empty
 * box. These pin that it is kept, shown to clinical staff, and editable.
 */
const TENANT = 1n;

const CLIENT_ROW = {
  id: 40n,
  tenantId: TENANT,
  role: 'CLIENT',
  status: 'active',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Ola',
  phone: null,
  createdAt: new Date('2026-08-01T09:00:00Z'),
  emergencyContactName: 'Tolu Ade',
  emergencyContactRelationship: 'Sister',
  emergencyContactPhone: '+2348010000000',
  clientBookings: [],
};

function makeService(over: Record<string, any> = {}) {
  const prisma: any = {
    profile: {
      findFirst: vi.fn().mockResolvedValue(over.findFirst === undefined ? null : over.findFirst),
      create: vi.fn(async ({ data }: any) => ({ id: 41n, createdAt: new Date('2026-09-28T09:00:00Z'), ...data })),
      update: vi.fn(async ({ data }: any) => ({ ...CLIENT_ROW, ...data })),
    },
    clinicalNote: { findMany: vi.fn().mockResolvedValue([]) },
    universalFormSubmission: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prisma, service: new TenantService(prisma, { sendEmail: vi.fn() } as any) };
}

describe('emergency contact helpers', () => {
  it('turns blanks into nulls and trims', () => {
    expect(emergencyContactData({ name: '  Tolu ', relationship: '', phone: ' 0801 ' })).toEqual({
      emergencyContactName: 'Tolu',
      emergencyContactRelationship: null,
      emergencyContactPhone: '0801',
    });
  });

  it('reads the old single "emergency" box as the name', () => {
    expect(emergencyContactData(undefined, 'Tolu 0801')).toEqual({ emergencyContactName: 'Tolu 0801' });
  });

  it('sets nothing when nothing was given', () => {
    expect(emergencyContactData(undefined)).toEqual({});
  });

  it('refuses a relationship or phone with no name', () => {
    expect(() => emergencyContactData({ phone: '0801' })).toThrow(BadRequestException);
  });

  it('shapes a stored contact, and reports none as null', () => {
    expect(emergencyContactOf(CLIENT_ROW)).toEqual({ name: 'Tolu Ade', relationship: 'Sister', phone: '+2348010000000' });
    expect(emergencyContactOf({ emergencyContactName: null, emergencyContactRelationship: 'x', emergencyContactPhone: 'y' })).toBeNull();
    expect(emergencyContactText(emergencyContactOf(CLIENT_ROW))).toBe('Tolu Ade (Sister) · +2348010000000');
  });
});

describe('creating a client', () => {
  it('keeps the emergency contact', async () => {
    const { service, prisma } = makeService();
    const created = await service.createClient(TENANT, {
      firstName: 'Ada',
      email: 'ada@example.com',
      emergencyContact: { name: 'Tolu Ade', relationship: 'Sister', phone: '+2348010000000' },
    });
    expect(prisma.profile.create.mock.calls[0][0].data).toMatchObject({
      emergencyContactName: 'Tolu Ade',
      emergencyContactRelationship: 'Sister',
      emergencyContactPhone: '+2348010000000',
    });
    expect(created.emergencyContact).toEqual({ name: 'Tolu Ade', relationship: 'Sister', phone: '+2348010000000' });
  });

  it('still accepts the old single field from older app builds', async () => {
    const { service, prisma } = makeService();
    await service.createClient(TENANT, { firstName: 'Ada', email: 'ada@example.com', emergency: 'Tolu 0801' });
    expect(prisma.profile.create.mock.calls[0][0].data.emergencyContactName).toBe('Tolu 0801');
  });
});

describe('reading a client', () => {
  it('returns the stored contact', async () => {
    const { service } = makeService({ findFirst: CLIENT_ROW });
    const client = await service.getClientById(TENANT, 40n);
    expect(client.emergencyContact).toEqual({ name: 'Tolu Ade', relationship: 'Sister', phone: '+2348010000000' });
    expect(client.emergency).toBe('Tolu Ade (Sister) · +2348010000000');
  });

  it('is not found for a missing client', async () => {
    const { service } = makeService({ findFirst: null });
    await expect(service.getClientById(TENANT, 99n)).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `cd apps/api && npx vitest run src/modules/tenant/client-record.spec.ts`
Expected: FAIL, "Failed to resolve import './emergency-contact'".

- [ ] **Step 4: Write the helpers**

`apps/api/src/modules/tenant/emergency-contact.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

export interface EmergencyContact {
  name: string;
  relationship: string | null;
  phone: string | null;
}

export interface EmergencyContactInput {
  name?: string | null;
  relationship?: string | null;
  phone?: string | null;
}

type Columns = {
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: string | null;
};

const clean = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s ? s : null;
};

/**
 * The columns to write. `legacy` is the single "emergency" box older app
 * builds still send; it becomes the name.
 */
export function emergencyContactData(input: EmergencyContactInput | undefined, legacy?: string): Columns {
  if (input) {
    const name = clean(input.name, 120);
    const relationship = clean(input.relationship, 60);
    const phone = clean(input.phone, 40);
    if (!name && (relationship || phone)) {
      throw new BadRequestException('Add the emergency contact’s name too.');
    }
    return { emergencyContactName: name, emergencyContactRelationship: relationship, emergencyContactPhone: phone };
  }
  const old = clean(legacy, 120);
  return old ? { emergencyContactName: old } : {};
}

export function emergencyContactOf(p: {
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
}): EmergencyContact | null {
  if (!p.emergencyContactName) return null;
  return { name: p.emergencyContactName, relationship: p.emergencyContactRelationship, phone: p.emergencyContactPhone };
}

export function emergencyContactText(c: EmergencyContact | null): string {
  if (!c) return '';
  return [c.relationship ? `${c.name} (${c.relationship})` : c.name, c.phone].filter(Boolean).join(' · ');
}
```

- [ ] **Step 5: Wire them into `createClient` and `getClientById`**

In `tenant.service.ts`, add the import:

```ts
import { EmergencyContactInput, emergencyContactData, emergencyContactOf, emergencyContactText } from './emergency-contact';
```

In `createClient`:
1. Extend the dto type with `emergencyContact?: EmergencyContactInput;`.
2. Compute `const contact = emergencyContactData(dto.emergencyContact, dto.emergency);`
   before the `existing` check. It throws on bad input before any write.
3. Spread `...contact,` into `profile.create({ data: { ... } })`.
4. Replace the returned `emergency: dto.emergency || '',` with:

```ts
      emergencyContact: emergencyContactOf(profile),
      emergency: emergencyContactText(emergencyContactOf(profile)),
```

In `getClientById`, replace `emergency: '',` with the same two lines, using
`client` in place of `profile`.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd apps/api && npx vitest run src/modules/tenant/client-record.spec.ts`
Expected: PASS (9 tests).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260928090000_client_emergency_contact apps/api/src/modules/tenant/emergency-contact.ts apps/api/src/modules/tenant/tenant.service.ts apps/api/src/modules/tenant/client-record.spec.ts
git commit -m "Keep the emergency contact staff enter on a client record

The new-client form asked for one, but the server dropped it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Edit a client's details (PATCH)

**Files:**
- Modify: `apps/api/src/modules/tenant/tenant.service.ts`: new `updateClient`
  after `createClient`
- Modify: `apps/api/src/modules/tenant/tenant.controller.ts`: new route after
  `createClient`
- Test: `apps/api/src/modules/tenant/client-record.spec.ts` (append)

**Interfaces:**
- Consumes: `emergencyContactData`, `emergencyContactOf` and
  `emergencyContactText` from Task 1.
- Produces:
  - `TenantService.updateClient(tenantId: bigint, clientProfileId: bigint, dto: { firstName?: string; lastName?: string | null; phone?: string | null; emergencyContact?: EmergencyContactInput })`,
    which returns `{ id: string; name: string; phone: string; emergencyContact: EmergencyContact | null; emergency: string }`.
  - Route: `PATCH /v1/tenant/clients/:profileId`, `@Roles(...STAFF)`.

- [ ] **Step 1: Write the failing tests** (append to `client-record.spec.ts`)

```ts
describe('editing a client', () => {
  it('updates the contact on a client of this practice', async () => {
    const { service, prisma } = makeService({ findFirst: { id: 40n } });
    const res = await service.updateClient(TENANT, 40n, { emergencyContact: { name: 'Bola', relationship: 'Friend', phone: '0802' } });
    expect(prisma.profile.findFirst).toHaveBeenCalledWith({ where: { id: 40n, tenantId: TENANT, role: 'CLIENT' }, select: { id: true } });
    expect(prisma.profile.update.mock.calls[0][0]).toMatchObject({
      where: { id: 40n },
      data: { emergencyContactName: 'Bola', emergencyContactRelationship: 'Friend', emergencyContactPhone: '0802' },
    });
    expect(res.emergencyContact).toEqual({ name: 'Bola', relationship: 'Friend', phone: '0802' });
  });

  it('clears the contact when the name is emptied', async () => {
    const { service, prisma } = makeService({ findFirst: { id: 40n } });
    await service.updateClient(TENANT, 40n, { emergencyContact: { name: '', relationship: '', phone: '' } });
    expect(prisma.profile.update.mock.calls[0][0].data).toMatchObject({
      emergencyContactName: null,
      emergencyContactRelationship: null,
      emergencyContactPhone: null,
    });
  });

  it('will not touch a staff profile or another practice’s client', async () => {
    // The scoped lookup finds nothing for either, so both are "not found".
    const { service, prisma } = makeService({ findFirst: null });
    await expect(service.updateClient(TENANT, 5n, { phone: '0803' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  it('refuses a blank first name', async () => {
    const { service } = makeService({ findFirst: { id: 40n } });
    await expect(service.updateClient(TENANT, 40n, { firstName: '  ' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/api && npx vitest run src/modules/tenant/client-record.spec.ts`
Expected: FAIL, "service.updateClient is not a function".

- [ ] **Step 3: Implement `updateClient`**

In `tenant.service.ts`, after `createClient`:

```ts
  /** Staff edit a client's contact details. Never a staff profile, never another practice. */
  async updateClient(
    tenantId: bigint,
    clientProfileId: bigint,
    dto: { firstName?: string; lastName?: string | null; phone?: string | null; emergencyContact?: EmergencyContactInput },
  ) {
    const found = await this.prisma.profile.findFirst({
      where: { id: clientProfileId, tenantId, role: 'CLIENT' },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Client not found');

    const data: Record<string, unknown> = { ...emergencyContactData(dto?.emergencyContact) };
    if (dto?.firstName !== undefined) {
      const firstName = String(dto.firstName ?? '').trim();
      if (!firstName) throw new BadRequestException('Enter the client’s first name.');
      data.firstName = firstName.slice(0, 100);
    }
    if (dto?.lastName !== undefined) data.lastName = String(dto.lastName ?? '').trim().slice(0, 100) || null;
    if (dto?.phone !== undefined) data.phone = String(dto.phone ?? '').trim().slice(0, 40) || null;

    const p = await this.prisma.profile.update({ where: { id: clientProfileId }, data });
    const contact = emergencyContactOf(p);
    return {
      id: p.id.toString(),
      name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.email,
      phone: p.phone || '',
      emergencyContact: contact,
      emergency: emergencyContactText(contact),
    };
  }
```

- [ ] **Step 4: Add the route**

In `tenant.controller.ts`, after the `createClient` handler (`Patch` is already
imported):

```ts
  @Roles(...STAFF)
  @Patch('clients/:profileId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Edit a client’s name, phone and emergency contact' })
  updateClient(
    @Req() req: any,
    @Param('profileId') profileId: string,
    @Body() dto: { firstName?: string; lastName?: string | null; phone?: string | null; emergencyContact?: { name?: string; relationship?: string; phone?: string } },
  ) {
    if (!/^\d+$/.test(profileId)) throw new NotFoundException('Client not found');
    return this.tenantService.updateClient(authenticatedTenantId(req), BigInt(profileId), dto);
  }
```

Add `NotFoundException` to the `@nestjs/common` import if it is not already
there.

- [ ] **Step 5: Run the tests and the route guards**

Run: `cd apps/api && npx vitest run src/modules/tenant/client-record.spec.ts src/common/roles.spec.ts src/modules/auth/client-surface.spec.ts`
Expected: PASS. If `roles.spec.ts` lives elsewhere, find it with
`git ls-files | grep roles.spec`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/tenant/tenant.service.ts apps/api/src/modules/tenant/tenant.controller.ts apps/api/src/modules/tenant/client-record.spec.ts
git commit -m "Let staff edit a client's contact details and emergency contact

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Emergency contact in the data export and on erasure

**Files:**
- Modify: `apps/api/src/modules/privacy/data-export.service.ts` (the `about`
  block, about line 131)
- Modify: `apps/api/src/modules/privacy/privacy.service.ts` (the
  `tx.profile.update` data, about line 108)
- Test: `apps/api/src/modules/privacy/data-export.spec.ts` and
  `apps/api/src/modules/privacy/privacy.service.spec.ts` (append)

**Interfaces:**
- Consumes: `emergencyContactOf` from Task 1.
- Produces: `about.emergencyContact: EmergencyContact | null` in the export.

- [ ] **Step 1: Write the failing tests**

Append to `data-export.spec.ts`:

```ts
describe('the emergency contact', () => {
  it('is part of what the practice holds about the person', async () => {
    const { service } = makeService({
      client: { emergencyContactName: 'Tolu Ade', emergencyContactRelationship: 'Sister', emergencyContactPhone: '0801' },
    });
    const out: any = await service.exportClientData(TENANT, OWNER, CLIENT);
    expect(out.about.emergencyContact).toEqual({ name: 'Tolu Ade', relationship: 'Sister', phone: '0801' });
  });

  it('is null when none was recorded', async () => {
    const { service } = makeService();
    const out: any = await service.exportClientData(TENANT, OWNER, CLIENT);
    expect(out.about.emergencyContact).toBeNull();
  });
});
```

In `data-export.spec.ts` `makeService`, add these three lines to the default
`client` object, before `...(over.client ?? {})`:

```ts
    emergencyContactName: null,
    emergencyContactRelationship: null,
    emergencyContactPhone: null,
```

In `privacy.service.spec.ts`, inside
`it('clears every identifying field on the profile', ...)`, extend the
`toMatchObject` with:

```ts
        emergencyContactName: null,
        emergencyContactRelationship: null,
        emergencyContactPhone: null,
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/api && npx vitest run src/modules/privacy`
Expected: FAIL. `about.emergencyContact` is undefined, and the erase data
lacks `emergencyContactName`.

- [ ] **Step 3: Implement**

`data-export.service.ts`: import
`import { emergencyContactOf } from '../tenant/emergency-contact';`, and in
`about` after `dateOfBirth`:

```ts
        emergencyContact: emergencyContactOf(client),
```

`privacy.service.ts`: in the erase `tx.profile.update` data, after
`dateOfBirth: null,`:

```ts
          emergencyContactName: null,
          emergencyContactRelationship: null,
          emergencyContactPhone: null,
```

In the same file, update the human-readable list at about line 163 to
`'Name, email, phone, gender, date of birth, emergency contact and profile photo'`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd apps/api && npx vitest run src/modules/privacy`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/privacy
git commit -m "Include the emergency contact in a client's data export and clear it on erasure

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Emergency contact in the app

**Files:**
- Create: `apps/app/src/components/clients/EmergencyContactCard.tsx`
- Modify: `apps/app/src/App.tsx` (the `Client` interface at about line 92)
- Modify: `apps/app/src/pages/practice/ClientsPage.tsx` (form state and
  `handleAddClient`)
- Modify: `apps/app/src/pages/practice/ClientDetailPage.tsx` (the amber box at
  about line 195)
- Test: `apps/app/src/components/__tests__/EmergencyContactCard.test.tsx`

**Interfaces:**
- Consumes: `PATCH /v1/tenant/clients/:id` from Task 2, which returns
  `{ emergencyContact, emergency }`.
- Produces:
  - `EmergencyContactCard({ clientId, contact, onSaved }: { clientId: string; contact: EmergencyContact | null; onSaved: (c: EmergencyContact | null) => void })`;
  - `export interface EmergencyContact { name: string; relationship: string | null; phone: string | null }`,
    exported from `App.tsx` next to `Client`.

- [ ] **Step 1: Write the failing test**

`apps/app/src/components/__tests__/EmergencyContactCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

const apiPatch = vi.fn();
vi.mock('../../utils/apiClient', () => ({ api: { patch: (...a: unknown[]) => apiPatch(...a) } }));

const { EmergencyContactCard } = await import('../clients/EmergencyContactCard');

describe('EmergencyContactCard', () => {
  beforeEach(() => apiPatch.mockReset());
  afterEach(cleanup);

  it('shows the contact with a tap-to-call number', () => {
    render(<EmergencyContactCard clientId="40" contact={{ name: 'Tolu Ade', relationship: 'Sister', phone: '+2348010000000' }} onSaved={() => {}} />);
    expect(screen.getByText('Tolu Ade')).toBeTruthy();
    expect(screen.getByText('Sister')).toBeTruthy();
    expect(screen.getByRole('link', { name: '+2348010000000' }).getAttribute('href')).toBe('tel:+2348010000000');
  });

  it('says so when none is recorded', () => {
    render(<EmergencyContactCard clientId="40" contact={null} onSaved={() => {}} />);
    expect(screen.getByText('Not recorded')).toBeTruthy();
  });

  it('saves an edit and hands back the new contact', async () => {
    const saved = { name: 'Bola', relationship: 'Friend', phone: '0802' };
    apiPatch.mockResolvedValue({ emergencyContact: saved });
    const onSaved = vi.fn();
    render(<EmergencyContactCard clientId="40" contact={null} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit emergency contact' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bola' } });
    fireEvent.change(screen.getByLabelText('Relationship'), { target: { value: 'Friend' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0802' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(apiPatch).toHaveBeenCalledWith('/v1/tenant/clients/40', { emergencyContact: { name: 'Bola', relationship: 'Friend', phone: '0802' } });
  });

  it('shows the server’s message when saving fails', async () => {
    apiPatch.mockRejectedValue(new Error('Add the emergency contact’s name too.'));
    render(<EmergencyContactCard clientId="40" contact={null} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit emergency contact' }));
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0802' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Add the emergency contact’s name too.')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd apps/app && npx vitest run src/components/__tests__/EmergencyContactCard.test.tsx`
Expected: FAIL, "Failed to resolve import '../clients/EmergencyContactCard'".

- [ ] **Step 3: Implement the card**

In `App.tsx`, next to `interface Client`:

```ts
export interface EmergencyContact {
  name: string;
  relationship: string | null;
  phone: string | null;
}
```

Add `emergencyContact?: EmergencyContact | null;` to `Client`. Keep
`emergency: string`, which the server still sends as text.

`apps/app/src/components/clients/EmergencyContactCard.tsx`:

```tsx
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { api } from '../../utils/apiClient';
import type { EmergencyContact } from '../../App';

const input = 'w-full h-[36px] px-3 rounded-[10px] bg-white border border-[#E3B341]/50 text-[12.5px] text-[#0F172A] outline-none';

export function EmergencyContactCard({
  clientId,
  contact,
  onSaved,
}: {
  clientId: string;
  contact: EmergencyContact | null;
  onSaved: (c: EmergencyContact | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(contact?.name ?? '');
  const [relationship, setRelationship] = useState(contact?.relationship ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.patch<{ emergencyContact: EmergencyContact | null }>(`/v1/tenant/clients/${clientId}`, {
        emergencyContact: { name, relationship, phone },
      });
      onSaved(res.emergencyContact);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-3.5 rounded-[16px] bg-[#FEF3C7] border border-[#E3B341]/40">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10.5px] font-bold tracking-wider text-[#92400E]">EMERGENCY CONTACT</span>
        {!editing && (
          <button type="button" aria-label="Edit emergency contact" onClick={() => setEditing(true)} className="h-6 w-6 inline-flex items-center justify-center rounded-[6px] text-[#92400E] hover:bg-[#FDE68A] cursor-pointer">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} className="space-y-2">
          <label className="block text-[11px] font-semibold text-[#92400E]">Name<input className={input} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block text-[11px] font-semibold text-[#92400E]">Relationship<input className={input} value={relationship} onChange={(e) => setRelationship(e.target.value)} /></label>
          <label className="block text-[11px] font-semibold text-[#92400E]">Phone<input className={input} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          {error ? <p className="text-[11.5px] font-medium text-rose-700">{error}</p> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="h-[32px] px-3 rounded-[10px] bg-[#92400E] text-white text-[12px] font-bold cursor-pointer disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="h-[32px] px-3 rounded-[10px] text-[#92400E] text-[12px] font-semibold cursor-pointer">Cancel</button>
          </div>
        </form>
      ) : contact ? (
        <div className="text-[12px] text-[#92400E] leading-tight space-y-0.5">
          <span className="font-bold block">{contact.name}</span>
          {contact.relationship ? <span className="block">{contact.relationship}</span> : null}
          {contact.phone ? <a className="block font-semibold underline" href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a> : null}
        </div>
      ) : (
        <span className="text-[12px] font-semibold text-[#92400E]/70">Not recorded</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd apps/app && npx vitest run src/components/__tests__/EmergencyContactCard.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Use the card on the client page and add the form fields**

**`ClientDetailPage.tsx`:** replace the amber `<div className="p-3.5 rounded-[16px] bg-[#FEF3C7] ...">…</div>`
block with:

```tsx
            <EmergencyContactCard
              clientId={client.id}
              contact={client.emergencyContact ?? null}
              onSaved={(c) => setClient((prev) => ({ ...prev, emergencyContact: c }))}
            />
```

Also add
`import { EmergencyContactCard } from '../../components/clients/EmergencyContactCard';`.

**`ClientsPage.tsx`:** replace the single `formEmergency` state and input.
1. Add three state hooks:

```tsx
  const [formEcName, setFormEcName] = useState('');
  const [formEcRelationship, setFormEcRelationship] = useState('');
  const [formEcPhone, setFormEcPhone] = useState('');
```

2. In `handleAddClient`, replace `emergency: formEmergency || undefined,` with:

```tsx
        emergencyContact: formEcName ? { name: formEcName, relationship: formEcRelationship, phone: formEcPhone } : undefined,
```

3. After a successful add, reset all three instead of `setFormEmergency('')`.
4. Replace the emergency `<input>` in the modal with three inputs labelled
   "Emergency contact name", "Relationship" and "Phone". Use the same
   className as the neighbouring inputs.
5. Delete the now-unused `formEmergency` state.

- [ ] **Step 6: Typecheck and run the app tests**

Run: `cd apps/app && npx tsc --noEmit && npx vitest run`
Expected: no type errors, and all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/app/src
git commit -m "Show and edit a client's emergency contact

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Ship Part A

- [ ] **Step 1: Run the full suites**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json && npx vitest run; cd ../app && npx tsc --noEmit && npx vitest run`
Expected: everything passes.

- [ ] **Step 2: Check it in a browser**

1. Start the API: `cd apps/api && npx nest build && PORT=3099 node dist/src/main.js`.
2. Start the app: `cd apps/app && VITE_API_URL=http://localhost:3099 npx vite --port 5173 --strictPort`.
3. Log in as `dr.jane@smiththerapy.ng` / `password123`.
4. Create a client with an emergency contact, open the client, and reload.
5. Expected: the contact is still shown. Edit it, reload, and confirm the
   change stuck.

- [ ] **Step 3: Push and open PR 1**

```bash
git push origin dev
gh pr create --base main --head dev --title "Keep and edit a client's emergency contact" --body "$(cat <<'EOF'
## What
- The new-client form's emergency contact is now saved. Before this, the server dropped it.
- Clinical staff see it on the client page, with a tap-to-call number, and can edit it.
- It is in the client's data export, and cleared on erasure.

## API
- `Profile.emergencyContactName`, `emergencyContactRelationship` and `emergencyContactPhone` (migration `20260928090000_client_emergency_contact`).
- `PATCH /v1/tenant/clients/:profileId` (staff).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Part B: Staff bookings (PR 2)

### Task 6: Staff booking for an open slot, with all three payment choices

**Files:**
- Modify: `prisma/schema.prisma` (model `ConsultBooking`)
- Create: `prisma/migrations/20260928100000_staff_bookings/migration.sql`
- Create: `apps/api/src/modules/consult/staff-booking-rules.ts`
- Create: `apps/api/src/modules/consult/booking-limits.ts`
- Create: `apps/api/src/modules/consult/staff-booking.service.ts`
- Modify: `apps/api/src/modules/consult/consult.service.ts`:
  - replace the inline Starter limit in `createBooking` (about lines 586–598)
    with `assertWithinMonthlyLimit`;
  - make `resolveVideoRoomLink` (about line 1332) and `startOnlinePayment`
    (about line 755) public.
- Test: `apps/api/src/modules/consult/staff-booking-rules.spec.ts` and
  `apps/api/src/modules/consult/staff-booking.spec.ts`

**Interfaces:**
- Produces, in `staff-booking-rules.ts`:
  - `export type StaffPayment = 'LINK' | 'PAID' | 'NONE'`
  - `export function parseStaffPayment(v: unknown): StaffPayment` (throws 400)
  - `export function paymentsAllowed(role: string): StaffPayment[]`
  - `export function staffLinkHold(now: Date, startsAt: Date): Date | null`
  - `export function paidAmount(input: string | undefined, priceKobo: bigint): bigint`
  - `export const STAFF_LINK_HOLD_HOURS = 48`
  - `export const LINK_CUTOFF_HOURS = 2`
- Produces, in `booking-limits.ts`:
  `export async function assertWithinMonthlyLimit(prisma: { consultBooking: { count: Function } }, tenantId: bigint, tier: string | null | undefined): Promise<void>`
- Produces, in `staff-booking.service.ts`:
  - `export interface StaffBookingInput { clientProfileId: string; serviceId: string; providerProfileId?: string; availabilityId?: string; startsAt?: string; payment: string; amountKobo?: string; note?: string; notifyClient?: boolean }`
  - `export interface StaffBookingResult { bookingId: string; status: 'PENDING_PAYMENT' | 'CONFIRMED'; paymentMethod: 'PAYSTACK' | 'MANUAL' | 'NONE'; amountKobo: string; startsAt: string; endsAt: string; holdExpiresAt: string | null; serviceTitle: string; practitionerName: string; clientName: string }`
  - `StaffBookingService.createForClient(tenantId: bigint, actorProfileId: bigint, dto: StaffBookingInput): Promise<StaffBookingResult>`
  - A protected hook, `afterCreate(bookingId: bigint, result: StaffBookingResult, notifyClient: boolean): Promise<void>`.
    It is a no-op here; Task 10 fills it in.

- [ ] **Step 1: Add the schema and migration**

In `ConsultBooking`, after `paymentConfirmedByProfileId BigInt?`:

```prisma
  /// Set when staff made the booking for the client; null when the client booked.
  createdByProfileId          BigInt?
```

Update the `paymentMethod` doc comment to read:
`"PAYSTACK" (paid online), "MANUAL" (bank transfer or paid at the practice, confirmed by staff), or "NONE" (the practice waived the fee).`

`prisma/migrations/20260928100000_staff_bookings/migration.sql`:

```sql
ALTER TABLE "ConsultBooking" ADD COLUMN "createdByProfileId" BIGINT;
```

Run: `npx prisma migrate deploy --schema prisma/schema.prisma && npx prisma generate --schema prisma/schema.prisma`

- [ ] **Step 2: Write the failing rules tests**

`apps/api/src/modules/consult/staff-booking-rules.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { paidAmount, parseStaffPayment, paymentsAllowed, staffLinkHold } from './staff-booking-rules';

describe('the hold on a payment link', () => {
  const now = new Date('2026-10-01T09:00:00Z');
  it('lasts 48 hours for a session well ahead', () => {
    expect(staffLinkHold(now, new Date('2026-10-10T09:00:00Z'))?.toISOString()).toBe('2026-10-03T09:00:00.000Z');
  });
  it('ends 2 hours before a session that is sooner', () => {
    expect(staffLinkHold(now, new Date('2026-10-02T09:00:00Z'))?.toISOString()).toBe('2026-10-02T07:00:00.000Z');
  });
  it('is impossible for a session under 2 hours away', () => {
    expect(staffLinkHold(now, new Date('2026-10-01T10:30:00Z'))).toBeNull();
  });
});

describe('who may choose which payment', () => {
  it('front desk and admins may use all three', () => {
    for (const role of ['OWNER', 'ADMIN', 'RECEPTIONIST']) expect(paymentsAllowed(role)).toEqual(['LINK', 'PAID', 'NONE']);
  });
  it('a therapist may send a link or waive, not mark paid', () => {
    expect(paymentsAllowed('THERAPIST')).toEqual(['LINK', 'NONE']);
  });
  it('a client may not use any', () => {
    expect(paymentsAllowed('CLIENT')).toEqual([]);
  });
});

describe('reading the payment choice', () => {
  it('accepts the three values in any case', () => {
    expect(parseStaffPayment('link')).toBe('LINK');
    expect(parseStaffPayment('PAID')).toBe('PAID');
    expect(parseStaffPayment('None')).toBe('NONE');
  });
  it('refuses anything else', () => {
    expect(() => parseStaffPayment('FREE')).toThrow(BadRequestException);
    expect(() => parseStaffPayment(undefined)).toThrow(BadRequestException);
  });
});

describe('the amount recorded as paid', () => {
  it('defaults to the service price', () => {
    expect(paidAmount(undefined, 2500000n)).toBe(2500000n);
    expect(paidAmount('', 2500000n)).toBe(2500000n);
  });
  it('takes a smaller amount staff actually received', () => {
    expect(paidAmount('2000000', 2500000n)).toBe(2000000n);
  });
  it('refuses more than the price, and non-numbers', () => {
    expect(() => paidAmount('3000000', 2500000n)).toThrow(BadRequestException);
    expect(() => paidAmount('12.5', 2500000n)).toThrow(BadRequestException);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `cd apps/api && npx vitest run src/modules/consult/staff-booking-rules.spec.ts`
Expected: FAIL, "Failed to resolve import './staff-booking-rules'".

- [ ] **Step 4: Implement the rules**

`apps/api/src/modules/consult/staff-booking-rules.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

export type StaffPayment = 'LINK' | 'PAID' | 'NONE';

/** How long a staff-sent payment link keeps the session's slot. */
export const STAFF_LINK_HOLD_HOURS = 48;
/** A link must be paid at least this long before the session starts. */
export const LINK_CUTOFF_HOURS = 2;

const HOUR = 60 * 60 * 1000;

export function parseStaffPayment(v: unknown): StaffPayment {
  const s = String(v ?? '').toUpperCase();
  if (s === 'LINK' || s === 'PAID' || s === 'NONE') return s;
  throw new BadRequestException('Choose how the session will be paid.');
}

/** Marking money received stays with the front desk, as the existing mark-paid does. */
export function paymentsAllowed(role: string): StaffPayment[] {
  if (['OWNER', 'ADMIN', 'RECEPTIONIST'].includes(role)) return ['LINK', 'PAID', 'NONE'];
  if (role === 'THERAPIST') return ['LINK', 'NONE'];
  return [];
}

/**
 * When an unpaid link lets the slot go: 48 hours from now, but never later
 * than 2 hours before the session. Null when that is already past.
 */
export function staffLinkHold(now: Date, startsAt: Date): Date | null {
  const hold = new Date(now.getTime() + STAFF_LINK_HOLD_HOURS * HOUR);
  const cutoff = new Date(startsAt.getTime() - LINK_CUTOFF_HOURS * HOUR);
  const end = hold < cutoff ? hold : cutoff;
  return end > now ? end : null;
}

/** What staff say they received. Never more than the price. */
export function paidAmount(input: string | undefined, priceKobo: bigint): bigint {
  if (input === undefined || input === '') return priceKobo;
  if (!/^\d+$/.test(String(input))) throw new BadRequestException('Enter the amount received in whole kobo.');
  const kobo = BigInt(input);
  if (kobo > priceKobo) throw new BadRequestException('The amount received cannot be more than the session price.');
  return kobo;
}
```

Run: `cd apps/api && npx vitest run src/modules/consult/staff-booking-rules.spec.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Move the Starter limit out of `createBooking`, with no behaviour change**

`apps/api/src/modules/consult/booking-limits.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

/** Bookings a Starter practice may take in a calendar month. */
export const STARTER_MONTHLY_BOOKINGS = 20;

export async function assertWithinMonthlyLimit(
  prisma: { consultBooking: { count: (args: any) => Promise<number> } },
  tenantId: bigint,
  tier: string | null | undefined,
): Promise<void> {
  if ((tier || 'STARTER').toUpperCase() !== 'STARTER') return;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const count = await prisma.consultBooking.count({
    where: { tenantId, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
  });
  if (count >= STARTER_MONTHLY_BOOKINGS) {
    throw new BadRequestException('Monthly booking limit reached. Upgrade to Pro to accept unlimited bookings.');
  }
}
```

In `consult.service.ts` `createBooking`, replace the block from
`const tier = (slot.tenant.subscriptionTier || 'STARTER').toUpperCase();` to
its closing `}` with:

```ts
    await assertWithinMonthlyLimit(this.prisma, tenantId, slot.tenant.subscriptionTier);
```

Add `import { assertWithinMonthlyLimit } from './booking-limits';`. Also change
`private async resolveVideoRoomLink` to `async resolveVideoRoomLink`, and
`private async startOnlinePayment` to `async startOnlinePayment`.

Run: `cd apps/api && npx vitest run src/modules/consult`
Expected: PASS, since existing behaviour is unchanged.

- [ ] **Step 6: Write the failing service tests**

`apps/api/src/modules/consult/staff-booking.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StaffBookingService } from './staff-booking.service';

/**
 * Staff booking a session for a client who is already on the books.
 *
 * The same guards as a client booking online (one booking per slot, the
 * practice's own services and practitioners, the Starter limit) plus the ones
 * that only matter when staff do it: who may book for whom, and who may
 * record money as received.
 */
const TENANT = 1n;
const OWNER = 5n;
const THERAPIST = 6n;
const OTHER_THERAPIST = 7n;
const CLIENT = 40n;
const DAY = 24 * 60 * 60 * 1000;
const inDays = (d: number) => new Date(Date.now() + d * DAY);

function setup(over: Record<string, any> = {}) {
  const startsAt = over.startsAt ?? inDays(5);
  const slot = {
    id: 300n,
    tenantId: TENANT,
    providerProfileId: over.slotProvider ?? OWNER,
    serviceId: null,
    service: null,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
    isActive: true,
  };
  const actors: Record<string, any> = {
    [String(OWNER)]: { id: OWNER, role: 'OWNER', firstName: 'Jane', lastName: 'Smith' },
    [String(THERAPIST)]: { id: THERAPIST, role: 'THERAPIST', firstName: 'Ade', lastName: 'B' },
  };
  const client = over.client === undefined ? { id: CLIENT, firstName: 'Ada', lastName: 'Ola', email: 'ada@example.com' } : over.client;
  const tx: any = {
    consultAvailability: {
      updateMany: vi.fn().mockResolvedValue({ count: over.claimCount ?? 1 }),
      create: vi.fn(async ({ data }: any) => ({ id: 301n, ...data })),
    },
    consultBooking: {
      create: vi.fn(async ({ data }: any) => ({ id: 900n, ...data })),
      findFirst: vi.fn().mockResolvedValue(over.clash ?? null),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  const prisma: any = {
    profile: {
      findFirst: vi.fn(async ({ where }: any) => (where.role === 'CLIENT' ? client : actors[String(where.id)] ?? null)),
    },
    consultTherapistProfile: {
      findFirst: vi.fn(async ({ where }: any) =>
        [OWNER, THERAPIST, OTHER_THERAPIST].includes(where.profileId)
          ? { profileId: where.profileId, videoProvider: 'JITSI', profile: { firstName: 'Jane', lastName: 'Smith' } }
          : null,
      ),
    },
    consultService: {
      findFirst: vi.fn().mockResolvedValue(
        over.service === undefined ? { id: 20n, title: 'Therapy session', durationMinutes: 50, priceKobo: 2500000n } : over.service,
      ),
    },
    consultAvailability: { findFirst: vi.fn().mockResolvedValue(over.slot === undefined ? slot : over.slot) },
    consultBooking: { count: vi.fn().mockResolvedValue(over.monthCount ?? 0) },
    tenant: { findUnique: vi.fn().mockResolvedValue({ id: TENANT, subscriptionTier: over.tier ?? 'PRO', name: 'Smith Therapy', slug: 'dr-smith' }) },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  };
  const consult: any = {
    resolveVideoRoomLink: vi.fn().mockResolvedValue({ roomName: 'room-1', roomLink: 'https://meet.example/room-1' }),
    startOnlinePayment: vi.fn(),
  };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  const calendar: any = { pushBookingToGoogle: vi.fn().mockResolvedValue(undefined) };
  const service = new StaffBookingService(prisma, consult, notifications, calendar);
  return { service, prisma, tx, consult, notifications, calendar, slot };
}

const base = { clientProfileId: String(CLIENT), serviceId: '20', availabilityId: '300' };

describe('payment choices', () => {
  it('a payment link waits for payment and holds the slot', async () => {
    const { service, tx } = setup();
    const res = await service.createForClient(TENANT, OWNER, { ...base, payment: 'LINK' });
    const data = tx.consultBooking.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'PENDING_PAYMENT', paymentMethod: 'PAYSTACK', amountKobo: 2500000n, createdByProfileId: OWNER });
    expect(data.holdExpiresAt).toBeInstanceOf(Date);
    expect(res).toMatchObject({ status: 'PENDING_PAYMENT', paymentMethod: 'PAYSTACK', amountKobo: '2500000' });
  });

  it('marked as paid confirms and records who and when', async () => {
    const { service, tx } = setup();
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'PAID', amountKobo: '2000000' });
    const data = tx.consultBooking.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'CONFIRMED', paymentMethod: 'MANUAL', amountKobo: 2000000n, paymentConfirmedByProfileId: OWNER });
    expect(data.paidAt).toBeInstanceOf(Date);
  });

  it('no charge confirms at zero', async () => {
    const { service, tx } = setup();
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' });
    expect(tx.consultBooking.create.mock.calls[0][0].data).toMatchObject({ status: 'CONFIRMED', paymentMethod: 'NONE', amountKobo: 0n });
  });

  it('a free service confirms whatever was chosen', async () => {
    const { service, tx } = setup({ service: { id: 20n, title: 'Intro call', durationMinutes: 15, priceKobo: 0n } });
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'LINK' });
    expect(tx.consultBooking.create.mock.calls[0][0].data).toMatchObject({ status: 'CONFIRMED', amountKobo: 0n });
  });

  it('a payment link is refused for a session under 2 hours away', async () => {
    const { service } = setup({ startsAt: new Date(Date.now() + 60 * 60 * 1000) });
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'LINK' })).rejects.toThrow(/starts too soon/);
  });
});

describe('therapist limits', () => {
  it('a therapist books for themselves', async () => {
    const { service, prisma, tx } = setup({ slotProvider: THERAPIST });
    await service.createForClient(TENANT, THERAPIST, { ...base, payment: 'NONE' });
    expect(prisma.consultAvailability.findFirst.mock.calls[0][0].where).toMatchObject({ providerProfileId: THERAPIST });
    expect(tx.consultBooking.create).toHaveBeenCalled();
  });

  it('a therapist may not book for a colleague', async () => {
    const { service } = setup();
    await expect(
      service.createForClient(TENANT, THERAPIST, { ...base, providerProfileId: String(OTHER_THERAPIST), payment: 'NONE' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a therapist may not mark a session paid', async () => {
    const { service } = setup({ slotProvider: THERAPIST });
    await expect(service.createForClient(TENANT, THERAPIST, { ...base, payment: 'PAID' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('what is checked', () => {
  it('the client must be a client of this practice', async () => {
    const { service } = setup({ client: null });
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('the client lookup is scoped to this practice and to clients only', async () => {
    const { service, prisma } = setup();
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' });
    expect(prisma.profile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CLIENT, tenantId: TENANT, role: 'CLIENT', status: 'active' } }),
    );
  });

  it('the service must be active in this practice', async () => {
    const { service } = setup({ service: null });
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' })).rejects.toThrow(/service/);
  });

  it('the slot must be long enough for the service', async () => {
    const { service } = setup({ service: { id: 20n, title: 'Long', durationMinutes: 90, priceKobo: 0n } });
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' })).rejects.toThrow(/too short/);
  });

  it('a slot taken meanwhile is refused and nothing is written', async () => {
    const { service, tx } = setup({ claimCount: 0 });
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' })).rejects.toThrow(/no longer open/);
    expect(tx.consultBooking.create).not.toHaveBeenCalled();
  });

  it('the Starter monthly limit applies', async () => {
    const { service } = setup({ tier: 'STARTER', monthCount: 20 });
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' })).rejects.toThrow(/Monthly booking limit/);
  });

  it('a time is required', async () => {
    const { service } = setup();
    await expect(
      service.createForClient(TENANT, OWNER, { clientProfileId: String(CLIENT), serviceId: '20', payment: 'NONE' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('counts a no-charge booking as zero revenue', async () => {
    const { chargedKobo } = await import('../../common/revenue');
    expect(chargedKobo({ amountKobo: 0n, service: { priceKobo: 2500000n } })).toBe(0n);
  });
});
```

- [ ] **Step 7: Run it and confirm it fails**

Run: `cd apps/api && npx vitest run src/modules/consult/staff-booking.spec.ts`
Expected: FAIL, "Failed to resolve import './staff-booking.service'".

- [ ] **Step 8: Implement `StaffBookingService` (the open-slot path)**

`apps/api/src/modules/consult/staff-booking.service.ts`:

```ts
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { CalendarService } from '../calendar/calendar.service';
import { ConsultService } from './consult.service';
import { assertWithinMonthlyLimit } from './booking-limits';
import { paidAmount, parseStaffPayment, paymentsAllowed, staffLinkHold } from './staff-booking-rules';

export interface StaffBookingInput {
  clientProfileId: string;
  serviceId: string;
  providerProfileId?: string;
  availabilityId?: string;
  startsAt?: string;
  payment: string;
  amountKobo?: string;
  note?: string;
  notifyClient?: boolean;
}

export interface StaffBookingResult {
  bookingId: string;
  status: 'PENDING_PAYMENT' | 'CONFIRMED';
  paymentMethod: 'PAYSTACK' | 'MANUAL' | 'NONE';
  amountKobo: string;
  startsAt: string;
  endsAt: string;
  holdExpiresAt: string | null;
  serviceTitle: string;
  practitionerName: string;
  clientName: string;
}

const id = (v: unknown, what: string): bigint => {
  if (!/^\d+$/.test(String(v ?? ''))) throw new BadRequestException(`Choose ${what}.`);
  return BigInt(String(v));
};
const fullName = (p: { firstName?: string | null; lastName?: string | null } | null | undefined) =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();

/**
 * Staff booking a session for a client already on the books: from the client's
 * page or the schedule, into an open slot or a time they choose, paid by a link
 * the client is sent, marked as already paid, or at no charge.
 */
@Injectable()
export class StaffBookingService {
  protected readonly logger = new Logger(StaffBookingService.name);

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly consult: ConsultService,
    protected readonly notifications: NotificationService,
    protected readonly calendar: CalendarService,
  ) {}

  async createForClient(tenantId: bigint, actorProfileId: bigint, dto: StaffBookingInput): Promise<StaffBookingResult> {
    const payment = parseStaffPayment(dto?.payment);
    const clientId = id(dto?.clientProfileId, 'a client');
    const serviceId = id(dto?.serviceId, 'a service');

    // The role is read here, not trusted from the token, as RolesGuard does.
    const actor = await this.prisma.profile.findFirst({
      where: { id: actorProfileId, tenantId, status: 'active' },
      select: { id: true, role: true, firstName: true, lastName: true },
    });
    if (!actor) throw new ForbiddenException('Your account cannot book sessions here.');
    const allowed = paymentsAllowed(actor.role);
    if (!allowed.length) throw new ForbiddenException('Your account cannot book sessions here.');
    if (!allowed.includes(payment)) {
      throw new ForbiddenException('Only the front desk or a practice admin can mark a session as paid.');
    }

    const providerId = dto.providerProfileId ? id(dto.providerProfileId, 'a practitioner') : actorProfileId;
    if (actor.role === 'THERAPIST' && providerId !== actorProfileId) {
      throw new ForbiddenException('You can only book sessions in your own diary.');
    }

    const client = await this.prisma.profile.findFirst({
      where: { id: clientId, tenantId, role: 'CLIENT', status: 'active' },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    const therapist = await this.prisma.consultTherapistProfile.findFirst({
      where: { profileId: providerId, tenantId, profile: { status: 'active' } },
      include: { profile: true },
    });
    if (!therapist) throw new BadRequestException('Choose a practitioner in this practice.');

    const service = await this.prisma.consultService.findFirst({ where: { id: serviceId, tenantId, isActive: true } });
    if (!service) throw new BadRequestException('That service is not offered. Choose another service.');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    await assertWithinMonthlyLimit(this.prisma, tenantId, tenant?.subscriptionTier);

    const time = await this.resolveTime(tenantId, providerId, service, dto);

    const price = BigInt(service.priceKobo ?? 0);
    const now = new Date();
    const free = price === 0n || payment === 'NONE';
    let hold: Date | null = null;
    if (!free && payment === 'LINK') {
      hold = staffLinkHold(now, time.startsAt);
      if (!hold) {
        throw new BadRequestException('This session starts too soon for a payment link. Mark it as paid, or as no charge.');
      }
    }

    const paymentData = free
      ? { status: 'CONFIRMED', paymentMethod: 'NONE', amountKobo: 0n }
      : payment === 'PAID'
        ? { status: 'CONFIRMED', paymentMethod: 'MANUAL', amountKobo: paidAmount(dto.amountKobo, price), paidAt: now, paymentConfirmedByProfileId: actorProfileId }
        : { status: 'PENDING_PAYMENT', paymentMethod: 'PAYSTACK', amountKobo: price, holdExpiresAt: hold };

    const booking = await this.prisma.$transaction(async (tx) => {
      const slotId = await this.claimTime(tx, tenantId, providerId, service.id, time, fullName(therapist.profile));
      const { roomName } = await this.consult.resolveVideoRoomLink(therapist, Date.now());
      return tx.consultBooking.create({
        data: {
          tenantId,
          serviceId: service.id,
          availabilityId: slotId,
          clientProfileId: client.id,
          createdByProfileId: actorProfileId,
          notes: dto.note ? String(dto.note).trim().slice(0, 1000) || null : null,
          videoRoomName: roomName,
          ...paymentData,
        } as any,
      });
    });

    const result: StaffBookingResult = {
      bookingId: booking.id.toString(),
      status: paymentData.status as StaffBookingResult['status'],
      paymentMethod: paymentData.paymentMethod as StaffBookingResult['paymentMethod'],
      amountKobo: paymentData.amountKobo.toString(),
      startsAt: time.startsAt.toISOString(),
      endsAt: time.endsAt.toISOString(),
      holdExpiresAt: hold ? hold.toISOString() : null,
      serviceTitle: service.title,
      practitionerName: fullName(therapist.profile),
      clientName: fullName(client) || client.email,
    };
    // After commit, and never failing the booking.
    await this.afterCreate(booking.id, result, dto.notifyClient !== false).catch((err) =>
      this.logger.warn(`After-booking steps failed for ${booking.id}: ${(err as Error).message}`),
    );
    return result;
  }

  /** Emails and calendar sync. Filled in by Task 10. */
  protected async afterCreate(_bookingId: bigint, _result: StaffBookingResult, _notifyClient: boolean): Promise<void> {}

  /** Where the session sits: an open slot, or (Task 7) a time staff choose. */
  protected async resolveTime(
    tenantId: bigint,
    providerId: bigint,
    service: { id: bigint; durationMinutes: number },
    dto: StaffBookingInput,
  ): Promise<{ kind: 'slot'; slotId: bigint; startsAt: Date; endsAt: Date } | { kind: 'custom'; startsAt: Date; endsAt: Date }> {
    if (dto.availabilityId) {
      const slot = await this.prisma.consultAvailability.findFirst({
        where: { id: id(dto.availabilityId, 'a time'), tenantId, providerProfileId: providerId, isActive: true },
      });
      if (!slot) throw new BadRequestException('That time is no longer open. Choose another.');
      if (slot.serviceId !== null && slot.serviceId !== service.id) {
        throw new BadRequestException('That time is kept for a different service. Choose another.');
      }
      if (service.durationMinutes > (slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000) {
        throw new BadRequestException('That time is too short for this service. Choose another.');
      }
      return { kind: 'slot', slotId: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt };
    }
    throw new BadRequestException('Choose a time.');
  }

  /** Takes the time inside the transaction. Returns the availability id to book against. */
  protected async claimTime(
    tx: any,
    tenantId: bigint,
    _providerId: bigint,
    _serviceId: bigint,
    time: Awaited<ReturnType<StaffBookingService['resolveTime']>>,
    _practitionerName: string,
  ): Promise<bigint> {
    if (time.kind === 'slot') {
      const claimed = await tx.consultAvailability.updateMany({
        where: { id: time.slotId, tenantId, isActive: true },
        data: { isActive: false },
      });
      if (claimed.count === 0) throw new BadRequestException('That time is no longer open. Choose another.');
      return time.slotId;
    }
    throw new BadRequestException('Choose a time.');
  }
}
```

- [ ] **Step 9: Run the tests and confirm they pass**

Run: `cd apps/api && npx vitest run src/modules/consult/staff-booking.spec.ts src/modules/consult/staff-booking-rules.spec.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260928100000_staff_bookings apps/api/src/modules/consult
git commit -m "Let staff book an open slot for a client, paid by link, marked paid, or free

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Custom time

**Files:**
- Modify: `apps/api/src/modules/consult/staff-booking.service.ts` (the
  `resolveTime` and `claimTime` custom branches)
- Test: `apps/api/src/modules/consult/staff-booking.spec.ts` (append)

**Interfaces:**
- Consumes: the `setup()` test harness and `StaffBookingService` from Task 6.
- Produces: `StaffBookingInput.startsAt` (an ISO string) is honoured when
  `availabilityId` is absent.

- [ ] **Step 1: Write the failing tests** (append)

```ts
describe('a custom time', () => {
  const custom = (startsAt: Date) => ({ clientProfileId: String(CLIENT), serviceId: '20', startsAt: startsAt.toISOString(), payment: 'NONE' });

  it('makes its own closed slot the length of the service', async () => {
    const { service, tx } = setup();
    const at = inDays(3);
    const res = await service.createForClient(TENANT, OWNER, custom(at));
    expect(tx.consultAvailability.create.mock.calls[0][0].data).toMatchObject({
      tenantId: TENANT,
      providerProfileId: OWNER,
      serviceId: 20n,
      startsAt: at,
      endsAt: new Date(at.getTime() + 50 * 60_000),
      isActive: false,
    });
    expect(tx.consultBooking.create.mock.calls[0][0].data.availabilityId).toBe(301n);
    expect(res.endsAt).toBe(new Date(at.getTime() + 50 * 60_000).toISOString());
  });

  it('holds a per-practitioner lock so two custom bookings cannot interleave', async () => {
    const { service, tx } = setup();
    await service.createForClient(TENANT, OWNER, custom(inDays(3)));
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw.mock.calls[0].slice(1)).toEqual([`staff-booking:${TENANT}:${OWNER}`]);
  });

  it('deactivates overlapping open slots before it checks for clashes', async () => {
    // Order matters. The slot update waits on a public booking that is
    // claiming the same slot; the clash check after it then sees that
    // booking, which it would miss if it ran first.
    const { service, tx } = setup();
    const at = inDays(3);
    await service.createForClient(TENANT, OWNER, custom(at));
    const deactivate = tx.consultAvailability.updateMany.mock.invocationCallOrder[0];
    const clashCheck = tx.consultBooking.findFirst.mock.invocationCallOrder[0];
    expect(deactivate).toBeLessThan(clashCheck);
    expect(tx.consultAvailability.updateMany.mock.calls[0][0]).toEqual({
      where: { tenantId: TENANT, providerProfileId: OWNER, isActive: true, startsAt: { lt: new Date(at.getTime() + 50 * 60_000) }, endsAt: { gt: at } },
      data: { isActive: false },
    });
  });

  it('refuses a time that clashes with another session', async () => {
    const clashStart = inDays(3);
    const { service, tx } = setup({
      clash: { availability: { startsAt: clashStart, endsAt: new Date(clashStart.getTime() + 50 * 60_000) } },
    });
    await expect(service.createForClient(TENANT, OWNER, custom(clashStart))).rejects.toThrow(/already has a session/);
    expect(tx.consultBooking.create).not.toHaveBeenCalled();
  });

  it('refuses a time in the past, or not a time at all', async () => {
    const { service } = setup();
    await expect(service.createForClient(TENANT, OWNER, custom(new Date(Date.now() - 60_000)))).rejects.toThrow(/future/);
    await expect(
      service.createForClient(TENANT, OWNER, { clientProfileId: String(CLIENT), serviceId: '20', startsAt: 'tomorrow', payment: 'NONE' }),
    ).rejects.toThrow(/valid time/);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/api && npx vitest run src/modules/consult/staff-booking.spec.ts`
Expected: FAIL, "Choose a time." thrown for the custom cases.

- [ ] **Step 3: Implement the custom branches**

In `resolveTime`, replace the final `throw new BadRequestException('Choose a time.');`
with:

```ts
    if (dto.startsAt) {
      const startsAt = new Date(String(dto.startsAt));
      if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Enter a valid time.');
      if (startsAt.getTime() <= Date.now()) throw new BadRequestException('Choose a time in the future.');
      return { kind: 'custom', startsAt, endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000) };
    }
    throw new BadRequestException('Choose a time.');
```

In `claimTime`, rename the unused-parameter underscores
(`providerId`, `serviceId`, `practitionerName`). Then replace the final
`throw new BadRequestException('Choose a time.');` with:

```ts
    // One custom booking at a time per practitioner, for this transaction.
    const lockKey = `staff-booking:${tenantId}:${providerId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

    // Close overlapping open slots FIRST. This update waits on any public
    // booking mid-claim of one of them, so the clash check below, which runs
    // after it, sees that booking once it commits.
    await tx.consultAvailability.updateMany({
      where: { tenantId, providerProfileId: providerId, isActive: true, startsAt: { lt: time.endsAt }, endsAt: { gt: time.startsAt } },
      data: { isActive: false },
    });

    const clash = await tx.consultBooking.findFirst({
      where: {
        tenantId,
        status: { not: 'CANCELLED' },
        availability: { providerProfileId: providerId, startsAt: { lt: time.endsAt }, endsAt: { gt: time.startsAt } },
      },
      include: { availability: true },
    });
    if (clash) {
      const hhmm = (d: Date) => d.toISOString().slice(11, 16);
      throw new BadRequestException(
        `${practitionerName || 'This practitioner'} already has a session from ${hhmm(clash.availability.startsAt)} to ${hhmm(clash.availability.endsAt)} (UTC). Choose another time.`,
      );
    }

    const slot = await tx.consultAvailability.create({
      data: { tenantId, providerProfileId: providerId, serviceId, startsAt: time.startsAt, endsAt: time.endsAt, channel: 'VIDEO', isActive: false },
    });
    return slot.id;
```

Throwing rolls the transaction back, which restores the deactivated slots.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd apps/api && npx vitest run src/modules/consult/staff-booking.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/consult/staff-booking.service.ts apps/api/src/modules/consult/staff-booking.spec.ts
git commit -m "Let staff book a custom time without double-booking the practitioner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Hold payment-link bookings until their own expiry

**Files:**
- Modify: `apps/api/src/modules/consult/consult.cron.ts:25-33`
- Modify: `apps/api/src/modules/consult/manual-payment.service.ts` (`markPaid`)
- Test: `apps/api/src/modules/consult/manual-payment.spec.ts` (append)

**Interfaces:**
- Produces:
  - Cron: online bookings with `holdExpiresAt` set expire at that time; the
    rest still expire after 30 minutes.
  - `markPaid` accepts a pending booking where `createdByProfileId` is set,
    whatever its method.

- [ ] **Step 1: Write the failing tests** (append to `manual-payment.spec.ts`,
  which already imports `ConsultCron` and `manualService`)

```ts
describe('staff payment-link bookings', () => {
  it('the cron uses the booking’s own hold, not the 30-minute online rule', async () => {
    const prisma: any = { consultBooking: { findMany: vi.fn().mockResolvedValue([]) } };
    await new ConsultCron(prisma, {} as any).handleBookingExpiry();
    const or = prisma.consultBooking.findMany.mock.calls[0][0].where.OR;
    expect(or).toEqual([
      { paymentMethod: { not: 'MANUAL' }, holdExpiresAt: null, createdAt: { lt: expect.any(Date) } },
      { paymentMethod: { not: 'MANUAL' }, holdExpiresAt: { lt: expect.any(Date) } },
      { paymentMethod: 'MANUAL', holdExpiresAt: { lt: expect.any(Date) } },
    ]);
  });

  it('staff can mark a link booking paid when the client pays at the practice', async () => {
    const { service, prisma } = manualService();
    await service.markPaid(TENANT, 9n, 900n);
    expect(prisma.consultBooking.updateMany.mock.calls[0][0].where).toEqual({
      id: 900n,
      tenantId: TENANT,
      status: 'PENDING_PAYMENT',
      OR: [{ paymentMethod: 'MANUAL' }, { createdByProfileId: { not: null } }],
    });
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd apps/api && npx vitest run src/modules/consult/manual-payment.spec.ts`
Expected: FAIL on both new tests.

- [ ] **Step 3: Implement**

In `consult.cron.ts`, replace the `OR` array with:

```ts
        OR: [
          // Online, booked by the client: 30 minutes to finish paying.
          { paymentMethod: { not: 'MANUAL' }, holdExpiresAt: null, createdAt: { lt: new Date(now.getTime() - ONLINE_HOLD_MS) } },
          // Online, a link staff sent: the booking carries its own hold.
          { paymentMethod: { not: 'MANUAL' }, holdExpiresAt: { lt: now } },
          { paymentMethod: 'MANUAL', holdExpiresAt: { lt: now } },
        ],
```

Update the doc comment above it to mention staff links.

In `manual-payment.service.ts` `markPaid`, change the `where` to:

```ts
      where: {
        id: bookingId,
        tenantId,
        status: 'PENDING_PAYMENT',
        // A transfer, or a booking staff made (the client may pay in person
        // instead of using the link). Never a client's own online checkout.
        OR: [{ paymentMethod: 'MANUAL' }, { createdByProfileId: { not: null } }],
      },
```

- [ ] **Step 4: Run the consult tests and confirm they pass**

Run: `cd apps/api && npx vitest run src/modules/consult`
Expected: PASS. If an existing `markPaid` test asserts the old `where` shape,
update it to the new shape; the behaviour for MANUAL bookings is unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/consult
git commit -m "Hold a staff payment link until its own expiry, and allow marking it paid in person

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Signed payment link

**Files:**
- Modify: `apps/api/src/modules/consult/staff-booking-rules.ts` (add the token)
- Modify: `apps/api/src/modules/consult/staff-booking.service.ts` (add
  `payLinkSummary` and `payLinkCheckout`)
- Test: `apps/api/src/modules/consult/staff-pay-link.spec.ts`

**Interfaces:**
- Produces:
  - `export function payLinkToken(bookingId: bigint): string` (32 hex chars)
  - `export function payLinkTokenValid(bookingId: bigint, token: unknown): boolean`
  - `StaffBookingService.payLinkSummary(tenantId: bigint, bookingId: bigint, token: string)`,
    which returns
    `Promise<{ state: 'PAYABLE' | 'PAID' | 'LAPSED'; serviceTitle: string; practitionerName: string; startsAt: string; amountKobo: string; practiceName: string }>`.
  - `StaffBookingService.payLinkCheckout(tenantId: bigint, bookingId: bigint, token: string): Promise<{ paymentUrl: string }>`.
  - Consumed by Task 10 for the email URL:
    `${tenantWebOrigin(tenant)}/pay/${bookingId}?t=${payLinkToken(bookingId)}`.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/modules/consult/staff-pay-link.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { payLinkToken, payLinkTokenValid } from './staff-booking-rules';
import { StaffBookingService } from './staff-booking.service';

const TENANT = 1n;
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

function setup(booking: Record<string, any> | null) {
  const prisma: any = {
    consultBooking: { findFirst: vi.fn().mockResolvedValue(booking), update: vi.fn() },
  };
  const consult: any = { startOnlinePayment: vi.fn().mockResolvedValue('https://checkout.paystack.com/abc') };
  const service = new StaffBookingService(prisma, consult, {} as any, {} as any);
  return { service, prisma, consult };
}

const pending = {
  id: 900n,
  tenantId: TENANT,
  status: 'PENDING_PAYMENT',
  amountKobo: 2500000n,
  holdExpiresAt: inDays(1),
  service: { title: 'Therapy session', priceKobo: 3000000n },
  availability: { startsAt: inDays(4), therapist: { profile: { firstName: 'Jane', lastName: 'Smith' } } },
  client: { email: 'ada@example.com' },
  tenant: { name: 'Smith Therapy', slug: 'dr-smith', customDomain: null, customDomainStatus: null },
};

describe('the payment link token', () => {
  it('is stable for a booking and checks out', () => {
    expect(payLinkToken(900n)).toMatch(/^[0-9a-f]{32}$/);
    expect(payLinkTokenValid(900n, payLinkToken(900n))).toBe(true);
  });

  it('rejects a token made for a different booking', () => {
    expect(payLinkTokenValid(900n, payLinkToken(901n))).toBe(false);
    expect(payLinkTokenValid(900n, undefined)).toBe(false);
    expect(payLinkTokenValid(900n, 'x')).toBe(false);
  });
});

describe('opening a payment link', () => {
  it('shows what is owed, at the agreed amount', async () => {
    const { service } = setup(pending);
    const s = await service.payLinkSummary(TENANT, 900n, payLinkToken(900n));
    expect(s).toMatchObject({ state: 'PAYABLE', serviceTitle: 'Therapy session', practitionerName: 'Jane Smith', amountKobo: '2500000', practiceName: 'Smith Therapy' });
  });

  it('is not found with a bad token, the same as a missing booking', async () => {
    const { service, prisma } = setup(pending);
    await expect(service.payLinkSummary(TENANT, 900n, payLinkToken(901n))).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.consultBooking.findFirst).not.toHaveBeenCalled();
  });

  it('says it is paid, or lapsed', async () => {
    expect((await setup({ ...pending, status: 'CONFIRMED' }).service.payLinkSummary(TENANT, 900n, payLinkToken(900n))).state).toBe('PAID');
    expect((await setup({ ...pending, status: 'CANCELLED' }).service.payLinkSummary(TENANT, 900n, payLinkToken(900n))).state).toBe('LAPSED');
  });
});

describe('paying through the link', () => {
  it('starts a fresh checkout for the agreed amount and records its reference', async () => {
    const { service, consult, prisma } = setup(pending);
    const res = await service.payLinkCheckout(TENANT, 900n, payLinkToken(900n));
    expect(res.paymentUrl).toBe('https://checkout.paystack.com/abc');
    const [tenantId, amount, email, reference, callback] = consult.startOnlinePayment.mock.calls[0];
    expect([tenantId, amount, email]).toEqual([TENANT, 2500000n, 'ada@example.com']);
    expect(reference).toMatch(/^booking-900-\d+$/);
    expect(callback).toBe('https://dr-smith.unclutterdesk.com/booking/confirmed');
    expect(prisma.consultBooking.update).toHaveBeenCalledWith({ where: { id: 900n }, data: { paymentRef: reference } });
  });

  it('refuses a booking that is not waiting for payment', async () => {
    const { service, consult } = setup({ ...pending, status: 'CONFIRMED' });
    await expect(service.payLinkCheckout(TENANT, 900n, payLinkToken(900n))).rejects.toBeInstanceOf(BadRequestException);
    expect(consult.startOnlinePayment).not.toHaveBeenCalled();
  });
});
```

Check the expected callback URL against `tenantWebOrigin` in
`apps/api/src/common/origins.ts`. If a bare slug maps to a different host in
tests, set the expectation to what `tenantWebOrigin({ slug: 'dr-smith' })`
returns.

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd apps/api && npx vitest run src/modules/consult/staff-pay-link.spec.ts`
Expected: FAIL, "payLinkToken is not exported".

- [ ] **Step 3: Implement the token**

Append to `staff-booking-rules.ts`:

```ts
import { createHmac, timingSafeEqual } from 'crypto';
import { JWT_SECRET } from '../../common/auth.config';

/** Proves a /pay link was issued by us for this booking. Same pattern as the .ics token. */
export function payLinkToken(bookingId: bigint): string {
  return createHmac('sha256', JWT_SECRET).update(`pay:${bookingId}`).digest('hex').slice(0, 32);
}

export function payLinkTokenValid(bookingId: bigint, token: unknown): boolean {
  if (typeof token !== 'string') return false;
  const a = Buffer.from(payLinkToken(bookingId), 'utf8');
  const b = Buffer.from(token, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Move the two new `import` lines to the top of the file.

- [ ] **Step 4: Implement the service methods**

In `staff-booking.service.ts`:
- add the imports
  `import { chargedKobo } from '../../common/revenue';` and
  `import { tenantWebOrigin } from '../../common/origins';`;
- extend the rules import with `payLinkTokenValid`;
- add the methods:

```ts
  private async payLinkBooking(tenantId: bigint, bookingId: bigint, token: string) {
    // The token is checked before any lookup, so a guess learns nothing.
    if (!payLinkTokenValid(bookingId, token)) throw new NotFoundException('This payment link is not valid.');
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        service: true,
        client: { select: { email: true } },
        tenant: { select: { name: true, slug: true, customDomain: true, customDomainStatus: true } },
        availability: { include: { therapist: { include: { profile: true } } } },
      },
    });
    if (!b) throw new NotFoundException('This payment link is not valid.');
    return b;
  }

  async payLinkSummary(tenantId: bigint, bookingId: bigint, token: string) {
    const b: any = await this.payLinkBooking(tenantId, bookingId, token);
    const state = b.status === 'PENDING_PAYMENT' ? 'PAYABLE' : b.status === 'CANCELLED' ? 'LAPSED' : 'PAID';
    return {
      state: state as 'PAYABLE' | 'PAID' | 'LAPSED',
      serviceTitle: b.service.title,
      practitionerName: fullName(b.availability.therapist?.profile),
      startsAt: b.availability.startsAt.toISOString(),
      amountKobo: chargedKobo(b).toString(),
      practiceName: b.tenant.name,
    };
  }

  async payLinkCheckout(tenantId: bigint, bookingId: bigint, token: string) {
    const b: any = await this.payLinkBooking(tenantId, bookingId, token);
    if (b.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        b.status === 'CANCELLED' ? 'This booking is no longer held. Contact the practice to book again.' : 'This session is already paid.',
      );
    }
    const reference = `booking-${b.id}-${Date.now()}`;
    const paymentUrl = await this.consult.startOnlinePayment(
      tenantId,
      chargedKobo(b),
      b.client.email,
      reference,
      `${tenantWebOrigin(b.tenant)}/booking/confirmed`,
    );
    // Only once Paystack accepted it, as getBookingPaymentUrl does.
    await this.prisma.consultBooking.update({ where: { id: b.id }, data: { paymentRef: reference } });
    return { paymentUrl };
  }
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd apps/api && npx vitest run src/modules/consult/staff-pay-link.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/consult
git commit -m "Add a signed payment link for staff-made bookings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: Emails and calendar after a staff booking

**Files:**
- Modify: `apps/api/src/modules/consult/staff-booking.service.ts` (fill in
  `afterCreate`)
- Test: `apps/api/src/modules/consult/staff-booking.spec.ts` (append)

**Interfaces:**
- Consumes:
  - `NotificationService.sendEmail({ to, type, title, message, link, actionLabel, tenantId, profileId })`,
    the same shape as `manual-payment.service.ts` `markPaid`;
  - `CalendarService.pushBookingToGoogle(bookingId)`;
  - `payLinkToken`.
- Produces: email types `bookings.staff_payment_link` and
  `bookings.staff_confirmed`.

- [ ] **Step 1: Check the notification type is free text**

Run: `grep -n "type" apps/api/src/modules/notifications/notification.types.ts 2>/dev/null | head; grep -rn "bookings.manual_payment_received" apps/api/src | head`

Expected: the type appears only at call sites. If there is a registry or union
of types, add the two new types to it in this step.

- [ ] **Step 2: Write the failing tests** (append to `staff-booking.spec.ts`)

First update the shared `setup()` at the top of the file:
- Replace `prisma.consultBooking` with:

```ts
    consultBooking: {
      count: vi.fn().mockResolvedValue(over.monthCount ?? 0),
      findFirst: vi.fn().mockResolvedValue({
        id: 900n,
        tenantId: TENANT,
        clientProfileId: CLIENT,
        client: { email: 'ada@example.com' },
        tenant: { name: 'Smith Therapy', slug: 'dr-smith', customDomain: null, customDomainStatus: null },
      }),
    },
```

Then append:

```ts
describe('after the booking', () => {
  it('emails the client a payment link for a link booking', async () => {
    const { service, notifications, calendar } = setup();
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'LINK' });
    const email = notifications.sendEmail.mock.calls[0][0];
    expect(email).toMatchObject({ to: 'ada@example.com', type: 'bookings.staff_payment_link', tenantId: TENANT, profileId: CLIENT });
    expect(email.link).toMatch(/\/pay\/900\?t=[0-9a-f]{32}$/);
    expect(calendar.pushBookingToGoogle).not.toHaveBeenCalled();
  });

  it('emails a confirmation and syncs the calendar for a confirmed booking', async () => {
    const { service, notifications, calendar } = setup();
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE' });
    expect(notifications.sendEmail.mock.calls[0][0]).toMatchObject({ type: 'bookings.staff_confirmed', link: expect.stringMatching(/\/portal$/) });
    expect(calendar.pushBookingToGoogle).toHaveBeenCalledWith(900n);
  });

  it('sends nothing to the client when staff untick "email the client"', async () => {
    const { service, notifications, calendar } = setup();
    await service.createForClient(TENANT, OWNER, { ...base, payment: 'NONE', notifyClient: false });
    expect(notifications.sendEmail).not.toHaveBeenCalled();
    expect(calendar.pushBookingToGoogle).toHaveBeenCalledWith(900n);
  });

  it('keeps the booking when the email fails', async () => {
    const { service, notifications } = setup();
    notifications.sendEmail.mockRejectedValue(new Error('provider down'));
    await expect(service.createForClient(TENANT, OWNER, { ...base, payment: 'LINK' })).resolves.toMatchObject({ bookingId: '900' });
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `cd apps/api && npx vitest run src/modules/consult/staff-booking.spec.ts`
Expected: FAIL. `sendEmail` is not called, because `afterCreate` is empty.

- [ ] **Step 4: Implement `afterCreate`**

Replace the empty `afterCreate` in `staff-booking.service.ts`. Also extend the
rules import with `payLinkToken`, and import
`formatNaira` from `'../billing/subscription-plans'`.

```ts
  protected async afterCreate(bookingId: bigint, r: StaffBookingResult, notifyClient: boolean): Promise<void> {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId },
      include: { client: true, tenant: true },
    });
    if (!b) return;
    const origin = tenantWebOrigin(b.tenant as any);
    const when = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos',
    }).format(new Date(r.startsAt));

    if (r.status === 'CONFIRMED') {
      await this.calendar.pushBookingToGoogle(bookingId).catch(() => undefined);
    }
    if (!notifyClient) return;

    try {
      if (r.status === 'PENDING_PAYMENT') {
        const deadline = r.holdExpiresAt
          ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(r.holdExpiresAt))
          : '';
        await this.notifications.sendEmail({
          to: b.client.email,
          type: 'bookings.staff_payment_link',
          title: `Pay for your session on ${when}`,
          message: `${b.tenant.name} has booked your ${r.serviceTitle} with ${r.practitionerName} on ${when}. Please pay ${formatNaira(Number(r.amountKobo))} by ${deadline} to keep this time.`,
          link: `${origin}/pay/${bookingId}?t=${payLinkToken(bookingId)}`,
          actionLabel: 'Pay now',
          tenantId: b.tenantId,
          profileId: b.clientProfileId,
        });
      } else {
        await this.notifications.sendEmail({
          to: b.client.email,
          type: 'bookings.staff_confirmed',
          title: 'Your session is booked',
          message: `${b.tenant.name} has booked your ${r.serviceTitle} with ${r.practitionerName} on ${when}.`,
          link: `${origin}/portal`,
          actionLabel: 'View my booking',
          tenantId: b.tenantId,
          profileId: b.clientProfileId,
        });
      }
    } catch (err) {
      this.logger.warn(`Could not email the client about booking ${bookingId}: ${(err as Error).message}`);
    }
  }
```


- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd apps/api && npx vitest run src/modules/consult`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/consult
git commit -m "Email the client after a staff booking, and sync confirmed ones to Google Calendar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Routes, module wiring and booking list fields

**Files:**
- Modify: `apps/api/src/modules/consult/consult.module.ts`
- Modify: `apps/api/src/modules/consult/consult.controller.ts`
- Modify: `apps/api/src/modules/consult/consult.service.ts`
  (`getTherapistBookings` at about line 822: extra fields)
- Test: the existing `client-surface.spec.ts` and `roles.spec.ts`, plus a
  booking-list assertion in `staff-booking.spec.ts`

**Interfaces:**
- Produces:
  - `POST /v1/consult/practice/bookings` (`@Roles(...STAFF)`), with body
    `StaffBookingInput`, returning `StaffBookingResult`.
  - `GET /v1/consult/public/bookings/:bookingId/pay-link?t=` (public, needs the
    tenant from the host), returning the `payLinkSummary` result.
  - `POST /v1/consult/public/bookings/:bookingId/pay-link` (public), with body
    `{ t: string }`, returning `{ paymentUrl }`.
  - Each `therapist/bookings` item gains `paymentMethod: string`,
    `amountKobo: string | null`, `holdExpiresAt: string | null` and
    `bookedBy: string | null`, the staff member's name.

- [ ] **Step 1: Wire the module**

`consult.module.ts`: import `StaffBookingService` and add it to `providers`.

- [ ] **Step 2: Add the routes**

In `consult.controller.ts`:
1. Inject `private readonly staffBookings: StaffBookingService` in the
   constructor.
2. Import it and `StaffBookingInput` from `'./staff-booking.service'`.
3. After the `markPaid` handler, add:

```ts
  @Roles(...STAFF)
  @Post('practice/bookings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Staff book a session for an existing client' })
  createStaffBooking(@Req() req: any, @Body() dto: StaffBookingInput) {
    return this.staffBookings.createForClient(authenticatedTenantId(req), authenticatedProfileId(req), dto);
  }

  @Get('public/bookings/:bookingId/pay-link')
  @ApiOperation({ summary: 'What a staff-sent payment link is for' })
  payLinkSummary(@Req() req: TenantRequest, @Param('bookingId') bookingId: string, @Query('t') t: string) {
    if (!req.tenantId || !/^\d+$/.test(bookingId)) throw new NotFoundException('This payment link is not valid.');
    return this.staffBookings.payLinkSummary(req.tenantId, BigInt(bookingId), t);
  }

  @Post('public/bookings/:bookingId/pay-link')
  @ApiOperation({ summary: 'Start paying a staff-sent payment link' })
  payLinkCheckout(@Req() req: TenantRequest, @Param('bookingId') bookingId: string, @Body() dto: { t?: string }) {
    if (!req.tenantId || !/^\d+$/.test(bookingId)) throw new NotFoundException('This payment link is not valid.');
    return this.staffBookings.payLinkCheckout(req.tenantId, BigInt(bookingId), String(dto?.t ?? ''));
  }
```

Check how the existing public routes (`public/bookings`, `public/payment-options`)
are exempted from `roles.spec.ts`: look for a `@Public()` decorator or an
allow-list in that spec. Give the two new public routes the same marking.

- [ ] **Step 3: Return the payment fields from `getTherapistBookings`**

`ConsultBooking` has no relation to the profile that created it, and this plan does not add one: a relation would mean a foreign key and a back-relation on `Profile` for a display name. In `consult.service.ts` `getTherapistBookings`, after the `findMany`, load the names with one query:

```ts
    const creatorIds = [...new Set(bookings.map((b) => b.createdByProfileId).filter((v): v is bigint => v !== null))];
    const creators = creatorIds.length
      ? await this.prisma.profile.findMany({ where: { tenantId, id: { in: creatorIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const creatorName = new Map(creators.map((c) => [c.id.toString(), `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()]));
```

Then add to each mapped item:

```ts
        paymentMethod: booking.paymentMethod,
        amountKobo: booking.amountKobo !== null ? booking.amountKobo.toString() : null,
        holdExpiresAt: booking.holdExpiresAt ? booking.holdExpiresAt.toISOString() : null,
        bookedBy: booking.createdByProfileId ? creatorName.get(booking.createdByProfileId.toString()) || 'Staff' : null,
```

- [ ] **Step 4: Run the full API suite and typecheck**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json && npx vitest run`
Expected: PASS, including `roles.spec.ts` and `client-surface.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/consult
git commit -m "Expose staff booking and payment-link routes; show payment state on the schedule feed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Staff booking dialog in the app

**Files:**
- Create: `apps/app/src/components/booking/StaffBookingDialog.tsx`
- Modify: `apps/app/src/pages/practice/ClientDetailPage.tsx` ("Book a session"
  button in the header card)
- Modify: `apps/app/src/pages/practice/SchedulePage.tsx` ("New booking" button
  in the page header)
- Test: `apps/app/src/components/__tests__/StaffBookingDialog.test.tsx`

**Interfaces:**
- Consumes:
  - `GET /v1/consult/services` (PRACTICE_ADMIN only), for admins. Everyone else
    uses `GET /v1/consult/public/services`.

    Before coding, check which endpoint a THERAPIST or RECEPTIONIST can read:
    `grep -n "public/services" -A8 apps/api/src/modules/consult/consult.controller.ts`.
    `public/services` needs the tenant from the host, which the practice app
    has. Use `public/services` for all roles.
  - `GET /v1/consult/public/availability?providerProfileId=&serviceId=`, whose
    result is shaped `{ slots: [{ id, startsAt, endsAt }] }`. Confirm the shape
    against `getPublicAvailability` (consult.service.ts at about line 338) and
    adjust `loadSlots`.
  - `GET /v1/tenant/staff` (STAFF), for the practitioner list. It returns an
    array of `{ kind: 'member' | 'invite', id, firstName, lastName, role, status, isTherapist, ... }`
    (`TenantService.getClinicStaff`). Keep only `kind === 'member' && isTherapist && status === 'active'`.
  - `POST /v1/consult/practice/bookings`.
  - `useAuth().profile.role`.
- Produces:
  `StaffBookingDialog({ client, onClose, onBooked }: { client: { id: string; name: string } | null; onClose: () => void; onBooked: (r: StaffBookingResult) => void })`.
  When `client` is null, it shows a client picker built from
  `GET /v1/tenant/clients`.

- [ ] **Step 1: Write the failing test**

`apps/app/src/components/__tests__/StaffBookingDialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), post: (...a: unknown[]) => apiPost(...a) },
}));
let role = 'OWNER';
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ profile: { id: '5', role } }) }));

const { StaffBookingDialog } = await import('../booking/StaffBookingDialog');

const soon = new Date(Date.now() + 5 * 86_400_000).toISOString();

function routes(path: string) {
  if (path.startsWith('/v1/consult/public/services')) return Promise.resolve([{ id: '20', title: 'Therapy session', durationMinutes: 50, priceKobo: '2500000' }]);
  if (path.startsWith('/v1/tenant/staff')) return Promise.resolve([{ kind: 'member', id: '5', firstName: 'Jane', lastName: 'Smith', status: 'active', isTherapist: true }]);
  if (path.startsWith('/v1/consult/public/availability')) return Promise.resolve({ slots: [{ id: '300', startsAt: soon, endsAt: soon }] });
  return Promise.resolve([]);
}

describe('StaffBookingDialog', () => {
  beforeEach(() => {
    role = 'OWNER';
    apiGet.mockReset().mockImplementation(routes);
    apiPost.mockReset();
  });
  afterEach(cleanup);

  it('books an open slot with a payment link', async () => {
    apiPost.mockResolvedValue({ bookingId: '900', status: 'PENDING_PAYMENT' });
    const onBooked = vi.fn();
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={onBooked} />);
    await waitFor(() => expect(screen.getByRole('radio', { name: /Therapy session/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', { name: /Therapy session/ }));
    await waitFor(() => expect(screen.getAllByRole('radio', { name: /am|pm|:\d\d/i }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByTestId('slot-300'));
    fireEvent.click(screen.getByRole('radio', { name: /Send a payment link/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Book session' }));
    await waitFor(() => expect(onBooked).toHaveBeenCalled());
    expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/bookings', expect.objectContaining({
      clientProfileId: '40', serviceId: '20', providerProfileId: '5', availabilityId: '300', payment: 'LINK', notifyClient: true,
    }));
  });

  it('does not offer "mark as paid" to a therapist', async () => {
    role = 'THERAPIST';
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={() => {}} />);
    await waitFor(() => expect(screen.getByRole('radio', { name: /Send a payment link/ })).toBeTruthy());
    expect(screen.queryByRole('radio', { name: /Mark as paid/ })).toBeNull();
  });

  it('shows the server’s reason when booking fails', async () => {
    apiPost.mockRejectedValue(new Error('Jane Smith already has a session from 10:00 to 10:50 (UTC). Choose another time.'));
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={() => {}} />);
    await waitFor(() => screen.getByRole('radio', { name: /Therapy session/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Therapy session/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Custom time' }));
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-12-01T10:00' } });
    fireEvent.click(screen.getByRole('radio', { name: /No charge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Book session' }));
    await waitFor(() => expect(screen.getByText(/already has a session/)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd apps/app && npx vitest run src/components/__tests__/StaffBookingDialog.test.tsx`
Expected: FAIL, "Failed to resolve import '../booking/StaffBookingDialog'".

- [ ] **Step 3: Implement the dialog**

`apps/app/src/components/booking/StaffBookingDialog.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Loader2, X } from 'lucide-react';
import { api } from '../../utils/apiClient';
import { useAuth } from '../../context/AuthContext';

type Service = { id: string; title: string; durationMinutes: number; priceKobo: string };
type StaffRow = { kind: 'member' | 'invite'; id: string; firstName: string | null; lastName: string | null; status: string; isTherapist: boolean };
type Staff = { id: string; name: string };
type Slot = { id: string; startsAt: string; endsAt: string };
type Payment = 'LINK' | 'PAID' | 'NONE';
export type StaffBookingResult = { bookingId: string; status: 'PENDING_PAYMENT' | 'CONFIRMED' };

const naira = (kobo: string | number) => `₦${(Number(kobo) / 100).toLocaleString('en-NG')}`;
const when = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

const PAYMENTS: Array<{ value: Payment; label: string; hint: string; frontDeskOnly?: boolean }> = [
  { value: 'LINK', label: 'Send a payment link', hint: 'The client pays online. The time is held for up to 48 hours.' },
  { value: 'PAID', label: 'Mark as paid', hint: 'Money already received, in cash or by transfer.', frontDeskOnly: true },
  { value: 'NONE', label: 'No charge', hint: 'The practice waives the fee for this session.' },
];

export function StaffBookingDialog({
  client,
  onClose,
  onBooked,
}: {
  client: { id: string; name: string } | null;
  onClose: () => void;
  onBooked: (r: StaffBookingResult) => void;
}) {
  const { profile } = useAuth();
  const role = String(profile?.role ?? '').toUpperCase();
  const isTherapist = role === 'THERAPIST';
  const payments = PAYMENTS.filter((p) => !(p.frontDeskOnly && isTherapist));

  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState(client?.id ?? '');
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [providerId, setProviderId] = useState(String(profile?.id ?? ''));
  const [mode, setMode] = useState<'slot' | 'custom'>('slot');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState('');
  const [customAt, setCustomAt] = useState('');
  const [payment, setPayment] = useState<Payment>('LINK');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [notifyClient, setNotifyClient] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Service[]>('/v1/consult/public/services').then(setServices).catch(() => setServices([]));
    if (!isTherapist) {
      // The roster also lists pending invites and receptionists; only active practitioners can be booked.
      api
        .get<StaffRow[]>('/v1/tenant/staff')
        .then((rows) =>
          setStaff(
            rows
              .filter((m) => m.kind === 'member' && m.isTherapist && m.status === 'active')
              .map((m) => ({ id: m.id, name: `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() })),
          ),
        )
        .catch(() => setStaff([]));
    }
    if (!client) {
      api.get<Array<{ id: string; name: string }>>('/v1/tenant/clients').then(setClients).catch(() => setClients([]));
    }
  }, [client, isTherapist]);

  useEffect(() => {
    setSlotId('');
    if (!serviceId || !providerId || mode !== 'slot') return setSlots([]);
    api
      .get<{ slots: Slot[] }>(`/v1/consult/public/availability?providerProfileId=${providerId}&serviceId=${serviceId}`)
      .then((r) => setSlots(r.slots ?? []))
      .catch(() => setSlots([]));
  }, [serviceId, providerId, mode]);

  const service = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);
  const ready = clientId && serviceId && (mode === 'slot' ? slotId : customAt);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<StaffBookingResult>('/v1/consult/practice/bookings', {
        clientProfileId: clientId,
        serviceId,
        providerProfileId: providerId || undefined,
        ...(mode === 'slot' ? { availabilityId: slotId } : { startsAt: new Date(customAt).toISOString() }),
        payment,
        ...(payment === 'PAID' && amount ? { amountKobo: String(Math.round(Number(amount) * 100)) } : {}),
        note: note || undefined,
        notifyClient,
      });
      onBooked(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not book the session');
      setBusy(false);
    }
  }

  const radio = (checked: boolean) =>
    `flex items-start gap-2 p-2.5 rounded-[12px] border cursor-pointer ${checked ? 'border-[#0F3A53] bg-[#F0F7FB]' : 'border-[#E2E8F0]'}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/60 p-4" role="dialog" aria-modal="true" aria-labelledby="staff-booking-title">
      <form onSubmit={submit} className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-[20px] bg-white p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-[#0F3A53]" />
            <h2 id="staff-booking-title" className="text-[16px] font-bold text-[#0F172A]">
              {client ? `Book a session for ${client.name}` : 'New booking'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!client && (
          <label className="block text-[12px] font-semibold text-[#334155]">
            Client
            <select className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[#E2E8F0] text-[13px]" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Choose a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}

        <fieldset className="space-y-2">
          <legend className="text-[12px] font-semibold text-[#334155] mb-1">Service</legend>
          {services.map((s) => (
            <label key={s.id} className={radio(serviceId === s.id)}>
              <input type="radio" name="service" checked={serviceId === s.id} onChange={() => setServiceId(s.id)} aria-label={`${s.title}, ${s.durationMinutes} minutes, ${naira(s.priceKobo)}`} />
              <span className="text-[13px] text-[#0F172A]">{s.title} · {s.durationMinutes} min · {naira(s.priceKobo)}</span>
            </label>
          ))}
        </fieldset>

        {!isTherapist && staff.length > 1 && (
          <label className="block text-[12px] font-semibold text-[#334155]">
            Practitioner
            <select className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[#E2E8F0] text-[13px]" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              {staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}

        <fieldset className="space-y-2">
          <legend className="text-[12px] font-semibold text-[#334155] mb-1">Time</legend>
          <div className="flex gap-2">
            <label className={radio(mode === 'slot')}><input type="radio" name="mode" checked={mode === 'slot'} onChange={() => setMode('slot')} aria-label="Open slots" /><span className="text-[13px]">Open slots</span></label>
            <label className={radio(mode === 'custom')}><input type="radio" name="mode" checked={mode === 'custom'} onChange={() => setMode('custom')} aria-label="Custom time" /><span className="text-[13px]">Custom time</span></label>
          </div>
          {mode === 'slot' ? (
            serviceId ? (
              slots.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((s) => (
                    <label key={s.id} data-testid={`slot-${s.id}`} className={radio(slotId === s.id)} onClick={() => setSlotId(s.id)}>
                      <input type="radio" name="slot" checked={slotId === s.id} onChange={() => setSlotId(s.id)} aria-label={when(s.startsAt)} />
                      <span className="text-[12.5px]">{when(s.startsAt)}</span>
                    </label>
                  ))}
                </div>
              ) : <p className="text-[12px] text-[#64748B]">No open slots. Use a custom time.</p>
            ) : <p className="text-[12px] text-[#64748B]">Choose a service first.</p>
          ) : (
            <label className="block text-[12px] font-semibold text-[#334155]">
              Date and time
              <input type="datetime-local" aria-label="Date and time" className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[#E2E8F0] text-[13px]" value={customAt} onChange={(e) => setCustomAt(e.target.value)} />
              <span className="block mt-1 text-[11.5px] font-normal text-[#64748B]">
                This can fall outside working hours. Any open slot it overlaps is closed.
                {service ? ` The session runs for ${service.durationMinutes} minutes.` : ''}
              </span>
            </label>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-[12px] font-semibold text-[#334155] mb-1">Payment</legend>
          {payments.map((p) => (
            <label key={p.value} className={radio(payment === p.value)}>
              <input type="radio" name="payment" checked={payment === p.value} onChange={() => setPayment(p.value)} aria-label={p.label} />
              <span><span className="block text-[13px] font-semibold text-[#0F172A]">{p.label}</span><span className="block text-[11.5px] text-[#64748B]">{p.hint}</span></span>
            </label>
          ))}
          {payment === 'PAID' && (
            <label className="block text-[12px] font-semibold text-[#334155]">
              Amount received (₦)
              <input type="number" min="0" step="0.01" placeholder={service ? String(Number(service.priceKobo) / 100) : ''} className="mt-1 w-full h-[40px] px-3 rounded-[12px] border border-[#E2E8F0] text-[13px]" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          )}
        </fieldset>

        <label className="block text-[12px] font-semibold text-[#334155]">
          Note (optional)
          <textarea rows={2} className="mt-1 w-full px-3 py-2 rounded-[12px] border border-[#E2E8F0] text-[13px]" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <label className="flex items-center gap-2 text-[12.5px] text-[#334155]">
          <input type="checkbox" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} />
          Email the client
        </label>

        {error ? <p className="text-[12px] font-medium text-rose-700">{error}</p> : null}
        <button type="submit" disabled={busy || !ready} className="w-full h-[42px] rounded-[12px] bg-[#0F3A53] text-white text-[13px] font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Book session
        </button>
      </form>
    </div>
  );
}
```

The first test selects a slot by `data-testid`. The `getAllByRole` wait before
it only confirms that slots rendered.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd apps/app && npx vitest run src/components/__tests__/StaffBookingDialog.test.tsx`
Expected: PASS (3 tests).

If `getClinicStaff` turns out to return an object rather than an array (look
at its final `return`), adapt the `.then` and the test's route stub together.

- [ ] **Step 5: Add the entry points**

**`ClientDetailPage.tsx`:**
1. Add the state `const [showBooking, setShowBooking] = useState(false);`.
2. Add a button next to the page's existing header actions:

```tsx
<button type="button" onClick={() => setShowBooking(true)} className="h-[38px] px-3.5 rounded-[12px] bg-[#0F3A53] text-white text-[12.5px] font-bold inline-flex items-center gap-2 cursor-pointer">
  <CalendarPlus className="h-4 w-4" /> Book a session
</button>
```

3. Before the component's closing wrapper, render:

```tsx
{showBooking && (
  <StaffBookingDialog
    client={{ id: client.id, name: client.name }}
    onClose={() => setShowBooking(false)}
    onBooked={() => { setShowBooking(false); window.location.reload(); }}
  />
)}
```

**`SchedulePage.tsx`:** add the same button, labelled "New booking", with
`client={null}`. Its `onBooked` calls `setShowBooking(false); onRefresh();`,
using the `onRefresh` prop it already receives.

Import `CalendarPlus` from `lucide-react` and `StaffBookingDialog` in both
files.

- [ ] **Step 6: Typecheck and run the app tests**

Run: `cd apps/app && npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/app/src
git commit -m "Add the staff booking dialog to the client page and schedule

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Payment chips on the schedule

**Files:**
- Modify: `apps/app/src/App.tsx` (the `Session` type, and the mapping from
  `therapist/bookings` into sessions)
- Modify: `apps/app/src/pages/practice/SchedulePage.tsx` (the session row)
- Create: `apps/app/src/components/booking/PaymentChip.tsx`
- Test: `apps/app/src/components/__tests__/PaymentChip.test.tsx`

**Interfaces:**
- Consumes: from Task 11, `therapist/bookings` items carry `paymentMethod`,
  `amountKobo`, `holdExpiresAt`, `bookedBy` and `status`.
- Produces:
  `PaymentChip({ status, paymentMethod, holdExpiresAt }: { status: string; paymentMethod?: string; holdExpiresAt?: string | null })`.

- [ ] **Step 1: Write the failing test**

`apps/app/src/components/__tests__/PaymentChip.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { PaymentChip } from '../booking/PaymentChip';

describe('PaymentChip', () => {
  afterEach(cleanup);
  it('shows awaiting payment with the deadline', () => {
    render(<PaymentChip status="PENDING_PAYMENT" paymentMethod="PAYSTACK" holdExpiresAt="2026-10-03T09:00:00Z" />);
    expect(screen.getByText(/Awaiting payment · until/)).toBeTruthy();
  });
  it('shows no charge for a waived session', () => {
    render(<PaymentChip status="CONFIRMED" paymentMethod="NONE" />);
    expect(screen.getByText('No charge')).toBeTruthy();
  });
  it('shows paid for a confirmed paid session', () => {
    render(<PaymentChip status="CONFIRMED" paymentMethod="MANUAL" />);
    expect(screen.getByText('Paid')).toBeTruthy();
  });
  it('shows nothing for a cancelled session', () => {
    const { container } = render(<PaymentChip status="CANCELLED" paymentMethod="PAYSTACK" />);
    expect(container.textContent).toBe('');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd apps/app && npx vitest run src/components/__tests__/PaymentChip.test.tsx`
Expected: FAIL, the import cannot be resolved.

- [ ] **Step 3: Implement**

`apps/app/src/components/booking/PaymentChip.tsx`:

```tsx
const chip = 'inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-bold';

export function PaymentChip({ status, paymentMethod, holdExpiresAt }: { status: string; paymentMethod?: string; holdExpiresAt?: string | null }) {
  if (status === 'PENDING_PAYMENT') {
    const until = holdExpiresAt
      ? ` · until ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(holdExpiresAt))}`
      : '';
    return <span className={`${chip} bg-amber-100 text-amber-800`}>Awaiting payment{until}</span>;
  }
  if (status === 'CANCELLED') return null;
  if (paymentMethod === 'NONE') return <span className={`${chip} bg-slate-100 text-slate-700`}>No charge</span>;
  return <span className={`${chip} bg-emerald-100 text-emerald-800`}>Paid</span>;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd apps/app && npx vitest run src/components/__tests__/PaymentChip.test.tsx`
Expected: PASS.

- [ ] **Step 5: Thread the fields through and render the chip**

1. In `App.tsx`, find where `therapist/bookings` items become `Session`
   objects: `grep -n "therapist/bookings" apps/app/src/App.tsx`.
2. Add these optional fields to the `Session` interface and copy them across
   in that mapping:
   - `paymentMethod?: string`
   - `holdExpiresAt?: string | null`
   - `bookedBy?: string | null`
   - `bookingStatus?: string`, the raw status
3. In `SchedulePage.tsx`'s session row, next to the existing status, render:

```tsx
<PaymentChip status={session.bookingStatus ?? ''} paymentMethod={session.paymentMethod} holdExpiresAt={session.holdExpiresAt} />
{session.bookedBy ? <span className="text-[11px] text-[#64748B]">Booked by {session.bookedBy}</span> : null}
```

- [ ] **Step 6: Typecheck, test and commit**

Run: `cd apps/app && npx tsc --noEmit && npx vitest run`
Expected: PASS.

```bash
git add apps/app/src
git commit -m "Show payment state and who booked it on the schedule

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: Public pay page

**Files:**
- Create: `apps/app/src/pages/public/PayBookingPage.tsx`
- Modify: `apps/app/src/App.tsx`: add the lazy import and
  `<Route path="/pay/:bookingId" element={<PayBookingPage />} />` to the
  tenant public `<Routes>` (next to `/booking/confirmed`, at about line 591),
  and to the other router that also declares `/booking/confirmed` (about line
  348).
- Test: `apps/app/src/pages/public/__tests__/PayBookingPage.test.tsx`

**Interfaces:**
- Consumes: `GET` and `POST /v1/consult/public/bookings/:id/pay-link` from
  Task 11.
- Produces: the page at `/pay/:bookingId?t=…`.

- [ ] **Step 1: Write the failing test**

`apps/app/src/pages/public/__tests__/PayBookingPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), post: (...a: unknown[]) => apiPost(...a) },
}));
const { PayBookingPage } = await import('../PayBookingPage');

const summary = { state: 'PAYABLE', serviceTitle: 'Therapy session', practitionerName: 'Jane Smith', startsAt: '2026-10-05T09:00:00Z', amountKobo: '2500000', practiceName: 'Smith Therapy' };

const renderAt = (url: string) =>
  render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/pay/:bookingId" element={<PayBookingPage />} /></Routes></MemoryRouter>);

describe('PayBookingPage', () => {
  const assign = vi.fn();
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    assign.mockReset();
    Object.defineProperty(window, 'location', { value: { ...window.location, assign }, writable: true });
  });
  afterEach(cleanup);

  it('shows what is owed and sends the client to checkout', async () => {
    apiGet.mockResolvedValue(summary);
    apiPost.mockResolvedValue({ paymentUrl: 'https://checkout.paystack.com/abc' });
    renderAt('/pay/900?t=tok');
    await waitFor(() => expect(screen.getByText('Therapy session')).toBeTruthy());
    expect(apiGet).toHaveBeenCalledWith('/v1/consult/public/bookings/900/pay-link?t=tok');
    fireEvent.click(screen.getByRole('button', { name: /Pay ₦25,000/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.paystack.com/abc'));
    expect(apiPost).toHaveBeenCalledWith('/v1/consult/public/bookings/900/pay-link', { t: 'tok' });
  });

  it('says so when the session is already paid', async () => {
    apiGet.mockResolvedValue({ ...summary, state: 'PAID' });
    renderAt('/pay/900?t=tok');
    await waitFor(() => expect(screen.getByText('This session is already paid.')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Pay/ })).toBeNull();
  });

  it('says so when the hold lapsed', async () => {
    apiGet.mockResolvedValue({ ...summary, state: 'LAPSED' });
    renderAt('/pay/900?t=tok');
    await waitFor(() => expect(screen.getByText(/no longer held/)).toBeTruthy());
  });

  it('explains a broken link', async () => {
    apiGet.mockRejectedValue(new Error('This payment link is not valid.'));
    renderAt('/pay/900?t=bad');
    await waitFor(() => expect(screen.getByText('This payment link is not valid.')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd apps/app && npx vitest run src/pages/public/__tests__/PayBookingPage.test.tsx`
Expected: FAIL, the import cannot be resolved.

- [ ] **Step 3: Implement the page**

`apps/app/src/pages/public/PayBookingPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../../utils/apiClient';

type Summary = {
  state: 'PAYABLE' | 'PAID' | 'LAPSED';
  serviceTitle: string;
  practitionerName: string;
  startsAt: string;
  amountKobo: string;
  practiceName: string;
};

const naira = (kobo: string) => `₦${(Number(kobo) / 100).toLocaleString('en-NG')}`;

export function PayBookingPage() {
  const { bookingId } = useParams();
  const [params] = useSearchParams();
  const t = params.get('t') ?? '';
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<Summary>(`/v1/consult/public/bookings/${bookingId}/pay-link?t=${encodeURIComponent(t)}`)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : 'This payment link is not valid.'));
  }, [bookingId, t]);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const { paymentUrl } = await api.post<{ paymentUrl: string }>(`/v1/consult/public/bookings/${bookingId}/pay-link`, { t });
      window.location.assign(paymentUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the payment');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] rounded-[20px] bg-white p-6 shadow-sm border border-[#E2E8F0] space-y-4">
        {!summary && !error && <Loader2 className="h-5 w-5 animate-spin text-[#64748B] mx-auto" />}
        {summary && (
          <>
            <p className="text-[12px] font-semibold text-[#64748B]">{summary.practiceName}</p>
            <h1 className="text-[18px] font-bold text-[#0F172A]">{summary.serviceTitle}</h1>
            <p className="text-[13px] text-[#334155]">
              With {summary.practitionerName} on{' '}
              {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(summary.startsAt))}
            </p>
            {summary.state === 'PAYABLE' && (
              <button type="button" onClick={pay} disabled={busy} className="w-full h-[44px] rounded-[12px] bg-[#0F3A53] text-white text-[14px] font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Pay {naira(summary.amountKobo)}
              </button>
            )}
            {summary.state === 'PAID' && <p className="text-[13px] font-semibold text-emerald-700">This session is already paid.</p>}
            {summary.state === 'LAPSED' && (
              <p className="text-[13px] font-semibold text-amber-700">This booking is no longer held. Contact {summary.practiceName} to book again.</p>
            )}
          </>
        )}
        {error ? <p className="text-[13px] font-medium text-rose-700">{error}</p> : null}
      </div>
    </main>
  );
}

export default PayBookingPage;
```

Register the route with the same lazy-import pattern `App.tsx` uses for
`BookingConfirmedPage`. Check that pattern first:
`grep -n "BookingConfirmedPage" apps/app/src/App.tsx`.

- [ ] **Step 4: Run the tests and typecheck**

Run: `cd apps/app && npx vitest run src/pages/public/__tests__/PayBookingPage.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src
git commit -m "Add the page a client opens from a staff-sent payment link

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 15: Verify end to end and ship Part B

- [ ] **Step 1: Run the full suites**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json && npx vitest run; cd ../app && npx tsc --noEmit && npx vitest run`
Expected: everything passes.

- [ ] **Step 2: Browser run (playwright-core, local API on 3099, app on 5173)**

Write the script to the session scratchpad (not the repo). Logged in as
`dr.jane@smiththerapy.ng`:
1. Open a client and choose "Book a session". Book an open slot with "Send a
   payment link".
   - Expected: the schedule shows "Awaiting payment · until …" and "Booked by
     Jane Smith".
2. Book a custom time that overlaps one of the practitioner's open slots, with
   "No charge".
   - Expected: `GET /v1/consult/public/availability` no longer lists that slot.
3. Try the same custom time again.
   - Expected: the dialog shows "already has a session".
4. Get the pay link, from the API log's email preview or by computing
   `payLinkToken` in a node one-liner against the built `dist`, and open
   `/pay/<id>?t=…` on the tenant host.
   - Expected: the amount is shown. With no Paystack key locally, clicking Pay
     shows the server's error message rather than a blank page.
5. Mark the link booking paid with `POST /v1/consult/bookings/:id/mark-paid`,
   then reload the pay page.
   - Expected: "This session is already paid."

Stop the servers afterwards.

- [ ] **Step 3: Push and open PR 2**

```bash
git push origin dev
gh pr create --base main --head dev --title "Staff can book sessions for existing clients" --body "$(cat <<'EOF'
## What
Staff can book a session for a client from the client page or the schedule:
- **Time:** an open slot, or a custom time. A custom time closes any open slot it overlaps, and is refused if the practitioner already has a session then.
- **Payment:** send a payment link (held up to 48 hours, and never later than 2 hours before the session), mark as paid (front desk and admins only), or no charge.
- **Client emails:** a payment link, or a confirmation. Staff can untick "Email the client".
- **Schedule:** shows the payment state and who made the booking.

## API
- `ConsultBooking.createdByProfileId` (migration `20260928100000_staff_bookings`); `paymentMethod` can now be `NONE`.
- `POST /v1/consult/practice/bookings` (staff).
- `GET`/`POST /v1/consult/public/bookings/:id/pay-link` (signed token, public).
- Cron: online bookings with their own hold expire at `holdExpiresAt`; client checkouts still expire after 30 minutes.
- `mark-paid` also accepts a pending staff-made booking.

## Checks
- API and app suites pass, and both typecheck.
- Browser: link booking, custom time closing an open slot, clash refused, pay page, and paid state after mark-paid.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
