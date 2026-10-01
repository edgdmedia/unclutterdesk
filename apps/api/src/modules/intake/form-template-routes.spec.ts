import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { IntakeController } from './intake.controller';

/** FRM-01: the template routes act for the signed-in practice only. */
function make() {
  const templates: any = {
    saveFromForm: vi.fn().mockResolvedValue({ id: '50' }),
    library: vi.fn().mockResolvedValue({ mine: [], shared: [] }),
    preview: vi.fn(),
    use: vi.fn().mockResolvedValue({ formId: '77' }),
    remove: vi.fn(),
  };
  const controller = new IntakeController({} as any, templates);
  const req = { user: { tenantId: '1', profileId: '9', sub: '9' }, tenantId: 1n };
  return { controller, templates, req };
}

describe('template routes', () => {
  it('saves a form as a template for the signed-in practice', async () => {
    const { controller, templates, req } = make();
    await controller.saveTemplate(req, '10', { share: true, anonymous: false });
    expect(templates.saveFromForm).toHaveBeenCalledWith(1n, 9n, 10n, { share: true, anonymous: false });
  });

  it('uses and removes templates for the signed-in practice', async () => {
    const { controller, templates, req } = make();
    await expect(controller.useTemplate(req, '2')).resolves.toEqual({ formId: '77' });
    expect(templates.use).toHaveBeenCalledWith(1n, 2n);
    await controller.removeTemplate(req, '2');
    expect(templates.remove).toHaveBeenCalledWith(1n, 2n);
  });

  it('treats a malformed template id as not found', async () => {
    const { controller, req } = make();
    expect(() => controller.useTemplate(req, 'abc')).toThrow(NotFoundException);
  });
});
