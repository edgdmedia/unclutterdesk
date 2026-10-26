import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const post = vi.fn();
const del = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { post: (...a: unknown[]) => post(...a), delete: (...a: unknown[]) => del(...a) },
}));
const { ComplimentaryPlanForm, describePlan } = await import('../admin/ComplimentaryPlanForm');

beforeEach(() => {
  post.mockReset();
  del.mockReset();
});
afterEach(cleanup);

describe('complimentary plans (§12): the only way an admin changes a plan', () => {
  it('describes what a practice is on and why', () => {
    expect(describePlan({ subscriptionTier: 'CLINIC', complimentaryReason: 'INTERNAL', complimentaryUntil: null })).toBe('Clinic, complimentary with no end date (internal)');
    expect(describePlan({ subscriptionTier: 'STARTER', complimentaryReason: 'MIGRATION', complimentaryUntil: '2027-01-24T10:00:00Z' })).toMatch(/^Starter, complimentary until .* \(migration\)$/);
    expect(describePlan({ subscriptionTier: 'PRO', subscriptionStatus: 'active' })).toBe('Pro, paid');
    expect(describePlan({ subscriptionTier: 'FREE' })).toBe('Free');
  });

  it('needs an end date unless the plan is INTERNAL', () => {
    renderWithApp(<ComplimentaryPlanForm tenantId="4" plan={{ subscriptionTier: 'FREE' }} onSaved={() => {}} />);
    expect((screen.getByRole('button', { name: 'Set plan' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'INTERNAL' } });
    expect((screen.getByRole('button', { name: 'Set with no end date' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('sends the tier, reason and end date together', async () => {
    const onSaved = vi.fn();
    post.mockResolvedValue({ subscriptionTier: 'PRO', complimentaryReason: 'INVITE_CODE', complimentaryUntil: '2027-02-01T22:59:00.000Z' });
    renderWithApp(<ComplimentaryPlanForm tenantId="4" plan={{ subscriptionTier: 'FREE' }} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'PRO' } });
    fireEvent.change(screen.getByLabelText('Free until'), { target: { value: '2027-02-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set plan' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/v1/admin/tenants/4/complimentary', { tier: 'PRO', reason: 'INVITE_CODE', until: '2027-02-01T22:59:00.000Z' }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('offers "End now" only on a complimentary plan', () => {
    renderWithApp(<ComplimentaryPlanForm tenantId="4" plan={{ subscriptionTier: 'PRO', subscriptionStatus: 'active' }} onSaved={() => {}} />);
    expect(screen.queryByRole('button', { name: 'End now' })).toBeNull();
  });
});
