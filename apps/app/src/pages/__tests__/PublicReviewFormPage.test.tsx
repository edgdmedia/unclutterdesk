import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

/**
 * The practice's review form. From a review request email the link is signed
 * (`?booking=&t=`): the page knows who the client is and which session, and
 * does not ask for a name or email. Without one, it is the general form.
 */
const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../utils/apiClient', () => ({ api: { get: (...a: unknown[]) => apiGet(...a), post: (...a: unknown[]) => apiPost(...a) } }));

const { PublicReviewFormPage } = await import('../public/PublicReviewFormPage');

const FORM = { id: '3', title: 'Leave a review', description: null, targetType: 'REVIEW', schemaJson: [{ id: 'words', label: 'What stood out?', type: 'textarea' }] };
const INVITE = { firstName: 'Ada', practitionerName: 'Segun Ade', serviceTitle: 'Individual Therapy', sessionAt: '2026-11-05T10:00:00.000Z', alreadyReviewed: false };

beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); });
afterEach(cleanup);

function renderAt(route: string, invite: unknown = INVITE) {
  apiGet.mockImplementation((p: string) =>
    p.startsWith('/v1/intake/public/forms')
      ? Promise.resolve([FORM])
      : p.startsWith('/v1/consult/public/review-invite')
        ? invite instanceof Error ? Promise.reject(invite) : Promise.resolve(invite)
        : Promise.resolve([]),
  );
  return renderWithApp(<Routes><Route path="/review" element={<PublicReviewFormPage />} /></Routes>, { route });
}

describe('the review form from a review request link', () => {
  it('names the session, asks no name or email, and sends the signed link', async () => {
    renderAt('/review?booking=900&t=signed');
    expect(await screen.findByText(/your Individual Therapy session with Segun Ade/)).toBeTruthy();
    expect(screen.queryByText('Email address')).toBeNull();
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/v1/consult/public/review-invite?booking=900&t=signed'));
    apiPost.mockResolvedValue({ id: '77' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Kind and clear.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/v1/intake/public/submissions', { formId: '3', bookingId: '900', inviteToken: 'signed', answersJson: { words: 'Kind and clear.' } }),
    );
    expect(await screen.findByText('Thank you for your feedback')).toBeTruthy();
  });

  it('thanks a client who already reviewed this session, instead of a second form', async () => {
    renderAt('/review?booking=900&t=signed', { ...INVITE, alreadyReviewed: true });
    expect(await screen.findByText(/already sent a review for this session/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit review' })).toBeNull();
  });

  it('falls back to the general form when the link is not valid', async () => {
    renderAt('/review?booking=900&t=forged', new Error('This review link is not valid.'));
    expect(await screen.findByText(/not valid any more/)).toBeTruthy();
    expect(screen.getByText('Email address')).toBeTruthy();
  });
});

describe('the general review form', () => {
  it('asks for a name and email', async () => {
    renderAt('/review');
    expect(await screen.findByText('Email address')).toBeTruthy();
    expect(apiGet).not.toHaveBeenCalledWith(expect.stringContaining('review-invite'));
  });
});
