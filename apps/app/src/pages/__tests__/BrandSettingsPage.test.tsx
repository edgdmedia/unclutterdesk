import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return {
    ...real,
    api: { get: (...a: unknown[]) => get(...a), patch: (...a: unknown[]) => patch(...a), post: (...a: unknown[]) => post(...a) },
  };
});
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ profile: { id: '55', type: 'therapist', tenantId: '27', tenantSlug: 'edgdmedia-3663', plan: 'PRO' }, refreshProfile: vi.fn() }),
}));
const { BrandSettingsPage } = await import('../practice/settings/BrandSettingsPage');

const saved = {
  name: 'EDGD Media',
  slug: 'edgdmedia',
  primaryColor: '#1E1B4B',
  secondaryColor: '#3B82F6',
  logoUrl: 'data:image/png;base64,QUJD',
  customDomain: null,
  customDomainStatus: 'PENDING',
  customDomainTarget: null,
  publicEmail: 'hello@edgd.ng',
};

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  post.mockReset();
  get.mockImplementation(async (url: string) => (url === '/v1/tenant/brand' ? saved : []));
  patch.mockResolvedValue({});
});
afterEach(cleanup);

describe('Brand settings', () => {
  it("shows what setup saved: logo, colours and booking link", async () => {
    renderWithApp(<BrandSettingsPage />);
    expect(((await screen.findByLabelText('Primary colour')) as HTMLInputElement).value.toLowerCase()).toBe('#1e1b4b');
    expect((screen.getByLabelText('Accent colour') as HTMLInputElement).value.toLowerCase()).toBe('#3b82f6');
    expect((screen.getByRole('img', { name: 'Practice logo' }) as HTMLImageElement).src).toBe(saved.logoUrl);
    expect((screen.getByLabelText('Booking link') as HTMLInputElement).value).toBe('edgdmedia');
  });

  it('saves new colours and a removed logo', async () => {
    renderWithApp(<BrandSettingsPage />);
    fireEvent.change(await screen.findByLabelText('Primary colour'), { target: { value: '#112233' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove logo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save brand' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/v1/tenant/brand', expect.objectContaining({ primaryColor: '#112233', secondaryColor: '#3B82F6', logoUrl: null })),
    );
  });
});
