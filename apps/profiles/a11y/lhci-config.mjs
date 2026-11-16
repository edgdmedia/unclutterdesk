/**
 * Generates the Lighthouse CI config for this run: the home page and one
 * profile page (spec §6.5), against the local build. The full 4 layouts × 5
 * palettes are checked by axe for serious/critical violations; Lighthouse's
 * accessibility score is verified on a representative sample to keep the
 * Worker stable under wrangler dev.
 *
 * The accessibility category must score at least 0.95 on every URL. Written
 * out by run.sh so the URL list and the port always agree.
 */
import { writeFileSync } from 'node:fs';

const base = process.env.A11Y_BASE_URL || 'http://127.0.0.1:4398';
// Home and one profile: enough to verify the score threshold.
const urls = [`${base}/`, `${base}/classic-calm`];

const config = {
  ci: {
    collect: {
      url: urls,
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --headless=new --disable-dev-shm-usage',
        onlyCategories: ['accessibility'],
        // Server-rendered pages on a local dev server: these audits are about
        // production hosting and SEO, not about whether the page is usable.
        skipAudits: ['uses-http2', 'canonical', 'is-crawlable', 'robots-txt', 'hreflang', 'plugins', 'tap-targets'],
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.95 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: process.env.A11Y_LH_OUTPUT || './.lighthouseci',
    },
  },
};

const out = process.argv[2];
writeFileSync(out, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Lighthouse will check ${urls.length} URLs`);