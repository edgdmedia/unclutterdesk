import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { Logger } from '@nestjs/common';

/**
 * Encryption at rest for clinical narrative.
 *
 * The marketing site tells therapists their clients' notes are encrypted at
 * rest. Postgres runs on a VPS with no volume encryption and the backups were
 * plain `pg_dump` output, so that sentence was not true — anyone with the disk,
 * a backup file, or a `select` had the notes in the clear.
 *
 * This encrypts the four narrative fields of a clinical note in the
 * application, before they reach the database. That makes the claim true
 * independently of where Postgres happens to be hosted, and it keeps holding
 * if a backup is copied somewhere it should not be.
 *
 * AES-256-GCM: authenticated, so a tampered ciphertext fails to decrypt rather
 * than returning plausible rubbish. A fresh random IV per value, because
 * reusing one under the same key in GCM leaks the plaintext relationship
 * between two values.
 *
 * ## What this does not cover
 *
 * Only the narrative fields. Names, emails, appointment times and amounts stay
 * queryable and therefore readable — encrypting them would break every list,
 * filter and total in the product. Disk and backup encryption are still worth
 * having underneath this; they cover the rest of the row.
 *
 * ## Losing the key
 *
 * There is no recovery. The key is not derived from anything and is not stored
 * with the data — that is the point. If it is lost, every clinical note
 * encrypted under it is gone permanently, which for a therapy practice is
 * losing the record of someone's care. Back the key up somewhere separate from
 * the database backups: together in one bucket means a thief who takes the
 * bucket has both, and a lost bucket loses both.
 */
const logger = new Logger('FieldEncryption');

/** Marks a value as encrypted, and by which scheme, so this can change later. */
const PREFIX = 'enc.v1.';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;
let warnedAboutDevelopment = false;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * The key, from FIELD_ENCRYPTION_KEY.
 *
 * A 64-character hex or 44-character base64 string is used as 32 raw bytes.
 * Anything else is treated as a passphrase and stretched with scrypt, so a
 * human-chosen value is still a full-strength key rather than a short one
 * padded out.
 */
function key(): Buffer | null {
  if (cachedKey) return cachedKey;

  const configured = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (!configured) return null;

  if (/^[0-9a-f]{64}$/i.test(configured)) {
    cachedKey = Buffer.from(configured, 'hex');
  } else if (/^[A-Za-z0-9+/]{43}=$/.test(configured)) {
    cachedKey = Buffer.from(configured, 'base64');
  } else {
    // A fixed salt: the key must derive identically on every process that
    // reads the same database, so this cannot be random per boot.
    cachedKey = scryptSync(configured, 'unclutterdesk.field-encryption.v1', KEY_BYTES);
  }

  if (cachedKey.length !== KEY_BYTES) {
    cachedKey = null;
    throw new Error('FIELD_ENCRYPTION_KEY must decode to 32 bytes');
  }
  return cachedKey;
}

/** Test seam: the key is cached, and tests change the environment. */
export function resetFieldEncryptionKey(): void {
  cachedKey = null;
  warnedAboutDevelopment = false;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Encrypts one field.
 *
 * Refuses in production without a key rather than quietly writing plaintext:
 * a note saved in the clear is indistinguishable from an encrypted one to
 * everything upstream, so the failure has to be loud and at the moment of
 * writing. Development without a key stores plaintext and says so once.
 */
export function encryptField(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === '') return plain ?? null;
  if (isEncrypted(plain)) return plain;

  const secret = key();
  if (!secret) {
    if (isProduction()) {
      throw new Error(
        'FIELD_ENCRYPTION_KEY is not set. Clinical notes cannot be written unencrypted in production.',
      );
    }
    if (!warnedAboutDevelopment) {
      warnedAboutDevelopment = true;
      logger.warn(
        'FIELD_ENCRYPTION_KEY is not set — clinical notes are being stored unencrypted. Development only.',
      );
    }
    return plain;
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, secret, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return (
    PREFIX +
    [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.')
  );
}

/**
 * Decrypts one field.
 *
 * A value without the marker is returned as it is. Notes written before this
 * existed are plaintext, and refusing to read them would hide records a
 * clinician needs — the backfill re-writes them, and until it runs both shapes
 * coexist.
 */
export function decryptField(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined) return null;
  if (!isEncrypted(stored)) return stored;

  const secret = key();
  if (!secret) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY is not set, and this record is encrypted. Refusing to guess.',
    );
  }

  const [ivPart, tagPart, dataPart] = stored.slice(PREFIX.length).split('.');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Encrypted field is malformed');
  }

  const decipher = createDecipheriv(ALGORITHM, secret, Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  // Throws if the ciphertext or tag was altered, which is the point of GCM:
  // a tampered record fails loudly instead of returning something plausible.
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** The narrative fields of a clinical note, and nothing else. */
export const ENCRYPTED_NOTE_FIELDS = ['subjective', 'objective', 'assessment', 'plan'] as const;

type NoteNarrative = Partial<Record<(typeof ENCRYPTED_NOTE_FIELDS)[number], string | null>>;

export function encryptNoteFields<T extends NoteNarrative>(note: T): T {
  const out = { ...note };
  for (const field of ENCRYPTED_NOTE_FIELDS) {
    if (field in out) out[field] = encryptField(out[field]) as T[typeof field];
  }
  return out;
}

export function decryptNoteFields<T extends NoteNarrative>(note: T): T {
  const out = { ...note };
  for (const field of ENCRYPTED_NOTE_FIELDS) {
    if (field in out) out[field] = decryptField(out[field]) as T[typeof field];
  }
  return out;
}
