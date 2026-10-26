import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { verificationCode } from './auth.service';

describe('email verification codes (§5.2)', () => {
  it('are six digits, zero-padded', () => {
    for (let i = 0; i < 200; i++) expect(verificationCode()).toMatch(/^\d{6}$/);
  });

  it('cover the whole range, including codes below 100000 (the old generator never made them)', () => {
    const codes = Array.from({ length: 2000 }, verificationCode);
    expect(codes.some((c) => c.startsWith('0'))).toBe(true);
  });

  it('nothing in the API uses Math.random() (codes and tokens come from crypto)', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? files(p) : n.endsWith('.ts') && !n.endsWith('.spec.ts') ? [p] : [];
      });
    const code = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    const offenders = files(join(__dirname, '..', '..')).filter((f) => /Math\.random\(/.test(code(readFileSync(f, 'utf8'))));
    expect(offenders).toEqual([]);
  });
});
