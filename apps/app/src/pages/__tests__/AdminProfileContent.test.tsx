import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { SWRConfig } from 'swr';
import { cleanup, fireEvent, renderWithApp, screen, waitFor, within } from '../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const put = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    put: (...args: unknown[]) => put(...args),
  },
}));

const { AdminProfileTemplatesPage } = await import('../admin/AdminProfileTemplatesPage');
const { AdminProfileGuidancePage } = await import('../admin/AdminProfileGuidancePage');
const { AdminProfileTaxonomyPage } = await import('../admin/AdminProfileTaxonomyPage');

const SECTIONS = {
  identity: { prompt: 'Who do you help?', example: 'Counsellor for adults' },
  about: {
    prompt: 'What is a first session like?',
    example: 'People often come to me when something feels heavy. We talk about what brought you here and what you would like to be different.',
  },
};

const TEMPLATE = {
  key: 'private-practice-counsellor',
  title: 'Counsellor in private practice',
  description: 'For counsellors seeing adults.',
  kind: 'COUNSELLOR',
  isActive: true,
  sortOrder: 10,
  sections: { guidance: {}, sections: SECTIONS, suggested: { SPECIALTY: ['anxiety'] } },
  updatedAt: '2026-11-01T10:00:00.000Z',
};

const GUIDANCE = {
  guidance: {
    identity: 'Use the name clients will search for.',
    about: 'Write to the person reading.',
    qualifications: 'List qualifications as they appear on your certificates.',
    specialties: 'Choose up to three primary specialties.',
    approach: 'Describe how you work in everyday words.',
    population: 'Say who you work with.',
    languages: 'Add every language you can hold a session in.',
    experience: 'Years in practice, as you would state them professionally.',
    fees: 'Clients want to know cost before they reach out.',
    contact: 'Make the next step obvious.',
  },
};

const TERMS = [
  { id: '1', kind: 'SPECIALTY', key: 'anxiety', label: 'Anxiety', isActive: true, sortOrder: 10, usageCount: 2 },
  { id: '2', kind: 'SPECIALTY', key: 'grief', label: 'Grief', isActive: true, sortOrder: 20, usageCount: 0 },
  { id: '3', kind: 'MODALITY', key: 'cbt', label: 'CBT', isActive: true, sortOrder: 10, usageCount: 1 },
];

function renderPage(page: React.ReactNode) {
  return renderWithApp(
    <SWRConfig value={{ fetcher: (key: string) => get(key), provider: () => new Map(), dedupingInterval: 0 }}>
      {page}
    </SWRConfig>,
  );
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  put.mockReset();
  get.mockImplementation(async (path: string) => {
    if (path.endsWith('/templates')) return [TEMPLATE];
    if (path.endsWith('/guidance')) return GUIDANCE;
    if (path.endsWith('/taxonomy')) return TERMS;
    throw new Error(`Unexpected GET ${path}`);
  });
  post.mockResolvedValue({ id: '4', kind: 'SPECIALTY', key: 'burnout', label: 'Burnout', isActive: true, sortOrder: 30, usageCount: 0 });
  patch.mockResolvedValue({});
  put.mockResolvedValue(TERMS);
});

afterEach(cleanup);

describe('Admin → Profile content', () => {
  it('edits a template title and saves it', async () => {
    renderPage(<AdminProfileTemplatesPage />);

    const title = await screen.findByLabelText('Title');
    expect((title as HTMLInputElement).value).toBe('Counsellor in private practice');
    expect(screen.getByDisplayValue('Who do you help?')).toBeTruthy();

    fireEvent.change(title, { target: { value: 'Counsellor in solo practice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/v1/admin/practitioner-profile/templates/private-practice-counsellor');
    expect(patch.mock.calls[0][1]).toMatchObject({
      title: 'Counsellor in solo practice',
      kind: 'COUNSELLOR',
      isActive: true,
      sortOrder: 10,
    });
  });

  it('removes a section when both its fields are cleared', async () => {
    renderPage(<AdminProfileTemplatesPage />);

    const example = await screen.findByDisplayValue(/People often come to me/);
    const card = example.closest('div') as HTMLElement;
    fireEvent.change(within(card).getByLabelText('Prompt'), { target: { value: '' } });
    fireEvent.change(example, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][1].sections.about).toBeNull();
  });

  it('shows the shared guidance and saves a changed line', async () => {
    renderPage(<AdminProfileGuidancePage />);

    const about = await screen.findByLabelText('About');
    expect((about as HTMLTextAreaElement).value).toBe('Write to the person reading.');
    fireEvent.change(about, { target: { value: 'Write to the person who is reading.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save guidance' }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/v1/admin/practitioner-profile/guidance');
    expect(patch.mock.calls[0][1].guidance.about).toBe('Write to the person who is reading.');
  });

  it('adds a taxonomy term', async () => {
    renderPage(<AdminProfileTaxonomyPage />);

    await screen.findByText('Anxiety');
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Burnout' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add term' }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('/v1/admin/practitioner-profile/taxonomy');
    expect(post.mock.calls[0][1]).toMatchObject({ kind: 'SPECIALTY', label: 'Burnout' });
  });

  it('renames a taxonomy term and deactivates it', async () => {
    renderPage(<AdminProfileTaxonomyPage />);

    await screen.findByText('Anxiety');
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Anxiety & worry' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save term' }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/v1/admin/practitioner-profile/taxonomy/1');
    expect(patch.mock.calls[0][1]).toMatchObject({ label: 'Anxiety & worry', key: 'anxiety', isActive: true });

    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[0]);
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch.mock.calls[1][0]).toBe('/v1/admin/practitioner-profile/taxonomy/1');
    expect(patch.mock.calls[1][1]).toEqual({ isActive: false });
  });

  it('moves a taxonomy term up within its kind', async () => {
    renderPage(<AdminProfileTaxonomyPage />);

    await screen.findByText('Grief');
    fireEvent.click(screen.getByRole('button', { name: 'Move Grief up' }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][0]).toBe('/v1/admin/practitioner-profile/taxonomy/reorder');
    expect(put.mock.calls[0][1]).toEqual({ kind: 'SPECIALTY', ids: ['2', '1'] });
  });
});