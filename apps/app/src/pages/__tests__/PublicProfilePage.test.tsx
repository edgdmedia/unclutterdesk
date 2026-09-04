import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

vi.mock('@unclutterdesk/ui', () => ({
  useBrand: () => ({ name: 'Demo Practice', primaryColor: '#0F3A53' }),
}));

const { PublicProfilePage } = await import('../PublicProfilePage');

function renderPage() {
  return render(
    <MemoryRouter>
      <PublicProfilePage />
    </MemoryRouter>,
  );
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
});
