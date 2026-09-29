import { describe, expect, it } from 'vitest';
import { CLINICAL, FRONT_DESK, PRACTICE_ADMIN, STAFF } from './roles';
import { GRANTABLE, PERMISSIONS, ROLE_PERMISSIONS, effectivePermissions, type Permission } from './permissions';

const has = (role: string, set: Permission[]) => PERMISSIONS.filter((p) => set.includes(p));

describe('ROLE_PERMISSIONS reproduces the old groups exactly', () => {
  it('practice.staff is what STAFF was', () => {
    for (const role of ['OWNER', 'ADMIN', 'THERAPIST', 'RECEPTIONIST']) {
      expect(effectivePermissions(role, []).has('practice.staff')).toBe((STAFF as readonly string[]).includes(role));
    }
    expect(effectivePermissions('CLIENT', []).has('practice.staff')).toBe(false);
  });
  it('clinical.record is what CLINICAL was', () => {
    for (const role of ['OWNER', 'ADMIN', 'THERAPIST', 'RECEPTIONIST', 'CLIENT']) {
      expect(effectivePermissions(role, []).has('clinical.record')).toBe((CLINICAL as readonly string[]).includes(role));
    }
  });
  it('practice.admin is what PRACTICE_ADMIN was', () => {
    for (const role of ['OWNER', 'ADMIN', 'THERAPIST', 'RECEPTIONIST']) {
      expect(effectivePermissions(role, []).has('practice.admin')).toBe((PRACTICE_ADMIN as readonly string[]).includes(role));
    }
  });
  it('payments.desk is what FRONT_DESK was', () => {
    for (const role of ['OWNER', 'ADMIN', 'THERAPIST', 'RECEPTIONIST']) {
      expect(effectivePermissions(role, []).has('payments.desk')).toBe((FRONT_DESK as readonly string[]).includes(role));
    }
  });
  it('every role, client included, holds any.authenticated', () => {
    for (const role of ['OWNER', 'ADMIN', 'THERAPIST', 'RECEPTIONIST', 'CLIENT']) {
      expect(effectivePermissions(role, []).has('any.authenticated')).toBe(true);
    }
  });
});

describe('grants', () => {
  it('add permissions to a role', () => {
    const e = effectivePermissions('THERAPIST', ['sessions.edit']);
    expect(e.has('sessions.edit')).toBe(true);
    expect(e.has('practice.admin')).toBe(false);
  });
  it('ignore unknown keys and non-grantable ones', () => {
    const e = effectivePermissions('THERAPIST', ['practice.owner', 'made.up', 'any.authenticated']);
    expect((e as Set<string>).has('made.up')).toBe(false);
    expect(e.has('practice.owner')).toBe(false);
  });
  it('an owner holds practice.owner; nobody else does', () => {
    expect(effectivePermissions('OWNER', []).has('practice.owner')).toBe(true);
    expect(effectivePermissions('ADMIN', []).has('practice.owner')).toBe(false);
  });
  it('an unknown role has nothing beyond any.authenticated', () => {
    const e = effectivePermissions('WIZARD', []);
    expect([...e]).toEqual(['any.authenticated']);
  });
});

describe('catalog hygiene', () => {
  it('every role maps only to catalog keys', () => {
    for (const list of Object.values(ROLE_PERMISSIONS)) {
      for (const p of list) expect(PERMISSIONS).toContain(p);
    }
  });
  it('GRANTABLE excludes the three structural keys', () => {
    expect(GRANTABLE).not.toContain('practice.owner');
    expect(GRANTABLE).not.toContain('any.authenticated');
    expect(GRANTABLE).not.toContain('staff.manage');
    expect(has('ADMIN', GRANTABLE).length).toBe(GRANTABLE.length);
  });
});
