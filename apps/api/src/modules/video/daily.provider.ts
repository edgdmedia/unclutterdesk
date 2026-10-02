import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JoinCredentials, Participant, RoomWindow, VideoProvider } from './video-provider';

const API = 'https://api.daily.co/v1';
const unix = (d: Date) => Math.floor(d.getTime() / 1000);

@Injectable()
export class DailyProvider implements VideoProvider {
  readonly key = 'DAILY' as const;
  private domain: string | null = null;

  available() { return !!process.env.DAILY_API_KEY; }

  private async call(path: string, init: RequestInit = {}) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}`, 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Daily ${path} failed: ${res.status} ${(data as any)?.error ?? ''}`);
    return data as any;
  }

  async createRoom(bookingId: bigint, window: RoomWindow) {
    const room = await this.call('/rooms', {
      method: 'POST',
      body: JSON.stringify({
        name: `ud-${bookingId}-${randomBytes(8).toString('hex')}`,
        privacy: 'private',
        properties: { nbf: unix(window.opensAt), exp: unix(window.closesAt), eject_at_room_exp: true, enable_chat: true, enable_screenshare: true, max_participants: 6 },
      }),
    });
    return room.name as string;
  }

  async credentials(roomName: string, who: Participant, window: RoomWindow): Promise<JoinCredentials> {
    const { token } = await this.call('/meeting-tokens', {
      method: 'POST',
      body: JSON.stringify({ properties: { room_name: roomName, is_owner: who.owner, user_name: who.name, user_id: who.profileId.toString(), exp: unix(window.closesAt), eject_at_token_exp: true } }),
    });
    if (!this.domain) this.domain = (await this.call('/')).domain_name;
    return { provider: 'DAILY', roomUrl: `https://${this.domain}.daily.co/${roomName}`, token };
  }
}
