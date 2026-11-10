import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { docOf, writeIn } from '../../test/richText';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const apiGet = vi.fn();
const apiPatch = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    patch: (...a: unknown[]) => apiPatch(...a),
    post: (...a: unknown[]) => apiPost(...a),
    put: (...a: unknown[]) => apiPut(...a),
  },
  getBookingUrl: () => 'https://dr-smith.unclutterdesk.com',
  TENANT_SLUG: 'dr-smith',
}));

const { SessionDetailPage } = await import('../practice/SessionDetailPage');

const DETAIL = {
  id: '900', startsAt: '2026-10-01T09:00:00.000Z', endsAt: '2026-10-01T09:50:00.000Z',
  status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: '3500000', holdExpiresAt: null, bookedBy: 'Frank Desk',
  client: { id: '40', name: 'Ada Ola' }, serviceTitle: 'Individual Therapy',
  provider: { id: '6', name: 'Segun Ade' }, channel: 'VIDEO',
  clientEmail: 'ada@example.com', clientPhone: '0801', videoRoomLink: '/session/900',
  note: null, internalSummary: null, clientRecap: null, clientRecapSentAt: null,
  format: 'ONLINE', location: null,
  can: { edit: true, summary: true, markPaid: true },
};

beforeEach(() => {
  apiGet.mockReset(); apiPatch.mockReset(); apiPost.mockReset(); apiPut.mockReset();
  recapState = { recapAssessmentKeys: [], sentAssessments: [] };
});
afterEach(cleanup);

const LIBRARY = [
  { key: 'DAR_5', shortName: 'DAR-5', name: 'Dimensions of Anger Reactions (DAR-5)', measures: 'Anger', estimatedMinutes: 2, enabled: true, onPlan: true },
  { key: 'RSES', shortName: 'Rosenberg', name: 'Rosenberg Self-Esteem Scale (RSES)', measures: 'Self-esteem', estimatedMinutes: 3, enabled: true, onPlan: true },
  { key: 'BPAQ', shortName: 'Buss–Perry AQ', name: 'Buss–Perry Aggression Questionnaire (BPAQ)', measures: 'Aggression', estimatedMinutes: 10, enabled: false, onPlan: true },
];
let recapState: { recapAssessmentKeys: string[]; sentAssessments: unknown[] } = { recapAssessmentKeys: [], sentAssessments: [] };

function renderPage(detail = DETAIL, submissions: unknown[] = [], route = '/dashboard/sessions/900') {
  apiGet.mockImplementation((p: string) =>
    p === '/v1/consult/practice/sessions/900'
      ? Promise.resolve(detail)
      : p === '/v1/intake/submissions/booking/900'
        ? Promise.resolve(submissions)
        : p === '/v1/consult/practice/sessions/900/recap'
          ? Promise.resolve(recapState)
          : p === '/v1/assessments/library'
            ? Promise.resolve(LIBRARY)
            : Promise.resolve([]),
  );
  return renderWithApp(
    <Routes><Route path="/dashboard/sessions/:id" element={<SessionDetailPage />} /></Routes>,
    { route },
  );
}

// SET-06: the session page says where the session happens.
describe('format and place on the session page', () => {
  it('shows the location for an in-person session and no join button', async () => {
    renderPage({ ...DETAIL, format: 'IN_PERSON', channel: 'IN_PERSON', videoRoomLink: null, location: { id: '4', name: 'Lekki clinic', city: 'Lagos' } });
    expect(await screen.findByText(/In person · Lekki clinic/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Start session/ })).toBeNull();
  });

  it('keeps the join button for an online session', async () => {
    // VID-02: Start shows while the room is open, so pin the clock inside the session.
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-10-01T09:05:00Z') });
    renderPage({ ...DETAIL, format: 'ONLINE' });
    expect(await screen.findByRole('link', { name: /Start session/ })).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();
    vi.useRealTimers();
  });
});

describe('SessionDetailPage', () => {
  it('shows who, what, when and who booked it', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Ola' })).toBeTruthy());
    expect(screen.getByText('Individual Therapy')).toBeTruthy();
    expect(screen.getByText(/Segun Ade/)).toBeTruthy();
    expect(screen.getByText(/Booked by Frank Desk/)).toBeTruthy();
  });
  it('start and prep point at the existing flows', async () => {
    // VID-02: Start only works while the room is open, so pin the clock inside the session.
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-10-01T09:05:00Z') });
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    expect(screen.getByRole('link', { name: /Start session/ }).getAttribute('href')).toBe('/session/900');
    expect(screen.getByRole('link', { name: /Session prep/ }).getAttribute('href')).toBe('/session/900/prep');
    vi.useRealTimers();
  });
  it('offers no Start once the session is over', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-10-01T12:00:00Z') });
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    expect(screen.queryByRole('link', { name: /Start session/ })).toBeNull();
    vi.useRealTimers();
  });
  async function openSummary() {
    fireEvent.click(await screen.findByRole('tab', { name: 'Summary' }));
  }

  it('saves the summary and sends the recap', async () => {
    apiPatch.mockResolvedValue({ id: '900' });
    apiPost.mockResolvedValue({ id: '900', sentAt: new Date().toISOString() });
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    await openSummary();
    writeIn(screen.getByLabelText('Client recap'), 'Practised breathing.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/summary', expect.objectContaining({ clientRecap: docOf('Practised breathing.') })));
    fireEvent.click(screen.getByRole('button', { name: /Send recap/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/recap-email', {}));
  });
  it('keeps supervision notes apart, saved with the summary', async () => {
    apiPatch.mockResolvedValue({ id: '900' });
    renderPage({ ...DETAIL, supervisionNotes: 'Peer client.' } as any);
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    await openSummary();
    writeIn(screen.getByLabelText('Supervision notes'), 'Check readiness before going deeper.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/summary', expect.objectContaining({ supervisionNotes: docOf('Check readiness before going deeper.') })));
  });
  it('sends the recap as it is on screen, saving it first', async () => {
    apiPatch.mockResolvedValue({ id: '900' });
    apiPost.mockResolvedValue({ id: '900', sentAt: new Date().toISOString() });
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    await openSummary();
    writeIn(screen.getByLabelText('Client recap'), 'Breathe slowly.');
    fireEvent.click(screen.getByRole('button', { name: /Send recap/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/recap-email', {}));
    expect(apiPatch.mock.invocationCallOrder[0]).toBeLessThan(apiPost.mock.invocationCallOrder[0]);
    expect(apiPatch.mock.calls[0][1]).toMatchObject({ clientRecap: docOf('Breathe slowly.') });
  });
  it('attaches questionnaires the practice has switched on, and sends them with the recap', async () => {
    apiPatch.mockResolvedValue({ id: '900' });
    apiPut.mockResolvedValue({ recapAssessmentKeys: ['DAR_5', 'RSES'] });
    apiPost.mockResolvedValue({ id: '900', sentAt: new Date().toISOString() });
    renderPage({ ...DETAIL, clientRecap: docOf('Practise daily.') } as any);
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    await openSummary();
    const add = (await screen.findByLabelText('Add a questionnaire')) as HTMLSelectElement;
    // Switched off in Assessments: not offered.
    expect([...add.options].map((o) => o.value)).toEqual(['', 'DAR_5', 'RSES']);
    fireEvent.change(add, { target: { value: 'DAR_5' } });
    fireEvent.change(screen.getByLabelText('Add a questionnaire'), { target: { value: 'RSES' } });
    expect(screen.getAllByText('Goes with the recap')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Send recap/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/recap-email', {}));
    expect(apiPut).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/recap-assessments', { keys: ['DAR_5', 'RSES'] });
    expect(apiPut.mock.invocationCallOrder[0]).toBeLessThan(apiPost.mock.invocationCallOrder[0]);
  });
  it('shows how far the client got with ones already sent, and saves nothing unchanged', async () => {
    recapState = { recapAssessmentKeys: ['DAR_5'], sentAssessments: [{ id: '71', key: 'DAR_5', shortName: 'DAR-5', status: 'COMPLETED' }] };
    apiPatch.mockResolvedValue({ id: '900' });
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    await openSummary();
    expect(await screen.findByText('Done')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalled());
    expect(apiPut).not.toHaveBeenCalled();
  });
  it('can take one off before it goes', async () => {
    recapState = { recapAssessmentKeys: ['DAR_5'], sentAssessments: [] };
    apiPatch.mockResolvedValue({ id: '900' });
    apiPut.mockResolvedValue({ recapAssessmentKeys: [] });
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    await openSummary();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove DAR-5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/recap-assessments', { keys: [] }));
  });
  it('hides what the caller may not do', async () => {
    renderPage({ ...DETAIL, can: { edit: false, summary: false, markPaid: false } });
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    expect(screen.queryByRole('button', { name: /Mark as paid/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Cancel session/ })).toBeNull();
  });
});


describe('the default forms on a session', () => {
  it('shows intake and confidentiality as waiting when nothing is in', async () => {
    renderPage();
    const line = await screen.findByText(/Intake: waiting/);
    expect(line.parentElement?.textContent).toMatch(/Confidentiality: waiting/);
  });

  it('shows them as done when the submissions are in', async () => {
    renderPage(DETAIL, [{ targetType: 'INTAKE' }, { targetType: 'CONSENT' }]);
    const line = await screen.findByText(/Intake: done/);
    expect(line.parentElement?.textContent).toMatch(/Confidentiality: done/);
  });
});

describe('the notes and summary tabs', () => {
  it('opens SOAP notes by default when there is no note', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    expect(screen.getByRole('tab', { name: 'SOAP notes' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('Subjective')).toBeTruthy();
  });

  it('opens SOAP notes by default when the note is not signed', async () => {
    renderPage({ ...DETAIL, note: { id: '7', status: 'DRAFT', subjective: '', objective: '', assessment: '', plan: '' } } as any);
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    expect(screen.getByRole('tab', { name: 'SOAP notes' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('Subjective')).toBeTruthy();
  });

  it('opens Summary by default when the note is signed', async () => {
    renderPage({ ...DETAIL, note: { id: '7', status: 'COMPLETED', subjective: 'x', objective: 'x', assessment: 'x', plan: 'x' } } as any);
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    expect(screen.getByRole('tab', { name: 'Summary' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('Client recap')).toBeTruthy();
  });

  it('opens the tab named in the URL', async () => {
    renderPage(DETAIL, [], '/dashboard/sessions/900?tab=notes');
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    expect(screen.getByRole('tab', { name: 'SOAP notes' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('Subjective')).toBeTruthy();
  });

  it('opens the SOAP notes tab from a #note link', async () => {
    renderPage(DETAIL, [], '/dashboard/sessions/900#note');
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    expect(screen.getByRole('tab', { name: 'SOAP notes' }).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps SOAP editor state when switching tabs', async () => {
    apiPost.mockResolvedValue({ id: '7', isLocked: false });
    renderPage({ ...DETAIL, note: { id: '7', status: 'DRAFT', subjective: '', objective: '', assessment: '', plan: '' } } as any);
    await waitFor(() => screen.getByRole('tab', { name: 'SOAP notes' }));
    const subjective = screen.getByLabelText('Subjective');
    const { writeIn } = await import('../../test/richText');
    writeIn(subjective, 'Initial note');
    fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Summary' }).getAttribute('aria-selected')).toBe('true'));
    fireEvent.click(screen.getByRole('tab', { name: 'SOAP notes' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'SOAP notes' }).getAttribute('aria-selected')).toBe('true'));
    expect(screen.getByLabelText('Subjective').textContent).toContain('Initial note');
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/notes', expect.objectContaining({ subjective: expect.objectContaining({}) })));
    const call = apiPost.mock.calls.find(c => c[0] === '/v1/notes');
    expect(call?.[1].subjective).toBeDefined();
  });

  it('gives the desk the overview only', async () => {
    renderPage({ ...DETAIL, can: { edit: true, summary: false, markPaid: true } });
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByLabelText('Client recap')).toBeNull();
  });
});
