import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntakeService } from './intake.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { CLINICAL, Roles, STAFF } from '../../common/roles';
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

  @Roles(...STAFF)
  @Get('forms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List forms for the current tenant' })
  getForms(@Req() req: any) {
    return this.intakeService.getForms(authenticatedTenantId(req));
  }

  @Roles(...STAFF)
  @Get('forms/:formId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a single form for editing' })
  getFormById(@Req() req: any, @Param('formId') formId: string) {
    return this.intakeService.getFormById(authenticatedTenantId(req), BigInt(formId));
  }

  @Roles(...CLINICAL)
  @Post('forms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create custom clinical questionnaire (Admin/Therapist)' })
  createForm(@Req() req: any, @Body() dto: any) {
    return this.intakeService.createCustomForm(authenticatedTenantId(req), dto);
  }

  @Roles(...CLINICAL)
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

  @Roles(...CLINICAL)
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

  @Roles(...CLINICAL)
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

  @Roles(...CLINICAL)
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
