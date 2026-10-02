import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminController } from './admin.controller';

/** FRM-01: platform admins preview, approve and decline shared templates. */
function make() {
  const templates: any = { review: vi.fn().mockResolvedValue({ id: '4' }), adminPreview: vi.fn().mockResolvedValue({ id: '4' }) };
  const controller = new AdminController({} as any, {} as any, {} as any, {} as any, {} as any, templates, {} as any);
  return { controller, templates };
}

describe('admin template review', () => {
  it('passes approve and decline through with the note', async () => {
    const { controller, templates } = make();
    await controller.reviewTemplate('4', { decision: 'APPROVED' });
    expect(templates.review).toHaveBeenCalledWith(4n, 'APPROVED', undefined);
    await controller.reviewTemplate('4', { decision: 'DECLINED', note: '  Needs consent.  ' });
    expect(templates.review).toHaveBeenLastCalledWith(4n, 'DECLINED', 'Needs consent.');
  });

  it('rejects anything but approve or decline', async () => {
    const { controller, templates } = make();
    expect(() => controller.reviewTemplate('4', { decision: 'MAYBE' })).toThrow(BadRequestException);
    expect(templates.review).not.toHaveBeenCalled();
  });

  it('previews a template with its real practice', async () => {
    const { controller, templates } = make();
    await controller.templatePreview('4');
    expect(templates.adminPreview).toHaveBeenCalledWith(4n);
  });

  it('treats a malformed id as not found', () => {
    const { controller } = make();
    expect(() => controller.templatePreview('x')).toThrow(NotFoundException);
    expect(() => controller.reviewTemplate('x', { decision: 'APPROVED' })).toThrow(NotFoundException);
  });
});
