import { Body, Controller, Get, Param, Patch, Post, Put, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Permissions } from '../../common/permissions';
import { authenticatedProfileId } from '../../common/authenticated-tenant';
import {
  PractitionerProfileService,
  type ProfileCreateInput,
  type ProfileUpdateInput,
  type TaxonomySelection,
} from './practitioner-profile.service';

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
  update(@Req() req: any, @Body() dto: ProfileUpdateInput) {
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
