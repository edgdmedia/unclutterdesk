import { describe, expect, it, vi } from 'vitest';
import { JobDeferredError } from '../jobs/jobs.service';
import { ProfilePhotoJob } from './profile-photo.job';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const PNG_URL = `data:image/png;base64,${PNG.toString('base64')}`;
const PAYLOAD = { practitionerProfileId: '1', sourceProfileId: '50' };

function setup({ photoKey = null as string | null, avatarUrl = PNG_URL as string | null, configured = true } = {}) {
  const prisma: any = {
    practitionerProfile: {
      findUnique: vi.fn().mockResolvedValue({ id: 1n, userId: 7n, photoKey }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    profile: { findFirst: vi.fn().mockResolvedValue(avatarUrl === null ? null : { avatarUrl }) },
  };
  const storage: any = { configured: vi.fn().mockReturnValue(configured), put: vi.fn(), remove: vi.fn() };
  const jobs: any = { register: vi.fn() };
  return { job: new ProfilePhotoJob(prisma, storage, jobs), prisma, storage, jobs };
}

describe('profile photo back-fill', () => {
  it('registers its handler', () => {
    const { job, jobs } = setup();
    job.onModuleInit();
    expect(jobs.register).toHaveBeenCalledWith('profile.photo-backfill', expect.any(Function));
  });

  it("copies the practice photo to the public bucket and sets photoKey", async () => {
    const { job, prisma, storage } = setup();
    await job.run(PAYLOAD);
    const [bucket, key, bytes, opts] = storage.put.mock.calls[0];
    expect(bucket).toBe('public');
    expect(key).toMatch(/^profiles\/1\/photo-[0-9a-f]{16}\.png$/);
    expect(bytes.equals(PNG)).toBe(true);
    expect(opts).toEqual({ contentType: 'image/png' });
    expect(prisma.practitionerProfile.updateMany).toHaveBeenCalledWith({ where: { id: 1n, photoKey: null }, data: { photoKey: key } });
  });

  it("reads the photo only from the same person's practice profile", async () => {
    const { job, prisma } = setup();
    await job.run(PAYLOAD);
    expect(prisma.profile.findFirst.mock.calls[0][0].where).toEqual({ id: 50n, userId: 7n });
  });

  it('leaves a photo the therapist already chose', async () => {
    const { job, storage } = setup({ photoKey: 'profiles/1/mine.jpg' });
    await job.run(PAYLOAD);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it.each([
    ['a hosted link', 'https://example.com/me.png'],
    ['an SVG', `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`],
    ['a fake PNG', `data:image/png;base64,${Buffer.from('<script>').toString('base64')}`],
  ])('skips %s without retrying', async (_what, avatarUrl) => {
    const { job, storage } = setup({ avatarUrl });
    await expect(job.run(PAYLOAD)).resolves.toBeUndefined();
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('waits for R2 to be configured instead of failing', async () => {
    const { job } = setup({ configured: false });
    await expect(job.run(PAYLOAD)).rejects.toBeInstanceOf(JobDeferredError);
  });

  it('drops its copy if a photo was chosen while it uploaded', async () => {
    const { job, prisma, storage } = setup();
    prisma.practitionerProfile.updateMany.mockResolvedValue({ count: 0 });
    await job.run(PAYLOAD);
    expect(storage.remove).toHaveBeenCalledWith('public', storage.put.mock.calls[0][1]);
  });
});
