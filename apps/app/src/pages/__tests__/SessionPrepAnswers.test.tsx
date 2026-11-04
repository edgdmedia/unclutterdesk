import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen } from '../../test/renderWithApp';

/* Session prep shows intake answers as questions and answers, never raw field keys. Only the network is stubbed. */
const answers = [
  { key: 'preferred_name', label: 'What should we call you?', value: 'Subomi', display: 'Subomi' },
  { key: 'previous_therapy', label: 'Have you had therapy before?', value: 'Yes', display: 'Yes' },
  ...Array.from({ length: 6 }, (_, i) => ({ key: `q_${i}`, label: `Question ${i + 3}`, value: 'x', display: 'x' })),
];
const PREP = {
  booking: { id: '900', clientProfileId: '7', clientName: 'Subomi A', clientEmail: 's@example.com', startsAt: '2026-11-10T09:00:00Z', endsAt: '2026-11-10T09:50:00Z', serviceTitle: 'Individual Therapy', status: 'CONFIRMED', videoRoomLink: null },
  latestNote: null,
  submissions: [{ id: '1', formTitle: 'Client intake', targetType: 'INTAKE', status: 'REVIEWED', submittedAt: '2026-10-22T16:46:00Z', answers }],
};
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: vi.fn(async (p: string) => (p.includes('/prep') ? PREP : [])) } };
});
const { SessionPrepPage } = await import('../practice/SessionPrepPage');

afterEach(cleanup);

describe('session prep intake answers', () => {
  it('shows each question and its answer, the first six, then all on request', async () => {
    renderWithApp(<Routes><Route path="/session/:id/prep" element={<SessionPrepPage />} /></Routes>, { route: '/session/900/prep' });
    expect(await screen.findByText('What should we call you?')).toBeTruthy();
    expect(screen.getByText('Subomi', { selector: 'dd' })).toBeTruthy();
    expect(screen.queryByText(/preferred_name/)).toBeNull();
    expect(screen.queryByText('Question 8')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show all 8 answers' }));
    expect(screen.getByText('Question 8')).toBeTruthy();
  });
});
