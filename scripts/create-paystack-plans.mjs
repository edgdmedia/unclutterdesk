#!/usr/bin/env node
/**
 * Creates the three platform subscription plans in Paystack and prints the
 * environment lines to paste onto the host.
 *
 * Idempotent: it lists existing plans first and reuses any that already match
 * by name, so running it twice does not create duplicates.
 *
 * Amounts are read from apps/api/src/modules/billing/subscription-plans.ts
 * rather than repeated here. A plan created at the wrong price would charge
 * practices an amount the application never displays, and that mismatch would
 * be invisible until someone reconciled a statement.
 *
 *   node scripts/create-paystack-plans.mjs            # dry run, shows the plan
 *   node scripts/create-paystack-plans.mjs --create   # actually creates them
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

// ── Plan definitions, parsed from the application's source of truth ──────────
const plansSource = readFileSync(
  resolve(root, 'apps/api/src/modules/billing/subscription-plans.ts'),
  'utf8',
);

const TIERS = ['STARTER', 'PRO', 'CLINIC'];
const plans = TIERS.map((tier) => {
  const block = plansSource.match(new RegExp(`${tier}:\\s*\\{([\\s\\S]*?)\\}`));
  if (!block) fail(`Could not find the ${tier} plan in subscription-plans.ts`);

  const name = block[1].match(/name:\s*'([^']+)'/)?.[1];
  const amount = block[1].match(/amountKobo:\s*([\d_]+)/)?.[1];
  const envVar = block[1].match(/planCodeEnv:\s*'([^']+)'/)?.[1];

  if (!name || !amount || !envVar) {
    fail(`Could not parse the ${tier} plan. Has subscription-plans.ts changed shape?`);
  }
  return {
    tier,
    // Namespaced so these are recognisable next to any other plans in the account.
    paystackName: `Unclutter Desk ${name}`,
    amountKobo: Number(amount.replace(/_/g, '')),
    envVar,
  };
});

// ── Secret key ───────────────────────────────────────────────────────────────
let secret = process.env.PAYSTACK_SECRET_KEY;
if (!secret) {
  try {
    const env = readFileSync(resolve(root, '.env'), 'utf8');
    secret = env.match(/^\s*PAYSTACK_SECRET_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
  } catch {
    /* no .env — fall through */
  }
}
if (!secret) fail('PAYSTACK_SECRET_KEY is not set (checked the environment and .env).');

const isLiveKey = secret.startsWith('sk_live_');
const create = process.argv.includes('--create');

console.log('\nUnclutter Desk — Paystack subscription plans');
console.log(`Key: ${isLiveKey ? 'LIVE' : 'test'} (sk_${isLiveKey ? 'live' : 'test'}_…)\n`);

for (const p of plans) {
  console.log(`  ${p.paystackName.padEnd(28)} ₦${(p.amountKobo / 100).toLocaleString('en-NG')}/month  → ${p.envVar}`);
}

if (!create) {
  console.log('\nDry run. Nothing was created.');
  console.log('Re-run with --create to create these in Paystack.\n');
  process.exit(0);
}

// ── Paystack API ─────────────────────────────────────────────────────────────
async function paystack(method, path, body) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.status) {
    fail(`Paystack ${method} ${path} failed: ${payload?.message || response.status}`);
  }
  return payload.data;
}

console.log('\nChecking for existing plans…');
const existing = await paystack('GET', '/plan?perPage=200');
const byName = new Map(existing.map((plan) => [plan.name, plan]));

const results = [];
for (const p of plans) {
  const found = byName.get(p.paystackName);

  if (found) {
    if (found.amount !== p.amountKobo) {
      // Paystack does not let an existing plan's amount change silently, and
      // reusing a mispriced plan would charge the wrong figure indefinitely.
      fail(
        `"${p.paystackName}" already exists at ₦${found.amount / 100} but the app charges ` +
          `₦${p.amountKobo / 100}. Reconcile them in the dashboard before continuing.`,
      );
    }
    console.log(`  = ${p.paystackName} already exists`);
    results.push({ ...p, code: found.plan_code });
    continue;
  }

  const created = await paystack('POST', '/plan', {
    name: p.paystackName,
    interval: 'monthly',
    amount: p.amountKobo,
    currency: 'NGN',
  });
  console.log(`  + ${p.paystackName} created`);
  results.push({ ...p, code: created.plan_code });
}

console.log('\nAdd these to the API environment:\n');
for (const r of results) console.log(`${r.envVar}=${r.code}`);
console.log(
  `\nThen restart the API. ${isLiveKey ? '' : 'These are TEST plans — re-run with the live key for production.'}\n`,
);
