import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InviteService } from './invite.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { PRACTICE_ADMIN, Roles } from '../../common/roles';
import { authenticatedTenantId } from '../../common/authenticated-tenant';

/** The practice-facing side. The admin side lives on AdminController. */
@ApiTags('Invites')
@Controller('v1/invites')
export class InviteController {
  constructor(private readonly invites: InviteService) {}

  @Get('check/:code')
  @ApiOperation({ summary: 'What an invite code gives, shown on the signup page' })
  check(@Param('code') code: string) {
    return this.invites.preview(code);
  }

  @Roles(...PRACTICE_ADMIN)
  @Post('redeem')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Redeem an invite code for the signed-in practice' })
  redeem(@Req() req: any, @Body() dto: { code?: string }) {
    return this.invites.redeem(authenticatedTenantId(req), dto?.code ?? '');
  }
}
