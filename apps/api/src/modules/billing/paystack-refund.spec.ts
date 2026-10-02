import { describe, it, expect, vi, afterEach } from 'vitest';
import { PaystackService } from './paystack.service';

describe('Paystack refund', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refunds the whole transaction by its reference', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, data: { id: 77, status: 'pending' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const res = await new PaystackService().refundTransaction('booking-900-1');
    expect(res).toEqual({ id: 77, status: 'pending' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.paystack.co/refund');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ transaction: 'booking-900-1' });
  });
});
