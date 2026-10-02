import { Inject, Injectable } from '@nestjs/common';
import { VIDEO_PROVIDERS, VideoProvider } from './video-provider';
import { VideoUsageService } from './video-usage.service';

const limit = (name: string, fallback: number) => Number(process.env[name] ?? fallback);

/** VID-01: Daily while its monthly budget lasts, then JaaS, then a link. */
@Injectable()
export class VideoRouter {
  constructor(private readonly usage: VideoUsageService, @Inject(VIDEO_PROVIDERS) private readonly providers: VideoProvider[]) {}

  private get(key: string) { return this.providers.find((p) => p.key === key && p.available()); }

  async choose(now = new Date()): Promise<VideoProvider> {
    const daily = this.get('DAILY');
    if (daily && (await this.usage.dailyMinutesThisMonth(now)) < limit('VIDEO_DAILY_MONTHLY_MINUTES', 9500)) return daily;
    const jaas = this.get('JAAS');
    if (jaas && (await this.usage.jaasUsersThisMonth(now)) < limit('VIDEO_JAAS_MONTHLY_USERS', 23)) return jaas;
    return this.get('LINK')!;
  }

  /** The next provider after one that failed to create a room. */
  after(key: string): VideoProvider {
    const order = ['DAILY', 'JAAS', 'LINK'];
    for (const k of order.slice(order.indexOf(key) + 1)) { const p = this.get(k); if (p) return p; }
    return this.get('LINK')!;
  }

  byKey(key: string) { return this.get(key) ?? this.get('LINK')!; }
}
