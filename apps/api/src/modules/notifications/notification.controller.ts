import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { AnyAuthenticated } from '../../common/roles';
import { NotificationService } from './notification.service';
import { ChannelKey } from './channels/notification.channel';
import { authenticatedProfileId, authenticatedTenantId } from '../../common/authenticated-tenant';

const SSE_POLL_MS = Number(process.env.NOTIFICATION_SSE_POLL_MS || 15_000);
const SSE_HEARTBEAT_MS = 30_000;

@ApiTags('Notifications')
@Controller('v1/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  private profileId(req: any): bigint {
    return authenticatedProfileId(req);
  }

  private tenantId(req: any): bigint {
    return authenticatedTenantId(req);
  }

  @AnyAuthenticated()
  @Get()
  @ApiOperation({ summary: 'List in-app notifications for the current profile' })
  list(
    @Req() req: any,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.notifications.listForProfile(this.profileId(req), {
      unreadOnly: unreadOnly === 'true',
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @AnyAuthenticated()
  @Get('unread-count')
  @ApiOperation({ summary: 'Number of unread notifications' })
  unreadCount(@Req() req: any) {
    return this.notifications.unreadCount(this.profileId(req));
  }

  @AnyAuthenticated()
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.notifications.markRead(this.profileId(req), BigInt(id));
  }

  @AnyAuthenticated()
  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a notification' })
  archive(@Req() req: any, @Param('id') id: string) {
    return this.notifications.markArchived(this.profileId(req), BigInt(id));
  }

  @AnyAuthenticated()
  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@Req() req: any) {
    return this.notifications.markAllRead(this.profileId(req));
  }

  // ── Preferences ────────────────────────────────────────────────────────────

  @AnyAuthenticated()
  @Get('preferences')
  @ApiOperation({ summary: 'Notification channel preferences for the profile' })
  getPreferences(@Req() req: any, @Query('module') module?: string) {
    return this.notifications.getPreferences(this.profileId(req), module);
  }

  @AnyAuthenticated()
  @Put('preferences')
  @ApiOperation({ summary: 'Set a notification channel preference' })
  setPreference(
    @Req() req: any,
    @Body() dto: { module: string; category?: string; channel: ChannelKey; enabled: boolean },
  ) {
    return this.notifications.setPreference(this.tenantId(req), this.profileId(req), dto);
  }

  // ── Push subscriptions ─────────────────────────────────────────────────────

  @AnyAuthenticated()
  @Get('push/key')
  @ApiOperation({ summary: 'VAPID public key for push registration (null when push is not wired)' })
  pushKey() {
    return this.notifications.pushPublicKey();
  }

  @AnyAuthenticated()
  @Post('push/subscribe')
  @ApiOperation({ summary: 'Register a web-push subscription' })
  subscribePush(
    @Req() req: any,
    @Body() dto: { endpoint: string; p256dh: string; auth: string },
  ) {
    return this.notifications.subscribePush(this.tenantId(req), this.profileId(req), dto);
  }

  @AnyAuthenticated()
  @Delete('push/subscribe')
  @ApiOperation({ summary: 'Deactivate a web-push subscription' })
  unsubscribePush(@Req() req: any, @Body() dto: { endpoint: string }) {
    return this.notifications.unsubscribePush(this.profileId(req), dto.endpoint);
  }

  // ── SSE stream ─────────────────────────────────────────────────────────────

  @AnyAuthenticated()
  @Get('stream')
  @ApiOperation({ summary: 'Server-sent events stream of unread notifications' })
  async stream(@Req() req: any, @Res() res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const profileId = this.profileId(req);
    let lastUnread = -1;
    let heartbeat: ReturnType<typeof setInterval>;
    let poller: ReturnType<typeof setInterval>;

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const poll = async () => {
      try {
        const result = await this.notifications.listForProfile(profileId, {
          unreadOnly: true,
          pageSize: 50,
        });
        const total = result.pagination.total;
        if (total !== lastUnread) {
          send('unread', { total, items: result.items });
          lastUnread = total;
        }
      } catch (e: any) {
        send('error', { message: e?.message ?? 'stream error' });
      }
    };

    const close = () => {
      if (poller) clearInterval(poller);
      if (heartbeat) clearInterval(heartbeat);
      res.end();
    };

    req.on('close', close);
    req.on('error', close);
    res.on('error', close);

    await poll();
    poller = setInterval(poll, SSE_POLL_MS);
    heartbeat = setInterval(() => res.write(': ping\n\n'), SSE_HEARTBEAT_MS);
  }
}
