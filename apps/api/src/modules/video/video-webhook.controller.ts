import { Controller, HttpCode, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { VideoUsageService } from './video-usage.service';
import { verifyDailySignature } from './daily-webhook';

type WebhookRequest = { rawBody?: Buffer; headers: Record<string, string | undefined>; body: any };

/**
 * VID-01: Daily tells us when a meeting ends, so its own participant durations
 * can replace the heartbeat estimate. Public, but every event must carry
 * Daily's signature.
 */
@Controller('v1/video/webhooks')
export class VideoWebhookController {
  private readonly logger = new Logger(VideoWebhookController.name);

  constructor(private readonly usage: VideoUsageService) {}

  @Post('daily')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async daily(@Req() req: WebhookRequest) {
    const secret = process.env.DAILY_WEBHOOK_SECRET;
    // Without a secret nothing can be trusted; heartbeat minutes stand.
    if (!secret) return { ok: true };
    const ok = verifyDailySignature(secret, req.headers['x-webhook-signature'], req.headers['x-webhook-timestamp'], req.rawBody);
    if (!ok) throw new UnauthorizedException('Invalid signature');

    const event = req.body ?? {};
    if (event.type === 'meeting.ended' && typeof event.payload?.room === 'string') {
      await this.usage.reconcileDaily(event.payload.room).catch((err) =>
        this.logger.warn(`Could not reconcile Daily room ${event.payload.room}: ${(err as Error).message}`),
      );
    }
    // Anything else, including Daily's {"test":"test"} set-up check, is acknowledged.
    return { ok: true };
  }
}
