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

// Load .env the way the API does.
//
// apps/api/src/env.ts tries the repo root first, then apps/api/.env, and dotenv
// does not overwrite a value it has already set — so the root file wins. And
// deploy.sh copies apps/api/.env to the root only when the root file is absent,
// so the two drift apart silently. Editing the wrong one changes nothing.
const ENV_CANDIDATES = ['.env', 'apps/api/.env'];

function parseEnvFile(relPath) {
  try {
    const raw = readFileSync(resolve(root, relPath), 'utf8');
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return null;
  }
}

const envFiles = ENV_CANDIDATES.map((p) => ({ path: p, values: parseEnvFile(p) })).filter(
  (f) => f.values,
);

const env = { ...process.env };
for (const file of envFiles) {
  for (const [k, v] of Object.entries(file.values)) if (!env[k]) env[k] = v;
}

if (envFiles.length === 0) {
  warn('.env', 'none found — relying on the process environment alone');
} else {
  pass('Env file', `${envFiles[0].path} (loaded first, so it wins)`);
}

// A second file whose values disagree is the likeliest reason a change appears
// to have no effect.
if (envFiles.length > 1) {
  const [primary, ...rest] = envFiles;
  const conflicts = [];
  for (const other of rest) {
    for (const [k, v] of Object.entries(other.values)) {
      if (primary.values[k] !== undefined && primary.values[k] !== v) conflicts.push(k);
      if (primary.values[k] === undefined) conflicts.push(`${k} (only in ${other.path})`);
    }
  }
  conflicts.length
    ? failed(
        'Conflicting env files',
        `${primary.path} and ${rest.map((r) => r.path).join(', ')} disagree on: ` +
          `${[...new Set(conflicts)].join(', ')}. ${primary.path} is the one that takes effect.`,
      )
    : warn('Multiple env files', `${envFiles.map((f) => f.path).join(', ')} — values agree`);
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

/**
 * Prisma accepts connection-string parameters libpq rejects outright — a URL
 * ending `?schema=public` makes pg_dump fail with "invalid URI query
 * parameter", writing a zero-byte file. Strip those and surface any schema as a
 * flag instead. Mirrors libpq_url()/pg_schema_of() in deploy.sh.
 */
const PRISMA_ONLY_PARAMS = new Set([
  'schema', 'connection_limit', 'pool_timeout', 'pgbouncer',
  'socket_timeout', 'statement_cache_size', 'sslidentity', 'sslpassword',
]);

function libpqUrl(raw) {
  const q = raw.indexOf('?');
  if (q === -1) return { url: raw, schema: undefined };
  const base = raw.slice(0, q);
  const kept = [];
  let schema;
  for (const pair of raw.slice(q + 1).split('&')) {
    if (!pair) continue;
    const key = pair.split('=')[0];
    if (key === 'schema') schema = pair.slice(pair.indexOf('=') + 1);
    if (!PRISMA_ONLY_PARAMS.has(key)) kept.push(pair);
  }
  return { url: kept.length ? `${base}?${kept.join('&')}` : base, schema };
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
  // Can a backup actually be taken? deploy.sh refuses to change a schema
  // without one, so a URL pg_dump cannot parse blocks the whole deploy.
  const { url: pgUrl, schema: pgSchema } = libpqUrl(env.DATABASE_URL);
  try {
    sh('pg_dump', [
      '--schema-only', '--no-owner', '--no-acl',
      ...(pgSchema ? [`--schema=${pgSchema}`] : []),
      '--file=/dev/null', pgUrl,
    ]);
    pass('Backup connectivity', 'pg_dump can read the database');
  } catch (e) {
    const msg = String(e.stderr || e.message).trim().split('\n')[0];
    failed('Backup connectivity', `pg_dump failed: ${msg}`);
  }

  // Migration state first: it decides how to read the drift check below.
  //
  // The distinction that matters is whether 0_init is still pending. Applying
  // it to a populated database fails on CREATE TABLE, so reporting a vague
  // "migrations pending" would hide the one case that breaks the deploy.
  let baselined = false;
  const readStatus = () => {
    try {
      return sh('npx', ['prisma', 'migrate', 'status'], { env: { ...process.env, ...env } });
    } catch (e) {
      return String(e.stdout || '') + String(e.stderr || '');
    }
  };

  const status = readStatus();
  const pending = [...status.matchAll(/^\s*[-•]?\s*(\d{1,14}_[a-z0-9_]+)\s*$/gim)].map((m) => m[1]);
  const initPending = pending.some((name) => name.startsWith('0_init')) || /\b0_init\b/.test(
    status.split(/have not yet been applied/i)[1] ?? '',
  );

  if (/P3005|database schema is not empty/i.test(status)) {
    failed(
      'Migration state',
      'not baselined — run `npx prisma migrate resolve --applied 0_init` ' +
        'before deploying, or migrate deploy will fail on CREATE TABLE',
    );
  } else if (initPending) {
    failed(
      'Migration state',
      '0_init is still pending — applying it to a populated database fails. ' +
        'Run `npx prisma migrate resolve --applied 0_init` first',
    );
  } else if (/up to date/i.test(status)) {
    baselined = true;
    pass('Migration state', 'baselined, nothing pending');
  } else if (pending.length > 0) {
    baselined = true;
    warn('Migration state', `baselined; ${pending.length} pending: ${pending.join(', ')}`);
  } else {
    warn('Migration state', status.trim().split('\n').filter(Boolean).slice(-1)[0] || 'could not read');
  }

  // Drift matters only until the baseline exists. Once it does, migrations are
  // *expected* to differ from the live schema — that is what applying them
  // fixes — so treating that as a failure would block every future deploy.
  try {
    const diff = sh(
      'npx',
      ['prisma', 'migrate', 'diff', '--from-url', env.DATABASE_URL,
       '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
      { env: { ...process.env, ...env } },
    );

    if (/empty migration/i.test(diff)) {
      pass('Schema drift', 'live database matches schema.prisma');
    } else {
      const destructive = /DROP\s+(TABLE|COLUMN)/i.test(diff);
      const lines = diff.split('\n').filter((l) => l.trim() && !l.startsWith('--')).length;
      const detail =
        `${lines} statement(s) differ${destructive ? ', INCLUDING DROPs' : ''}`;

      if (baselined) {
        warn('Schema drift', `${detail} — expected if migrations are pending`);
      } else {
        failed(
          'Schema drift',
          `${detail}. Baselining a drifted database records a history that lies ` +
            'about the live state — see docs/DATABASE_MIGRATION_RUNBOOK.md',
        );
      }
    }
  } catch (e) {
    failed('Schema drift', `could not compare: ${String(e.stderr || e.message).trim().split('\n')[0]}`);
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
