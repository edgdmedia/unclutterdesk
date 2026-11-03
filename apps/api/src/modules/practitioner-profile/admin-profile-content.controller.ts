import { Body, Controller, Get, Param, Patch, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformAdminGuard } from '../admin/platform-admin.guard';
import { AdminProfileContentService } from './admin-profile-content.service';

function authenticatedUserId(req: any): bigint {
  const userId = req?.user?.userId;
  if (!userId) throw new UnauthorizedException('Authentication required');
  return BigInt(userId);
}

/**
 * Platform-admin content screens for the practitioner profile (spec §6.6):
 * the selectable templates and the shared per-section guidance. Separate from
 * PractitionerProfileController, which is for a practitioner editing their own
 * profile, and guarded by PlatformAdminGuard rather than a practice role.
 */
@ApiTags('Admin')
@Controller('v1/admin/practitioner-profile')
@UseGuards(PlatformAdminGuard)
@ApiBearerAuth('access-token')
export class AdminProfileContentController {
  constructor(private readonly content: AdminProfileContentService) {}

  @Get('templates')
  @ApiOperation({ summary: 'List profile templates, including inactive ones' })
  templates() {
    return this.content.listTemplates();
  }

  @Patch('templates/:key')
  @ApiOperation({ summary: 'Edit a profile template, its prompts and its examples' })
  updateTemplate(@Req() req: any, @Param('key') key: string, @Body() dto: Record<string, unknown>) {
    return this.content.updateTemplate(authenticatedUserId(req), key, dto);
  }

  @Get('guidance')
  @ApiOperation({ summary: 'The shared per-section profile guidance' })
  guidance() {
    return this.content.getGuidance();
  }

  @Patch('guidance')
  @ApiOperation({ summary: 'Edit the shared per-section profile guidance' })
  updateGuidance(@Req() req: any, @Body() dto: Record<string, unknown>) {
    return this.content.updateGuidance(authenticatedUserId(req), dto);
  }
}