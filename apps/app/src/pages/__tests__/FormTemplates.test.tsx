import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor, within } from '../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return {
    ...real,
    api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), delete: (...a: unknown[]) => del(...a) },
  };
});
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ profile: { id: '55', type: 'therapist', tenantId: '27', tenantSlug: 'calm', plan: 'PRO' }, refreshProfile: vi.fn() }),
}));
const { FormTemplateLibrary } = await import('../practice/settings/FormTemplateLibrary');
const { SaveAsTemplateDialog } = await import('../practice/settings/SaveAsTemplateDialog');

const library = {
  mine: [{ id: '1', title: 'Sleep check', description: null, targetType: 'INTAKE', questionCount: 3, shareStatus: 'PENDING', sharedBy: null, mine: true, timesUsed: 0 }],
  shared: [{ id: '2', title: 'GAD-7 intake', description: 'Anxiety screen', targetType: 'INTAKE', questionCount: 7, shareStatus: 'APPROVED', sharedBy: 'Lekki Minds', mine: false, timesUsed: 4 }],
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  del.mockReset();
  get.mockImplementation(async (url: string) =>
    url === '/v1/intake/templates'
      ? library
      : { ...library.shared[0], schemaJson: [{ id: 'q1', label: 'Feeling nervous?', type: 'scale', required: true }] },
  );
  post.mockResolvedValue({ formId: '77' });
  del.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Template library', () => {
  it("lists my templates with their review status and others' with credit", async () => {
    renderWithApp(<FormTemplateLibrary onUsed={vi.fn()} />);
    expect(await screen.findByText('Sleep check')).toBeTruthy();
    expect(screen.getByText('In review')).toBeTruthy();
    expect(screen.getByText(/shared by lekki minds/i)).toBeTruthy();
    expect(screen.getByText(/used 4 times/i)).toBeTruthy();
  });

  it('using a shared template makes my own copy', async () => {
    const onUsed = vi.fn();
    renderWithApp(<FormTemplateLibrary onUsed={onUsed} />);
    const row = (await screen.findByText('GAD-7 intake')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: /^use/i }));
    await waitFor(() => expect(onUsed).toHaveBeenCalledWith('77'));
    expect(post).toHaveBeenCalledWith('/v1/intake/templates/2/use', {});
  });

  it("previews a shared template's questions", async () => {
    renderWithApp(<FormTemplateLibrary onUsed={vi.fn()} />);
    const row = (await screen.findByText('GAD-7 intake')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: /preview/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Feeling nervous\?/)).toBeTruthy();
    expect(get).toHaveBeenCalledWith('/v1/intake/templates/2');
  });

  it('deletes my own template after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithApp(<FormTemplateLibrary onUsed={vi.fn()} />);
    const row = (await screen.findByText('Sleep check')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/v1/intake/templates/1'));
    await waitFor(() => expect(screen.queryByText('Sleep check')).toBeNull());
  });

  it('says so when nothing is shared yet', async () => {
    get.mockResolvedValue({ mine: [], shared: [] });
    renderWithApp(<FormTemplateLibrary onUsed={vi.fn()} />);
    expect(await screen.findByText(/save a form as a template to reuse it/i)).toBeTruthy();
    expect(screen.getByText(/no shared templates yet/i)).toBeTruthy();
  });
});

describe('Forms pages', () => {
  it('the forms page shows the library, and using a template opens the new copy', async () => {
    const { Routes, Route, useParams } = await import('react-router-dom');
    const { FormsManagerPage } = await import('../practice/settings/FormsManagerPage');
    const Editor = () => <p>Editing form {useParams().id}</p>;
    get.mockImplementation(async (url: string) => (url === '/v1/intake/forms' ? [] : library));
    renderWithApp(
      <Routes>
        <Route path="/dashboard/settings/forms" element={<FormsManagerPage />} />
        <Route path="/dashboard/settings/forms/:id" element={<Editor />} />
      </Routes>,
      { route: '/dashboard/settings/forms' },
    );
    const row = (await screen.findByText('GAD-7 intake')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: /^use/i }));
    expect(await screen.findByText('Editing form 77')).toBeTruthy();
  });

  it('a saved form can be saved as a template from the editor', async () => {
    const { Routes, Route } = await import('react-router-dom');
    const { FormEditorPage } = await import('../practice/settings/FormEditorPage');
    get.mockResolvedValue({ id: '10', title: 'Sleep check', description: '', targetType: 'INTAKE', schemaJson: [{ id: 'q1', label: 'Sleep?', type: 'text' }], isDefault: false, isActive: true, systemKey: null, reviewPublicationMode: 'MANUAL', reviewerDisplayMode: 'FIRST_NAME' });
    renderWithApp(
      <Routes>
        <Route path="/dashboard/settings/forms/:id" element={<FormEditorPage />} />
      </Routes>,
      { route: '/dashboard/settings/forms/10' },
    );
    fireEvent.click(await screen.findByRole('button', { name: /save as template/i }));
    expect(within(await screen.findByRole('dialog')).getByRole('button', { name: /save template/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^save form$/i })).toBeTruthy();
  });

  it("a new form can't be a template until it's saved", async () => {
    const { Routes, Route } = await import('react-router-dom');
    const { FormEditorPage } = await import('../practice/settings/FormEditorPage');
    renderWithApp(
      <Routes>
        <Route path="/dashboard/settings/forms/:id" element={<FormEditorPage />} />
      </Routes>,
      { route: '/dashboard/settings/forms/new' },
    );
    await screen.findByRole('button', { name: /^save form$/i });
    expect(screen.queryByRole('button', { name: /save as template/i })).toBeNull();
  });
});

describe('Save as template', () => {
  it('saves privately by default', async () => {
    const onClose = vi.fn();
    renderWithApp(<SaveAsTemplateDialog formId="10" onClose={onClose} />);
    expect(screen.queryByLabelText(/share anonymously/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /save template/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/intake/forms/10/template', { share: false, anonymous: false }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shares anonymously when both boxes are ticked', async () => {
    renderWithApp(<SaveAsTemplateDialog formId="10" onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/share with other practices/i));
    fireEvent.click(screen.getByLabelText(/share anonymously/i));
    fireEvent.click(screen.getByRole('button', { name: /save template/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/intake/forms/10/template', { share: true, anonymous: true }));
  });
});
