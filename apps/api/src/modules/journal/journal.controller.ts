import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Permissions, effectivePermissions } from '../../common/permissions';
import { authenticatedProfileId, authenticatedTenantId } from '../../common/authenticated-tenant';
import { JournalService } from './journal.service';

const bookingIdOf = (raw: string, missing: string) => {
  if (!/^\d{1,19}$/.test(raw)) throw new NotFoundException(missing);
  return BigInt(raw);
};

/** A practitioner's Journal plan and the client's Unclutter Journal (docs/design/journal-integration.md). */
@ApiTags('journal')
@Controller('v1/consult')
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  private actor(req: any) {
    const held = effectivePermissions(String(req.user?.role ?? ''), (req.user?.permissions ?? []) as string[]);
    return {
      profileId: authenticatedProfileId(req),
      viewAll: held.has('sessions.view-all'),
      clinical: held.has('clinical.record'),
    };
  }

  // ── The practitioner ──

  @Permissions('clinical.record')
  @Get('practice/sessions/:bookingId/journal')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'The session’s Journal plan, the client’s progress and the entries she shares' })
  staffView(@Req() req: any, @Param('bookingId') bookingId: string) {
    return this.journal.staffView(authenticatedTenantId(req), this.actor(req), bookingIdOf(bookingId, 'Session not found'));
  }

  @Permissions('clinical.record')
  @Put('practice/sessions/:bookingId/journal-plan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Write, replace or (with null) remove the session’s Journal plan' })
  setPlan(@Req() req: any, @Param('bookingId') bookingId: string, @Body() dto: { plan?: unknown }) {
    return this.journal.setPlan(authenticatedTenantId(req), this.actor(req), bookingIdOf(bookingId, 'Session not found'), dto?.plan ?? null);
  }

  // ── The client ──

  @Permissions('any.authenticated')
  @Get('portal/sessions/:bookingId/journal')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'The Journal plan on the signed-in client’s own recap' })
  clientView(@Req() req: any, @Param('bookingId') bookingId: string) {
    return this.journal.clientView(authenticatedTenantId(req), authenticatedProfileId(req), bookingIdOf(bookingId, 'Recap not found'));
  }

  @Permissions('any.authenticated')
  @Post('portal/sessions/:bookingId/journal/connect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Start linking the signed-in client’s Unclutter Journal: the signed request to carry there' })
  connect(@Req() req: any, @Param('bookingId') bookingId: string, @Body() dto: { deliveryTime?: unknown }) {
    return this.journal.connect(authenticatedTenantId(req), authenticatedProfileId(req), bookingIdOf(bookingId, 'Recap not found'), dto?.deliveryTime);
  }

  @Permissions('any.authenticated')
  @Put('portal/sessions/:bookingId/journal/plan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Add the session’s plan to the signed-in client’s linked Journal' })
  addPlan(@Req() req: any, @Param('bookingId') bookingId: string, @Body() dto: { deliveryTime?: unknown }) {
    return this.journal.addPlan(authenticatedTenantId(req), authenticatedProfileId(req), bookingIdOf(bookingId, 'Recap not found'), dto?.deliveryTime);
  }

  @Permissions('any.authenticated')
  @Post('portal/journal/link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Back from Journal: finish (or record a declined) link for the signed-in client' })
  completeLink(@Req() req: any, @Body() dto: { state?: unknown; code?: unknown; error?: unknown }) {
    return this.journal.completeLink(authenticatedTenantId(req), authenticatedProfileId(req), dto ?? {});
  }

  @Permissions('any.authenticated')
  @Delete('portal/journal/link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'The signed-in client disconnects her Journal from this practice' })
  disconnect(@Req() req: any) {
    return this.journal.disconnect(authenticatedTenantId(req), authenticatedProfileId(req));
  }
}
