import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithApp, waitFor, cleanup, screen } from '../../test/renderWithApp';
import React from 'react';

const apiGet = vi.fn();
const navigate = vi.fn();
const getSubdomainTenantSlug = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
  },
  APP_BASE_URL: 'http://localhost:5173',
  getSubdomainTenantSlug: () => getSubdomainTenantSlug(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

const { PublicProfilePage } = await import('../public/PublicProfilePage');

function renderPage() {
  return renderWithApp(<PublicProfilePage />);
}

beforeEach(() => {
  navigate.mockReset();
  apiGet.mockReset().mockResolvedValue([]);
});

afterEach(cleanup);

describe('PublicProfilePage', () => {
  it('uses the host-resolved tenant info endpoint when no subdomain slug can be derived', async () => {
    getSubdomainTenantSlug.mockReturnValue('');
    apiGet.mockImplementation((path: string) => {
      if (path === '/v1/tenant/public/info') {
        return Promise.resolve({
          id: '1',
          name: 'Demo Practice',
          slug: 'demo',
          primaryColor: '#0F3A53',
          secondaryColor: '#E3B341',
        });
      }
      return Promise.resolve([]);
    });

    renderPage();

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/v1/tenant/public/info'));
  });

  // BKG-11: the link clients book from must look like the wizard, not a wide
  // marketing page with the platform's mark where the practice's should be.
  it('shows the practice logo in the header and keeps the wizard’s narrow measure', async () => {
    getSubdomainTenantSlug.mockReturnValue('demo');
    apiGet.mockImplementation((path: string) => {
      if (path.startsWith('/v1/tenant/public')) {
        return Promise.resolve({
          id: '1', name: 'Demo Practice', slug: 'demo',
          primaryColor: '#0F3A53', secondaryColor: '#E3B341',
          logoUrl: 'https://cdn.example.com/logo.png',
        });
      }
      return Promise.resolve([]);
    });
    renderPage();
    const logo = await screen.findByAltText('Demo Practice logo');
    expect(logo.getAttribute('src')).toBe('https://cdn.example.com/logo.png');
    expect(document.querySelector('img[src="/unclutterdesk-mark.svg"]')).toBeNull();
    expect(document.body.innerHTML).not.toContain('max-w-[1320px]');
  });

  // BKG-13: one tagline in the hero, one bio in About — never the same
  // paragraph in two places.
  it('shows the tagline once in the hero and the bio once in About', async () => {
    getSubdomainTenantSlug.mockReturnValue('demo');
    apiGet.mockImplementation((path: string) => {
      if (path.startsWith('/v1/tenant/public')) {
        return Promise.resolve({
          id: '1', name: 'Demo Practice', slug: 'demo',
          primaryColor: '#0F3A53', secondaryColor: '#E3B341',
          tagline: 'Calm, practical therapy.',
          welcomeMessage: 'A very long paragraph about the practice that used to appear twice.',
        });
      }
      if (path === '/v1/consult/public/therapists') {
        return Promise.resolve([{
          profileId: '1', firstName: 'Jane', lastName: 'Smith', avatarUrl: null,
          specialty: 'Clinical Psychology', credentials: null, yearsExperience: null,
          welcomeMessage: null, tagline: null, modalities: [], languages: [],
        }]);
      }
      return Promise.resolve([]);
    });
    renderPage();
    expect((await screen.findAllByText('Calm, practical therapy.')).length).toBe(1);
    expect(screen.getAllByText(/used to appear twice/).length).toBe(1);
  });

  // BKG-14: the design's About headline, real location names, and Learn More.
  it('renders the welcome headline, named locations and a Learn More button', async () => {
    getSubdomainTenantSlug.mockReturnValue('demo');
    apiGet.mockImplementation((path: string) => {
      if (path.startsWith('/v1/tenant/public')) {
        return Promise.resolve({
          id: '1', name: 'Demo Practice', slug: 'demo',
          primaryColor: '#0F3A53', secondaryColor: '#E3B341',
          welcomeTitle: 'A calm, evidence-based approach to therapy',
          welcomeMessage: 'The long bio goes here.',
          locations: [{ name: 'Lekki Clinic', city: 'Lagos' }],
          formats: ['ONLINE', 'IN_PERSON'],
        });
      }
      return Promise.resolve([]);
    });
    renderPage();
    expect(await screen.findByText('A calm, evidence-based approach to therapy')).toBeTruthy();
    expect(screen.getByText('Lekki Clinic · Lagos')).toBeTruthy();
    expect(screen.getByText('Online via secure video')).toBeTruthy();
    const learn = screen.getByRole('button', { name: 'Learn More' });
    learn.click(); // jsdom has no scrollIntoView; the guarded call must not throw
    expect(document.getElementById('about')).toBeTruthy();
  });

  // BKG-15: the client's Log in stays on the practice's host.
  it('links Log in to the same host, not the staff app', async () => {
    getSubdomainTenantSlug.mockReturnValue('demo');
    apiGet.mockImplementation(() => Promise.resolve([]));
    renderPage();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login'));
  });
});
