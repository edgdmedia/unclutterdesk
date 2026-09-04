import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * The staff roster.
 *
 * Every write on this page was pretend. The status toggle only edited React
 * state, so deactivating a practitioner looked like it worked and lasted until
 * the next refresh — while that person kept their access, their bookable slots
 * and their clinical records. "Resend Invitation" alerted that an email had
 * gone out; none had, and the endpoint sends none to this day. And when the
 * invite API rejected a request — which it does on the free plan — the page
 * swallowed the error and added the person to the roster locally.
 */
const apiPost = vi.fn();
const apiPatch = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: (...a: unknown[]) => apiPost(...a),
    patch: (...a: unknown[]) => apiPatch(...a),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@unclutterdesk/ui', () => ({
  Eyebrow: ({ children }: any) => <span>{children}</span>,
  Card: ({ children }: any) => <div>{children}</div>,
  StatusBadge: ({ children }: any) => <span>{children}</span>,
  Button: ({ children, ...rest }: any) => <button {...rest}>{children}</button>,
  useBrand: () => ({ primaryColor: '#0F3A53' }),
}));

const { TeamSettingsPage } = await import('../TeamSettingsPage');

const OWNER = {
  id: '1',
  name: 'Ada Ola',
  title: 'Owner',
  email: 'ada@practice.ng',
  role: 'OWNER',
  status: 'Active',
  initials: 'AO',
};

const THERAPIST = {
  id: '2',
  name: 'Segun Ade',
  title: 'Therapist',
  email: 'segun@practice.ng',
  role: 'THERAPIST',
  status: 'Active',
  initials: 'SA',
};

const onRefresh = vi.fn().mockResolvedValue(undefined);

function renderPage(staff = [OWNER, THERAPIST]) {
  return render(<TeamSettingsPage staff={staff as any} onRefresh={onRefresh} />);
}

beforeEach(() => {
  apiPost.mockReset().mockResolvedValue({ inviteUrl: 'https://app.test/invite/claim?token=abc' });
  apiPatch.mockReset().mockResolvedValue({ profileId: '2', status: 'inactive' });
  onRefresh.mockClear();
});

afterEach(cleanup);

describe('deactivating a staff member', () => {
  // The bug: this only ever edited React state, so the person kept working.
  it('tells the server, rather than only the screen', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Segun Ade active'));
    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/v1/consult/admin/therapists/2/status', {
        status: 'inactive',
      }),
    );
  });

  it('reactivates someone who is inactive', async () => {
    renderPage([OWNER, { ...THERAPIST, status: 'Inactive' }]);
    fireEvent.click(screen.getByLabelText('Segun Ade active'));
    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/v1/consult/admin/therapists/2/status', {
        status: 'active',
      }),
    );
  });

  it('re-reads the roster, so the screen shows what the practice actually has', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Segun Ade active'));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it('offers the same action from the row menu', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Actions for Segun Ade'));
    fireEvent.click(screen.getByText('Deactivate Member'));
    await waitFor(() => expect(apiPatch).toHaveBeenCalled());
  });

  describe('when the server refuses', () => {
    beforeEach(() => {
      apiPatch.mockRejectedValue(new Error('Only a practice owner or admin can change practitioner status'));
    });

    it('says so instead of leaving the toggle looking flipped', async () => {
      renderPage();
      fireEvent.click(screen.getByLabelText('Segun Ade active'));
      expect((await screen.findByRole('alert')).textContent).toMatch(
        /Only a practice owner or admin/,
      );
    });

    it('names who it could not change', async () => {
      renderPage();
      fireEvent.click(screen.getByLabelText('Segun Ade active'));
      expect((await screen.findByRole('alert')).textContent).toMatch(/Segun Ade/);
    });

    it('leaves the row as the server still has it', async () => {
      renderPage();
      const toggle = screen.getByLabelText('Segun Ade active');
      fireEvent.click(toggle);
      await screen.findByRole('alert');
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });
  });
});

describe('the owner', () => {
  it('cannot be deactivated, which is what the server enforces too', () => {
    renderPage();
    expect(screen.getByLabelText('Ada Ola active').hasAttribute('disabled')).toBe(true);
  });

  it('is not offered the action in the row menu either', () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Actions for Ada Ola'));
    expect(screen.getByText(/The owner cannot be deactivated/)).toBeTruthy();
  });

  it('sends nothing when its toggle is clicked', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Ada Ola active'));
    await waitFor(() => expect(apiPatch).not.toHaveBeenCalled());
  });
});

describe('inviting a staff member', () => {
  function openInvite() {
    renderPage();
    fireEvent.click(screen.getByText('Invite staff member'));
    fireEvent.change(screen.getByPlaceholderText('name@yourpractice.ng'), {
      target: { value: 'new@practice.ng' },
    });
  }

  it('creates the invitation', async () => {
    openInvite();
    fireEvent.click(screen.getByText('Create invite'));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/v1/tenant/staff/invite', {
        email: 'new@practice.ng',
        role: 'THERAPIST',
      }),
    );
  });

  // The endpoint mints a claim link and sends no email at all.
  it('hands over the claim link rather than claiming an email was sent', async () => {
    openInvite();
    fireEvent.click(screen.getByText('Create invite'));
    expect(await screen.findByText('https://app.test/invite/claim?token=abc')).toBeTruthy();
  });

  describe('when the API rejects it', () => {
    const REJECTION =
      'Staff invitations and team features require a Pro or Group Clinic subscription plan.';

    beforeEach(() => {
      apiPost.mockRejectedValue(new Error(REJECTION));
    });

    it('shows why, since the reason is the useful part', async () => {
      openInvite();
      fireEvent.click(screen.getByText('Create invite'));
      expect((await screen.findByRole('alert')).textContent).toMatch(/Pro or Group Clinic/);
    });

    // It used to add the person to the roster anyway, so an owner saw a
    // colleague who had never been invited.
    it('does not put anyone on the roster who was never invited', async () => {
      openInvite();
      fireEvent.click(screen.getByText('Create invite'));
      await screen.findByRole('alert');
      expect(screen.queryByText('new@practice.ng')).toBeNull();
      expect(screen.queryByText(/INVITE PENDING/)).toBeNull();
    });
  });
});

describe('claims the page cannot keep', () => {
  it('does not offer to resend an email it never sends', () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Actions for Segun Ade'));
    expect(screen.queryByText(/Resend Invitation/i)).toBeNull();
  });

  // Told every practice it was on Group Clinic with ten seats, including one
  // on the free plan that cannot invite anyone at all.
  it('states the headcount without inventing a plan or a seat limit', () => {
    const { container } = renderPage();
    expect(container.textContent).toMatch(/2 team members/);
    expect(container.textContent).not.toMatch(/Group Clinic plan|of 10 seats/);
  });
});
