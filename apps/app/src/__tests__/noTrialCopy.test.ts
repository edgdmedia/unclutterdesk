import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

/**
 * There is no trial (v2 spec §5.4): practices start on the free plan. A "start
 * your free trial" button left behind promises something the product doesn't
 * do, so trial phrases fail the build. Saying there is no trial is fine.
 */
const ROOTS = [resolve(__dirname, '..'), resolve(__dirname, '../../../landing/src')];
const PHRASES = [
  /(?<!\bno )free[- ]trial/i,
  /start (your )?(free )?trial/i,
  /14[- ]day(s)?( free)? trial/i,
  /trial (ends|runs)/i,
  /unlocked for 14 days/i,
  /days left in your trial/i,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' || name === '__tests__' ? [] : files(path);
    return /\.(tsx?|astro)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('no trial copy in the app or on the landing site', () => {
  it('finds no trial phrases', () => {
    const offenders = ROOTS.flatMap(files).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => PHRASES.some((p) => p.test(line)))
        .map(({ i }) => `${relative(resolve(__dirname, '../../..'), file)}:${i + 1}`),
    );
    expect(offenders).toEqual([]);
  });

  it.each(['Start your free 14-day trial', 'Start Free 14-Day Trial', 'Start free trial', 'Everything is unlocked for 14 days'])(
    'would catch %j',
    (copy) => expect(PHRASES.some((p) => p.test(copy))).toBe(true),
  );

  it.each(['There is no time-limited trial.', 'There is no free trial of the paid plans.', 'keep it for 14 days on the server'])(
    'lets %j through',
    (copy) => expect(PHRASES.some((p) => p.test(copy))).toBe(false),
  );
});
