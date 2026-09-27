import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { PaymentChip } from '../booking/PaymentChip';

describe('PaymentChip', () => {
  afterEach(cleanup);
  it('shows awaiting payment with the deadline', () => {
    render(<PaymentChip status="PENDING_PAYMENT" paymentMethod="PAYSTACK" holdExpiresAt="2026-10-03T09:00:00Z" />);
    expect(screen.getByText(/Awaiting payment · until/)).toBeTruthy();
  });
  it('shows no charge for a waived session', () => {
    render(<PaymentChip status="CONFIRMED" paymentMethod="NONE" />);
    expect(screen.getByText('No charge')).toBeTruthy();
  });
  it('shows paid for a confirmed paid session', () => {
    render(<PaymentChip status="CONFIRMED" paymentMethod="MANUAL" />);
    expect(screen.getByText('Paid')).toBeTruthy();
  });
  it('shows nothing for a cancelled session', () => {
    const { container } = render(<PaymentChip status="CANCELLED" paymentMethod="PAYSTACK" />);
    expect(container.textContent).toBe('');
  });
});
