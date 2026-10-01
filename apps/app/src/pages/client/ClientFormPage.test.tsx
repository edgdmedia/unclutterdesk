import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
let profile: Record<string, unknown> | null = { id: '42', type: 'user', email: 'ada@example.com', firstName: 'Ada', lastName: 'O' };
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } };
});
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ profile, refreshProfile: vi.fn() }),
}));
const { ClientFormPage } = await import('./ClientFormPage');

const FORMS = [
  {
    id: '20',
    title: 'Client intake',
    description: 'The basics we need before your first session.',
    schemaJson: [
      { id: 'preferred_name', label: 'Preferred name', type: 'text', required: true },
      { id: 'reason', label: 'What brings you to therapy?', type: 'textarea', required: true },
      { id: 'previous', label: 'Have you been to therapy before?', type: 'single_choice', options: ['Yes', 'No'], required: true },
      { id: 'note', label: 'Anything else?', type: 'textarea', required: false },
    ],
  },
];

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockResolvedValue(FORMS);
  post.mockResolvedValue({ id: '77' });
  profile = { id: '42', type: 'user', email: 'ada@example.com', firstName: 'Ada', lastName: 'O' };
});
afterEach(cleanup);

describe('the client form page', () => {
  it('renders the form and posts the answers as the signed-in client', async () => {
    renderWithApp(<Routes><Route path="/forms/:id" element={<ClientFormPage />} /></Routes>, { route: '/forms/20?booking=900' });
    fireEvent.change(await screen.findByLabelText(/Preferred name/), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText(/What brings you/), { target: { value: 'A quiet mind.' } });
    fireEvent.click(screen.getByLabelText('Yes'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/v1/intake/public/submissions',
        expect.objectContaining({
          formId: '20',
          bookingId: '900',
          clientProfileId: '42',
          answersJson: expect.objectContaining({ preferred_name: 'Ada', previous: 'Yes' }),
        }),
      ),
    );
    await screen.findByText(/that’s saved/i);
  });

  it('names the missing question instead of failing silently', async () => {
    renderWithApp(<Routes><Route path="/forms/:id" element={<ClientFormPage />} /></Routes>, { route: '/forms/20' });
    await screen.findByLabelText(/Preferred name/);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect((await screen.findByText(/Please answer/)).textContent).toMatch(/Preferred name/);
    expect(post).not.toHaveBeenCalled();
  });

  it('asks a signed-out visitor to sign in first', async () => {
    profile = null;
    renderWithApp(<Routes><Route path="/forms/:id" element={<ClientFormPage />} /></Routes>, { route: '/forms/20' });
    await screen.findByLabelText(/Preferred name/);
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login');
    expect(screen.getByText(/so the practice knows whose answers/i)).toBeTruthy();
  });

  it('says so when the form is gone', async () => {
    get.mockResolvedValue([]);
    renderWithApp(<Routes><Route path="/forms/:id" element={<ClientFormPage />} /></Routes>, { route: '/forms/99' });
    expect((await screen.findByText(/could not be found/i)).textContent).toBeTruthy();
  });
});
