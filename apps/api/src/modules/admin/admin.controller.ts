import { Controller, Get, Post, Patch, Body, Param, Req, Res, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { randomBytes } from 'crypto';
import { AdminService } from './admin.service';
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

  private setSessionCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_COOKIE_MAX_AGE));
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...cookieOptions(REFRESH_COOKIE_MAX_AGE),
      path: '/v1/auth/refresh',
    });
    res.cookie(CSRF_COOKIE, randomBytes(32).toString('hex'), csrfCookieOptions());
  }
}
