import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../../../test/renderWithApp';

const get = vi.fn();
const apiDownload = vi.fn();
vi.mock('../../../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => get(...a) },
  apiDownload: (...a: unknown[]) => apiDownload(...a),
  ENTITLEMENT_REQUIRED_EVENT: 'unclutter:entitlement-required',
}));
vi.mock('../../../../config/domains', () => ({
  profilePath: (handle: string) => `https://profiles.test/${handle}`,
}));

const { ShareKit } = await import('../ShareKit');
const { UpgradePrompt } = await import('../../../../components/billing/UpgradePrompt');

const PROFILE = {
  id: '1',
  handle: 'ada-obi',
  status: 'PUBLISHED',
  displayName: 'Ada Obi',
  kind: 'COUNSELLOR',
  themeKey: 'calm',
};

function network({ status = 'PUBLISHED', pdf = false }: { status?: string; pdf?: boolean } = {}) {
  get.mockImplementation(async (path: string) => {
    if (path === '/v1/practitioner-profile/me') return { ...PROFILE, status };
    if (path === '/v1/me/profile-entitlements') return { downloadablePdf: pdf, introVideo: pdf };
    return {};
  });
}

beforeEach(() => {
  get.mockReset();
  apiDownload.mockReset();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(cleanup);

describe('ShareKit', () => {
  it('shows the profile link, a copy button, WhatsApp share and the Instagram tip', async () => {
    network();
    renderWithApp(<ShareKit />);

    const link = (await screen.findByLabelText('Your profile link')) as HTMLInputElement;
    expect(link.value).toBe('https://profiles.test/ada-obi');

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://profiles.test/ada-obi'));
    expect(await screen.findByText('Link copied')).toBeTruthy();

    const whatsapp = screen.getByRole('link', { name: /WhatsApp/i });
    expect(whatsapp.getAttribute('href')).toContain('https://wa.me/?text=');
    expect(decodeURIComponent(whatsapp.getAttribute('href')!)).toContain('https://profiles.test/ada-obi');

    expect(screen.getByText('Instagram bio tip:', { selector: 'span' })).toBeTruthy();
  });

  it('downloads the QR through the API', async () => {
    network();
    renderWithApp(<ShareKit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Download QR (PNG)' }));
    await waitFor(() =>
      expect(apiDownload).toHaveBeenCalledWith('/v1/practitioner-profile/me/share/qr?format=png', 'ada-obi-qr.png'),
    );
  });

  it('locks the PDF for a Free plan and offers the upgrade prompt', async () => {
    network({ pdf: false });
    renderWithApp(
      <>
        <ShareKit />
        <UpgradePrompt />
      </>,
    );

    expect(await screen.findByText('Part of the Starter plan')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download profile PDF' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /See the Starter plan/i }));
    // The shared upgrade prompt is what the app mounts globally.
    expect(await screen.findByText('This is part of the Starter plan')).toBeTruthy();
  });

  it('downloads the PDF for a paid plan', async () => {
    network({ pdf: true });
    renderWithApp(<ShareKit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Download profile PDF' }));
    await waitFor(() =>
      expect(apiDownload).toHaveBeenCalledWith('/v1/practitioner-profile/me/share/pdf', 'ada-obi-profile.pdf'),
    );
  });

  it('says the link works once the profile is published', async () => {
    network({ status: 'DRAFT' });
    renderWithApp(<ShareKit />);
    expect(await screen.findByText(/works once (your profile is|it is) published/i)).toBeTruthy();
  });
});