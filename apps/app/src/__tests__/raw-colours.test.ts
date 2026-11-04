import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The dashboard reads its colours from the shared tokens (packages/ui/src/tokens),
 * never from a hex typed into a class name (dashboard-tokens plan, 3b). The
 * sweep script is the one place that knows the mapping; in --check mode it
 * changes nothing and exits 1 if any `text-[#…]`-style class is left.
 * Fix a failure with: node apps/app/scripts/hex-to-tokens.mjs
 */
describe('raw colours in class names', () => {
  it('are all tokens', () => {
    const script = resolve(__dirname, '../../scripts/hex-to-tokens.mjs');
    let output = '';
    try {
      output = execFileSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
    } catch (error) {
      output = String((error as { stdout?: string }).stdout ?? error);
      expect.fail(`Raw colours left in apps/app/src:\n${output}`);
    }
    expect(output).toContain('0 raw colour classes');
  });
});
