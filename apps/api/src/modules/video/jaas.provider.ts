import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SignJWT, importPKCS8 } from 'jose';
import { JoinCredentials, Participant, RoomWindow, VideoProvider } from './video-provider';

@Injectable()
export class JaasProvider implements VideoProvider {
  readonly key = 'JAAS' as const;
  available() { return !!(process.env.JAAS_APP_ID && process.env.JAAS_KEY_ID && process.env.JAAS_PRIVATE_KEY); }

  async createRoom(bookingId: bigint, _window: RoomWindow) {
    // JaaS rooms exist when the first person with a valid token joins.
    return `ud-${bookingId}-${randomBytes(12).toString('hex')}`;
  }

  async credentials(roomName: string, who: Participant, window: RoomWindow): Promise<JoinCredentials> {
    const appId = process.env.JAAS_APP_ID!;
    const key = await importPKCS8(process.env.JAAS_PRIVATE_KEY!.replace(/\\n/g, '\n'), 'RS256');
    const jwt = await new SignJWT({
      room: roomName,
      context: {
        user: { id: who.profileId.toString(), name: who.name, moderator: who.owner ? 'true' : 'false' },
        features: { recording: 'false', livestreaming: 'false', transcription: 'false', 'outbound-call': 'false' },
      },
    })
      .setProtectedHeader({ alg: 'RS256', kid: process.env.JAAS_KEY_ID!, typ: 'JWT' })
      .setAudience('jitsi')
      .setIssuer('chat')
      .setSubject(appId)
      .setNotBefore(Math.floor(window.opensAt.getTime() / 1000))
      .setExpirationTime(Math.floor(window.closesAt.getTime() / 1000))
      .sign(key);
    return { provider: 'JAAS', appId, roomName, jwt };
  }
}
