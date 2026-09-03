import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const password = process.env.DEMO_PASSWORD;
const email = process.env.DEMO_OWNER_EMAIL || 'demo.owner@unclutterdesk.com';

if (!password || password.length < 12) {
  throw new Error('DEMO_PASSWORD must be set and contain at least 12 characters');
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Demo account ${email} was not created by the migration`);

  const profile = await prisma.profile.findFirst({
    where: { userId: user.id, tenant: { isDemo: true } },
    include: { tenant: true },
  });
  if (!profile) throw new Error(`Account ${email} is not attached to a demo tenant`);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(password, 12) },
  });

  console.log(`Provisioned demo account ${email} for tenant ${profile.tenant.slug}`);
} finally {
  await prisma.$disconnect();
}
