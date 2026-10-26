import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Permissions } from '../../common/permissions';
import { authenticatedTenantId } from '../../common/authenticated-tenant';
import { EntitlementsService } from './entitlements.service';

@ApiTags('Entitlements')
@Controller('v1')
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Permissions('practice.staff')
  @Get('tenant/entitlements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "The practice's plan and what it includes, so the app can gate features before the API refuses" })
  get(@Req() req: any) {
    return this.entitlements.summary(authenticatedTenantId(req));
  }

  // Practitioners only: everyone with a profile works at a practice, and
  // clients have nothing to gate.
  @Permissions('practice.staff')
  @Get('me/profile-entitlements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "What the signed-in person's profile can do, from their best qualifying practice plan" })
  profile(@Req() req: any) {
    const userId = req?.user?.userId;
    if (!userId) throw new UnauthorizedException('Authenticated user context is missing');
    return this.entitlements.forProfile(BigInt(userId));
  }
}
