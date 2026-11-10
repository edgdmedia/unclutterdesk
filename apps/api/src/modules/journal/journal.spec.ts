import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, createHmac } from 'crypto';
import { BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { JournalService } from './journal.service';
import { JournalSuiteClient } from './journal-suite.client';
import { JOURNAL_API_BASE, JOURNAL_APP_ORIGIN } from '../../common/origins';

// Read when a field is first encrypted, so shared entries are stored as they are in production.
process.env.FIELD_ENCRYPTION_KEY = 'a'.repeat(64);

/**
 * A practitioner's Journal plan in the client's own Unclutter Journal
 * (docs/design/journal-integration.md). The real service and the real signed
 * client run; only the database is held in memory and the network is a fake
 * Journal that checks every signature the way the Suite does.
 */
const SECRET = 's'.repeat(40);
const TENANT = 1n;
const CLIENT = 40n;
const OTHER_CLIENT = 41n;
const CLINICIAN = { profileId: 6n, viewAll: false, clinical: true };
const ADMIN_NOT_CLINICAL = { profileId: 9n, viewAll: true, clinical: false };

const PLAN = {
  title: 'Reflection practice',
  intro: 'One small thing a day.',
  steps: [
    { kind: 'repeat', days: 5, prompt: 'Sit quietly for ten minutes. What did you notice?' },
    { kind: 'sequence', prompts: ['What went well today?', 'What would you like more of?'] },
  ],
  cadence: 'daily',
};

// ── The database, in memory ─────────────────────────────────────────────────

function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]: [string, any]) => {
    const v = row[k];
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && typeof cond !== 'bigint') {
      if ('not' in cond) return cond.not === null ? v !== null && v !== undefined : v !== cond.not;
      if ('notIn' in cond) return !cond.notIn.includes(v);
      if ('in' in cond) return cond.in.includes(v);
      return matches(v ?? {}, cond);
    }
    return v === cond;
  });
}

function table(rows: any[], keyOf: (w: any) => (r: any) => boolean, idStart = 1n) {
  let next = idStart;
  return {
    rows,
    findUnique: vi.fn(async ({ where }: any) => rows.find(keyOf(where)) ?? null),
    findFirst: vi.fn(async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null),
    findMany: vi.fn(async ({ where }: any) => rows.filter((r) => matches(r, where))),
    create: vi.fn(async ({ data }: any) => {
      const row = { id: next++, createdAt: new Date(), usedAt: null, endedAt: null, ...data };
      rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const row = rows.find(keyOf(where));
      if (!row) throw new Error('not found');
      Object.assign(row, data);
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }),
    upsert: vi.fn(async ({ where, create, update }: any) => {
      const row = rows.find(keyOf(where));
      if (row) return Object.assign(row, update);
      const fresh = { id: next++, createdAt: new Date(), endedAt: null, withdrawnAt: null, ...create };
      rows.push(fresh);
      return fresh;
    }),
  };
}

const byId = (w: any) => (r: any) => r.id === w.id;

function world(over: { switchOn?: boolean; booking?: Record<string, unknown> } = {}) {
  const tenant = { id: TENANT, name: 'Unclutter Practice', slug: 'unclutter', customDomain: null, customDomainStatus: null, ecosystemIntegrationEnabled: over.switchOn ?? true };
  const booking = {
    id: 900n,
    tenantId: TENANT,
    clientProfileId: CLIENT,
    clientRecapSentAt: new Date('2026-11-06T09:00:00Z'),
    journalPlan: PLAN,
    journalPlanAddedAt: null as Date | null,
    journalDeliveryTime: null as string | null,
    availability: { providerProfileId: CLINICIAN.profileId, therapist: { profile: { firstName: 'Olalekan', lastName: 'O' } } },
    client: { timezone: 'Africa/Lagos' },
    ...over.booking,
  };
  const prisma: any = {
    tenant: { findUnique: vi.fn(async () => tenant) },
    profile: { findUnique: vi.fn(async ({ where }: any) => (where.id === CLIENT ? { timezone: 'Africa/Lagos' } : null)) },
    consultBooking: table([booking], byId),
    journalLink: table([], (w) => (r) => (w.tenantId_clientProfileId
      ? r.tenantId === w.tenantId_clientProfileId.tenantId && r.clientProfileId === w.tenantId_clientProfileId.clientProfileId
      : r.id === w.id)),
    journalLinkRequest: table([], (w) => (r) => r.nonce === w.nonce),
    journalSharedEntry: table([], (w) => (r) => r.tenantId === w.tenantId_suiteEntryId.tenantId && r.suiteEntryId === w.tenantId_suiteEntryId.suiteEntryId),
  };
  const service = new JournalService(prisma, new JournalSuiteClient());
  return { service, prisma, booking, tenant };
}

// ── The network: a fake Unclutter Journal ───────────────────────────────────

interface Call { method: string; path: string; body: any }

function fakeJournal(handler: (c: Call) => { status?: number; body?: unknown } | undefined) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: URL | string, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = String(init.method ?? 'GET');
    const raw = typeof init.body === 'string' ? init.body : '';
    const headers = init.headers as Record<string, string>;
    // Exactly the Suite's check (desk-signing.ts verifyServerSignature).
    const signing = `${method}\n${url.pathname}${url.search}\n${headers['X-Desk-Timestamp']}\n${createHash('sha256').update(raw).digest('hex')}`;
    const expected = createHmac('sha256', SECRET).update(signing).digest('hex');
    if (headers['X-Desk-Signature'] !== expected) return new Response('{"message":"bad signature"}', { status: 401 });
    if (Math.abs(Date.now() / 1000 - Number(headers['X-Desk-Timestamp'])) > 300) return new Response('', { status: 401 });
    const call = { method, path: `${url.pathname}${url.search}`, body: raw ? JSON.parse(raw) : undefined };
    calls.push(call);
    const out = handler(call) ?? {};
    return new Response(out.body === undefined ? '' : JSON.stringify(out.body), { status: out.status ?? 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

const base = new URL(JOURNAL_API_BASE).pathname; // includes /v1

/** The Suite's verifyLinkRequest, reduced to what Desk must get right. */
function readLinkRequest(token: string) {
  const [payload, signature] = token.split('.');
  const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
  expect(signature).toBe(expected);
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function linked(w: ReturnType<typeof world>, over: Record<string, unknown> = {}) {
  w.prisma.journalLink.rows.push({ id: 5n, tenantId: TENANT, clientProfileId: CLIENT, suiteLinkId: 'dl_abcdefghijkl', profileName: 'Ada', createdAt: new Date('2026-11-06T10:00:00Z'), endedAt: null, ...over });
}

beforeEach(() => {
  process.env.DESK_INTEGRATION_SECRET = SECRET;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DESK_INTEGRATION_SECRET;
});

// ── The practitioner ────────────────────────────────────────────────────────

describe('the plan on the session page', () => {
  it('is for clinical staff only', async () => {
    const { service } = world();
    await expect(service.staffView(TENANT, ADMIN_NOT_CLINICAL, 900n)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('is not offered while the practice switch is off, or before the secret is set', async () => {
    expect(await world({ switchOn: false }).service.staffView(TENANT, CLINICIAN, 900n)).toEqual({ available: false });
    delete process.env.DESK_INTEGRATION_SECRET;
    expect(await world().service.staffView(TENANT, CLINICIAN, 900n)).toEqual({ available: false });
  });

  it('refuses a plan Journal would refuse, in plain words', async () => {
    const { service } = world();
    await expect(service.setPlan(TENANT, CLINICIAN, 900n, { ...PLAN, steps: [{ kind: 'repeat', days: 40, prompt: 'x' }] }))
      .rejects.toThrow('Step 1: choose between 1 and 30 days.');
    await expect(service.setPlan(TENANT, CLINICIAN, 900n, { ...PLAN, title: ' ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('saves a plan and sends nothing to Journal before she adds it', async () => {
    const w = world({ booking: { journalPlan: null } });
    const calls = fakeJournal(() => undefined);
    const out = await w.service.setPlan(TENANT, CLINICIAN, 900n, PLAN);
    expect(out.days).toBe(7);
    expect(w.booking.journalPlan).toMatchObject({ title: 'Reflection practice', cadence: 'daily' });
    expect(calls).toEqual([]);
  });

  it('replaces her copy, at her time, once she has it', async () => {
    const w = world({ booking: { journalPlanAddedAt: new Date('2026-11-06T10:00:00Z'), journalDeliveryTime: '07:30' } });
    linked(w);
    const calls = fakeJournal(() => ({ body: { series_id: '1', subscription_id: '2', days: 3, next_delivery_at: null } }));
    const edited = { ...PLAN, steps: [{ kind: 'sequence', prompts: ['One', 'Two', 'Three'] }] };
    const out = await w.service.setPlan(TENANT, CLINICIAN, 900n, edited);
    expect(out.syncError).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].path).toBe(`${base}/integrations/desk/plans/s900`);
    expect(calls[0].body).toMatchObject({ link_id: 'dl_abcdefghijkl', timezone: 'Africa/Lagos', delivery_time_local: '07:30', starts_on: 'next_day' });
    expect(calls[0].body.plan.steps).toEqual([{ kind: 'sequence', prompts: ['One', 'Two', 'Three'] }]);
  });

  it('keeps the edit and says so when Journal cannot be reached', async () => {
    const w = world({ booking: { journalPlanAddedAt: new Date() } });
    linked(w);
    fakeJournal(() => ({ status: 502 }));
    const out = await w.service.setPlan(TENANT, CLINICIAN, 900n, { ...PLAN, title: 'Edited' });
    expect(w.booking.journalPlan).toMatchObject({ title: 'Edited' });
    expect(out.syncError).toMatch(/her Journal was not updated/);
  });

  it('removing a plan she has ends it in her Journal', async () => {
    const w = world({ booking: { journalPlanAddedAt: new Date() } });
    linked(w);
    const calls = fakeJournal(() => ({ body: { ok: true } }));
    await w.service.setPlan(TENANT, CLINICIAN, 900n, null);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`DELETE ${base}/integrations/desk/plans/s900?link_id=dl_abcdefghijkl`]);
    expect(w.booking.journalPlanAddedAt).toBeNull();
  });

  it('shows her progress and the entries she shares, decrypted for the page and encrypted at rest', async () => {
    const w = world({ booking: { journalPlanAddedAt: new Date('2026-11-06T10:00:00Z'), journalDeliveryTime: '08:00' } });
    linked(w);
    fakeJournal(({ path }) => {
      if (path.endsWith('/shared')) {
        return { body: [{ entry_id: '77', plan_ref: 's900', prompt_text: 'What went well today?', content: 'I walked to work and noticed the trees.', written_at: '2026-11-08T07:00:00Z', updated_at: '2026-11-08T07:05:00Z', shared_at: '2026-11-08T07:06:00Z' }] };
      }
      if (path.includes('/progress')) {
        return { body: { status: 'active', total: 7, delivered: 3, responded: 2, last_responded_at: '2026-11-08T07:00:00Z', next_delivery_at: '2026-11-09T07:00:00Z', days: [] } };
      }
      return undefined;
    });
    const view: any = await w.service.staffView(TENANT, CLINICIAN, 900n);
    expect(view.progress).toMatchObject({ total: 7, delivered: 3, responded: 2 });
    expect(view.link).toMatchObject({ profileName: 'Ada' });
    expect(view.shared).toEqual([expect.objectContaining({ promptText: 'What went well today?', content: 'I walked to work and noticed the trees.', withdrawnAt: null })]);
    const stored = w.prisma.journalSharedEntry.rows[0];
    expect(stored.content).not.toContain('trees');
    expect(stored.bookingId).toBe(900n);
  });

  it('removes the words of an entry she stops sharing, and keeps a note that one was withdrawn', async () => {
    const w = world({ booking: { journalPlanAddedAt: new Date() } });
    linked(w);
    let sharing = true;
    fakeJournal(({ path }) => {
      if (path.endsWith('/shared')) {
        return { body: sharing ? [{ entry_id: '77', plan_ref: 's900', prompt_text: 'P', content: 'Private words', written_at: '2026-11-08T07:00:00Z', updated_at: '2026-11-08T07:00:00Z', shared_at: '2026-11-08T07:00:00Z' }] : [] };
      }
      return { body: { status: 'active', total: 7, delivered: 1, responded: 1, last_responded_at: null, next_delivery_at: null, days: [] } };
    });
    await w.service.staffView(TENANT, CLINICIAN, 900n);
    sharing = false;
    const view: any = await w.service.staffView(TENANT, CLINICIAN, 900n);
    expect(view.shared).toEqual([expect.objectContaining({ content: null, promptText: null, withdrawnAt: expect.any(String) })]);
    expect(w.prisma.journalSharedEntry.rows[0].content).toBeNull();
  });

  it('treats a link Journal no longer knows as ended', async () => {
    const w = world({ booking: { journalPlanAddedAt: new Date() } });
    linked(w);
    fakeJournal(() => ({ status: 404 }));
    const view: any = await w.service.staffView(TENANT, CLINICIAN, 900n);
    expect(view.link).toBeNull();
    expect(view.addedAt).toBeNull();
    expect(w.prisma.journalLink.rows[0].endedAt).toBeInstanceOf(Date);
  });

  it('shows what Desk already has when Journal is down', async () => {
    const w = world({ booking: { journalPlanAddedAt: new Date() } });
    linked(w);
    fakeJournal(() => ({ status: 503 }));
    const view: any = await w.service.staffView(TENANT, CLINICIAN, 900n);
    expect(view.syncError).toMatch(/could not do that just now/);
    expect(view.link).not.toBeNull();
  });
});

// ── The client ──────────────────────────────────────────────────────────────

describe('adding the plan to her Journal', () => {
  it('shows nothing on a recap with no plan', async () => {
    const { service } = world({ booking: { journalPlan: null } });
    expect(await service.clientView(TENANT, CLIENT, 900n)).toEqual({ available: false });
  });

  it('never shows another client’s session, or a recap not yet sent', async () => {
    await expect(world().service.clientView(TENANT, OTHER_CLIENT, 900n)).rejects.toBeInstanceOf(NotFoundException);
    await expect(world({ booking: { clientRecapSentAt: null } }).service.clientView(TENANT, CLIENT, 900n)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sends her to Journal with a signed, short-lived request that returns to her practice', async () => {
    const w = world();
    const { url } = await w.service.connect(TENANT, CLIENT, 900n, '07:30');
    const u = new URL(url);
    expect(`${u.origin}${u.pathname}`).toBe(`${JOURNAL_APP_ORIGIN}/link/desk`);
    const req = readLinkRequest(u.searchParams.get('request')!);
    expect(req).toMatchObject({ v: 1, practice_name: 'Unclutter Practice', practitioner_name: 'Olalekan O', client_ref: 't1c40' });
    expect(req.exp - req.iat).toBe(600);
    expect(req.return_url).toMatch(/\/portal\/journal\/linked$/);
    expect(w.prisma.journalLinkRequest.rows[0]).toMatchObject({ nonce: req.nonce, clientProfileId: CLIENT, bookingId: 900n, deliveryTimeLocal: '07:30' });
  });

  it('refuses a time that is not HH:MM', async () => {
    await expect(world().service.connect(TENANT, CLIENT, 900n, '7am')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('finishes the link with the one-time code and adds the plan at the time she chose', async () => {
    const w = world();
    const { url } = await w.service.connect(TENANT, CLIENT, 900n, '07:30');
    const nonce = readLinkRequest(new URL(url).searchParams.get('request')!).nonce;
    const calls = fakeJournal(({ path }) =>
      path.endsWith('/link/exchange')
        ? { body: { link_id: 'dl_newlink12345', profile_name: 'Ada' } }
        : { body: { series_id: '1', subscription_id: '2', days: 7, next_delivery_at: '2026-11-12T06:30:00Z' } },
    );
    const out = await w.service.completeLink(TENANT, CLIENT, { state: nonce, code: 'one-time-code' });
    expect(out).toEqual({ bookingId: '900', linked: true, added: true, message: null });
    expect(calls[0]).toMatchObject({ method: 'POST', path: `${base}/integrations/desk/link/exchange`, body: { code: 'one-time-code' } });
    expect(calls[1]).toMatchObject({ method: 'PUT', body: { link_id: 'dl_newlink12345', delivery_time_local: '07:30' } });
    expect(w.prisma.journalLink.rows[0]).toMatchObject({ suiteLinkId: 'dl_newlink12345', profileName: 'Ada', endedAt: null });
    expect(w.booking.journalPlanAddedAt).toBeInstanceOf(Date);
    expect(w.booking.journalDeliveryTime).toBe('07:30');
  });

  it('uses each request once, only for the client it was made for, and only in date', async () => {
    const w = world();
    const { url } = await w.service.connect(TENANT, CLIENT, 900n, null);
    const nonce = readLinkRequest(new URL(url).searchParams.get('request')!).nonce;
    fakeJournal(({ path }) => (path.endsWith('/link/exchange') ? { body: { link_id: 'dl_newlink12345', profile_name: 'Ada' } } : { body: { days: 7 } }));

    await expect(w.service.completeLink(TENANT, OTHER_CLIENT, { state: nonce, code: 'c' })).rejects.toBeInstanceOf(BadRequestException);
    await w.service.completeLink(TENANT, CLIENT, { state: nonce, code: 'c' });
    await expect(w.service.completeLink(TENANT, CLIENT, { state: nonce, code: 'c' })).rejects.toThrow(/expired or was already used/);

    const again = await w.service.connect(TENANT, CLIENT, 900n, null);
    const stale = readLinkRequest(new URL(again.url).searchParams.get('request')!).nonce;
    w.prisma.journalLinkRequest.rows.find((r: any) => r.nonce === stale).expiresAt = new Date(Date.now() - 1000);
    await expect(w.service.completeLink(TENANT, CLIENT, { state: stale, code: 'c' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('links nothing when she says no in Journal', async () => {
    const w = world();
    const { url } = await w.service.connect(TENANT, CLIENT, 900n, null);
    const nonce = readLinkRequest(new URL(url).searchParams.get('request')!).nonce;
    const calls = fakeJournal(() => undefined);
    expect(await w.service.completeLink(TENANT, CLIENT, { state: nonce, error: 'declined' })).toMatchObject({ linked: false });
    expect(calls).toEqual([]);
    expect(w.prisma.journalLink.rows).toEqual([]);
  });

  it('adds a later plan straight away once linked, and needs a link first', async () => {
    const w = world();
    await expect(w.service.addPlan(TENANT, CLIENT, 900n, '08:00')).rejects.toThrow('Connect your Unclutter Journal first.');
    linked(w);
    const calls = fakeJournal(() => ({ body: { series_id: '1', subscription_id: '2', days: 7, next_delivery_at: null } }));
    const out = await w.service.addPlan(TENANT, CLIENT, 900n, '21:00');
    expect(out).toMatchObject({ deliveryTime: '21:00', days: 7 });
    expect(calls[0].body.delivery_time_local).toBe('21:00');
    const view: any = await w.service.clientView(TENANT, CLIENT, 900n);
    expect(view).toMatchObject({ available: true, connected: true, title: 'Reflection practice', days: 7 });
  });

  it('says plainly when Journal is down', async () => {
    const w = world();
    linked(w);
    fakeJournal(() => ({ status: 500 }));
    await expect(w.service.addPlan(TENANT, CLIENT, 900n, '08:00')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('disconnecting ends the link in Journal and here', async () => {
    const w = world({ booking: { journalPlanAddedAt: new Date() } });
    linked(w);
    const calls = fakeJournal(() => ({ body: { ok: true } }));
    expect(await w.service.disconnect(TENANT, CLIENT)).toEqual({ connected: false });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`DELETE ${base}/integrations/desk/links/dl_abcdefghijkl`]);
    expect(w.prisma.journalLink.rows[0].endedAt).toBeInstanceOf(Date);
    expect(w.booking.journalPlanAddedAt).toBeNull();
  });
});

describe('the practice switch going off', () => {
  it('ends every link the practice holds, even one Journal cannot be told about now', async () => {
    const w = world({ booking: { journalPlanAddedAt: new Date() } });
    linked(w);
    w.prisma.journalLink.rows.push({ id: 6n, tenantId: TENANT, clientProfileId: OTHER_CLIENT, suiteLinkId: 'dl_secondlink1234', profileName: null, createdAt: new Date(), endedAt: null });
    fakeJournal(({ path }) => (path.endsWith('dl_secondlink1234') ? { status: 502 } : { body: { ok: true } }));
    expect(await w.service.endAllForTenant(TENANT)).toEqual({ ended: 2 });
    expect(w.prisma.journalLink.rows.every((r: any) => r.endedAt instanceof Date)).toBe(true);
  });
});
