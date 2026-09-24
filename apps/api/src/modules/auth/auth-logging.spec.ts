import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

/**
 * What auth is allowed to write to a log.
 *
 * `authDebug` was an unconditional logger.log, and its payloads carried the
 * length of the password being set, the length of the one just typed on every
 * login attempt, and the first seven characters of the stored bcrypt hash. A
 * sibling line printed the whole password-reset link, which is a bearer
 * credential: whoever reads it owns the account, no password needed.
 *
 * Anyone who could read logs — the host, an error tracker, a support tool, a
 * contractor — held all of that. These tests fail the build if any of it comes
 * back, which is the point: it arrived in the first place because someone was
 * debugging a login problem, and that will happen again.
 */
const PASSWORD = 'Correct-Horse-9!';
const RESET_TOKEN = 'a'.repeat(64);

let lines: string[] = [];

function captured(): string {
  return lines.join('\n');
}

beforeEach(() => {
  lines = [];
  for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
    vi.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
      lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    });
  }
});

afterEach(() => vi.restoreAllMocks());

async function makeService(over: Record<string, any> = {}) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const user = { id: 7n, email: 'ada@practice.ng', password: hash, platformRole: null, lockedUntil: null };
  const prisma: any = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue(user),
    },
    profile: {
      findFirst: vi.fn().mockResolvedValue({
        id: 4n,
        tenantId: 1n,
        userId: 7n,
        email: user.email,
        emailVerified: true,
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    token: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'tok-1',
        userId: 7n,
        expiresAt: new Date(Date.now() + 3600_000),
        user,
      }),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    ...over,
  };
  const notifications = {
    sendEmail: vi.fn().mockResolvedValue({ success: true, providerId: 'msg-1' }),
  };
  const sessions = {
    startSession: vi.fn().mockResolvedValue(undefined),
    revokeAllForUser: vi.fn().mockResolvedValue(0),
  };
  const service = new AuthService(
    prisma,
    { sign: vi.fn(() => 'signed.jwt'), verifyAsync: vi.fn() } as any,
    notifications as any,
    sessions as any,
  );
  return { service, prisma, notifications, hash };
}

function withEnv(vars: Record<string, string>, run: () => void) {
  const previous = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try {
    run();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function withEnvAsync(vars: Record<string, string>, run: () => Promise<void>) {
  const previous = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try {
    await run();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('a password reset', () => {
  // The link is a bearer credential for the account.
  it('never writes the reset link to a log', async () => {
    const { service, notifications } = await makeService();
    await service.forgotPassword({ email: 'ada@practice.ng' });

    const sentLink = notifications.sendEmail.mock.calls[0][0].link as string;
    expect(sentLink).toContain('/reset-password/');
    expect(captured()).not.toContain(sentLink);
  });

  it('never writes the reset token on its own either', async () => {
    const { service, notifications } = await makeService();
    await service.forgotPassword({ email: 'ada@practice.ng' });

    const token = (notifications.sendEmail.mock.calls[0][0].link as string).split('/').pop()!;
    expect(token.length).toBeGreaterThan(20);
    expect(captured()).not.toContain(token);
  });

  it('still records that the send happened, so failures stay diagnosable', async () => {
    const { service } = await makeService();
    await service.forgotPassword({ email: 'ada@practice.ng' });
    expect(captured()).toMatch(/Password reset email processed/);
  });

  it('writes neither the new password nor its hash when the reset is applied', async () => {
    const { service, prisma } = await makeService();
    await service.resetPassword({ token: RESET_TOKEN, newPassword: PASSWORD });

    const written = prisma.user.update.mock.calls[0][0].data.password as string;
    expect(written).toMatch(/^\$2[aby]\$/);
    expect(captured()).not.toContain(written);
    expect(captured()).not.toContain(written.slice(0, 7));
    expect(captured()).not.toContain(PASSWORD);
  });
});

describe('signing in', () => {
  /*
   * The worst of them: the length of the password just typed, recorded on
   * every attempt. Over a log file that narrows the search space for one named
   * account, and it captures the real password of anyone who mistypes their
   * email and lands on somebody else's row.
   */
  it('never writes the length of the password that was typed', async () => {
    const { service } = await makeService();
    await service.login(1n, { email: 'ada@practice.ng', password: PASSWORD }).catch(() => {});
    expect(captured()).not.toMatch(/[pP]assword[lL]ength/);
    expect(captured()).not.toMatch(/inputPasswordLength/);
  });

  it('never writes any part of the stored hash', async () => {
    const { service, hash } = await makeService();
    await service.login(1n, { email: 'ada@practice.ng', password: PASSWORD }).catch(() => {});
    expect(captured()).not.toContain(hash);
    expect(captured()).not.toContain(hash.slice(0, 7));
  });

  it('never writes the password itself', async () => {
    const { service } = await makeService();
    await service.login(1n, { email: 'ada@practice.ng', password: PASSWORD }).catch(() => {});
    expect(captured()).not.toContain(PASSWORD);
  });

  // A wrong password used to log the stored hash's length alongside the failure.
  it('records a failed attempt without describing the stored hash', async () => {
    const { service, hash } = await makeService();
    await service.login(1n, { email: 'ada@practice.ng', password: 'wrong-password' }).catch(() => {});
    expect(captured()).toMatch(/Login failed/);
    expect(captured()).not.toContain(String(hash.length));
    expect(captured()).not.toMatch(/hash length/i);
  });
});

describe('the verbose auth trace', () => {
  // It carries an email and a tenant/profile map per attempt — personal data
  // under the NDPA even with the secrets removed.
  it('is silent unless someone deliberately turns it on', async () => {
    const { service } = await makeService();
    await service.login(1n, { email: 'ada@practice.ng', password: PASSWORD }).catch(() => {});
    expect(captured()).not.toContain('[AUTH_DEBUG]');
  });

  it('is refused in production even when the flag is set', () => {
    withEnv({ AUTH_DEBUG_LOGS: 'true', NODE_ENV: 'production' }, () => {
      expect(AuthService.authDebugEnabled()).toBe(false);
    });
  });

  it('turns on outside production when the flag is set', () => {
    withEnv({ AUTH_DEBUG_LOGS: 'true', NODE_ENV: 'development' }, () => {
      expect(AuthService.authDebugEnabled()).toBe(true);
    });
  });

  /*
   * The gate is a second line of defence, not the only one. Someone will switch
   * this on in staging to chase a login bug, so the payloads themselves have to
   * be clean — which is where the original leak actually lived.
   */
  describe('with the trace switched on', () => {
    it('traces the attempt without the typed password or its length', async () => {
      const { service } = await makeService();
      await withEnvAsync({ AUTH_DEBUG_LOGS: 'true', NODE_ENV: 'development' }, async () => {
        await service.login(1n, { email: 'ada@practice.ng', password: PASSWORD }).catch(() => {});
      });
      expect(captured()).toContain('[AUTH_DEBUG] login_attempt');
      expect(captured()).not.toContain(PASSWORD);
      expect(captured()).not.toMatch(/[pP]asswordLength/);
      expect(captured()).not.toContain(`"${PASSWORD.length}"`);
    });

    it('traces the attempt without any part of the stored hash', async () => {
      const { service, hash } = await makeService();
      await withEnvAsync({ AUTH_DEBUG_LOGS: 'true', NODE_ENV: 'development' }, async () => {
        await service.login(1n, { email: 'ada@practice.ng', password: PASSWORD }).catch(() => {});
      });
      expect(captured()).not.toContain(hash.slice(0, 7));
      expect(captured()).not.toMatch(/[hH]ashPrefix/);
    });

    it('traces a reset without the new password or its hash', async () => {
      const { service, prisma } = await makeService();
      await withEnvAsync({ AUTH_DEBUG_LOGS: 'true', NODE_ENV: 'development' }, async () => {
        await service.resetPassword({ token: RESET_TOKEN, newPassword: PASSWORD });
      });
      const written = prisma.user.update.mock.calls[0][0].data.password as string;
      expect(captured()).toContain('[AUTH_DEBUG] reset_password');
      expect(captured()).not.toContain(PASSWORD);
      expect(captured()).not.toContain(written.slice(0, 7));
    });
  });
});
