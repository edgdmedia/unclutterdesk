import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('../../../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../utils/apiClient')>();
  return {
    ...real,
    api: {
      get: (...a: unknown[]) => get(...a),
      post: (...a: unknown[]) => post(...a),
      patch: (...a: unknown[]) => patch(...a),
      delete: (...a: unknown[]) => del(...a),
    },
  };
});
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ profile: { id: '55', type: 'therapist', role: 'OWNER', tenantId: '27', tenantSlug: 'p', plan: 'PRO' }, refreshProfile: vi.fn() }),
}));
const { DiscountSettingsPage } = await import('../DiscountSettingsPage');

const CODES = [
  { id: '7', code: 'SAVE10', label: 'Friends', discountType: 'PERCENT', discountPercent: 10, discountAmountKobo: null, maxUses: 5, usedCount: 1, expiresAt: null, isActive: true, createdAt: '2026-09-01T00:00:00.000Z' },
  { id: '8', code: 'GONE', label: null, discountType: 'PERCENT', discountPercent: 5, discountAmountKobo: null, maxUses: null, usedCount: 0, expiresAt: null, isActive: false, createdAt: '2026-09-01T00:00:00.000Z' },
];

beforeEach(() => {
  get.mockReset(); post.mockReset(); patch.mockReset(); del.mockReset();
  get.mockResolvedValue(CODES);
  patch.mockImplementation(async (_p: string, body: unknown) => ({ ...CODES[0], ...(body as object) }));
  del.mockResolvedValue({ deleted: true });
});
afterEach(cleanup);

describe('discount row actions', () => {
  it('turns an inactive code back on', async () => {
    renderWithApp(<DiscountSettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /turn on gone/i }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/discount/8', expect.objectContaining({ isActive: true })));
  });

  it('turns an active code off through the update, not the old delete', async () => {
    renderWithApp(<DiscountSettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /turn off save10/i }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/discount/7', expect.objectContaining({ isActive: false })));
    expect(del).not.toHaveBeenCalled();
  });

  it('edits a code: the modal opens filled and saving patches the row', async () => {
    renderWithApp(<DiscountSettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /edit save10/i }));
    const label = await screen.findByPlaceholderText(/holiday promo/i);
    expect((label as HTMLInputElement).value).toBe('Friends');
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/discount/7', expect.objectContaining({ label: 'Friends' })));
  });

  it('deletes after a confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithApp(<DiscountSettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /delete save10/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/v1/discount/7/remove'));
    confirmSpy.mockRestore();
  });
});
