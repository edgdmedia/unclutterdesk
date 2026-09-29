import { Controller, Get, Post, Patch, Delete, Body, Param, Req, Res, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { TenantService, publicTenantFields } from './tenant.service';
import { TenantRequest } from '../../common/middleware/tenant.middleware';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Permissions } from '../../common/permissions';
import { authenticatedTenantId } from '../../common/authenticated-tenant';

@ApiTags('Tenant')
@Controller('v1/tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new practice tenant (SaaS Onboarding)' })
  createTenant(@Body() dto: {
    name: string;
    slug: string;
    customDomain?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    currency?: string;
  }) {
    return this.tenantService.createTenant(dto);
  }

  @Get('public/info/:slugOrDomain')
  @ApiOperation({ summary: 'Get public brand config & logo for client portal styling' })
  getPublicInfo(@Param('slugOrDomain') slugOrDomain: string) {
    return this.tenantService.getPublicTenantInfo(slugOrDomain);
  }

  @Get('public/exists/:slugOrDomain')
  @SkipThrottle()
  @ApiOperation({ summary: 'Whether a practice exists and is active (edge router probe)' })
  async getPublicExistence(
    @Param('slugOrDomain') slugOrDomain: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.tenantService.getPublicTenantExistence(slugOrDomain);
    // A practice that exists is stable; one that does not may be created at any
    // moment, so a shorter negative TTL keeps a new signup from 404ing for long.
    res.setHeader('Cache-Control', result.exists ? 'public, max-age=300' : 'public, max-age=30');
    return result;
  }

  @Get('public/invite/:claimToken')
  @ApiOperation({ summary: 'Details of a pending staff invitation, for the claim page' })
  getInvite(@Param('claimToken') claimToken: string) {
    // Public by necessity: the invitee has no account until they claim it. The
    // token is the credential, so it is 32 random bytes.
    return this.tenantService.getInviteByToken(claimToken);
  }

  @Permissions('any.authenticated')
  @Get('check-slug/:slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Check if a practice subdomain handle is available' })
  checkSlug(@Req() req: any, @Param('slug') slug: string) {
    let tenantId: bigint | undefined;
    try {
      tenantId = authenticatedTenantId(req);
    } catch {
      // Unauthenticated fallback
    }
    return this.tenantService.checkSlugAvailability(slug, tenantId);
  }

  @Get('public/info')
  @ApiOperation({ summary: 'Get public brand config from resolved request host' })
  getPublicInfoFromHost(@Req() req: TenantRequest) {
    // req.tenant is the whole Tenant row; returning it as-is published billing
    // codes and internal settings to anyone who asked.
    if (req.tenant) return publicTenantFields(req.tenant);
    return { name: 'Unclutter Desk', slug: 'default', primaryColor: '#0F3A53', secondaryColor: '#E3B341' };
  }

  @Permissions('practice.admin')
  @Patch('brand')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update practice brand configuration (Admin)' })
  updateBrand(@Req() req: any, @Body() dto: any) {
    return this.tenantService.updateTenantBrand(authenticatedTenantId(req), dto);
  }

  @Permissions('practice.staff')
  @Get('brand')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current practice profile + brand configuration' })
  getBrand(@Req() req: any) {
    return this.tenantService.getTenantBrand(authenticatedTenantId(req));
  }

  @Permissions('practice.admin')
  @Post('brand/custom-domain/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify the currently configured custom domain for this practice' })
  verifyCustomDomain(@Req() req: any) {
    return this.tenantService.verifyCustomDomain(authenticatedTenantId(req));
  }

  @Permissions('practice.staff')
  @Get('notifications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get tenant inbox notifications derived from live activity' })
  getNotifications(@Req() req: any) {
    return this.tenantService.getNotifications(authenticatedTenantId(req));
  }

  // ── Group Clinic Staff Management Endpoints ───────────────────────────────

  @Permissions('practice.staff')
  @Get('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List practice team members & receptionists' })
  getStaff(@Req() req: any) {
    return this.tenantService.getClinicStaff(authenticatedTenantId(req));
  }

  @Permissions('practice.admin')
  @Post('staff/invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Invite a new therapist, receptionist, or admin staff member' })
  inviteStaff(@Req() req: any, @Body() dto: { email: string; role: 'ADMIN' | 'RECEPTIONIST' | 'THERAPIST' }) {
    return this.tenantService.inviteStaffMember(authenticatedTenantId(req), dto);
  }

  @Permissions('practice.admin')
  @Patch('staff/:profileId/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update staff member role & permissions' })
  updateRole(
    @Req() req: any,
    @Param('profileId') profileId: string,
    @Body() dto: { role: 'OWNER' | 'ADMIN' | 'RECEPTIONIST' | 'THERAPIST' },
  ) {
    return this.tenantService.updateStaffRole(
      authenticatedTenantId(req),
      BigInt(req.user.profileId),
      BigInt(profileId),
      dto.role,
    );
  }

  @Permissions('staff.manage')
  @Patch('staff/:profileId/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Set a staff member’s extra permissions' })
  updateStaffPermissions(
    @Req() req: any,
    @Param('profileId') profileId: string,
    @Body() dto: { permissions?: unknown },
  ) {
    if (!/^\d+$/.test(profileId)) throw new NotFoundException('Staff member not found');
    return this.tenantService.updateStaffPermissions(
      authenticatedTenantId(req),
      BigInt(req.user.profileId),
      BigInt(profileId),
      dto?.permissions,
    );
  }

  @Permissions('practice.admin')
  @Delete('staff/invite/:inviteId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Withdraw a staff invitation that has not been claimed' })
  revokeInvite(@Req() req: any, @Param('inviteId') inviteId: string) {
    return this.tenantService.revokeStaffInvite(
      authenticatedTenantId(req),
      BigInt(req.user.profileId),
      inviteId,
    );
  }

  // ── Client (Patient) Endpoints ────────────────────────────────────────────

  @Permissions('practice.staff')
  @Get('clients')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all client (patient) profiles for the practice' })
  getClients(@Req() req: any) {
    return this.tenantService.getClients(authenticatedTenantId(req));
  }

  @Permissions('clinical.record')
  @Get('clients/:profileId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a single client with bookings, notes, and intake' })
  getClientById(@Req() req: any, @Param('profileId') profileId: string) {
    return this.tenantService.getClientById(authenticatedTenantId(req), BigInt(profileId));
  }

  @Permissions('practice.staff')
  @Post('clients')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new client (patient) profile' })
  createClient(
    @Req() req: any,
    @Body() dto: {
      firstName: string;
      lastName?: string;
      email: string;
      phone?: string;
      care?: string;
      emergency?: string;
    },
  ) {
    return this.tenantService.createClient(authenticatedTenantId(req), dto);
  }

  @Permissions('practice.staff')
  @Patch('clients/:profileId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Edit a client’s name, phone and emergency contact' })
  updateClient(
    @Req() req: any,
    @Param('profileId') profileId: string,
    @Body() dto: { firstName?: string; lastName?: string | null; phone?: string | null; emergencyContact?: { name?: string; relationship?: string; phone?: string } },
  ) {
    if (!/^\d+$/.test(profileId)) throw new NotFoundException('Client not found');
    return this.tenantService.updateClient(authenticatedTenantId(req), BigInt(profileId), dto);
  }
}
