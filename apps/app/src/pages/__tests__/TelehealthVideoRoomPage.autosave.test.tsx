import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TelehealthVideoRoomPage } from '../TelehealthVideoRoomPage';

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
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

    const subjectiveField = screen.getAllByRole('textbox')[0];
    fireEvent.change(subjectiveField, { target: { value: 'Client reports improved sleep.' } });

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
      latestNote: {
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

    const subjectiveField = screen.getAllByRole('textbox')[0];
    fireEvent.change(subjectiveField, { target: { value: 'Autosave should fail.' } });

    await screen.findByText('Autosave failed', {}, { timeout: 3500 });
  });
});
