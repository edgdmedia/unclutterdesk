import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Spec §0 rule 7 and §4.1a: no production domain is spelled out anywhere in
 * the repository except the domain config of each app and the files listed
 * below. The platform moves to new domains before launch (§4.1b); with every
 * address behind a setting, that move is a change of settings.
 *
 * Reads files as text (git ls-files), so it imports nothing from outside the
 * API (build-layout.spec.ts). It lives here because the API's tests run in
 * every deploy workflow.
 */
const REPO = resolve(__dirname, '../../..');

/** Today's domain and the target domains (§4.1b). */
const DOMAIN = /unclutterdesk\.com|therapysts\.(?:com|app)/i;

/** Each app's one domain config: where the defaults live. */
const CONFIG_FILES = [
  'apps/api/src/common/origins.ts',
  'apps/app/src/config/domains.ts',
  'apps/landing/src/config/domains.ts',
  'apps/profiles/src/lib/config.ts',
  'apps/landing/astro.config.mjs', // `site`, the same setting as the landing config
  'packages/ui/src/tokens/brand-slots.css', // design-specimen defaults, not used by the apps
];

/**
 * Deployment config that can't read a setting: changed by hand at the move
 * (each says so in a comment).
 */
const DEPLOYMENT_FILES = [
  'apps/tenant-router/wrangler.jsonc', // the Worker's route and vars
  'apps/profiles/wrangler.jsonc', // the profiles Worker's vars (spec §0 rule 7)
  'apps/app/public/_headers', // static CSP connect-src
  /^deploy\/nginx\//, // server_name and certificate paths
];

/** Not shipped code: records, examples and fixtures. */
const NOT_SHIPPED = [
  /^docs\//,
  /\.md$/,
  /\.(env|dev\.vars)\.example$/, // documents each setting's default
  /(^|\/)scripts\//, // operator scripts; their defaults are usage examples
  /^prisma\/migrations\//, // applied history, never edited
  'prisma/seed.js', // local seed accounts
  /\.(spec|test)\.tsx?$/, // test fixtures (§4.1a, Q-2-5): defaults change with the config at the move
  /(^|\/)__tests__\//,
  /^e2e\//,
  'pnpm-lock.yaml',
  // The Therapysts design system's tokens, copied unchanged; the domain appears
  // only in sample captions ("therapysts.com/yourname"), never as an address.
  'packages/ui/src/brand/therapysts/tokens.json',
];

const EXEMPT = [...CONFIG_FILES, ...DEPLOYMENT_FILES, ...NOT_SHIPPED];

const exempt = (file: string) => EXEMPT.some((rule) => (typeof rule === 'string' ? rule === file : rule.test(file)));

function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z'], { cwd: REPO, encoding: 'utf8' }).split('\0').filter(Boolean);
}

const BINARY = /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|otf|pdf|zip|gz|mp4|webm|mp3)$/i;

describe('production domains', () => {
  it('are spelled out only in the domain config and the listed exceptions', () => {
    const offenders = trackedFiles()
      .filter((file) => !exempt(file) && !BINARY.test(file))
      .flatMap((file) => {
        let text: string;
        try {
          text = readFileSync(join(REPO, file), 'utf8');
        } catch {
          return []; // deleted in the working tree
        }
        return text
          .split('\n')
          .map((line, i) => (DOMAIN.test(line) ? `${file}:${i + 1}` : null))
          .filter((hit): hit is string => hit !== null);
      });
    expect(offenders).toEqual([]);
  });

  it('keep each config file in place, so the exceptions stay honest', () => {
    const tracked = new Set(trackedFiles());
    for (const file of [...CONFIG_FILES, 'apps/tenant-router/wrangler.jsonc', 'apps/app/public/_headers']) {
      expect(tracked.has(file), `${file} is listed as an exception but does not exist`).toBe(true);
    }
  });
});
