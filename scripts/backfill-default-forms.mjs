// BKG-06 / FRM-04: give every existing practice the default forms it lacks.
// Runs the API's own DefaultFormsService.ensureFor, so the forms and the rules
// (never overwrite an edited form; no duplicate review or feedback form) live
// in one place. Idempotent: safe to run again.
//
// Needs the API built (apps/api/dist) and DATABASE_URL set, e.g. from the repo root:
//   node --env-file=.env scripts/backfill-default-forms.mjs
import { createRequire } from 'node:module';

// Resolve packages the way the API does (pnpm keeps them under apps/api).
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('reflect-metadata');
const { PrismaClient } = require('@prisma/client');
const { DefaultFormsService } = require('./dist/src/modules/intake/default-forms.service.js');

const prisma = new PrismaClient();
const service = new DefaultFormsService(prisma);
const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
let created = 0;
for (const tenant of tenants) {
  const before = await prisma.universalForm.count({ where: { tenantId: tenant.id, systemKey: { not: null } } });
  await service.ensureFor(tenant.id);
  const after = await prisma.universalForm.count({ where: { tenantId: tenant.id, systemKey: { not: null } } });
  if (after > before) console.log(`${tenant.slug}: + ${after - before} form(s)`);
  created += after - before;
}
console.log(`Done. ${tenants.length} practices checked, ${created} forms created.`);
await prisma.$disconnect();
