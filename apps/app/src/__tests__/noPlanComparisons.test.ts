import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

/**
 * Spec §5.1: the app gates features from the entitlements responses, never by
 * comparing plan names, or a plan rename or a new plan silently breaks a gate.
 * Plan names may appear as labels and in types; comparisons fail the build.
 */
const SRC = resolve(__dirname, '..');
const PLAN = '(FREE|STARTER|PRO|CLINIC|free|starter|pro|clinic)';
const PATTERNS = [
  new RegExp(`['"\`]${PLAN}['"\`]\\s*[!=]==?`),
  new RegExp(`(tier|plan|Tier|Plan)\\w*\\)?\\s*[!=]==?\\s*['"\`]${PLAN}['"\`]`),
  new RegExp(`case\\s+['"\`]${PLAN}['"\`]\\s*:`),
  new RegExp(`\\.includes\\(\\s*['"\`]${PLAN}['"\`]\\s*\\)`),
  /PLAN_RANK|planIncludes/,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return ['__tests__', 'test'].includes(name) ? [] : files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('no plan-name comparisons in the app', () => {
  it('finds none', () => {
    const offenders = files(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .filter(({ line }) => PATTERNS.some((p) => p.test(line)))
        .map(({ line, i }) => `${relative(SRC, file)}:${i + 1}: ${line.trim()}`),
    );
    expect(offenders, 'read the entitlements response (utils/entitlements.ts) instead').toEqual([]);
  });

  it.each([
    "if (plan === 'STARTER' && x) {",
    "{subscription?.subscriptionTier === 'FREE' && entitlements ? (",
    "return tier === 'CLINIC' ? 'Clinic' : 'Pro';",
    "case 'PRO':",
    "['PRO', 'CLINIC'].includes('PRO')",
    "const PLAN_RANK = { starter: 0 };",
  ])('would catch %j', (line) => {
    expect(PATTERNS.some((p) => p.test(line))).toBe(true);
  });

  it.each(["STARTER: 'Starter',", "const PAID: Tier[] = ['STARTER', 'PRO', 'CLINIC'];", "if (plan === subscription.subscriptionTier) return null;"])(
    'lets %j through (a label, a list, or comparing two values)',
    (line) => {
      expect(PATTERNS.some((p) => p.test(line))).toBe(false);
    },
  );
});
