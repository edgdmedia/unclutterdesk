import { Controller, Get, Post, Patch, Body, Param, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { TenantService } from './tenant.service';
import { TenantRequest } from '../../common/middleware/tenant.middleware';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { AnyAuthenticated, CLINICAL, PRACTICE_ADMIN, Roles, STAFF } from '../../common/roles';
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

  @AnyAuthenticated()
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
    if (req.tenant) {
      return {
        ...req.tenant,
        id: req.tenant.id.toString(),
      };
    }
    return { name: 'Unclutter Desk', slug: 'default', primaryColor: '#0F3A53', secondaryColor: '#E3B341' };
  }

  @Roles(...PRACTICE_ADMIN)
  @Patch('brand')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update practice brand configuration (Admin)' })
  updateBrand(@Req() req: any, @Body() dto: any) {
    return this.tenantService.updateTenantBrand(authenticatedTenantId(req), dto);
  }

  @Roles(...STAFF)
  @Get('brand')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current practice profile + brand configuration' })
  getBrand(@Req() req: any) {
    return this.tenantService.getTenantBrand(authenticatedTenantId(req));
  }

  @Roles(...PRACTICE_ADMIN)
  @Post('brand/custom-domain/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify the currently configured custom domain for this practice' })
  verifyCustomDomain(@Req() req: any) {
    return this.tenantService.verifyCustomDomain(authenticatedTenantId(req));
  }

  @Roles(...STAFF)
  @Get('notifications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get tenant inbox notifications derived from live activity' })
  getNotifications(@Req() req: any) {
    return this.tenantService.getNotifications(authenticatedTenantId(req));
  }

  // ── Group Clinic Staff Management Endpoints ───────────────────────────────

  @Roles(...STAFF)
  @Get('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List practice team members & receptionists' })
  getStaff(@Req() req: any) {
    return this.tenantService.getClinicStaff(authenticatedTenantId(req));
  }

  @Roles(...PRACTICE_ADMIN)
  @Post('staff/invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Invite a new therapist, receptionist, or admin staff member' })
  inviteStaff(@Req() req: any, @Body() dto: { email: string; role: 'ADMIN' | 'RECEPTIONIST' | 'THERAPIST' }) {
    return this.tenantService.inviteStaffMember(authenticatedTenantId(req), dto);
  }

  @Roles(...PRACTICE_ADMIN)
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

  // ── Client (Patient) Endpoints ────────────────────────────────────────────

  @Roles(...STAFF)
  @Get('clients')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all client (patient) profiles for the practice' })
  getClients(@Req() req: any) {
    return this.tenantService.getClients(authenticatedTenantId(req));
  }

  @Roles(...CLINICAL)
  @Get('clients/:profileId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a single client with bookings, notes, and intake' })
  getClientById(@Req() req: any, @Param('profileId') profileId: string) {
    return this.tenantService.getClientById(authenticatedTenantId(req), BigInt(profileId));
  }

  @Roles(...STAFF)
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
}
