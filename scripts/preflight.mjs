#!/usr/bin/env node
/**
 * Pre-deploy checks, run on the production host before merging to main.
 *
 * Read-only: it inspects, counts and reports. It creates nothing, changes
 * nothing, and deletes nothing, so it is safe to run at any time.
 *
 *   node scripts/preflight.mjs
 *   node scripts/preflight.mjs --skip-db   # environment checks only
 *
 * Exits non-zero if any blocking check fails.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skipDb = process.argv.includes('--skip-db');

const results = [];
const pass = (name, detail = '') => results.push({ level: 'pass', name, detail });
const warn = (name, detail) => results.push({ level: 'warn', name, detail });
const failed = (name, detail) => results.push({ level: 'fail', name, detail });

// Load .env without exporting it, so the checks see what the API will see.
const env = { ...process.env };
try {
  for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {
  warn('.env', 'not found — relying on the process environment alone');
}

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', ...opts });

// ── 1. Tooling ───────────────────────────────────────────────────────────────
const major = Number(process.versions.node.split('.')[0]);
major >= 20
  ? pass('Node version', `v${process.versions.node}`)
  : failed('Node version', `v${process.versions.node}; the API requires >= 20`);

try {
  const v = sh('pg_dump', ['--version']).trim();
  pass('pg_dump present', v);
} catch {
  failed('pg_dump present', 'not on PATH — deploy.sh aborts rather than deploy without a backup');
}

// ── 2. Required configuration ────────────────────────────────────────────────
for (const key of ['DATABASE_URL', 'JWT_SECRET', 'REFRESH_SECRET']) {
  env[key] ? pass(`${key} set`) : failed(`${key} set`, 'missing');
}

env.NODE_ENV === 'production'
  ? pass('NODE_ENV', 'production')
  : warn('NODE_ENV', `is "${env.NODE_ENV ?? 'unset'}" — cookies are only Secure in production`);

env.CORS_ORIGINS
  ? pass('CORS_ORIGINS set', env.CORS_ORIGINS)
  : warn('CORS_ORIGINS', 'unset — only *.unclutterdesk.com origins will be allowed');

// Stripe was removed; a lingering key means a stale environment.
const stripeLeftovers = Object.keys(env).filter((k) => k.startsWith('STRIPE_'));
stripeLeftovers.length === 0
  ? pass('No Stripe config', 'integration removed')
  : warn('Stripe config present', `${stripeLeftovers.join(', ')} — safe to delete`);

for (const key of ['PAYSTACK_SECRET_KEY', 'PAYSTACK_PLAN_STARTER', 'PAYSTACK_PLAN_PRO', 'PAYSTACK_PLAN_CLINIC']) {
  env[key] ? pass(`${key} set`) : failed(`${key} set`, 'missing — subscriptions return 503 without it');
}

if (env.PAYSTACK_SECRET_KEY?.startsWith('sk_test_')) {
  warn('Paystack key mode', 'test key — live plan codes will not resolve against it');
}

// ── 3. Database ──────────────────────────────────────────────────────────────
if (skipDb) {
  warn('Database checks', 'skipped (--skip-db)');
} else if (!env.DATABASE_URL) {
  failed('Database checks', 'skipped — DATABASE_URL is not set');
} else {
  // Drift: the live schema must match schema.prisma before baselining.
  try {
    const diff = sh(
      'npx',
      ['prisma', 'migrate', 'diff', '--from-url', env.DATABASE_URL,
       '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
      { env: { ...process.env, ...env } },
    );
    const empty = /empty migration/i.test(diff);
    if (empty) {
      pass('Schema drift', 'live database matches schema.prisma');
    } else {
      const destructive = /DROP\s+(TABLE|COLUMN)/i.test(diff);
      const lines = diff.split('\n').filter((l) => l.trim() && !l.startsWith('--')).length;
      failed(
        'Schema drift',
        `${lines} statement(s) differ${destructive ? ', INCLUDING DROPs — data loss risk' : ''}. ` +
          'Reconcile before baselining; see docs/DATABASE_MIGRATION_RUNBOOK.md',
      );
    }
  } catch (e) {
    failed('Schema drift', `could not compare: ${String(e.stderr || e.message).trim().split('\n')[0]}`);
  }

  // Migration baseline state.
  try {
    const status = sh('npx', ['prisma', 'migrate', 'status'], {
      env: { ...process.env, ...env },
    });
    /up to date/i.test(status)
      ? pass('Migration state', 'baseline applied')
      : warn('Migration state', 'not baselined yet — run migrate resolve --applied 0_init');
  } catch (e) {
    const out = String(e.stdout || e.stderr || '');
    /not yet been applied|following migration/i.test(out)
      ? warn('Migration state', 'pending migrations — expected before the first deploy')
      : warn('Migration state', out.trim().split('\n')[0] || 'could not read');
  }

  // Seeded demo account must not exist in production.
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
    try {
      const demo = await prisma.user.count({ where: { email: 'dr.jane@smiththerapy.ng' } });
      const demoProfiles = await prisma.profile.count({
        where: { email: { contains: 'smiththerapy.ng' } },
      });
      demo === 0 && demoProfiles === 0
        ? pass('Seed data absent', 'no demo account in production')
        : failed('Seed data present', `${demo} user(s), ${demoProfiles} profile(s) — delete before launch`);

      const tenants = await prisma.tenant.count();
      pass('Tenants in database', String(tenants));
    } finally {
      await prisma.$disconnect();
    }
  } catch (e) {
    warn('Seed data check', `could not query: ${String(e.message).trim().split('\n')[0]}`);
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const icon = { pass: '✓', warn: '!', fail: '✗' };
console.log('\nUnclutter Desk — pre-deploy checks\n');
for (const r of results) {
  console.log(`  ${icon[r.level]} ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
}

const fails = results.filter((r) => r.level === 'fail').length;
const warns = results.filter((r) => r.level === 'warn').length;
console.log(
  `\n${fails} blocking, ${warns} advisory.` +
    (fails === 0 ? ' Safe to proceed.\n' : ' Resolve the blocking items first.\n'),
);
process.exit(fails === 0 ? 0 : 1);
