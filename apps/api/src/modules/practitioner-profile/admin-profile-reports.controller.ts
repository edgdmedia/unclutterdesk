import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformAdminGuard } from '../admin/platform-admin.guard';
import { ProfileReportsService } from './profile-reports.service';

/** Platform admins: the profile report queue and takedowns (spec §6.15, §12). */
@ApiTags('Admin: profile reports')
@ApiBearerAuth('access-token')
@Controller('v1/admin')
export class AdminProfileReportsController {
  constructor(private readonly reports: ProfileReportsService) {}

  @Get('profile-reports')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Profile reports, newest first (OPEN by default)' })
  list(@Query('status') status?: string, @Query('before') before?: string, @Query('take') take?: string) {
    return this.reports.list({ status, before, take });
  }

  @Post('profile-reports/:id/resolve')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Close a report: ACTIONED or DISMISSED, with an optional note' })
  resolve(@Req() req: any, @Param('id') id: string, @Body() dto: { decision?: unknown; note?: unknown }) {
    return this.reports.resolve(BigInt(req.user.userId), id, dto?.decision, dto?.note);
  }

  @Post('profiles/:id/moderate')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Unpublish, suspend or restore a profile, with a reason the therapist is emailed' })
  moderate(@Req() req: any, @Param('id') id: string, @Body() dto: { action?: unknown; reason?: unknown; reportId?: unknown }) {
    return this.reports.moderate(BigInt(req.user.userId), id, dto?.action, { reason: dto?.reason, reportId: dto?.reportId });
  }
}
