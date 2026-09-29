import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssessmentService } from './assessment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Permissions } from '../../common/permissions';
import { authenticatedProfileId, authenticatedTenantId } from '../../common/authenticated-tenant';

const id = (raw: string) => {
  if (!/^\d+$/.test(raw)) throw new BadRequestException('Invalid id');
  return BigInt(raw);
};

/**
 * Standard, scored instruments (PHQ-9, GAD-7, ...). Unlike forms they are not
 * editable: a practice switches them on, sends them to clients and reads the
 * scored results. Platform admins maintain the instruments on AdminController.
 */
@ApiTags('Assessments')
@Controller('v1/assessments')
export class AssessmentController {
  constructor(private readonly assessments: AssessmentService) {}

  @Permissions('practice.staff')
  @Get('library')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Every standard assessment, with whether this practice has it switched on' })
  library(@Req() req: any) {
    return this.assessments.library(authenticatedTenantId(req));
  }

  @Permissions('practice.admin')
  @Post(':key/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  enable(@Req() req: any, @Param('key') key: string) {
    return this.assessments.setEnabled(authenticatedTenantId(req), key, true);
  }

  @Permissions('practice.admin')
  @Post(':key/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  disable(@Req() req: any, @Param('key') key: string) {
    return this.assessments.setEnabled(authenticatedTenantId(req), key, false);
  }

  @Permissions('clinical.record')
  @Post('assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Send an assessment to a client by email' })
  send(@Req() req: any, @Body() dto: any) {
    return this.assessments.send(authenticatedTenantId(req), authenticatedProfileId(req), dto ?? {});
  }

  @Permissions('clinical.record')
  @Post('assignments/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  cancel(@Req() req: any, @Param('id') raw: string) {
    return this.assessments.cancel(authenticatedTenantId(req), id(raw));
  }

  @Permissions('clinical.record')
  @Get('clients/:clientId/results')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "A client's scored results over time" })
  results(@Req() req: any, @Param('clientId') raw: string) {
    return this.assessments.clientResults(authenticatedTenantId(req), id(raw));
  }

  @Permissions('clinical.record')
  @Get('assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Assessments sent across the practice, newest first' })
  assignments(@Req() req: any) {
    return this.assessments.practiceAssignments(authenticatedTenantId(req));
  }

  // ── The signed-in client ──

  @Permissions('any.authenticated')
  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "The signed-in client's assessments and what they may see of their results" })
  mine(@Req() req: any) {
    return this.assessments.mine(authenticatedTenantId(req), authenticatedProfileId(req));
  }

  @Permissions('any.authenticated')
  @Get('mine/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  openMine(@Req() req: any, @Param('id') raw: string) {
    return this.assessments.openMine(authenticatedTenantId(req), authenticatedProfileId(req), id(raw));
  }

  @Permissions('any.authenticated')
  @Post('mine/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  submitMine(@Req() req: any, @Param('id') raw: string, @Body() dto: any) {
    return this.assessments.submitMine(authenticatedTenantId(req), authenticatedProfileId(req), id(raw), dto?.answers);
  }

  // ── Public: the client opens the link from their email ──

  @Get('public/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'The questionnaire behind an assessment link' })
  open(@Param('token') token: string) {
    return this.assessments.open(token);
  }

  @Post('public/:token')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Submit a client's answers" })
  submit(@Param('token') token: string, @Body() dto: any) {
    return this.assessments.submit(token, dto?.answers);
  }
}
