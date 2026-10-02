import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JoinCredentials, Participant, RoomWindow, VideoProvider } from './video-provider';

/** Last resort: a long random meet.jit.si room, opened in a new tab. */
@Injectable()
export class LinkProvider implements VideoProvider {
  readonly key = 'LINK' as const;
  available() { return true; }
  async createRoom(_bookingId: bigint, _window: RoomWindow) { return `unclutterdesk-${randomBytes(16).toString('hex')}`; }
  async credentials(roomName: string, _who: Participant, _window: RoomWindow): Promise<JoinCredentials> { return { provider: 'LINK', url: `https://meet.jit.si/${roomName}` }; }
}
