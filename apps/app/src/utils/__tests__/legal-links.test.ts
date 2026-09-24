import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGAL_PATHS, LEGAL_URLS } from '../legal';

/**
 * The legal documents have to be reachable from the place people accept them.
 *
 * The signup checkbox linked to /terms-of-service and /privacy-policy. Neither
 * path existed in either app, so both 404'd — someone accepting clinical
 * liability could not open the documents they were accepting. Separately, the
 * app kept its own 30-line privacy policy that named a company called
 * "Unclutter OS" and never mentioned the NDPA, so whoever signed up in the app
 * agreed to a materially weaker document than the one on the marketing site.
 *
 * These tests fail the build if either comes back.
 */
const APP = resolve(__dirname, '../..');
const LANDING_PAGES = resolve(__dirname, '../../../../landing/src/pages');

function read(relative: string): string {
  return readFileSync(resolve(APP, relative), 'utf8');
}

/** Every href and `to=` target in a file. */
function linkTargets(source: string): string[] {
  return [...source.matchAll(/(?:href|to)=(?:"([^"]+)"|\{([^}]+)\})/g)].map(
    (m) => (m[1] ?? m[2]).trim(),
  );
}

describe('the documents exist where we point people', () => {
  it.each(Object.entries(LEGAL_PATHS))('%s resolves to a real landing page', (_name, path) => {
    // The marketing site is an Astro app: /terms is pages/terms.astro.
    expect(existsSync(resolve(LANDING_PAGES, `${path.replace(/^\//, '')}.astro`))).toBe(true);
  });

  it('points at the marketing site, not at an app route', () => {
    for (const url of Object.values(LEGAL_URLS)) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });
});

describe('where consent is given', () => {
  const CONSENT_SCREENS = ['pages/auth/SignupPage.tsx', 'pages/auth/InvitePage.tsx'];

  // The exact paths that used to 404, and any sibling anyone might reach for.
  const DEAD_PATHS = [
    '/terms-of-service',
    '/privacy-policy',
    '/terms-and-conditions',
    '/legal/terms',
    '/legal/privacy',
  ];

  it.each(CONSENT_SCREENS)('%s links to no path that does not exist', (file) => {
    const targets = linkTargets(read(file));
    for (const dead of DEAD_PATHS) {
      expect(targets).not.toContain(dead);
    }
  });

  it.each(CONSENT_SCREENS)('%s reaches the documents through the shared constant', (file) => {
    const source = read(file);
    expect(source).toContain('LEGAL_URLS.terms');
    expect(source).toContain('LEGAL_URLS.privacy');
  });

  // A hardcoded URL is how the second copy started last time.
  it.each(CONSENT_SCREENS)('%s hardcodes no legal URL of its own', (file) => {
    expect(read(file)).not.toMatch(/unclutterdesk\.com\/(terms|privacy)/);
  });

  it('opens them without handing the new tab control of this one', () => {
    for (const file of CONSENT_SCREENS) {
      const source = read(file);
      const opened = [...source.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map((m) => m[0]);
      expect(opened.length).toBeGreaterThan(0);
      for (const anchor of opened) {
        expect(anchor).toMatch(/rel="noopener noreferrer"/);
      }
    }
  });
});

describe('the app keeps no second copy of the documents', () => {
  // Two versions drifted apart once already, which is how the app ended up
  // serving a policy with no NDPA, no controller/processor split, no retention
  // terms and no governing law.
  it.each(['pages/PrivacyPolicyPage.tsx', 'pages/TermsOfServicePage.tsx'])(
    '%s no longer exists',
    (file) => {
      expect(existsSync(resolve(APP, file))).toBe(false);
    },
  );

  it('has no page reintroducing the policy text', () => {
    const marker = 'We respect your privacy and are committed to protecting your personal data';
    const app = readFileSync(resolve(APP, 'App.tsx'), 'utf8');
    expect(app).not.toContain(marker);
  });
});

describe('the canonical documents', () => {
  const privacy = readFileSync(resolve(LANDING_PAGES, 'privacy.astro'), 'utf8');
  const terms = readFileSync(resolve(LANDING_PAGES, 'terms.astro'), 'utf8');

  // The clause that decides who answers to the regulator when records leak.
  it('separate who controls clinical data from who controls accounts', () => {
    expect(privacy).toMatch(/controller/i);
    expect(privacy).toMatch(/processor/i);
  });

  it('name the law they are written for', () => {
    expect(privacy).toContain('NDPA');
  });

  it('say which courts decide a dispute', () => {
    expect(terms).toMatch(/governing law/i);
  });

  it('do not name the old company', () => {
    expect(privacy).not.toMatch(/unclutterOS|Unclutter OS/);
    expect(terms).not.toMatch(/unclutterOS|Unclutter OS/);
  });
});
