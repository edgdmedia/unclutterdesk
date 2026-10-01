# Online Payment Hold Implementation Plan (BKG-09, plus SET-03 "Coming soon")

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An unpaid online booking holds its time for 35 minutes with a visible countdown. Before a hold is released, Paystack is asked whether it was paid. A payment that arrives after release is either re-confirmed (the time is still free) or refunded automatically. Retrying gives a fresh hold.

**Architecture:** Every online booking gets its own `holdExpiresAt`, like transfers and staff links already do. One API service, `BookingPaymentSettler` (billing module), owns "a Paystack charge for a booking succeeded". It's used by the webhook, the pop-up's confirm call and the expiry job, so the three can't disagree. The expiry job (`ConsultCron`) verifies with Paystack before cancelling. Retrying the payment goes through one method that extends a live hold, or re-claims a released time if it's still free.

**Tech Stack:** NestJS, Prisma (PostgreSQL), Paystack REST (`/transaction/verify`, `/refund`), React and Vite, vitest.

**Spec:** `docs/testing-feedback.md` → BKG-09 (decision of 1 Oct 2026) and SET-03 ("Coming soon").

## Global Constraints

- Online hold: **35 minutes** from the moment the checkout starts (or restarts), never later than the session's start. Constant `ONLINE_HOLD_MINUTES = 35`.
- The expiry job never releases a Paystack booking that has a payment reference without asking Paystack first. If Paystack can't be reached, it waits until the next run, up to **2 hours** past the hold, then releases anyway.
- Refunds are full refunds of the late transaction (`POST /refund { transaction: reference }`). They are never partial and never manual.
- The join link still travels only once the booking is confirmed (`BookingNotifier.confirmed`).
- Tests: the API specs use Prisma stand-ins, as `booking-paystack-popup.spec.ts` does. App tests use `renderWithApp` and fake only `utils/apiClient` and `context/AuthContext`.
- Run suites with `--maxWorkers=2 --minWorkers=1`.
- Migrations are hand-written SQL in `prisma/migrations/<timestamp>_<name>/migration.sql`. Never run `prisma format`, which realigns unrelated models.
- Copy: plain sentences, times in WAT (`Africa/Lagos`), "3:42 PM" style.

## Review Focus

1. **The webhook and the pop-up's confirm call arrive together** for the same reference. Exactly one confirmation email is sent, and there's never a refund for a booking that's confirmed with that reference.
2. **An old reference is paid after a retry started a new one.** The booking confirms if it's still pending; if it's already confirmed with the new reference, the second charge is refunded.
3. **Paystack is down when the expiry job runs.** The hold isn't released on that run, and is released once it's 2 hours overdue.
4. **The client's hold expires while the pop-up is still open, and they then pay.** If the time is still free, they're confirmed; otherwise they're refunded, and both they and the practice are told.
5. **The pay email link** opens a working pay page (it needs the pay-link token; today it doesn't carry one).

---

## File Structure

- Create `apps/api/src/modules/consult/online-hold.ts`: `ONLINE_HOLD_MINUTES`, `onlineHoldExpiry(now, startsAt)` and `RELEASE_GRACE_MS`.
- Create `apps/api/src/modules/billing/booking-payment-settler.service.ts`: `settle(reference, tx)` → `'confirmed' | 'already' | 'reconfirmed' | 'refunded' | 'ignored'`.
- Modify `apps/api/src/modules/billing/paystack.service.ts`: add `refundTransaction(reference)`.
- Modify `apps/api/src/modules/billing/billing.service.ts`: the webhook's booking branch calls the settler.
- Modify `apps/api/src/modules/consult/consult.service.ts`: `createBooking` sets the online hold; `getBookingPaymentUrl` → `restartOnlinePayment`; `confirmPublicPayment` uses the settler.
- Modify `apps/api/src/modules/consult/staff-booking.service.ts`: `payLinkCheckout` uses `restartOnlinePayment`; `payLinkSummary` returns `holdExpiresAt` and `canRetry`.
- Modify `apps/api/src/modules/consult/consult.cron.ts`: verify before release, the grace period, `holdReleasedAt`, and the client email.
- Modify `apps/api/src/modules/notifications/booking-notifier.service.ts`: the pay email carries the token and "held until"; new `holdReleased` and `latePaymentRefunded`.
- Modify `prisma/schema.prisma` and add the migration `20261003090000_online_payment_hold`.
- App:
  - `booking/bookingWizard.ts` (`booked` carries `holdExpiresAt`);
  - new `booking/HoldCountdown.tsx`;
  - `ReviewPayStep.tsx` (shows it);
  - `BookingWizardPage.tsx`;
  - `PayBookingPage.tsx` (held-until, and "Try again" when lapsed but free);
  - `practice/settings/BrandSettingsPage.tsx` (Custom domain → Coming soon).

---

### Task 1: Schema, hold helper and Paystack refund

**Files:**
- Modify: `prisma/schema.prisma` (model `ConsultBooking`)
- Create: `prisma/migrations/20261003090000_online_payment_hold/migration.sql`
- Create: `apps/api/src/modules/consult/online-hold.ts`
- Modify: `apps/api/src/modules/billing/paystack.service.ts`
- Test: `apps/api/src/modules/consult/online-hold.spec.ts`, `apps/api/src/modules/billing/paystack-refund.spec.ts`

**Interfaces:**
- Produces:
  - `ONLINE_HOLD_MINUTES: 35`, `RELEASE_GRACE_MS: 7_200_000`, `onlineHoldExpiry(now: Date, startsAt: Date): Date`
  - `PaystackService.refundTransaction(reference: string): Promise<{ id?: number; status?: string }>`
  - `ConsultBooking.holdReleasedAt DateTime?`, `refundedAt DateTime?`, `refundRef String?`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/api/src/modules/consult/online-hold.spec.ts
import { describe, it, expect } from 'vitest';
import { ONLINE_HOLD_MINUTES, onlineHoldExpiry } from './online-hold';

describe('online payment hold', () => {
  const now = new Date('2026-10-06T09:00:00Z');
  it('holds the time for 35 minutes', () => {
    expect(ONLINE_HOLD_MINUTES).toBe(35);
    expect(onlineHoldExpiry(now, new Date('2026-10-06T12:00:00Z')).toISOString()).toBe('2026-10-06T09:35:00.000Z');
  });
  it('never holds past the start of the session', () => {
    expect(onlineHoldExpiry(now, new Date('2026-10-06T09:20:00Z')).toISOString()).toBe('2026-10-06T09:20:00.000Z');
  });
});
```

```ts
// apps/api/src/modules/billing/paystack-refund.spec.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PaystackService } from './paystack.service';

describe('Paystack refund', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('refunds the whole transaction by its reference', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, data: { id: 77, status: 'pending' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const res = await new PaystackService().refundTransaction('booking-900-1');
    expect(res).toEqual({ id: 77, status: 'pending' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.paystack.co/refund');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ transaction: 'booking-900-1' });
  });
});
```

- [ ] **Step 2: Run them, to see them fail**

Run: `cd apps/api && npx vitest run src/modules/consult/online-hold.spec.ts src/modules/billing/paystack-refund.spec.ts`
Expected: FAIL (module `./online-hold` not found; `refundTransaction` is not a function)

- [ ] **Step 3: Implement**

```ts
// apps/api/src/modules/consult/online-hold.ts
/** BKG-09: how long an unpaid online booking keeps its time. Paystack's
 *  pay-with-transfer account lives 30 minutes; 5 more cover a slow webhook. */
export const ONLINE_HOLD_MINUTES = 35;

/** If Paystack can't be asked, a hold waits at most this long past expiry. */
export const RELEASE_GRACE_MS = 2 * 60 * 60 * 1000;

export function onlineHoldExpiry(now: Date, startsAt: Date): Date {
  const hold = new Date(now.getTime() + ONLINE_HOLD_MINUTES * 60_000);
  return hold < startsAt ? hold : startsAt;
}
```

In `paystack.service.ts`, after `verifyTransaction`:

```ts
  /** A full refund of one transaction (BKG-09: a payment that arrived after its time was gone). */
  async refundTransaction(reference: string) {
    return this.request('POST', '/refund', { transaction: reference }) as Promise<{ id?: number; status?: string }>;
  }
```

In `prisma/schema.prisma`, model `ConsultBooking`, after `holdExpiresAt`, add by hand (keep the column alignment):

```prisma
  /// The expiry job released this hold (BKG-09); a later payment may re-confirm it.
  holdReleasedAt              DateTime?
  /// A late or duplicate payment was refunded through Paystack.
  refundedAt                  DateTime?
  refundRef                   String?
```

```sql
-- prisma/migrations/20261003090000_online_payment_hold/migration.sql
ALTER TABLE "ConsultBooking" ADD COLUMN "holdReleasedAt" TIMESTAMP(3);
ALTER TABLE "ConsultBooking" ADD COLUMN "refundedAt" TIMESTAMP(3);
ALTER TABLE "ConsultBooking" ADD COLUMN "refundRef" TEXT;
```

Then run: `npx prisma migrate deploy && npx prisma generate` (from the repository root, against the local database).

- [ ] **Step 4: Run the tests, to see them pass**

Run: `cd apps/api && npx vitest run src/modules/consult/online-hold.spec.ts src/modules/billing/paystack-refund.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261003090000_online_payment_hold apps/api/src/modules/consult/online-hold.ts apps/api/src/modules/consult/online-hold.spec.ts apps/api/src/modules/billing/paystack.service.ts apps/api/src/modules/billing/paystack-refund.spec.ts
git commit -m "BKG-09: a 35-minute online hold, release and refund columns, and Paystack refunds"
```

---

### Task 2: BookingPaymentSettler (one owner for "a booking charge succeeded")

**Files:**
- Create: `apps/api/src/modules/billing/booking-payment-settler.service.ts`
- Modify: `apps/api/src/modules/billing/billing.module.ts` (provide and export it)
- Modify: `apps/api/src/modules/billing/billing.service.ts` (the webhook branch at `event === 'charge.success' && reference?.startsWith('booking-')`)
- Modify: `apps/api/src/modules/notifications/booking-notifier.service.ts` (add `latePaymentRefunded`)
- Test: `apps/api/src/modules/billing/booking-payment-settler.spec.ts`

**Interfaces:**
- Consumes: `PaystackService.refundTransaction` (Task 1), `BillingService.markBookingPaid(reference, data): Promise<boolean>` (existing), `BookingNotifier.confirmed(bookingId)` (existing), `CalendarService.pushBookingToGoogle(bookingId)` (existing).
- Produces:
  - `BookingPaymentSettler.settle(reference: string, tx: { status: string; paid_at?: string | null }): Promise<SettleOutcome>`
  - `type SettleOutcome = 'confirmed' | 'already' | 'reconfirmed' | 'refunded' | 'ignored'`
  - `BookingNotifier.latePaymentRefunded(bookingId: bigint): Promise<void>`

Rules, in order (the booking ID is parsed from `booking-<id>-<ts>`):
1. `tx.status !== 'success'` → `'ignored'`.
2. `markBookingPaid(reference)` flipped it → `notifier.confirmed` → `'confirmed'`.
3. Load the booking by ID.
   - **Pending with a different reference** (an older attempt was paid): `updateMany where {id, status:'PENDING_PAYMENT'}` → `CONFIRMED`, `paymentRef = reference`, `paidAt`. Then calendar and `notifier.confirmed`, and return `'confirmed'`.
   - **Confirmed (or completed) with this same `paymentRef`** → `'already'`.
   - **Already refunded for this reference** (`refundRef === reference`) → `'already'`.
   - **Cancelled with `holdReleasedAt` set**, and the time can be re-claimed → `CONFIRMED`, `paymentRef = reference`, `paidAt`, `holdReleasedAt = null`, then confirmed → `'reconfirmed'`. The time can be re-claimed if `consultAvailability.updateMany({ where: { id: availabilityId, isActive: true }, data: { isActive: false } })` returns count 1. For a `createdForBooking` slot, it can be re-claimed if no other non-cancelled booking uses it.
   - **Anything else** (time taken, cancelled by someone, or confirmed with another reference) → `refundTransaction(reference)`, set `refundedAt` and `refundRef = reference`, `notifier.latePaymentRefunded` → `'refunded'`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/api/src/modules/billing/booking-payment-settler.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { BookingPaymentSettler } from './booking-payment-settler.service';

const OK = { status: 'success', paid_at: '2026-10-06T09:40:00Z' };

function make(booking: any, { flipped = false, slotFree = true, otherActive = 0 } = {}) {
  const tx: any = {
    consultBooking: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), count: vi.fn().mockResolvedValue(otherActive) },
    consultAvailability: { updateMany: vi.fn().mockResolvedValue({ count: slotFree ? 1 : 0 }) },
  };
  const prisma: any = {
    consultBooking: {
      findUnique: vi.fn().mockResolvedValue(booking),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  };
  const billing: any = { markBookingPaid: vi.fn().mockResolvedValue(flipped) };
  const paystack: any = { refundTransaction: vi.fn().mockResolvedValue({ id: 1, status: 'pending' }) };
  const notifier: any = { confirmed: vi.fn(), latePaymentRefunded: vi.fn() };
  const calendar: any = { pushBookingToGoogle: vi.fn() };
  const settler = new BookingPaymentSettler(prisma, billing, paystack, notifier, calendar);
  return { settler, prisma, tx, billing, paystack, notifier };
}

const base = { id: 900n, availabilityId: 3n, paymentRef: 'booking-900-1', holdReleasedAt: null, refundRef: null, availability: { createdForBooking: false } };

describe('settling a successful booking charge', () => {
  it('ignores a charge that did not succeed', async () => {
    const { settler, billing } = make(base);
    expect(await settler.settle('booking-900-1', { status: 'abandoned' })).toBe('ignored');
    expect(billing.markBookingPaid).not.toHaveBeenCalled();
  });

  it('confirms a pending booking once and sends one confirmation', async () => {
    const { settler, notifier } = make({ ...base, status: 'PENDING_PAYMENT' }, { flipped: true });
    expect(await settler.settle('booking-900-1', OK)).toBe('confirmed');
    expect(notifier.confirmed).toHaveBeenCalledTimes(1);
  });

  it('does nothing more when the same reference already confirmed it (webhook and pop-up race)', async () => {
    const { settler, notifier, paystack } = make({ ...base, status: 'CONFIRMED' });
    expect(await settler.settle('booking-900-1', OK)).toBe('already');
    expect(notifier.confirmed).not.toHaveBeenCalled();
    expect(paystack.refundTransaction).not.toHaveBeenCalled();
  });

  it('confirms a pending booking paid through an older attempt', async () => {
    const { settler, prisma, notifier } = make({ ...base, status: 'PENDING_PAYMENT', paymentRef: 'booking-900-2' });
    expect(await settler.settle('booking-900-1', OK)).toBe('confirmed');
    expect(prisma.consultBooking.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 900n, status: 'PENDING_PAYMENT' },
      data: { status: 'CONFIRMED', paymentRef: 'booking-900-1' },
    });
    expect(notifier.confirmed).toHaveBeenCalledWith(900n);
  });

  it('re-confirms a released booking when its time is still free', async () => {
    const { settler, tx, notifier, paystack } = make({ ...base, status: 'CANCELLED', holdReleasedAt: new Date() });
    expect(await settler.settle('booking-900-1', OK)).toBe('reconfirmed');
    expect(tx.consultAvailability.updateMany).toHaveBeenCalledWith({ where: { id: 3n, isActive: true }, data: { isActive: false } });
    expect(tx.consultBooking.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'CONFIRMED', holdReleasedAt: null });
    expect(notifier.confirmed).toHaveBeenCalledWith(900n);
    expect(paystack.refundTransaction).not.toHaveBeenCalled();
  });

  it('refunds a released booking whose time was taken, and tells the client and practice', async () => {
    const { settler, paystack, prisma, notifier } = make({ ...base, status: 'CANCELLED', holdReleasedAt: new Date() }, { slotFree: false });
    expect(await settler.settle('booking-900-1', OK)).toBe('refunded');
    expect(paystack.refundTransaction).toHaveBeenCalledWith('booking-900-1');
    expect(prisma.consultBooking.update.mock.calls[0][0].data).toMatchObject({ refundRef: 'booking-900-1' });
    expect(notifier.latePaymentRefunded).toHaveBeenCalledWith(900n);
  });

  it('refunds a second charge on a booking already confirmed by another reference', async () => {
    const { settler, paystack } = make({ ...base, status: 'CONFIRMED', paymentRef: 'booking-900-2' });
    expect(await settler.settle('booking-900-1', OK)).toBe('refunded');
    expect(paystack.refundTransaction).toHaveBeenCalledWith('booking-900-1');
  });

  it('never refunds the same reference twice', async () => {
    const { settler, paystack } = make({ ...base, status: 'CANCELLED', refundRef: 'booking-900-1' });
    expect(await settler.settle('booking-900-1', OK)).toBe('already');
    expect(paystack.refundTransaction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, to see it fail**

Run: `cd apps/api && npx vitest run src/modules/billing/booking-payment-settler.spec.ts`
Expected: FAIL (cannot find module `./booking-payment-settler.service`)

- [ ] **Step 3: Implement the settler**

```ts
// apps/api/src/modules/billing/booking-payment-settler.service.ts
import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingService } from './billing.service';
import { PaystackService } from './paystack.service';
import { BookingNotifier } from '../notifications/booking-notifier.service';
import { CalendarService } from '../calendar/calendar.service';

export type SettleOutcome = 'confirmed' | 'already' | 'reconfirmed' | 'refunded' | 'ignored';

/**
 * BKG-09: the one place that decides what a successful Paystack charge for a
 * booking means. The webhook, the pop-up's confirm call and the expiry job
 * all come here, so a late or duplicate payment is handled the same way
 * whichever arrives first.
 */
@Injectable()
export class BookingPaymentSettler {
  private readonly logger = new Logger(BookingPaymentSettler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly paystack: PaystackService,
    @Optional() private readonly notifier?: BookingNotifier,
    @Optional() private readonly calendar?: CalendarService,
  ) {}

  async settle(reference: string, tx: { status?: string; paid_at?: string | null } | null | undefined): Promise<SettleOutcome> {
    if (!reference.startsWith('booking-') || tx?.status !== 'success') return 'ignored';
    const bookingId = BigInt(reference.split('-')[1]);
    const paidAt = new Date(tx.paid_at || Date.now());

    if (await this.billing.markBookingPaid(reference, tx)) {
      await this.notifier?.confirmed(bookingId).catch(() => undefined);
      return 'confirmed';
    }

    const b = await this.prisma.consultBooking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, paymentRef: true, holdReleasedAt: true, refundRef: true, availabilityId: true, availability: { select: { createdForBooking: true } } },
    });
    if (!b) return 'ignored';
    if (b.refundRef === reference) return 'already';
    if ((b.status === 'CONFIRMED' || b.status === 'COMPLETED') && b.paymentRef === reference) return 'already';

    if (b.status === 'PENDING_PAYMENT') {
      // An older attempt's reference was paid while a newer one was open.
      const done = await this.prisma.consultBooking.updateMany({
        where: { id: b.id, status: 'PENDING_PAYMENT' },
        data: { status: 'CONFIRMED', paymentRef: reference, paidAt },
      });
      if (done.count === 1) {
        await this.calendar?.pushBookingToGoogle(b.id).catch(() => undefined);
        await this.notifier?.confirmed(b.id).catch(() => undefined);
        return 'confirmed';
      }
      return this.settle(reference, tx); // it moved under us; decide again
    }

    if (b.status === 'CANCELLED' && b.holdReleasedAt) {
      const reclaimed = await this.prisma.$transaction(async (t) => {
        const slot = b.availability?.createdForBooking
          ? (await t.consultBooking.count({ where: { availabilityId: b.availabilityId, status: { not: 'CANCELLED' } } })) === 0
          : (await t.consultAvailability.updateMany({ where: { id: b.availabilityId, isActive: true }, data: { isActive: false } })).count === 1;
        if (!slot) return false;
        const done = await t.consultBooking.updateMany({
          where: { id: b.id, status: 'CANCELLED' },
          data: { status: 'CONFIRMED', paymentRef: reference, paidAt, holdReleasedAt: null },
        });
        return done.count === 1;
      });
      if (reclaimed) {
        await this.calendar?.pushBookingToGoogle(b.id).catch(() => undefined);
        await this.notifier?.confirmed(b.id).catch(() => undefined);
        return 'reconfirmed';
      }
    }

    // The time is gone, the booking was cancelled, or it's a second charge.
    await this.paystack.refundTransaction(reference);
    await this.prisma.consultBooking.update({ where: { id: b.id }, data: { refundedAt: new Date(), refundRef: reference } });
    await this.notifier?.latePaymentRefunded(b.id).catch((err) => this.logger.warn(`Refund notice for ${b.id} failed: ${(err as Error).message}`));
    return 'refunded';
  }
}
```

Register it in `billing.module.ts` under `providers` and `exports` (next to `BillingService`). `BookingNotifier` and `CalendarService` already reach `BillingService` the same way; copy whatever `imports` that module uses for them.

In `billing.service.ts`, replace the booking branch of `handleWebhook` with a call through `ModuleRef`. Injecting the settler into its own dependency would be circular.

```ts
    if (event === 'charge.success' && reference?.startsWith('booking-')) {
      // BKG-09: confirm, re-confirm after a released hold, or refund.
      await this.moduleRef.get(BookingPaymentSettler, { strict: false }).settle(reference, data);
      return;
    }
```

Add `private readonly moduleRef: ModuleRef` (from `@nestjs/core`) as the **last**, `@Optional()` constructor parameter, so existing specs that construct `BillingService` positionally keep working. Remove the now-unused `bookingNotifier?.confirmed` call from that branch. Check the existing webhook specs (`grep -rn "charge.success" apps/api/src --include=*.spec.ts`): update any that assert `bookingNotifier.confirmed` from the webhook, so they stub `moduleRef.get` to return `{ settle: vi.fn() }` and assert `settle('booking-…', data)`.

In `booking-notifier.service.ts`, add:

```ts
  /** BKG-09: a payment arrived after the time was gone; Paystack is refunding it. */
  async latePaymentRefunded(bookingId: bigint): Promise<void> {
    const b = await this.load(bookingId);
    if (!b) return;
    const amount = formatNaira(Number(chargedKobo(b)));
    await this.notifications
      .sendEmail({
        to: b.client.email,
        type: 'bookings.payment_refunded',
        title: `We're refunding your ${amount}`,
        message:
          `Your payment for ${b.service.title} on ${this.when(b.availability.startsAt)} reached us after the time was released, ` +
          `and it has since been booked. Paystack is refunding ${amount} to you; it usually arrives within a few working days. You're welcome to choose another time.`,
        link: `${tenantWebOrigin(b.tenant)}/book`,
        actionLabel: 'Choose another time',
        tenantId: b.tenantId,
        profileId: b.clientProfileId,
      })
      .catch((err) => this.logger.warn(`Could not send the refund email for booking ${bookingId}: ${(err as Error).message}`));
    await this.notifyStaff(bookingId, 'refunded').catch(() => undefined);
  }
```

Extend `notifyStaff`'s event union with `'refunded'`. Its copy is "{client} paid late for {service} on {when}; the time was taken, so the payment is being refunded." It goes to the same recipients as `'paid'`.

- [ ] **Step 4: Run the settler and billing specs**

Run: `cd apps/api && npx vitest run src/modules/billing src/modules/notifications --maxWorkers=2 --minWorkers=1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/billing apps/api/src/modules/notifications/booking-notifier.service.ts
git commit -m "BKG-09: one settler confirms, re-confirms or refunds a booking charge; the webhook uses it"
```

---

### Task 3: Bookings carry the hold, retries restart it, and the pop-up confirms through the settler

**Files:**
- Modify: `apps/api/src/modules/consult/consult.service.ts` (`createBooking`, `getBookingPaymentUrl`, `confirmPublicPayment`; constructor gets `@Optional() settler?: BookingPaymentSettler` as the last parameter)
- Modify: `apps/api/src/modules/consult/staff-booking.service.ts` (`payLinkCheckout`, `payLinkSummary`)
- Test: `apps/api/src/modules/consult/booking-paystack-popup.spec.ts` (extend), `apps/api/src/modules/consult/staff-pay-link.spec.ts` (extend)

**Interfaces:**
- Consumes: `onlineHoldExpiry` (Task 1), `BookingPaymentSettler.settle` (Task 2).
- Produces:
  - `ConsultService.restartOnlinePayment(tenantId: bigint, bookingId: bigint, where: { clientEmail?: string }): Promise<{ paymentUrl: string; accessCode: string | null; reference: string; holdExpiresAt: string }>`. It throws `BadRequestException('The selected time slot is no longer available')` when the time was taken; the wizard maps that text to "slot taken".
  - The `createBooking` response gains `holdExpiresAt: string | null` for online bookings.
  - `payLinkSummary` gains `holdExpiresAt: string | null` and `canRetry: boolean`.

`restartOnlinePayment` works like this:
- **Pending, not a transfer:** set a fresh `holdExpiresAt = onlineHoldExpiry(now, startsAt)` (never shorten a staff link's longer hold: keep the later of the two).
- **Cancelled with `holdReleasedAt`:** inside a transaction, re-claim the slot (the same rule as the settler). Then set `status: 'PENDING_PAYMENT'`, `holdReleasedAt: null` and a fresh hold. If the time can't be re-claimed, throw "no longer available".
- **Anything else:** `NotFoundException('Pending payment booking not found')`.

Then start Paystack (`startOnlinePayment`) and store `paymentRef` only after Paystack accepted it (as today).

- [ ] **Step 1: Write the failing tests** (add to `booking-paystack-popup.spec.ts`)

```ts
describe('the online hold (BKG-09)', () => {
  it('holds a new online booking for 35 minutes and says until when', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-06T08:00:00Z'));
    const { service } = make();
    const res: any = await service.createBooking(TENANT, CLIENT, { serviceId: '4', availabilityId: '3' } as any);
    expect(res.holdExpiresAt).toBe('2026-10-06T08:35:00.000Z');
    vi.useRealTimers();
  });

  it('gives a retry a fresh 35 minutes', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-06T08:30:00Z'));
    const { service, prisma } = make({ booking: { id: 900n, tenantId: TENANT, status: 'PENDING_PAYMENT', paymentMethod: 'PAYSTACK', holdExpiresAt: new Date('2026-10-06T08:35:00Z'), availabilityId: 3n, amountKobo: 3500000n, service: { priceKobo: 3500000n }, client: { email: 'ada@example.com' }, availability: { startsAt: new Date('2026-10-06T10:30:00Z'), createdForBooking: false } } });
    const res: any = await service.getBookingPaymentUrl(TENANT, 900n, 'ada@example.com');
    expect(res.holdExpiresAt).toBe('2026-10-06T09:05:00.000Z');
    expect(prisma.consultBooking.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ holdExpiresAt: new Date('2026-10-06T09:05:00Z') }) }));
    vi.useRealTimers();
  });

  it('re-claims a released time that is still free', async () => {
    const released = { id: 900n, tenantId: TENANT, status: 'CANCELLED', holdReleasedAt: new Date(), paymentMethod: 'PAYSTACK', availabilityId: 3n, amountKobo: 3500000n, service: { priceKobo: 3500000n }, client: { email: 'ada@example.com' }, availability: { startsAt: new Date('2026-10-06T10:30:00Z'), createdForBooking: false } };
    const { service } = make({ booking: released });
    const res: any = await service.getBookingPaymentUrl(TENANT, 900n, 'ada@example.com');
    expect(res.accessCode).toBe('ac_123');
  });

  it('says the time is gone when a released time was booked by someone else', async () => {
    const released = { id: 900n, tenantId: TENANT, status: 'CANCELLED', holdReleasedAt: new Date(), paymentMethod: 'PAYSTACK', availabilityId: 3n, amountKobo: 3500000n, service: { priceKobo: 3500000n }, client: { email: 'ada@example.com' }, availability: { startsAt: new Date('2026-10-06T10:30:00Z'), createdForBooking: false } };
    const { service, tx } = make({ booking: released });
    tx.consultAvailability.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.getBookingPaymentUrl(TENANT, 900n, 'ada@example.com')).rejects.toThrow(/no longer available/);
  });

  it('confirms the pop-up payment through the settler', async () => {
    const { service, paystack, settler } = make({ booking: { id: 900n, tenantId: TENANT, clientProfileId: CLIENT, paymentRef: 'booking-900-1', status: 'PENDING_PAYMENT' } });
    paystack.verifyTransaction.mockResolvedValue({ status: 'success', reference: 'booking-900-1' });
    settler.settle.mockResolvedValue('confirmed');
    await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).resolves.toMatchObject({ status: 'CONFIRMED' });
    expect(settler.settle).toHaveBeenCalledWith('booking-900-1', expect.objectContaining({ status: 'success' }));
  });
});
```

Update `make()` in that spec:
- return `tx`;
- add `settler = { settle: vi.fn() }` as the 8th constructor argument, and return it;
- give `prisma.consultBooking` an `updateMany` (`vi.fn().mockResolvedValue({ count: 1 })`);
- give `tx.consultBooking` an `updateMany`.

The existing "confirms a paid booking straight away" test now expects `settler.settle` instead of `billing.markBookingPaid`; change its assertion. When `settle` returns `'refunded'`, `confirmPublicPayment` returns `{ status: 'REFUNDED', forms: [] }`. Add that test too:

```ts
  it('reports a late payment that was refunded', async () => {
    const { service, paystack, settler } = make({ booking: { id: 900n, tenantId: TENANT, clientProfileId: CLIENT, paymentRef: 'booking-900-1', status: 'CANCELLED' } });
    paystack.verifyTransaction.mockResolvedValue({ status: 'success', reference: 'booking-900-1' });
    settler.settle.mockResolvedValue('refunded');
    await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).resolves.toEqual({ status: 'REFUNDED', forms: [] });
  });
```

- [ ] **Step 2: Run, to see them fail**

Run: `cd apps/api && npx vitest run src/modules/consult/booking-paystack-popup.spec.ts`
Expected: FAIL (`holdExpiresAt` undefined; `settle` not called)

- [ ] **Step 3: Implement**

`createBooking`: in the `consultBooking.create` data, add the online hold beside the manual one:

```ts
          ...(manual
            ? { paymentMethod: 'MANUAL', holdExpiresAt: holdExpiry(new Date(), slot.startsAt) }
            : finalPriceKobo > 0n
              ? { holdExpiresAt: onlineHoldExpiry(new Date(), slot.startsAt) }
              : {}),
```

Add `holdExpiresAt: booking.holdExpiresAt ? booking.holdExpiresAt.toISOString() : null` to the returned object and to the `result` type.

Replace `getBookingPaymentUrl` with a thin wrapper over a new method:

```ts
  async getBookingPaymentUrl(tenantId: bigint, bookingId: bigint, email: string) {
    return this.restartOnlinePayment(tenantId, bookingId, { clientEmail: email });
  }

  /**
   * BKG-09: pay again. A live hold gets a fresh 35 minutes; a released one is
   * re-claimed if its time is still free. Never shortens a staff link's hold.
   */
  async restartOnlinePayment(tenantId: bigint, bookingId: bigint, where: { clientEmail?: string }) {
    const booking = await this.prisma.consultBooking.findFirst({
      where: {
        id: bookingId,
        tenantId,
        paymentMethod: { not: 'MANUAL' },
        ...(where.clientEmail ? { client: { email: where.clientEmail } } : {}),
        OR: [{ status: 'PENDING_PAYMENT' }, { status: 'CANCELLED', holdReleasedAt: { not: null } }],
      },
      include: { service: true, client: true, availability: { select: { startsAt: true, createdForBooking: true } } },
    });
    if (!booking) throw new NotFoundException('Pending payment booking not found');

    const fresh = onlineHoldExpiry(new Date(), booking.availability.startsAt);
    const hold = booking.holdExpiresAt && booking.holdExpiresAt > fresh ? booking.holdExpiresAt : fresh;

    if (booking.status === 'CANCELLED') {
      const reclaimed = await this.prisma.$transaction(async (tx) => {
        const free = booking.availability.createdForBooking
          ? (await tx.consultBooking.count({ where: { availabilityId: booking.availabilityId, status: { not: 'CANCELLED' } } })) === 0
          : (await tx.consultAvailability.updateMany({ where: { id: booking.availabilityId, isActive: true }, data: { isActive: false } })).count === 1;
        if (!free) return false;
        const done = await tx.consultBooking.updateMany({
          where: { id: booking.id, status: 'CANCELLED' },
          data: { status: 'PENDING_PAYMENT', holdReleasedAt: null, holdExpiresAt: hold },
        });
        return done.count === 1;
      });
      if (!reclaimed) throw new BadRequestException('The selected time slot is no longer available');
    } else {
      await this.prisma.consultBooking.update({ where: { id: booking.id }, data: { holdExpiresAt: hold } });
    }

    const reference = `booking-${booking.id}-${Date.now()}`;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, customDomain: true, customDomainStatus: true } });
    const started = await this.startOnlinePayment(tenantId, chargedKobo(booking), booking.client.email, reference, `${tenantWebOrigin(tenant ?? { slug: '' })}/booking/confirmed`);
    // Only once Paystack accepted it: a failed attempt must not overwrite
    // the reference of one that may still complete.
    await this.prisma.consultBooking.update({ where: { id: booking.id }, data: { paymentRef: reference } });
    return { paymentUrl: started.url, accessCode: started.accessCode, reference, holdExpiresAt: hold.toISOString() };
  }
```

`confirmPublicPayment`: find the booking with `status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED'] }`, keeping the `clientProfileId` scoping. After `verifyTransaction`:

```ts
    if (tx?.status !== 'success') return { status: 'PENDING_PAYMENT' as const, forms: await this.pendingFormLinks(tenantId, clientProfileId, bookingId) };
    const outcome = await this.settler!.settle(booking.paymentRef, tx);
    if (outcome === 'refunded') return { status: 'REFUNDED' as const, forms: [] };
    return { status: 'CONFIRMED' as const, forms: await this.pendingFormLinks(tenantId, clientProfileId, bookingId) };
```

`staff-booking.service.ts`:
- `payLinkCheckout` becomes `const r = await this.consult.restartOnlinePayment(tenantId, bookingId, {}); return { paymentUrl: r.paymentUrl };`, after the token check (`payLinkBooking`). It keeps the "already paid" error for confirmed bookings.
- `payLinkSummary` adds:
  - `holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null`
  - `canRetry: b.status === 'CANCELLED' && !!b.holdReleasedAt && b.availability.startsAt > new Date()`
- A `LAPSED` state with `canRetry` is shown as retryable by the app (Task 5).

Add a staff-pay-link spec: a released booking whose `startsAt` is in the future returns `canRetry: true`; one cancelled by staff (no `holdReleasedAt`) returns `canRetry: false`.

- [ ] **Step 4: Run the consult specs**

Run: `cd apps/api && npx vitest run src/modules/consult --maxWorkers=2 --minWorkers=1`
Expected: PASS (fix older specs that construct `ConsultService` positionally only if they break. The new parameter is last and optional, so they shouldn't.)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/consult
git commit -m "BKG-09: online bookings carry a 35-minute hold; retrying restarts or re-claims it"
```

---

### Task 4: The expiry job asks Paystack before releasing, and tells the client

**Files:**
- Modify: `apps/api/src/modules/consult/consult.cron.ts`
- Modify: `apps/api/src/modules/notifications/booking-notifier.service.ts` (`booked` pay email; new `holdReleased`)
- Test: `apps/api/src/modules/consult/consult-cron-hold.spec.ts` (new), `apps/api/src/modules/notifications/booking-notifier.spec.ts` (extend; find the existing notifier spec with `ls apps/api/src/modules/notifications/*.spec.ts`)

**Interfaces:**
- Consumes: `PaystackService.verifyTransaction(reference)`, `BookingPaymentSettler.settle` (Task 2), `RELEASE_GRACE_MS` and `ONLINE_HOLD_MINUTES` (Task 1), `payLinkToken(bookingId)` from `consult/staff-booking-rules.ts`.
- Produces: `BookingNotifier.holdReleased(bookingId: bigint): Promise<void>`.

How the job works:
- Runs `@Cron(CronExpression.EVERY_5_MINUTES)` and loads pending bookings whose `holdExpiresAt < now`. It also loads legacy online rows (`holdExpiresAt: null`, `createdAt < now − 35 min`).
- **Online with a `paymentRef`:**
  - `verifyTransaction(paymentRef)` → `status === 'success'`: `settle(...)` and don't release.
  - Verify **throws** (Paystack down) and the hold is less than `RELEASE_GRACE_MS` overdue: skip it (log a warning). Otherwise, release.
- **Release:** as today (conditional `updateMany` → `CANCELLED`, reopen the slot unless `createdForBooking`), plus `holdReleasedAt: now`.
- **After release:** MANUAL → `manualPayments.released` (as today); online → `notifier.holdReleased`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/api/src/modules/consult/consult-cron-hold.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { ConsultCron } from './consult.cron';

const NOW = new Date('2026-10-06T09:00:00Z');

function make(rows: any[], verify: any) {
  const tx: any = { consultBooking: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, consultAvailability: { updateMany: vi.fn() } };
  const prisma: any = { consultBooking: { findMany: vi.fn().mockResolvedValue(rows) }, $transaction: vi.fn(async (cb: any) => cb(tx)) };
  const manual: any = { released: vi.fn() };
  const paystack: any = { verifyTransaction: verify };
  const settler: any = { settle: vi.fn().mockResolvedValue('confirmed') };
  const notifier: any = { holdReleased: vi.fn() };
  return { cron: new ConsultCron(prisma, manual, paystack, settler, notifier), tx, settler, notifier, manual };
}

const online = { id: 900n, availabilityId: 3n, paymentMethod: 'PAYSTACK', paymentRef: 'booking-900-1', holdExpiresAt: new Date('2026-10-06T08:50:00Z') };

describe('releasing unpaid holds (BKG-09)', () => {
  it('confirms instead of releasing when Paystack says it was paid', async () => {
    vi.useFakeTimers().setSystemTime(NOW);
    const { cron, tx, settler } = make([online], vi.fn().mockResolvedValue({ status: 'success' }));
    await cron.handleBookingExpiry();
    expect(settler.settle).toHaveBeenCalledWith('booking-900-1', { status: 'success' });
    expect(tx.consultBooking.updateMany).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('releases an unpaid hold, records when, and emails the client', async () => {
    vi.useFakeTimers().setSystemTime(NOW);
    const { cron, tx, notifier } = make([online], vi.fn().mockResolvedValue({ status: 'abandoned' }));
    await cron.handleBookingExpiry();
    expect(tx.consultBooking.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'CANCELLED', holdReleasedAt: NOW });
    expect(notifier.holdReleased).toHaveBeenCalledWith(900n);
    vi.useRealTimers();
  });

  it('waits when Paystack cannot be reached, then releases once two hours overdue', async () => {
    vi.useFakeTimers().setSystemTime(NOW);
    const down = vi.fn().mockRejectedValue(new Error('timeout'));
    const first = make([online], down);
    await first.cron.handleBookingExpiry();
    expect(first.tx.consultBooking.updateMany).not.toHaveBeenCalled();

    const old = { ...online, holdExpiresAt: new Date('2026-10-06T06:59:00Z') };
    const later = make([old], down);
    await later.cron.handleBookingExpiry();
    expect(later.tx.consultBooking.updateMany).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('still releases bank-transfer holds without asking Paystack', async () => {
    vi.useFakeTimers().setSystemTime(NOW);
    const verify = vi.fn();
    const { cron, manual } = make([{ ...online, paymentMethod: 'MANUAL', paymentRef: null }], verify);
    await cron.handleBookingExpiry();
    expect(verify).not.toHaveBeenCalled();
    expect(manual.released).toHaveBeenCalledWith(900n);
    vi.useRealTimers();
  });
});
```

The notifier spec adds:
- the pay email from `booked()` links to `/pay/<id>?t=<payLinkToken(id)>`;
- its message contains "held until" and the WAT time of `holdExpiresAt`;
- `holdReleased()` sends `bookings.hold_released`, with a "Try again" action to the same tokenised pay link.

- [ ] **Step 2: Run, to see them fail**

Run: `cd apps/api && npx vitest run src/modules/consult/consult-cron-hold.spec.ts src/modules/notifications`
Expected: FAIL

- [ ] **Step 3: Implement**

`consult.cron.ts`:
- The constructor becomes `(prisma, manualPayments, paystack: PaystackService, settler: BookingPaymentSettler, @Optional() notifier?: BookingNotifier)`.
- Delete `ONLINE_HOLD_MS`, import from `./online-hold`, and change the decorator to `EVERY_5_MINUTES`.
- In the `findMany` select, add `paymentRef: true, holdExpiresAt: true`.
- Make the legacy branch use `ONLINE_HOLD_MINUTES * 60_000`.
- Before the release transaction:

```ts
        if (booking.paymentMethod !== 'MANUAL' && booking.paymentRef) {
          try {
            const tx = await this.paystack.verifyTransaction(booking.paymentRef);
            if (tx?.status === 'success') {
              await this.settler.settle(booking.paymentRef, tx);
              continue;
            }
          } catch (err) {
            const overdue = now.getTime() - (booking.holdExpiresAt?.getTime() ?? now.getTime());
            if (overdue < RELEASE_GRACE_MS) {
              this.logger.warn(`Paystack unreachable for booking ${booking.id}; keeping its hold for now.`);
              continue;
            }
          }
        }
```

The release `updateMany` data becomes `{ status: 'CANCELLED', holdReleasedAt: now }`. After release:

```ts
        if (booking.paymentMethod === 'MANUAL') await this.manualPayments.released(booking.id);
        else await this.notifier?.holdReleased(booking.id).catch(() => undefined);
```

`ConsultModule` must be able to inject `PaystackService` and `BookingPaymentSettler`. It already gets `BillingService` from the billing module; make sure `BillingModule` exports both.

`booking-notifier.service.ts`:
- Import `payLinkToken` from `'../consult/staff-booking-rules'`.
- In `booked()`, the pay email:

```ts
    const payLink = `${tenantWebOrigin(b.tenant)}/pay/${b.id}?t=${payLinkToken(b.id)}`;
    const heldUntil = b.holdExpiresAt
      ? b.holdExpiresAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' })
      : null;
    // message: `… on ${when}.` + (heldUntil ? ` Your time is held until ${heldUntil}.` : ' Your time is held while you pay.')
    // link: payLink
```

Make `load()` select `holdExpiresAt`.

Add:

```ts
  /** BKG-09: an online hold ran out unpaid. The time may still be free. */
  async holdReleased(bookingId: bigint): Promise<void> {
    const b = await this.load(bookingId);
    if (!b) return;
    await this.notifications
      .sendEmail({
        to: b.client.email,
        type: 'bookings.hold_released',
        title: 'Your held time was released',
        message: `We didn't receive payment for your ${b.service.title} on ${this.when(b.availability.startsAt)}, so the time was released. If it's still free, you can pay now and keep it.`,
        link: `${tenantWebOrigin(b.tenant)}/pay/${b.id}?t=${payLinkToken(b.id)}`,
        actionLabel: 'Try again',
        tenantId: b.tenantId,
        profileId: b.clientProfileId,
      })
      .catch((err) => this.logger.warn(`Could not send the hold-released email for booking ${bookingId}: ${(err as Error).message}`));
  }
```

If importing from `consult/` into `notifications/` creates a module cycle at runtime, move `payLinkToken` and `payLinkTokenValid` into `apps/api/src/common/pay-link-token.ts` and re-export them from `staff-booking-rules.ts`, as `logo-url.ts` was moved.

- [ ] **Step 4: Run the API suite and typecheck**

Run: `cd apps/api && npx tsc --noEmit -p . && npx vitest run --maxWorkers=2 --minWorkers=1`
Expected: 0 type errors; all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "BKG-09: the expiry job asks Paystack before releasing; pay emails say until when and link with their token"
```

---

### Task 5: The countdown in the wizard, and retry on the pay page

**Files:**
- Create: `apps/app/src/pages/public/booking/HoldCountdown.tsx`
- Modify: `apps/app/src/pages/public/booking/bookingWizard.ts` (`booked` action carries `holdExpiresAt`; state `holdExpiresAt: string | null`; `slotTaken` and `selectSlot` clear it)
- Modify: `apps/app/src/pages/public/booking/BookingWizardPage.tsx` (dispatch the hold; treat `{ status: 'REFUNDED' }` from confirm-payment)
- Modify: `apps/app/src/pages/public/booking/ReviewPayStep.tsx` (render `<HoldCountdown>` above the pay options when `state.holdExpiresAt`)
- Modify: `apps/app/src/pages/public/PayBookingPage.tsx`
- Test: `apps/app/src/pages/public/booking/__tests__/HoldCountdown.test.tsx`, `__tests__/BookingWizardPage.test.tsx` (extend), `apps/app/src/pages/public/__tests__/PayBookingPage.test.tsx` (create or extend)

**Interfaces:**
- Consumes: `createBooking` → `holdExpiresAt`; `/pay` → `holdExpiresAt`; confirm-payment → `status: 'REFUNDED'`; pay-link summary → `holdExpiresAt`, `canRetry`.
- Produces: `HoldCountdown({ expiresAt }: { expiresAt: string })`.

Copy:
- **Live:** "Your time is held for **34:12**". `role="timer"`, mm:ss, updating every second.
- **Expired:** "Your hold has ended. Pay now and we'll keep the time if it's still free."
- **Refunded** (wizard): an `AlertBanner` saying "Your payment arrived after this time was taken. We're refunding it; please choose another time." The wizard returns to step 2 via `slotTaken`.
- **Pay page, `LAPSED` + `canRetry`:** "Your hold ended, but the time may still be free.", with the button **Try again (₦35,000)**. It calls the same `POST …/pay-link`. If that fails with "no longer available", show "That time has been booked. Contact {practice} to choose another."
- **Pay page, `PAYABLE` with `holdExpiresAt`:** "Held until 3:42 PM".

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/app/src/pages/public/booking/__tests__/HoldCountdown.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithApp } from '../../../../test/renderWithApp';
import { HoldCountdown } from '../HoldCountdown';

describe('HoldCountdown', () => {
  afterEach(() => vi.useRealTimers());
  it('counts down the hold and then says it ended', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-06T09:00:00Z'));
    renderWithApp(<HoldCountdown expiresAt="2026-10-06T09:00:05Z" />);
    expect(screen.getByRole('timer')).toHaveTextContent('00:05');
    act(() => { vi.advanceTimersByTime(6000); });
    expect(screen.getByText(/your hold has ended/i)).toBeInTheDocument();
  });
});
```

(Check the import path of `renderWithApp` against an existing test in `booking/__tests__/` and copy it exactly.)

In `BookingWizardPage.test.tsx`, add:
- After Pay, when the booking response carries `holdExpiresAt` (10 minutes ahead) and the pop-up is cancelled, step 4 shows a `timer`.
- When confirm-payment resolves `{ status: 'REFUNDED' }`, the wizard is on step 2 with the refund banner.

`PayBookingPage.test.tsx`:
- A `LAPSED` summary with `canRetry: true` shows "Try again".
- Clicking it posts to `/v1/consult/public/bookings/900/pay-link` with `{ t }`.
- `canRetry: false` shows the existing "no longer held" line.

- [ ] **Step 2: Run, to see them fail**

Run: `cd apps/app && npx vitest run src/pages/public --maxWorkers=2 --minWorkers=1`
Expected: FAIL

- [ ] **Step 3: Implement**

```tsx
// apps/app/src/pages/public/booking/HoldCountdown.tsx
import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

/** BKG-09: how long the client's time stays held while they pay. */
export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  if (left === 0) {
    return (
      <p className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] font-semibold text-amber-800">
        Your hold has ended. Pay now and we'll keep the time if it's still free.
      </p>
    );
  }
  return (
    <p className="rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-[13.5px] text-[#475569]">
      Your time is held for{' '}
      <span role="timer" className="font-bold text-[#0F172A]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {pad(Math.floor(left / 60))}:{pad(left % 60)}
      </span>
    </p>
  );
}
```

`bookingWizard.ts`:
- Add `holdExpiresAt: string | null` to `WizardState` (initial `null`).
- The `booked` action becomes `{ type: 'booked'; bookingId: string; holdExpiresAt: string | null }` and sets it.
- Add `{ type: 'holdRenewed'; holdExpiresAt: string }`.
- `slotTaken` and `selectSlot` reset it to `null`.
- Add a `refunded: boolean` flag, set by a new `{ type: 'refunded' }` action. That action moves to step 2 like `slotTaken`, and `selectSlot` clears the flag.

`BookingWizardPage.tsx`, in `pay()`:
- `dispatch({ type: 'booked', bookingId: res.bookingId, holdExpiresAt: res.holdExpiresAt ?? null })`.
- On the retry branch, read `holdExpiresAt` from the `/pay` response and `dispatch({ type: 'holdRenewed', holdExpiresAt })`.
- After the pop-up succeeds: `const confirmed = await api.post<{ status: string }>(…/confirm-payment…)`, then `if (confirmed.status === 'REFUNDED') { dispatch({ type: 'refunded' }); return; }`.
- Add `holdExpiresAt?: string | null` to `BookingResponse`.
- Step 2 shows the refund `AlertBanner` when `state.refunded`.

`ReviewPayStep.tsx`: when `state.holdExpiresAt && state.payMethod === 'online'`, render `<HoldCountdown expiresAt={state.holdExpiresAt} />` directly above the pay options.

`PayBookingPage.tsx`: extend `Summary` with `holdExpiresAt: string | null; canRetry: boolean`, then render the copy above. Factor the button so `PAYABLE` and `LAPSED + canRetry` share `pay()`.

- [ ] **Step 4: Run the app suite and typecheck**

Run: `cd apps/app && npx tsc --noEmit -p . && npx vitest run --maxWorkers=2 --minWorkers=1`
Expected: 0 type errors; all PASS

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/public
git commit -m "BKG-09: a hold countdown on the pay step, refunds explained, and retry from the pay page"
```

---

### Task 6: Custom domain shows "Coming soon" (SET-03)

**Files:**
- Modify: `apps/app/src/pages/practice/settings/BrandSettingsPage.tsx` (the `CUSTOM DOMAIN` card, around lines 180–220)
- Test: `apps/app/src/pages/practice/settings/__tests__/BrandSettingsPage.test.tsx` (extend; create it beside the page if it doesn't exist, copying the setup of another settings test)

**Interfaces:** none. The API routes stay in place for later; only the UI hides them.

- [ ] **Step 1: Write the failing test**

```tsx
it('shows custom domains as coming soon, with no domain field or verify button', async () => {
  renderBrandSettings(); // the file's existing helper, or renderWithApp(<BrandSettingsPage />) with the brand GET mocked
  expect(await screen.findByText(/custom domain/i)).toBeInTheDocument();
  expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  expect(screen.queryByLabelText('Custom domain')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /verify domain/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run, to see it fail**

Run: `cd apps/app && npx vitest run src/pages/practice/settings`
Expected: FAIL (the input is still there)

- [ ] **Step 3: Implement**

Replace the card's body (the input, the DNS instructions, the Verify and Save domain buttons) with:

```tsx
<p className="text-[13px] leading-[1.55] text-[#64748B]">
  <span className="mr-2 inline-flex items-center rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#475569]">Coming soon</span>
  Use your own address, like booking.yourpractice.com, on Pro and Clinic. Until then, clients book at your Unclutter Desk link above.
</p>
```

Delete the now-unused state and handlers (`customDomain`, `verifyingCustomDomain`, `handleSaveDomain`, the verify call) so `tsc` and lint stay clean. If the onboarding wizard also offers a domain field (`grep -n customDomain apps/app/src/pages/practice/OnboardingWizardPage.tsx`), remove it from the UI there too. Keep it in the draft type only if removing it would break saved drafts.

- [ ] **Step 4: Run the app suite**

Run: `cd apps/app && npx tsc --noEmit -p . && npx vitest run --maxWorkers=2 --minWorkers=1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/practice
git commit -m "SET-03: custom domains show as coming soon instead of a verify button that can't finish"
```

---

### Task 7: Browser check and the testing sheet

- [ ] **Step 1: Start the servers.**
  - API: `cd apps/api && NODE_OPTIONS=--max-old-space-size=8192 npx nest build && SMTP_HOST= SMTP_USER= SMTP_PASS= PORT=3099 node dist/src/main.js`
  - App: `cd apps/app && npx vite --port 5173 --strictPort`
- [ ] **Step 2: Book at `http://dr-smith.localhost:5173/book` as a client** with Paystack test keys.
  - Close the pop-up. Step 4 shows the countdown.
  - Set the booking's `holdExpiresAt` to the past in the database, and call the cron (or wait 5 minutes). The booking is `CANCELLED` with `holdReleasedAt`, and the log shows the hold-released email.
  - Open the email's pay link: "Try again" appears; pay with a test card; the booking is confirmed.
- [ ] **Step 3: Refund path.** Release again. Book the same time as another client, then complete an old pop-up's payment. The log shows a `POST /refund` and the refund email, and the practice gets a notification.
- [ ] **Step 4: Brand settings** shows "Coming soon" at 390px and 1280px.
- [ ] **Step 5:** In `docs/testing-feedback.md`, set BKG-09 to **Fixed** and SET-03's card note. Fill **Fix:** with the commit hashes and **Verified:** with what Steps 2–4 showed. Commit with `git commit -m "Testing sheet: BKG-09 fixed; SET-03 shows coming soon"`.
