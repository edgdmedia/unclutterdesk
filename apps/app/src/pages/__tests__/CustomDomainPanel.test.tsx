import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, renderWithApp, screen, waitFor, cleanup } from '../../test/renderWithApp';
import React from 'react';

const apiGet = vi.fn();
const apiPatch = vi.fn();
const apiPost = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    patch: (...a: unknown[]) => apiPatch(...a),
    post: (...a: unknown[]) => apiPost(...a),
  },
}));

const { CustomDomainPanel } = await import('../practice/settings/CustomDomainPanel');

const PENDING = {
  id: '1', hostname: 'book.acme.ng', status: 'PENDING', error: null,
  cnameTarget: 'customers.unclutterdesk.com',
  records: [
    { type: 'CNAME', name: 'book.acme.ng', value: 'customers.unclutterdesk.com', state: 'verified' },
    { type: 'TXT', name: '_cf-custom-hostname.book.acme.ng', value: 'own-123', state: 'verified' },
    { type: 'TXT', name: '_dcv.book.acme.ng', value: 'dcv-456', state: 'missing' },
  ],
  cfStatus: { status: 'active', sslStatus: 'pending_validation' },
};

const ENTITLED = { tier: 'PRO', tierName: 'Pro', entitlements: { customDomain: true }, usage: {} };
let domain: unknown = PENDING;
let plan: unknown = ENTITLED;
const domainGets = () => apiGet.mock.calls.filter(([url]) => url === '/v1/tenant/brand/custom-domain').length;

beforeEach(() => {
  apiGet.mockReset(); apiPatch.mockReset(); apiPost.mockReset();
  domain = PENDING;
  plan = ENTITLED;
  apiGet.mockImplementation(async (url: string) => (url === '/v1/tenant/entitlements' ? plan : domain));
  apiPatch.mockResolvedValue({});
});
afterEach(cleanup);

describe('the custom domain panel', () => {
  it('lists every expected record with a per-record DNS status', async () => {
    renderWithApp(<CustomDomainPanel />);
    expect(await screen.findByText('Waiting on DNS')).toBeTruthy();
    expect(screen.getAllByText('Set')).toHaveLength(2);
    expect(screen.getAllByText('Not found yet')).toHaveLength(1);
    expect(screen.getByText('_dcv.book.acme.ng')).toBeTruthy();
    expect(screen.getByText(/certificate: pending_validation/)).toBeTruthy();
  });

  it('re-checks on demand and verifies on request', async () => {
    apiPost.mockResolvedValue({ customDomainStatus: 'ACTIVE' });
    renderWithApp(<CustomDomainPanel />);
    await screen.findByText('Waiting on DNS');
    fireEvent.click(screen.getByRole('button', { name: /Re-check/ }));
    await waitFor(() => expect(domainGets()).toBe(2));
    fireEvent.click(screen.getByRole('button', { name: /Verify & go live/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/tenant/brand/custom-domain/verify', {}));
  });

  it('saves through the brand endpoint and reloads', async () => {
    renderWithApp(<CustomDomainPanel />);
    const field = await screen.findByDisplayValue('book.acme.ng');
    fireEvent.change(field, { target: { value: 'Book.NewPractice.NG ' } });
    fireEvent.click(screen.getByRole('button', { name: /Save domain/ }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/v1/tenant/brand', { customDomain: 'book.newpractice.ng' }));
  });

  it('a live domain shows the promise it delivers', async () => {
    domain = { ...PENDING, status: 'ACTIVE', records: [], cfStatus: null };
    renderWithApp(<CustomDomainPanel />);
    expect(await screen.findByText('Live')).toBeTruthy();
    expect(screen.getByText(/https:\/\/book\.acme\.ng/)).toBeTruthy();
  });

  it('a stored failure is shown, not hidden', async () => {
    domain = { ...PENDING, error: 'Cloudflare 1413: quota', records: [] };
    renderWithApp(<CustomDomainPanel />);
    expect(await screen.findByText('Cloudflare 1413: quota')).toBeTruthy();
  });

  it('shows the field locked with a way to the plans when the plan has no custom domain', async () => {
    domain = { ...PENDING, hostname: null, status: null, records: [] };
    plan = { tier: 'STARTER', tierName: 'Starter', entitlements: { customDomain: false }, usage: {} };
    renderWithApp(<CustomDomainPanel />);
    expect(await screen.findByText(/A custom domain is part of the Pro plan. You're on Starter./)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See plans' }).getAttribute('href')).toBe('/dashboard/settings/subscription');
    expect(screen.queryByRole('button', { name: /Save domain/ })).toBeNull();
  });

  it('keeps an existing domain manageable after a downgrade, so it can be removed', async () => {
    plan = { tier: 'FREE', tierName: 'Free', entitlements: { customDomain: false }, usage: {} };
    renderWithApp(<CustomDomainPanel />);
    expect(await screen.findByDisplayValue('book.acme.ng')).toBeTruthy();
    expect(screen.queryByText(/part of the Pro plan/)).toBeNull();
  });
});
