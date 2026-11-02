import { describe, it, expect } from 'vitest';

// These header names must be kept in sync between API and tenant-router.
// They are duplicated because:
// 1. The tenant-router is a Workers app, the API is NestJS
// 2. The build-layout test prevents cross-app imports in compiled output
// When updating these, update both locations to maintain the proxy contract.
import {
  ROUTER_SECRET_HEADER,
  PRACTICE_HOST_HEADER,
  CLIENT_IP_HEADER,
} from '../common/middleware/router-proxy.middleware';

// Expected values from tenant-router/src/api-proxy.ts
const TENANT_ROUTER_HEADERS = {
  ROUTER_SECRET_HEADER: 'x-ud-router-secret',
  PRACTICE_HOST_HEADER: 'x-ud-practice-host',
  CLIENT_IP_HEADER: 'x-ud-client-ip',
} as const;

describe('router headers are pinned between API and tenant-router', () => {
  it('ROUTER_SECRET_HEADER matches the tenant-router value', () => {
    expect(ROUTER_SECRET_HEADER).toBe(TENANT_ROUTER_HEADERS.ROUTER_SECRET_HEADER);
  });

  it('PRACTICE_HOST_HEADER matches the tenant-router value', () => {
    expect(PRACTICE_HOST_HEADER).toBe(TENANT_ROUTER_HEADERS.PRACTICE_HOST_HEADER);
  });

  it('CLIENT_IP_HEADER matches the tenant-router value', () => {
    expect(CLIENT_IP_HEADER).toBe(TENANT_ROUTER_HEADERS.CLIENT_IP_HEADER);
  });
});