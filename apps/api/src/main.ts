// Keep as the first import: it loads the repo-root .env before any module that
// reads process.env at import time (auth.config, Prisma). TS compiles imports to
// requires in declaration order, so body-level dotenv calls in main.ts run too late.
import './env';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

// Global BigInt JSON serialization fallback (prevents "Do not know how to serialize a BigInt" error)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  app.use(cookieParser());

  app.enableCors({
    origin: (origin, callback) => {
      const allowed =
        !origin ||
        configuredOrigins.includes(origin) ||
        origin.endsWith('.unclutterdesk.com') ||
        origin === 'https://unclutterdesk.com' ||
        origin.endsWith('.pages.dev') ||
        origin.includes('localhost');

      if (allowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Tenant-Slug', 'X-Tenant-Id'],
    optionsSuccessStatus: 204,
  });

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
