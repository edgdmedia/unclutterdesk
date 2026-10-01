import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { SWRConfig } from 'swr';
import { cleanup, fireEvent, renderWithApp, screen, waitFor, within } from '../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return {
    ...real,
    api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), patch: (...a: unknown[]) => patch(...a) },
  };
});
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ profile: { id: '55', type: 'therapist', tenantId: '27', tenantSlug: 'calm', plan: 'PRO' }, refreshProfile: vi.fn() }),
}));
const { AdminRequestsPage } = await import('../admin/AdminRequestsPage');
const { RequestsPage } = await import('../practice/RequestsPage');

const templateRow = {
  id: '30',
  type: 'TEMPLATE',
  subject: 'Share form template: Sleep check',
  details: null,
  status: 'OPEN',
  adminNote: null,
  formTemplateId: '4',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  practice: { id: '27', name: 'Calm Rooms', slug: 'calm' },
};
const featureRow = { ...templateRow, id: '31', type: 'FEATURE', subject: 'Group sessions', formTemplateId: null };

function renderAdmin() {
  return renderWithApp(
    <SWRConfig value={{ fetcher: (key: string) => get(key), provider: () => new Map(), dedupingInterval: 0 }}>
      <AdminRequestsPage />
    </SWRConfig>,
  );
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  get.mockImplementation(async (url: string) =>
    url.startsWith('/v1/admin/requests')
      ? [templateRow, featureRow]
      : url === '/v1/admin/templates/4'
        ? { id: '4', title: 'Sleep check', practiceName: 'Calm Rooms', questionCount: 1, schemaJson: [{ id: 'q1', label: 'How are you sleeping?', type: 'text', required: true }] }
        : [],
  );
  post.mockResolvedValue({});
});
afterEach(cleanup);

describe('reviewing shared templates', () => {
  it('a template request offers review, not the generic status buttons', async () => {
    renderAdmin();
    const card = (await screen.findByText('Share form template: Sleep check')).closest('[data-request]') as HTMLElement;
    expect(within(card).getByRole('button', { name: /approve/i })).toBeTruthy();
    expect(within(card).getByRole('button', { name: /decline/i })).toBeTruthy();
    expect(within(card).queryByRole('button', { name: /planned/i })).toBeNull();
    const other = screen.getByText('Group sessions').closest('[data-request]') as HTMLElement;
    expect(within(other).getByRole('button', { name: /planned/i })).toBeTruthy();
  });

  it('approving sends the decision', async () => {
    renderAdmin();
    const card = (await screen.findByText('Share form template: Sleep check')).closest('[data-request]') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /approve/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/admin/templates/4/review', { decision: 'APPROVED' }));
  });

  it('declining sends the note for the practice', async () => {
    renderAdmin();
    const card = (await screen.findByText('Share form template: Sleep check')).closest('[data-request]') as HTMLElement;
    fireEvent.change(within(card).getByPlaceholderText(/note for the practice/i), { target: { value: 'Needs a consent question.' } });
    fireEvent.click(within(card).getByRole('button', { name: /decline/i }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/v1/admin/templates/4/review', { decision: 'DECLINED', note: 'Needs a consent question.' }),
    );
  });

  it('previews the questions and the real practice', async () => {
    renderAdmin();
    const card = (await screen.findByText('Share form template: Sleep check')).closest('[data-request]') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /preview/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/How are you sleeping\?/)).toBeTruthy();
    expect(within(dialog).getByText(/Calm Rooms/)).toBeTruthy();
  });

  it('the kind filter includes form templates', async () => {
    renderAdmin();
    await screen.findByText('Group sessions');
    expect(within(screen.getByLabelText('Type')).getByRole('option', { name: 'Form template' })).toBeTruthy();
  });
});

describe("a practice's own requests", () => {
  it('names a template share as a form template', async () => {
    get.mockResolvedValue([templateRow]);
    renderWithApp(<RequestsPage />);
    expect(await screen.findByText(/^Form template ·/)).toBeTruthy();
  });

  it("doesn't offer form template as something to ask for", async () => {
    get.mockResolvedValue([]);
    renderWithApp(<RequestsPage />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.queryByText('Form template')).toBeNull();
  });
});
