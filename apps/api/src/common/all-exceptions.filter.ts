import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Catches everything that reaches the top of the request pipeline.
 *
 * Two jobs, and they pull in opposite directions:
 *  - operators need the stack trace, so unexpected errors are logged in full;
 *  - clients must not receive it, because an unhandled Prisma error can quote
 *    column values — which in this product means clinical data.
 *
 * Every 5xx gets a reference id that appears in both the log line and the
 * response, so a user can quote it in a support request without either side
 * seeing the underlying error.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Deliberately never the request body or query string: those carry
    // credentials, note content and assessment answers.
    const where = `${request.method} ${request.path}`;

    if (status >= 500) {
      const reference = randomUUID();
      this.logger.error(
        `[${reference}] ${where} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );

      return response.status(status).json({
        statusCode: status,
        message: 'Internal server error',
        reference,
      });
    }

    // 4xx are the caller's problem and their bodies are written by us, so they
    // pass through unchanged. Logged at warn without a stack to keep the noise
    // of ordinary 401s and 404s down.
    if (status !== HttpStatus.NOT_FOUND && status !== HttpStatus.UNAUTHORIZED) {
      this.logger.warn(`${where} -> ${status}`);
    }

    const body = isHttpException
      ? exception.getResponse()
      : { statusCode: status, message: 'Request failed' };

    return response
      .status(status)
      .json(typeof body === 'string' ? { statusCode: status, message: body } : body);
  }
}
