import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * The S3 client's `send` is the network boundary: it is the only thing faked.
 * Settings are read when the modules load, so each case loads fresh copies.
 */
const R2 = {
  R2_ACCOUNT_ID: 'acc123',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_PUBLIC_BUCKET: 'ud-public',
  R2_PRIVATE_BUCKET: 'ud-private',
  R2_PUBLIC_URL: 'https://media.example.test/',
};

async function load(env: Record<string, string> = R2) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const { StorageService } = await import('./storage.service');
  return new StorageService();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('StorageService', () => {
  it('is unconfigured without credentials, and refuses to write', async () => {
    const storage = await load({ R2_ACCOUNT_ID: '', R2_ACCESS_KEY_ID: '', R2_SECRET_ACCESS_KEY: '' });
    expect(storage.configured('public')).toBe(false);
    expect(storage.configured('private')).toBe(false);
    await expect(storage.put('public', 'a/b.png', Buffer.from('x'), { contentType: 'image/png' })).rejects.toThrow(/not configured/);
  });

  it('treats the public bucket as unconfigured until it has a public address', async () => {
    const storage = await load({ ...R2, R2_PUBLIC_URL: '' });
    expect(storage.configured('public')).toBe(false);
    expect(storage.configured('private')).toBe(true);
  });

  it('writes public files with a long cache, to the public bucket', async () => {
    const send = vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    const storage = await load();
    await storage.put('public', 'profiles/1/photo-ab.png', Buffer.from('x'), { contentType: 'image/png' });
    const cmd = send.mock.calls[0][0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({
      Bucket: 'ud-public',
      Key: 'profiles/1/photo-ab.png',
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    });
  });

  it('keeps private files out of caches', async () => {
    const send = vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    const storage = await load();
    await storage.put('private', 'docs/1/cert.pdf', Buffer.from('x'), { contentType: 'application/pdf' });
    expect((send.mock.calls[0][0] as PutObjectCommand).input).toMatchObject({ Bucket: 'ud-private', CacheControl: 'private, no-store' });
  });

  it('removes from the right bucket', async () => {
    const send = vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    const storage = await load();
    await storage.remove('public', 'profiles/1/photo-ab.png');
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect((send.mock.calls[0][0] as DeleteObjectCommand).input).toEqual({ Bucket: 'ud-public', Key: 'profiles/1/photo-ab.png' });
  });

  it.each(['../secret', '/abs', 'UPPER.png', 'a//b', 'a/../b', ''])('refuses the key %j', async (key) => {
    const storage = await load();
    await expect(storage.put('public', key, Buffer.from('x'), { contentType: 'image/png' })).rejects.toThrow(/Invalid storage key/);
  });

  it('links public files at the media origin', async () => {
    const storage = await load();
    expect(storage.publicUrl('profiles/1/photo-ab.png')).toBe('https://media.example.test/profiles/1/photo-ab.png');
  });

  it('reads a file back, and answers null when it is missing', async () => {
    const body = Buffer.from('png-bytes');
    const send = vi
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValueOnce({ Body: { transformToByteArray: async () => body } } as never)
      .mockRejectedValueOnce(Object.assign(new Error('not found'), { name: 'NoSuchKey' }) as never);
    const storage = await load();
    await expect(storage.get('public', 'profiles/1/photo-ab.png')).resolves.toEqual(body);
    await expect(storage.get('public', 'profiles/1/gone.png')).resolves.toBeNull();
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect((send.mock.calls[0][0] as GetObjectCommand).input).toEqual({ Bucket: 'ud-public', Key: 'profiles/1/photo-ab.png' });
  });

  it('signs private links for at most ten minutes, against the private bucket', async () => {
    const storage = await load();
    const url = new URL(await storage.signedPrivateUrl('docs/1/cert.pdf', 86_400));
    // Virtual-hosted style, as in Cloudflare's own presigned-URL example.
    expect(url.hostname).toBe('ud-private.acc123.r2.cloudflarestorage.com');
    expect(url.pathname).toBe('/docs/1/cert.pdf');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
  });
});
