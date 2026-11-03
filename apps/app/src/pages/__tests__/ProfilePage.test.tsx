import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor, within } from '../../test/renderWithApp';

/*
 * The merged profile page (/dashboard/profile): the public-profile editor and
 * the practice settings, in two tabs. Real router, brand and toasts; only the
 * network is faked.
 */
const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const put = vi.fn();
const del = vi.fn();
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return {
    ...real,
    api: {
      ...real.api,
      get: (...a: unknown[]) => get(...a),
      post: (...a: unknown[]) => post(...a),
      patch: (...a: unknown[]) => patch(...a),
      put: (...a: unknown[]) => put(...a),
      delete: (...a: unknown[]) => del(...a),
    },
  };
});
const { ProfilePage } = await import('../practice/profile/ProfilePage');

const TERMS = [
  { id: '1', kind: 'SPECIALTY', key: 'anxiety', label: 'Anxiety' },
  { id: '2', kind: 'SPECIALTY', key: 'grief', label: 'Grief & loss' },
  { id: '3', kind: 'SPECIALTY', key: 'stress', label: 'Stress' },
  { id: '4', kind: 'SPECIALTY', key: 'burnout', label: 'Burnout' },
  { id: '5', kind: 'LANGUAGE', key: 'english', label: 'English' },
];
const TEMPLATES = [
  { key: 'general', title: 'General', description: '', kind: null, sections: { guidance: { about: 'Write to the person reading.' }, sections: {}, suggested: {} } },
  {
    key: 'private-practice-counsellor',
    title: 'Counsellor in private practice',
    description: '',
    kind: 'COUNSELLOR',
    sections: {
      guidance: { about: 'Write to the person reading.' },
      sections: { about: { prompt: 'What do people usually come to you with?', example: 'People often come to me when things feel heavy.' } },
      suggested: {},
    },
  },
];

const PROFILE = {
  id: '1',
  handle: 'adaeze',
  status: 'DRAFT',
  kind: 'COUNSELLOR',
  templateKey: 'private-practice-counsellor',
  themeKey: 'calm',
  layoutKey: 'classic',
  displayName: 'Adaeze Okonkwo',
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
  socialLinks: null,
  completenessScore: 15,
  publishedAt: null,
  taxonomy: [] as unknown[],
  timeline: [] as unknown[],
};

const NOT_READY = {
  score: 15,
  sections: [],
  next: 'about',
  canPublish: false,
  blockers: [
    { key: 'headline', message: 'Add a one-line headline' },
    { key: 'about', message: 'Write at least 150 characters about yourself' },
  ],
  tips: [],
  unchangedTemplateText: [],
};

function serve({ profile = PROFILE as unknown, checklist = NOT_READY as unknown } = {}) {
  get.mockImplementation((path: string) => {
    if (path === '/v1/practitioner-profile/me') return Promise.resolve(profile);
    if (path === '/v1/practitioner-profile/templates') return Promise.resolve(TEMPLATES);
    if (path === '/v1/practitioner-profile/taxonomy') return Promise.resolve(TERMS);
    if (path === '/v1/practitioner-profile/me/checklist') return Promise.resolve(checklist);
    if (path.startsWith('/v1/practitioner-profile/handle-check/')) return Promise.resolve({ handle: 'ada', available: true });
    if (path === '/v1/tenant/locations') return Promise.resolve([]);
    if (path === '/v1/consult/therapist/profile') return Promise.resolve({ firstName: 'Adaeze', specialty: 'Anxiety', offersOnline: true, locationIds: [] });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

beforeEach(() => {
  for (const f of [get, post, patch, put, del]) f.mockReset();
  patch.mockImplementation(async (_p: string, body: Record<string, unknown>) => ({ ...PROFILE, ...body }));
  put.mockImplementation(async () => PROFILE);
});
afterEach(cleanup);

describe('the public profile tab', () => {
  it('offers to start a profile when there is none, and opens the editor once created', async () => {
    serve({ profile: null });
    post.mockResolvedValue(PROFILE);
    renderWithApp(<ProfilePage />, { route: '/dashboard/profile' });

    expect(await screen.findByRole('heading', { name: 'Create your therapist profile' })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('adaeze-okonkwo'), { target: { value: 'ada' } });
    expect(await screen.findByText('Available')).toBeTruthy();

    serve({ profile: PROFILE });
    fireEvent.click(screen.getByRole('button', { name: 'Create my profile' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/practitioner-profile', { handle: 'ada', kind: 'COUNSELLOR' }));
    expect(await screen.findByRole('heading', { name: 'Identity' })).toBeTruthy();
  });

  it('shows the score, the next step and what blocks publishing, with Publish disabled', async () => {
    serve();
    renderWithApp(<ProfilePage />, { route: '/dashboard/profile' });
    const checklist = await screen.findByRole('complementary', { name: 'Profile checklist' });
    expect(within(checklist).getByText('15%')).toBeTruthy();
    expect(within(checklist).getByRole('link', { name: 'About' }).getAttribute('href')).toBe('#section-about');
    expect(within(checklist).getByText('Add a one-line headline')).toBeTruthy();
    expect((within(checklist).getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the template's prompt and guidance, and inserts its example on request", async () => {
    serve();
    renderWithApp(<ProfilePage />, { route: '/dashboard/profile' });
    const about = (await screen.findByRole('heading', { name: 'About' })).closest('[id="section-about"]') as HTMLElement;
    expect(within(about).getByText('What do people usually come to you with?')).toBeTruthy();
    expect(within(about).getByText('Write to the person reading.')).toBeTruthy();
    fireEvent.click(within(about).getByRole('button', { name: 'Use this example as a starting point' }));
    expect((within(about).getByLabelText('About you') as HTMLTextAreaElement).value).toBe('People often come to me when things feel heavy.');
  });

  it('saves only what changed, then refreshes the checklist', async () => {
    serve();
    renderWithApp(<ProfilePage />, { route: '/dashboard/profile' });
    const about = (await screen.findByLabelText('About you')) as HTMLTextAreaElement;
    expect((screen.getByRole('button', { name: 'All changes saved' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(about, { target: { value: 'I help adults with anxiety.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch.mock.calls[0][0]).toBe('/v1/practitioner-profile/me');
    expect(patch.mock.calls[0][1]).toMatchObject({ about: 'I help adults with anxiety.', socialLinks: null });
    expect(put).not.toHaveBeenCalled(); // terms and timeline untouched
    await waitFor(() => expect(get.mock.calls.filter(([p]) => p === '/v1/practitioner-profile/me/checklist')).toHaveLength(2));
  });

  it('allows at most three primary specialties', async () => {
    serve();
    renderWithApp(<ProfilePage />, { route: '/dashboard/profile' });
    for (const label of ['Anxiety', 'Grief & loss', 'Stress', 'Burnout']) fireEvent.click(await screen.findByRole('button', { name: label }));
    for (const label of ['Anxiety', 'Grief & loss', 'Stress']) fireEvent.click(screen.getByRole('button', { name: `Mark ${label} as a primary specialty` }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark Burnout as a primary specialty' }));

    expect(await screen.findByText('Choose at most 3 primary specialties')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark Burnout as a primary specialty' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    const [path, body] = put.mock.calls[0];
    expect(path).toBe('/v1/practitioner-profile/me/taxonomy');
    expect(body.terms.filter((t: { isPrimary: boolean }) => t.isPrimary)).toHaveLength(3);
  });

  it('publishes a ready profile and says when template text is still unchanged', async () => {
    serve({ checklist: { ...NOT_READY, canPublish: true, blockers: [], unchangedTemplateText: ['about'] } });
    post.mockResolvedValue({ profile: { ...PROFILE, status: 'PUBLISHED' }, warnings: { unchangedTemplateText: ['about'] } });
    renderWithApp(<ProfilePage />, { route: '/dashboard/profile' });

    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/practitioner-profile/me/publish', {}));
    expect(await screen.findByText(/About still has template text/)).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Unpublish' })).toBeTruthy();
  });

  it('shows writing tips, with client details as a strong warning', async () => {
    serve({
      checklist: {
        ...NOT_READY,
        tips: [{ field: 'about', kind: 'client-detail', severity: 'strong', match: 'a client named Tunde', message: 'This may identify a client.' }],
      },
    });
    renderWithApp(<ProfilePage />, { route: '/dashboard/profile' });
    const tips = await screen.findByRole('list', { name: 'Writing tips' });
    expect(within(tips).getByText(/This may identify a client/).className).toContain('font-semibold');
  });

  it('switches theme straight away', async () => {
    serve();
    renderWithApp(<ProfilePage />, { route: '/dashboard/profile' });
    fireEvent.click(await screen.findByRole('radio', { name: /Warm/ }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/practitioner-profile/me', { themeKey: 'warm' }));
    expect((await screen.findByRole('radio', { name: /Warm/ })).getAttribute('aria-checked')).toBe('true');
  });

  it('picks a layout separately from the palette, and previews both', async () => {
    serve();
    renderWithApp(<ProfilePage />, { route: '/dashboard/profile' });
    const layouts = await screen.findByRole('radiogroup', { name: 'Layout' });
    expect(within(layouts).getByRole('radio', { name: /Classic/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('img', { name: 'Preview: Classic layout, Calm palette' })).toBeTruthy();
    fireEvent.click(within(layouts).getByRole('radio', { name: /Editorial/ }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/practitioner-profile/me', { layoutKey: 'editorial' }));
    expect(patch).not.toHaveBeenCalledWith('/v1/practitioner-profile/me', expect.objectContaining({ themeKey: expect.anything() }));
    expect(within(screen.getByRole('radiogroup', { name: 'Colour palette' })).getAllByRole('radio')).toHaveLength(5);
  });
});

describe('the practice tab', () => {
  it('holds the practice settings, and leaves the shared fields to the public profile', async () => {
    serve();
    renderWithApp(<ProfilePage />, { route: '/dashboard/profile?tab=practice' });
    expect(await screen.findByText(/edited in your public profile and used here too/)).toBeTruthy();
    expect(screen.getByText('Booking email')).toBeTruthy();
    expect(screen.queryByText('Specialty')).toBeNull();
    expect(screen.queryByText('Tagline')).toBeNull();
  });

  it('keeps every field on the practice tab for someone without a public profile', async () => {
    serve({ profile: null });
    renderWithApp(<ProfilePage />, { route: '/dashboard/profile?tab=practice' });
    expect(await screen.findByText('Specialty')).toBeTruthy();
    expect(screen.getByText('Tagline')).toBeTruthy();
  });

  it('switches tabs from the header', async () => {
    serve();
    renderWithApp(<ProfilePage />, { route: '/dashboard/profile' });
    fireEvent.click(await screen.findByRole('tab', { name: 'This practice' }));
    expect(await screen.findByText('Booking email')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Public profile' }));
    expect(screen.getByRole('heading', { name: 'Identity' })).toBeTruthy();
  });
});
