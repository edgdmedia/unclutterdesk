import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * The reschedule dialog.
 *
 * Its list comes from the server's reschedule-options rather than the public
 * availability feed, so a time on screen is a time the reschedule will accept:
 * same practitioner, same service, outside the practice's notice period. The
 * cases below are the ones where showing something the server would refuse
 * would strand the client — a session too close to move, and a slot taken while
 * they were choosing.
 */
const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));

const { RescheduleDialog } = await import('../RescheduleDialog');

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600000).toISOString();

const OPTIONS = {
  bookingId: '100',
  serviceTitle: 'Therapy',
  currentStartsAt: hoursFromNow(72),
  noticeHours: 24,
  slots: [
    { id: '4', startsAt: hoursFromNow(96), endsAt: hoursFromNow(97), channel: 'VIDEO' },
    { id: '5', startsAt: hoursFromNow(120), endsAt: hoursFromNow(121), channel: 'VIDEO' },
  ],
};

const onClose = vi.fn();
const onRescheduled = vi.fn();

function renderDialog() {
  return render(
    <RescheduleDialog
      bookingId="100"
      primaryColor="#0F3A53"
      onClose={onClose}
      onRescheduled={onRescheduled}
    />,
  );
}

beforeEach(() => {
  onClose.mockReset();
  onRescheduled.mockReset();
  apiGet.mockReset().mockResolvedValue(OPTIONS);
  apiPost.mockReset().mockResolvedValue({ id: '100' });
});

afterEach(cleanup);

describe('RescheduleDialog', () => {
  it('asks the server which times this booking may move to', async () => {
    renderDialog();
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith('/v1/consult/portal/bookings/100/reschedule-options'),
    );
  });

  it('lists the times it was given', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(2));
  });

  it('will not submit until a time is picked', async () => {
    renderDialog();
    await screen.findAllByRole('radio');
    const confirm = screen.getByRole('button', { name: /move session/i });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('sends the chosen slot', async () => {
    renderDialog();
    const radios = await screen.findAllByRole('radio');
    fireEvent.click(radios[1]);
    fireEvent.click(screen.getByRole('button', { name: /move session/i }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/v1/consult/portal/bookings/100/reschedule', {
        availabilityId: '5',
      }),
    );
  });

  it('tells the portal to reload once the move succeeds', async () => {
    renderDialog();
    const radios = await screen.findAllByRole('radio');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /move session/i }));
    await waitFor(() => expect(onRescheduled).toHaveBeenCalled());
  });

  describe('when the server refuses', () => {
    // The practice's notice period is enforced server-side, so this is how the
    // client learns their session is too close to move.
    it('shows why the times could not be listed', async () => {
      apiGet.mockRejectedValue(
        new Error('This session can no longer be moved online — it starts within 24 hours.'),
      );
      renderDialog();
      expect(await screen.findByText(/no longer be moved online/i)).toBeTruthy();
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
    });

    it('reports a slot taken mid-choice and reloads the list', async () => {
      apiPost.mockRejectedValue(new Error('That time was taken while you were choosing it'));
      renderDialog();
      const radios = await screen.findAllByRole('radio');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /move session/i }));

      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(screen.getByText(/taken while you were choosing/i)).toBeTruthy();
      // Two loads: the initial one and the refresh after the refusal.
      await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
      expect(onRescheduled).not.toHaveBeenCalled();
    });

    it('clears the selection so the gone slot cannot be resubmitted', async () => {
      apiPost.mockRejectedValue(new Error('That time was taken while you were choosing it'));
      renderDialog();
      const radios = await screen.findAllByRole('radio');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /move session/i }));

      await screen.findByRole('alert');
      expect(
        (screen.getByRole('button', { name: /move session/i }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });
  });

  it('explains an empty calendar rather than showing a blank list', async () => {
    apiGet.mockResolvedValue({ ...OPTIONS, slots: [] });
    renderDialog();
    expect(await screen.findByText(/no other open times/i)).toBeTruthy();
  });

  describe('dismissing', () => {
    it('closes on the X', async () => {
      renderDialog();
      await screen.findAllByRole('radio');
      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(onClose).toHaveBeenCalled();
    });

    it('closes on Escape', async () => {
      renderDialog();
      await screen.findAllByRole('radio');
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('keeps the session unchanged when dismissed', async () => {
      renderDialog();
      await screen.findAllByRole('radio');
      fireEvent.click(screen.getByRole('button', { name: /keep current time/i }));
      expect(apiPost).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
