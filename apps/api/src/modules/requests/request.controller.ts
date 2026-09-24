import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequestService } from './request.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles, STAFF } from '../../common/roles';
import { authenticatedProfileId, authenticatedTenantId } from '../../common/authenticated-tenant';

/** The practice side. Platform admins triage these on AdminController. */
@ApiTags('Requests')
@Controller('v1/requests')
export class RequestController {
  constructor(private readonly requests: RequestService) {}

  @Roles(...STAFF)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "This practice's requests to the platform" })
  list(@Req() req: any) {
    return this.requests.forPractice(authenticatedTenantId(req));
  }

  @Roles(...STAFF)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Ask the platform for an assessment, a feature or a service, or send feedback' })
  create(@Req() req: any, @Body() dto: any) {
    return this.requests.create(authenticatedTenantId(req), authenticatedProfileId(req), dto ?? {});
  }
}
