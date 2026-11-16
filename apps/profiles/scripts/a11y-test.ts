/**
 * Accessibility test runner for apps/profiles.
 * Runs axe-core against home, pricing, and sample profiles.
 * Fails if accessibility score < 95 or serious/critical violations found.
 */
import { chromium, type Browser, type Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServer, type Server } from 'http';
import { getFixtureProfile, getAllFixtureHandles } from './fixture-api';
import type { PublicProfile } from '../src/lib/profiles';

const PORT = 4321;
const API_PORT = 4322;
const BASE_URL = `http://localhost:${PORT}`;

// Sample a subset of profiles to test (one per layout, different themes)
const SAMPLE_PROFILES = [
  'classic-calm',
  'editorial-warm',
  'compact-crisp',
  'split-earth',
  'classic-night',
];

interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary?: string;
  }>;
}

interface AxeResults {
  violations: AxeViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
}

async function runAxe(page: Page, url: string): Promise<AxeResults> {
  await page.goto(url, { waitUntil: 'networkidle' });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  
  return {
    violations: results.violations as AxeViolation[],
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    inapplicable: results.inapplicable.length,
  };
}

function calculateScore(results: AxeResults): number {
  const total = results.passes + results.violations.length;
  if (total === 0) return 100;
  // Weight violations by impact
  const weightedViolations = results.violations.reduce((sum, v) => {
    const weight = v.impact === 'critical' ? 4 : v.impact === 'serious' ? 3 : v.impact === 'moderate' ? 2 : 1;
    return sum + v.nodes.length * weight;
  }, 0);
  const score = Math.max(0, 100 - (weightedViolations / total) * 100);
  return Math.round(score);
}

async function startFixtureApi(): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${API_PORT}`);
      
      // Handle profile requests
      if (url.pathname.startsWith('/v1/profiles/')) {
        const handle = url.pathname.split('/').pop();
        if (handle && handle !== 'sitemap') {
          const profile = getFixtureProfile(handle);
          if (profile) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ profile }));
            return;
          }
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }
      
      // Handle sitemap
      if (url.pathname === '/v1/profiles/sitemap') {
        const handles = getAllFixtureHandles();
        const sitemap = handles.map((handle) => ({
          handle,
          updatedAt: new Date().toISOString(),
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sitemap));
        return;
      }
      
      res.writeHead(404);
      res.end('Not found');
    });
    
    server.listen(API_PORT, () => resolve(server));
  });
}

async function startProfilesApp(): Promise<Server> {
  // Import the built app
  const { createServer: createAstroServer } = await import('../dist/server/entry.mjs');
  const app = await createAstroServer();
  
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      app.handle(req, res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function main() {
  console.log('🔍 Starting accessibility tests for apps/profiles\n');
  
  // Start fixture API
  console.log('📡 Starting fixture API server...');
  const apiServer = await startFixtureApi();
  console.log(`✓ Fixture API running on port ${API_PORT}`);
  
  // Build and start profiles app
  console.log('\n🔨 Building profiles app...');
  const { execSync } = await import('child_process');
  execSync('pnpm build', {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      API_URL: `http://localhost:${API_PORT}`,
      PROFILE_PUBLIC_URL: BASE_URL,
      APP_URL: 'https://app.unclutterdesk.com',
      MARKETING_URL: 'https://unclutterdesk.com',
      NODE_ENV: 'production',
    },
  });
  
  console.log('\n🚀 Starting profiles app...');
  const appServer = await startProfilesApp();
  console.log(`✓ Profiles app running on port ${PORT}`);
  
  // Start browser
  console.log('\n🌐 Starting browser...');
  const browser: Browser = await chromium.launch();
  const page: Page = await browser.newPage();
  
  const results: Array<{
    url: string;
    score: number;
    violations: number;
    serious: number;
    critical: number;
  }> = [];
  
  // Test home page
  console.log('\n📄 Testing home page...');
  const homeResults = await runAxe(page, BASE_URL);
  const homeScore = calculateScore(homeResults);
  results.push({
    url: '/',
    score: homeScore,
    violations: homeResults.violations.length,
    serious: homeResults.violations.filter((v) => v.impact === 'serious').length,
    critical: homeResults.violations.filter((v) => v.impact === 'critical').length,
  });
  console.log(`  Score: ${homeScore}/100 | Violations: ${homeResults.violations.length}`);
  
  // Test pricing page
  console.log('\n💰 Testing pricing page...');
  const pricingResults = await runAxe(page, `${BASE_URL}/pricing`);
  const pricingScore = calculateScore(pricingResults);
  results.push({
    url: '/pricing',
    score: pricingScore,
    violations: pricingResults.violations.length,
    serious: pricingResults.violations.filter((v) => v.impact === 'serious').length,
    critical: pricingResults.violations.filter((v) => v.impact === 'critical').length,
  });
  console.log(`  Score: ${pricingScore}/100 | Violations: ${pricingResults.violations.length}`);
  
  // Test sample profiles
  console.log('\n👤 Testing sample profiles...');
  for (const handle of SAMPLE_PROFILES) {
    const profileResults = await runAxe(page, `${BASE_URL}/${handle}`);
    const profileScore = calculateScore(profileResults);
    results.push({
      url: `/${handle}`,
      score: profileScore,
      violations: profileResults.violations.length,
      serious: profileResults.violations.filter((v) => v.impact === 'serious').length,
      critical: profileResults.violations.filter((v) => v.impact === 'critical').length,
    });
    console.log(`  ${handle}: ${profileScore}/100 | Violations: ${profileResults.violations.length}`);
  }
  
  // Cleanup
  await browser.close();
  await new Promise<void>((resolve) => appServer.close(() => resolve()));
  await new Promise<void>((resolve) => apiServer.close(() => resolve()));
  
  // Report results
  console.log('\n📊 Accessibility Test Results\n');
  console.log('URL'.padEnd(30) + 'Score'.padEnd(10) + 'Violations'.padEnd(12) + 'Serious'.padEnd(10) + 'Critical');
  console.log('─'.repeat(80));
  for (const r of results) {
    console.log(
      r.url.padEnd(30) +
      `${r.score}/100`.padEnd(10) +
      String(r.violations).padEnd(12) +
      String(r.serious).padEnd(10) +
      String(r.critical)
    );
  }
  
  // Check for failures
  const avgScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
  const hasSeriousOrCritical = results.some((r) => r.serious > 0 || r.critical > 0);
  const belowThreshold = avgScore < 95;
  
  console.log('\n' + '─'.repeat(80));
  console.log(`Average score: ${avgScore}/100`);
  
  if (belowThreshold || hasSeriousOrCritical) {
    console.log('\n❌ Accessibility tests FAILED');
    if (belowThreshold) {
      console.log(`   Average score ${avgScore} is below threshold of 95`);
    }
    if (hasSeriousOrCritical) {
      console.log('   Serious or critical violations found');
    }
    process.exit(1);
  }
  
  console.log('\n✅ All accessibility tests passed');
  process.exit(0);
}

main().catch((error) => {
  console.error('Error running accessibility tests:', error);
  process.exit(1);
});
