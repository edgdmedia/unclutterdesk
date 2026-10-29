import { describe, expect, it, vi, afterEach } from 'vitest';
import type { NextFunction, Response } from 'express';
import {
  CLIENT_IP_HEADER,
  PRACTICE_HOST_HEADER,
  ROUTER_SECRET_HEADER,
  RouterProxyMiddleware,
  clientIpOf,
  type RouterProxyRequest,
} from './router-proxy.middleware';

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

function run(headers: Record<string, string>, secret: string | null = 'router-secret') {
  if (secret === null) delete process.env.ROUTER_PROXY_SECRET;
  else process.env.ROUTER_PROXY_SECRET = secret;
  const req = { method: 'POST', path: '/v1/auth/login', headers: { ...headers }, ip: '10.0.0.9' } as unknown as RouterProxyRequest;
  const next = vi.fn() as unknown as NextFunction;
  new RouterProxyMiddleware().use(req, {} as Response, next);
  expect(next).toHaveBeenCalled();
  return req;
}

const fromRouter = (over: Record<string, string> = {}) => ({
  [ROUTER_SECRET_HEADER]: 'router-secret',
  [PRACTICE_HOST_HEADER]: 'Chente.com',
  [CLIENT_IP_HEADER]: '102.89.1.2',
  ...over,
});

describe('router proxy headers (spec §6.16)', () => {
  it('are trusted when the secret matches', () => {
    const req = run(fromRouter());
    expect(req.routerProxy).toEqual({ practiceHost: 'chente.com', clientIp: '102.89.1.2' });
    expect(clientIpOf(req)).toBe('102.89.1.2');
  });

  it.each([
    ['a wrong secret', fromRouter({ [ROUTER_SECRET_HEADER]: 'guess' })],
    ['a secret of a different length', fromRouter({ [ROUTER_SECRET_HEADER]: 'router-secret-and-more' })],
    ['no secret', { [PRACTICE_HOST_HEADER]: 'chente.com', [CLIENT_IP_HEADER]: '1.2.3.4' }],
  ])('are ignored, not rejected, with %s: an ordinary direct request', (_label, headers) => {
    const req = run(headers);
    expect(req.routerProxy).toBeUndefined();
    expect(clientIpOf(req)).toBe('10.0.0.9');
  });

  it('are ignored when the API has no secret configured, even if one is sent', () => {
    const req = run(fromRouter(), null);
    expect(req.routerProxy).toBeUndefined();
  });

  it('are always removed, so nothing downstream reads them unchecked', () => {
    for (const headers of [fromRouter(), fromRouter({ [ROUTER_SECRET_HEADER]: 'guess' })]) {
      const req = run(headers);
      for (const h of [ROUTER_SECRET_HEADER, PRACTICE_HOST_HEADER, CLIENT_IP_HEADER]) expect(req.headers[h]).toBeUndefined();
    }
  });

  it('drop a forwarded IP that is not an IP address', () => {
    const req = run(fromRouter({ [CLIENT_IP_HEADER]: '1.2.3.4, evil' }));
    expect(req.routerProxy?.clientIp).toBeNull();
    expect(clientIpOf(req)).toBe('10.0.0.9');
  });
});
