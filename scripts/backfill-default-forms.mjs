// BKG-06: give every existing practice the default forms it lacks.
// Idempotent: an existing systemKey is never touched, edited wording included.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const intakeSrc = readFileSync(new URL('../apps/api/src/modules/intake/default-forms.ts', import.meta.url), 'utf8');
const grab = (name) => {
  const start = intakeSrc.indexOf(`export const ${name}`);
  const end = intakeSrc.indexOf('\n};', start) + 3;
  // eslint-disable-next-line no-eval
  return eval(`(${intakeSrc.slice(start, end).replace('export const ' + name + ': DefaultFormTemplate = ', '').replace(/;$/, '')})`);
};
const DEFAULT_FORMS = [grab('CLIENT_INTAKE'), grab('CONFIDENTIALITY')];

const prisma = new PrismaClient();
const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
let created = 0;
for (const tenant of tenants) {
  const existing = await prisma.universalForm.findMany({ where: { tenantId: tenant.id, systemKey: { in: DEFAULT_FORMS.map((f) => f.systemKey) } }, select: { systemKey: true } });
  const have = new Set(existing.map((e) => e.systemKey));
  for (const form of DEFAULT_FORMS) {
    if (have.has(form.systemKey)) continue;
    await prisma.universalForm.create({ data: { tenantId: tenant.id, title: form.title, description: form.description, targetType: form.targetType, systemKey: form.systemKey, schemaJson: form.schemaJson, isDefault: true } });
    created += 1;
    console.log(`${tenant.slug}: + ${form.systemKey}`);
  }
}
console.log(`Done. ${tenants.length} practices checked, ${created} forms created.`);
await prisma.$disconnect();
