import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@unclutterdesk/ui';

/*
 * index.css switches the muted text tokens to light values inside dark
 * grounds. Each value must stay readable on every ground it is set for.
 */
const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../../../packages/ui/src/tokens/colors.css'), 'utf8');
const hexOf = (name: string) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))![1];

function scope(firstSelector: string): { grounds: string[]; values: string[] } {
  const start = css.indexOf(firstSelector);
  const block = css.slice(start, css.indexOf('}', start));
  const grounds = [...block.matchAll(/bg-\[var\(--([a-z0-9-]+)\)\]/g)].map((m) => hexOf(m[1]));
  const values = [...block.matchAll(/--desk-text-[a-z]+:\s*(#[0-9A-Fa-f]{6})/g)].map((m) => m[1]);
  return { grounds, values };
}

describe('text tokens on dark grounds', () => {
  it.each([['[class~="bg-[var(--desk-sidebar)]"]'], ['[class~="bg-[var(--desk-pine-600)]"]']])('stay at 4.5:1 or better (%s)', (first) => {
    const { grounds, values } = scope(first);
    expect(grounds.length).toBeGreaterThan(0);
    expect(values).toHaveLength(3);
    for (const ground of grounds) for (const value of values) expect(contrastRatio(value, ground), `${value} on ${ground}`).toBeGreaterThanOrEqual(4.5);
  });
});
