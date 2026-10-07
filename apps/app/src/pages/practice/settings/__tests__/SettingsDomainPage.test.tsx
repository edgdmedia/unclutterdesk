import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderWithApp, screen, cleanup } from '../../../../test/renderWithApp';
import React from 'react';

const apiGet = vi.fn();
vi.mock('../../../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), patch: vi.fn() },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
  practiceBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
  getAppType: () => 'app',
}));

const { SettingsDomainPage } = await import('../SettingsDomainPage');

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockImplementation((path: string) => {
    if (path === '/v1/tenant/brand') return Promise.resolve({ slug: 'edgdmedia' });
    if (path === '/v1/tenant/brand/custom-domain') {
      return Promise.resolve({
        id: '1', hostname: 'consult.unclutter.com.ng', status: 'PENDING', error: null,
        cnameTarget: 'customers.unclutterdesk.com',
        records: [{ type: 'CNAME', name: 'consult.unclutter.com.ng', value: 'customers.unclutterdesk.com', state: 'verified' }],
        cfStatus: { status: 'active', sslStatus: 'pending_validation' },
      });
    }
    return Promise.resolve([]);
  });
});
afterEach(cleanup);

describe('the booking address tab', () => {
  it('holds the unclutterdesk link and the custom domain, one page each', async () => {
    renderWithApp(<SettingsDomainPage />);
    expect((await screen.findByLabelText('Booking link') as HTMLInputElement).value).toBe('edgdmedia');
    expect(screen.getByRole('button', { name: /Save domain/i })).toBeTruthy();
    expect(screen.getAllByText('consult.unclutter.com.ng').length).toBeGreaterThan(0);
    expect(screen.getByText('Set')).toBeTruthy();
  });
});
