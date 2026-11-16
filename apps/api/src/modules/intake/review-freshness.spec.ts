import { describe, expect, it, vi } from 'vitest';
import { IntakeService } from './intake.service';
import { PURGE_JOB, practiceTag } from '../practitioner-profile/profile-purge.job';

/**
 * §6.16 freshness: a solo practice's address shows the owner's profile page
 * with the practice's published reviews, cached by the profiles Worker under
 * the practice's tag. Publishing, hiding or renaming how reviewers are shown
 * purges that tag, so the page changes within a minute. Nothing else does.
 */
const TENANT = 1n;
const REVIEW_FORM = { id: 3n, tenantId: TENANT, title: 'Leave a review', targetType: 'REVIEW', reviewPublicationMode: 'MANUAL', reviewerDisplayMode: 'FIRST_NAME', schemaJson: [], isActive: true, description: null, systemKey: null, createdAt: new Date(), updatedAt: new Date() };

function make(over: { form?: any; submission?: any } = {}) {
  const form = over.form ?? REVIEW_FORM;
  const submission = over.submission ?? { id: 50n, tenantId: TENANT, status: 'UNREAD', targetType: form.targetType, reviewedAt: null, publishedAt: null, form };
  const prisma: any = {
    tenant: { findUnique: vi.fn(async () => ({ slug: 'ada' })) },
    universalForm: {
      findFirst: vi.fn(async () => form),
      update: vi.fn(async ({ data }: any) => ({ ...form, ...data })),
    },
    consultBooking: { findFirst: vi.fn() },
    profile: { findFirst: vi.fn(async () => ({ id: 40n, tenantId: TENANT, firstName: 'Ada', lastName: 'Ola', email: 'ada@example.com' })), create: vi.fn(), update: vi.fn() },
    universalFormSubmission: {
      findFirst: vi.fn(async () => submission),
      create: vi.fn(async ({ data }: any) => ({ id: 77n, createdAt: new Date(), ...data })),
      update: vi.fn(async ({ data }: any) => ({ ...submission, ...data, form })),
    },
  };
  const jobs: any = {
    enqueue: vi.fn(async (type: string, payload: unknown) => ({ id: 9n, type, payload })),
    runNow: vi.fn(async () => undefined),
  };
  const purged = () => jobs.enqueue.mock.calls.filter(([type]: [string]) => type === PURGE_JOB).map(([, payload]: [string, { tags: string[] }]) => payload.tags);
  return { service: new IntakeService(prisma, undefined, jobs), prisma, jobs, purged };
}

describe("a solo practice's reviews on its address stay fresh (§6.16)", () => {
  it('purges the practice page when a review is published, and when a published one is hidden', async () => {
    const publish = make();
    await publish.service.updateSubmissionStatus(TENANT, 50n, 'PUBLISHED');
    expect(publish.purged()).toEqual([[practiceTag('ada')]]);
    expect(publish.jobs.runNow).toHaveBeenCalledWith(9n);

    const hide = make({ submission: { id: 50n, tenantId: TENANT, status: 'PUBLISHED', targetType: 'REVIEW', reviewedAt: null, publishedAt: new Date(), form: REVIEW_FORM } });
    await hide.service.updateSubmissionStatus(TENANT, 50n, 'HIDDEN');
    expect(hide.purged()).toEqual([['practice:ada']]);
  });

  it("doesn't purge for a status change no visitor can see", async () => {
    const { service, purged } = make();
    await service.updateSubmissionStatus(TENANT, 50n, 'REVIEWED');
    expect(purged()).toEqual([]);
  });

  it("doesn't purge for forms that aren't reviews", async () => {
    const intake = { ...REVIEW_FORM, targetType: 'INTAKE' };
    const { service, purged } = make({ form: intake, submission: { id: 50n, tenantId: TENANT, status: 'UNREAD', targetType: 'INTAKE', reviewedAt: null, publishedAt: null, form: intake } });
    await service.updateSubmissionStatus(TENANT, 50n, 'PUBLISHED');
    expect(purged()).toEqual([]);
  });

  it('purges when a review is published as it arrives (automatic publishing)', async () => {
    const auto = make({ form: { ...REVIEW_FORM, reviewPublicationMode: 'AUTO' } });
    await auto.service.submitAsClient(TENANT, 40n, { formId: '3', answersJson: { rating: 5 } });
    expect(auto.purged()).toEqual([['practice:ada']]);

    const manual = make();
    await manual.service.submitAsClient(TENANT, 40n, { formId: '3', answersJson: { rating: 5 } });
    expect(manual.purged()).toEqual([]);
  });

  it('purges when the practice changes how reviewers are named', async () => {
    const changed = make();
    await changed.service.updateForm(TENANT, 3n, { reviewerDisplayMode: 'ANONYMOUS' });
    expect(changed.purged()).toEqual([['practice:ada']]);

    const same = make();
    await same.service.updateForm(TENANT, 3n, { title: 'Tell us how it went' });
    expect(same.purged()).toEqual([]);
  });
});
