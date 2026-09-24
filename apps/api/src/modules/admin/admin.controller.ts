import { Controller, Get, Post, Patch, Body, Param, Query, Req, Res, UseGuards, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { randomBytes } from 'crypto';
import { AdminService } from './admin.service';
import { InviteService } from '../invites/invite.service';
import { InstrumentService } from '../assessments/instrument.service';
import { RequestService } from '../requests/request.service';
import { AuthService } from '../auth/auth.service';
import { PlatformAdminGuard } from './platform-admin.guard';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE_MAX_AGE,
  cookieOptions,
  csrfCookieOptions,
} from '../../common/auth.config';

@ApiTags('Admin')
@Controller('v1/admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
    private readonly invites: InviteService,
    private readonly instruments: InstrumentService,
    private readonly requests: RequestService,
  ) {}

  @Post('auth/login')
  @ApiOperation({ summary: 'Platform admin login (tenant-free)' })
  async login(
    @Req() req: Request,
    @Body() dto: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginPlatformAdmin(dto, {
      userAgent: req.headers?.['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    });
    this.setSessionCookies(res, result.accessToken, result.refreshToken);
    return { profile: result.profile };
  }

  @Get('stats')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Platform-wide aggregate statistics' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('tenants')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'List all practice tenants' })
  getTenants() {
    return this.adminService.listTenants();
  }

  @Get('tenants/:id')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Get a single tenant with staffing, clients, and bookings' })
  getTenant(@Param('id') id: string) {
    return this.adminService.getTenantDetail(BigInt(id));
  }

  @Patch('tenants/:id')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Update tenant activation status or subscription tier' })
  updateTenant(
    @Param('id') id: string,
    @Body() dto: { isActive?: boolean; subscriptionTier?: 'STARTER' | 'PRO' | 'CLINIC' },
  ) {
    return this.adminService.updateTenant(BigInt(id), dto);
  }

  @Get('invites')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Invite codes, with the practices that used each' })
  listInvites() {
    return this.invites.list();
  }

  @Post('invites')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Create an invite code that grants a plan for a set number of days' })
  createInvite(@Body() dto: any) {
    return this.invites.create(dto ?? {});
  }

  @Patch('invites/:id')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Switch an invite code off or back on' })
  updateInvite(@Param('id') id: string, @Body() dto: { isActive?: boolean }) {
    if (!/^\d+$/.test(id)) throw new NotFoundException('Invite code not found');
    return this.invites.setActive(BigInt(id), dto?.isActive !== false);
  }

  @Get('requests')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Requests from practices: assessments, features, services, feedback' })
  listRequests(@Query('type') type?: string, @Query('status') status?: string) {
    return this.requests.all({ type, status });
  }

  @Patch('requests/:id')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Set a request status and a note the practice sees' })
  updateRequest(@Param('id') id: string, @Body() dto: { status?: string; adminNote?: string }) {
    if (!/^\d+$/.test(id)) throw new NotFoundException('Request not found');
    return this.requests.update(BigInt(id), dto ?? {});
  }

  @Get('assessment-instruments')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Every assessment instrument, including drafts and retired ones' })
  listInstruments() {
    return this.instruments.all();
  }

  @Post('assessment-instruments')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Add an instrument as a draft' })
  createInstrument(@Body() dto: { definition?: unknown }) {
    return this.instruments.create(dto?.definition);
  }

  @Patch('assessment-instruments/:key')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: "Replace an instrument's definition (new version) or change its status" })
  async updateInstrument(@Param('key') key: string, @Body() dto: { definition?: unknown; status?: string }) {
    let result = dto?.definition !== undefined ? await this.instruments.update(key, dto.definition) : null;
    if (dto?.status) result = await this.instruments.setStatus(key, dto.status);
    if (!result) throw new NotFoundException('Nothing to change');
    return result;
  }

  private setSessionCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_COOKIE_MAX_AGE));
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...cookieOptions(REFRESH_COOKIE_MAX_AGE),
      path: '/v1/auth/refresh',
    });
    res.cookie(CSRF_COOKIE, randomBytes(32).toString('hex'), csrfCookieOptions());
  }
}
