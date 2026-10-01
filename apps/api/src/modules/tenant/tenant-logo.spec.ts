import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TenantService, logoUrlFor } from './tenant.service';

const PNG = 'data:image/png;base64,' + Buffer.from('fake-png').toString('base64');

function make(logoUrl: string | null | undefined) {
  const prisma: any = { tenant: { findUnique: vi.fn().mockResolvedValue(logoUrl === undefined ? null : { id: 7n, logoUrl }) } };
  return new TenantService(prisma, { sendEmail: vi.fn() } as any);
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
    await expect(make(undefined).getLogo(7n)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gives emails an address they will load, which changes when the logo does', () => {
    const a = logoUrlFor({ id: 7n, logoUrl: PNG });
    expect(a).toMatch(/^http:\/\/localhost:3099\/v1\/tenant\/7\/logo\?v=[0-9a-f]{8}$/);
    expect(logoUrlFor({ id: 7n, logoUrl: PNG.replace('ZmFrZS', 'b3RoZX') })).not.toBe(a);
    expect(logoUrlFor({ id: 7n, logoUrl: 'https://cdn.example.com/l.png' })).toBe('https://cdn.example.com/l.png');
    expect(logoUrlFor({ id: 7n, logoUrl: null })).toBeNull();
  });
});
