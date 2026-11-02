import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, renderWithApp, screen } from '../../../test/renderWithApp';
import { ApiError, apiRequest } from '../../../utils/apiClient';
import { UpgradePrompt } from '../UpgradePrompt';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function respond(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status, ok: status < 400, json: async () => body }));
}

describe('402 ENTITLEMENT_REQUIRED (spec §5.1)', () => {
  it('surfaces as an ApiError carrying the plan, still an Error with the message', async () => {
    respond(402, { statusCode: 402, code: 'ENTITLEMENT_REQUIRED', scope: 'practice', feature: 'customDomain', requiredTier: 'PRO', message: 'Custom domain requires the Pro plan.' });
    const err = (await apiRequest('/v1/tenant/brand', { method: 'PATCH', body: {} }).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Custom domain requires the Pro plan.');
    expect(err.entitlement).toEqual({ requiredTier: 'PRO', feature: 'customDomain', scope: 'practice', message: 'Custom domain requires the Pro plan.' });
  });

  it('opens one upgrade prompt naming the plan, wherever the call was made', async () => {
    renderWithApp(<UpgradePrompt />);
    respond(402, { code: 'ENTITLEMENT_REQUIRED', requiredTier: 'STARTER', feature: 'bankTransferPayments', message: 'Bank transfer payments are part of the Starter plan and above.' });
    await act(async () => {
      await apiRequest('/v1/consult/manual-payments/settings', { method: 'PATCH', body: {} }).catch(() => undefined);
    });
    expect(screen.getByRole('dialog', { name: 'This is part of the Starter plan' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See the Starter plan' }).getAttribute('href')).toBe('/dashboard/settings/subscription');
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays out of the way for other errors, including other 402s', async () => {
    renderWithApp(<UpgradePrompt />);
    for (const [status, body] of [[400, { message: 'Bad' }], [402, { message: 'Payment needed' }], [403, { message: 'No' }]] as const) {
      respond(status, body);
      await act(async () => {
        await apiRequest('/v1/x').catch(() => undefined);
      });
    }
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
