import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  decryptField,
  decryptNoteFields,
  encryptField,
  encryptNoteFields,
  isEncrypted,
  resetFieldEncryptionKey,
} from './field-encryption';

/**
 * Encryption at rest for clinical narrative.
 *
 * The marketing site tells therapists their clients' notes are encrypted at
 * rest. Postgres runs on a VPS with no volume encryption and the backups were
 * plain pg_dump output, so anyone with the disk, a backup file or a `select`
 * had the notes in the clear. That sentence is now true because of this.
 */
const KEY = 'a'.repeat(64); // 32 bytes of hex
const OTHER_KEY = 'b'.repeat(64);
const NOTE = 'Client reports panic attacks since the bereavement.';

function withKey(value: string | undefined) {
  if (value === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
  else process.env.FIELD_ENCRYPTION_KEY = value;
  resetFieldEncryptionKey();
}

beforeEach(() => withKey(KEY));

afterEach(() => {
  delete process.env.NODE_ENV_OVERRIDE;
  withKey(undefined);
});

describe('a value at rest', () => {
  it('does not contain what was written', () => {
    const stored = encryptField(NOTE)!;
    expect(stored).not.toContain('panic');
    expect(stored).not.toContain('bereavement');
  });

  it('comes back exactly', () => {
    expect(decryptField(encryptField(NOTE))).toBe(NOTE);
  });

  it('survives characters a therapist actually types', () => {
    const messy = 'Line one\nLine two — “quoted”, 50% better, naïve, 😊';
    expect(decryptField(encryptField(messy))).toBe(messy);
  });

  it('is marked, so a reader can tell which shape a row is in', () => {
    expect(isEncrypted(encryptField(NOTE))).toBe(true);
    expect(isEncrypted(NOTE)).toBe(false);
  });

  /*
   * A fresh IV per value. Reusing one under the same key in GCM leaks the
   * relationship between two plaintexts, so two identical notes must not
   * produce identical ciphertext.
   */
  it('encrypts the same text differently every time', () => {
    expect(encryptField(NOTE)).not.toBe(encryptField(NOTE));
  });
});

describe('a value that has been tampered with', () => {
  // GCM is authenticated: the point is that altered data fails loudly rather
  // than decrypting to something plausible.
  it('refuses to decrypt', () => {
    const stored = encryptField(NOTE)!;
    const [prefix, iv, tag, data] = [
      stored.slice(0, 7),
      ...stored.slice(7).split('.'),
    ];
    const flipped = data.startsWith('A') ? 'B' + data.slice(1) : 'A' + data.slice(1);
    expect(() => decryptField(`${prefix}${iv}.${tag}.${flipped}`)).toThrow();
  });

  it('refuses a malformed record rather than returning half of it', () => {
    expect(() => decryptField('enc.v1.only-one-part')).toThrow(/malformed/i);
  });
});

describe('the wrong key', () => {
  it('cannot read what another key wrote', () => {
    const stored = encryptField(NOTE)!;
    withKey(OTHER_KEY);
    expect(() => decryptField(stored)).toThrow();
  });
});

describe('notes written before this existed', () => {
  /*
   * They are plaintext. Refusing to read them would hide records a clinician
   * needs, so both shapes coexist until the backfill has run.
   */
  it('are still readable', () => {
    expect(decryptField('an old plaintext note')).toBe('an old plaintext note');
  });

  it('are not double-encrypted if they pass through again', () => {
    const once = encryptField(NOTE)!;
    expect(encryptField(once)).toBe(once);
  });
});

describe('empty and missing values', () => {
  it('stay as they are, rather than becoming ciphertext of nothing', () => {
    expect(encryptField('')).toBe('');
    expect(encryptField(null)).toBeNull();
    expect(encryptField(undefined)).toBeNull();
    expect(decryptField(null)).toBeNull();
  });
});

describe('without a key', () => {
  it('refuses to write in production rather than storing plaintext', () => {
    const previous = process.env.NODE_ENV;
    withKey(undefined);
    process.env.NODE_ENV = 'production';
    try {
      expect(() => encryptField(NOTE)).toThrow(/FIELD_ENCRYPTION_KEY is not set/);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('refuses to read something already encrypted rather than guessing', () => {
    const stored = encryptField(NOTE)!;
    withKey(undefined);
    expect(() => decryptField(stored)).toThrow(/Refusing to guess/);
  });

  it('stores plaintext in development, so local work still runs', () => {
    withKey(undefined);
    expect(encryptField(NOTE)).toBe(NOTE);
  });
});

describe('a whole note', () => {
  const note = {
    subjective: 'S',
    objective: 'O',
    assessment: 'A',
    plan: 'P',
  };

  it('has all four narrative fields encrypted', () => {
    const stored = encryptNoteFields(note);
    for (const [field, value] of Object.entries(stored)) {
      expect(isEncrypted(value as string), field).toBe(true);
    }
  });

  it('comes back as it went in', () => {
    expect(decryptNoteFields(encryptNoteFields(note))).toEqual(note);
  });

  // Names, dates and amounts stay queryable; only the narrative is encrypted.
  it('leaves fields it was not given alone', () => {
    const stored = encryptNoteFields({ ...note, diagnosisCode: 'F41.1' } as never) as Record<
      string,
      unknown
    >;
    expect(stored.diagnosisCode).toBe('F41.1');
  });

  it('does not invent fields that were absent', () => {
    const partial = encryptNoteFields({ subjective: 'S' });
    expect(Object.keys(partial)).toEqual(['subjective']);
  });
});

describe('a passphrase rather than a raw key', () => {
  it('is stretched, so a human-chosen value is still full strength', () => {
    withKey('a memorable but not 32-byte passphrase');
    const stored = encryptField(NOTE)!;
    expect(isEncrypted(stored)).toBe(true);
    expect(decryptField(stored)).toBe(NOTE);
  });

  it('derives the same key on every process, or nothing could be read back', () => {
    withKey('a memorable but not 32-byte passphrase');
    const stored = encryptField(NOTE)!;
    withKey('a memorable but not 32-byte passphrase');
    expect(decryptField(stored)).toBe(NOTE);
  });
});
