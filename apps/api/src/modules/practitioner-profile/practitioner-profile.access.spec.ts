import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allRoutes } from '../../test-support/routes';

/*
 * Profiles are global, not tenant-scoped, so tenant-isolation.spec.ts can't
 * protect them (spec §6.1). The rule here instead: in the owner-facing
 * service, every query on a profile or its child rows is scoped to the
 * signed-in user — by `userId`, or `profile: { userId }` for child rows — so a
 * draft can never be read or changed by anyone else. Like the tenant guard,
 * this reads the source, so it also covers methods nobody has tested yet.
 */
const SERVICE = readFileSync(resolve(__dirname, 'practitioner-profile.service.ts'), 'utf8');

/** Every `this.prisma.<model>.<op>({ ... })` call on profile-owned models, with its argument text. */
function profileQueries(src: string) {
  const owned = ['practitionerProfile', 'practitionerTaxonomy', 'practitionerTimelineEntry', 'practitionerPlace', 'practitionerHandleHistory'];
  const found: { call: string; arg: string }[] = [];
  for (const m of src.matchAll(/this\.prisma\.(\w+)\.(\w+)\(/g)) {
    if (!owned.includes(m[1])) continue;
    let depth = 0;
    let end = m.index! + m[0].length - 1;
    for (let i = end; i < src.length; i += 1) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    found.push({ call: `${m[1]}.${m[2]}`, arg: src.slice(m.index! + m[0].length, end) });
  }
  return found;
}

/**
 * Lookups by a unique handle, answered only with *who* holds it (used to say
 * "taken"). They return no profile content.
 */
const HOLDER_LOOKUPS = [/where: \{ handle \}, select: \{ userId: true \}/, /where: \{ handle \},\s*select: \{ profile: \{ select: \{ userId: true \} \} \}/];

describe('practitioner profile access (§6.1)', () => {
  const queries = profileQueries(SERVICE);

  it('finds the queries it checks', () => {
    expect(queries.length).toBeGreaterThan(8);
  });

  it.each(queries.map((q) => [q.call, q.arg] as const))('%s is scoped to the signed-in user', (_call, arg) => {
    const scoped = /\buserId\b/.test(arg) || /profile: \{ userId \}/.test(arg) || /data: \{ handle: profile\.handle, profileId: profile\.id \}/.test(arg) || /profileId: profile\.id/.test(arg);
    const holderOnly = HOLDER_LOOKUPS.some((re) => re.test(arg));
    expect(scoped || holderOnly, arg.trim().slice(0, 160)).toBe(true);
  });

  it('puts no profile id in any route, so a caller can only ever name their own', () => {
    const routes = allRoutes().filter((r) => r.target.includes('/v1/practitioner-profile'));
    expect(routes.length).toBeGreaterThan(5);
    for (const r of routes) {
      expect(r.target).not.toMatch(/:(id|profileId|userId)\b/);
      expect(r.authenticated, `${r.target} must require sign-in`).toBe(true);
      expect(r.roles, `${r.target} is not for clients`).not.toContain('CLIENT');
    }
  });

  it('guards the share QR route with sign-in and no profile id', () => {
    // §6.10: a practitioner gets only their own QR. There is no handle or id
    // in the path, so the route itself cannot name someone else.
    const target = 'GET /v1/practitioner-profile/me/share/qr';
    const route = allRoutes().find((r) => r.target === target);
    expect(route, `${target} is missing`).toBeDefined();
    expect(route!.authenticated).toBe(true);
    expect(route!.roles).not.toContain('CLIENT');
    expect(target).not.toMatch(/:(id|profileId|userId)\b/);
  });
});
