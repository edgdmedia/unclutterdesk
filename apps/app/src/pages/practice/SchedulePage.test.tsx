import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

const { SchedulePage } = await import('./SchedulePage');

const WEEKLY = {
  weeklyTimes: [
    { weekday: 0, start: '07:30' }, // Monday 7:30 AM
    { weekday: 5, start: '10:00' }, // Saturday 10:00 AM
  ],
  sessionLengthMinutes: 50,
};

const MOCK_SESSIONS = [
  {
    id: '1',
    clientId: 'c1',
    title: 'Client One',
    type: 'Individual Therapy',
    startsAt: new Date(2026, 10, 4, 9, 0).toISOString(),
    endsAt: new Date(2026, 10, 4, 9, 50).toISOString(),
    category: 'individual' as const,
    status: 'CONFIRMED',
  },
  {
    id: '2',
    clientId: 'c2',
    title: 'Client Two',
    type: 'Consultation',
    startsAt: new Date(2026, 10, 7, 10, 0).toISOString(),
    endsAt: new Date(2026, 10, 7, 10, 50).toISOString(),
    category: 'individual' as const,
    status: 'CONFIRMED',
  },
];

const CLIENTS = [
  { id: 'c1', name: 'Client One', email: 'c1@test.com', care: 'individual', initials: 'CO' },
  { id: 'c2', name: 'Client Two', email: 'c2@test.com', care: 'individual', initials: 'CT' },
];

function renderSchedule(overrides: { sessions?: typeof MOCK_SESSIONS; weekly?: typeof WEEKLY; timeOff?: Array<{ id: string; startsOn: string; endsOn: string; note: string | null }> } = {}) {
  const { sessions = MOCK_SESSIONS, weekly = WEEKLY, timeOff = [] } = overrides;
  apiGet.mockReset();
  apiGet.mockImplementation((url: string) =>
    Promise.resolve(url.includes('time-off') ? { timeOff } : weekly),
  );
  apiPost.mockReset();
  apiPost.mockResolvedValue({ id: 'new-slot' });

  return renderWithApp(
    <SchedulePage sessions={sessions} setSessions={() => {}} clients={CLIENTS} />,
    { route: '/dashboard/schedule' },
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SchedulePage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 4, 10, 0));
  });

  it('renders the schedule with Add open time button', async () => {
    renderSchedule();
    const addButton = await screen.findByRole('button', { name: /add open time/i });
    expect(addButton).toBeTruthy();
  });

  it('hours follow the weekly availability', async () => {
    // Monday starts at 07:30, so the grid opens at 7 AM rather than the 8 AM default.
    const { container } = renderSchedule();
    await waitFor(() => expect(container.querySelector('[data-hour="7"]')).toBeTruthy());
    // The last label is 5 PM because the default close of 6 PM bounds the rows.
    expect(container.querySelector('[data-hour="17"]')).toBeTruthy();
    expect(container.querySelector('[data-hour="18"]')).toBeNull();
  });

  it('shows service names from sessions in the legend', async () => {
    renderSchedule();
    expect(await screen.findByText('Individual Therapy')).toBeTruthy();
    expect(await screen.findByText('Consultation')).toBeTruthy();
  });

  it('shows Saturday when worked in weekly availability', async () => {
    renderSchedule();
    // Check for Saturday column header in the week view
    expect(await screen.findByText('SAT')).toBeTruthy();
  });

  it('shows a grey block for days the therapist is away', async () => {
    renderSchedule({
      timeOff: [{ id: 't1', startsOn: '2026-11-05', endsOn: '2026-11-05', note: 'Conference' }],
    });
    // Thursday 5 November is in the 2-8 November week.
    expect(await screen.findByText('Conference')).toBeTruthy();
    expect(screen.getByText('Away')).toBeTruthy();
  });

  it('does not open the add-slot form on a day away', async () => {
    renderSchedule({
      timeOff: [{ id: 't1', startsOn: '2026-11-05', endsOn: '2026-11-05', note: null }],
    });
    await screen.findAllByText('Away');
    expect(apiGet).toHaveBeenCalledWith('/v1/consult/therapist/time-off');
    // No slot dialog was opened by rendering the away day.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Add open time posts only startsAt and endsAt', async () => {
    const { container } = renderSchedule();

    fireEvent.click(screen.getByRole('button', { name: /add open time/i }));

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-11-05' } });
    fireEvent.change(timeInput, { target: { value: '14:00' } });

    const submit = screen.getAllByRole('button', { name: /add open time/i }).at(-1)!;
    fireEvent.click(submit);

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    const [path, body] = apiPost.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe('/v1/consult/therapist/availability');
    expect(Object.keys(body).sort()).toEqual(['endsAt', 'startsAt']);
  });
});