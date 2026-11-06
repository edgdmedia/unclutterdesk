import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual, randomBytes, randomUUID, createHash } from 'crypto';
import { JWT_SECRET } from '../../common/auth.config';
import type { auth as authNs } from '@googleapis/calendar';
type OAuth2Client = InstanceType<typeof authNs.OAuth2>;
import { PrismaService } from '../../common/prisma/prisma.service';
import { lazyModule } from '../../common/lazy-module';
import { apiOrigin, ICAL_UID_DOMAIN, tenantWebOrigin } from '../../common/origins';
import { joinLinkFor } from '../video/room-links';
import { PLAN_SELECT, practiceEntitlements, requiredTierFor } from '../entitlements/entitlements';
import { EntitlementError } from '../entitlements/entitlement.error';

/**
 * Google Calendar's own client, @googleapis/calendar, not the whole
 * `googleapis` (every Google API): that package took ~0.7 s to load and its
 * types alone pushed the build past 2 GB of memory, which made deploys on the
 * production server slow (see common/lazy-module.ts). Loaded on first use.
 */
const loadGoogle = lazyModule<typeof import('@googleapis/calendar')>(() => import('@googleapis/calendar'), (m) => (m?.calendar ? m : m.default));

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private readonly prisma: PrismaService) {
    // Must match an "Authorized redirect URI" on the Google OAuth client
    // exactly, or Google refuses with redirect_uri_mismatch. Logged at start
    // so the value to register is never a guess.
    if (process.env.GOOGLE_CLIENT_ID) {
      this.logger.log(`Google Calendar OAuth redirect URI: ${CalendarService.redirectUri()}`);
    }
  }

  /**
   * A new OAuth client for each use. One shared client had each push call
   * setCredentials on it, so two pushes for different practitioners at once
   * could send one practitioner's event with the other's credentials.
   */
  private async oauthClient(refreshToken?: string): Promise<OAuth2Client> {
    const google = await loadGoogle();
    const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, CalendarService.redirectUri());
    if (refreshToken) client.setCredentials({ refresh_token: refreshToken });
    return client;
  }

  static redirectUri(): string {
    const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
    if (configured) return configured;
    return process.env.NODE_ENV === 'production'
      ? `${apiOrigin(true)}/v1/calendar/google/callback`
      : 'http://localhost:3001/v1/calendar/google/callback';
  }

  private static readonly OAUTH_STATE_TYPE = 'google_oauth_state';
  private static readonly OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

  private static hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private static sign(payload: string): string {
    return createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  }

  /**
   * Builds the Google consent URL with a state parameter that cannot be forged.
   *
   * The state used to be `${tenantId}_${profileId}` — entirely predictable from
   * two sequential ids. Anyone could start a consent flow with their own Google
   * account, put a victim's ids in the state, and have their refresh token
   * written onto that therapist's profile; from then on the practice's bookings
   * would be pushed to the attacker's calendar.
   *
   * The state is now a signed payload carrying tenant, profile, a random nonce
   * and an expiry. The nonce is also stored so the callback can consume it
   * exactly once, which stops a captured state being replayed.
   */
  async generateAuthUrl(tenantId: string, profileId: string, userId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: BigInt(tenantId) },
      select: PLAN_SELECT,
    });
    if (!practiceEntitlements(tenant).googleCalendarSync) {
      throw new EntitlementError('googleCalendarSync', requiredTierFor('googleCalendarSync'));
    }
    const nonce = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + CalendarService.OAUTH_STATE_TTL_MS);

    await this.prisma.token.create({
      data: {
        id: randomUUID(),
        userId: BigInt(userId),
        type: CalendarService.OAUTH_STATE_TYPE,
        tokenHash: CalendarService.hash(nonce),
        expiresAt,
      },
    });

    const payload = Buffer.from(
      JSON.stringify({ t: tenantId, p: profileId, n: nonce, e: expiresAt.getTime() }),
    ).toString('base64url');

    return (await this.oauthClient()).generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Force to get refresh token
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      state: `${payload}.${CalendarService.sign(payload)}`,
    });
  }

  async handleCallback(code: string, state: string) {
    if (!state) throw new BadRequestException('State missing from callback');

    const [payload, signature] = state.split('.');
    if (!payload || !signature) throw new BadRequestException('Malformed state');

    const expected = Buffer.from(CalendarService.sign(payload), 'utf8');
    const provided = Buffer.from(signature, 'utf8');
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      this.logger.warn('Rejected Google OAuth callback: state signature mismatch');
      throw new BadRequestException('Invalid state');
    }

    let decoded: { t: string; p: string; n: string; e: number };
    try {
      decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Malformed state');
    }

    if (!decoded?.t || !decoded?.p || !decoded?.n || Date.now() > decoded.e) {
      throw new BadRequestException('State has expired — start the connection again');
    }

    // Consume the nonce. deleteMany returning 0 means it was never issued or has
    // already been used, so a captured state cannot be replayed.
    const consumed = await this.prisma.token.deleteMany({
      where: { tokenHash: CalendarService.hash(decoded.n), type: CalendarService.OAUTH_STATE_TYPE },
    });
    if (consumed.count === 0) {
      this.logger.warn('Rejected Google OAuth callback: state already used or unknown');
      throw new BadRequestException('Invalid state');
    }

    const tenantId = BigInt(decoded.t);
    const profileId = BigInt(decoded.p);

    let tokens;
    try {
      ({ tokens } = await (await this.oauthClient()).getToken(code));
    } catch (error) {
      this.logger.error('Failed to get Google OAuth tokens', error as Error);
      throw new BadRequestException('Failed to authenticate with Google');
    }

    if (!tokens?.refresh_token) return;

    // Scoped by tenant as well as profile: the previous update matched on
    // profileId alone, so a forged state could write a refresh token onto a
    // profile in another practice.
    const updated = await this.prisma.consultTherapistProfile.updateMany({
      where: { tenantId, profileId },
      data: { googleRefreshToken: tokens.refresh_token },
    });

    if (updated.count === 0) {
      throw new BadRequestException('Practitioner not found in this practice');
    }

    this.logger.log(`Google Calendar connected for therapist ${profileId}`);
  }

  /** VID-01: the session's room in the app, or the therapist's Google Meet. */
  private getVideoRoomLink(booking: { id: bigint; videoRoomName: string | null; tenant: Parameters<typeof tenantWebOrigin>[0] }): string {
    return joinLinkFor(tenantWebOrigin(booking.tenant), booking);
  }

  /** The Google Calendar client acting as one practitioner (the network boundary in tests). */
  protected async calendarApi(refreshToken: string) {
    const google = await loadGoogle();
    return google.calendar({ version: 'v3', auth: await this.oauthClient(refreshToken) });
  }

  /** A 404 or 410 from Google: the event was deleted there, by the practitioner or the client. */
  private static gone(err: unknown): boolean {
    const code = Number((err as any)?.code ?? (err as any)?.response?.status);
    return code === 404 || code === 410;
  }

  /**
   * Keeps the session's Google Calendar event in step with the session: made
   * once and remembered, updated when the session moves (the same event, so
   * the same Meet link), moved when the session goes to another practitioner,
   * and removed when it is cancelled. Every push used to insert a new event,
   * so a moved session left its old one, and old Meet link, behind.
   *
   * Call it after any change to a booking. Best effort: a Google failure is
   * logged and never fails the change that called it.
   */
  async pushBookingToGoogle(bookingId: bigint) {
    const booking = await this.prisma.consultBooking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        client: true,
        location: true,
        tenant: true,
        availability: {
          include: {
            therapist: true,
          }
        }
      }
    });
    if (!booking) return;

    try {
      const providerId = booking.availability.providerProfileId;
      const keep =
        booking.status === 'CONFIRMED' &&
        // A connection made on a paid plan stays stored after a downgrade, but
        // nothing is pushed until the practice is back on a plan that includes it.
        practiceEntitlements(booking.tenant).googleCalendarSync &&
        Boolean(booking.availability.therapist.googleRefreshToken);

      // An event in another practitioner's calendar (the session was taken
      // over), or one for a session no longer happening, comes out first.
      let eventId = booking.googleEventId;
      if (eventId && (!keep || booking.googleEventOwnerProfileId !== providerId)) {
        const ownToken = booking.googleEventOwnerProfileId === providerId ? booking.availability.therapist.googleRefreshToken : null;
        await this.removeEvent(booking.id, eventId, booking.googleEventOwnerProfileId, ownToken);
        eventId = null;
      }
      if (!keep) return;

      const calendar = await this.calendarApi(booking.availability.therapist.googleRefreshToken!);
      // Pushed before events were remembered: find the one made then, so a
      // first move after this change updates it instead of adding another.
      if (!eventId && !booking.googleEventId) eventId = await this.findEarlierEvent(calendar, booking.id);
      const clientName = `${booking.client.firstName || ''} ${booking.client.lastName || ''}`.trim() || booking.client.email;
      const isGoogleMeet = booking.availability.therapist.videoProvider === 'GOOGLE_MEET';
      const inPerson = booking.format === 'IN_PERSON' && booking.location;
      const describe = (videoLink: string) => {
        // SET-06: an in-person event carries the address, not a room.
        const where = inPerson ? `${booking.location!.name}, ${booking.location!.address}, ${booking.location!.city}` : videoLink;
        const whereLine = inPerson ? `Where: ${where}${booking.location!.directions ? `\nDirections: ${booking.location!.directions}` : ''}` : `Video Room: ${videoLink}`;
        return {
          summary: `${booking.service.title} with ${clientName}`,
          description: `Booking ID: ${booking.id}\nClient: ${clientName}\nEmail: ${booking.client.email}\nPhone: ${booking.client.phone || 'N/A'}\n\n${whereLine}`,
          ...(inPerson ? { location: where } : {}),
          start: { dateTime: booking.availability.startsAt.toISOString() },
          end: { dateTime: booking.availability.endsAt.toISOString() },
          attendees: [{ email: booking.client.email }],
          // Finds the event again whatever its text says.
          extendedProperties: { private: { unclutterBookingId: booking.id.toString() } },
        };
      };

      if (eventId) {
        try {
          // The same event: its Meet link, if it has one, stays as it is.
          await calendar.events.patch({ calendarId: 'primary', eventId, requestBody: describe(this.getVideoRoomLink(booking)) });
          if (eventId !== booking.googleEventId) {
            await this.prisma.consultBooking.update({ where: { id: bookingId }, data: { googleEventId: eventId, googleEventOwnerProfileId: providerId } });
          }
          this.logger.log(`Updated booking ${booking.id} in Google Calendar`);
          return;
        } catch (err) {
          if (!CalendarService.gone(err)) throw err;
          // Deleted in Google: make it again below.
        }
      }

      const res = await calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: isGoogleMeet ? 1 : 0,
        requestBody: {
          ...describe(this.getVideoRoomLink(booking)),
          ...(isGoogleMeet
            ? { conferenceData: { createRequest: { requestId: `booking-${booking.id}-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } } }
            : {}),
        },
      });
      this.logger.log(`Pushed booking ${booking.id} to Google Calendar`);

      const hangoutLink = res.data.hangoutLink;
      await this.prisma.consultBooking.update({
        where: { id: bookingId },
        data: {
          googleEventId: res.data.id ?? null,
          googleEventOwnerProfileId: providerId,
          // The session's Meet link is the event's.
          ...(hangoutLink && hangoutLink !== booking.videoRoomName ? { videoRoomName: hangoutLink } : {}),
        },
      });
      if (hangoutLink && hangoutLink !== booking.videoRoomName && res.data.id) {
        await calendar.events.patch({ calendarId: 'primary', eventId: res.data.id, requestBody: { description: describe(hangoutLink).description } });
        this.logger.log(`Generated Google Meet link for booking ${booking.id}`);
      }
    } catch (error) {
      this.logger.error(`Failed to push booking ${booking.id} to Google`, error);
    }
  }

  /**
   * The event an earlier push made for this booking, before events were
   * remembered. Its description starts "Booking ID: <id>"; newer events also
   * carry the id as a private property. Best effort: none found means a new one.
   */
  private async findEarlierEvent(calendar: Awaited<ReturnType<CalendarService['calendarApi']>>, bookingId: bigint): Promise<string | null> {
    try {
      const marker = `Booking ID: ${bookingId}\n`;
      const res = await calendar.events.list({ calendarId: 'primary', q: `Booking ID: ${bookingId}`, maxResults: 10, showDeleted: false });
      const found = (res.data.items ?? []).find(
        (e) => e.extendedProperties?.private?.unclutterBookingId === bookingId.toString() || (e.description ?? '').startsWith(marker),
      );
      return found?.id ?? null;
    } catch {
      return null;
    }
  }

  /** Removes the event from the calendar it is in, and forgets it. Already gone counts as removed. */
  private async removeEvent(bookingId: bigint, eventId: string, ownerProfileId: bigint | null, knownToken: string | null = null) {
    const token =
      knownToken ??
      (ownerProfileId
        ? (await this.prisma.consultTherapistProfile.findFirst({ where: { profileId: ownerProfileId }, select: { googleRefreshToken: true } }))?.googleRefreshToken ?? null
        : null);
    if (token) {
      try {
        const calendar = await this.calendarApi(token);
        await calendar.events.delete({ calendarId: 'primary', eventId });
        this.logger.log(`Removed booking ${bookingId}'s event from Google Calendar`);
      } catch (err) {
        if (!CalendarService.gone(err)) throw err;
      }
    }
    // Without a token (disconnected) there is no way to reach that calendar;
    // forget the event so the next push starts clean.
    await this.prisma.consultBooking.updateMany({
      where: { id: bookingId, googleEventId: eventId },
      data: { googleEventId: null, googleEventOwnerProfileId: null },
    });
  }

  /**
   * Unguessable token for a booking's .ics link.
   *
   * The calendar download has to work for a client who booked without creating
   * an account, so it cannot sit behind the session guard — but booking ids are
   * sequential, and the file contains the client's name, the therapist's name,
   * the appointment time and the video join link. Jitsi rooms are
   * unauthenticated, so that link alone lets a stranger walk into a therapy
   * session. The token makes the URL unguessable without adding a login.
   */
  static icalToken(bookingId: bigint): string {
    return createHmac('sha256', JWT_SECRET)
      .update(`ical:${bookingId}`)
      .digest('hex')
      .slice(0, 32);
  }

  async generateIcal(bookingId: bigint, token: string): Promise<string> {
    const expected = CalendarService.icalToken(bookingId);
    const provided = typeof token === 'string' ? token : '';
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');

    // Not found rather than forbidden, and the same for a wrong token as for a
    // missing booking, so ids cannot be probed.
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new NotFoundException('Booking not found');
    }

    const booking = await this.prisma.consultBooking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        client: true,
        location: true,
        tenant: true,
        availability: {
          include: {
            therapist: {
              include: { profile: true }
            },
          }
        }
      }
    });

    if (!booking) throw new NotFoundException('Booking not found');

    const dtStart = this.formatIcalDate(booking.availability.startsAt);
    const dtEnd = this.formatIcalDate(booking.availability.endsAt);
    const dtStamp = this.formatIcalDate(new Date());

    const therapistName = `${booking.availability.therapist.profile.firstName || ''} ${booking.availability.therapist.profile.lastName || ''}`.trim();
    const clientName = `${booking.client.firstName || ''} ${booking.client.lastName || ''}`.trim() || booking.client.email;

    const videoLink = this.getVideoRoomLink(booking);
    // SET-06: in-person invites carry the address and directions.
    const inPerson = booking.format === 'IN_PERSON' && booking.location;
    const where = inPerson ? `${booking.location.name}, ${booking.location.address}, ${booking.location.city}` : videoLink;
    const whereLine = inPerson
      ? `Where: ${where}${booking.location.directions ? `\\nDirections: ${booking.location.directions}` : ''}`
      : `Join Video Session: ${videoLink}`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      // Written into the client's own calendar, where it outlives the
      // booking — so it carries the product's real name and domain.
      'PRODID:-//Unclutter Desk//Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:booking-${booking.id}@${ICAL_UID_DOMAIN}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${booking.service.title} with ${therapistName}`,
      `DESCRIPTION:Therapy session with ${therapistName}.\\nClient: ${clientName}\\n\\n${whereLine}`,
      `LOCATION:${where}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    return icsContent;
  }

  private formatIcalDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }
}
