import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { act, cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../../test/renderWithApp';

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();
vi.mock('../../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../utils/apiClient')>();
  return {
    ...real,
    api: {
      get: (...a: unknown[]) => get(...a),
      patch: (...a: unknown[]) => patch(...a),
      post: (...a: unknown[]) => post(...a),
    },
  };
});
const { NotificationBell } = await import('../NotificationBell');

const ITEM = (over: Record<string, unknown> = {}) => ({
  id: '11', type: 'consult.booking_created', title: 'New booking', message: 'Ada Okafor booked Individual Therapy for Fri, 9 Oct.',
  link: '/dashboard/sessions/8', actionLabel: null, status: 'unread', createdAt: new Date().toISOString(), ...over,
});

function renderBell() {
  return renderWithApp(
    <Routes>
      <Route path="/dashboard" element={<NotificationBell allHref="/dashboard/notifications" />} />
      <Route path="/dashboard/sessions/:id" element={<p>session page</p>} />
      <Route path="/dashboard/notifications" element={<p>all page</p>} />
    </Routes>,
    { route: '/dashboard' },
  );
}

beforeEach(() => {
  get.mockReset(); patch.mockReset(); post.mockReset();
  get.mockImplementation((p: string) => {
    if (p.startsWith('/v1/notifications?')) return Promise.resolve({ items: [ITEM()], pagination: {} });
    if (p === '/v1/notifications/unread-count') return Promise.resolve(3);
    return Promise.resolve({});
  });
  patch.mockResolvedValue({});
  post.mockResolvedValue({});
});
afterEach(cleanup);

describe('the notification bell', () => {
  it('shows the unread count in the label and badge', async () => {
    renderBell();
    expect(await screen.findByRole('button', { name: 'Notifications, 3 unread' })).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('caps the badge at 99+', async () => {
    get.mockImplementation((p: string) => {
      if (p.startsWith('/v1/notifications?')) return Promise.resolve({ items: [], pagination: {} });
      if (p === '/v1/notifications/unread-count') return Promise.resolve(120);
      return Promise.resolve({});
    });
    renderBell();
    expect(await screen.findByText('99+')).toBeTruthy();
  });

  it('opens the dropdown with the latest items and unread marked', async () => {
    renderBell();
    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    const menu = await screen.findByRole('menu');
    expect(menu.textContent).toContain('New booking');
    expect(menu.textContent).toContain('Just now');
    expect(screen.getByRole('link', { name: 'All notifications' }).getAttribute('href')).toBe('/dashboard/notifications');
  });

  it('clicking an item marks it read and navigates within the app', async () => {
    renderBell();
    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /New booking/ }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/notifications/11/read', expect.anything()));
    await screen.findByText('session page');
  });

  it('opens an external link in a new tab and never navigates', async () => {
    get.mockImplementation((p: string) => {
      if (p.startsWith('/v1/notifications?')) return Promise.resolve({ items: [ITEM({ link: 'https://pay.example/x' })], pagination: {} });
      if (p === '/v1/notifications/unread-count') return Promise.resolve(1);
      return Promise.resolve({});
    });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    renderBell();
    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /New booking/ }));
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('https://pay.example/x', '_blank', 'noopener'));
    openSpy.mockRestore();
  });

  it('mark all read posts read-all and clears the badge', async () => {
    renderBell();
    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Mark all read/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/notifications/read-all', expect.anything()));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy());
  });

  it('closes on Escape', async () => {
    renderBell();
    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    await screen.findByRole('menu');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });
});
