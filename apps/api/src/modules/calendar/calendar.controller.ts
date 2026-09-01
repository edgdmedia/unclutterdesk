import { Controller, Get, Query, Req, Res, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { authenticatedProfileId, authenticatedTenantId } from '../../common/authenticated-tenant';
import { Response } from 'express';

@ApiTags('Calendar')
@Controller('v1/calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('google/auth')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get Google OAuth URL for therapist' })
  getGoogleAuthUrl(@Req() req: any) {
    const tenantId = authenticatedTenantId(req).toString();
    const profileId = authenticatedProfileId(req).toString();
    const url = this.calendarService.generateAuthUrl(tenantId, profileId);
    return { url };
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback handler' })
  async handleGoogleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    await this.calendarService.handleCallback(code, state);
    // Redirect back to the frontend settings page
    const frontendBase = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const frontendUrl = `${frontendBase}/dashboard/settings/availability?google_connected=true`;
    res.redirect(frontendUrl);
  }

  @Get('bookings/:bookingId/ical')
  @ApiOperation({ summary: 'Download .ics calendar file for a booking' })
  async downloadIcal(@Param('bookingId') bookingId: string, @Res() res: Response) {
    const icsContent = await this.calendarService.generateIcal(BigInt(bookingId));
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="booking-${bookingId}.ics"`);
    res.send(icsContent);
  }
}
