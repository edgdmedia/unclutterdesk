import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { MEDIA_ORIGIN } from '../../common/origins';

/**
 * File storage on Cloudflare R2, through its S3 API (spec §4.4).
 *
 * Two buckets:
 * - **public**: published-profile assets (photos, preview images), served at
 *   MEDIA_ORIGIN (R2_PUBLIC_URL, the bucket's public custom domain).
 * - **private**: anything sensitive (credential documents, Phase 3). Never
 *   public; read only through short-lived signed links.
 *
 * Settings: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_PUBLIC_BUCKET, R2_PRIVATE_BUCKET, R2_PUBLIC_URL. Without them the
 * service reports itself unconfigured and callers skip storage work (the
 * job runner retries later), so the API runs anywhere without R2.
 */

export type StorageBucket = 'public' | 'private';

/** Lowercase path segments of [a-z0-9._-], separated by "/". No "..", no leading "/". */
const KEY_PATTERN = /^(?!.*\.\.)[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/;

/** Signed links to private files expire fast: they are bearer tokens. */
export const MAX_SIGNED_URL_SECONDS = 10 * 60;

export class StorageNotConfiguredError extends Error {
  constructor(bucket: StorageBucket) {
    super(`R2 storage is not configured for the ${bucket} bucket`);
  }
}

const setting = (name: string) => process.env[name]?.trim() || undefined;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly buckets: Record<StorageBucket, string | undefined> = {
    public: setting('R2_PUBLIC_BUCKET'),
    private: setting('R2_PRIVATE_BUCKET'),
  };
  private readonly client: S3Client | null;

  constructor() {
    const accountId = setting('R2_ACCOUNT_ID');
    const accessKeyId = setting('R2_ACCESS_KEY_ID');
    const secretAccessKey = setting('R2_SECRET_ACCESS_KEY');
    this.client =
      accountId && accessKeyId && secretAccessKey
        ? new S3Client({
            region: 'auto', // required by the SDK, not used by R2
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  /** Whether files can be written to `bucket` (and, for public, linked to). */
  configured(bucket: StorageBucket): boolean {
    if (!this.client || !this.buckets[bucket]) return false;
    return bucket === 'private' || MEDIA_ORIGIN !== null;
  }

  async put(
    bucket: StorageBucket,
    key: string,
    body: Buffer,
    options: { contentType: string; cacheControl?: string },
  ): Promise<void> {
    await this.require(bucket).send(
      new PutObjectCommand({
        Bucket: this.buckets[bucket],
        Key: this.checkKey(key),
        Body: body,
        ContentType: options.contentType,
        // Keys are never reused (each upload gets a new one), so public files
        // can be cached for good.
        CacheControl: options.cacheControl ?? (bucket === 'public' ? 'public, max-age=31536000, immutable' : 'private, no-store'),
      }),
    );
  }

  /** Remove a file. Removing one that's already gone is not an error. */
  async remove(bucket: StorageBucket, key: string): Promise<void> {
    await this.require(bucket).send(new DeleteObjectCommand({ Bucket: this.buckets[bucket], Key: this.checkKey(key) }));
  }

  /**
   * Read a file back. `null` when the bucket says the key does not exist, so
   * callers can treat a missing file (an old photo, a not-yet-uploaded asset)
   * as an optional input rather than an error. Every other failure propagates.
   */
  async get(bucket: StorageBucket, key: string): Promise<Buffer | null> {
    try {
      const result = await this.require(bucket).send(new GetObjectCommand({ Bucket: this.buckets[bucket], Key: this.checkKey(key) }));
      const body = result?.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
      if (!body?.transformToByteArray) return null;
      return Buffer.from(await body.transformToByteArray());
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === 'NoSuchKey' || name === 'NotFound') return null;
      throw err;
    }
  }

  /** Where a public file is served. */
  publicUrl(key: string): string {
    if (!MEDIA_ORIGIN) throw new StorageNotConfiguredError('public');
    return `${MEDIA_ORIGIN}/${this.checkKey(key)}`;
  }

  /** A short-lived link to one private file. Callers must check access and audit it first. */
  async signedPrivateUrl(key: string, expiresInSeconds = 5 * 60): Promise<string> {
    const seconds = Math.min(Math.max(1, Math.floor(expiresInSeconds)), MAX_SIGNED_URL_SECONDS);
    return getSignedUrl(this.require('private'), new GetObjectCommand({ Bucket: this.buckets.private, Key: this.checkKey(key) }), {
      expiresIn: seconds,
    });
  }

  private require(bucket: StorageBucket): S3Client {
    if (!this.client || !this.buckets[bucket]) throw new StorageNotConfiguredError(bucket);
    return this.client;
  }

  private checkKey(key: string): string {
    if (!KEY_PATTERN.test(key) || key.length > 512) throw new Error(`Invalid storage key: ${key}`);
    return key;
  }
}
