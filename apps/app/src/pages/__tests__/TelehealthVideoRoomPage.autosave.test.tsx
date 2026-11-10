import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TelehealthVideoRoomPage } from '../practice/TelehealthVideoRoomPage';
import { docOf, isEditable, textOf, writeIn } from '../../test/richText';

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    // The room's join is refused (too early); postMock sees only note saves.
    post: (path: string, ...args: unknown[]) =>
      path.endsWith('/join') ? Promise.reject(new Error('This room opens at 9:45 AM.')) : postMock(path, ...args),
    patch: (...args: unknown[]) => patchMock(...args),
  },
}));

describe('TelehealthVideoRoomPage autosave', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();

    getMock.mockResolvedValue({
      booking: {
        id: '42',
        clientProfileId: '7',
        clientName: 'Ada Okafor',
        clientEmail: 'ada@example.com',
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
        serviceTitle: 'Therapy Session',
        status: 'CONFIRMED',
        videoRoomLink: 'https://meet.jit.si/test-room',
      },
      latestNote: null,
      submissions: [],
    });

    postMock.mockResolvedValue({ id: 'note-1', isLocked: false });
    patchMock.mockResolvedValue({ id: 'note-1', isLocked: true });
  });

  test('autosaves after note input settles', async () => {
    render(
      <MemoryRouter initialEntries={['/session/42']}>
        <Routes>
          <Route path="/session/:id" element={<TelehealthVideoRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('SOAP Notes');

    const subjectiveField = screen.getByLabelText('Subjective');
    writeIn(subjectiveField, 'Client reports improved sleep.');

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(1);
    }, { timeout: 3500 });
  });

  test('does not autosave when note is locked', async () => {
    getMock.mockResolvedValueOnce({
      booking: {
        id: '42',
        clientProfileId: '7',
        clientName: 'Ada Okafor',
        clientEmail: 'ada@example.com',
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
        serviceTitle: 'Therapy Session',
        status: 'CONFIRMED',
        videoRoomLink: 'https://meet.jit.si/test-room',
      },
      latestNote: null,
      sessionNote: {
        id: 'note-1',
        subjective: 'Existing',
        objective: '',
        assessment: '',
        plan: '',
        isLocked: true,
        createdAt: new Date().toISOString(),
      },
      submissions: [],
    });

    render(
      <MemoryRouter initialEntries={['/session/42']}>
        <Routes>
          <Route path="/session/:id" element={<TelehealthVideoRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('SOAP Notes');

    await new Promise((resolve) => setTimeout(resolve, 3000));

    expect(postMock).not.toHaveBeenCalled();
  });

  // The client's last session's note is prep, not this session's record. It
  // once filled and locked this editor, so a practitioner who had signed last
  // week's note could not write today's.
  test("a locked note from the last session neither fills nor locks this session's note", async () => {
    getMock.mockResolvedValueOnce({
      booking: {
        id: '42',
        clientProfileId: '7',
        clientName: 'Ada Okafor',
        clientEmail: 'ada@example.com',
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
        serviceTitle: 'Therapy Session',
        status: 'CONFIRMED',
        videoRoomLink: 'https://meet.jit.si/test-room',
      },
      latestNote: { id: 'note-0', subjective: 'Last week', objective: '', assessment: '', plan: '', isLocked: true, createdAt: new Date().toISOString() },
      sessionNote: null,
      submissions: [],
    });

    render(
      <MemoryRouter initialEntries={['/session/42']}>
        <Routes>
          <Route path="/session/:id" element={<TelehealthVideoRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('SOAP Notes');
    const subjectiveField = screen.getByLabelText('Subjective');
    expect(textOf(subjectiveField)).toBe('');
    expect(isEditable(subjectiveField)).toBe(true);
    expect(screen.queryByText('Locked')).toBeNull();

    writeIn(subjectiveField, 'Today: sleep better.');
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/v1/notes', expect.objectContaining({ bookingId: '42', subjective: docOf('Today: sleep better.') })), { timeout: 3500 });
  });

  test('shows autosave failure when save request rejects', async () => {
    postMock.mockRejectedValueOnce(new Error('Network error'));

    render(
      <MemoryRouter initialEntries={['/session/42']}>
        <Routes>
          <Route path="/session/:id" element={<TelehealthVideoRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('SOAP Notes');

    const subjectiveField = screen.getByLabelText('Subjective');
    writeIn(subjectiveField, 'Autosave should fail.');

    await screen.findByText('Autosave failed', {}, { timeout: 3500 });
  });
});
