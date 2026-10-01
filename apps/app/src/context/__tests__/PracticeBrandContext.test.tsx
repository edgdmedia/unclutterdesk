import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

const get = vi.fn();
vi.mock('../../utils/apiClient', () => ({ api: { get: (...a: unknown[]) => get(...a) } }));
const refreshProfile = vi.fn().mockResolvedValue(undefined);
let profile: Record<string, unknown> | null;
vi.mock('../AuthContext', () => ({ useAuth: () => ({ profile, refreshProfile }) }));
const { PracticeBrandProvider, usePracticeBrand } = await import('../PracticeBrandContext');

let refresh: () => Promise<void> = async () => {};
function Show() {
  const brand = usePracticeBrand();
  refresh = brand.refresh;
  const b = brand.brand;
  return <p>{b ? `${b.name} ${b.slug} ${b.primaryColor} ${b.secondaryColor} ${b.logoUrl ? 'logo' : 'no-logo'}` : 'no brand'}</p>;
}

const saved = { name: 'EDGD Media', slug: 'edgdmedia', primaryColor: '#1E1B4B', secondaryColor: '#3B82F6', logoUrl: 'data:image/png;base64,QUJD' };

beforeEach(() => {
  get.mockReset();
  refreshProfile.mockClear();
});
afterEach(cleanup);

describe('PracticeBrandProvider', () => {
  it("loads the practice's saved brand: link, colours and logo", async () => {
    profile = { id: '55', type: 'therapist', tenantId: '27' };
    get.mockResolvedValue(saved);
    render(<PracticeBrandProvider><Show /></PracticeBrandProvider>);
    expect(await screen.findByText('EDGD Media edgdmedia #1E1B4B #3B82F6 logo')).toBeTruthy();
    expect(get).toHaveBeenCalledWith('/v1/tenant/brand');
  });

  it('picks up a save, and refreshes the signed-in profile so links use the new address', async () => {
    profile = { id: '55', type: 'therapist', tenantId: '27' };
    get.mockResolvedValueOnce({ ...saved, slug: 'edgdmedia-3663', primaryColor: '#0F3A53' }).mockResolvedValue(saved);
    render(<PracticeBrandProvider><Show /></PracticeBrandProvider>);
    await screen.findByText(/edgdmedia-3663 #0F3A53/);
    await act(() => refresh());
    expect(screen.getByText('EDGD Media edgdmedia #1E1B4B #3B82F6 logo')).toBeTruthy();
    expect(refreshProfile).toHaveBeenCalled();
  });

  it('loads nothing for the platform admin or a client', async () => {
    for (const p of [{ id: '3', type: 'platform_admin' }, { id: '40', type: 'user', tenantId: '1' }]) {
      profile = p;
      render(<PracticeBrandProvider><Show /></PracticeBrandProvider>);
      await waitFor(() => expect(screen.getByText('no brand')).toBeTruthy());
      cleanup();
    }
    expect(get).not.toHaveBeenCalled();
  });

  it('works without a provider, so a page can render on its own', () => {
    render(<Show />);
    expect(screen.getByText('no brand')).toBeTruthy();
  });
});
