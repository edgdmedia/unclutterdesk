/**
 * Encrypts clinical notes written before encryption existed.
 *
 * New notes are encrypted as they are saved, but rows already in the database
 * are plaintext, and "clinical notes are encrypted at rest" is not true while
 * any of them are. This rewrites them in place.
 *
 * Safe to run more than once: an already-encrypted value is recognised and
 * skipped, so an interrupted run continues where it stopped rather than
 * double-encrypting anything.
 *
 *   FIELD_ENCRYPTION_KEY=... node scripts/encrypt-existing-notes.mjs --dry-run
 *   FIELD_ENCRYPTION_KEY=... node scripts/encrypt-existing-notes.mjs
 *
 * Take a backup first. This is a one-way rewrite: without the key the rows
 * cannot be read back.
 */
import { PrismaClient } from '@prisma/client';
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';

const PREFIX = 'enc.v1.';
const FIELDS = ['subjective', 'objective', 'assessment', 'plan'];
const BATCH = 200;

const dryRun = process.argv.includes('--dry-run');

function loadKey() {
  const configured = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (!configured) {
    console.error('FIELD_ENCRYPTION_KEY is not set. Refusing to run.');
    process.exit(1);
  }
  if (/^[0-9a-f]{64}$/i.test(configured)) return Buffer.from(configured, 'hex');
  if (/^[A-Za-z0-9+/]{43}=$/.test(configured)) return Buffer.from(configured, 'base64');
  // Must match the derivation in apps/api/src/common/field-encryption.ts, or
  // the API will not be able to read what this writes.
  return scryptSync(configured, 'unclutterdesk.field-encryption.v1', 32);
}

const key = loadKey();

function encrypt(plain) {
  if (plain === null || plain === undefined || plain === '') return plain ?? null;
  if (typeof plain === 'string' && plain.startsWith(PREFIX)) return plain;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return (
    PREFIX +
    [iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.')
  );
}

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.clinicalNote.count();
  console.log(`${total} clinical note(s) in the database${dryRun ? ' (dry run)' : ''}`);

  let cursor;
  let scanned = 0;
  let rewritten = 0;
  let alreadyDone = 0;

  for (;;) {
    const notes = await prisma.clinicalNote.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, subjective: true, objective: true, assessment: true, plan: true },
    });
    if (notes.length === 0) break;
    cursor = notes[notes.length - 1].id;

    for (const note of notes) {
      scanned += 1;
      const data = {};
      for (const field of FIELDS) {
        const value = note[field];
        if (value === null || value === undefined || value === '') continue;
        if (value.startsWith(PREFIX)) continue;
        data[field] = encrypt(value);
      }

      if (Object.keys(data).length === 0) {
        alreadyDone += 1;
        continue;
      }

      if (!dryRun) {
        await prisma.clinicalNote.update({ where: { id: note.id }, data });
      }
      rewritten += 1;
    }

    process.stdout.write(`\r  scanned ${scanned}/${total}`);
  }

  console.log(
    `\n${dryRun ? 'would rewrite' : 'rewrote'} ${rewritten}; ` +
      `${alreadyDone} already encrypted or empty`,
  );

  if (!dryRun && rewritten > 0) {
    // The claim is only true once nothing is left in the clear.
    const remaining = await prisma.clinicalNote.count({
      where: {
        OR: FIELDS.map((f) => ({
          AND: [{ [f]: { not: null } }, { [f]: { not: '' } }, { [f]: { not: { startsWith: PREFIX } } }],
        })),
      },
    });
    console.log(
      remaining === 0
        ? 'verified: no clinical note narrative remains in the clear'
        : `WARNING: ${remaining} note(s) still hold plaintext — run again`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
