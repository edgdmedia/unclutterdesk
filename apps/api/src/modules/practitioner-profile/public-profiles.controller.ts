import { Body, Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ProfileReportsService } from './profile-reports.service';
import { PublicProfileService } from './public-profile.service';

/**
 * Public profile reads for the profiles site's server renderer (spec §6.11).
 * No guard, no cookies read; responses are the same for everyone, so they may
 * be cached at the edge. The sitemap route comes before :handle ("sitemap"
 * is a reserved handle in any case).
 */
@ApiTags('Public profiles')
@Controller('v1/profiles')
export class PublicProfilesController {
  constructor(
    private readonly profiles: PublicProfileService,
    private readonly reports: ProfileReportsService,
  ) {}

  @Get('sitemap')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Published handles and when each last changed' })
  sitemap() {
    return this.profiles.sitemap();
  }

  @Get(':handle')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'A published profile, or where an old handle moved to' })
  byHandle(@Param('handle') handle: string) {
    return this.profiles.byHandle(handle);
  }

  /**
   * "Report this profile" (§6.15). No session: the profiles site posts it
   * server to server, and browsers on the profiles origin get credential-free
   * CORS for this route only (common/cors.ts). Rate-limited per IP; a honeypot
   * field catches simple bots.
   */
  @Post(':handle/report')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Report a published profile' })
  report(@Param('handle') handle: string, @Body() dto: { type?: unknown; details?: unknown; website?: unknown }) {
    return this.reports.submit(handle, dto ?? {});
  }
}
