import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// These header names must be kept in sync between API and tenant-router.
// Drift is caught by reading the router's source as text (not importing it,
// which build-layout forbids). Update both places if a header name changes.
import {
  ROUTER_SECRET_HEADER,
  PRACTICE_HOST_HEADER,
  CLIENT_IP_HEADER,
} from '../common/middleware/router-proxy.middleware';

const routerSource = readFileSync(
  resolve(__dirname, '../../../tenant-router/src/api-proxy.ts'),
  'utf8',
);

function extractHeader(name: string): string {
  const match = routerSource.match(new RegExp(`export const ${name} = '([^']+)'`));
  expect(match, `${name} not found in tenant-router/src/api-proxy.ts`).toBeTruthy();
  return match![1];
}

describe('router headers are pinned between API and tenant-router', () => {
  it('ROUTER_SECRET_HEADER matches the tenant-router value', () => {
    expect(ROUTER_SECRET_HEADER).toBe(extractHeader('ROUTER_SECRET_HEADER'));
  });

  it('PRACTICE_HOST_HEADER matches the tenant-router value', () => {
    expect(PRACTICE_HOST_HEADER).toBe(extractHeader('PRACTICE_HOST_HEADER'));
  });

  it('CLIENT_IP_HEADER matches the tenant-router value', () => {
    expect(CLIENT_IP_HEADER).toBe(extractHeader('CLIENT_IP_HEADER'));
  });
});
