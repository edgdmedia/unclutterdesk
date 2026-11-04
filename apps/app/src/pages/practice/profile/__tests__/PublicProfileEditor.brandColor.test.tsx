import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../../../test/renderWithApp';

/* Task 7 wiring: the editor sends the custom colour and treats a plan gate as an upgrade, not an error. */

const get = vi.fn();
const patch = vi.fn();
const put = vi.fn();
const post = vi.fn();
vi.mock('../../../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../utils/apiClient')>();
  return {
    ...real,
    api: {
      ...real.api,
      get: (...a: unknown[]) => get(...a),
      patch: (...a: unknown[]) => patch(...a),
      put: (...a: unknown[]) => put(...a),
      post: (...a: unknown[]) => post(...a),
    },
  };
});
vi.mock('../../../../config/domains', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../config/domains')>();
  return { ...real, profilePath: (handle: string) => `https://profiles.test/${handle}` };
});

const { PublicProfileEditor } = await import('../PublicProfileEditor');
const { ApiError } = await import('../../../../utils/apiClient');

const PROFILE = {
  id: '1',
  handle: 'ada-obi',
  status: 'DRAFT',
  kind: 'COUNSELLOR',
  templateKey: null,
  themeKey: 'calm',
  layoutKey: 'classic',
  brandColor: null,
  displayName: 'Ada Obi',
  pronouns: null,
  photoKey: null,
  headline: null,
  about: null,
  approach: null,
  credentialsText: null,
  city: null,
  countryCode: 'NG',
  offersOnline: true,
  offersInPerson: false,
  acceptingClients: true,
  faithIntegration: null,
  supervisedBy: null,
  showPlatformExperience: false,
  selfReportedYears: null,
  feeRangeText: null,
  contactEmailPublic: null,
  socialLinks: [],
  completenessScore: 20,
  publishedAt: null,
  taxonomy: [],
  timeline: [],
};

function serve({ customBrandColor = true } = {}) {
  get.mockImplementation((path: string) => {
    if (path === '/v1/practitioner-profile/me') return Promise.resolve(PROFILE);
    if (path === '/v1/practitioner-profile/templates') return Promise.resolve([]);
    if (path === '/v1/practitioner-profile/taxonomy') return Promise.resolve([]);
    if (path === '/v1/practitioner-profile/me/checklist') {
      return Promise.resolve({ score: 20, sections: [], next: null, canPublish: false, blockers: [], tips: [], unchangedTemplateText: [] });
    }
    if (path === '/v1/me/profile-entitlements') {
      return Promise.resolve({ downloadablePdf: customBrandColor, introVideo: customBrandColor, customBrandColor });
    }
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

beforeEach(() => {
  for (const f of [get, patch, put, post]) f.mockReset();
  patch.mockImplementation(async (_p: string, body: Record<string, unknown>) => ({ ...PROFILE, ...body }));
});
afterEach(cleanup);

describe('custom brand colour in the editor', () => {
  it('sends the palette and the colour together', async () => {
    serve();
    renderWithApp(<PublicProfileEditor />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Brand colour hex'), { target: { value: '#2a56a8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save colour' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/v1/practitioner-profile/me', { themeKey: 'custom', brandColor: '#2A56A8' }),
    );
  });

  it('treats a plan gate as the upgrade prompt, not an error toast', async () => {
    serve();
    patch.mockRejectedValueOnce(
      new ApiError('Custom brand colour needs the Starter plan.', 402, {
        code: 'ENTITLEMENT_REQUIRED',
        scope: 'profile',
        feature: 'customBrandColor',
        requiredTier: 'STARTER',
        message: 'Custom brand colour needs the Starter plan.',
      }),
    );
    renderWithApp(<PublicProfileEditor />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Brand colour hex'), { target: { value: '#2A56A8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save colour' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(screen.queryByText('Custom brand colour needs the Starter plan.')).toBeNull();
  });
});