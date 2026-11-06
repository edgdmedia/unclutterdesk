import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

/**
 * Hours logged by hand can name the client: a session held outside a
 * booking, or group work. A session's own entry keeps the booking's client.
 */
const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    patch: (...a: unknown[]) => apiPatch(...a),
    delete: vi.fn(),
    put: vi.fn(),
  },
  apiDownload: vi.fn(),
  TENANT_SLUG: 'dr-smith',
}));

const { HoursLogPage } = await import('../practice/HoursLogPage');

const LOG = {
  totals: { totalMinutes: 100, clientMinutes: 100, supervisionMinutes: 0, byCategory: {} },
  target: null,
  entries: [
    { id: '1', date: '2026-11-03T00:00:00.000Z', durationMinutes: 50, category: 'DIRECT_CLIENT', source: 'MANUAL', clientName: 'Ada Ola', clientProfileId: '40', notes: null, supervisorName: null },
    { id: '2', date: '2026-11-02T00:00:00.000Z', durationMinutes: 50, category: 'DIRECT_CLIENT', source: 'BOOKING', clientName: 'Bola Ade', clientProfileId: '41', notes: null, supervisorName: null },
  ],
};

beforeEach(() => {
  apiGet.mockReset().mockImplementation((p: string) =>
    Promise.resolve(p === '/v1/hours' ? LOG : p === '/v1/tenant/clients' ? [{ id: '40', name: 'Ada Ola' }, { id: '41', name: 'Bola Ade' }] : []),
  );
  apiPost.mockReset().mockResolvedValue({});
  apiPatch.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe('the client on an hours entry', () => {
  it('logs hours against a chosen client', async () => {
    renderWithApp(<HoursLogPage />);
    const select = (await screen.findByLabelText('Client')) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(3));
    fireEvent.change(select, { target: { value: '41' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add hours' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/hours', expect.objectContaining({ clientProfileId: '41' })));
  });

  it('logs with no client when none is chosen', async () => {
    renderWithApp(<HoursLogPage />);
    await screen.findByLabelText('Client');
    fireEvent.click(screen.getByRole('button', { name: 'Add hours' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/hours', expect.objectContaining({ clientProfileId: null })));
  });
});
