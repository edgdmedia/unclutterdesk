/**
 * VID-01: every video provider behind one interface. The router picks one when a
 * booking's room is first needed; the room service never knows which it got.
 */
export type ProviderKey = 'DAILY' | 'JAAS' | 'LINK';
export interface RoomWindow { opensAt: Date; closesAt: Date }
export interface Participant { profileId: bigint; name: string; owner: boolean }
export type JoinCredentials =
  | { provider: 'DAILY'; roomUrl: string; token: string }
  | { provider: 'JAAS'; appId: string; roomName: string; jwt: string }
  | { provider: 'LINK'; url: string }
  | { provider: 'GOOGLE_MEET'; url: string };
export interface VideoProvider {
  readonly key: ProviderKey;
  available(): boolean;
  /** Returns the room's name (stored on the booking). Throws on provider failure. */
  createRoom(bookingId: bigint, window: RoomWindow): Promise<string>;
  credentials(roomName: string, who: Participant, window: RoomWindow): Promise<JoinCredentials>;
}
export const VIDEO_PROVIDERS = Symbol('VIDEO_PROVIDERS');
