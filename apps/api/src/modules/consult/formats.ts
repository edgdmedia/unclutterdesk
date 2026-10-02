/**
 * The one place that decides what a session time may offer, what a service
 * costs in a format, and how an address becomes a maps link (SET-06/07).
 * Slot generation, the public API, booking, staff booking and reschedule all
 * call these — the page never decides.
 */
export type Format = 'ONLINE' | 'IN_PERSON';
export const FORMATS: Format[] = ['ONLINE', 'IN_PERSON'];

/** 'online' | 'ONLINE' → 'ONLINE'; the legacy 'VIDEO' channel means online; anything else is null. */
export function asFormat(raw: unknown): Format | null {
  const v = String(raw ?? '').trim().toUpperCase();
  if (v === 'VIDEO') return 'ONLINE';
  return v === 'ONLINE' || v === 'IN_PERSON' ? v : null;
}

export interface TherapistFormats { offersOnline: boolean; offersInPerson: boolean; locationIds: bigint[] }
export interface TimeFormats { allowsOnline: boolean; allowsInPerson: boolean; locationId: bigint | null }

/** Rule 1: what one time may actually offer for this therapist. */
export function allowedFormats(
  time: TimeFormats,
  therapist: TherapistFormats,
): { online: boolean; inPerson: boolean; locationId: bigint | null } {
  const online = time.allowsOnline && therapist.offersOnline;
  const inPerson =
    time.allowsInPerson &&
    therapist.offersInPerson &&
    time.locationId != null &&
    therapist.locationIds.some((id) => id === time.locationId);
  return { online, inPerson, locationId: inPerson ? time.locationId : null };
}

/** Rule 2 + 5: the price of a service in a format, or null when not offered. */
export function priceFor(formats: Array<{ format: string; priceKobo: bigint; isActive: boolean }>, format: Format): bigint | null {
  const row = formats.find((f) => f.format === format && f.isActive);
  return row ? row.priceKobo : null;
}

/** The cheapest active price, for lists and older screens. */
export function listPrice(formats: Array<{ format: string; priceKobo: bigint; isActive: boolean }>): bigint | null {
  const active = formats.filter((f) => f.isActive);
  if (!active.length) return null;
  return active.reduce((min, f) => (f.priceKobo < min ? f.priceKobo : min), active[0].priceKobo);
}

export function mapsLink(address: string, city: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${city}`)}`;
}

/** Validation for one time (weekly or one-off), as user-facing messages. */
export function timeErrors(
  time: { formats: Format[]; locationId: bigint | null },
  therapist: TherapistFormats & { name: string },
  activeLocationIds: bigint[],
): string[] {
  const wants = new Set(time.formats);
  if (!wants.size) return ['Choose online, in person, or both.'];
  if (wants.has('IN_PERSON') && !therapist.offersInPerson) return [`${therapist.name} only works online. Turn on in-person for ${therapist.name} first.`];
  if (wants.has('ONLINE') && !therapist.offersOnline) return [`${therapist.name} doesn't see clients online. Turn on online for ${therapist.name} first.`];
  if (wants.has('IN_PERSON') && time.locationId == null) return ['Choose where in-person sessions happen.'];
  if (wants.has('IN_PERSON') && (!therapist.locationIds.some((id) => id === time.locationId) || !activeLocationIds.some((id) => id === time.locationId))) {
    return [`${therapist.name} doesn't work at that location. Add it under ${therapist.name}'s locations first.`];
  }
  return [];
}
