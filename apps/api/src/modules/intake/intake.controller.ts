import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntakeService } from './intake.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Permissions } from '../../common/permissions';
import { TenantRequest } from '../../common/middleware/tenant.middleware';
import { authenticatedTenantId } from '../../common/authenticated-tenant';

@ApiTags('Intake')
@Controller('v1/intake')
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Get('public/forms')
  @ApiOperation({ summary: 'Get intake questionnaires for client portal' })
  getPublicForms(@Req() req: TenantRequest, @Query('targetType') targetType?: string) {
    if (!req.tenantId) throw new NotFoundException(
        'This practice could not be found. Check the web address, or ask the practice for their booking link.',
      );
    return this.intakeService.getPublicForms(req.tenantId, targetType);
  }

  @Get('public/reviews')
  @ApiOperation({ summary: 'Get published public practice reviews' })
  getPublicReviews(@Req() req: TenantRequest) {
    if (!req.tenantId) throw new NotFoundException(
        'This practice could not be found. Check the web address, or ask the practice for their booking link.',
      );
    return this.intakeService.getPublishedReviews(req.tenantId);
  }

  @Permissions('practice.staff')
  @Get('forms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List forms for the current tenant' })
  getForms(@Req() req: any) {
    return this.intakeService.getForms(authenticatedTenantId(req));
  }

  @Permissions('practice.staff')
  @Get('forms/:formId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a single form for editing' })
  getFormById(@Req() req: any, @Param('formId') formId: string) {
    return this.intakeService.getFormById(authenticatedTenantId(req), BigInt(formId));
  }

  @Permissions('clinical.record')
  @Post('forms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create custom clinical questionnaire (Admin/Therapist)' })
  createForm(@Req() req: any, @Body() dto: any) {
    return this.intakeService.createCustomForm(authenticatedTenantId(req), dto);
  }

  @Permissions('clinical.record')
  @Patch('forms/:formId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update an existing form' })
  updateForm(@Req() req: any, @Param('formId') formId: string, @Body() dto: any) {
    return this.intakeService.updateForm(
      authenticatedTenantId(req),
      BigInt(formId),
      dto,
    );
  }

  @Post('public/submissions')
  @ApiOperation({ summary: 'Client submit intake questionnaire answers' })
  submitAnswers(@Req() req: TenantRequest, @Body() dto: any) {
    if (!req.tenantId) throw new NotFoundException(
        'This practice could not be found. Check the web address, or ask the practice for their booking link.',
      );
    return this.intakeService.submitIntakeAnswers(req.tenantId, dto);
  }

  @Permissions('clinical.record')
  @Get('submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all submissions for the current tenant' })
  getTenantSubmissions(@Req() req: any, @Query('targetType') targetType?: string) {
    return this.intakeService.getTenantSubmissions(
      authenticatedTenantId(req),
      targetType,
    );
  }

  @Permissions('clinical.record')
  @Patch('submissions/:submissionId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a submission status for queue + review publishing' })
  updateSubmissionStatus(@Req() req: any, @Param('submissionId') submissionId: string, @Body() dto: any) {
    return this.intakeService.updateSubmissionStatus(
      authenticatedTenantId(req),
      BigInt(submissionId),
      dto?.status || 'UNREAD',
    );
  }

  @Permissions('clinical.record')
  @Get('submissions/booking/:bookingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Therapist view client submitted intake responses' })
  getBookingSubmissions(@Req() req: any, @Param('bookingId') bookingId: string) {
    return this.intakeService.getBookingSubmissions(
      authenticatedTenantId(req),
      BigInt(bookingId),
    );
  }
}
