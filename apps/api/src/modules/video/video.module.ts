import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DailyProvider } from './daily.provider';
import { JaasProvider } from './jaas.provider';
import { LinkProvider } from './link.provider';
import { VIDEO_PROVIDERS } from './video-provider';
import { VideoUsageService } from './video-usage.service';
import { VideoRouter } from './video-router.service';
import { VideoRoomService } from './video-room.service';
import { VideoController } from './video.controller';
import { VideoWebhookController } from './video-webhook.controller';

/** VID-01: session video rooms (Daily, then JaaS, then a link) and their usage. */
@Module({
  controllers: [VideoController, VideoWebhookController],
  providers: [
    PrismaService,
    DailyProvider,
    JaasProvider,
    LinkProvider,
    {
      provide: VIDEO_PROVIDERS,
      useFactory: (d: DailyProvider, j: JaasProvider, l: LinkProvider) => [d, j, l],
      inject: [DailyProvider, JaasProvider, LinkProvider],
    },
    VideoUsageService,
    VideoRouter,
    VideoRoomService,
  ],
  exports: [VideoUsageService],
})
export class VideoModule {}
