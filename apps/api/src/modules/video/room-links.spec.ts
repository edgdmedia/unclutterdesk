import { describe, expect, it } from 'vitest';
import { roomResetOnMove } from './room-links';

/**
 * VID-01: a room is made for its session's window (a Daily room closes when it
 * ends), so moving the session must let the next join make a new one. A Google
 * Meet link belongs to the calendar event and stays.
 */
describe('roomResetOnMove', () => {
  it('clears a built-in room so the new time gets its own', () => {
    expect(roomResetOnMove({ videoProvider: 'DAILY', videoRoomName: 'ud-900-x' })).toEqual({ videoProvider: null, videoRoomName: null });
  });
  it('leaves a Google Meet link and a booking with no room alone', () => {
    expect(roomResetOnMove({ videoProvider: null, videoRoomName: 'https://meet.google.com/abc' })).toEqual({});
    expect(roomResetOnMove({ videoProvider: null, videoRoomName: null })).toEqual({});
  });
});
