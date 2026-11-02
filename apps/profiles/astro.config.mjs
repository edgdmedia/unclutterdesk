// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Server-rendered on a Cloudflare Worker with static assets (spec §4.2).
// No client framework and no client scripts: pages are readable without JS.
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  // The CSP allows styles only from this origin (§4.3 #3), so CSS is always a file.
  build: { inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
});
