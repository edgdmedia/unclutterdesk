import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function hostFor(method = 'POST', path = '/v1/notes') {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method, path }),
    }),
  } as any;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    filter = new AllExceptionsFilter();
  });

  it('never leaks an unexpected error message to the client', () => {
    const { host, status, json } = hostFor();
    // The shape of a leaked Prisma error: it quotes stored values.
    filter.catch(
      new Error('Invalid `prisma.clinicalNote.create()`: value "suicidal ideation"'),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('prisma');
    expect(JSON.stringify(body)).not.toContain('suicidal');
  });

  it('gives every 5xx a reference id that is also logged', () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, json } = hostFor();
    filter.catch(new Error('boom'), host);

    const { reference } = json.mock.calls[0][0];
    expect(reference).toMatch(/^[0-9a-f-]{36}$/);
    expect(errorLog.mock.calls[0][0]).toContain(reference);
  });

  it('logs the route but never the request body or query string', () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host } = hostFor('POST', '/v1/notes');
    filter.catch(new Error('boom'), host);

    const logged = String(errorLog.mock.calls[0][0]);
    expect(logged).toContain('POST /v1/notes');
    expect(logged).not.toContain('?');
  });

  it('passes 4xx bodies through unchanged', () => {
    const { host, status, json } = hostFor();
    filter.catch(new BadRequestException('email must be an email'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json.mock.calls[0][0]).toMatchObject({
      statusCode: 400,
      message: 'email must be an email',
    });
  });

  it('preserves structured error payloads used by the auth flow', () => {
    const { host, json } = hostFor();
    filter.catch(
      new ForbiddenException({ message: 'Email not verified', code: 'EMAIL_UNVERIFIED' }),
      host,
    );
    expect(json.mock.calls[0][0]).toMatchObject({
      message: 'Email not verified',
      code: 'EMAIL_UNVERIFIED',
    });
  });

  it('does not log routine 404s and 401s', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { host } = hostFor('GET', '/v1/auth/status');
    filter.catch(new NotFoundException(), host);
    filter.catch(new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED), host);
    expect(warn).not.toHaveBeenCalled();
  });

  it('normalises a string HttpException body into an object', () => {
    const { host, json } = hostFor();
    filter.catch(new HttpException('Teapot', 418), host);
    expect(json.mock.calls[0][0]).toEqual({ statusCode: 418, message: 'Teapot' });
  });

  it('handles a thrown non-Error value without crashing', () => {
    const { host, status, json } = hostFor();
    expect(() => filter.catch('just a string', host)).not.toThrow();
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json.mock.calls[0][0].message).toBe('Internal server error');
  });
});
