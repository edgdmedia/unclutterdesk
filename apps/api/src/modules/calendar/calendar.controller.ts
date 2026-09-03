import { Controller, Get, Query, Req, Res, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { CLINICAL, Roles } from '../../common/roles';
import { authenticatedProfileId, authenticatedTenantId } from '../../common/authenticated-tenant';
import { Response } from 'express';

@ApiTags('Calendar')
@Controller('v1/calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Roles(...CLINICAL)
  @Get('google/auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get Google OAuth URL for therapist' })
  async getGoogleAuthUrl(@Req() req: any) {
    const url = await this.calendarService.generateAuthUrl(
      authenticatedTenantId(req).toString(),
      authenticatedProfileId(req).toString(),
      String(req.user.userId),
    );
    return { url };
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback handler' })
  async handleGoogleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const frontendBase = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
    try {
      await this.calendarService.handleCallback(code, state);
    } catch {
      // The browser lands here from Google, so an error page would be a dead
      // end. Send them back to settings with the failure marked instead, and
      // say nothing about why — the reason is in the server log.
      res.redirect(`${frontendBase}/dashboard/settings/availability?google_connected=false`);
      return;
    }
    res.redirect(`${frontendBase}/dashboard/settings/availability?google_connected=true`);
  }

  @Get('bookings/:bookingId/ical')
  @ApiOperation({ summary: 'Download .ics calendar file for a booking' })
  async downloadIcal(
    @Param('bookingId') bookingId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const icsContent = await this.calendarService.generateIcal(BigInt(bookingId), token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="booking-${bookingId}.ics"`);
    res.send(icsContent);
  }
}
