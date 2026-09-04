import { Controller, Get, Post, Param, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrivacyService } from './privacy.service';
import { DataExportService } from './data-export.service';
import { PracticeClosureService } from './practice-closure.service';
import { PlatformAdminGuard } from '../admin/platform-admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { PRACTICE_ADMIN, Roles } from '../../common/roles';
import { authenticatedTenantId, authenticatedProfileId } from '../../common/authenticated-tenant';

@ApiTags('Privacy')
@Controller('v1/privacy')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class PrivacyController {
  constructor(
    private readonly privacyService: PrivacyService,
    private readonly dataExportService: DataExportService,
    private readonly closureService: PracticeClosureService,
  ) {}

  /**
   * Irreversible. Rate limited hard because there is no undo: a compromised
   * admin session should not be able to erase a client list in a burst.
   */
  @Roles(...PRACTICE_ADMIN)
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

  /**
   * The counterpart to erasure: a copy of what is held, so a subject access
   * request has a route through the product. Rate limited because an export is
   * the whole of someone's record in one response.
   */
  @Roles(...PRACTICE_ADMIN)
  @Get('clients/:profileId/export')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: "Export a client's personal data for a subject access request",
    description:
      'Returns the client\'s own records as JSON. Clinical notes are listed without their content — releasing clinical narrative is a decision the practitioner makes.',
  })
  exportClient(@Req() req: any, @Param('profileId') profileId: string) {
    return this.dataExportService.exportClientData(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
      BigInt(profileId),
    );
  }

  /**
   * Closes the practice: deactivates it and starts the retention window.
   * Reversible — nothing is deleted until the purge below.
   */
  @Roles('OWNER')
  @Post('practice/close')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Close this practice account and begin the retention window' })
  closePractice(@Req() req: any, @Body() dto: { confirmSlug: string }) {
    return this.closureService.requestClosure(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
      dto?.confirmSlug,
    );
  }
}

/**
 * Separate controller: the purge is platform-operated, not something a practice
 * can trigger, so it carries a different guard entirely.
 */
@ApiTags('Privacy')
@Controller('v1/admin/privacy')
@UseGuards(PlatformAdminGuard)
@ApiBearerAuth('access-token')
export class PlatformPrivacyController {
  constructor(private readonly closureService: PracticeClosureService) {}

  /** Irreversible. Only valid once the retention window has elapsed. */
  @Post('practices/:tenantId/purge')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Permanently erase a closed practice and all its records' })
  purgePractice(@Param('tenantId') tenantId: string, @Body() dto: { confirmSlug: string }) {
    return this.closureService.purgeClosedPractice(BigInt(tenantId), dto?.confirmSlug);
  }
}
