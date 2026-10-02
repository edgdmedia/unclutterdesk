import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderWithApp, screen, waitFor, fireEvent, cleanup, act } from '../../../test/renderWithApp';

/**
 * VID-01: the session's video, inside the designed room. The network (apiClient)
 * and the two video SDKs are the only stand-ins; the stage, controls and
 * heartbeat are real.
 */
const apiPost = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  api: { post: (...args: unknown[]) => apiPost(...args), get: vi.fn() },
  API_BASE: '',
}));

const daily = vi.hoisted(() => ({
  join: vi.fn().mockResolvedValue(undefined),
  leave: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn().mockResolvedValue(undefined),
  setLocalAudio: vi.fn(),
  setLocalVideo: vi.fn(),
  startScreenShare: vi.fn(),
  stopScreenShare: vi.fn(),
}));
vi.mock('@daily-co/daily-js', () => ({ default: { createCallObject: () => daily } }));
vi.mock('@daily-co/daily-react', () => ({
  DailyProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="daily-provider">{children}</div>,
  DailyVideo: ({ sessionId, type }: { sessionId: string; type?: string }) => <div data-testid={`daily-video-${type ?? 'video'}-${sessionId}`} />,
  DailyAudio: () => null,
  useDaily: () => daily,
  useParticipantIds: ({ filter }: { filter?: string } = {}) => (filter === 'remote' ? participants.remote : [...participants.local, ...participants.remote]),
  useLocalSessionId: () => 'me',
  useAudioTrack: () => ({ isOff: false }),
  useVideoTrack: () => ({ isOff: false }),
  useScreenShare: () => ({ isSharingScreen: false, screens: [] }),
  useParticipantProperty: () => 'Ada Okafor',
}));
const participants = { local: ['me'], remote: ['them'] as string[] };

const jitsi = vi.hoisted(() => ({ executeCommand: vi.fn(), addListener: vi.fn(), props: null as any }));
vi.mock('@jitsi/react-sdk', () => ({
  JaaSMeeting: (props: any) => {
    jitsi.props = props;
    React.useEffect(() => {
      props.onApiReady?.({ executeCommand: jitsi.executeCommand, addListener: jitsi.addListener });
    }, []);
    return <div data-testid="jaas-meeting" />;
  },
}));

const { VideoStage } = await import('../VideoStage');

const DAILY = { provider: 'DAILY', roomUrl: 'https://ud.daily.co/ud-900-x', token: 'tok', participantId: '77', closesAt: '2026-10-06T10:50:00Z', role: 'CLIENT' };
const JAAS = { provider: 'JAAS', appId: 'vpaas-magic-cookie-abc', roomName: 'ud-900-y', jwt: 'jwt-1', participantId: '78', closesAt: '2026-10-06T10:50:00Z', role: 'CLIENT' };
const LINK = { provider: 'LINK', url: 'https://meet.jit.si/unclutterdesk-abc', participantId: '79', closesAt: '2026-10-06T10:50:00Z', role: 'CLIENT' };

function stage(onLeft = vi.fn()) {
  renderWithApp(<VideoStage bookingId="900" endLabel="Leave" waitingFor="Dr Smith" onLeft={onLeft} />);
  return { onLeft };
}

beforeEach(() => {
  apiPost.mockReset();
  participants.remote = ['them'];
  Object.values(daily).forEach((f) => (f as any).mockClear?.());
  // Daily's join and destroy always return promises.
  daily.join.mockResolvedValue(undefined);
  daily.destroy.mockResolvedValue(undefined);
  jitsi.executeCommand.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('VideoStage', () => {
  it('asks for this booking\'s room and joins Daily with the token', async () => {
    apiPost.mockResolvedValue(DAILY);
    stage();
    await waitFor(() => expect(daily.join).toHaveBeenCalledWith({ url: DAILY.roomUrl, token: 'tok' }));
    expect(apiPost).toHaveBeenCalledWith('/v1/video/bookings/900/join', {});
    expect(screen.getByTestId('daily-video-video-them')).toBeTruthy();
  });

  it('mutes the microphone through Daily', async () => {
    apiPost.mockResolvedValue(DAILY);
    stage();
    await waitFor(() => expect(daily.join).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(daily.setLocalAudio).toHaveBeenCalledWith(false);
  });

  it('says who it is waiting for while alone in the room', async () => {
    participants.remote = [];
    apiPost.mockResolvedValue(DAILY);
    stage();
    await waitFor(() => expect(screen.getByText('Waiting for Dr Smith to join')).toBeTruthy());
  });

  it('leaves the call when the page closes', async () => {
    apiPost.mockResolvedValue(DAILY);
    stage();
    await waitFor(() => expect(daily.join).toHaveBeenCalled());
    cleanup();
    await waitFor(() => expect(daily.destroy).toHaveBeenCalled());
  });

  it('runs a JaaS room with its token, and mutes through the Jitsi API', async () => {
    apiPost.mockResolvedValue(JAAS);
    stage();
    await waitFor(() => expect(screen.getByTestId('jaas-meeting')).toBeTruthy());
    expect(jitsi.props).toMatchObject({ appId: JAAS.appId, roomName: 'ud-900-y', jwt: 'jwt-1' });
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(jitsi.executeCommand).toHaveBeenCalledWith('toggleAudio');
  });

  it('opens a link room in a new tab', async () => {
    apiPost.mockResolvedValue(LINK);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    stage();
    fireEvent.click(await screen.findByRole('button', { name: 'Open video call' }));
    expect(open).toHaveBeenCalledWith(LINK.url, '_blank', 'noopener');
    open.mockRestore();
  });

  it('names Google Meet when the therapist uses it', async () => {
    apiPost.mockResolvedValue({ provider: 'GOOGLE_MEET', url: 'https://meet.google.com/abc', participantId: null, closesAt: '2026-10-06T10:50:00Z', role: 'CLIENT' });
    stage();
    expect(await screen.findByText(/Google Meet/)).toBeTruthy();
  });

  it('shows why the room is closed, and checks again on request', async () => {
    apiPost.mockRejectedValueOnce(new Error('This room opens at 9:45 AM.')).mockResolvedValueOnce(DAILY);
    stage();
    expect(await screen.findByText('This room opens at 9:45 AM.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    await waitFor(() => expect(daily.join).toHaveBeenCalled());
  });

  it('says so when the call cannot start, and offers to try again', async () => {
    apiPost.mockResolvedValue(DAILY);
    daily.join.mockRejectedValueOnce(new Error('meeting token expired'));
    stage();
    expect(await screen.findByText('The video call could not start. Check your connection and try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2));
  });

  it('hands the end button to the page', async () => {
    apiPost.mockResolvedValue(DAILY);
    const { onLeft } = stage();
    await waitFor(() => expect(daily.join).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(onLeft).toHaveBeenCalled();
  });

  it('keeps its minutes current with a heartbeat every minute', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiPost.mockImplementation((path: string) => Promise.resolve(path.endsWith('/join') ? DAILY : { ok: true }));
    stage();
    await waitFor(() => expect(daily.join).toHaveBeenCalled());
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(apiPost).toHaveBeenCalledWith('/v1/video/participants/77/heartbeat', {});
  });
});
