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
  cnameTarget: 'tag.my.cloudflare.net',
  records: [{ name: 'book.acme.ng', type: 'CNAME', data: 'verify.tag.my.cloudflare.net' }],
  cfStatus: { status: 'pending', sslStatus: 'initializing' },
};

beforeEach(() => {
  apiGet.mockReset(); apiPatch.mockReset(); apiPost.mockReset();
  apiGet.mockResolvedValue(PENDING);
  apiPatch.mockResolvedValue({});
});
afterEach(cleanup);

describe('the custom domain panel', () => {
  it('shows what is waiting and the records to publish', async () => {
    renderWithApp(<CustomDomainPanel />);
    expect(await screen.findByText('Waiting on DNS')).toBeTruthy();
    expect(screen.getByText('verify.tag.my.cloudflare.net')).toBeTruthy();
    expect(screen.getByText('tag.my.cloudflare.net')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy CNAME target' })).toBeTruthy();
    expect(screen.getByText(/certificate initializing/)).toBeTruthy();
  });

  it('saves through the brand endpoint and reloads', async () => {
    renderWithApp(<CustomDomainPanel />);
    const field = await screen.findByDisplayValue('book.acme.ng');
    fireEvent.change(field, { target: { value: 'book.newpractice.ng' } });
    fireEvent.click(screen.getByRole('button', { name: /Save domain/ }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/v1/tenant/brand', { customDomain: 'book.newpractice.ng' }));
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
  });

  it('a live domain shows the promise it delivers', async () => {
    apiGet.mockResolvedValue({ ...PENDING, status: 'ACTIVE', records: [], cnameTarget: null, cfStatus: null });
    renderWithApp(<CustomDomainPanel />);
    expect(await screen.findByText('Live')).toBeTruthy();
    expect(screen.getByText(/now use https:\/\/book.acme.ng/)).toBeTruthy();
    expect(screen.queryByText('Waiting on DNS')).toBeNull();
  });

  it('Check now calls verify and surfaces its answer', async () => {
    apiPost.mockRejectedValue(new Error('not ready yet, add a CNAME'));
    renderWithApp(<CustomDomainPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Check now/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/tenant/brand/custom-domain/verify', {}));
    await waitFor(() => expect(screen.getByText(/not ready yet/)).toBeTruthy());
  });
});
