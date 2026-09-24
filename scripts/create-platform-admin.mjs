/**
 * Creates a platform admin, or gives an existing account platform admin access.
 *
 *   node --env-file=.env scripts/create-platform-admin.mjs someone@example.com
 *
 * - New account: a strong password is generated and printed once. Sign in at
 *   https://app.unclutterdesk.com/admin/login and change it from there.
 * - Existing account (e.g. already a practice owner): only the admin role is
 *   added. Their password is left exactly as it is.
 * - ADMIN_PASSWORD=... sets the password explicitly, in either case.
 *
 * Safe to run twice.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const email = (process.argv[2] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const role = (process.env.ADMIN_ROLE || 'SUPER_ADMIN').toUpperCase();

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: node --env-file=.env scripts/create-platform-admin.mjs you@example.com');
  process.exit(1);
}
if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
  console.error('ADMIN_ROLE must be SUPER_ADMIN or ADMIN');
  process.exit(1);
}

const explicitPassword = process.env.ADMIN_PASSWORD;
if (explicitPassword !== undefined && explicitPassword.length < 12) {
  console.error('ADMIN_PASSWORD must be at least 12 characters');
  process.exit(1);
}

/** Meets the app's password rules: upper, lower, digit, symbol. */
function generatePassword() {
  const body = randomBytes(18).toString('base64url');
  return `${body}Aa1!`;
}

const prisma = new PrismaClient();

try {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        platformRole: role,
        ...(explicitPassword
          ? { password: await bcrypt.hash(explicitPassword, 12), passwordChangedAt: new Date() }
          : {}),
      },
    });
    console.log(`${email} is now a platform ${role}.`);
    console.log(explicitPassword ? 'Password set from ADMIN_PASSWORD.' : 'Password unchanged: sign in with the existing one.');
  } else {
    const password = explicitPassword || generatePassword();
    let username = `platform-admin-${email.split('@')[0].replace(/[^a-z0-9]/g, '')}`;
    if (await prisma.user.findUnique({ where: { username } })) {
      username = `${username}-${randomBytes(3).toString('hex')}`;
    }
    await prisma.user.create({
      data: { email, username, password: await bcrypt.hash(password, 12), platformRole: role },
    });
    console.log(`Created platform ${role} ${email}.`);
    if (!explicitPassword) {
      console.log(`Temporary password (shown once): ${password}`);
    }
  }
  console.log('Sign in at /admin/login on the app.');
} finally {
  await prisma.$disconnect();
}
