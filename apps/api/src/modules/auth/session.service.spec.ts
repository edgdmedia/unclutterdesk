import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService, describeDevice } from './session.service';

/**
 * Refresh sessions.
 *
 * Refresh tokens used to be stateless JWTs: signed, handed out, never
 * recorded. Nothing could be revoked, so logging out left the token valid for
 * its full 30 days and "close this practice" ended no sessions at all.
 */
const USER = 7n;
const SID = 'session-1';

function makeService() {
  const prisma: any = {
    token: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { service: new SessionService(prisma), prisma };
}

function liveSession(tokenHash: string) {
  return {
    id: SID,
    userId: USER,
    type: 'refresh',
    tokenHash,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  };
}

describe('SessionService.startSession', () => {
  let service: SessionService;
  let prisma: any;

  beforeEach(() => {
    ({ service, prisma } = makeService());
  });

  it('stores a hash of the refresh token, never the token', async () => {
    await service.startSession(SID, USER, 'the-refresh-token');
    const data = prisma.token.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(SessionService.hash('the-refresh-token'));
    expect(Object.values(data)).not.toContain('the-refresh-token');
  });

  it('records the device so the owner can recognise it later', async () => {
    await service.startSession(SID, USER, 't', {
      userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120',
      ipAddress: '102.89.1.1',
    });
    expect(prisma.token.create.mock.calls[0][0].data).toMatchObject({
      userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120',
      ipAddress: '102.89.1.1',
    });
  });

  it('caps a user agent so an oversized header cannot be used as storage', async () => {
    await service.startSession(SID, USER, 't', { userAgent: 'x'.repeat(5000) });
    expect(prisma.token.create.mock.calls[0][0].data.userAgent).toHaveLength(400);
  });
});

describe('SessionService.rotate', () => {
  let service: SessionService;
  let prisma: any;

  beforeEach(() => {
    ({ service, prisma } = makeService());
  });

  it('swaps the stored hash for the next token', async () => {
    prisma.token.findUnique.mockResolvedValue(liveSession(SessionService.hash('old')));
    await expect(service.rotate(SID, 'old', 'new')).resolves.toBe(true);
    expect(prisma.token.updateMany.mock.calls[0][0].data.tokenHash).toBe(
      SessionService.hash('new'),
    );
  });

  it('keeps the session id, so one session is one row for its whole life', async () => {
    prisma.token.findUnique.mockResolvedValue(liveSession(SessionService.hash('old')));
    await service.rotate(SID, 'old', 'new');
    expect(prisma.token.updateMany.mock.calls[0][0].where.id).toBe(SID);
  });

  describe('a token that is not the one outstanding', () => {
    // It was valid once, so either a thief replayed it or a client raced
    // itself. Either way two parties hold the session.
    beforeEach(() => {
      prisma.token.findUnique.mockResolvedValue(liveSession(SessionService.hash('current')));
    });

    it('is refused', async () => {
      await expect(service.rotate(SID, 'already-used', 'new')).resolves.toBe(false);
    });

    it('takes the whole session down rather than guessing who is honest', async () => {
      await service.rotate(SID, 'already-used', 'new');
      expect(prisma.token.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
      );
    });

    it('does not hand out the token it was asked to mint', async () => {
      await service.rotate(SID, 'already-used', 'new');
      const wrote = prisma.token.updateMany.mock.calls[0][0].data;
      expect(wrote.tokenHash).toBeUndefined();
    });
  });

  it('refuses a session that was revoked', async () => {
    prisma.token.findUnique.mockResolvedValue({
      ...liveSession(SessionService.hash('old')),
      revokedAt: new Date(),
    });
    await expect(service.rotate(SID, 'old', 'new')).resolves.toBe(false);
  });

  it('refuses a session that has expired', async () => {
    prisma.token.findUnique.mockResolvedValue({
      ...liveSession(SessionService.hash('old')),
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.rotate(SID, 'old', 'new')).resolves.toBe(false);
  });

  it('refuses a session id that does not exist', async () => {
    prisma.token.findUnique.mockResolvedValue(null);
    await expect(service.rotate(SID, 'old', 'new')).resolves.toBe(false);
  });

  it('refuses a row of another type, so a reset token cannot be refreshed', async () => {
    prisma.token.findUnique.mockResolvedValue({
      ...liveSession(SessionService.hash('old')),
      type: 'password_reset',
    });
    await expect(service.rotate(SID, 'old', 'new')).resolves.toBe(false);
  });

  describe('two refreshes arriving at once', () => {
    // Both read the same row before either writes. Without the current hash in
    // the WHERE, both would win and two live tokens would exist for one
    // session — the exact state reuse detection is meant to catch.
    it('matches on the hash it read, so only one write lands', async () => {
      prisma.token.findUnique.mockResolvedValue(liveSession(SessionService.hash('old')));
      await service.rotate(SID, 'old', 'new');
      expect(prisma.token.updateMany.mock.calls[0][0].where).toMatchObject({
        revokedAt: null,
        tokenHash: SessionService.hash('old'),
      });
    });

    it('reports failure to the loser rather than renewing it', async () => {
      prisma.token.findUnique.mockResolvedValue(liveSession(SessionService.hash('old')));
      prisma.token.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.rotate(SID, 'old', 'new')).resolves.toBe(false);
    });
  });
});

describe('SessionService.revokeSession', () => {
  let service: SessionService;
  let prisma: any;

  beforeEach(() => {
    ({ service, prisma } = makeService());
  });

  it('scopes to the owner, so one account cannot end another account’s session', async () => {
    await service.revokeSession(SID, USER);
    expect(prisma.token.updateMany.mock.calls[0][0].where).toMatchObject({
      id: SID,
      userId: USER,
      type: 'refresh',
    });
  });

  it('reports nothing revoked when the id belongs to someone else', async () => {
    prisma.token.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.revokeSession(SID, USER)).resolves.toBe(0);
  });

  it('leaves an already-revoked row alone', async () => {
    await service.revokeSession(SID, USER);
    expect(prisma.token.updateMany.mock.calls[0][0].where.revokedAt).toBeNull();
  });
});

describe('SessionService.revokeAllForUser', () => {
  let service: SessionService;
  let prisma: any;

  beforeEach(() => {
    ({ service, prisma } = makeService());
  });

  it('ends every session of that user', async () => {
    await service.revokeAllForUser(USER);
    expect(prisma.token.updateMany.mock.calls[0][0].where).toMatchObject({
      userId: USER,
      type: 'refresh',
      revokedAt: null,
    });
  });

  it('spares the session asking, so signing out other devices stays signed in here', async () => {
    await service.revokeAllForUser(USER, SID);
    expect(prisma.token.updateMany.mock.calls[0][0].where.id).toEqual({ not: SID });
  });

  it('touches only refresh rows, leaving verification and reset tokens standing', async () => {
    await service.revokeAllForUser(USER);
    expect(prisma.token.updateMany.mock.calls[0][0].where.type).toBe('refresh');
  });
});

describe('SessionService.listForUser', () => {
  const rows = [
    {
      id: 'a',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120 Safari/537',
      ipAddress: '102.89.1.1',
      lastUsedAt: new Date('2026-09-01T10:00:00.000Z'),
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
    },
  ];

  it('never returns the token hash — this list is rendered in a browser', async () => {
    const { service, prisma } = makeService();
    prisma.token.findMany.mockResolvedValue(rows);
    const listed = await service.listForUser(USER);
    expect(prisma.token.findMany.mock.calls[0][0].select).not.toHaveProperty('tokenHash');
    expect(listed[0]).not.toHaveProperty('tokenHash');
  });

  it('never returns the raw user agent, which is attacker-controlled text', async () => {
    const { service, prisma } = makeService();
    prisma.token.findMany.mockResolvedValue([{ ...rows[0], userAgent: '<script>alert(1)</script>' }]);
    const listed = await service.listForUser(USER);
    expect(JSON.stringify(listed)).not.toContain('<script>');
  });

  it('excludes revoked and expired sessions', async () => {
    const { service, prisma } = makeService();
    await service.listForUser(USER);
    const where = prisma.token.findMany.mock.calls[0][0].where;
    expect(where.revokedAt).toBeNull();
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it('marks the session making the request so it is not signed out by mistake', async () => {
    const { service, prisma } = makeService();
    prisma.token.findMany.mockResolvedValue(rows);
    await expect(service.listForUser(USER, 'a')).resolves.toMatchObject([{ current: true }]);
  });

  it('falls back to the start date for a session never refreshed', async () => {
    const { service, prisma } = makeService();
    prisma.token.findMany.mockResolvedValue([{ ...rows[0], lastUsedAt: null }]);
    await expect(service.listForUser(USER)).resolves.toMatchObject([
      { lastUsedAt: '2026-08-01T10:00:00.000Z' },
    ]);
  });
});

describe('describeDevice', () => {
  it.each([
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Chrome/120 Safari/537', 'Chrome on Mac'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17 Safari/605', 'Safari on iPhone'],
    ['Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537 Edg/120', 'Edge on Windows'],
    ['Mozilla/5.0 (X11; Linux x86_64) Firefox/121', 'Firefox on Linux'],
    ['Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile', 'Chrome on Android'],
  ])('reads %s as %s', (ua, expected) => {
    expect(describeDevice(ua)).toBe(expected);
  });

  it('says unknown rather than guessing at an agent it does not recognise', () => {
    expect(describeDevice('curl/8.4.0')).toBe('Unknown device');
  });

  it('handles a missing agent', () => {
    expect(describeDevice(null)).toBe('Unknown device');
  });
});
