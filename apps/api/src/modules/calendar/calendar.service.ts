import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual, randomBytes, randomUUID, createHash } from 'crypto';
import { JWT_SECRET } from '../../common/auth.config';
import { google } from 'googleapis';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private oauth2Client;

  constructor(private readonly prisma: PrismaService) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NODE_ENV === 'production' 
        ? 'https://api.unclutterdesk.com/v1/calendar/google/callback'
        : 'http://localhost:3001/v1/calendar/google/callback'
    );
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

    return this.oauth2Client.generateAuthUrl({
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
      ({ tokens } = await this.oauth2Client.getToken(code));
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

  private getVideoRoomLink(videoRoomName: string | null): string {
    if (!videoRoomName) return '';
    return videoRoomName.startsWith('http') ? videoRoomName : `https://meet.jit.si/${videoRoomName}`;
  }

  async pushBookingToGoogle(bookingId: bigint) {
    const booking = await this.prisma.consultBooking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        client: true,
        availability: {
          include: {
            therapist: true,
          }
        }
      }
    });

    if (!booking || booking.status !== 'CONFIRMED') return;
    const refreshToken = booking.availability.therapist.googleRefreshToken;
    if (!refreshToken) return;

    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const clientName = `${booking.client.firstName || ''} ${booking.client.lastName || ''}`.trim() || booking.client.email;

      const isGoogleMeet = booking.availability.therapist.videoProvider === 'GOOGLE_MEET';
      const videoLink = this.getVideoRoomLink(booking.videoRoomName);

      const res = await calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: isGoogleMeet ? 1 : 0,
        requestBody: {
          summary: `${booking.service.title} with ${clientName}`,
          description: `Booking ID: ${booking.id}\nClient: ${clientName}\nEmail: ${booking.client.email}\nPhone: ${booking.client.phone || 'N/A'}\n\nVideo Room: ${videoLink}`,
          start: {
            dateTime: booking.availability.startsAt.toISOString(),
          },
          end: {
            dateTime: booking.availability.endsAt.toISOString(),
          },
          attendees: [
            { email: booking.client.email }
          ],
          ...(isGoogleMeet ? {
            conferenceData: {
              createRequest: {
                requestId: `booking-${booking.id}-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
          } : {}),
        },
      });

      this.logger.log(`Pushed booking ${booking.id} to Google Calendar`);

      const hangoutLink = res.data.hangoutLink;
      if (hangoutLink && hangoutLink !== booking.videoRoomName) {
        // Update the booking to use the new Google Meet link
        await this.prisma.consultBooking.update({
          where: { id: bookingId },
          data: { videoRoomName: hangoutLink },
        });

        // Also update the description to reflect the new link
        await calendar.events.patch({
          calendarId: 'primary',
          eventId: res.data.id!,
          requestBody: {
            description: `Booking ID: ${booking.id}\nClient: ${clientName}\nEmail: ${booking.client.email}\nPhone: ${booking.client.phone || 'N/A'}\n\nVideo Room: ${hangoutLink}`,
          }
        });
        
        this.logger.log(`Generated Google Meet link for booking ${booking.id}`);
      }

    } catch (error) {
      this.logger.error(`Failed to push booking ${booking.id} to Google`, error);
    }
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

    const videoLink = this.getVideoRoomLink(booking.videoRoomName);

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Unclutter OS//Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:booking-${booking.id}@unclutter.os`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${booking.service.title} with ${therapistName}`,
      `DESCRIPTION:Therapy session with ${therapistName}.\\nClient: ${clientName}\\n\\nJoin Video Session: ${videoLink}`,
      `LOCATION:${videoLink}`,
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
