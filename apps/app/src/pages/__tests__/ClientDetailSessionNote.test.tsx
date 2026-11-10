import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';
import { docOf, textOf, writeIn } from '../../test/richText';

/**
 * After a session, "Write SOAP note" and the "note pending" reminder open the
 * client's notes at `?tab=notes&booking=<id>`. That address was ignored, and
 * a note written there was not tied to the session, so the session still
 * read as having no note.
 */
const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../utils/apiClient', () => ({ api: { get: (...a: unknown[]) => apiGet(...a), post: (...a: unknown[]) => apiPost(...a), patch: vi.fn() } }));

const { ClientDetailPage } = await import('../practice/ClientDetailPage');

const BASE = {
  id: '40', name: 'Ada Ola', email: 'ada@example.com', care: 'Individual Therapy', sessions: '2',
  next: 'None scheduled', status: 'Active', initials: 'AO', phone: '0801', since: 'Sept 2026',
  emergency: '', notes: [] as any[], intake: [],
};
const note = (over: Record<string, unknown>) => ({
  id: '7', bookingId: '900', date: '5 Nov 2026', time: '10:00', title: 'Clinical Session Note',
  status: 'DRAFT', note: 'DRAFT', subjective: 'Sleeps better', objective: 'Calm', assessment: 'Improving', plan: 'Breathing', ...over,
});

beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); });
afterEach(cleanup);

function renderAt(route: string, notes: any[] = []) {
  apiGet.mockImplementation((p: string) =>
    p === '/v1/tenant/clients/40' ? Promise.resolve({ ...BASE, notes, emergencyContact: null, intakeSummary: null }) : Promise.resolve([]),
  );
  return renderWithApp(
    <Routes>
      <Route path="/dashboard/clients/:id" element={<ClientDetailPage clients={[BASE] as any} setClients={() => undefined} />} />
    </Routes>,
    { route },
  );
}

describe("writing a session's note from the client page", () => {
  it('opens a new note for that session, and saves it against the session', async () => {
    renderAt('/dashboard/clients/40?tab=notes&booking=900');
    expect(await screen.findByRole('heading', { name: 'Compose Session SOAP Note' })).toBeTruthy();
    apiPost.mockResolvedValue({ id: '8', isLocked: false, subjective: 'S', objective: 'O', assessment: 'A', plan: 'P', updatedAt: new Date().toISOString() });
    writeIn(screen.getByLabelText('Subjective'), 'S');
    writeIn(screen.getByLabelText('Objective'), 'O');
    writeIn(screen.getByLabelText('Assessment'), 'A');
    writeIn(screen.getByLabelText('Plan'), 'P');
    fireEvent.submit(screen.getByRole('heading', { name: 'Compose Session SOAP Note' }).closest('form')!);
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/notes', expect.objectContaining({ clientProfileId: '40', bookingId: '900', subjective: docOf('S') })));
  });

  it("reopens the session's draft to carry on, not a blank note", async () => {
    renderAt('/dashboard/clients/40?tab=notes&booking=900', [note({})]);
    expect(await screen.findByRole('heading', { name: 'Compose Session SOAP Note' })).toBeTruthy();
    await waitFor(() => expect(textOf(screen.getByLabelText('Subjective'))).toBe('Sleeps better'));
  });

  it("shows the session's signed note instead of offering a new one", async () => {
    renderAt('/dashboard/clients/40?tab=notes&booking=900', [note({ status: 'COMPLETED', note: 'NOTE SIGNED' })]);
    expect((await screen.findAllByText('Sleeps better')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Compose Session SOAP Note' })).toBeNull();
  });

  it('a note started from the button is not tied to any session', async () => {
    renderAt('/dashboard/clients/40');
    fireEvent.click(await screen.findByRole('button', { name: /New note/ }));
    apiPost.mockResolvedValue({ id: '8', isLocked: false, updatedAt: new Date().toISOString() });
    for (const label of ['Subjective', 'Objective', 'Assessment', 'Plan']) writeIn(screen.getByLabelText(label), 'x');
    fireEvent.submit(screen.getByRole('heading', { name: 'Compose Session SOAP Note' }).closest('form')!);
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    expect(apiPost.mock.calls[0][1].bookingId).toBeUndefined();
  });
});
