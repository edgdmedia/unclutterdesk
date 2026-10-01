import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { useReducer } from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../../../test/renderWithApp';

const post = vi.fn();
vi.mock('../../../../utils/apiClient', () => ({ api: { post: (...a: unknown[]) => post(...a) } }));
const { ReviewPayStep } = await import('../ReviewPayStep');
const { initialState, wizardReducer } = await import('../bookingWizard');

const service = { id: '2', title: 'Individual therapy', durationMinutes: 50, priceKobo: '3500000' };
const slot = { id: 't1', serviceId: null, therapistName: 'Sarah Smith', startsAt: '2026-10-06T10:30:00Z', endsAt: '', channel: 'VIDEO' };

function Harness({ bankTransfer = true, start = {} }: { bankTransfer?: boolean; start?: Record<string, unknown> }) {
  const [state, dispatch] = useReducer(wizardReducer, { ...initialState({}), serviceId: '2', slotId: 't1', step: 4, ...start } as any);
  return <ReviewPayStep service={service} slot={slot} state={state} dispatch={dispatch} bankTransfer={bankTransfer} tenantId="27" cancellationHours={24} />;
}

beforeEach(() => post.mockReset());
afterEach(cleanup);

describe('ReviewPayStep', () => {
  it('summarises the session and the total', () => {
    renderWithApp(<Harness />);
    expect(screen.getByText('Individual therapy · 50 min')).toBeTruthy();
    expect(screen.getByText('Tue, 6 Oct · 11:30 AM WAT')).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText('Sarah Smith')).toBeTruthy();
    expect(screen.getAllByText('₦35,000').length).toBeGreaterThan(0);
    expect(screen.getByText('Free cancellation up to 24 hours before.')).toBeTruthy();
  });

  it('applies a discount code and shows the saving', async () => {
    post.mockResolvedValue({ code: 'CALM10', amountSavedKobo: '350000', finalKobo: '3150000' });
    renderWithApp(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Have a discount code/ }));
    fireEvent.change(screen.getByLabelText('Discount code'), { target: { value: 'calm10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.getByText('You save ₦3,500. New total ₦31,500.')).toBeTruthy());
    expect(post).toHaveBeenCalledWith('/v1/discount/validate', { tenantId: '27', code: 'CALM10', priceKobo: '3500000' }, { 'X-Tenant-Slug': '' });
    expect(screen.getByText('Discount · CALM10')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('explains an invalid code', async () => {
    post.mockRejectedValue(new Error('Invalid code'));
    renderWithApp(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Have a discount code/ }));
    fireEvent.change(screen.getByLabelText('Discount code'), { target: { value: 'NOPE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText("That code isn't valid for this session. Check the spelling or try another.")).toBeTruthy();
  });

  it('offers bank transfer only when the practice takes it', () => {
    renderWithApp(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: /Bank transfer/ }));
    expect(screen.getByText(/We'll hold your time for 48 hours/)).toBeTruthy();
    cleanup();
    renderWithApp(<Harness bankTransfer={false} />);
    expect(screen.queryByRole('radio', { name: /Bank transfer/ })).toBeNull();
    expect(screen.getByRole('radio', { name: /Pay online/ })).toBeTruthy();
  });

  it("says so when the payment didn't go through", () => {
    renderWithApp(<Harness start={{ paymentStatus: 'failed' }} />);
    expect(screen.getByText("Your payment didn't go through")).toBeTruthy();
  });
});
