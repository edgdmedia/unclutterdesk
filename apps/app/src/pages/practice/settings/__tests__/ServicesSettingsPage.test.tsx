import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock('../../../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), patch: (...a: unknown[]) => patch(...a) } };
});
const { ServicesSettingsPage } = await import('../ServicesSettingsPage');

const SERVICES = [
  {
    id: '7', title: 'Individual Therapy', description: null, durationMinutes: 50, priceKobo: '3000000', isActive: true,
    formats: [
      { format: 'ONLINE', priceKobo: '3000000', isActive: true },
      { format: 'IN_PERSON', priceKobo: '3500000', isActive: true },
    ],
  },
];

beforeEach(() => {
  get.mockReset().mockResolvedValue(SERVICES);
  post.mockReset();
  patch.mockReset();
  patch.mockResolvedValue(SERVICES[0]);
  post.mockResolvedValue({ id: '8', title: 'New', description: null, durationMinutes: 50, priceKobo: '2000000', isActive: true, formats: [{ format: 'ONLINE', priceKobo: '2000000', isActive: true }] });
});
afterEach(cleanup);

describe('services and their per-format prices', () => {
  it('shows each format and its price on the service row', async () => {
    renderWithApp(<ServicesSettingsPage />);
    await screen.findByText('Individual Therapy');
    expect(screen.getByText(/Online ₦30,000/)).toBeTruthy();
    expect(screen.getByText(/In person ₦35,000/)).toBeTruthy();
  });

  it('editing shows both rows with switches and prices, and saving sends formats', async () => {
    renderWithApp(<ServicesSettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Edit Individual Therapy/i }));
    const inPerson = await screen.findByRole('checkbox', { name: /^In person$/i });
    expect((screen.getByDisplayValue('35000') as HTMLInputElement)).toBeTruthy();
    fireEvent.click(inPerson);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/v1/consult/services/7',
        expect.objectContaining({
          formats: [
            { format: 'ONLINE', priceKobo: '3000000', isActive: true },
            { format: 'IN_PERSON', priceKobo: '3500000', isActive: false },
          ],
        }),
      ),
    );
  });

  it('"Same price for both" copies the online price', async () => {
    renderWithApp(<ServicesSettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Edit Individual Therapy/i }));
    const same = await screen.findByLabelText(/same price for both/i);
    fireEvent.click(same);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/v1/consult/services/7',
        expect.objectContaining({
          formats: expect.arrayContaining([
            { format: 'IN_PERSON', priceKobo: '3000000', isActive: true },
          ]),
        }),
      ),
    );
  });

  it('a new service can be online-only', async () => {
    get.mockResolvedValue([]);
    renderWithApp(<ServicesSettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /^Add service$/i }));
    fireEvent.change(await screen.findByLabelText(/^Name$/i), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText(/Price \(₦\) Online/i), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: /create service/i }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/v1/consult/services',
        expect.objectContaining({
          formats: [
            { format: 'ONLINE', priceKobo: '2000000', isActive: true },
            { format: 'IN_PERSON', priceKobo: '0', isActive: false },
          ],
        }),
      ),
    );
  });
});
