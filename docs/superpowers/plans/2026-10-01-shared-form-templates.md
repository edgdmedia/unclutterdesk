# Shared Form Templates Implementation Plan (FRM-01)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A practice can save any of its forms as a template and optionally share it. A super admin approves shared templates through the Requests queue, after which every practice sees them in a Template library. "Use template" gives a practice its own copy.

**Architecture:** A new `FormTemplate` model holds a frozen snapshot of a form (title, description, type and questions), so later edits to the source form never change the template. Sharing opens a `PlatformRequest` of type `TEMPLATE` linked to the template. The admin approves or declines from that request row, which sets both statuses together. The library lists the practice's own templates plus approved shared ones. Using one creates a normal `UniversalForm` through the existing `createCustomForm`.

**Tech Stack:** NestJS, Prisma (PostgreSQL), React, vitest.

**Spec:** `docs/testing-feedback.md` → FRM-01 (decision of 1 Oct 2026).

## Global Constraints

- **Visibility:** a shared template is visible to every practice **only after admin approval**. Pending and declined ones are visible only to the practice that shared them.
- **Credit:** "Shared by {practice name}" unless the author chose **Share anonymously**. Anonymous templates show "Shared by a practice". The admin always sees the real practice.
- **Copies:** using a template creates an independent copy in the practice's forms (`isDefault: false`, `isActive: true`, title unchanged). Editing a copy or the source form never changes the template; deleting a template never touches copies.
- **What's copied:** `title`, `description`, `targetType`, `schemaJson`. Never submissions, never `systemKey`, never review publication settings beyond defaults.
- **Who can act:** saving, sharing and using templates need `clinical.record` (the same as creating forms). Browsing the library needs `practice.staff`. Approving needs the platform admin guard (`PlatformAdminGuard`).
- Tests: the API specs use Prisma stand-ins (see `apps/api/src/modules/intake/intake.service.spec.ts`). App tests use `renderWithApp` and fake only `utils/apiClient` and `context/AuthContext`. Run suites with `--maxWorkers=2 --minWorkers=1`.
- Migrations are hand-written SQL. Never run `prisma format`.
- Every new route must be added to the reviewed list in `apps/api/src/client-surface.spec.ts` if that spec flags it. All tenant-scoped queries filter by `tenantId` (the tenant-isolation static check enforces it).

## Review Focus

1. **A practice tries to use another practice's pending or declined template by ID.** Expect 404.
2. **The source form is edited after it was saved as a template.** The template's questions don't change.
3. **The admin declines a template that a practice already copied** (from the period when it was briefly approved). Existing copies stay; the template leaves the library.
4. **An anonymous shared template.** The library response never contains the authoring practice's name or ID.
5. **The same form is saved as a template twice.** Two separate templates, each its own snapshot, with no unique-constraint crash.

---

## File Structure

- `prisma/schema.prisma`: new `FormTemplate`; `PlatformRequest.formTemplateId BigInt?`.
- `prisma/migrations/20261003100000_form_templates/migration.sql`.
- `apps/api/src/modules/intake/form-template.service.ts`: save, share, list library, use, and the admin approve and decline.
- `apps/api/src/modules/intake/intake.controller.ts`: practice routes.
- `apps/api/src/modules/admin/admin.controller.ts`: approve and decline routes.
- `apps/api/src/modules/requests/request.service.ts`: the `TEMPLATE` request type, and `formTemplateId` in shapes.
- `apps/app/src/pages/practice/settings/FormEditorPage.tsx`: the **Save as template** button and dialog.
- `apps/app/src/pages/practice/settings/FormTemplateLibrary.tsx` (new): the library panel.
- `apps/app/src/pages/practice/settings/FormsManagerPage.tsx`: shows the library.
- `apps/app/src/pages/admin/AdminRequestsPage.tsx`: preview, and Approve or Decline on `TEMPLATE` rows.

---

### Task 1: Data model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261003100000_form_templates/migration.sql`

**Interfaces:**
- Produces: the Prisma model `formTemplate` with the fields below, and `platformRequest.formTemplateId`.

- [ ] **Step 1: Add the model by hand** (after `model UniversalForm`):

```prisma
/// FRM-01: a frozen copy of a practice's form that can be reused, and shared
/// with every practice once a platform admin approves it.
model FormTemplate {
  id                 BigInt   @id @default(autoincrement())
  tenantId           BigInt
  sourceFormId       BigInt?
  createdByProfileId BigInt?
  title              String
  description        String?
  targetType         String   @default("INTAKE")
  schemaJson         Json
  /// "PRIVATE" (this practice only), "PENDING", "APPROVED", "DECLINED"
  shareStatus        String   @default("PRIVATE") @db.VarChar(20)
  anonymous          Boolean  @default(false)
  timesUsed          Int      @default(0)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([shareStatus])
}
```

Add `formTemplates FormTemplate[]` to `model Tenant`'s relation list. Add `formTemplateId BigInt?` to `PlatformRequest`, and update its `type` comment to include `"TEMPLATE"`.

```sql
-- prisma/migrations/20261003100000_form_templates/migration.sql
CREATE TABLE "FormTemplate" (
  "id" BIGSERIAL PRIMARY KEY,
  "tenantId" BIGINT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "sourceFormId" BIGINT,
  "createdByProfileId" BIGINT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "targetType" TEXT NOT NULL DEFAULT 'INTAKE',
  "schemaJson" JSONB NOT NULL,
  "shareStatus" VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
  "anonymous" BOOLEAN NOT NULL DEFAULT false,
  "timesUsed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "FormTemplate_tenantId_idx" ON "FormTemplate"("tenantId");
CREATE INDEX "FormTemplate_shareStatus_idx" ON "FormTemplate"("shareStatus");
ALTER TABLE "PlatformRequest" ADD COLUMN "formTemplateId" BIGINT;
```

(Check the `Tenant.id` column type in an earlier migration, e.g. `grep -rn 'CREATE TABLE "UniversalForm"' prisma/migrations`, and match it.)

- [ ] **Step 2: Apply and generate**

Run: `npx prisma migrate deploy && npx prisma generate`
Expected: "1 migration applied"; the client is generated.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261003100000_form_templates
git commit -m "FRM-01: form templates and their link to platform requests"
```

---

### Task 2: Template service (save, share, library, use)

**Files:**
- Create: `apps/api/src/modules/intake/form-template.service.ts`
- Modify: `apps/api/src/modules/intake/intake.module.ts` (provide it; import `RequestModule` or inject `PrismaService` and create the request row directly, whichever the module graph allows without a cycle)
- Modify: `apps/api/src/modules/intake/intake.controller.ts`
- Modify: `apps/api/src/modules/requests/request.service.ts` (`REQUEST_TYPES` gains `'TEMPLATE'`, `TYPE_LABEL.TEMPLATE = 'Form template'`; `shape` returns `formTemplateId`)
- Test: `apps/api/src/modules/intake/form-template.spec.ts`

**Interfaces:**
- Consumes: `IntakeService.createCustomForm(tenantId, dto)` and `IntakeService.getFormById(tenantId, formId)` (existing).
- Produces:
  - `FormTemplateService.saveFromForm(tenantId: bigint, profileId: bigint, formId: bigint, opts: { share: boolean; anonymous: boolean }): Promise<TemplateView>`
  - `FormTemplateService.library(tenantId: bigint): Promise<{ mine: TemplateView[]; shared: TemplateView[] }>`
  - `FormTemplateService.use(tenantId: bigint, templateId: bigint): Promise<{ formId: string }>`
  - `FormTemplateService.remove(tenantId: bigint, templateId: bigint): Promise<void>` (own templates only)
  - `FormTemplateService.review(templateId: bigint, decision: 'APPROVED' | 'DECLINED', note?: string): Promise<TemplateView>` (admin)
  - `type TemplateView = { id: string; title: string; description: string | null; targetType: string; questionCount: number; shareStatus: string; sharedBy: string | null; mine: boolean; timesUsed: number; schemaJson?: unknown }`
  - Routes:
    - `POST /v1/intake/forms/:formId/template` body `{ share?: boolean; anonymous?: boolean }`
    - `GET /v1/intake/templates`
    - `GET /v1/intake/templates/:id` (preview, with `schemaJson`)
    - `POST /v1/intake/templates/:id/use`
    - `DELETE /v1/intake/templates/:id`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/api/src/modules/intake/form-template.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { FormTemplateService } from './form-template.service';

const MINE = 1n;
const OTHER = 2n;
const questions = [{ id: 'q1', label: 'How are you sleeping?', type: 'text', required: true }];

function make(templates: any[] = []) {
  const prisma: any = {
    universalForm: { findFirst: vi.fn().mockResolvedValue({ id: 10n, tenantId: MINE, title: 'Sleep check', description: 'Short', targetType: 'INTAKE', schemaJson: questions }) },
    formTemplate: {
      create: vi.fn(async ({ data }: any) => ({ id: 50n, timesUsed: 0, ...data, tenant: { name: 'Calm Rooms' } })),
      findMany: vi.fn(async ({ where }: any) =>
        templates.filter((t) => (where.tenantId !== undefined ? t.tenantId === where.tenantId : t.shareStatus === where.shareStatus && t.tenantId !== where.NOT?.tenantId)),
      ),
      findFirst: vi.fn(async ({ where }: any) =>
        templates.find((t) => t.id === where.id && (where.OR ?? [where]).some((w: any) => (w.tenantId === undefined || w.tenantId === t.tenantId) && (w.shareStatus === undefined || w.shareStatus === t.shareStatus))) ?? null,
      ),
      update: vi.fn(async ({ data }: any) => ({ ...templates[0], ...data })),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    platformRequest: { create: vi.fn(), updateMany: vi.fn() },
    tenant: { findUnique: vi.fn().mockResolvedValue({ name: 'Calm Rooms' }) },
  };
  const intake: any = { createCustomForm: vi.fn().mockResolvedValue({ id: '77' }) };
  return { service: new FormTemplateService(prisma, intake), prisma, intake };
}

describe('form templates', () => {
  it('saves a frozen copy of the form, private by default', async () => {
    const { service, prisma } = make();
    const t = await service.saveFromForm(MINE, 9n, 10n, { share: false, anonymous: false });
    expect(prisma.formTemplate.create.mock.calls[0][0].data).toMatchObject({ tenantId: MINE, sourceFormId: 10n, title: 'Sleep check', schemaJson: questions, shareStatus: 'PRIVATE' });
    expect(prisma.platformRequest.create).not.toHaveBeenCalled();
    expect(t.questionCount).toBe(1);
  });

  it('sharing queues it for review as a TEMPLATE request', async () => {
    const { service, prisma } = make();
    await service.saveFromForm(MINE, 9n, 10n, { share: true, anonymous: true });
    expect(prisma.formTemplate.create.mock.calls[0][0].data).toMatchObject({ shareStatus: 'PENDING', anonymous: true });
    expect(prisma.platformRequest.create.mock.calls[0][0].data).toMatchObject({ tenantId: MINE, type: 'TEMPLATE', formTemplateId: 50n });
  });

  it("refuses to template another practice's form", async () => {
    const { service, prisma } = make();
    prisma.universalForm.findFirst.mockResolvedValue(null);
    await expect(service.saveFromForm(MINE, 9n, 999n, { share: false, anonymous: false })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.universalForm.findFirst.mock.calls[0][0].where).toMatchObject({ id: 999n, tenantId: MINE });
  });

  it('the library shows my templates and only approved shared ones, hiding anonymous authors', async () => {
    const { service } = make([
      { id: 1n, tenantId: MINE, title: 'Mine', shareStatus: 'PRIVATE', anonymous: false, schemaJson: questions, timesUsed: 0, tenant: { name: 'Calm Rooms' } },
      { id: 2n, tenantId: OTHER, title: 'Approved', shareStatus: 'APPROVED', anonymous: false, schemaJson: questions, timesUsed: 3, tenant: { name: 'Lekki Minds' } },
      { id: 3n, tenantId: OTHER, title: 'Anon', shareStatus: 'APPROVED', anonymous: true, schemaJson: questions, timesUsed: 0, tenant: { name: 'Secret Clinic' } },
      { id: 4n, tenantId: OTHER, title: 'Pending', shareStatus: 'PENDING', anonymous: false, schemaJson: questions, timesUsed: 0, tenant: { name: 'Lekki Minds' } },
    ]);
    const lib = await service.library(MINE);
    expect(lib.mine.map((t) => t.title)).toEqual(['Mine']);
    expect(lib.shared.map((t) => t.title)).toEqual(['Approved', 'Anon']);
    expect(lib.shared[0].sharedBy).toBe('Lekki Minds');
    expect(lib.shared[1].sharedBy).toBe('a practice');
    expect(JSON.stringify(lib)).not.toContain('Secret Clinic');
  });

  it('using an approved template creates my own copy', async () => {
    const { service, intake, prisma } = make([{ id: 2n, tenantId: OTHER, title: 'Approved', description: null, targetType: 'INTAKE', shareStatus: 'APPROVED', schemaJson: questions, timesUsed: 3 }]);
    await expect(service.use(MINE, 2n)).resolves.toEqual({ formId: '77' });
    expect(intake.createCustomForm).toHaveBeenCalledWith(MINE, expect.objectContaining({ title: 'Approved', schemaJson: questions, isDefault: false }));
    expect(prisma.formTemplate.update).toHaveBeenCalledWith(expect.objectContaining({ data: { timesUsed: { increment: 1 } } }));
  });

  it("can't use another practice's pending template", async () => {
    const { service } = make([{ id: 4n, tenantId: OTHER, shareStatus: 'PENDING', schemaJson: questions }]);
    await expect(service.use(MINE, 4n)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('admin review sets the template and its request together', async () => {
    const { service, prisma } = make([{ id: 4n, tenantId: OTHER, shareStatus: 'PENDING', schemaJson: questions, tenant: { name: 'Lekki Minds' } }]);
    await service.review(4n, 'APPROVED');
    expect(prisma.formTemplate.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 4n }, data: { shareStatus: 'APPROVED' } }));
    expect(prisma.platformRequest.updateMany).toHaveBeenCalledWith({ where: { formTemplateId: 4n }, data: { status: 'DONE' } });
  });
});
```

- [ ] **Step 2: Run, to see it fail**

Run: `cd apps/api && npx vitest run src/modules/intake/form-template.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// apps/api/src/modules/intake/form-template.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IntakeService } from './intake.service';

export type TemplateView = {
  id: string; title: string; description: string | null; targetType: string; questionCount: number;
  shareStatus: string; sharedBy: string | null; mine: boolean; timesUsed: number; schemaJson?: unknown;
};

/**
 * FRM-01: practices reuse good forms. A template is a frozen copy; sharing it
 * puts it in front of every practice once a platform admin approves it.
 */
@Injectable()
export class FormTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intake: IntakeService,
  ) {}

  private view(t: any, tenantId: bigint | null, withSchema = false): TemplateView {
    const mine = tenantId !== null && t.tenantId === tenantId;
    return {
      id: t.id.toString(),
      title: t.title,
      description: t.description ?? null,
      targetType: t.targetType,
      questionCount: Array.isArray(t.schemaJson) ? t.schemaJson.length : 0,
      shareStatus: t.shareStatus,
      // Anonymous means anonymous: the name never leaves the server for other practices.
      sharedBy: mine ? null : t.anonymous ? 'a practice' : (t.tenant?.name ?? 'a practice'),
      mine,
      timesUsed: t.timesUsed ?? 0,
      ...(withSchema ? { schemaJson: t.schemaJson } : {}),
    };
  }

  async saveFromForm(tenantId: bigint, profileId: bigint, formId: bigint, opts: { share: boolean; anonymous: boolean }) {
    const form = await this.prisma.universalForm.findFirst({ where: { id: formId, tenantId } });
    if (!form) throw new NotFoundException('Form not found');
    if (!Array.isArray(form.schemaJson) || form.schemaJson.length === 0) {
      throw new BadRequestException('Add at least one question before saving this as a template.');
    }
    const t = await this.prisma.formTemplate.create({
      data: {
        tenantId,
        sourceFormId: form.id,
        createdByProfileId: profileId,
        title: form.title,
        description: form.description,
        targetType: form.targetType,
        schemaJson: form.schemaJson as any,
        shareStatus: opts.share ? 'PENDING' : 'PRIVATE',
        anonymous: !!opts.anonymous,
      },
      include: { tenant: { select: { name: true } } },
    });
    if (opts.share) {
      await this.prisma.platformRequest.create({
        data: { tenantId, requestedByProfileId: profileId, type: 'TEMPLATE', subject: `Share form template: ${form.title}`.slice(0, 160), formTemplateId: t.id },
      });
    }
    return this.view(t, tenantId);
  }

  async library(tenantId: bigint) {
    const include = { tenant: { select: { name: true } } };
    const [mine, shared] = await Promise.all([
      this.prisma.formTemplate.findMany({ where: { tenantId }, include, orderBy: { createdAt: 'desc' } }),
      this.prisma.formTemplate.findMany({ where: { shareStatus: 'APPROVED', NOT: { tenantId } }, include, orderBy: { timesUsed: 'desc' } }),
    ]);
    return { mine: mine.map((t) => this.view(t, tenantId)), shared: shared.map((t) => this.view(t, tenantId)) };
  }

  /** Mine in any state, or anyone's once approved. */
  private visible(tenantId: bigint, id: bigint) {
    return this.prisma.formTemplate.findFirst({
      where: { id, OR: [{ tenantId }, { shareStatus: 'APPROVED' }] },
      include: { tenant: { select: { name: true } } },
    });
  }

  async preview(tenantId: bigint, id: bigint) {
    const t = await this.visible(tenantId, id);
    if (!t) throw new NotFoundException('Template not found');
    return this.view(t, tenantId, true);
  }

  async use(tenantId: bigint, id: bigint) {
    const t = await this.visible(tenantId, id);
    if (!t) throw new NotFoundException('Template not found');
    const form = await this.intake.createCustomForm(tenantId, {
      title: t.title,
      description: t.description ?? undefined,
      targetType: t.targetType,
      schemaJson: t.schemaJson as any[],
      isDefault: false,
    });
    await this.prisma.formTemplate.update({ where: { id: t.id }, data: { timesUsed: { increment: 1 } } });
    return { formId: String((form as any).id) };
  }

  async remove(tenantId: bigint, id: bigint) {
    const done = await this.prisma.formTemplate.deleteMany({ where: { id, tenantId } });
    if (done.count === 0) throw new NotFoundException('Template not found');
    await this.prisma.platformRequest.updateMany({ where: { formTemplateId: id, status: 'OPEN' }, data: { status: 'DECLINED', adminNote: 'Withdrawn by the practice.' } });
  }

  /** Platform admin only (guarded at the controller). */
  async review(id: bigint, decision: 'APPROVED' | 'DECLINED', note?: string) {
    const t = await this.prisma.formTemplate.update({ where: { id }, data: { shareStatus: decision } });
    await this.prisma.platformRequest.updateMany({
      where: { formTemplateId: id },
      data: { status: decision === 'APPROVED' ? 'DONE' : 'DECLINED', ...(note ? { adminNote: note } : {}) },
    });
    return this.view(t, null);
  }
}
```

(If the spec's `review` assertion on `formTemplate.update` data fails because of `note`, keep the data exactly `{ shareStatus: decision }` as shown.)

Controller routes in `intake.controller.ts`, following the existing decorator pattern (`@Permissions(...)`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `authenticatedTenantId(req)`, `authenticatedProfileId(req)`):

```ts
  @Permissions('clinical.record')
  @Post('forms/:formId/template')
  saveTemplate(@Req() req: any, @Param('formId') formId: string, @Body() dto: { share?: boolean; anonymous?: boolean }) {
    return this.templates.saveFromForm(authenticatedTenantId(req), authenticatedProfileId(req), BigInt(formId), { share: !!dto?.share, anonymous: !!dto?.anonymous });
  }

  @Permissions('practice.staff')
  @Get('templates')
  templateLibrary(@Req() req: any) {
    return this.templates.library(authenticatedTenantId(req));
  }

  @Permissions('practice.staff')
  @Get('templates/:id')
  templatePreview(@Req() req: any, @Param('id') id: string) {
    return this.templates.preview(authenticatedTenantId(req), BigInt(id));
  }

  @Permissions('clinical.record')
  @Post('templates/:id/use')
  useTemplate(@Req() req: any, @Param('id') id: string) {
    return this.templates.use(authenticatedTenantId(req), BigInt(id));
  }

  @Permissions('clinical.record')
  @Delete('templates/:id')
  removeTemplate(@Req() req: any, @Param('id') id: string) {
    return this.templates.remove(authenticatedTenantId(req), BigInt(id));
  }
```

Wrap `BigInt(...)` the way neighbouring routes do (they may use a helper that turns bad IDs into 400). In `request.service.ts`, add `'TEMPLATE'` to `REQUEST_TYPES` and `TEMPLATE: 'Form template'` to `TYPE_LABEL`. Make `shape` include `formTemplateId: r.formTemplateId?.toString() ?? null`, widening the parameter type. Practices must not be able to create `TEMPLATE` requests through the generic `POST /v1/requests`: in `create`, reject `type === 'TEMPLATE'` with "Share a template from the form editor.", and add a test for it in `request.service.spec.ts`.

- [ ] **Step 4: Run the intake and requests specs, plus the surface and isolation checks**

Run: `cd apps/api && npx vitest run src/modules/intake src/modules/requests src/client-surface.spec.ts --maxWorkers=2 --minWorkers=1`
Expected: PASS. If `client-surface.spec.ts` lists the new routes as unreviewed, add them to its reviewed list.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/intake apps/api/src/modules/requests apps/api/src/client-surface.spec.ts
git commit -m "FRM-01: save forms as templates, share them for review, and use approved ones"
```

---

### Task 3: Admin approve and decline

**Files:**
- Modify: `apps/api/src/modules/admin/admin.controller.ts` (next to `@Patch('requests/:id')`, line ~130)
- Modify: `apps/api/src/modules/admin/admin.module.ts` (import `IntakeModule`, and make `IntakeModule` export `FormTemplateService`)
- Test: `apps/api/src/modules/admin/admin-templates.spec.ts`

**Interfaces:**
- Consumes: `FormTemplateService.review`, `FormTemplateService.preview` (Task 2; for the admin, the preview uses a new `adminPreview(id)` that ignores tenant and returns the real practice name).
- Produces:
  - `GET /v1/admin/templates/:id` → `TemplateView & { practiceName: string; schemaJson }`
  - `POST /v1/admin/templates/:id/review` body `{ decision: 'APPROVED' | 'DECLINED'; note?: string }`

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/admin/admin-templates.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AdminController } from './admin.controller';

describe('admin template review', () => {
  it('passes approve and decline through, and rejects anything else', async () => {
    const templates: any = { review: vi.fn().mockResolvedValue({ id: '4' }), adminPreview: vi.fn() };
    const controller: any = Object.assign(Object.create(AdminController.prototype), { templates });
    await controller.reviewTemplate('4', { decision: 'APPROVED' });
    expect(templates.review).toHaveBeenCalledWith(4n, 'APPROVED', undefined);
    await expect(controller.reviewTemplate('4', { decision: 'MAYBE' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

(This tests only the controller's input handling. The guard is the existing `PlatformAdminGuard`, applied the same way as on the requests route.)

- [ ] **Step 2: Run, to see it fail**

Run: `cd apps/api && npx vitest run src/modules/admin/admin-templates.spec.ts`
Expected: FAIL (`reviewTemplate` is not a function)

- [ ] **Step 3: Implement**

```ts
  @UseGuards(PlatformAdminGuard)
  @Get('templates/:id')
  templatePreview(@Param('id') id: string) {
    return this.templates.adminPreview(BigInt(id));
  }

  @UseGuards(PlatformAdminGuard)
  @Post('templates/:id/review')
  async reviewTemplate(@Param('id') id: string, @Body() dto: { decision?: string; note?: string }) {
    if (dto?.decision !== 'APPROVED' && dto?.decision !== 'DECLINED') throw new BadRequestException('Approve or decline.');
    return this.templates.review(BigInt(id), dto.decision, dto.note?.trim() || undefined);
  }
```

Inject `private readonly templates: FormTemplateService` into `AdminController` (add it as the last constructor parameter). Add to `FormTemplateService`:

```ts
  async adminPreview(id: bigint) {
    const t = await this.prisma.formTemplate.findUnique({ where: { id }, include: { tenant: { select: { name: true } } } });
    if (!t) throw new NotFoundException('Template not found');
    return { ...this.view(t, null, true), practiceName: t.tenant?.name ?? '' };
  }
```

- [ ] **Step 4: Run the API suite**

Run: `cd apps/api && npx tsc --noEmit -p . && npx vitest run --maxWorkers=2 --minWorkers=1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/admin apps/api/src/modules/intake
git commit -m "FRM-01: platform admins preview, approve and decline shared templates"
```

---

### Task 4: Practice UI: Save as template, and the Template library

**Files:**
- Modify: `apps/app/src/pages/practice/settings/FormEditorPage.tsx`
- Create: `apps/app/src/pages/practice/settings/FormTemplateLibrary.tsx`
- Modify: `apps/app/src/pages/practice/settings/FormsManagerPage.tsx`
- Test: `apps/app/src/pages/practice/settings/__tests__/FormTemplates.test.tsx`

**Interfaces:**
- Consumes: the Task 2 routes and `TemplateView`.
- Produces: `FormTemplateLibrary({ onUsed }: { onUsed: (formId: string) => void })`.

UI:
- **Form editor** (saved, non-system forms only): a secondary **Save as template** button beside Save. It opens a small dialog (use the dialog or modal pattern already in `packages/ui` or this page) with:
  - a checkbox "Share with other practices on Unclutter Desk (reviewed by our team first)";
  - when ticked, a second checkbox "Share anonymously";
  - the button **Save template**.
  - Toasts: private → "Saved to your templates."; shared → "Saved. We'll review it before other practices can use it."
- **Forms manager:** a section headed (`Eyebrow`) **TEMPLATE LIBRARY**, with two lists:
  - **Your templates:** each row shows the title, the question count and a status chip ("Private", "In review", "Shared", "Not approved"), plus **Use** and **Delete**.
  - **From other practices:** each row shows the title, "Shared by {sharedBy}", the question count and "Used {n} times", plus **Preview** (a dialog listing the questions) and **Use**.
- **Use** posts `/use`, toasts "Added to your forms.", and navigates to the new form's editor (`/settings/forms/{formId}`; check the route the manager uses for editing and match it).
- Empty states:
  - "Save a form as a template to reuse it."
  - "No shared templates yet."
- Use `packages/ui` components (`Button`, `Card`, `Eyebrow`) and the page's existing tokens. Layout must work at 390px.

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/app/src/pages/practice/settings/__tests__/FormTemplates.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithApp } from '../../../../test/renderWithApp';
import { api } from '../../../../utils/apiClient';
import { FormTemplateLibrary } from '../FormTemplateLibrary';

vi.mock('../../../../utils/apiClient');
vi.mock('../../../../context/AuthContext');

const lib = {
  mine: [{ id: '1', title: 'Sleep check', description: null, targetType: 'INTAKE', questionCount: 3, shareStatus: 'PENDING', sharedBy: null, mine: true, timesUsed: 0 }],
  shared: [{ id: '2', title: 'GAD-7 intake', description: null, targetType: 'INTAKE', questionCount: 7, shareStatus: 'APPROVED', sharedBy: 'Lekki Minds', mine: false, timesUsed: 4 }],
};

describe('Template library', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue(lib as any);
    vi.mocked(api.post).mockResolvedValue({ formId: '77' } as any);
  });

  it("lists my templates with their review status and others' with credit", async () => {
    renderWithApp(<FormTemplateLibrary onUsed={vi.fn()} />);
    expect(await screen.findByText('Sleep check')).toBeInTheDocument();
    expect(screen.getByText('In review')).toBeInTheDocument();
    expect(screen.getByText(/shared by lekki minds/i)).toBeInTheDocument();
  });

  it('using a shared template makes my own copy', async () => {
    const onUsed = vi.fn();
    renderWithApp(<FormTemplateLibrary onUsed={onUsed} />);
    const row = (await screen.findByText('GAD-7 intake')).closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: /use/i }));
    expect(api.post).toHaveBeenCalledWith('/v1/intake/templates/2/use', {});
    expect(onUsed).toHaveBeenCalledWith('77');
  });
});
```

Add a test to the form editor's existing test file (or a new `FormEditorTemplate.test.tsx`): opening **Save as template**, ticking share and anonymous, and saving posts `/v1/intake/forms/10/template` with `{ share: true, anonymous: true }`. Match the mock paths and `renderWithApp` import to a neighbouring settings test.

- [ ] **Step 2: Run, to see them fail**

Run: `cd apps/app && npx vitest run src/pages/practice/settings`
Expected: FAIL

- [ ] **Step 3: Implement** `FormTemplateLibrary.tsx` (a list of `<li>` rows as specified, `api.get('/v1/intake/templates')` on mount, `api.post(\`/v1/intake/templates/${id}/use\`, {})`, `api.delete` for Delete with a confirm), the editor dialog, and mount the library in `FormsManagerPage` with `onUsed={(id) => navigate(<editor route>)}`.

- [ ] **Step 4: Run the app suite and typecheck**

Run: `cd apps/app && npx tsc --noEmit -p . && npx vitest run --maxWorkers=2 --minWorkers=1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/practice/settings
git commit -m "FRM-01: save as template in the form editor, and a template library in Forms"
```

---

### Task 5: Admin UI: review template requests

**Files:**
- Modify: `apps/app/src/pages/admin/AdminRequestsPage.tsx` (and `adminTypes.ts` for `formTemplateId` and the `TEMPLATE` label)
- Test: `apps/app/src/pages/admin/__tests__/AdminRequestsPage.test.tsx` (extend or create)

**Interfaces:**
- Consumes: `GET /v1/admin/templates/:id` and `POST /v1/admin/templates/:id/review`.

UI: rows with `type === 'TEMPLATE'` and a `formTemplateId` show:
- **Preview**, which opens a dialog with the practice name, the title and the numbered questions (label, type, required);
- **Approve**, and **Decline** (which asks for an optional note).

After an action, the row's status updates (DONE / DECLINED), and the toast reads "Approved. Every practice can now use it." or "Declined." The type filter gains "Form template". The generic status buttons are hidden for `TEMPLATE` rows, so the two statuses can't drift apart.

- [ ] **Step 1: Write the failing test.** Given a `TEMPLATE` row, clicking **Approve** posts `/v1/admin/templates/4/review` with `{ decision: 'APPROVED' }`, and the generic "Mark planned" style buttons are absent on that row.
- [ ] **Step 2: Run, to see it fail.** Run: `cd apps/app && npx vitest run src/pages/admin`. Expected: FAIL.
- [ ] **Step 3: Implement** as described.
- [ ] **Step 4: Run the full app suite and typecheck.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "FRM-01: review shared form templates from the admin Requests queue"`

---

### Task 6: Browser check and the testing sheet

- [ ] **Step 1:** Start the servers (API on 3099 with `SMTP_HOST= SMTP_USER= SMTP_PASS=`; app on 5173).
- [ ] **Step 2:**
  - As `dr.jane@smiththerapy.ng`, open a custom form → **Save as template**, shared and not anonymous. It shows "In review" in the library.
  - As `admin@unclutterdesk.com` at `/admin/requests`, preview it and approve it.
  - As a second practice, the template appears under "From other practices" with credit. **Use** opens the copy in the editor; edit the copy, and the template's preview is unchanged.
  - Check at 390px and 1280px.
- [ ] **Step 3:** In `docs/testing-feedback.md`, set FRM-01 to **Fixed**, with the commits and what Step 2 showed. Commit.
