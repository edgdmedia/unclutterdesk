import { Controller, Post, Param, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrivacyService } from './privacy.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { authenticatedTenantId, authenticatedProfileId } from '../../common/authenticated-tenant';

@ApiTags('Privacy')
@Controller('v1/privacy')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  /**
   * Irreversible. Rate limited hard because there is no undo: a compromised
   * admin session should not be able to erase a client list in a burst.
   */
  @Post('clients/:profileId/erase')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(200)
  @ApiOperation({
    summary: "Erase a client's personal data, retaining records the law requires",
  })
  eraseClient(@Req() req: any, @Param('profileId') profileId: string) {
    return this.privacyService.eraseClientPersonalData(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
      BigInt(profileId),
    );
  }
}
