import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { TenantService } from './tenant.service';

function make() {
  const prisma: any = {
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ id: 27n, slug: 'edgdmedia', subscriptionTier: 'PRO' }),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 27n, ...data })),
    },
  };
  return { prisma, service: new TenantService(prisma, { sendEmail: vi.fn() } as any) };
}

const PNG = 'data:image/png;base64,' + Buffer.from('png-bytes').toString('base64');

describe('saving the practice logo', () => {
  it('stores an image', async () => {
    const { service, prisma } = make();
    await service.updateTenantBrand(27n, { logoUrl: PNG });
    expect(prisma.tenant.update.mock.calls[0][0].data.logoUrl).toBe(PNG);
  });

  it('accepts a hosted https logo', async () => {
    const { service, prisma } = make();
    await service.updateTenantBrand(27n, { logoUrl: 'https://cdn.example.com/logo.png' });
    expect(prisma.tenant.update.mock.calls[0][0].data.logoUrl).toBe('https://cdn.example.com/logo.png');
  });

  it('clears the logo when sent null or empty', async () => {
    for (const logoUrl of [null, '']) {
      const { service, prisma } = make();
      await service.updateTenantBrand(27n, { logoUrl } as any);
      expect(prisma.tenant.update.mock.calls[0][0].data.logoUrl).toBeNull();
    }
  });

  it('leaves the logo alone when not sent', async () => {
    const { service, prisma } = make();
    await service.updateTenantBrand(27n, { primaryColor: '#112233' });
    expect('logoUrl' in prisma.tenant.update.mock.calls[0][0].data).toBe(false);
  });

  it('refuses anything that is not an image', async () => {
    const { service, prisma } = make();
    for (const logoUrl of ['data:text/html;base64,PGI+', 'javascript:alert(1)', 'http://insecure.example.com/l.png', 'not a url']) {
      await expect(service.updateTenantBrand(27n, { logoUrl })).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('refuses a logo too large to store', async () => {
    const { service } = make();
    const huge = 'data:image/png;base64,' + 'A'.repeat(200_000);
    await expect(service.updateTenantBrand(27n, { logoUrl: huge })).rejects.toThrow('too large');
  });
});
