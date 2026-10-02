/**
 * VID-01: where a session's video is joined. Every email, calendar invite and
 * view builds its link here, so none of them sends people to a provider URL.
 * A therapist on Google Meet keeps the Meet link from their calendar event.
 */
export const isMeetLink = (roomName: string | null | undefined): roomName is string =>
  !!roomName && roomName.startsWith('https://meet.google.com');

/** The client's room page on the practice's own address. The therapist is admitted there too. */
export function clientRoomUrl(origin: string, bookingId: bigint | number | string): string {
  return `${origin}/portal/sessions/${bookingId}/room`;
}

/** The therapist's room inside the app. */
export function staffRoomPath(bookingId: bigint | number | string): string {
  return `/session/${bookingId}`;
}

/** The join link for anyone outside the app: an email or a calendar invite. */
export function joinLinkFor(origin: string, booking: { id: bigint | number | string; videoRoomName?: string | null }): string {
  return isMeetLink(booking.videoRoomName) ? booking.videoRoomName : clientRoomUrl(origin, booking.id);
}

/**
 * A room is made for its session's window (a Daily room closes when it ends),
 * so a moved session needs a new one: the next join makes it. A Google Meet
 * link belongs to the calendar event and is left alone.
 */
export function roomResetOnMove(booking: { videoProvider?: string | null; videoRoomName?: string | null }): { videoProvider?: null; videoRoomName?: null } {
  return booking.videoProvider ? { videoProvider: null, videoRoomName: null } : {};
}
