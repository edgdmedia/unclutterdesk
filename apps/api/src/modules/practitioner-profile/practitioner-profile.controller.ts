import { Body, BadRequestException, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Permissions } from '../../common/permissions';
import { authenticatedProfileId } from '../../common/authenticated-tenant';
import {
  PractitionerProfileService,
  type ProfileAppearanceInput,
  type ProfileCreateInput,
  type ProfileUpdateInput,
  type TimelineInput,
  type TaxonomySelection,
} from './practitioner-profile.service';
import { profileQr } from './share/qr';

function authenticatedUserId(req: any): bigint {
  const userId = req?.user?.userId;
  if (!userId) throw new UnauthorizedException('Authentication required');
  return BigInt(userId);
}

/**
 * The signed-in practitioner's own public profile (spec §6.1, §6.2). Every
 * route acts on the caller's profile only; there is no profile id in any path.
 * Practitioners are the roles holding `clinical.record` (owner, admin,
 * therapist); receptionists and clients have no profile.
 */
@ApiTags('Practitioner profile')
@Controller('v1/practitioner-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class PractitionerProfileController {
  constructor(private readonly profiles: PractitionerProfileService) {}

  @Permissions('clinical.record')
  @Get('me')
  @ApiOperation({ summary: 'My profile, drafts included (null before I have one)' })
  async getOwn(@Req() req: any) {
    return (await this.profiles.getOwn(authenticatedUserId(req))) ?? null;
  }

  @Permissions('clinical.record')
  @Post()
  @ApiOperation({ summary: 'Start my profile as a draft, filled from my practice details' })
  create(@Req() req: any, @Body() dto: ProfileCreateInput) {
    return this.profiles.createOwn(authenticatedUserId(req), authenticatedProfileId(req), dto ?? {});
  }

  @Permissions('clinical.record')
  @Patch('me')
  @ApiOperation({ summary: 'Change my profile details' })
  update(@Req() req: any, @Body() dto: ProfileUpdateInput & ProfileAppearanceInput) {
    return this.profiles.updateOwn(authenticatedUserId(req), dto ?? {});
  }

  @Permissions('clinical.record')
  @Put('me/handle')
  @ApiOperation({ summary: 'Change my handle; the old one keeps redirecting' })
  changeHandle(@Req() req: any, @Body() dto: { handle?: string }) {
    return this.profiles.changeOwnHandle(authenticatedUserId(req), String(dto?.handle ?? ''));
  }

  @Permissions('clinical.record')
  @Put('me/taxonomy')
  @ApiOperation({ summary: 'Set my specialties, modalities, populations and languages' })
  setTaxonomy(@Req() req: any, @Body() dto: { terms?: TaxonomySelection[] }) {
    return this.profiles.setOwnTaxonomy(authenticatedUserId(req), dto?.terms as TaxonomySelection[]);
  }

  @Permissions('clinical.record')
  @Put('me/timeline')
  @ApiOperation({ summary: 'Set my training & journey timeline' })
  setTimeline(@Req() req: any, @Body() dto: { entries?: TimelineInput[] }) {
    return this.profiles.setOwnTimeline(authenticatedUserId(req), dto?.entries as TimelineInput[]);
  }

  @Permissions('clinical.record')
  @Put('me/photo')
  @ApiOperation({ summary: 'Set my photo (a JPEG, PNG or WebP data URL, up to 2 MB)' })
  setPhoto(@Req() req: any, @Body() dto: { image?: string }) {
    return this.profiles.setOwnPhoto(authenticatedUserId(req), dto?.image);
  }

  @Permissions('clinical.record')
  @Delete('me/photo')
  @ApiOperation({ summary: 'Remove my photo' })
  removePhoto(@Req() req: any) {
    return this.profiles.removeOwnPhoto(authenticatedUserId(req));
  }

  @Permissions('clinical.record')
  @Get('me/checklist')
  @ApiOperation({ summary: 'My completeness score, next step, publish blockers and writing tips' })
  checklist(@Req() req: any) {
    return this.profiles.ownChecklist(authenticatedUserId(req));
  }

  @Permissions('clinical.record')
  @Post('me/publish')
  @ApiOperation({ summary: 'Publish my profile' })
  publish(@Req() req: any) {
    return this.profiles.publishOwn(authenticatedUserId(req));
  }

  @Permissions('clinical.record')
  @Post('me/unpublish')
  @ApiOperation({ summary: 'Take my profile off the web' })
  unpublish(@Req() req: any) {
    return this.profiles.unpublishOwn(authenticatedUserId(req));
  }

  @Permissions('clinical.record')
  @Get('me/share/qr')
  @ApiOperation({ summary: 'A QR code for my public profile (svg or png), for sharing' })
  async shareQr(@Req() req: any, @Query('format') format: string, @Res() res: Response) {
    const kind = format === 'png' ? 'png' : format === 'svg' ? 'svg' : null;
    if (!kind) throw new BadRequestException('format must be svg or png');
    const { handle, url } = await this.profiles.shareTarget(authenticatedUserId(req));
    const image = await profileQr(url, kind);
    res.setHeader('Content-Type', kind === 'svg' ? 'image/svg+xml' : 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${handle}-qr.${kind}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(image);
  }

  @Permissions('clinical.record')
  @Get('templates')
  @ApiOperation({ summary: 'Profile templates: prompts, examples and guidance per section' })
  templates() {
    return this.profiles.activeTemplates();
  }

  @Permissions('clinical.record')
  @Get('handle-check/:handle')
  @ApiOperation({ summary: 'Whether a handle is free for me' })
  checkHandle(@Req() req: any, @Param('handle') handle: string) {
    return this.profiles.handleAvailability(authenticatedUserId(req), handle);
  }

  @Permissions('clinical.record')
  @Get('taxonomy')
  @ApiOperation({ summary: 'The active taxonomy terms, for the editor' })
  taxonomy() {
    return this.profiles.activeTaxonomy();
  }
}
