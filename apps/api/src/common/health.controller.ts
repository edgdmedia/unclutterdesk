import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';

/**
 * Liveness is not the same as usefulness: the process can be listening while the
 * database connection is gone, which is exactly the state an uptime monitor
 * needs to catch. This endpoint therefore touches the database.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  // Exempt from rate limiting so a monitor polling every 30s can never be
  // throttled, and so a burst of traffic does not mask an outage as a 429.
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Liveness and database readiness probe' })
  async check() {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'up',
        latencyMs: Date.now() - startedAt,
        uptimeSeconds: Math.floor(process.uptime()),
      };
    } catch (error) {
      // Must be a failing HTTP status, not a 200 with an "error" body — an
      // uptime monitor or load balancer reads the status code, and a 200 here
      // would report a database outage as healthy.
      this.logger.error('Health check failed: database unreachable', error as Error);
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        latencyMs: Date.now() - startedAt,
        uptimeSeconds: Math.floor(process.uptime()),
      });
    }
  }
}
