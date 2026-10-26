import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Permissions } from '../../common/permissions';
import { authenticatedTenantId } from '../../common/authenticated-tenant';
import { EntitlementsService } from './entitlements.service';

@ApiTags('Entitlements')
@Controller('v1/tenant')
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Permissions('practice.staff')
  @Get('entitlements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "The practice's plan and what it includes, so the app can gate features before the API refuses" })
  get(@Req() req: any) {
    return this.entitlements.summary(authenticatedTenantId(req));
  }
}
