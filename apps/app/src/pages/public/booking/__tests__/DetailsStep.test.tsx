import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen } from '../../../../test/renderWithApp';

vi.mock('../../../../utils/apiClient', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }));
const { DetailsStep } = await import('../DetailsStep');

afterEach(cleanup);

describe('DetailsStep', () => {
  it('asks a signed-out client to create an account or sign in', () => {
    renderWithApp(<DetailsStep me={null} onSignOut={() => {}} note="" onNote={() => {}} onSignedIn={() => {}} therapistName="Dr. Smith" />);
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByText(/One Unclutter Desk account works with every practice/)).toBeTruthy();
  });

  it('shows who is booking, and lets them switch account', () => {
    const onSignOut = vi.fn();
    renderWithApp(<DetailsStep me={{ firstName: 'Ada', lastName: 'Okafor', email: 'ada@x.com', phone: '0801' }} onSignOut={onSignOut} note="" onNote={() => {}} onSignedIn={() => {}} therapistName="Dr. Smith" />);
    expect(screen.getByText('Booking as Ada Okafor')).toBeTruthy();
    expect(screen.getByText('ada@x.com · 0801')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Not you?' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('takes an optional note for the therapist', () => {
    const onNote = vi.fn();
    renderWithApp(<DetailsStep me={{ firstName: 'Ada', email: 'ada@x.com' }} onSignOut={() => {}} note="" onNote={onNote} onSignedIn={() => {}} therapistName="Dr. Smith" />);
    const box = screen.getByLabelText(/Anything the therapist should know/);
    expect(box.getAttribute('placeholder')).toBe('Shared only with Dr. Smith.');
    fireEvent.change(box, { target: { value: 'First time in therapy' } });
    expect(onNote).toHaveBeenCalledWith('First time in therapy');
  });
});
