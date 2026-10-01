# Testing Sheet: Open Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 15 items still `Open` in `docs/testing-feedback.md`. Bugs with a known cause are fixed first; items that need a product decision get a decision step before any code.

**Architecture:** The items fall into two waves.
- **Wave 1 (Tasks 1–7)** has confirmed root causes in the current code. These are fully specified here, test-first.
- **Wave 2 (Tasks 8–13)** needs a product or design decision (redesigns, new features). Each task opens with a *Decide* step recorded in the sheet, then builds from that decision. Where the decision could change the design, the task says to write a short spec before coding.

**Tech Stack:** NestJS + Prisma (PostgreSQL) in `apps/api`, tested with vitest using test stand-ins for Prisma. React + Vite + Tailwind in `apps/app`, tested with vitest + Testing Library through `renderWithApp` (the real router, brand and toast providers; only `utils/apiClient` is faked). Shared UI lives in `packages/ui`.

**Spec:** `docs/testing-feedback.md`. Each task names the item IDs it closes.

## Global Constraints

- Work on `dev`. Never push to `main`: a push there deploys to production.
- Tests fake only the network (`utils/apiClient`) on the app side. Never stub `@unclutterdesk/ui` or other code of ours. Render through `renderWithApp`.
- Prefer shared components over one-off copies (`AuthField`, `ManualPaymentFields` and the `components/shell/*` pieces are the models).
- The email template escapes everything it renders (`escapeHtml` in `email.channel.ts`). Never pass pre-built HTML into an email.
- Schema changes need a hand-written migration in `prisma/migrations/<timestamp>_<name>/migration.sql`. Don't run `prisma format`: it realigns unrelated models.
- The API build needs `NODE_OPTIONS=--max-old-space-size=8192 npx nest build` on this machine.
- Local email really sends through Gmail SMTP. For manual checks, start the API with `SMTP_HOST= SMTP_USER= SMTP_PASS=` so mail is only logged.
- Copy in the UI: plain, short, no jargon. "Booking link", not "slug". "Custom domain", not "hostname".
- After each task: set the item(s) to `Fixed` in `docs/testing-feedback.md`, filling in **Fix** with the commit hash and **Feedback / decision** with what was done.

## Review Focus

1. **A practice changes its booking link after clients already have the old one.** Old links must not silently break. Task 2 shows a warning before saving, and the API rejects a taken link with a clear message.
2. **Logos saved before this change are data URLs.** The new logo endpoint must serve both the stored data URLs and any `https://` URLs, and return 404 (not 500) when there's no logo. This is tested in Task 3.
3. **A slot's format changes after a client booked it.** Regenerating hours must never change the channel of a booked slot. Booked slots survive the regeneration delete; Task 5 adds a test that a booked slot keeps its channel.
4. **Existing practices have no format set.** Every existing slot is `VIDEO`, so the booking page must show "Online" for them, not an empty label. This is tested in Task 5.
5. **An admin who is not a practice owner opens the admin account menu.** "Back to my practice" must not appear when `profile.hasPractice` is false. This is tested in Task 7.

---

## Wave 1: confirmed bugs

### Task 1: Setup keeps the booking link the practice typed (SET-01, part 1). Done in `45230c9`

**Root cause:** in `apps/app/src/pages/practice/OnboardingWizardPage.tsx`, the `loadExistingBrand` effect (around lines 288–344) depends on `[slugTouched]`. Typing a booking link calls `handleSlugChange`, which sets `slugTouched` to `true`. That re-runs the effect, which fetches `/v1/tenant/brand` and calls `setSlug(brand.slug)`, overwriting what was just typed with the link created at signup. Continue then saves the old link.

**Files:**
- Modify: `apps/app/src/pages/practice/OnboardingWizardPage.tsx` (the `loadExistingBrand` effect)
- Test: `apps/app/src/pages/__tests__/OnboardingBrandStep.test.tsx` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const get = vi.fn();
const patch = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: vi.fn(), patch: (...a: unknown[]) => patch(...a) },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ profile: { id: '1', role: 'THERAPIST', practiceName: 'Calm Rooms', email: 'a@calm.ng' } }),
}));
const { OnboardingWizardPage } = await import('../practice/OnboardingWizardPage');

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  get.mockImplementation(async (url: string) => {
    if (url === '/v1/tenant/brand') return { name: 'Calm Rooms', slug: 'calm-rooms-4821' };
    if (url.startsWith('/v1/tenant/check-slug')) return { available: true };
    if (url === '/v1/consult/manual-payments/settings') return { enabled: false, details: null, onPlan: false, holdHours: 48 };
    return {};
  });
  patch.mockResolvedValue({});
});
afterEach(cleanup);

describe('Onboarding: booking link', () => {
  it('saves the booking link the practice typed, not the one made at signup', async () => {
    localStorage.setItem('unclutter_onboarding_v1', JSON.stringify({ stepIndex: 1 }));
    renderWithApp(<OnboardingWizardPage />, { route: '/onboarding' });

    const input = await screen.findByLabelText(/booking link/i);
    await waitFor(() => expect((input as HTMLInputElement).value).toBe('calm-rooms-4821'));
    fireEvent.change(input, { target: { value: 'calmrooms' } });
    // Give any reload of the brand a chance to run and overwrite the field.
    await new Promise((r) => setTimeout(r, 50));
    expect((input as HTMLInputElement).value).toBe('calmrooms');

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/tenant/brand', expect.objectContaining({ slug: 'calmrooms' })));
  });
});
```

If the brand step's link input has no accessible label, give it one (`<label htmlFor="brand-slug">Booking link</label>` on the input with `id="brand-slug"`) as part of Step 3.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd apps/app && npx vitest run src/pages/__tests__/OnboardingBrandStep.test.tsx`
Expected: FAIL. The field goes back to `calm-rooms-4821`, or the PATCH is sent with the old slug.

- [ ] **Step 3: Load the saved brand once, on mount**

Change the effect's dependency list from `[slugTouched]` to `[]`, and read the local draft instead of the `slugTouched` state inside it:

```tsx
  useEffect(() => {
    let cancelled = false;
    async function loadExistingBrand() {
      try {
        const brand = await api.get<{ /* existing shape, unchanged */ }>('/v1/tenant/brand');
        if (cancelled) return;
        // A draft the practice is part-way through wins over what the server
        // holds; the server only fills in what the draft doesn't have yet.
        const draftSlug = saved?.slugTouched ? saved.slug : null;
        if (brand.name) setPracticeName((current: string) => current || brand.name!);
        if (!draftSlug && brand.slug) {
          setSlug(brand.slug);
          setSlugTouched(true);
        }
        // ...the remaining setters stay exactly as they are...
      } catch {
        // Ignore errors; fall back to the initial state.
      }
    }
    void loadExistingBrand();
    return () => {
      cancelled = true;
    };
    // Runs once. Re-running on edits overwrote the booking link being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4: Run the test and the other onboarding tests**

Run: `cd apps/app && npx vitest run src/pages/__tests__/OnboardingBrandStep.test.tsx src/pages/__tests__/OnboardingPaymentsStep.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/practice/OnboardingWizardPage.tsx apps/app/src/pages/__tests__/OnboardingBrandStep.test.tsx
git commit -m "Setup keeps the booking link the practice typed"
```

---

### Task 2: A Booking link setting, separate from the custom domain (SET-01 part 2, SET-02). Done in `45230c9` (the card takes `slug` and `onSaved` props, and the page loads the brand once)

**Current state:** `BrandSettingsPage.tsx` has a "Custom hostname" field and no way to change the booking link. The API already accepts `slug` on `PATCH /v1/tenant/brand` (checking reserved names, and returning a 409 "That booking handle is already taken" on a clash). `GET /v1/tenant/check-slug/:slug` checks whether a link is free.

**Files:**
- Create: `apps/app/src/components/settings/BookingLinkCard.tsx`
- Modify: `apps/app/src/pages/practice/settings/BrandSettingsPage.tsx`: render `<BookingLinkCard />` above a section titled **Custom domain** that holds the existing hostname field (label becomes "Custom domain").
- Test: `apps/app/src/components/__tests__/BookingLinkCard.test.tsx`

**Interfaces:**
- Consumes: `GET /v1/tenant/brand` → `{ slug: string }`; `GET /v1/tenant/check-slug/:slug` → `{ available: boolean; reason?: string }`; `PATCH /v1/tenant/brand` with `{ slug }`; `getBookingUrl(slug)` from `utils/apiClient`.
- Produces: `export function BookingLinkCard(): JSX.Element`.

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const get = vi.fn();
const patch = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => get(...a), patch: (...a: unknown[]) => patch(...a) },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
}));
const { BookingLinkCard } = await import('../settings/BookingLinkCard');

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
});
afterEach(cleanup);

function network(available = true) {
  get.mockImplementation(async (url: string) => {
    if (url === '/v1/tenant/brand') return { slug: 'calm-rooms-4821' };
    if (url.startsWith('/v1/tenant/check-slug/')) return { available, reason: available ? undefined : 'Slug is already taken' };
    return {};
  });
}

describe('BookingLinkCard', () => {
  it('shows the current link and saves a new one after warning that the old link stops working', async () => {
    network();
    patch.mockResolvedValue({ slug: 'calmrooms' });
    renderWithApp(<BookingLinkCard />);

    const input = await screen.findByLabelText('Booking link');
    await waitFor(() => expect((input as HTMLInputElement).value).toBe('calm-rooms-4821'));
    fireEvent.change(input, { target: { value: 'CalmRooms' } });
    expect(await screen.findByText('https://calmrooms.unclutterdesk.com')).toBeTruthy();
    expect(screen.getByText(/old link will stop working/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save booking link' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/tenant/brand', { slug: 'calmrooms' }));
  });

  it('will not save a link someone else has', async () => {
    network(false);
    renderWithApp(<BookingLinkCard />);
    fireEvent.change(await screen.findByLabelText('Booking link'), { target: { value: 'taken-one' } });
    expect(await screen.findByText(/already taken/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save booking link' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the reason when the server refuses', async () => {
    network();
    patch.mockRejectedValue(new Error('That booking handle is already taken. Try another one.'));
    renderWithApp(<BookingLinkCard />);
    fireEvent.change(await screen.findByLabelText('Booking link'), { target: { value: 'raced' } });
    await screen.findByText('https://raced.unclutterdesk.com');
    fireEvent.click(screen.getByRole('button', { name: 'Save booking link' }));
    expect(await screen.findByText(/already taken/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/app && npx vitest run src/components/__tests__/BookingLinkCard.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Build the card**

```tsx
import React, { useEffect, useState } from 'react';
import { Card, Eyebrow, useToast } from '@unclutterdesk/ui';
import { api, getBookingUrl } from '../../utils/apiClient';

const inputCls = 'w-full h-[44px] px-3.5 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-mono font-bold text-[#0F172A] outline-none';

/** Same rule the API applies: lowercase letters, numbers and dashes. */
function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
}

/** The practice's unclutterdesk.com address. Custom domains are a separate setting. */
export function BookingLinkCard() {
  const toast = useToast();
  const [current, setCurrent] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [check, setCheck] = useState<{ available: boolean; reason?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ slug: string }>('/v1/tenant/brand').then((b) => {
      setCurrent(b.slug);
      setSlug(b.slug);
    });
  }, []);

  const changed = current !== null && slug !== '' && slug !== current;

  useEffect(() => {
    if (!changed || slug.length < 2) {
      setCheck(null);
      return;
    }
    const timer = setTimeout(() => {
      api
        .get<{ available: boolean; reason?: string }>(`/v1/tenant/check-slug/${slug}`)
        .then(setCheck)
        .catch(() => setCheck(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [slug, changed]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.patch('/v1/tenant/brand', { slug });
      setCurrent(slug);
      toast.success('Booking link saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the booking link');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="p-[24px_26px]" className="space-y-3 bg-white border border-slate-100">
      <div>
        <Eyebrow>BOOKING LINK</Eyebrow>
        <p className="mt-1 text-xs text-[#64748B]">Where clients find and book your practice.</p>
      </div>
      <label htmlFor="booking-link" className="text-[11.5px] font-bold text-[#475569]">Booking link</label>
      <input id="booking-link" value={slug} onChange={(e) => setSlug(toSlug(e.target.value))} className={inputCls} />
      {slug ? <p className="text-xs font-semibold text-[#0F3A53] break-all">{getBookingUrl(slug)}</p> : null}
      {check && !check.available ? (
        <p className="text-xs font-semibold text-red-600">{check.reason === 'Slug is already taken' ? 'That link is already taken.' : check.reason}</p>
      ) : null}
      {changed ? (
        <p className="text-xs text-amber-700">Your old link will stop working. Update it anywhere you've shared it.</p>
      ) : null}
      {error ? <p role="alert" className="text-xs font-semibold text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={() => void save()}
        disabled={!changed || saving || (check !== null && !check.available)}
        className="h-10 px-4 rounded-[12px] bg-[#0F3A53] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save booking link'}
      </button>
    </Card>
  );
}
```

Then in `BrandSettingsPage.tsx`, render `<BookingLinkCard />` first, and wrap the existing hostname block in a card headed **Custom domain**, with its label changed from "Custom hostname" to "Custom domain". Keep the DNS instructions and the Verify button as they are; Task 12 reworks them.

- [ ] **Step 4: Run the tests**

Run: `cd apps/app && npx vitest run src/components/__tests__/BookingLinkCard.test.tsx && npx tsc --noEmit -p .`
Expected: 3 PASS, no type errors.

- [ ] **Step 5: Check it in the browser**

Start both servers (see Global Constraints), sign in as `dr.jane@smiththerapy.ng` / `password123`, open **Settings → Brand**, change the link, save, reload, and confirm the new link sticks. Check that nothing scrolls sideways at 390px.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/components/settings/BookingLinkCard.tsx apps/app/src/components/__tests__/BookingLinkCard.test.tsx apps/app/src/pages/practice/settings/BrandSettingsPage.tsx
git commit -m "Settings has its own booking link, apart from the custom domain"
```

---

### Task 3: Logos are served from a real URL (NOT-01, part of BKG-02)

**Root cause:** logos are uploaded as `data:image/...;base64,` strings (`readAsDataURL` in the wizard) and stored as-is in `Tenant.logoUrl`. Gmail and most email clients block `data:` images, so emails fall back to the practice name. The same multi-hundred-KB string also rides along in every public tenant response.

**Fix:** serve the logo from `GET /v1/tenant/:id/logo`, and give emails that absolute URL.

**Files:**
- Modify: `apps/api/src/common/origins.ts`: add `apiOrigin()`.
- Modify: `apps/api/src/modules/tenant/tenant.service.ts`: add `getLogo(tenantId)`.
- Modify: `apps/api/src/modules/tenant/tenant.controller.ts`: add a public `GET ':id/logo'` route.
- Modify: `apps/api/src/modules/notifications/notification.service.ts`: `resolveBrand` returns the served URL.
- Test: `apps/api/src/modules/tenant/tenant-logo.spec.ts` (create), plus a case in `apps/api/src/modules/notifications/notification.service.spec.ts` (create the file if it doesn't exist).

**Interfaces:**
- Produces: `apiOrigin(isProduction?: boolean): string` → `API_URL` if set, else `https://api.unclutterdesk.com` in production, else `http://localhost:3099`.
- Produces: `TenantService.getLogo(tenantId: bigint): Promise<{ contentType: string; body: Buffer } | { redirect: string }>`. Throws `NotFoundException` when there's no logo.
- Produces: `logoUrlFor(tenant: { id: bigint; logoUrl: string | null; updatedAt?: Date | null }): string | null`, exported from `tenant.service.ts`. It returns `${apiOrigin()}/v1/tenant/${id}/logo?v=<first 8 chars of sha1(logoUrl)>` when `logoUrl` is a data URL, the `https://` URL unchanged when it's one, and `null` otherwise.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TenantService, logoUrlFor } from './tenant.service';

const PNG = 'data:image/png;base64,' + Buffer.from('fake-png').toString('base64');

function make(logoUrl: string | null) {
  const prisma: any = { tenant: { findUnique: vi.fn().mockResolvedValue(logoUrl === undefined ? null : { id: 7n, logoUrl }) } };
  return new TenantService(prisma, ...([] as any[]));
}

describe('practice logos', () => {
  it('serves a stored data URL as an image', async () => {
    const logo = await make(PNG).getLogo(7n);
    expect(logo).toEqual({ contentType: 'image/png', body: Buffer.from('fake-png') });
  });

  it('sends a hosted logo on to where it lives', async () => {
    expect(await make('https://cdn.example.com/logo.png').getLogo(7n)).toEqual({ redirect: 'https://cdn.example.com/logo.png' });
  });

  it('answers 404 when there is no logo, or it is not an image', async () => {
    await expect(make(null).getLogo(7n)).rejects.toBeInstanceOf(NotFoundException);
    await expect(make('data:text/html;base64,PGI+').getLogo(7n)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gives emails an address they will load, which changes when the logo does', () => {
    const a = logoUrlFor({ id: 7n, logoUrl: PNG });
    expect(a).toMatch(/^http:\/\/localhost:3099\/v1\/tenant\/7\/logo\?v=[0-9a-f]{8}$/);
    expect(logoUrlFor({ id: 7n, logoUrl: PNG.replace('ZmFrZS', 'b3RoZX') })).not.toBe(a);
    expect(logoUrlFor({ id: 7n, logoUrl: 'https://cdn.example.com/l.png' })).toBe('https://cdn.example.com/l.png');
    expect(logoUrlFor({ id: 7n, logoUrl: null })).toBeNull();
  });
});
```

Check `TenantService`'s constructor before writing `make()`. Pass the stand-ins it needs in the same order as the existing tenant specs (look at `apps/api/src/modules/tenant/*.spec.ts`).

In the notification spec, add:

```ts
it('gives emails a logo address, never an inline data URL', async () => {
  const prisma: any = { tenant: { findUnique: vi.fn().mockResolvedValue({ id: 7n, name: 'Calm', logoUrl: 'data:image/png;base64,QUJD' }) } };
  const service = new NotificationService(prisma, ...([] as any[]));
  const brand = await service.resolveBrand(7n);
  expect(brand.logoUrl).toMatch(/\/v1\/tenant\/7\/logo\?v=/);
});
```

(Match `NotificationService`'s constructor order from `notification.service.ts:74`.)

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/api && npx vitest run src/modules/tenant/tenant-logo.spec.ts src/modules/notifications/notification.service.spec.ts`
Expected: FAIL (`getLogo` / `logoUrlFor` are not defined; `resolveBrand` returns the data URL).

- [ ] **Step 3: Implement**

In `origins.ts`:

```ts
/** The API's own public address, for links to things it serves (e.g. practice logos in emails). */
export function apiOrigin(isProduction = process.env.NODE_ENV === 'production'): string {
  const configured = process.env.API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return isProduction ? `https://api.${ROOT_DOMAIN}` : 'http://localhost:3099';
}
```

In `tenant.service.ts` (top level):

```ts
import { createHash } from 'crypto';
import { apiOrigin } from '../../common/origins';

const DATA_IMAGE = /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/;

/** Where a practice's logo can be loaded from outside the app, e.g. in an email. */
export function logoUrlFor(tenant: { id: bigint; logoUrl: string | null }): string | null {
  const logo = tenant.logoUrl?.trim();
  if (!logo) return null;
  if (/^https:\/\//i.test(logo)) return logo;
  if (!DATA_IMAGE.test(logo)) return null;
  const version = createHash('sha1').update(logo).digest('hex').slice(0, 8);
  return `${apiOrigin()}/v1/tenant/${tenant.id}/logo?v=${version}`;
}
```

In the `TenantService` class:

```ts
  async getLogo(tenantId: bigint): Promise<{ contentType: string; body: Buffer } | { redirect: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, logoUrl: true } });
    const logo = tenant?.logoUrl?.trim();
    if (logo && /^https:\/\//i.test(logo)) return { redirect: logo };
    const match = logo?.match(DATA_IMAGE);
    if (!match) throw new NotFoundException('No logo');
    return { contentType: match[1], body: Buffer.from(match[2], 'base64') };
  }
```

In `tenant.controller.ts`, add a public route. Copy the decorator the other unauthenticated routes in this controller use (for example `check-slug/:slug`), and put this route **after** any `brand/...` routes so `brand` isn't read as an `:id`:

```ts
  @Get(':id/logo')
  @ApiOperation({ summary: "A practice's logo, for emails and other places outside the app" })
  async logo(@Param('id') id: string, @Res() res: Response) {
    if (!/^\d+$/.test(id)) throw new NotFoundException('No logo');
    const logo = await this.tenantService.getLogo(BigInt(id));
    if ('redirect' in logo) return res.redirect(302, logo.redirect);
    res.setHeader('Content-Type', logo.contentType);
    // The ?v= in the URL changes with the logo, so the old one can be cached for good.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (logo.contentType === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.send(logo.body);
  }
```

In `notification.service.ts` `resolveBrand`, select `id` too, and return `logoUrl: tenant ? logoUrlFor(tenant) : null`.

- [ ] **Step 4: Run the tests**

Run: `cd apps/api && npx vitest run src/modules/tenant src/modules/notifications && npx tsc --noEmit -p .`
Expected: all PASS.

- [ ] **Step 5: Check it end to end**

Rebuild and restart the API with email logging only. Upload a logo in Settings → Brand, then open `http://localhost:3099/v1/tenant/1/logo` in the browser: the image should load. Trigger any practice email (for example, resend a client invite) and confirm the log shows an `<img src="http://localhost:3099/v1/tenant/1/logo?v=...">`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/origins.ts apps/api/src/modules/tenant apps/api/src/modules/notifications
git commit -m "Emails show the practice logo from a real address, not an inline image"
```

Add `API_URL=https://api.unclutterdesk.com` to the production env notes in `docs/VPS_PREPARATION.md`.

---

### Task 4: The booking page shows the practice logo (BKG-02)

**Root cause:** `ClientBookingPage.tsx` never reads `logoUrl`. It uses `tenantInfo.name` and colours only. `PublicProfilePage.tsx` does render `<img>`s, so copy its approach.

**Files:**
- Create: `apps/app/src/components/public/PracticeLogo.tsx` (shared by both public pages)
- Modify: `apps/app/src/pages/public/ClientBookingPage.tsx` (the header where `practiceName` is shown)
- Modify: `apps/app/src/pages/public/PublicProfilePage.tsx` (swap its logo `<img>` for `PracticeLogo`)
- Test: `apps/app/src/components/__tests__/PracticeLogo.test.tsx`

**Interfaces:**
- Produces: `export function PracticeLogo(props: { name: string; logoUrl?: string | null; size?: number; color?: string }): JSX.Element`. It renders `<img alt="{name} logo">` when `logoUrl` is set, falls back to an initials badge when there's no logo or the image fails to load, and uses `initialsOf` from `utils/initials`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen } from '../../test/renderWithApp';
import { PracticeLogo } from '../public/PracticeLogo';

afterEach(cleanup);

describe('PracticeLogo', () => {
  it('shows the logo', () => {
    renderWithApp(<PracticeLogo name="Calm Rooms" logoUrl="https://x/logo.png" />);
    expect((screen.getByRole('img', { name: 'Calm Rooms logo' }) as HTMLImageElement).src).toBe('https://x/logo.png');
  });
  it('falls back to initials when there is none, or it will not load', () => {
    renderWithApp(<PracticeLogo name="Calm Rooms" logoUrl="https://x/broken.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Calm Rooms logo' }));
    expect(screen.getByText('CR')).toBeTruthy();
    cleanup();
    renderWithApp(<PracticeLogo name="Calm Rooms" />);
    expect(screen.getByText('CR')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd apps/app && npx vitest run src/components/__tests__/PracticeLogo.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
import React, { useState } from 'react';
import { initialsOf } from '../../utils/initials';

export function PracticeLogo({ name, logoUrl, size = 44, color = '#0F3A53' }: { name: string; logoUrl?: string | null; size?: number; color?: string }) {
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        onError={() => setFailed(true)}
        style={{ height: size, maxWidth: size * 3 }}
        className="object-contain rounded-[10px]"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ height: size, width: size, backgroundColor: color }}
      className="inline-flex items-center justify-center rounded-[12px] text-white font-bold text-[15px]"
    >
      {initialsOf(name, 'UD')}
    </span>
  );
}
```

In `ClientBookingPage.tsx`, render `<PracticeLogo name={practiceName} logoUrl={tenantInfo?.logoUrl} color={primaryColor} />` next to the practice name in the header. Add `logoUrl?: string | null` to the page's tenant info type if it's missing. In `PublicProfilePage.tsx`, replace the logo `<img>` with `PracticeLogo`.

- [ ] **Step 4: Run the tests and look at the page**

Run: `cd apps/app && npx vitest run && npx tsc --noEmit -p .`
Expected: all PASS. Then open `http://localhost:5173/book` on the demo practice's host and confirm the logo shows at 1280px and 390px.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/components/public/PracticeLogo.tsx apps/app/src/components/__tests__/PracticeLogo.test.tsx apps/app/src/pages/public/ClientBookingPage.tsx apps/app/src/pages/public/PublicProfilePage.tsx
git commit -m "The booking page shows the practice logo"
```

---

### Task 5: Each slot carries its real session format (BKG-05, API side of ONB-05). Superseded

> **Superseded 1 Oct 2026:** Tasks 5–6 are replaced by the fuller design in `docs/superpowers/specs/2026-10-01-session-formats-and-locations-design.md` (several locations, price per format, formats per block limited by each therapist). It's parked. Don't build Tasks 5–6 as written.

**Root cause:** `ConsultAvailability.channel` already exists, but every slot is created with `channel: 'VIDEO'` (`consult.service.ts` `replaceTherapistAvailability`, around line 519, and `staff-booking.service.ts:339`). On the booking page, "Online / In-person" is a local toggle that's never sent anywhere.

**Decision built in:** formats are `VIDEO` (shown as "Online") and `IN_PERSON` (shown as "In person"). A practice sets the format per working-hours window, so "Mon 9–12 in person, 14–17 online" is possible.

**Files:**
- Modify: `apps/api/src/modules/consult/consult.service.ts` (`replaceTherapistAvailability`, and the public slots response around line 1011, which already returns `channel`)
- Test: `apps/api/src/modules/consult/availability-channel.spec.ts` (create)

**Interfaces:**
- Consumes: `PATCH /v1/consult/therapist/availability` body `days[].windows[]`, which gains an optional `channel?: 'VIDEO' | 'IN_PERSON'`.
- Produces: `export const SESSION_CHANNELS = ['VIDEO', 'IN_PERSON'] as const;` and `export type SessionChannel`, from `consult.service.ts`. Every generated slot's `channel` comes from its window; the default is `'VIDEO'`.

- [ ] **Step 1: Write the failing test**

Build the service the way `booking-service-choice.spec.ts` does (same stand-ins for Prisma), then:

```ts
it('gives each slot the format of the hours it falls in', async () => {
  const { service, prisma } = make(); // prisma.consultAvailability.createMany captured
  await service.replaceTherapistAvailability(TENANT, PROVIDER, {
    days: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      enabled: true,
      windows: [
        { start: '09:00', end: '10:00', channel: 'IN_PERSON' },
        { start: '14:00', end: '15:00' },
      ],
    })),
    sessionLengthMinutes: 50,
    gapMinutes: 10,
  });
  const slots = prisma.consultAvailability.createMany.mock.calls[0][0].data;
  const morning = slots.filter((s: any) => s.startsAt.getHours() === 9);
  const afternoon = slots.filter((s: any) => s.startsAt.getHours() === 14);
  expect(morning.length).toBeGreaterThan(0);
  expect(morning.every((s: any) => s.channel === 'IN_PERSON')).toBe(true);
  expect(afternoon.every((s: any) => s.channel === 'VIDEO')).toBe(true);
});

it('refuses a format it does not know', async () => {
  const { service } = make();
  await expect(
    service.replaceTherapistAvailability(TENANT, PROVIDER, {
      days: [{ day: 0, enabled: true, windows: [{ start: '09:00', end: '10:00', channel: 'TELEPATHY' as any }] }],
      sessionLengthMinutes: 50,
      gapMinutes: 10,
    }),
  ).rejects.toThrow('Online or In person');
});

it('never changes the format of a slot that is already booked', async () => {
  const { service, prisma } = make();
  await service.replaceTherapistAvailability(TENANT, PROVIDER, {
    days: [{ day: 0, enabled: true, windows: [{ start: '09:00', end: '10:00', channel: 'IN_PERSON' }] }],
    sessionLengthMinutes: 50,
    gapMinutes: 10,
  });
  // Booked slots are excluded from the delete and never updated.
  expect(prisma.consultAvailability.deleteMany.mock.calls[0][0].where.bookings).toEqual({ none: {} });
  expect(prisma.consultAvailability.updateMany).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd apps/api && npx vitest run src/modules/consult/availability-channel.spec.ts`
Expected: FAIL. Slots are all `VIDEO`, and the unknown format is accepted.

- [ ] **Step 3: Implement**

At the top of `consult.service.ts`:

```ts
export const SESSION_CHANNELS = ['VIDEO', 'IN_PERSON'] as const;
export type SessionChannel = (typeof SESSION_CHANNELS)[number];
```

In `replaceTherapistAvailability`, widen the window type to `{ start: string; end: string; channel?: SessionChannel }`. Before anything is deleted, validate every window:

```ts
    for (const day of dto.days) {
      for (const w of day.windows) {
        if (w.channel !== undefined && !(SESSION_CHANNELS as readonly string[]).includes(w.channel)) {
          throw new BadRequestException('Each block of hours is either Online or In person.');
        }
      }
    }
```

Then replace `channel: 'VIDEO',` in the slot push with `channel: window.channel ?? 'VIDEO',`.

- [ ] **Step 4: Run the consult tests**

Run: `cd apps/api && npx vitest run src/modules/consult && npx tsc --noEmit -p .`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/consult/consult.service.ts apps/api/src/modules/consult/availability-channel.spec.ts
git commit -m "Each block of working hours sets whether its sessions are online or in person"
```

---

### Task 6: Practices choose the format, and clients see it (ONB-05, BKG-05)

**Files:**
- Modify: `apps/app/src/pages/practice/settings/AvailabilitySettingsPage.tsx`: each window gets a two-option control **Online / In person** (`aria-label="Format for <day> <start>–<end>"`), sent as `channel`.
- Modify: `apps/app/src/pages/practice/OnboardingWizardPage.tsx`: the Services step gets one question, **"How do you see clients?"**, with the options Online, In person, or Both. "Both" creates two windows per day (09:00–13:00 in person, 14:00–17:00 online) and the note says it can be changed in Settings → Availability. Remove the "physical vs virtual … later" sentence at line ~887.
- Modify: `apps/app/src/pages/public/ClientBookingPage.tsx`: delete the `sessionFormat` state and toggle (line 44 and ~291). Show a small tag on each time slot and in the summary ("Online" / "In person"), from `slot.channel`. When a practice offers both, add a filter above the times (**All / Online / In person**) that narrows the slot list.
- Test: `apps/app/src/pages/__tests__/ClientBookingFormat.test.tsx`; add a case to `apps/app/src/pages/__tests__/OnboardingPaymentsStep.test.tsx`'s sibling `OnboardingServicesStep.test.tsx` (create).

**Interfaces:**
- Consumes: public slots now reliably carry `channel: 'VIDEO' | 'IN_PERSON'` (Task 5).
- Produces: `export function channelLabel(channel: string | null | undefined): 'Online' | 'In person'`, in `apps/app/src/utils/sessionFormat.ts`. Anything that isn't `IN_PERSON` shows as "Online", which covers every existing slot.

- [ ] **Step 1: Write the failing tests**

`src/utils/__tests__/sessionFormat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { channelLabel } from '../sessionFormat';

describe('channelLabel', () => {
  it('names each format, treating old and unknown slots as online', () => {
    expect(channelLabel('IN_PERSON')).toBe('In person');
    expect(channelLabel('VIDEO')).toBe('Online');
    expect(channelLabel(undefined)).toBe('Online');
  });
});
```

`src/pages/__tests__/ClientBookingFormat.test.tsx`: render `ClientBookingPage` with the fakes that `ClientAuthPanel.test.tsx` uses for this page. Return two slots on the same day, one `VIDEO` at 09:00 and one `IN_PERSON` at 11:00. Assert:

```tsx
expect(screen.queryByRole('button', { name: 'In-person' })).toBeNull(); // the old free toggle is gone
fireEvent.click(await screen.findByRole('button', { name: /11:00/ }));
expect(screen.getByText('In person')).toBeTruthy();                     // summary shows the slot's own format
fireEvent.click(screen.getByRole('button', { name: 'Online' }));        // filter
expect(screen.queryByRole('button', { name: /11:00/ })).toBeNull();
```

`src/pages/__tests__/OnboardingServicesStep.test.tsx`: at the Services step (therapist persona, `stepIndex: 2`), choose **Both** and press Continue. Assert that the PATCH to `/v1/consult/therapist/availability` has, for Monday, `windows: [{ start: '09:00', end: '13:00', channel: 'IN_PERSON' }, { start: '14:00', end: '17:00', channel: 'VIDEO' }]`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd apps/app && npx vitest run src/utils/__tests__/sessionFormat.test.ts src/pages/__tests__/ClientBookingFormat.test.tsx src/pages/__tests__/OnboardingServicesStep.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/utils/sessionFormat.ts`:

```ts
export type SessionChannel = 'VIDEO' | 'IN_PERSON';

/** Slots made before formats existed are all video, so anything else reads as online. */
export function channelLabel(channel: string | null | undefined): 'Online' | 'In person' {
  return channel === 'IN_PERSON' ? 'In person' : 'Online';
}
```

Then make the three page changes listed under **Files**. In the wizard, keep one `seeClients` state (`'VIDEO' | 'IN_PERSON' | 'BOTH'`, default `'VIDEO'`, saved in the draft) and build `windows` from it in `saveAvailability`.

- [ ] **Step 4: Run all app tests and check both flows in the browser**

Run: `cd apps/app && npx vitest run && npx tsc --noEmit -p .`
Expected: all PASS. In the browser: set Monday to *Both* in Settings → Availability, then open the booking page and confirm the morning slots say "In person", the afternoon ones say "Online", and the filter works at 390px.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/utils/sessionFormat.ts apps/app/src/utils/__tests__/sessionFormat.test.ts apps/app/src/pages
git commit -m "Clients book the format the practice offers for each time, not a free toggle"
```

---

### Task 7: The admin console uses the app's shell and account menu (ADM-02)

**Current state:** practice pages use `components/shell/PracticeShell.tsx`, which passes `account: (mode) => <AccountMenu mode={mode} />` to the shared layout in `packages/ui`. `PlatformAdminLayout.tsx` (242 lines) builds its own `<aside>`, with a flat "Back to my practice" button in the nav and its own sign-out.

**Files:**
- Create: `apps/app/src/components/shell/AdminAccountMenu.tsx`: the same look and behaviour as `AccountMenu`. Its items are the signed-in admin's email and role, then **Back to my practice** (only when `profile.hasPractice`; calls `switchToPractice()` and shows a spinner), then **Sign out** (goes to `/admin/login`).
- Modify: `apps/app/src/pages/admin/PlatformAdminLayout.tsx`: render through the same layout component `PracticeShell` uses, passing admin nav items and `account: (mode) => <AdminAccountMenu mode={mode} />`. Delete the hand-built `<aside>`, the collapse button and the in-nav "Back to my practice".
- Test: `apps/app/src/components/__tests__/AdminAccountMenu.test.tsx`
- Modify: `apps/app/scripts/check-layout.mjs`: add `'/admin'` and `'/admin/invites'` to `REPORT`. The script logs in as a practice user, so add an admin login pass using `LAYOUT_ADMIN_EMAIL` (default `admin@unclutterdesk.com`) and `LAYOUT_ADMIN_PASSWORD` (default `password123`).

**Interfaces:**
- Consumes: `useAuth()` → `{ profile, logout, switchToPractice }`, where `profile.hasPractice: boolean`, `profile.email`, `profile.platformRole`. The layout component and its `SidebarMode` type come from `@unclutterdesk/ui`, exactly as `PracticeShell.tsx` imports them. Read `PracticeShell.tsx` first and use the same props.
- Produces: `export function AdminAccountMenu({ mode }: { mode: SidebarMode }): JSX.Element`.

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const switchToPractice = vi.fn().mockResolvedValue(undefined);
const logout = vi.fn().mockResolvedValue(undefined);
let hasPractice = true;
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ profile: { email: 'admin@unclutterdesk.com', platformRole: 'SUPER_ADMIN', hasPractice }, logout, switchToPractice }),
}));
const { AdminAccountMenu } = await import('../shell/AdminAccountMenu');

afterEach(() => {
  cleanup();
  hasPractice = true;
});

describe('AdminAccountMenu', () => {
  it('opens to Back to my practice and Sign out, like the practice menu', async () => {
    renderWithApp(<AdminAccountMenu mode="full" />);
    fireEvent.click(screen.getByRole('button', { name: /admin@unclutterdesk.com/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Back to my practice' }));
    await waitFor(() => expect(switchToPractice).toHaveBeenCalled());
  });

  it('leaves out Back to my practice for an admin with no practice', async () => {
    hasPractice = false;
    renderWithApp(<AdminAccountMenu mode="full" />);
    fireEvent.click(screen.getByRole('button', { name: /admin@unclutterdesk.com/ }));
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to my practice' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd apps/app && npx vitest run src/components/__tests__/AdminAccountMenu.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Copy `AccountMenu.tsx`'s structure (the outside-click close, `MENU_ITEM` style, and rail vs full layout) into `AdminAccountMenu.tsx`, with the admin items above. Then move `PlatformAdminLayout.tsx` onto the shared layout.

- [ ] **Step 4: Run tests, the layout check, and a browser pass**

Run: `cd apps/app && npx vitest run && npx tsc --noEmit -p . && npm run check:layout`
Expected: tests PASS. The layout check reports the admin routes with no sideways scroll. In the browser, compare `/admin` with `/dashboard` at 1280px, 1024px and 390px: the same sidebar, and the same menu position and behaviour.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/components/shell/AdminAccountMenu.tsx apps/app/src/components/__tests__/AdminAccountMenu.test.tsx apps/app/src/pages/admin/PlatformAdminLayout.tsx apps/app/scripts/check-layout.mjs
git commit -m "The admin console uses the app's sidebar and account menu"
```

---

## Wave 2: needs a decision first

Each task begins with a **Decide** step. Put the questions to the product owner, and record the answers under **Feedback / decision** in `docs/testing-feedback.md` before writing code. Where a task says **Spec first**, write `docs/superpowers/specs/2026-10-XX-<name>-design.md` and get it approved, then write a plan for it in the same format as Wave 1.

### Task 8: Say how client accounts work (BKG-04). Decided 30 Sep 2026

**Decision:** keep one account per client across practices. In a practice's booking page and portal, the client sees their sessions with that practice. Each practice sees only what concerns it. This is how the code already works (one `User` per email, one `Profile` per practice).

- [ ] **Step 1: Write the failing test.** In `apps/app/src/pages/__tests__/ClientAuthPanel.test.tsx`, add:

```tsx
it('explains that one account works everywhere and each practice sees only its own records', async () => {
  renderPanel(); // the helper already in this file
  expect(await screen.findByText('Use the same account with any practice on Unclutter Desk. Each practice only sees its own records.')).toBeTruthy();
});
```

- [ ] **Step 2:** Run `cd apps/app && npx vitest run src/pages/__tests__/ClientAuthPanel.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Add that sentence as a `<p className="text-[12px] text-[#64748B]">` under the sign-in and create-account forms in the client auth panel component the test renders.
- [ ] **Step 4:** Run the test again. Expected: PASS.
- [ ] **Step 5:** Also check `ClientPortal` pages load sessions scoped to the current practice. Every portal API call must filter by the request's tenant. Add an API spec asserting that the portal sessions query includes `tenantId`, then commit:

```bash
git commit -am "Clients are told one account works with every practice, and each sees only its own"
```

### Task 9: Booking as a step-by-step wizard (BKG-03, BKG-01). Approved 30 Sep 2026

**Decision:** four steps (service, time, your details, review and pay) and a confirmation screen. Intake and confidentiality forms come **after** booking (Task 11), shown on the confirmation screen.

- [ ] **Design:** share `docs/design/booking-wizard-design-prompt.md` with Claude Design. Save the returned designs under `docs/design/booking-wizard/`.
- [ ] **Spec:** from the approved designs, write `docs/superpowers/specs/2026-10-XX-booking-wizard-design.md`. It names the components (`BookingHeader`, `BookingProgress`, `ServiceStep`, `TimeStep`, `DetailsStep`, `ReviewPayStep`, `BookingConfirmation`, `BookingSummaryCard`, `StickyBookingFooter`), the wizard state and the URL (`?step=service|time|details|pay`), and which existing pieces are reused: `ClientAuthPanel`, the discount preview, the Paystack and bank-transfer calls, `PracticeLogo` (Task 4) and `channelLabel` (Task 6).
- [ ] **Plan:** write a plan in Wave 1's format, with one task per component, each tested through `renderWithApp` with the API faked. Add `/book` at all widths to `check-layout.mjs` as `STRICT`.
- Depends on Tasks 4, 6 and 11.

### Task 10: A guided walkthrough of the dashboard (ONB-06). Decided 30 Sep 2026

**Decision:** the setup wizard already works as the checklist. What's missing is a **walkthrough**: a guided tour that points at the real parts of the dashboard, one at a time, the first time a practice lands there after setup.

**Tour stops:** the anchors are `data-tour` attributes on the real elements.
1. `booking-link`: "This is your booking link. Share it with clients, or copy it here."
2. `nav-sessions`: "Every booking lands in Sessions. Open one to start the video call, take notes or mark it paid."
3. `nav-clients`: "Each client's history, forms and notes live here."
4. `nav-availability`: "Change your working hours, and whether each block is online or in person."
5. `nav-forms`: "Your intake and confidentiality forms. Edit the wording to suit your practice."
6. `nav-payouts`: "Where client payments go: Paystack, bank transfer, or both."
7. `account-menu`: "Your profile and settings. You can replay this tour from here."

**Files:**
- Create: `packages/ui/src/components/Tour/Tour.tsx`, a shared component. It finds each step's `[data-tour=…]` element, dims the page around it, and shows a popover with the step text, "2 of 7", Back, Next and Skip tour. It's keyboard-accessible (Esc skips, and focus moves into the popover), skips steps whose anchor isn't on screen (for example a nav item hidden at phone width), and scrolls the anchor into view.
- Create: `apps/app/src/components/onboarding/DashboardTour.tsx`, the steps above plus when to show them.
- Modify: `apps/app/src/components/shell/practiceNav.tsx`, `AccountMenu.tsx` and `DashboardPage.tsx` to add the `data-tour` anchors, and add a **Take the tour** item to `AccountMenu`.
- API: a new field `Profile.tourCompletedAt DateTime?` (with a migration) and `POST /v1/auth/me/tour-complete`. The field is returned on the profile, so the tour shows once per person, on any device, and not again after Skip or finish.
- Tests:
  - `packages/ui`: the Tour shows step 1's text next to its anchor, Next moves on, a missing anchor is skipped, and Esc ends the tour and calls `onDone`.
  - `apps/app`: after setup, with `tourCompletedAt: null`, the dashboard starts the tour; finishing calls `POST /v1/auth/me/tour-complete`; with a date set, no tour appears; **Take the tour** starts it again.
  - API: the endpoint sets `tourCompletedAt` for the caller's own profile only.
- Commit message: "A first-time walkthrough shows new practices around the dashboard".

### Task 11: Default intake and confidentiality forms, sent after booking (BKG-06). Decided 30 Sep 2026

**Decisions:** every practice gets both forms by default. **Practices can edit the wording.** Clients receive the forms **after booking**, to complete before the first session.

- [ ] **Templates:** write both forms' questions in `apps/api/src/modules/intake/default-forms.ts` as `CLIENT_INTAKE` and `CONFIDENTIALITY` schema arrays, and share them for a quick product read before coding.
  - **Intake:** preferred name, date of birth, phone, emergency contact name and phone, what brings you to therapy, previous therapy (yes/no, details), current medication, anything else, and consent to be contacted by phone or email.
  - **Confidentiality:** what is kept confidential; the limits (risk of serious harm to self or others, safeguarding, court order); how notes are stored; an "I have read and understood" checkbox; and a signature and date.
- [ ] **Editable system forms:** in `intake.service.ts`, add `export const EDITABLE_SYSTEM_KEYS = ['CLIENT_INTAKE', 'CONFIDENTIALITY']`. The lock at lines ~255–265 skips forms whose `systemKey` is in that list, so title, description and schema can be edited. PHQ-9 and GAD-7 stay locked. Test: editing `CLIENT_INTAKE`'s schema succeeds, and editing `PHQ_9`'s still throws.
- [ ] **Seed every practice:** `DefaultFormsService.ensureFor(tenantId)` creates any missing default forms, matched by `(tenantId, systemKey)`. It's called at the end of tenant creation. `scripts/backfill-default-forms.mjs` runs it for every existing practice. Tests: the first call creates both forms, the second changes nothing, and a practice's edited form is never overwritten.
- [ ] **Send after booking:** when a booking is confirmed (paid, or bank transfer marked paid), assign both active default forms to the client unless they've already submitted them for this practice. Email one "Before your first session" message listing the forms, with a link to each, through `NotificationService.sendEmail`. Tests: confirmation assigns both forms; a returning client who already submitted them gets nothing; a paused form isn't sent.
- [ ] **Show status:** the session page and client page show "Intake: done / waiting" and "Confidentiality: done / waiting". Test through `renderWithApp`.

### Task 12: Custom domains, end to end (SET-03)

**What exists:** the practice types a domain, the app shows a CNAME to `CUSTOM_DOMAIN_TARGET`, and Verify checks DNS and HTTPS. Nothing creates the hostname in Cloudflare for SaaS, so a certificate is never issued unless someone adds it by hand.

**Spec first.**
- [ ] **Decide:** is Cloudflare for SaaS the provider? This needs a Cloudflare zone ID and an API token with *SSL and Certificates: Edit*. Is the feature Pro-only, as the API enforces today?
- [ ] Spec a `CustomHostnameService` (create, get status, delete through the Cloudflare `custom_hostnames` API) behind an interface, so tests fake only the HTTP client. It needs:
  - an **Add domain** flow that creates the hostname and stores its Cloudflare ID;
  - a DNS card listing each record to add (the CNAME, plus the TXT for domain control validation if Cloudflare returns one), with copy buttons;
  - a status poller that marks the domain ACTIVE when Cloudflare says so, plus a manual Check now;
  - **Remove domain**, which deletes it at Cloudflare;
  - "auto-configure" limited to showing the provider-specific steps for Cloudflare, GoDaddy and Namecheap. Changing someone else's DNS on their behalf is out of scope.
- [ ] Plan and build from the spec.

### Task 13: Forms saved as templates, optionally shared (FRM-01)

**Spec first.**
- [ ] **Decide:**
  - Is sharing platform-wide or invite-only?
  - Do shared templates need admin review before others see them? Recommended: yes, through the existing Requests queue.
  - Is the author credited?
- [ ] Spec a `FormTemplate` model (a copy of `schemaJson`, `title`, `description`, `authorTenantId`, `visibility: PRIVATE|PENDING|SHARED`, `approvedAt`), a **Save as template** action in `FormEditorPage`, a **Template library** tab in `FormsManagerPage`, and **Use template**, which copies the template into the practice's own `UniversalForm` so later edits never touch the original.
- [ ] Plan and build from the spec.

---

## Order and checkpoints

1. Tasks 1–4, the quick, visible bugs. Retest with the product owner, then mark `Done` in the sheet.
2. Tasks 5–6, session format, API first and then UI.
3. Task 7, the admin shell.
4. Tasks 8, 10 and 11 are decided (30 Sep 2026) and can start after Wave 1.
5. Task 9 waits for the designs from Claude Design (prompt: `docs/design/booking-wizard-design-prompt.md`).
6. Tasks 12 (custom domains) and 13 (shared templates) are still waiting on decisions.
