import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../../test/renderWithApp';

const apiPatch = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: (...a: unknown[]) => apiPatch(...a), delete: vi.fn() },
}));

const { PermissionsDialog } = await import('../PermissionsDialog');

const MEMBER = { id: '6', name: 'Segun Ade', email: 'segun@practice.ng', role: 'THERAPIST', permissions: ['sessions.edit'] };

afterEach(cleanup);
beforeEach(() => apiPatch.mockReset());

describe('PermissionsDialog', () => {
  it('ticks what the member already holds and marks what the role gives anyway', () => {
    renderWithApp(<PermissionsDialog member={MEMBER} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByRole('checkbox', { name: /Move or cancel any session/ }).hasAttribute('checked')).toBe(true);
    const clinical = screen.getByRole('checkbox', { name: /Clinical records/ });
    expect(clinical.getAttribute('aria-disabled')).toBe('true');
    expect((clinical as HTMLInputElement).checked).toBe(true);
  });
  it('saves the ticked list', async () => {
    apiPatch.mockResolvedValue({ id: '6', permissions: ['payments.desk'] });
    const onSaved = vi.fn();
    renderWithApp(<PermissionsDialog member={{ ...MEMBER, permissions: [] }} onClose={() => {}} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Front-desk money/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save permissions' }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/v1/tenant/staff/6/permissions', { permissions: ['payments.desk'] }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
  it('shows the server’s reason when saving fails', async () => {
    apiPatch.mockRejectedValue(new Error('“practice.owner” cannot be granted — it comes with the role.'));
    renderWithApp(<PermissionsDialog member={MEMBER} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save permissions' }));
    await waitFor(() => expect(screen.getByText(/cannot be granted/)).toBeTruthy());
  });
});
