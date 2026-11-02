import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
  constructor(private readonly profiles: PublicProfileService) {}

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
}
