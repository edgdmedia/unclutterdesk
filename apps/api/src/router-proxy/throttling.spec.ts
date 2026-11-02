import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get, Module, type INestApplication, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import { ProxyAwareThrottlerGuard } from '../common/proxy-aware-throttler.guard';
import { CLIENT_IP_HEADER, PRACTICE_HOST_HEADER, ROUTER_SECRET_HEADER, RouterProxyMiddleware } from '../common/middleware/router-proxy.middleware';

@Controller('t')
class LimitedController {
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  @Get()
  hit() {
    return { ok: true };
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }])],
  controllers: [LimitedController],
  providers: [{ provide: APP_GUARD, useClass: ProxyAwareThrottlerGuard }],
})
class TestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RouterProxyMiddleware).forRoutes('*');
  }
}

/*
 * Every proxied request reaches the API from the tenant router, so without the
 * forwarded IP all custom-domain visitors would share one bucket and lock each
 * other out of sign-in (spec §6.16). A real Nest app, real guard, real HTTP.
 */
describe('rate limits behind the custom-domain proxy', () => {
  let app: INestApplication;
  let base: string;
  const env = { ...process.env };

  beforeAll(async () => {
    process.env.ROUTER_PROXY_SECRET = 'router-secret';
    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });
  afterAll(async () => {
    await app.close();
    process.env = { ...env };
  });

  const hit = (headers: Record<string, string>) => fetch(`${base}/t`, { headers }).then((r) => r.status);
  const proxied = (ip: string, secret = 'router-secret') => ({
    [ROUTER_SECRET_HEADER]: secret,
    [PRACTICE_HOST_HEADER]: 'chente.com',
    [CLIENT_IP_HEADER]: ip,
  });

  it('gives two different forwarded IPs separate buckets', async () => {
    expect(await hit(proxied('102.89.1.1'))).toBe(200);
    expect(await hit(proxied('102.89.1.1'))).toBe(429);
    expect(await hit(proxied('102.89.1.2'))).toBe(200);
  });

  it('ignores a forwarded IP sent without the right secret: it shares the caller own bucket', async () => {
    expect(await hit(proxied('203.0.113.7', 'guess'))).toBe(200);
    expect(await hit(proxied('203.0.113.8', 'guess'))).toBe(429);
  });
});
