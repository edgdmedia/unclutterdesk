import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act, cleanup, renderWithApp, screen, waitFor } from '../../../../test/renderWithApp';

const get = vi.fn();
vi.mock('../../../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => get(...a) },
  apiRequest: vi.fn(),
}));
const { useBookingData } = await import('../useBookingData');

const practice = { id: '27', name: 'Smith Therapy', logoUrl: null, primaryColor: '#24614F', secondaryColor: '#8A5A3C', publicEmail: 'hi@smith.ng', publicPhone: '080', address: null, city: 'Lagos', cancellationHours: 24 };
const services = [{ id: '4', title: 'Individual therapy', durationMinutes: 50, priceKobo: '3500000' }];
const slots = [{ id: '5', serviceId: null, therapistName: 'Sarah Smith', startsAt: '2026-10-06T10:30:00Z', endsAt: '2026-10-06T11:20:00Z', channel: 'VIDEO' }];

let reload: () => Promise<unknown> = async () => [];
function Probe() {
  const d = useBookingData('smith');
  reload = d.reloadSlots;
  return <p>{d.status === 'ready' ? `ready ${d.practice?.name} ${d.services.length} ${d.slots.length} ${d.reviews.count} ${d.bankTransfer}` : d.status}</p>;
}

function network({ servicesFail = false } = {}) {
  get.mockImplementation(async (url: string) => {
    if (url === '/v1/tenant/public/info/smith') return practice;
    if (url === '/v1/consult/public/services') {
      if (servicesFail) throw new Error('down');
      return services;
    }
    if (url === '/v1/consult/public/availability') return slots;
    if (url === '/v1/intake/public/reviews') return { averageRating: 4.9, count: 32 };
    if (url === '/v1/consult/public/payment-options') return { online: true, bankTransfer: true };
    throw new Error(`unexpected ${url}`);
  });
}

beforeEach(() => get.mockReset());
afterEach(cleanup);

describe('useBookingData', () => {
  it('loads the practice, services, times, reviews and payment options', async () => {
    network();
    renderWithApp(<Probe />);
    expect(screen.getByText('loading')).toBeTruthy();
    expect(await screen.findByText('ready Smith Therapy 1 1 32 true')).toBeTruthy();
  });

  it('reports an error when the booking data cannot load', async () => {
    network({ servicesFail: true });
    renderWithApp(<Probe />);
    expect(await screen.findByText('error')).toBeTruthy();
  });

  it('re-checks the times on demand', async () => {
    network();
    renderWithApp(<Probe />);
    await screen.findByText(/^ready/);
    get.mockImplementation(async (url: string) => (url === '/v1/consult/public/availability' ? [] : undefined));
    let fresh: unknown;
    await act(async () => {
      fresh = await reload();
    });
    expect(fresh).toEqual([]);
    await waitFor(() => expect(screen.getByText('ready Smith Therapy 1 0 32 true')).toBeTruthy());
  });
});
