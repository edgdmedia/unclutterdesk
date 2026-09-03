// Keep as the first import: it loads the repo-root .env before any module that
// reads process.env at import time (auth.config, Prisma). TS compiles imports to
// requires in declaration order, so body-level dotenv calls in main.ts run too late.
import './env';

// Must come before any module the SDK instruments (http, express, Postgres).
// It reads SENTRY_DSN, so it has to follow './env' — and is inert without it.
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma/prisma.service';
import { createCorsOriginHandler } from './common/cors';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

// Global BigInt JSON serialization fallback (prevents "Do not know how to serialize a BigInt" error)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  // rawBody is required to verify Paystack webhook signatures against the exact
  // bytes Paystack signed — a re-serialised parsed body is not byte-identical.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  // The API sits behind nginx (and, once proxied, Cloudflare). Without this,
  // req.ip is the proxy's own socket address for every request, so the rate
  // limiter buckets the entire internet together. Requires nginx to send
  // `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`.
  app.set('trust proxy', 1);

  app.use(cookieParser());

  app.use(
    helmet({
      // The API serves JSON, not documents; the Swagger UI (dev only) needs inline
      // styles and scripts, so the document policy is left to the front ends.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    }),
  );

  app.enableCors({
    origin: createCorsOriginHandler(app.get(PrismaService), {
      isProduction,
      configuredOrigins,
    }),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Tenant-Slug', 'X-Tenant-Id'],
    optionsSuccessStatus: 204,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Unclutter Desk Multi-Tenant API')
    .setDescription('B2B Practice Management & White-Label Telehealth API')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();

  if (!isProduction) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  app.getHttpAdapter().get('/', (_req: unknown, res: { json: (body: unknown) => void }) => {
    res.json({
      name: 'Unclutter Desk API',
      status: 'ok',
      version: '1.0.0',
      ...(isProduction ? {} : { docs: '/docs' }),
    });
  });

  const port = process.env.PORT || 3050;
  await app.listen(port);
  console.log(`🚀 Unclutter Desk API running on port ${port}`);
}

bootstrap();
