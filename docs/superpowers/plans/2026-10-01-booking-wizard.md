# Booking Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single long booking page (`ClientBookingPage.tsx`) with the 4-step booking wizard plus confirmation, exactly as designed, with Paystack's pop-up checkout.

**Architecture:**
- **State:** wizard state lives in a pure reducer (`bookingWizard.ts`), and the current step is mirrored in the URL (`?step=`).
- **Data:** a `useBookingData` hook loads the practice, services, the next 28 days of slots, reviews and payment options. Pure helpers in `bookingSlots.ts` group slots into weeks and days in West Africa Time.
- **Components:** each step is its own component under `apps/app/src/pages/public/booking/`, inside a shared shell (header, progress, step card, sticky bar, summary card). Brand colours come from a tested `tenantBrandStyle()` in `@unclutterdesk/ui`.
- **Payments:** Paystack opens as a pop-up from the `access_code` the API returns. A new confirm endpoint verifies the payment server-side, using the same code path as the webhook.

**Tech Stack:**
- **App:** React + Vite + Tailwind, `@unclutterdesk/ui` (`Button`, `Card`, `Eyebrow`, `Input`, `SegmentedControl`, `Textarea`), `lucide-react`.
- **API:** NestJS + Prisma.
- **Tests:** vitest + Testing Library through `renderWithApp`, with only `utils/apiClient` and the Paystack script faked.

**Spec:** `docs/design/design_handoff_booking_wizard/README.md` gives the exact sizes, colours, copy and states. Screenshots are in `docs/design/design_handoff_booking_wizard/screenshots/`. The decisions are recorded under BKG-01 and BKG-03 in `docs/testing-feedback.md`.

## Global Constraints

- **The README is the visual spec.** Use its pixel values, copy and states verbatim. Where this plan says "per README §X", open that section and copy the values exactly.
- **Use design-system components and `var(--*)` tokens** (`Button`, `Card`, `Eyebrow`, `Input`, `SegmentedControl`, `Textarea`). Don't copy the prototype's inline styles. Tailwind arbitrary values like `rounded-[20px]` are fine where no component exists.
- **Breakpoints:** phone ≤ 600, tablet 601–1023, desktop ≥ 1024. Use `useViewport` from `@unclutterdesk/ui`. No horizontal page scroll at any width. Touch targets are at least 44px.
- **Times are shown in West Africa Time** (`Africa/Lagos`), whatever the browser's time zone.
- **Money:** kobo strings from the API, shown as `₦35,000` with tabular numbers.
- **Decided deviations from the design:**
  - Transfer reference stays `UD-<bookingId>` (the existing `transferReference()`), not `UDK-XXXX-YYYY`.
  - Bank details are only shown after the hold is created, because the API only gives them with a booking. Step 4's transfer option shows the intro text; the details and Copy buttons appear on the confirmation.
  - **Notify me** (no times in 4 weeks) is deferred (BKG-08). Show the practice's email and phone instead.
  - The format labels, filter and address render from the slot data. Until SET-06 ships, every slot is `VIDEO`, so each reads "Online", the filter stays hidden, and no address shows. **What's next** renders only when the booking response includes forms (BKG-06), so it's hidden until then.
- **Tests fake only the network** (`utils/apiClient`) and the third-party Paystack script (`window.PaystackPop`). Never stub `@unclutterdesk/ui` or our own modules, except `AuthContext`, which existing page tests already mock.
- Work on `dev` and commit after each task. Run the app suite with `npx vitest run --maxWorkers=2 --minWorkers=1` (the full parallel run runs out of memory on this machine).
- **API build:** `NODE_OPTIONS=--max-old-space-size=8192 npx nest build`.
- **Email in manual checks:** start the API with `SMTP_HOST= SMTP_USER= SMTP_PASS=` so mail is only logged.

## Review Focus

1. **A practice in another time zone, or a client's browser outside Nigeria.** Dates, day dots and times must group by WAT. A 23:30 WAT slot belongs to that WAT day even in a London browser. This is pinned in Task 3 (`dayKeyWAT`).
2. **The slot is taken between choosing it and paying.** The API refuses the booking ("no longer available"), and the wizard must return to step 2 with the "That time was just booked" banner, the time cleared and nothing charged. This is pinned in Task 9.
3. **The client closes the Paystack pop-up, or the payment fails.** The wizard returns to step 4 with the "didn't go through" banner and the CTA "Try again · ₦X". Retrying must reuse the same booking (`POST public/bookings/:id/pay`) rather than creating a second hold. This is pinned in Task 10.
4. **A light brand colour (lilac `#CDBDF2`).** Button text and links must stay readable (4.5:1). This is pinned in Task 1, with the README's three tenants as fixtures.
5. **Refreshing mid-wizard, or using the browser's Back button.** `?step=` must restore the step when its prerequisites are in state, and otherwise fall back to the earliest step that's missing data, never a blank or broken step. This is pinned in Task 2.

---

## File structure

```
packages/ui/src/brand/tenantBrandStyle.ts          (create) brand slots + ink + on-primary, pure
packages/ui/src/brand/__tests__/tenantBrandStyle.test.ts
packages/ui/src/index.ts                           (modify) export it

apps/api/src/modules/billing/paystack.service.ts   (modify) initialize returns access_code too
apps/api/src/modules/billing/billing.service.ts    (modify) extract markBookingPaid(), used by webhook + confirm
apps/api/src/modules/consult/consult.service.ts    (modify) startOnlinePayment returns { url, accessCode }; booking response adds accessCode, reference; slots add therapistTitle; confirmPublicPayment()
apps/api/src/modules/consult/consult.controller.ts (modify) POST public/bookings/:bookingId/confirm-payment
apps/api/src/modules/consult/booking-paystack-popup.spec.ts (create)

apps/app/src/pages/public/booking/
  bookingWizard.ts            reducer, step rules, URL sync helpers (pure)
  bookingSlots.ts             WAT day keys, weeks, grouping, formats (pure)
  useBookingData.ts           loads practice, services, slots, reviews, payment options
  paystackPopup.ts            loads inline.js once, resumeTransaction() as a promise
  BookingShell.tsx            header, progress, step card, sticky bar, summary card, footer
  ServiceStep.tsx
  TimeStep.tsx
  DetailsStep.tsx
  ReviewPayStep.tsx
  ConfirmationStep.tsx
  BookingWizardPage.tsx       assembles everything; route /book
  __tests__/…                 one test file per module above

apps/app/src/pages/public/ClientAuthPanel.tsx      (modify) accepts the design's look; keeps behaviour
apps/app/src/App.tsx                               (modify) /book → BookingWizardPage
apps/app/src/pages/practice/settings/BrandSettingsPage.tsx (modify) preview renders BookingWizardPage
apps/app/src/pages/public/ClientBookingPage.tsx    (delete, Task 12)
apps/app/scripts/check-layout.mjs                  (modify) /book on the practice host, STRICT
```

---

### Task 1: Brand slots that stay readable on any practice colour

**Files:**
- Create: `packages/ui/src/brand/tenantBrandStyle.ts`
- Create: `packages/ui/src/brand/__tests__/tenantBrandStyle.test.ts`
- Modify: `packages/ui/src/index.ts` (add `export * from './brand/tenantBrandStyle';`)

**Interfaces:**
- Produces: `tenantBrandStyle(primary: string, secondary: string): Record<string, string>`, the CSS custom properties to spread onto the wizard root's `style`. The keys are `--brand-primary`, `--brand-secondary`, `--brand-on-primary`, `--brand-ink`, `--brand-ring`, `--brand-tint`, `--brand-fill`, `--brand-dot` and `--brand-secondary-tint`.
- Produces: `contrastRatio(a: string, b: string): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { contrastRatio, tenantBrandStyle } from '../tenantBrandStyle';

describe('tenantBrandStyle', () => {
  it.each([
    // The three tenants the design was checked with (README, Design tokens).
    ['#24614F', '#8A5A3C', '#FFFFFF', '#24614F'],
    ['#0F3A53', '#E3B341', '#FFFFFF', '#0F3A53'],
  ])('keeps a dark brand as its own ink, with white on top (%s)', (primary, secondary, onPrimary, ink) => {
    const s = tenantBrandStyle(primary, secondary);
    expect(s['--brand-on-primary']).toBe(onPrimary);
    expect(s['--brand-ink'].toLowerCase()).toBe(ink.toLowerCase());
  });

  it('darkens a light brand into a readable ink, and puts dark text on it', () => {
    const s = tenantBrandStyle('#CDBDF2', '#F2B8A0');
    expect(contrastRatio(s['--brand-ink'], '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(s['--brand-on-primary'], '#CDBDF2')).toBeGreaterThanOrEqual(4.5);
  });

  it('derives the soft fills from the brand', () => {
    const s = tenantBrandStyle('#0F3A53', '#E3B341');
    expect(s['--brand-fill']).toBe('rgba(15, 58, 83, 0.09)');
    expect(s['--brand-ring']).toBe('rgba(15, 58, 83, 0.2)');
    expect(s['--brand-tint']).toBe('rgba(15, 58, 83, 0.08)');
    expect(s['--brand-dot']).toBe('rgba(15, 58, 83, 0.4)');
    expect(s['--brand-secondary-tint']).toBe('rgba(227, 179, 65, 0.1)');
  });

  it('falls back to the Desk default for an invalid colour', () => {
    expect(tenantBrandStyle('not-a-colour', '')['--brand-primary']).toBe('#0F3A53');
  });
});
```

- [ ] **Step 2:** Run `cd packages/ui && npx vitest run src/brand`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
const DEFAULT_PRIMARY = '#0F3A53';
const DEFAULT_SECONDARY = '#E3B341';

function parse(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function luminance(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [parse(a), parse(b)].map((c) => (c ? luminance(c) : 0));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mixes towards black until the colour reads at 4.5:1 on white. */
function darkenUntilReadable(rgb: [number, number, number]): [number, number, number] {
  let c = rgb;
  for (let i = 0; i < 40 && contrastRatio(toHex(c), '#FFFFFF') < 4.5; i++) {
    c = c.map((v) => v * 0.92) as [number, number, number];
  }
  return c;
}

const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;

/**
 * A practice's colours as the CSS slots the booking pages read. Dark brands
 * keep their colour for text; light ones get a darkened "ink" so links and
 * initials stay readable, and dark text on their buttons.
 */
export function tenantBrandStyle(primary: string, secondary: string): Record<string, string> {
  const p = parse(primary) ?? (parse(DEFAULT_PRIMARY) as [number, number, number]);
  const s = parse(secondary) ?? (parse(DEFAULT_SECONDARY) as [number, number, number]);
  const primaryHex = parse(primary) ? toHex(p) : DEFAULT_PRIMARY;
  const whiteOnPrimary = contrastRatio('#FFFFFF', primaryHex) >= 4.5;
  const ink = whiteOnPrimary ? primaryHex : toHex(darkenUntilReadable(p));
  const onPrimary = whiteOnPrimary ? '#FFFFFF' : toHex(darkenUntilReadable(darkenUntilReadable(p).map((v) => v * 0.6) as [number, number, number]));
  return {
    '--brand-primary': primaryHex,
    '--brand-secondary': toHex(s),
    '--brand-on-primary': onPrimary,
    '--brand-ink': ink,
    '--brand-ring': rgba(p, 0.2),
    '--brand-tint': rgba(p, 0.08),
    '--brand-fill': rgba(p, 0.09),
    '--brand-dot': rgba(p, 0.4),
    '--brand-secondary-tint': rgba(s, 0.1),
  };
}
```

Two adjustments if the tests need them. Make the dark-brand `--brand-ink` keep the input's casing by comparing with `toLowerCase()`, as the test does. If `onPrimary` on lilac doesn't reach 4.5:1, keep darkening it until `contrastRatio(onPrimary, primaryHex) >= 4.5`.

- [ ] **Step 4:** Run `cd packages/ui && npx vitest run src/brand`. Expected: PASS (4 tests).
- [ ] **Step 5:** Commit: `git add packages/ui/src/brand packages/ui/src/index.ts && git commit -m "Brand slots stay readable on any practice colour"`

---

### Task 2: Wizard state and step rules

**Files:**
- Create: `apps/app/src/pages/public/booking/bookingWizard.ts`
- Test: `apps/app/src/pages/public/booking/__tests__/bookingWizard.test.ts`

**Interfaces:**
- Produces:

```ts
export type Step = 1 | 2 | 3 | 4 | 5;
export type FormatFilter = 'All' | 'Online' | 'In person';
export interface WizardState {
  step: Step;
  serviceId: string | null;
  weekIndex: 0 | 1 | 2 | 3;
  date: string | null;          // 'YYYY-MM-DD' in WAT
  slotId: string | null;
  formatFilter: FormatFilter;
  note: string;
  discount: { code: string; status: 'idle' | 'applied' | 'invalid'; savingKobo: string; finalKobo: string | null };
  payMethod: 'online' | 'transfer';
  paymentStatus: 'idle' | 'pending' | 'failed' | 'paid';
  slotTaken: boolean;           // shows the "That time was just booked" banner on step 2
  bookingId: string | null;     // set once a booking exists, so retries reuse it
}
export type WizardAction =
  | { type: 'chooseService'; serviceId: string }
  | { type: 'setWeek'; weekIndex: 0 | 1 | 2 | 3 }
  | { type: 'chooseDate'; date: string }
  | { type: 'chooseSlot'; slotId: string }
  | { type: 'setFilter'; filter: FormatFilter }
  | { type: 'setNote'; note: string }
  | { type: 'discount'; discount: WizardState['discount'] }
  | { type: 'setPayMethod'; method: 'online' | 'transfer' }
  | { type: 'goTo'; step: Step }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'slotTaken' }
  | { type: 'booked'; bookingId: string }
  | { type: 'paymentFailed' }
  | { type: 'paid' };
export function initialState(opts: { singleServiceId?: string | null }): WizardState;
export function wizardReducer(state: WizardState, action: WizardAction): WizardState;
export function canContinue(state: WizardState, signedIn: boolean): boolean;
export function stepFromUrl(raw: string | null, state: WizardState): Step; // falls back to the earliest step that's missing data
export const STEP_PARAM: Record<Step, string>;  // 1:'service' 2:'time' 3:'details' 4:'pay' 5:'done'
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { canContinue, initialState, stepFromUrl, wizardReducer as r } from '../bookingWizard';

const s0 = initialState({});
const withTime = [
  { type: 'chooseService', serviceId: 's1' },
  { type: 'next' },
  { type: 'chooseDate', date: '2026-10-06' },
  { type: 'chooseSlot', slotId: 't1' },
].reduce((s, a) => r(s, a as any), s0);

describe('booking wizard', () => {
  it('starts on the service step, or on time when the practice has one service', () => {
    expect(s0.step).toBe(1);
    const single = initialState({ singleServiceId: 's1' });
    expect(single.step).toBe(2);
    expect(single.serviceId).toBe('s1');
  });

  it('only continues once the step is complete', () => {
    expect(canContinue(s0, false)).toBe(false);
    expect(canContinue(r(s0, { type: 'chooseService', serviceId: 's1' }), false)).toBe(true);
    expect(canContinue({ ...withTime, step: 2, slotId: null }, false)).toBe(false);
    expect(canContinue(withTime, false)).toBe(true);
    expect(canContinue({ ...withTime, step: 3 }, false)).toBe(false); // details need a signed-in client
    expect(canContinue({ ...withTime, step: 3 }, true)).toBe(true);
  });

  it('changing the service clears the time and resets the filter', () => {
    const s = r({ ...withTime, formatFilter: 'Online' }, { type: 'chooseService', serviceId: 's2' });
    expect(s.slotId).toBeNull();
    expect(s.formatFilter).toBe('All');
  });

  it('changing the day clears the time', () => {
    expect(r(withTime, { type: 'chooseDate', date: '2026-10-07' }).slotId).toBeNull();
  });

  it('Back keeps every earlier choice', () => {
    const back = r({ ...withTime, step: 3 }, { type: 'back' });
    expect(back.step).toBe(2);
    expect(back.slotId).toBe('t1');
    expect(back.serviceId).toBe('s1');
  });

  it('a taken slot sends the client back to times with the banner and no time chosen', () => {
    const s = r({ ...withTime, step: 4 }, { type: 'slotTaken' });
    expect(s.step).toBe(2);
    expect(s.slotId).toBeNull();
    expect(s.slotTaken).toBe(true);
    expect(r(s, { type: 'chooseSlot', slotId: 't2' }).slotTaken).toBe(false);
  });

  it('a failed payment stays on pay, keeping the booking so a retry reuses it', () => {
    const booked = r({ ...withTime, step: 4 }, { type: 'booked', bookingId: '900' });
    const failed = r(booked, { type: 'paymentFailed' });
    expect(failed.step).toBe(4);
    expect(failed.paymentStatus).toBe('failed');
    expect(failed.bookingId).toBe('900');
  });

  it('restores a step from the URL only when its earlier steps are complete', () => {
    expect(stepFromUrl('pay', withTime)).toBe(3); // details not done yet, so step 3
    expect(stepFromUrl('time', s0)).toBe(1);       // no service yet
    expect(stepFromUrl('nonsense', withTime)).toBe(withTime.step);
  });
});
```

- [ ] **Step 2:** Run `cd apps/app && npx vitest run src/pages/public/booking/__tests__/bookingWizard.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the reducer exactly as the tests describe:
  - `next` advances one step, capped at 4; `paid` moves to 5; `back` goes down one step, never below the first step (2 when there's a single service).
  - `goTo` only moves to steps up to the furthest one whose prerequisites are met: service for 2, slot for 3, signed-in for 4. Signed-in is passed through `canContinue`, so `goTo` from the progress bar only allows done steps; the page checks before dispatching.
  - `stepFromUrl` maps names through `STEP_PARAM`. It returns the lowest of the requested step and the first incomplete step: no service gives 1, no slot gives 2, and anything else gives 3 when the requested step is 4 or later, because sign-in is checked live.

- [ ] **Step 4:** Run the tests again. Expected: PASS (8 tests).
- [ ] **Step 5:** Commit: `git add apps/app/src/pages/public/booking && git commit -m "Booking wizard state: steps, rules and URL restore"`

---

### Task 3: Slots grouped by West Africa Time

**Files:**
- Create: `apps/app/src/pages/public/booking/bookingSlots.ts`
- Test: `apps/app/src/pages/public/booking/__tests__/bookingSlots.test.ts`

**Interfaces:**
- Consumes: public slots from `GET /v1/consult/public/availability`: `{ id, serviceId: string | null, providerProfileId, therapistName, therapistTitle?: string | null, avatarUrl, startsAt, endsAt, channel: 'VIDEO' | 'IN_PERSON' | string }`.
- Produces:

```ts
export type Slot = { id: string; serviceId: string | null; therapistName: string; therapistTitle?: string | null; startsAt: string; endsAt: string; channel: string };
export type Format = 'Online' | 'In person';
export function formatOf(channel: string): Format;                 // IN_PERSON → 'In person', anything else 'Online'
export function dayKeyWAT(iso: string): string;                      // 'YYYY-MM-DD' in Africa/Lagos
export function timeLabelWAT(iso: string): string;                   // '11:30 AM'
export function weekDays(today: Date, weekIndex: number): string[];  // 7 day keys, week 0 starts today (WAT)
export function weekLabel(days: string[]): string;                   // '1 Oct – 7 Oct'
export function slotsForService(slots: Slot[], serviceId: string | null): Slot[];
export function slotsOnDay(slots: Slot[], day: string, filter: 'All' | Format): Slot[];
export function formatsOffered(slots: Slot[]): Format[];             // distinct, in display order
export function nextDayWithSlots(slots: Slot[], afterDay: string): string | null;
export const WINDOW_DAYS = 28;
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { dayKeyWAT, formatOf, formatsOffered, nextDayWithSlots, slotsForService, slotsOnDay, timeLabelWAT, weekDays, weekLabel } from '../bookingSlots';

const slot = (id: string, startsAt: string, channel = 'VIDEO', serviceId: string | null = null) =>
  ({ id, serviceId, therapistName: 'Sarah Smith', startsAt, endsAt: startsAt, channel });

describe('booking slots', () => {
  it('groups by the day in Lagos, not the browser', () => {
    // 22:30 UTC is 23:30 in Lagos on the same day; 23:30 UTC is 00:30 the next day.
    expect(dayKeyWAT('2026-10-06T22:30:00Z')).toBe('2026-10-06');
    expect(dayKeyWAT('2026-10-06T23:30:00Z')).toBe('2026-10-07');
    expect(timeLabelWAT('2026-10-06T10:30:00Z')).toBe('11:30 AM');
  });

  it('pages four weeks of seven days from today, labelled for the header', () => {
    const today = new Date('2026-10-01T08:00:00Z');
    expect(weekDays(today, 0)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']);
    expect(weekDays(today, 3)[6]).toBe('2026-10-28');
    expect(weekLabel(weekDays(today, 0))).toBe('1 Oct – 7 Oct');
  });

  it('reads the format the practice set, treating older slots as online', () => {
    expect(formatOf('IN_PERSON')).toBe('In person');
    expect(formatOf('VIDEO')).toBe('Online');
    expect(formatOf('')).toBe('Online');
  });

  it('keeps open slots and the service’s own, filters by day and format', () => {
    const all = [slot('a', '2026-10-06T08:00:00Z'), slot('b', '2026-10-06T12:00:00Z', 'IN_PERSON'), slot('c', '2026-10-06T13:00:00Z', 'VIDEO', 'other')];
    const forS1 = slotsForService(all, 's1');
    expect(forS1.map((s) => s.id)).toEqual(['a', 'b']);
    expect(slotsOnDay(forS1, '2026-10-06', 'In person').map((s) => s.id)).toEqual(['b']);
    expect(formatsOffered(forS1)).toEqual(['Online', 'In person']);
  });

  it('finds the next day with times', () => {
    const all = [slot('a', '2026-10-13T09:00:00Z')];
    expect(nextDayWithSlots(all, '2026-10-07')).toBe('2026-10-13');
    expect(nextDayWithSlots(all, '2026-10-13')).toBeNull();
  });
});
```

- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement** with `Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' })` for day keys, and `Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', hour: 'numeric', minute: '2-digit', hour12: true })` for times. Do day arithmetic on noon-UTC dates built from the key (`new Date(key + 'T12:00:00Z')`), so it never crosses a day boundary. `weekLabel` uses `en-GB` `{ day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }` joined with " – ".
- [ ] **Step 4:** Run the tests. Expected: PASS (5 tests).
- [ ] **Step 5:** Commit: `git commit -am "Booking slots grouped by West Africa Time"` (after `git add` of the two files).

---

### Task 4: API support for the pop-up checkout and the summary card

**Files:**
- Modify: `apps/api/src/modules/billing/paystack.service.ts`. `initializeTransaction` already returns Paystack's `data`. Type the return as `{ authorization_url: string; access_code: string; reference: string }`.
- Modify: `apps/api/src/modules/billing/billing.service.ts`. Move the body of the `charge.success` booking branch of `handleWebhook` (lines ~447–465) into `async markBookingPaid(reference: string, data: unknown): Promise<boolean>`, and call it from the webhook.
- Modify: `apps/api/src/modules/consult/consult.service.ts`:
  - `startOnlinePayment(...)` returns `{ url: string; accessCode: string }` instead of the URL. Update its two callers, keeping `paymentUrl` in their responses.
  - The `createPublicBooking` response adds `accessCode` and `reference` (`paymentRef`) when online payment started.
  - `POST public/bookings/:id/pay` (the existing retry) also returns `accessCode`.
  - `getPublicAvailability` adds `therapistTitle: [credentials, specialty].filter(Boolean).join(' · ') || null` (include `credentials` and `specialty` from the therapist profile).
  - New: `confirmPublicPayment(tenantId, clientProfileId, bookingId)`. It loads the booking (it must belong to this tenant and client), then calls `paystack.verifyTransaction(paymentRef)`. If `data.status === 'success'`, it calls `billing.markBookingPaid(paymentRef, data)`. It returns `{ status: 'CONFIRMED' | 'PENDING_PAYMENT' }`.
- Modify: `apps/api/src/modules/consult/consult.controller.ts`. Add `@Post('public/bookings/:bookingId/confirm-payment')` with the same guard and decorators as `public/bookings/:bookingId/transfer-sent`.
- Test: `apps/api/src/modules/consult/booking-paystack-popup.spec.ts`

**Interfaces:**
- Produces: the booking response now includes `accessCode?: string; reference?: string`. `POST /v1/consult/public/bookings/:bookingId/confirm-payment` returns `{ status }`. Public slots include `therapistTitle`.

- [ ] **Step 1: Write the failing tests.** Build the service the way `booking-service-choice.spec.ts` does, with test stand-ins for Prisma and for `paystack` and `billing`:

```ts
it('gives the pop-up its access code with a new booking', async () => {
  const { service, paystack } = make();
  paystack.initializeTransaction.mockResolvedValue({ authorization_url: 'https://checkout.paystack.com/x', access_code: 'ac_123', reference: 'booking-900-1' });
  const res = await service.createPublicBooking(TENANT, CLIENT, { serviceId: '1', availabilityId: '5' } as any);
  expect(res).toMatchObject({ accessCode: 'ac_123', paymentUrl: 'https://checkout.paystack.com/x' });
});

it('confirms a paid booking straight away, the same way the webhook does', async () => {
  const { service, paystack, billing } = make({ booking: { id: 900n, tenantId: TENANT, clientProfileId: CLIENT, paymentRef: 'booking-900-1', status: 'PENDING_PAYMENT' } });
  paystack.verifyTransaction.mockResolvedValue({ status: 'success', reference: 'booking-900-1' });
  billing.markBookingPaid.mockResolvedValue(true);
  await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).resolves.toEqual({ status: 'CONFIRMED' });
  expect(billing.markBookingPaid).toHaveBeenCalledWith('booking-900-1', expect.anything());
});

it('leaves an unpaid booking pending', async () => {
  const { service, paystack, billing } = make({ booking: { id: 900n, tenantId: TENANT, clientProfileId: CLIENT, paymentRef: 'booking-900-1', status: 'PENDING_PAYMENT' } });
  paystack.verifyTransaction.mockResolvedValue({ status: 'abandoned' });
  await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).resolves.toEqual({ status: 'PENDING_PAYMENT' });
  expect(billing.markBookingPaid).not.toHaveBeenCalled();
});

it("refuses to confirm another client's booking", async () => {
  const { service } = make({ booking: null }); // findFirst scoped by tenant + client finds nothing
  await expect(service.confirmPublicPayment(TENANT, CLIENT, 900n)).rejects.toThrow('not found');
});

it('names each slot’s therapist with their credentials', async () => {
  const { service } = make({ slots: [{ id: 5n, therapist: { credentials: 'PhD, LCSW', specialty: null, profile: { firstName: 'Sarah', lastName: 'Smith' } }, /* … */ }] });
  const [slot] = await service.getPublicAvailability(TENANT);
  expect(slot.therapistTitle).toBe('PhD, LCSW');
});
```

In `billing.service.spec.ts` (or the existing webhook spec), add one test: the webhook calls `markBookingPaid`, and calling `markBookingPaid` twice for the same reference only confirms once. It's idempotent because it updates `where: { paymentRef, status: 'PENDING_PAYMENT' }`.

- [ ] **Step 2:** Run `cd apps/api && npx vitest run src/modules/consult/booking-paystack-popup.spec.ts src/modules/billing`. Expected: FAIL.
- [ ] **Step 3: Implement** the changes listed under **Files**. Also check `ConsultModule`'s providers: `BillingService` has to be injectable into `ConsultService`. If importing it would create a circular module dependency, put `markBookingPaid` in a small `BookingPaymentService` in the consult module, and have the billing webhook call that instead.
- [ ] **Step 4:** Run `cd apps/api && npx vitest run --maxWorkers=2 --minWorkers=1 && npx tsc --noEmit -p .`. Expected: all PASS.
- [ ] **Step 5:** Commit: `git commit -m "Bookings start a Paystack pop-up and confirm payment at once"`

---

### Task 5: Paystack pop-up loader

**Files:**
- Create: `apps/app/src/pages/public/booking/paystackPopup.ts`
- Test: `apps/app/src/pages/public/booking/__tests__/paystackPopup.test.ts`

**Interfaces:**
- Produces: `payInPopup(accessCode: string): Promise<'success' | 'cancelled'>`. It loads `https://js.paystack.co/v2/inline.js` once, calls `new PaystackPop().resumeTransaction(accessCode, { onSuccess, onCancel, onError })`, and resolves `'success'` on `onSuccess`, `'cancelled'` on `onCancel`. It rejects on `onError` or when the script can't load.

- [ ] **Step 1: Write the failing tests.** The Paystack script is the network boundary, so the test puts a fake `PaystackPop` on `window` and marks the script as already loaded:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  document.head.innerHTML = '';
});

function fakePaystack(outcome: 'onSuccess' | 'onCancel' | 'onError') {
  const resumeTransaction = vi.fn((_code: string, cb: Record<string, (x?: unknown) => void>) => cb[outcome]({ reference: 'booking-900-1' }));
  (window as any).PaystackPop = vi.fn(() => ({ resumeTransaction }));
  return resumeTransaction;
}

it('resumes the transaction with the access code and reports success', async () => {
  const resume = fakePaystack('onSuccess');
  const { payInPopup } = await import('../paystackPopup');
  await expect(payInPopup('ac_123')).resolves.toBe('success');
  expect(resume).toHaveBeenCalledWith('ac_123', expect.any(Object));
});

it('reports a closed pop-up as cancelled', async () => {
  fakePaystack('onCancel');
  const { payInPopup } = await import('../paystackPopup');
  await expect(payInPopup('ac_123')).resolves.toBe('cancelled');
});

it('fails clearly when Paystack errors', async () => {
  fakePaystack('onError');
  const { payInPopup } = await import('../paystackPopup');
  await expect(payInPopup('ac_123')).rejects.toThrow(/payment/i);
});
```

- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement**

```ts
const SRC = 'https://js.paystack.co/v2/inline.js';
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if ((window as any).PaystackPop) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loading = null;
        reject(new Error('Could not open the payment window. Check your connection and try again.'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** Opens Paystack's checkout over the page for a transaction the API already started. */
export async function payInPopup(accessCode: string): Promise<'success' | 'cancelled'> {
  await loadScript();
  const Pop = (window as any).PaystackPop;
  return new Promise((resolve, reject) => {
    new Pop().resumeTransaction(accessCode, {
      onSuccess: () => resolve('success'),
      onCancel: () => resolve('cancelled'),
      onError: () => reject(new Error('The payment could not be completed.')),
    });
  });
}
```

Also add `https://js.paystack.co` and `https://checkout.paystack.com` to the app's Content-Security-Policy if one is set (search `index.html` and the nginx config for `Content-Security-Policy`).

- [ ] **Step 4:** Run the tests. Expected: PASS (3).
- [ ] **Step 5:** Commit: `git commit -m "Paystack checkout opens as a pop-up"`

---

### Task 6: Booking data hook

**Files:**
- Create: `apps/app/src/pages/public/booking/useBookingData.ts`
- Test: `apps/app/src/pages/public/booking/__tests__/useBookingData.test.tsx`

**Interfaces:**
- Consumes the same endpoints and preview behaviour as today's `ClientBookingPage` (lines 80–100 and 184). Use `previewSlug` with the `X-Tenant-Slug` header through `apiRequest`; otherwise use `api.get`:
  - `GET /v1/tenant/public/info/:slug`, which returns `{ id, name, logoUrl, primaryColor, secondaryColor, publicEmail, publicPhone, address, city, cancellationHours }`.
  - `GET /v1/consult/public/services`, returning `PublicService[]`.
  - `GET /v1/consult/public/availability`, returning `Slot[]`.
  - `GET /v1/intake/public/reviews`, returning `{ averageRating, count }`.
  - `GET /v1/consult/public/payment-options`, returning `{ bankTransfer }`.
- Produces: `useBookingData(slug: string, previewSlug?: string)` → `{ status: 'loading' | 'ready' | 'error'; practice; services; slots; reviews; bankTransfer: boolean; reloadSlots(): Promise<Slot[]> }`. `reloadSlots` is used to re-check availability on Continue and before paying.

- [ ] **Step 1: Write the failing test.** Render a tiny consumer inside `renderWithApp` with `api.get` faked per URL. Assert:
  - it reports `loading`, then `ready` with all five payloads;
  - `bankTransfer` reflects payment options;
  - a failing services call gives `error`;
  - `reloadSlots()` fetches availability again and returns the new list.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement** with one `useEffect` and `Promise.all`, keeping the existing `previewSlug` header logic.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit.

---

### Task 7: The shell: header, progress, step card, sticky bar, summary card

**Files:**
- Create: `apps/app/src/pages/public/booking/BookingShell.tsx`
- Test: `apps/app/src/pages/public/booking/__tests__/BookingShell.test.tsx`

**Interfaces:**
- Consumes: `PracticeLogo` from `components/public/PracticeLogo` (plan Task 4 of the open-items plan). If it isn't built yet, build it first as described there.
- Produces:
  - `BookingHeader({ name, logoUrl, rating?: { average: number; count: number } | null, profileHref })`: per README §Header. Logo tile, or the initials fallback in brand ink. The rating links to `profileHref` and is hidden when `count === 0`. Includes the **Secure booking** pill.
  - `BookingProgress({ step, onGoTo })`: per README §Progress. Four columns (Service, Time, Details, Pay). Done steps are buttons that call `onGoTo`; the others are `aria-disabled`. Hidden on step 5.
  - `StepCard({ step, title, sub, onBack?, children, footer? })`: per README §Step card, with "Step N of 4" (`Eyebrow`). The "‹ Back" control shows on phone and tablet when `onBack` is set. On desktop, `footer` renders the nav row.
  - `StickyActionBar({ totalKobo?, label, disabled, onClick })`: per README §Sticky action bar, phone and tablet only.
  - `SummaryCard({ therapist?, serviceLabel?, whenLabel?, formatLabel?, totalKobo?, cancellationHours })`: per README §Desktop summary card, with its placeholders.
  - `PoweredBy()`: per README footer line.

- [ ] **Step 1: Write the failing tests:**

```tsx
it('shows the logo, or initials when there is none, and links the rating to the profile', () => {
  renderWithApp(<BookingHeader name="Smith Therapy & Wellness" logoUrl={null} rating={{ average: 4.9, count: 32 }} profileHref="/" />);
  expect(screen.getByText('ST')).toBeTruthy();
  expect(screen.getByRole('link', { name: /4.9 · 32 reviews/ }).getAttribute('href')).toBe('/');
  expect(screen.getByText('Secure booking')).toBeTruthy();
});
it('hides the rating when there are no reviews', () => {
  renderWithApp(<BookingHeader name="Calm" logoUrl={null} rating={{ average: 0, count: 0 }} profileHref="/" />);
  expect(screen.queryByText(/reviews/)).toBeNull();
});
it('lets the client jump back to a finished step but not ahead', () => {
  const onGoTo = vi.fn();
  renderWithApp(<BookingProgress step={3} onGoTo={onGoTo} />);
  fireEvent.click(screen.getByRole('button', { name: 'Service' }));
  expect(onGoTo).toHaveBeenCalledWith(1);
  expect(screen.getByText('Pay').closest('[aria-disabled="true"]')).toBeTruthy();
});
it('shows placeholders until there is a value, then the total', () => {
  renderWithApp(<SummaryCard cancellationHours={24} />);
  expect(screen.getByText('Choose a session')).toBeTruthy();
  expect(screen.getByText('Pick a time')).toBeTruthy();
  cleanup();
  renderWithApp(<SummaryCard serviceLabel="Individual therapy · 50 min" totalKobo="3500000" cancellationHours={24} />);
  expect(screen.getByText('₦35,000')).toBeTruthy();
});
it('the sticky bar shows the total and disables until the step is valid', () => {
  renderWithApp(<StickyActionBar totalKobo="3500000" label="Continue" disabled onClick={() => {}} />);
  expect(screen.getByText('₦35,000')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(true);
});
```

- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3: Implement** with `Card`, `Eyebrow` and `Button` from `@unclutterdesk/ui`, `lucide-react` icons, and the README values. Brand colours come only from the `--brand-*` variables set by Task 1. Never hard-code a practice colour.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit.

---

### Task 8: Steps 1 and 2: choose a session, pick a time

**Files:**
- Create: `apps/app/src/pages/public/booking/ServiceStep.tsx` and `TimeStep.tsx`
- Test: `apps/app/src/pages/public/booking/__tests__/ServiceStep.test.tsx` and `TimeStep.test.tsx`

**Interfaces:**
- `ServiceStep({ status, services, slots, selectedId, onChoose, practiceEmail })`:
  - Cards per README §Step 1. The format tags come from `formatsOffered(slotsForService(slots, service.id))`; until SET-06, that's "Online" only.
  - States: loading (3 skeletons), no services (dashed box with the practice email).
- `TimeStep({ service, slots, today, state, dispatch, practiceAddress, singleService, onChangeService })`, per README §Step 2:
  - service row (with **Change** unless `singleService`);
  - week header with prev and next limited to weeks 0–3;
  - date strip (days without times dimmed and disabled);
  - format filter only when `formatsOffered(...)` has both formats and the day has times;
  - time buttons showing the time and `formatOf(channel)`;
  - the address panel when the chosen slot is in person and `practiceAddress` is set;
  - states: no times this week (with "Go to {day} →"), no times in 4 weeks (practice email and phone, BKG-08), and the slot-taken banner when `state.slotTaken`.

- [ ] **Step 1: Write the failing tests:**
  - **ServiceStep:** renders three cards with price, length and format tags; clicking a card calls `onChoose('id')`; the selected card has `aria-pressed="true"`; `status='loading'` shows 3 elements with `data-skeleton`; no services shows "No sessions open for booking" with a `mailto:` link.
  - **TimeStep** (time is fixed with `today = new Date('2026-10-01T08:00:00Z')`):
    - The date strip shows `1 Oct – 7 Oct`; prev is disabled at week 0; next pages to `8 Oct – 14 Oct`; next is disabled at week 3.
    - A day without slots is disabled. Picking a day lists its times as "11:30 AM" with "Online".
    - With mixed formats, the filter appears, and choosing "In person" hides online times. With online-only slots, there's no filter.
    - Choosing an in-person time with an address shows "In person at the practice" and the address.
    - No times this week shows "No times this week" and a button "Go to Tue, 13 Oct →" that jumps there.
    - No times for 4 weeks shows "No free times in the next 4 weeks" and the practice's email.
    - `state.slotTaken` shows "That time was just booked".
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3: Implement** using `SegmentedControl` for the filter and the Task 3 helpers for all date logic.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit.

---

### Task 9: Step 3 (your details) and step 4 (review and pay)

**Files:**
- Modify: `apps/app/src/pages/public/ClientAuthPanel.tsx`. Restyle it to README §Step 3 (segmented "Create account | Sign in", the 48px inputs, the reassurance line with the shield icon). Keep its props (`onDone`) and API calls, and keep `ClientAuthPanel.test.tsx` passing, updating label text only where the design changes it.
- Create: `apps/app/src/pages/public/booking/DetailsStep.tsx` and `ReviewPayStep.tsx`
- Test: `apps/app/src/pages/public/booking/__tests__/DetailsStep.test.tsx` and `ReviewPayStep.test.tsx`

**Interfaces:**
- `DetailsStep({ me, onSignOut, note, onNote })`: the signed-in card ("Booking as Ada Okafor", email · phone, **Not you?**), or `ClientAuthPanel`; plus the optional note textarea.
- `ReviewPayStep({ service, slot, therapist, state, dispatch, bankTransfer, tenantId })`, per README §Step 4:
  - a summary table;
  - the discount collapsed behind "+ Have a discount code?", applied through `POST /v1/discount/validate` (the same body as today's page: `{ tenantId, code, priceKobo }`). It shows "You save ₦X. New total ₦Y." or the invalid message, with **Remove** when applied;
  - the payment radio cards, with the transfer card only when `bankTransfer`. Choosing transfer shows its intro text; the bank details come on the confirmation (see Global Constraints);
  - the cancellation line;
  - the payment-failed banner when `state.paymentStatus === 'failed'`.

- [ ] **Step 1: Write the failing tests:**
  - **DetailsStep:** signed out shows "Create account" and "Sign in" and the line "One Unclutter Desk account works with every practice."; signed in shows "Booking as Ada Okafor", and **Not you?** calls `onSignOut`; typing in the note calls `onNote`.
  - **ReviewPayStep:**
    - Shows Session "Individual therapy · 50 min", When "Tue, 6 Oct · 11:30 AM WAT", Format "Online", and Total "₦35,000".
    - Applying `CALM10` with the API returning `{ code: 'CALM10', amountSavedKobo: '350000', finalKobo: '3150000' }` shows "You save ₦3,500. New total ₦31,500." and a discount row.
    - An API rejection shows "That code isn't valid for this session. Check the spelling or try another."
    - There's no transfer card when `bankTransfer` is false.
    - `paymentStatus: 'failed'` shows "Your payment didn't go through".
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run them, plus `ClientAuthPanel.test.tsx`. Expected: PASS.
- [ ] **Step 5:** Commit.

---

### Task 10: Step 5: confirmation

**Files:**
- Create: `apps/app/src/pages/public/booking/ConfirmationStep.tsx`
- Test: `apps/app/src/pages/public/booking/__tests__/ConfirmationStep.test.tsx`

**Interfaces:**
- `ConfirmationStep({ booking, mode: 'paid' | 'transfer', now?: () => number, apiBase })`, where `booking` is the booking response (`bookingId`, `startsAt`, `endsAt`, `therapistName`, `serviceTitle`, `channel?`, `manualPayment?: { bankName, accountName, accountNumber, reference, holdExpiresAt }`, `forms?: Array<{ title, kind, minutes, href }>`). Per README §Step 5:
  - **Paid:** the check icon, "You're booked", the sub, and the details table (When, Format, With).
  - **Transfer:** the clock icon, "Your time is held", the countdown to `holdExpiresAt` (`HH:MM:SS`, ticking every second, with a progress bar of the remaining share of 48h), and the bank rows with Copy buttons (the label shows "Copied" for 1600ms, no toast).
  - **Add to calendar:** links to `${apiBase}/v1/calendar/bookings/${bookingId}/ical` (.ics) and to Google Calendar (`https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=YYYYMMDDTHHMMSSZ/…`).
  - **Online sessions:** the video-link note.
  - **What's next:** only when `booking.forms?.length`.

- [ ] **Step 1: Write the failing tests:**
  - **Paid, online:** shows "You're booked", "Tue, 6 Oct · 11:30 AM WAT", "Online", the video note, and both calendar links (the `.ics` href and a `calendar.google.com` href with the right UTC dates). There's no "What's next" when `forms` is absent.
  - **Transfer:** shows "Your time is held", and the countdown reads "47:59:59" one second after a hold created at `now`. Clicking Copy on the reference calls `navigator.clipboard.writeText('UD-900')` (stub `navigator.clipboard`, a browser API) and shows "Copied".
  - **With forms:** shows "What's next", and each **Start** links to its `href`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit.

---

### Task 11: The wizard page: everything wired together

**Files:**
- Create: `apps/app/src/pages/public/booking/BookingWizardPage.tsx`
- Test: `apps/app/src/pages/public/booking/__tests__/BookingWizardPage.test.tsx`

**Interfaces:**
- Consumes everything above.
- Produces: `BookingWizardPage({ previewSlug }: { previewSlug?: string })`. It sets the root style to `tenantBrandStyle(practice.primaryColor, practice.secondaryColor)`, and lays out per README §Global layout: desktop grid with the summary card; phone and tablet single column with the sticky bar.

**Flow (each item is covered by a test below):**
1. Load data. With one service, start at step 2.
2. **Continue on step 2** calls `reloadSlots()`. If the chosen slot is gone, dispatch `slotTaken`.
3. **Step 3** needs a signed-in client (`useAuth`). `ClientAuthPanel`'s `onDone` moves to step 4.
4. **Pay online (step 4):**
   - With no `state.bookingId`, `POST /v1/consult/public/bookings { serviceId, availabilityId, notes, discountCode }` and then `dispatch({ type: 'booked' })`. With one, `POST /v1/consult/public/bookings/:id/pay` to reuse it.
   - Then `payInPopup(accessCode)`.
   - `success`: `POST …/confirm-payment`, dispatch `paid`, and show the confirmation in `paid` mode. A `PENDING_PAYMENT` result still shows the confirmation, because the webhook will finish the job; the confirmation says the email follows.
   - `cancelled`, or an error: dispatch `paymentFailed`.
   - An API error containing "no longer available": dispatch `slotTaken`.
5. **Hold my time (transfer):** `POST` with `paymentMethod: 'MANUAL'`, then the confirmation in `transfer` mode.
6. **URL:** `?step=` is kept in sync with `useSearchParams` and replaced, not pushed, on each change. It's restored through `stepFromUrl` on load.

- [ ] **Step 1: Write the failing tests.** Fake `api` per URL, mock `useAuth` (signed in or out, as the existing page tests do), and stub `window.PaystackPop` as in Task 5. Cover:
  - the full happy path: choose service, Continue, choose a day and time, Continue, step 3 already signed in so Continue, step 4 **Pay ₦35,000**. The pop-up succeeds, `confirm-payment` is called, and "You're booked" shows;
  - a single-service practice opens on "Pick a time" with no **Change** link;
  - the slot disappears on Continue from step 2, giving the banner and no time selected;
  - booking creation fails with "The selected time slot is no longer available", returning to step 2 with the banner;
  - the pop-up is cancelled, giving the step 4 banner and CTA "Try again · ₦35,000". Retrying calls `POST …/bookings/900/pay`, not a second create;
  - transfer: **Hold my time** creates with `paymentMethod: 'MANUAL'` and shows "Your time is held" and the reference `UD-900`;
  - a signed-out client on step 3 sees the auth panel, and Continue is disabled;
  - `?step=pay` on load without a service opens step 1.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `cd apps/app && npx vitest run --maxWorkers=2 --minWorkers=1 && npx tsc --noEmit -p .`. Expected: all PASS.
- [ ] **Step 5:** Commit.

---

### Task 12: Switch over, remove the old page, and check it in a browser

**Files:**
- Modify: `apps/app/src/App.tsx`. Point both `/book` routes (fullscreen app and booking host, lines ~576 and the app route list) at `BookingWizardPage`.
- Modify: `apps/app/src/pages/practice/settings/BrandSettingsPage.tsx`. The preview renders `<BookingWizardPage previewSlug={slug} />`.
- Delete: `apps/app/src/pages/public/ClientBookingPage.tsx`. Delete or adapt any test that imports it: move its still-relevant cases to the wizard tests, and delete the rest.
- Modify: `apps/app/src/pages/public/PublicProfilePage.tsx`, if its "Book Consultation" doesn't already go to `/book`.
- Modify: `apps/app/scripts/check-layout.mjs`. Add a booking-host pass that opens `http://dr-smith.localhost:5173/book` (no sign-in needed) at all four widths, under `STRICT`.

- [ ] **Step 1:** Make the changes. Run `cd apps/app && npx vitest run --maxWorkers=2 --minWorkers=1 && npx tsc --noEmit -p .`. Expected: PASS.
- [ ] **Step 2: Browser check.** Start the API with email logging only, and the app. On `http://dr-smith.localhost:5173/book`, at 390, 820 and 1280:
  - walk every step and compare against `screenshots/1a–1e`, `2a–2e` and `3a`;
  - set the demo practice's primary colour to `#CDBDF2` in Brand settings and compare against `4a–4d`, then set it back;
  - take the transfer path to the confirmation;
  - take the Paystack path with test keys: in the pop-up, use Paystack's test card, confirm "You're booked", and confirm the booking is `CONFIRMED` in the staff Sessions page;
  - close the pop-up once and check the failed banner.
- [ ] **Step 3:** Run `npm run check:layout`. Expected: no sideways scroll on `/book` at any width.
- [ ] **Step 4:** Update `docs/testing-feedback.md`: set BKG-01 and BKG-03 to `Fixed` with the commit. Note under BKG-02 that the header logo is done, if `PracticeLogo` landed here.
- [ ] **Step 5:** Commit: `git commit -m "Clients book through the step-by-step wizard"`

---

## Self-review notes

- **Spec coverage:** the README sections each have a home. Header, progress, step card, sticky bar and summary are in Task 7; steps 1–2 in Task 8; steps 3–4 in Task 9; step 5 in Task 10; states are spread across Tasks 8–11; interactions in Tasks 2 and 11; tokens in Task 1. The decided deviations are listed under Global Constraints.
- **Dependencies:** `PracticeLogo` comes from the open-items plan, Task 4; Task 7 builds it if it's missing. The formats, filter and address need SET-06 data and the forms need BKG-06; until then they're hidden or read "Online", by design.
- **Types used across tasks:** `Slot`, `Format`, `WizardState`, `payInPopup` and `tenantBrandStyle` are defined once (Tasks 1–5) and used with the same names later.
