import type { LucideIcon } from 'lucide-react';

/** VID-01: what POST /v1/video/bookings/:id/join returns (mirrors the API's JoinResult). */
export type JoinCredentials =
  | { provider: 'DAILY'; roomUrl: string; token: string }
  | { provider: 'JAAS'; appId: string; roomName: string; jwt: string }
  | { provider: 'LINK'; url: string }
  | { provider: 'GOOGLE_MEET'; url: string };

export type JoinResponse = JoinCredentials & {
  participantId: string | null;
  closesAt: string;
  role: 'THERAPIST' | 'CLIENT' | 'STAFF';
};

/** The call's own state and actions, whichever provider runs it. */
export interface CallControls {
  muted: boolean;
  cameraOff: boolean;
  sharing: boolean;
  toggleMic(): void;
  toggleCamera(): void;
  toggleShare(): void;
}

/** A page's own button in the bar, such as the therapist's NOTES. */
export interface ControlButton {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick(): void;
}

/** Each stage draws the bar from its own call state. */
export type RenderBar = (controls: CallControls | null) => React.ReactNode;
