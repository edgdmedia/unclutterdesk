import { describe, expect, it } from 'vitest';
import { allRoutes } from './test-support/routes';

/*
 * Two handlers on the same method and path: Nest silently serves the first
 * one registered, so the other is dead and its callers get the wrong
 * response. (GET /v1/billing/plans was added twice, and the subscription
 * page crashed on the public shape.) Path parameters are compared by
 * position, not name.
 */
describe('routes', () => {
  it('has exactly one handler per method and path', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const r of allRoutes()) {
      const key = r.target.replace(/:[^/]+/g, ':param');
      const where = (r as any).file ?? '';
      if (seen.has(key)) clashes.push(`${r.target} (${seen.get(key)} and ${where})`);
      else seen.set(key, where);
    }
    expect(clashes).toEqual([]);
  });
});
