# Sheet Batch: Discounts, Portal and Booking Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close five items just logged in `docs/testing-feedback.md`: SET-09 (a discount can be turned off but never back on, edited or deleted), BKG-11 (the practice's booking link doesn't carry the new wizard design — too wide, no practice logo), BKG-12 (confirmation actions should share one row; the two calendar links become one dropdown), POR-01 (`/portal` 404s on the practice's own host and only works on app.unclutterdesk.com), POR-02 (the client portal should read like a dashboard).

**Architecture:** Three small, independent slices. (1) The discount module gains `isActive` in its update and a hard-delete route; the settings page gains turn-on, edit and delete on each row. (2) The public profile page adopts the wizard's look: `PracticeLogo` in the header and the wizard's 960px measure; the confirmation step gets one action row with a dropdown for the calendar options. (3) The client portal routes move into one shared fragment used by both the app tree and the practice-host tree (fixing the 404), and the portal page gains a metric-tile header row, a real logo and a two-column layout.

**Tech Stack:** NestJS + Prisma (no schema changes in this plan), React + Vite, Tailwind, `@unclutterdesk/ui` (`PracticeLogo` lives in the app, `MetricTile` in the UI package), vitest.

**Specs:** the SET-09, BKG-11, BKG-12, POR-01 and POR-02 entries in `docs/testing-feedback.md` (read them first).

## Global Constraints

- Work on `dev`. Never push `main` — a push to `main` deploys to production. Commit per task.
- Test-first, always: write the test, run it, watch it fail, implement, run it, watch it pass, commit.
- App tests render through `renderWithApp` (`apps/app/src/test/renderWithApp.tsx`) and fake **only** `../../utils/apiClient` (and `context/AuthContext` where a signed-in user is needed). Never mock `@unclutterdesk/ui`.
- jsdom has no `scrollIntoView` and no jest-dom matchers — assert with `.textContent`, `.getAttribute`, `toHaveAttribute` is NOT available; use plain DOM checks. Guard browser-only calls with `?.method?.()`.
- Run suites with `--maxWorkers=2 --minWorkers=1` (full-parallel runs out of memory on this machine).
  - App: `cd apps/app && npx vitest run --maxWorkers=2 --minWorkers=1`
  - API: `cd apps/api && npx vitest run --maxWorkers=2 --minWorkers=1`
  - UI: `cd packages/ui && npx vitest run`
  - Typecheck: `npx tsc --noEmit -p .` in `apps/api`, `apps/app`, `packages/ui`.
  - API build: `cd apps/api && NODE_OPTIONS=--max-old-space-size=8192 npx nest build`.
- No Prisma schema changes in this plan. No migrations.
- Copy: plain sentences. Times in WAT.
- Commit trailer: blank line, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Every new API route needs a `@Permissions(...)` decorator (the guard tests enforce it) and is staff-only here, so `client-surface.spec.ts` should not move.

---

### Task 1: The discount API can re-activate, edit fully, and delete (SET-09)

**Files:**
- Modify: `apps/api/src/modules/discount/discount.service.ts` (`updateDiscount`, new `deleteDiscount`)
- Modify: `apps/api/src/modules/discount/discount.controller.ts` (PATCH body type, new destroy route)
- Test: `apps/api/src/modules/discount/discount-manage.spec.ts` (create)

**Interfaces:**
- Produces:
  - `updateDiscount(tenantId: bigint, id: bigint, dto: { label?: string | null; maxUses?: number | null; expiresAt?: string | null; isActive?: boolean; discountType?: 'PERCENT' | 'FIXED'; discountPercent?: number; discountAmountKobo?: string }): Promise<DiscountView>` — any subset; `isActive: true` re-activates.
  - `deleteDiscount(tenantId: bigint, id: bigint): Promise<{ deleted: true }>` — hard delete, scoped to the caller's tenant; `NotFoundException` when the row isn't there. The code string lives on past bookings as plain text (`ConsultBooking.discountCodeUsed`), so removing the row never orphans anything.
  - Routes: `PATCH /v1/discount/:id` (extended body), `DELETE /v1/discount/:id/remove` (`practice.admin`, same guard pattern as its neighbours). `DELETE /v1/discount/:id` stays "deactivate" for compatibility.

- [ ] **Step 1: Write the failing spec**

```ts
// apps/api/src/modules/discount/discount-manage.spec.ts
import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DiscountService } from './discount.service';

/** SET-09: turning a code off was a one-way door. Editing and deleting were absent. */
const TENANT = 1n;

function make() {
  const prisma: any = {
    discountCode: {
      update: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 7n, tenantId: TENANT, code: 'SAVE10', usedCount: 1, ...data })),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn(),
    },
  };
  return { prisma, service: new DiscountService(prisma) };
}

describe('discount management', () => {
  it('re-activates a code through the update', async () => {
    const { prisma, service } = make();
    await service.updateDiscount(TENANT, 7n, { isActive: true });
    expect(prisma.discountCode.update.mock.calls[0][0]).toMatchObject({
      where: { id: 7n, tenantId: TENANT },
      data: { isActive: true },
    });
  });

  it('edits the amount and the limits together', async () => {
    const { prisma, service } = make();
    await service.updateDiscount(TENANT, 7n, { label: 'Friends', maxUses: 20, discountType: 'PERCENT', discountPercent: 15 });
    expect(prisma.discountCode.update.mock.calls[0][0].data).toMatchObject({ label: 'Friends', maxUses: 20, discountType: 'PERCENT', discountPercent: 15 });
  });

  it('deletes the row, scoped to the practice', async () => {
    const { prisma, service } = make();
    expect(await service.deleteDiscount(TENANT, 7n)).toEqual({ deleted: true });
    expect(prisma.discountCode.deleteMany.mock.calls[0][0].where).toEqual({ id: 7n, tenantId: TENANT });
  });

  it('says not found when the code is not this practice’s', async () => {
    const { prisma, service } = make();
    prisma.discountCode.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.deleteDiscount(TENANT, 99n)).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

Check `updateDiscount`'s current `where` first (`grep -n "update({" apps/api/src/modules/discount/discount.service.ts`): today it updates by `where: { id, tenantId }` — if the current code uses a compound unique that differs, match the spec to the real `where` shape, keeping the tenant scoping.

- [ ] **Step 2: Run, to see it fail**

Run: `cd apps/api && npx vitest run src/modules/discount/discount-manage.spec.ts`
Expected: FAIL (`deleteDiscount` is not a function; `isActive` not in the data).

- [ ] **Step 3: Implement**

In `discount.service.ts`, extend `updateDiscount` and add `deleteDiscount`:

```ts
  async updateDiscount(tenantId: bigint, id: bigint, dto: {
    label?: string | null;
    maxUses?: number | null;
    expiresAt?: string | null;
    isActive?: boolean;
    discountType?: 'PERCENT' | 'FIXED';
    discountPercent?: number;
    discountAmountKobo?: string;
  }) {
    const discount = await this.prisma.discountCode.update({
      where: { id, tenantId },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.maxUses !== undefined ? { maxUses: dto.maxUses } : {}),
        ...(dto.expiresAt !== undefined ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.discountType !== undefined ? { discountType: dto.discountType } : {}),
        ...(dto.discountPercent !== undefined ? { discountPercent: dto.discountPercent } : {}),
        ...(dto.discountAmountKobo !== undefined ? { discountAmountKobo: BigInt(dto.discountAmountKobo) } : {}),
      },
    });
    return { ...discount, id: discount.id.toString(), discountAmountKobo: discount.discountAmountKobo?.toString() };
  }

  /** SET-09: remove a code for good. Past bookings keep the code text they used. */
  async deleteDiscount(tenantId: bigint, id: bigint) {
    const done = await this.prisma.discountCode.deleteMany({ where: { id, tenantId } });
    if (done.count === 0) throw new NotFoundException('Discount code not found');
    return { deleted: true };
  }
```

(Add `NotFoundException` to the `@nestjs/common` import if it isn't there. The old `updateDiscount` overwrote `label`/`maxUses`/`expiresAt` unconditionally — the spread version above fixes "edit one field, blank the others".)

In `discount.controller.ts`, after the existing `deactivateDiscount`:

```ts
  @Permissions('practice.admin')
  @Delete(':id/remove')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a discount code for good' })
  deleteDiscount(@Req() req: any, @Param('id') id: string) {
    return this.discountService.deleteDiscount(authenticatedTenantId(req), BigInt(id));
  }
```

- [ ] **Step 4: Run the discount + consult specs and typecheck**

Run: `cd apps/api && npx vitest run src/modules/discount src/modules/consult --maxWorkers=2 --minWorkers=1 && npx tsc --noEmit -p .`
Expected: PASS, 0 errors. (If `client-surface.spec.ts` or the route-enforcement check flags the new route, it's staff-only — add `@Permissions` correctly rather than to the client list.)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/discount
git commit -m "A discount code can be re-activated, edited and deleted for good"
```

---

### Task 2: The discounts page grows turn-on, edit and delete (SET-09)

**Files:**
- Modify: `apps/app/src/pages/practice/settings/DiscountSettingsPage.tsx`
- Test: `apps/app/src/pages/practice/settings/__tests__/DiscountSettingsPage.test.tsx` (create — check no sibling settings test uses a different mock path; copy the setup style of `BrandSettingsPage.test.tsx` in `apps/app/src/pages/__tests__/`)

**Interfaces:**
- Consumes: Task 1's `PATCH /v1/discount/:id` (with `isActive`, label, maxUses, expiresAt, discount amount) and `DELETE /v1/discount/:id/remove`.
- Produces: row actions — Active rows: **Turn off** (PATCH `{isActive:false}`), **Edit**, **Delete**; Inactive rows: **Turn on** (PATCH `{isActive:true}`), **Edit**, **Delete**. The create modal doubles as the edit modal (title "Edit Discount Code", code field disabled, PATCH on save). Delete asks with `window.confirm`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/app/src/pages/practice/settings/__tests__/DiscountSettingsPage.test.tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('../../../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../utils/apiClient')>();
  return {
    ...real,
    api: {
      get: (...a: unknown[]) => get(...a),
      post: (...a: unknown[]) => post(...a),
      patch: (...a: unknown[]) => patch(...a),
      delete: (...a: unknown[]) => del(...a),
    },
  };
});
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ profile: { id: '55', type: 'therapist', role: 'OWNER', tenantId: '27', tenantSlug: 'p', plan: 'PRO' }, refreshProfile: vi.fn() }),
}));
const { DiscountSettingsPage } = await import('../DiscountSettingsPage');

const CODES = [
  { id: '7', code: 'SAVE10', label: 'Friends', discountType: 'PERCENT', discountPercent: 10, discountAmountKobo: null, maxUses: 5, usedCount: 1, expiresAt: null, isActive: true, createdAt: '2026-09-01T00:00:00.000Z' },
  { id: '8', code: 'GONE', label: null, discountType: 'PERCENT', discountPercent: 5, discountAmountKobo: null, maxUses: null, usedCount: 0, expiresAt: null, isActive: false, createdAt: '2026-09-01T00:00:00.000Z' },
];

beforeEach(() => {
  get.mockReset(); post.mockReset(); patch.mockReset(); del.mockReset();
  get.mockResolvedValue(CODES);
  patch.mockImplementation(async (_p: string, body: unknown) => ({ ...CODES[0], ...(body as object) }));
  del.mockResolvedValue({ deleted: true });
});
afterEach(cleanup);

describe('discount row actions', () => {
  it('turns an inactive code back on', async () => {
    renderWithApp(<DiscountSettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /turn on gone/i }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/discount/8', expect.objectContaining({ isActive: true })));
  });

  it('turns an active code off through the update, not the old delete', async () => {
    renderWithApp(<DiscountSettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /turn off save10/i }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/discount/7', expect.objectContaining({ isActive: false })));
    expect(del).not.toHaveBeenCalled();
  });

  it('edits a code: the modal opens filled and saving patches the row', async () => {
    renderWithApp(<DiscountSettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /edit save10/i }));
    const label = await screen.findByLabelText(/label/i);
    expect((label as HTMLInputElement).value).toBe('Friends');
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/discount/7', expect.objectContaining({ label: 'Friends' })));
  });

  it('deletes after a confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithApp(<DiscountSettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /delete save10/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/v1/discount/7/remove'));
    confirmSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run, to see it fail**

Run: `cd apps/app && npx vitest run src/pages/practice/settings/__tests__/DiscountSettingsPage.test.tsx`
Expected: FAIL (no such buttons).

- [ ] **Step 3: Implement**

In `DiscountSettingsPage.tsx`:

1. Replace `handleToggleStatus` with a PATCH-based toggle and add delete + edit plumbing:

```tsx
  const [editing, setEditing] = useState<DiscountCode | null>(null);

  async function handleSetStatus(d: DiscountCode) {
    const next = !d.isActive;
    try {
      await api.patch(`/v1/discount/${d.id}`, { isActive: next });
      setDiscounts((current) => current.map((x) => (x.id === d.id ? { ...x, isActive: next } : x)));
      toast.success(next ? 'Discount code switched on' : 'Discount code switched off');
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : 'Could not change the code');
    }
  }

  async function handleDelete(d: DiscountCode) {
    if (!window.confirm(`Delete ${d.code}? Bookings that already used it keep their discount.`)) return;
    try {
      await api.delete(`/v1/discount/${d.id}/remove`);
      setDiscounts((current) => current.filter((x) => x.id !== d.id));
      toast.success('Discount code deleted');
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the code');
    }
  }

  function openEdit(d: DiscountCode) {
    setEditing(d);
    setFormCode(d.code);
    setFormLabel(d.label ?? '');
    setFormType(d.discountType as 'PERCENT' | 'FIXED');
    setFormPercent(d.discountPercent ? String(d.discountPercent) : '');
    setFormAmount(d.discountAmountKobo ? String(Number(d.discountAmountKobo) / 100) : '');
    setFormMaxUses(d.maxUses ? String(d.maxUses) : '');
    setFormExpiresAt(d.expiresAt ? d.expiresAt.slice(0, 10) : '');
    setShowModal(true);
  }
```

2. The row `actions` prop becomes (replacing the current active-only PowerOff block):

```tsx
              actions={(d) => (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => void handleSetStatus(d)}
                    className="text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer inline-flex p-1.5"
                    title={d.isActive ? 'Deactivate code' : 'Re-activate code'}
                    aria-label={`${d.isActive ? 'Turn off' : 'Turn on'} ${d.code}`}
                  >
                    <PowerOff className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openEdit(d)}
                    className="text-slate-400 hover:text-[#0F3A53] transition-colors cursor-pointer inline-flex p-1.5"
                    title="Edit code"
                    aria-label={`Edit ${d.code}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void handleDelete(d)}
                    className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer inline-flex p-1.5"
                    title="Delete code"
                    aria-label={`Delete ${d.code}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
```

(`Pencil`, `Trash2` from `lucide-react` — add to the existing import.)

3. The modal: when `editing` is set — title "Edit Discount Code", the **Code** input `disabled`, submit button text "Save changes", and the create handler PATCHes instead:

In `handleCreateDiscount`, before the `api.post` block:

```ts
      if (editing) {
        const body: any = {
          label: formLabel || null,
          maxUses: formMaxUses ? parseInt(formMaxUses, 10) : null,
          expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
          discountType: formType,
        };
        if (formType === 'PERCENT') body.discountPercent = parseInt(formPercent, 10);
        else body.discountAmountKobo = (parseInt(formAmount, 10) * 100).toString();
        const updated = await api.patch<DiscountCode>(`/v1/discount/${editing.id}`, body);
        setDiscounts((current) => current.map((d) => (d.id === editing.id ? { ...d, ...updated } : d)));
        setShowModal(false);
        setEditing(null);
        toast.success('Discount code updated');
        return;
      }
```

(put it inside the existing `try`, and clear `editing` in the modal's close/cancel handler and after create.) The modal header title and the submit label switch on `editing`: `{editing ? 'Edit Discount Code' : 'Create Discount Code'}` and `{editing ? 'Save changes' : 'Create code'}` — match the current button's actual text and adapt.

- [ ] **Step 4: Run the page test + full app suite + typecheck**

Run: `cd apps/app && npx vitest run src/pages/practice/settings/__tests__/DiscountSettingsPage.test.tsx && npx tsc --noEmit -p .`
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/practice/settings
git commit -m "Discounts can be switched back on, edited and deleted from the list"
```

---

### Task 3: The practice profile page carries the wizard's look (BKG-11)

**Files:**
- Modify: `apps/app/src/pages/public/PublicProfilePage.tsx`
- Test: `apps/app/src/pages/__tests__/PublicProfilePage.test.tsx` (extend — it already mocks `apiClient` with `apiGet`, `APP_BASE_URL`, `getSubdomainTenantSlug`)

**Interfaces:**
- Consumes: `PracticeLogo` from `../../components/public/PracticeLogo` (props `{ name, logoUrl?, size?, color? }`; renders `<img alt="{name} logo">` or an initials tile). `tenant.logoUrl` is already in the `/v1/tenant/public/info` (or `/v1/tenant/public/...`) payload — the page's `PublicTenantInfo` type: add `logoUrl?: string | null` if missing.
- Produces: header shows the practice's logo + name (like the wizard's `BookingShell` header) instead of the bare Unclutter Desk mark; the page's content measure drops from 1320px to the wizard's 960px.

- [ ] **Step 1: Write the failing test** — append to `PublicProfilePage.test.tsx`:

```tsx
  it('shows the practice logo in the header and keeps the wizard’s narrow measure', async () => {
    getSubdomainTenantSlug.mockReturnValue('demo');
    apiGet.mockImplementation((path: string) => {
      if (path.includes('/tenant/public')) {
        return Promise.resolve({
          id: '1', name: 'Demo Practice', slug: 'demo',
          primaryColor: '#0F3A53', secondaryColor: '#E3B341',
          logoUrl: 'https://cdn.example.com/logo.png',
        });
      }
      return Promise.resolve([]);
    });
    renderPage();
    const logo = await screen.findByAltText('Demo Practice logo');
    expect(logo.getAttribute('src')).toBe('https://cdn.example.com/logo.png');
    // The platform mark is no longer the header's identity.
    expect(document.querySelector('img[src="/unclutterdesk-mark.svg"]')).toBeNull();
    // Nothing on the page stretches to the old 1320px measure.
    expect(document.body.innerHTML).not.toContain('max-w-[1320px]');
  });
```

(Use whatever the file's existing mock helper names are — `apiGet`/`renderPage` as above; check the real tenant-info path with `grep -n "tenantInfoPath" apps/app/src/pages/public/PublicProfilePage.tsx` and mirror it.)

- [ ] **Step 2: Run, to see it fail**

Run: `cd apps/app && npx vitest run src/pages/__tests__/PublicProfilePage.test.tsx`
Expected: FAIL (no such alt text; mark present; 1320px classes present).

- [ ] **Step 3: Implement**

In `PublicProfilePage.tsx`:

1. Import: `import { PracticeLogo } from '../../components/public/PracticeLogo';` and add `logoUrl?: string | null;` to the `PublicTenantInfo` tenant type (wherever it's declared in this file).
2. Header — replace the `<img src="/unclutterdesk-mark.svg" .../>` block with:

```tsx
        <div className="flex items-center gap-2.5 min-w-0">
          <PracticeLogo name={practiceName || 'Unclutter Desk'} logoUrl={tenant?.logoUrl} size={34} color={primaryColor} />
          <span className="text-[15px] font-bold tracking-[-0.01em] text-[#0F172A] truncate">{practiceName || 'Unclutter Desk'}</span>
        </div>
```

3. Width: replace every `max-w-[1320px]` in the file with `max-w-[960px]` (there are three: the hero section, the services grid wrapper, and the extra section — `grep -c "max-w-\[1320px\]"` should reach 0).

- [ ] **Step 4: Run the test + full app suite**

Run: `cd apps/app && npx vitest run src/pages/__tests__/PublicProfilePage.test.tsx && npx tsc --noEmit -p .`
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/public/PublicProfilePage.tsx apps/app/src/pages/__tests__/PublicProfilePage.test.tsx
git commit -m "The practice profile page carries the wizard's logo and width"
```

---

### Task 4: One action row on the confirmation, with a calendar dropdown (BKG-12)

**Files:**
- Modify: `apps/app/src/pages/public/booking/ConfirmationStep.tsx`
- Test: `apps/app/src/pages/public/booking/__tests__/ConfirmationStep.test.tsx` (extend)

**Interfaces:**
- Produces: a single action row containing **Go to my bookings** (primary, `href="/portal"`) and a **Add to calendar ▾** dropdown button whose menu holds the two existing options: the `.ics` download link and the Google Calendar link. The dropdown is a local component `CalendarMenu` in the same file: a `<button aria-expanded aria-haspopup="menu">` and a `<div role="menu">` with the two links; closes on click-away and Escape.

- [ ] **Step 1: Write the failing test** — replace the BKG-10 test added earlier and add the dropdown test:

```tsx
  it('puts the portal and the calendar menu on one row', () => {
    renderWithApp(<ConfirmationStep booking={booking} channel="VIDEO" mode="paid" apiBase="https://api.x" />);
    const portal = screen.getByRole('link', { name: /Go to my bookings/ });
    const menuButton = screen.getByRole('button', { name: /Add to calendar/ });
    expect(portal.parentElement).toBe(menuButton.parentElement);
    expect(screen.getByText(/reschedule, cancel, pay or fill in your forms/i)).toBeTruthy();
  });

  it('the calendar button opens the two calendar options', () => {
    renderWithApp(<ConfirmationStep booking={booking} channel="VIDEO" mode="paid" apiBase="https://api.x" />);
    expect(screen.queryByRole('link', { name: /Google Calendar/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/ }));
    const menu = screen.getByRole('menu');
    expect(menu.textContent).toContain('Download (.ics)');
    expect((screen.getByRole('menuitem', { name: /Google Calendar/ }) as HTMLAnchorElement).getAttribute('href')).toContain('calendar.google.com');
    expect((screen.getByRole('menuitem', { name: /Download \(.ics\)/ }) as HTMLAnchorElement).getAttribute('href')).toContain('/ical?token=tok');
  });
```

Also fix the older test that asserted `getByRole('link', { name: /Add to calendar/ })` directly — that link is now behind the dropdown; update it to click the button first and read the menuitem's href.

- [ ] **Step 2: Run, to see it fail**

Run: `cd apps/app && npx vitest run src/pages/public/booking/__tests__/ConfirmationStep.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `ConfirmationStep.tsx` add (imports: `ChevronDown` from lucide; `useRef` already? add `useEffect, useRef` to the React import):

```tsx
function CalendarMenu({ icsHref, googleHref }: { icsHref: string; googleHref: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const item = 'w-full text-left px-3.5 py-2.5 text-[13.5px] font-semibold text-[#0F172A] hover:bg-[#F1F5F9] block';
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="h-11 px-5 rounded-[14px] border border-[#CBD5E1] bg-white text-[14px] font-semibold text-[#0F172A] inline-flex items-center gap-2 cursor-pointer"
      >
        <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add to calendar
        <ChevronDown className={`h-4 w-4 text-[#64748B] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" className="absolute left-0 bottom-full mb-2 w-[240px] rounded-[14px] border border-[#E2E8F0] bg-white shadow-xl py-1.5 z-20">
          <a role="menuitem" className={item} href={icsHref} download>Download (.ics)</a>
          <a role="menuitem" className={item} href={googleHref} target="_blank" rel="noreferrer">Google Calendar</a>
        </div>
      ) : null}
    </div>
  );
}
```

Then in the card's action block: replace the current row of `<a …>Add to calendar</a>` + `<a …>Google Calendar</a>` and the separate portal `<a>` above it with ONE row:

```tsx
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/portal"
              className="h-11 px-5 rounded-[14px] text-[14px] font-semibold inline-flex items-center justify-center gap-2"
              style={{ background: 'var(--brand-primary, #0F3A53)', color: '#FFFFFF' }}
            >
              <Check className="h-4 w-4" aria-hidden="true" /> Go to my bookings
            </a>
            <CalendarMenu
              icsHref={`${apiBase}/v1/calendar/bookings/${booking.bookingId}/ical?token=${booking.icalToken ?? ''}`}
              googleHref={googleCalendarUrl(booking)}
            />
          </div>
          <p className="text-[13px] text-[#64748B]">Manage your booking any time: reschedule, cancel, pay or fill in your forms.</p>
```

(Keep the online video note paragraph as it is.)

- [ ] **Step 4: Run the booking tests + typecheck**

Run: `cd apps/app && npx vitest run src/pages/public/booking && npx tsc --noEmit -p .`
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/public/booking
git commit -m "The confirmation's actions share one row, with the calendar choices in a dropdown"
```

---

### Task 5: The client portal works on the practice's own host (POR-01)

**Files:**
- Create: `apps/app/src/routes/clientRoutes.tsx`
- Modify: `apps/app/src/App.tsx` (use the shared routes in the fullscreen tree AND the booking tree)
- Test: `apps/app/src/routes/clientRoutes.test.tsx`

**Interfaces:**
- Produces: `CLIENT_PORTAL_ROUTES: React.ReactElement` — a fragment of `<Route>` elements (`/portal` → `ClientPortalPage`, `/portal/assessments/:id` → `PortalAssessmentPage`, `/forms/:id` → `ClientFormPage`, `/login` → `LoginPage`, `/set-password` → `SetPasswordPage`) rendered inside `<Routes>` by both trees. The tenant resolves from the host: `TENANT_SLUG` already comes from the subdomain (`apiClient.ts:65`), and the session cookie is on the api host — so the same pages work on any practice subdomain.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/app/src/routes/clientRoutes.test.tsx
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

const get = vi.fn();
vi.mock('../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (...a: unknown[]) => get(...a) }, getAppType: () => 'booking', getSubdomainTenantSlug: () => 'demo', TENANT_SLUG: 'demo' };
});
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ profile: null, isAuthenticated: false, isLoading: false, refreshProfile: vi.fn(), logout: vi.fn() }),
}));
import { CLIENT_PORTAL_ROUTES } from './clientRoutes';

// The routes must be usable on the practice host: the same fragment renders
// /portal and /login whether the tree is the app's or the booking host's.
it('serves the client portal on a practice host', async () => {
  get.mockImplementation((p: string) => {
    if (p.includes('consult/portal')) return Promise.resolve({ clientName: '', upcoming: [], past: [] });
    if (p.includes('intake/public/forms')) return Promise.resolve([]);
    return Promise.resolve({});
  });
  render(
    <MemoryRouter initialEntries={['/portal']}>
      <Routes>{CLIENT_PORTAL_ROUTES}</Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText(/sign in to see your sessions/i)).toBeTruthy();
});

it('serves the client login on a practice host', async () => {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>{CLIENT_PORTAL_ROUTES}</Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('button', { name: /sign in/i })).toBeTruthy();
});
```

(The portal page may need `BrandProvider`/`ToastProvider` — if the direct render fails on a missing context, wrap in `renderWithApp`-style providers or import `BrandProvider`/`ToastProvider` from `@unclutterdesk/ui` here; do NOT import `renderWithApp` from pages' test utils if the path differs — check `apps/app/src/test/renderWithApp.tsx` and reuse it.)

- [ ] **Step 2: Run, to see it fail**

Run: `cd apps/app && npx vitest run src/routes/clientRoutes.test.tsx`
Expected: FAIL — module `./clientRoutes` not found.

- [ ] **Step 3: Implement**

```tsx
// apps/app/src/routes/clientRoutes.tsx
import React from 'react';
import { Route } from 'react-router-dom';
import { ClientPortalPage } from '../pages/client/ClientPortalPage';
import { PortalAssessmentPage } from '../pages/client/PortalAssessmentPage';
import { ClientFormPage } from '../pages/client/ClientFormPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { SetPasswordPage } from '../pages/public/SetPasswordPage';

/**
 * POR-01: clients arrive at the practice's own link (the confirmation email,
 * the portal button). These routes must exist on the practice host as well as
 * on app.unclutterdesk.com, so both trees render this one fragment.
 */
export const CLIENT_PORTAL_ROUTES = (
  <>
    <Route path="/portal" element={<ClientPortalPage />} />
    <Route path="/portal/assessments/:id" element={<PortalAssessmentPage />} />
    <Route path="/forms/:id" element={<ClientFormPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/set-password" element={<SetPasswordPage />} />
  </>
);
```

(Match the real export names/paths — check how `App.tsx` imports `ClientPortalPage`, `PortalAssessmentPage`, `LoginPage`, `SetPasswordPage` today; they are lazy-loaded in App.tsx. To keep the lazy loading, import the lazy components from a shared module instead of duplicating: move the five `lazy()` definitions into `clientRoutes.tsx` and have `App.tsx` import `CLIENT_PORTAL_ROUTES` and drop its own copies of those five. Keep every other lazy import in App.tsx untouched.)

In `App.tsx`:
1. Delete the five lazy consts now living in `clientRoutes.tsx` (only those five).
2. In the fullscreen tree, replace the five matching `<Route>` lines with `{CLIENT_PORTAL_ROUTES}`.
3. In the booking tree (`appType === 'booking'` branch), add `{CLIENT_PORTAL_ROUTES}` before the catch-all `<Route path="*" …/>`. The booking tree already renders `/forms/:id`; the shared fragment replaces that line.

- [ ] **Step 4: Run the routing tests + full app suite + typecheck**

Run: `cd apps/app && npx vitest run src/routes && npx vitest run --maxWorkers=2 --minWorkers=1 && npx tsc --noEmit -p .`
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/routes apps/app/src/App.tsx
git commit -m "The client portal, forms and login work on a practice's own link, not just on the app host"
```

---

### Task 6: The portal reads like a dashboard (POR-02)

**Files:**
- Modify: `apps/app/src/pages/client/ClientPortalPage.tsx`
- Test: `apps/app/src/pages/__tests__/ClientPortalPayments.test.tsx` (extend — it already renders the portal with faked apiClient; reuse its payload helpers)

**Interfaces:**
- Consumes: `MetricTile` from `@unclutterdesk/ui` (`{ value, label, className? }`), `PracticeLogo` (`{ name, logoUrl?, size?, color? }`). `useBrand()` config carries `logoUrl` (packages/ui BrandProvider type line ~8). Payments payload already has `outstandingKobo` and `payments[]`.
- Produces: under the greeting, a row of four `MetricTile`s — **Next session** (e.g. "Fri 2 Oct" or "None"), **Upcoming** (count), **To pay** (`₦…` from `outstandingKobo`, "—" while the payments call is in flight), **Forms to do** (count of `pendingForms` — see below) — and the header's initials square replaced by `PracticeLogo`. Upcoming/past session lists become a two-column grid at ≥1024px.

"Forms to do": the portal already fetches `/v1/intake/public/forms?targetType=REVIEW` for `hasReviewForm`; extend that load to also fetch `GET /v1/intake/mine/forms` (the BKG-06 endpoint returning the client's outstanding default forms) and count it. If that request fails, the tile shows "—", never an error state.

- [ ] **Step 1: Write the failing test** — append to `ClientPortalPayments.test.tsx` (reuse its existing mock + payload names):

```tsx
  it('leads with dashboard tiles: next session, upcoming, to pay, forms', async () => {
    // extend the file's existing portal payload: one upcoming CONFIRMED session
    // starting 2026-10-02, payments payload outstandingKobo '3500000',
    // /v1/intake/mine/forms -> two forms.
    renderWithApp(<ClientPortalPage />);
    expect(await screen.findByText('Next session')).toBeTruthy();
    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(screen.getByText('To pay')).toBeTruthy();
    expect(screen.getByText('Forms to do')).toBeTruthy();
    expect(screen.getByText('₦35,000')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // forms count
  });

  it('shows the practice logo in the header when the brand has one', async () => {
    renderWithApp(<ClientPortalPage />, { brand: { name: 'Smith Therapy', logoUrl: 'https://cdn/x.png' } as any });
    expect(await screen.findByAltText('Smith Therapy logo')).toBeTruthy();
  });
```

(Adapt to the file's real helper names and its `renderWithApp` import path; the payments fetch may need the tab state — read the existing tests and mirror how they seed `payments`. If the current design only loads payments on the payments tab, move the payments fetch to mount so the tile has data — that is part of this task.)

- [ ] **Step 2: Run, to see it fail**

Run: `cd apps/app && npx vitest run src/pages/__tests__/ClientPortalPayments.test.tsx`
Expected: FAIL (no tiles).

- [ ] **Step 3: Implement**

In `ClientPortalPage.tsx`:

1. Import `MetricTile` (add to the `@unclutterdesk/ui` import) and `PracticeLogo`.
2. Header: replace the `initialsOf(brand.name, 'UD')` square with `<PracticeLogo name={brand.name || 'Unclutter Desk'} logoUrl={brand.logoUrl} size={34} color="#E3B341" />` — keep the brand name text.
3. Load on mount (next to the existing portal fetch):

```tsx
  const [mine, setMine] = useState<{ outstanding: number }>({ outstanding: 0 });
  useEffect(() => {
    api.get<Array<{ id: string }>>('/v1/intake/mine/forms').then((f) => setMine({ outstanding: f.length })).catch(() => undefined);
  }, []);
```

(and move the payments fetch to mount if it is tab-gated today, so `payments?.outstandingKobo` is available for the tile).

4. Tiles under the greeting:

```tsx
          <div className="grid grid-cols-2 min-[900px]:grid-cols-4 gap-3">
            <MetricTile
              value={nextSession ? formatDay(nextSession.startsAt) : 'None'}
              label="Next session"
            />
            <MetricTile value={String(portal.upcoming.filter((s) => s.status !== 'CANCELLED').length)} label="Upcoming" />
            <MetricTile value={payments ? `₦${(Number(payments.outstandingKobo) / 100).toLocaleString('en-NG')}` : '—'} label="To pay" />
            <MetricTile value={String(mine.outstanding)} label="Forms to do" />
          </div>
```

5. Two-column lists: where upcoming and past sessions render as stacked blocks, wrap them in `<div className="grid grid-cols-1 min-[1024px]:grid-cols-2 gap-5 items-start">` (keep the existing cards inside).
6. Keep every existing action (join, reschedule, cancel, pay, transfer details) exactly as it is — this task changes layout, not behavior.

- [ ] **Step 4: Run the portal tests + full app suite + typecheck**

Run: `cd apps/app && npx vitest run src/pages/__tests__/ClientPortalPayments.test.tsx && npx vitest run --maxWorkers=2 --minWorkers=1 && npx tsc --noEmit -p .`
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/client/ClientPortalPage.tsx apps/app/src/pages/__tests__/ClientPortalPayments.test.tsx
git commit -m "The client portal leads with dashboard tiles and the practice's logo"
```

---

### Task 7: Everything green, browser check, sheet, push

- [ ] **Step 1:** Full verification: API suite + `nest build`, app suite, UI suite, typechecks in all three packages. Fix anything red before continuing.
- [ ] **Step 2:** Start the servers (API `SMTP_HOST= SMTP_USER= SMTP_PASS= PORT=3099 node dist/src/main.js`; app `API_PROXY_TARGET=http://localhost:3099 npx vite --port 5173 --strictPort`). Browser checks:
  - `http://dr-smith.localhost:5173/` — practice logo in the header, content at the wizard's width, at 1280px and 390px.
  - Book a session, reach the confirmation: one action row, the calendar dropdown opens to the two options, "Go to my bookings" sits beside it.
  - `http://dr-smith.localhost:5173/portal` — the portal renders on the practice host (signed in as the client you just booked); tiles show next session / upcoming / to pay / forms.
  - As `dr.jane@smiththerapy.ng` on `app.localhost:5173` (or localhost): Settings → Discounts — turn a code off, back on, edit its label, delete it.
  - The staff app still works on the app host (`/portal` there too).
- [ ] **Step 3:** Update `docs/testing-feedback.md`: SET-09, BKG-11, BKG-12, POR-01, POR-02 → **Fixed**, with commit refs and one-line **Verified:** notes from Step 2. Commit: `Testing sheet: SET-09, BKG-11, BKG-12, POR-01 and POR-02 fixed`.
- [ ] **Step 4:** `git push origin dev`. Open a PR `dev → main` (never push main directly) and list any decisions the plan didn't cover.

## Review focus

1. Turning a discount off then on must not lose its label/maxUses/expiry (the PATCH spread in Task 1 is the fix for the old overwrite behavior — the spec covers it).
2. The booking host must not gain staff routes — only the five client routes in `CLIENT_PORTAL_ROUTES`.
3. Confirmation: the `.ics` href must keep the `token` query; the Google link keeps `target="_blank"`.
4. The portal tiles must never error-block the page: a failed `/v1/intake/mine/forms` or payments fetch shows "—"/0, not a broken page.
5. `PublicProfilePage` keeps its reviews, therapists and CTA working — only the header and the measure change.
