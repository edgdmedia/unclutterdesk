import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

/**
 * The invite claim page.
 *
 * It previously called nothing: the form collected a password, ignored it, and
 * navigated to /dashboard, so an invited colleague landed in an app with no
 * account. It also displayed another practice's details as placeholder copy —
 * "Smith Therapy Ltd" and "segun@smiththerapy.ng" — to whoever opened the link.
 */
const claimInvite = vi.fn();
const apiGet = vi.fn();

vi.mock('../../../utils/apiClient', () => ({
  api: { get: (...args: unknown[]) => apiGet(...args) },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ claimInvite }),
}));

const { InvitePage } = await import('../InvitePage');

const INVITE = {
  email: 'segun@practice.ng',
  role: 'THERAPIST',
  practiceName: 'Ade Wellness',
  practiceSlug: 'ade-wellness',
  expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
};

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/invite/claim${search}`]}>
      <Routes>
        <Route path="/invite/claim" element={<InvitePage />} />
        <Route path="/login" element={<div>sign in page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function type(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillAndSubmit(password: string, confirm = password) {
  type(/full name/i, 'Segun Ade');
  type(/create password/i, password);
  type(/confirm password/i, confirm);
  fireEvent.click(screen.getByRole('button', { name: /join/i }));
}

beforeEach(() => {
  claimInvite.mockReset().mockResolvedValue({ id: '1' });
  apiGet.mockReset().mockResolvedValue(INVITE);
});

afterEach(cleanup);

describe('InvitePage', () => {
  describe('loading the invitation', () => {
    it('looks it up by the token in the link', async () => {
      renderAt('?token=abc123');
      await waitFor(() =>
        expect(apiGet).toHaveBeenCalledWith('/v1/tenant/public/invite/abc123'),
      );
    });

    it('shows the practice that actually sent it', async () => {
      renderAt('?token=abc123');
      expect(await screen.findByText('Ade Wellness')).toBeTruthy();
    });

    it('shows the address the invitation was sent to', async () => {
      renderAt('?token=abc123');
      expect(await screen.findByText('segun@practice.ng')).toBeTruthy();
    });

    // The placeholder copy named a real-sounding clinic and inbox to everyone
    // who opened the page, whatever practice had actually invited them.
    it('names no other practice', async () => {
      const { container } = renderAt('?token=abc123');
      await screen.findByText('Ade Wellness');
      expect(container.textContent).not.toContain('Smith Therapy');
      expect(container.textContent).not.toContain('smiththerapy.ng');
    });

    it('shows the role the inviter chose', async () => {
      renderAt('?token=abc123');
      expect(await screen.findByText('Therapist')).toBeTruthy();
    });
  });

  describe('an invitation that cannot be used', () => {
    it('explains an expired or spent token instead of showing the form', async () => {
      apiGet.mockRejectedValue(new Error('gone'));
      renderAt('?token=abc123');
      expect(await screen.findByText(/no longer valid/i)).toBeTruthy();
      expect(screen.queryByLabelText(/create password/i)).toBeNull();
    });

    it('handles a link with no token at all, without calling the API', async () => {
      renderAt('');
      expect(await screen.findByText(/no longer valid/i)).toBeTruthy();
      expect(apiGet).not.toHaveBeenCalled();
    });
  });

  describe('submitting', () => {
    it('sends the token, password and name', async () => {
      renderAt('?token=abc123');
      await screen.findByText('Ade Wellness');
      fillAndSubmit('correct horse battery');

      await waitFor(() =>
        expect(claimInvite).toHaveBeenCalledWith({
          token: 'abc123',
          password: 'correct horse battery',
          firstName: 'Segun',
          lastName: 'Ade',
        }),
      );
    });

    it('refuses mismatched passwords before calling the API', async () => {
      renderAt('?token=abc123');
      await screen.findByText('Ade Wellness');
      fillAndSubmit('correct horse', 'correct hoarse');

      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(claimInvite).not.toHaveBeenCalled();
    });

    it('shows the reason the claim failed rather than silently continuing', async () => {
      claimInvite.mockRejectedValue(new Error('This invitation has already been used'));
      renderAt('?token=abc123');
      await screen.findByText('Ade Wellness');
      fillAndSubmit('correct horse battery');

      expect(await screen.findByText(/already been used/i)).toBeTruthy();
    });
  });

  describe('the password strength meter', () => {
    // It was a fixed 72% bar reading "Strong", shown before anything was typed.
    it('says nothing until something is typed', async () => {
      renderAt('?token=abc123');
      await screen.findByText('Ade Wellness');
      expect(screen.queryByText('Strong')).toBeNull();
    });

    it('does not call a short password strong', async () => {
      renderAt('?token=abc123');
      await screen.findByText('Ade Wellness');
      type(/create password/i, 'abc');
      expect(screen.queryByText('Strong')).toBeNull();
      expect(screen.getByText('Too short')).toBeTruthy();
    });

    it('recognises a strong one', async () => {
      renderAt('?token=abc123');
      await screen.findByText('Ade Wellness');
      type(/create password/i, 'Tr0ubad0ur&3xtra');
      expect(screen.getByText('Strong')).toBeTruthy();
    });
  });

  describe('fields', () => {
    // Both collected input that was dropped on submit: Profile has no title
    // column, and the avatar was only ever a local data URL.
    it('asks for nothing it cannot save', async () => {
      renderAt('?token=abc123');
      await screen.findByText('Ade Wellness');
      expect(screen.queryByLabelText(/^title$/i)).toBeNull();
      expect(screen.queryByText(/choose file/i)).toBeNull();
    });

    it('does not prefill a name', async () => {
      renderAt('?token=abc123');
      await screen.findByText('Ade Wellness');
      expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe('');
    });
  });
});
