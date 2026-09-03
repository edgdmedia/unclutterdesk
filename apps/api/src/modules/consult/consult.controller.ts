import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConsultService } from './consult.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { CLINICAL, PRACTICE_ADMIN, Roles, STAFF } from '../../common/roles';
import { TenantRequest } from '../../common/middleware/tenant.middleware';
import { authenticatedProfileId, authenticatedTenantId } from '../../common/authenticated-tenant';

@ApiTags('Consult')
@Controller('v1/consult')
export class ConsultController {
  constructor(private readonly consultService: ConsultService) {}

  @Get('public/therapists')
  @ApiOperation({ summary: 'Get active bookable therapists for client portal' })
  getPublicTherapists(@Req() req: TenantRequest) {
    if (!req.tenantId) throw new Error('Practice tenant context required');
    return this.consultService.getPublicTherapists(req.tenantId);
  }

  @Roles(...CLINICAL)
  @Get('therapist/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get practitioner profile' })
  getProfile(@Req() req: any) {
    return this.consultService.getTherapistProfile(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
    );
  }

  @Roles(...STAFF)
  @Get('dashboard/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get real-time practice dashboard metrics and upcoming sessions' })
  getDashboardSummary(@Req() req: any) {
    return this.consultService.getDashboardSummary(authenticatedTenantId(req));
  }

  @Roles(...CLINICAL)
  @Post('therapist/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update practitioner profile text data' })
  updateProfile(@Req() req: any, @Body() dto: any) {
    return this.consultService.updateTherapistProfile(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
      dto,
    );
  }

  @Roles(...CLINICAL)
  @Post('therapist/profile/avatar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Dedicated profile photo upload endpoint (Max 2MB)' })
  uploadAvatar(@Req() req: any, @Body() dto: { avatarUrl: string }) {
    return this.consultService.uploadTherapistAvatar(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
      dto.avatarUrl,
    );
  }

  @Roles(...PRACTICE_ADMIN)
  @Patch('admin/therapists/:profileId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Admin toggle practitioner active vs inactive status' })
  adminUpdateStatus(
    @Req() req: any,
    @Param('profileId') profileId: string,
    @Body() dto: { status: 'active' | 'inactive' },
  ) {
    return this.consultService.adminUpdateTherapistStatus(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
      BigInt(profileId),
      dto.status,
    );
  }

  // ── Services & Scheduling Endpoints ─────────────────────────────────────

  @Get('public/services')
  @ApiOperation({ summary: 'Get active services for client booking portal' })
  getPublicServices(@Req() req: TenantRequest) {
    if (!req.tenantId) throw new Error('Practice tenant context required');
    return this.consultService.getPublicServices(req.tenantId);
  }

  @Roles(...PRACTICE_ADMIN)
  @Post('services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create new therapy session service' })
  createService(@Req() req: any, @Body() dto: any) {
    return this.consultService.createService(
      authenticatedTenantId(req),
      dto,
    );
  }

  @Get('public/availability')
  @ApiOperation({ summary: 'Get open availability slots for client booking portal' })
  getPublicAvailability(@Req() req: TenantRequest) {
    if (!req.tenantId) throw new Error('Practice tenant context required');
    return this.consultService.getPublicAvailability(req.tenantId);
  }

  @Roles(...CLINICAL)
  @Post('therapist/availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Add availability slot or block-out dates' })
  createAvailability(@Req() req: any, @Body() dto: any) {
    return this.consultService.createAvailabilitySlot(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
      dto,
    );
  }

  @Roles(...CLINICAL)
  @Get('therapist/availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get therapist future availability slots' })
  getTherapistAvailability(@Req() req: any) {
    return this.consultService.getTherapistAvailability(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
    );
  }

  @Roles(...CLINICAL)
  @Patch('therapist/availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Replace therapist recurring availability windows' })
  replaceTherapistAvailability(@Req() req: any, @Body() dto: any) {
    return this.consultService.replaceTherapistAvailability(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
      dto,
    );
  }

  @Post('public/bookings')
  @ApiOperation({ summary: 'Client reserve slot & generate WebRTC video session link' })
  createBooking(@Req() req: TenantRequest, @Body() dto: any) {
    if (!req.tenantId) throw new Error('Practice tenant context required');
    return this.consultService.createBooking(req.tenantId, dto);
  }

  @Post('public/bookings/:bookingId/pay')
  @ApiOperation({ summary: 'Get payment URL for an existing pending booking' })
  getBookingPaymentUrl(@Req() req: TenantRequest, @Param('bookingId') bookingId: string, @Body() dto: { email: string }) {
    if (!req.tenantId) throw new Error('Practice tenant context required');
    return this.consultService.getBookingPaymentUrl(req.tenantId, BigInt(bookingId), dto.email);
  }

  @Get('public/client-portal')
  @ApiOperation({ summary: 'Lookup client portal session history by booking email' })
  getPublicClientPortal(@Req() req: TenantRequest, @Query('email') email: string) {
    if (!req.tenantId) throw new Error('Practice tenant context required');
    return this.consultService.getPublicClientPortal(req.tenantId, email);
  }

  @Roles(...STAFF)
  @Get('therapist/bookings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get therapist upcoming client session bookings' })
  getTherapistBookings(@Req() req: any) {
    return this.consultService.getTherapistBookings(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
    );
  }

  @Roles(...STAFF)
  @Patch('therapist/bookings/:bookingId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update therapist booking status' })
  updateTherapistBookingStatus(@Req() req: any, @Param('bookingId') bookingId: string, @Body() dto: { status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' }) {
    return this.consultService.updateBookingStatus(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
      BigInt(bookingId),
      dto.status,
    );
  }

  @Roles(...CLINICAL)
  @Get('therapist/bookings/:bookingId/prep')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get session prep context for a booking' })
  getBookingPrep(@Req() req: any, @Param('bookingId') bookingId: string) {
    return this.consultService.getBookingPrep(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
      BigInt(bookingId),
    );
  }
}
