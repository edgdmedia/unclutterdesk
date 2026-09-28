import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, within } from '../../test/renderWithApp';

// The network is the only thing faked: there is no server in a unit test.
vi.mock('../../utils/apiClient', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

const { ClientsPage } = await import('../practice/ClientsPage');

// 30 clients named Client 01 … Client 30, so the list spans two pages of 25.
const clients = Array.from({ length: 30 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    id: String(i + 1), name: `Client ${n}`, email: `c${n}@example.com`, care: 'Individual Therapy',
    sessions: String(i), next: 'None scheduled', status: 'Active', initials: 'C', phone: '',
    since: 'Sep 2026', emergency: '', notes: [], intake: [],
  };
});

const renderPage = () =>
  renderWithApp(<ClientsPage clients={clients as any} setClients={() => undefined} onRefresh={async () => undefined} />, {
    route: '/dashboard/clients',
  });
const names = () =>
  within(screen.getByRole('table')).getAllByRole('link').map((a) => a.textContent ?? '');

afterEach(cleanup);

describe('ClientsPage', () => {
  it('fits the page instead of forcing a width', () => {
    const { container } = renderPage();
    expect(container.innerHTML).not.toContain('min-w-[800px]');
    expect(screen.getByRole('heading', { level: 1, name: 'Clients' })).toBeTruthy();
  });

  it('sorts every client, not just the page on screen', () => {
    renderPage();
    expect(names()[0]).toContain('Client 01');
    fireEvent.click(screen.getByRole('button', { name: /^Client/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Client/ })); // descending
    expect(names()[0]).toContain('Client 30');
    expect(names()).toHaveLength(25);
  });

  it('searches from a box every screen size can reach', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search clients' }), { target: { value: 'c07@' } });
    expect(names()).toHaveLength(1);
    expect(names()[0]).toContain('Client 07');
  });

  it('a new search starts again at page 1', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(names()[0]).toContain('Client 26');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search clients' }), { target: { value: 'Client' } });
    expect(names()[0]).toContain('Client 01');
  });

  it('opens a client from the row', () => {
    renderPage();
    expect(within(screen.getByRole('table')).getAllByRole('link')[0].getAttribute('href')).toBe('/dashboard/clients/1');
  });
});
