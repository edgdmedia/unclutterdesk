import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from './notification.service';

describe('email brand', () => {
  it('gives emails a logo address, never an inline data URL', async () => {
    const prisma: any = { tenant: { findUnique: vi.fn().mockResolvedValue({ id: 7n, name: 'Calm', logoUrl: 'data:image/png;base64,QUJD', primaryColor: null, secondaryColor: null, publicEmail: null, publicPhone: null }) } };
    const service = new NotificationService(prisma, []);
    const brand = await service.resolveBrand(7n);
    expect(brand.logoUrl).toMatch(/\/v1\/tenant\/7\/logo\?v=/);
  });
});
