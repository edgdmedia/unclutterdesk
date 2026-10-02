import { describe, it, expect, vi } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminController } from './admin.controller';
import { PlatformAdminGuard } from './platform-admin.guard';

/** VID-01: super admins see each month's video minutes, by provider and by practice. */
function make() {
  const video: any = { report: vi.fn().mockResolvedValue({ month: '2026-10', totals: [], practices: [] }) };
  const controller = new AdminController({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, video);
  return { controller, video };
}

describe('GET /v1/admin/video-usage', () => {
  it('reports the month asked for', async () => {
    const { controller, video } = make();
    await expect(controller.videoUsage('2026-10')).resolves.toMatchObject({ month: '2026-10' });
    expect(video.report).toHaveBeenCalledWith('2026-10');
  });

  it('defaults to the current month in WAT', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-31T23:30:00Z'));
    const { controller, video } = make();
    await controller.videoUsage(undefined);
    expect(video.report).toHaveBeenCalledWith('2026-11');
    vi.useRealTimers();
  });

  it('is for platform admins only', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController.prototype.videoUsage);
    expect(guards).toContain(PlatformAdminGuard);
  });
});
