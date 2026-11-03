import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROFILE_FEATURE_TIERS } from '../entitlements';

/**
 * PROFILE_FEATURE_TIERS copies the API's PROFILE_ENTITLEMENTS by hand (the app
 * can't import the API). Read the API source and check each feature's cheapest
 * plan is the one the app names, so the upgrade prompt never names the wrong plan.
 */
describe('PROFILE_FEATURE_TIERS', () => {
  const api = readFileSync(resolve(__dirname, '../../../../api/src/modules/entitlements/entitlements.ts'), 'utf8');
  const tiers = /export const TIERS: Tier\[\] = \[([^\]]+)\]/.exec(api)![1].match(/'([A-Z]+)'/g)!.map((t) => t.slice(1, -1));
  const table = /export const PROFILE_ENTITLEMENTS[^{]*\{([\s\S]*?)\n\};/.exec(api)![1];
  const rows = Object.fromEntries(
    [...table.matchAll(/(\w+): \{([^}]+)\}/g)].map(([, tier, body]) => [tier, Object.fromEntries([...body.matchAll(/(\w+): (true|false)/g)].map(([, k, v]) => [k, v === 'true']))]),
  );

  it.each(Object.keys(PROFILE_FEATURE_TIERS) as (keyof typeof PROFILE_FEATURE_TIERS)[])('%s names the cheapest plan that includes it', (feature) => {
    const cheapest = tiers.find((t) => rows[t]?.[feature]);
    expect(cheapest).toBeDefined();
    expect(PROFILE_FEATURE_TIERS[feature]).toBe(cheapest);
  });
});
