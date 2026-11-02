/**
 * Gives Olalekan's own practice a complimentary plan with no end date
 * (spec §5.4). Run once, right after the deploy that adds complimentaryReason:
 *
 *   pnpm tsx scripts/set-internal-tenant.ts --tenant <id> --tier <STARTER|PRO|CLINIC>
 *
 * Refuses an unknown tenant. Safe to run twice. Prints what it changed; later
 * changes go through the admin "Complimentary plans" screen.
 */
import { PrismaClient } from '@prisma/client';
import { setInternalTenant } from '../apps/api/src/modules/billing/internal-tenant';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const tenant = arg('tenant');
  const tier = (arg('tier') || '').toUpperCase();
  if (!tenant || !/^\d+$/.test(tenant) || !tier) {
    console.error('Usage: pnpm tsx scripts/set-internal-tenant.ts --tenant <id> --tier <STARTER|PRO|CLINIC>');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const result = await setInternalTenant(prisma, BigInt(tenant), tier);
    console.log(JSON.stringify({ tenant, ...result }, null, 2));
    console.log(result.changed ? 'Updated.' : 'Already set; nothing changed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
