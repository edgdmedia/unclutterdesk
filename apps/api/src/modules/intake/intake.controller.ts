import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntakeService } from './intake.service';
import { FormTemplateService } from './form-template.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Permissions } from '../../common/permissions';
import { TenantRequest } from '../../common/middleware/tenant.middleware';
import { authenticatedProfileId, authenticatedTenantId } from '../../common/authenticated-tenant';

@ApiTags('Intake')
@Controller('v1/intake')
export class IntakeController {
  constructor(
    private readonly intakeService: IntakeService,
    private readonly templates: FormTemplateService,
  ) {}

  /** A route id that isn't a number names nothing: 404, not a crash. */
  private static id(raw: string, what: string): bigint {
    if (!/^\d+$/.test(raw ?? '')) throw new NotFoundException(`${what} not found`);
    return BigInt(raw);
  }

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

  // ── FRM-01: form templates ──

  @Permissions('clinical.record')
  @Post('forms/:formId/template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Save a form as a template, optionally shared for review' })
  saveTemplate(@Req() req: any, @Param('formId') formId: string, @Body() dto: { share?: boolean; anonymous?: boolean }) {
    return this.templates.saveFromForm(authenticatedTenantId(req), authenticatedProfileId(req), IntakeController.id(formId, 'Form'), {
      share: dto?.share === true,
      anonymous: dto?.anonymous === true,
    });
  }

  @Permissions('practice.staff')
  @Get('templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "This practice's templates and approved shared ones" })
  templateLibrary(@Req() req: any) {
    return this.templates.library(authenticatedTenantId(req));
  }

  @Permissions('practice.staff')
  @Get('templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Preview a template's questions" })
  templatePreview(@Req() req: any, @Param('id') id: string) {
    return this.templates.preview(authenticatedTenantId(req), IntakeController.id(id, 'Template'));
  }

  @Permissions('clinical.record')
  @Post('templates/:id/use')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Copy a template into this practice's forms" })
  useTemplate(@Req() req: any, @Param('id') id: string) {
    return this.templates.use(authenticatedTenantId(req), IntakeController.id(id, 'Template'));
  }

  @Permissions('clinical.record')
  @Delete('templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Delete one of this practice's templates" })
  removeTemplate(@Req() req: any, @Param('id') id: string) {
    return this.templates.remove(authenticatedTenantId(req), IntakeController.id(id, 'Template'));
  }

  @Permissions('any.authenticated')
  @Post('mine/submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'The signed-in client submits a form, filed under their own profile' })
  submitMine(@Req() req: any, @Body() dto: { formId: string; bookingId?: string; answersJson: Record<string, any> }) {
    return this.intakeService.submitAsClient(authenticatedTenantId(req), authenticatedProfileId(req), {
      formId: String(dto?.formId ?? ''),
      bookingId: dto?.bookingId ? String(dto.bookingId) : undefined,
      answersJson: dto?.answersJson ?? {},
    });
  }

  @Permissions('any.authenticated')
  @Get('mine/forms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "The signed-in client's forms still to do" })
  getMyForms(@Req() req: any) {
    return this.intakeService.pendingForms(authenticatedTenantId(req), authenticatedProfileId(req));
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
