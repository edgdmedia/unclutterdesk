import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const get = vi.fn();
const patch = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => get(...a), patch: (...a: unknown[]) => patch(...a) },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
}));
const { BookingLinkCard } = await import('../settings/BookingLinkCard');

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
});
afterEach(cleanup);

function network(available = true) {
  get.mockImplementation(async (url: string) => {
    if (url.startsWith('/v1/tenant/check-slug/')) return { available, reason: available ? undefined : 'Slug is already taken' };
    return {};
  });
}

describe('BookingLinkCard', () => {
  it('shows the current link and saves a new one after warning that the old link stops working', async () => {
    network();
    patch.mockResolvedValue({ slug: 'calmrooms' });
    const onSaved = vi.fn();
    renderWithApp(<BookingLinkCard slug="calm-rooms-4821" onSaved={onSaved} />);

    const input = screen.getByLabelText('Booking link') as HTMLInputElement;
    expect(input.value).toBe('calm-rooms-4821');
    fireEvent.change(input, { target: { value: 'CalmRooms' } });
    expect(await screen.findByText('https://calmrooms.unclutterdesk.com')).toBeTruthy();
    expect(screen.getByText(/old link will stop working/i)).toBeTruthy();

    await waitFor(() => expect((screen.getByRole('button', { name: 'Save booking link' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Save booking link' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/tenant/brand', { slug: 'calmrooms' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('will not save a link someone else has', async () => {
    network(false);
    renderWithApp(<BookingLinkCard slug="calm-rooms-4821" />);
    fireEvent.change(screen.getByLabelText('Booking link'), { target: { value: 'taken-one' } });
    expect(await screen.findByText(/already taken/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save booking link' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the reason when the server refuses', async () => {
    network();
    patch.mockRejectedValue(new Error('That booking handle is already taken. Try another one.'));
    renderWithApp(<BookingLinkCard slug="calm-rooms-4821" />);
    fireEvent.change(screen.getByLabelText('Booking link'), { target: { value: 'raced' } });
    await screen.findByText('https://raced.unclutterdesk.com');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save booking link' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Save booking link' }));
    expect(await screen.findByText(/already taken/i)).toBeTruthy();
  });
});
