import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { CLINICAL, Roles } from '../../common/roles';
import { authenticatedProfileId, authenticatedTenantId } from '../../common/authenticated-tenant';
import { hoursCsv, isoDate } from './hours-format';
import { hoursPdf } from './hours-pdf';
import { HoursEntryInput, HoursService, HoursTargetInput } from './hours.service';

function parseId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Unknown entry');
  }
}

/** The signed-in practitioner's own hours log. */
@ApiTags('Hours log')
@Controller('v1/hours')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class HoursController {
  constructor(private readonly hours: HoursService) {}

  @Roles(...CLINICAL)
  @Get()
  @ApiOperation({ summary: 'My hours: entries, totals and target' })
  list(@Req() req: any) {
    return this.hours.list(authenticatedTenantId(req), authenticatedProfileId(req));
  }

  @Roles(...CLINICAL)
  @Post()
  @ApiOperation({ summary: 'Log hours by hand' })
  create(@Req() req: any, @Body() dto: HoursEntryInput) {
    return this.hours.create(authenticatedTenantId(req), authenticatedProfileId(req), dto ?? {});
  }

  @Roles(...CLINICAL)
  @Patch(':id')
  @ApiOperation({ summary: 'Change an entry' })
  update(@Req() req: any, @Param('id') id: string, @Body() dto: HoursEntryInput) {
    return this.hours.update(authenticatedTenantId(req), authenticatedProfileId(req), parseId(id), dto ?? {});
  }

  @Roles(...CLINICAL)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a manual entry' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.hours.remove(authenticatedTenantId(req), authenticatedProfileId(req), parseId(id));
  }

  @Roles(...CLINICAL)
  @Put('target')
  @ApiOperation({ summary: 'Set the hours I am working towards' })
  setTarget(@Req() req: any, @Body() dto: HoursTargetInput) {
    return this.hours.setTarget(authenticatedTenantId(req), authenticatedProfileId(req), dto ?? {});
  }

  @Roles(...CLINICAL)
  @Get('export.csv')
  @ApiOperation({ summary: 'Download my hours as CSV (client initials unless names=full)' })
  async csv(@Req() req: any, @Query('names') names: string, @Res() res: Response) {
    const rows = await this.hours.exportRows(authenticatedTenantId(req), authenticatedProfileId(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="hours-log-${isoDate(new Date())}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(hoursCsv(rows, { fullNames: names === 'full' }));
  }

  @Roles(...CLINICAL)
  @Get('export.pdf')
  @ApiOperation({ summary: 'Download my hours as a signable PDF (client initials unless names=full)' })
  async pdf(@Req() req: any, @Query('names') names: string, @Res() res: Response) {
    const tenantId = authenticatedTenantId(req);
    const profileId = authenticatedProfileId(req);
    const [rows, header] = await Promise.all([this.hours.exportRows(tenantId, profileId), this.hours.header(tenantId, profileId)]);
    const pdf = await hoursPdf(
      rows,
      {
        practiceName: header.practiceName,
        practitionerName: header.practitionerName,
        targetLabel: header.target?.label,
        totalTargetHours: header.target?.totalTargetHours,
        supervisionTargetHours: header.target?.supervisionTargetHours,
      },
      { fullNames: names === 'full' },
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="hours-log-${isoDate(new Date())}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdf);
  }
}
