import { BadRequestException, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Permissions, effectivePermissions } from '../../common/permissions';
import { authenticatedProfileId, authenticatedTenantId } from '../../common/authenticated-tenant';
import { VideoRoomService } from './video-room.service';
import { VideoUsageService } from './video-usage.service';

const id = (raw: string) => {
  if (!/^\d+$/.test(raw)) throw new BadRequestException('Invalid id');
  return BigInt(raw);
};

/** VID-01: session rooms. The service decides who may join; the route only needs a session. */
@ApiTags('Video')
@Controller('v1/video')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class VideoController {
  constructor(private readonly rooms: VideoRoomService, private readonly usage: VideoUsageService) {}

  @Permissions('any.authenticated')
  @Post('bookings/:id/join')
  @ApiOperation({ summary: "Credentials for a session's room: its client, therapist or clinical staff, while the room is open" })
  join(@Req() req: any, @Param('id') bookingId: string) {
    const held = effectivePermissions(String(req.user?.role ?? ''), (req.user?.permissions ?? []) as string[]);
    return this.rooms.join(authenticatedTenantId(req), id(bookingId), {
      profileId: authenticatedProfileId(req),
      canSeeClinical: held.has('clinical.record'),
    });
  }

  @Permissions('any.authenticated')
  @Post('participants/:id/heartbeat')
  @ApiOperation({ summary: "Still in the room: keeps the caller's own minutes current" })
  async heartbeat(@Req() req: any, @Param('id') participantId: string) {
    await this.usage.heartbeat(id(participantId), authenticatedProfileId(req));
    return { ok: true };
  }
}
