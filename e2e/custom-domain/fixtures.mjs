/**
 * Data for the custom-domain proxy end-to-end test (spec §6.16): a practice
 * whose ACTIVE custom domain is E2E_HOST, its owner-therapist, a client who
 * can sign in, a free online service and an open slot tomorrow. Self-contained
 * (no seed), and safe to run twice.
 *
 *   DATABASE_URL=... E2E_HOST=chente.test node e2e/custom-domain/fixtures.mjs
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const E2E = {
  host: process.env.E2E_HOST || 'chente.test',
  slug: 'e2e-chente',
  clientEmail: 'e2e.client@example.com',
  clientPassword: 'E2e-Client-Pass1!',
  serviceTitle: 'E2E free consultation',
};

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: E2E.slug },
    update: { customDomain: E2E.host, customDomainStatus: 'ACTIVE', isActive: true },
    create: {
      name: 'E2E Chente Therapy',
      slug: E2E.slug,
      customDomain: E2E.host,
      customDomainStatus: 'ACTIVE',
      isActive: true,
      subscriptionTier: 'PRO',
      complimentaryReason: 'INTERNAL',
    },
  });

  const password = await bcrypt.hash(E2E.clientPassword, 10);

  const ownerUser = await prisma.user.upsert({
    where: { email: 'e2e.owner@example.com' },
    update: {},
    create: { email: 'e2e.owner@example.com', username: 'e2e-owner', password },
  });
  let owner = await prisma.profile.findFirst({ where: { tenantId: tenant.id, userId: ownerUser.id } });
  if (!owner) {
    owner = await prisma.profile.create({
      data: {
        tenantId: tenant.id,
        userId: ownerUser.id,
        username: 'e2e-owner',
        email: ownerUser.email,
        type: 'therapist',
        role: 'OWNER',
        firstName: 'Chente',
        lastName: 'Owner',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  }
  await prisma.consultTherapistProfile.upsert({
    where: { profileId: owner.id },
    update: {},
    create: { profileId: owner.id, tenantId: tenant.id, publicUsername: 'chente', offersOnline: true },
  });

  const clientUser = await prisma.user.upsert({
    where: { email: E2E.clientEmail },
    update: { password, failedLoginAttempts: 0, lockedUntil: null },
    create: { email: E2E.clientEmail, username: 'e2e-client', password },
  });
  const client = await prisma.profile.findFirst({ where: { tenantId: tenant.id, userId: clientUser.id } });
  if (!client) {
    await prisma.profile.create({
      data: {
        tenantId: tenant.id,
        userId: clientUser.id,
        username: 'e2e-client',
        email: E2E.clientEmail,
        type: 'user',
        role: 'CLIENT',
        firstName: 'Ada',
        lastName: 'Client',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  let service = await prisma.consultService.findFirst({ where: { tenantId: tenant.id, title: E2E.serviceTitle } });
  if (!service) {
    service = await prisma.consultService.create({
      data: {
        tenantId: tenant.id,
        title: E2E.serviceTitle,
        durationMinutes: 50,
        priceKobo: 0n,
        formats: { create: [{ format: 'ONLINE', priceKobo: 0n }] },
      },
    });
  }

  // A fresh open slot every run: tomorrow, 10:00 Lagos time.
  const startsAt = new Date();
  startsAt.setUTCDate(startsAt.getUTCDate() + 1);
  startsAt.setUTCHours(9, 0, 0, 0);
  await prisma.consultAvailability.create({
    data: {
      tenantId: tenant.id,
      providerProfileId: owner.id,
      serviceId: service.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 50 * 60_000),
      allowsOnline: true,
      isActive: true,
    },
  });

  console.log(JSON.stringify({ tenantId: tenant.id.toString(), host: E2E.host, serviceId: service.id.toString() }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
