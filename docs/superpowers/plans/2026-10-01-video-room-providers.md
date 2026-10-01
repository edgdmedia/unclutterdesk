# Video Room Providers Implementation Plan (VID-01, ONB-08)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Online sessions run as real video calls inside the designed session room, for both therapist and client. Daily is used first, then JaaS once Daily's monthly budget is spent, then a new-tab link. A therapist can opt into Google Meet instead. Every session's minutes are recorded, and super admins can see them.

**Architecture:**
- **Server:** a `video` API module with:
  - one `VideoProvider` interface and three implementations: Daily, JaaS and Link (meet.jit.si);
  - a `VideoRouter` that picks the provider when a booking's room is first needed (the first join), never mid-call;
  - `VideoUsageService`, which records participants (each join and a heartbeat every minute) and reports monthly totals;
  - a Daily `meeting.ended` webhook, which overwrites the heartbeat estimate with Daily's own durations.
- **App:** one `VideoStage` component with three adapters behind a common control interface. The therapist room (`/session/:id`) and a new client room (`/portal/sessions/:id/room`) both use it, with the designed control bar.

**Tech Stack:**
- NestJS and Prisma.
- Daily: the REST API (`/v1/rooms`, `/v1/meeting-tokens`, `/v1/meetings`) and `@daily-co/daily-js` plus `@daily-co/daily-react` (call object, `DailyVideo`, `useParticipantIds`, `useScreenShare`).
- JaaS on 8x8.vc: `@jitsi/react-sdk` `JaaSMeeting`, and an RS256 JWT signed with `jose`.
- React and vitest.

**Spec:** `docs/testing-feedback.md` → VID-01 (decisions of 1 Oct 2026: Daily for every plan; budget router Daily → JaaS → new tab; Meet opt-in through the therapist's own Google; usage records) and ONB-08.

## Global Constraints

- **Budget limits are settings, not code:**
  - `VIDEO_DAILY_MONTHLY_MINUTES` (default `9500` participant-minutes)
  - `VIDEO_JAAS_MONTHLY_USERS` (default `23` distinct participants)

  The month is the calendar month in WAT (`Africa/Lagos`).
- **Secrets live only in the environment:** `DAILY_API_KEY`, `JAAS_APP_ID`, `JAAS_KEY_ID` (the full `vpaas-magic-cookie-…/abc123` kid) and `JAAS_PRIVATE_KEY` (PEM). A provider with missing keys counts as unavailable, and the router skips it.
- **The provider is fixed once a booking's room exists** (`ConsultBooking.videoProvider`). Rejoining uses the same room.
- **Who may join:** the booking's client, its therapist, or practice staff with `clinical.record`, and only while the booking is `CONFIRMED`. The window opens 15 minutes before the start and closes 60 minutes after the end. Outside it, the answer is 403 "This room opens 15 minutes before your session."
- **Access expires:** Daily rooms are `privacy: 'private'` with `exp` at the end of the window. Meeting tokens and JaaS JWTs expire at the end of the window. The therapist is the owner/moderator; the client is not.
- **Google Meet stays as today:** `videoProvider = 'GOOGLE_MEET'` with a connected Google account means the Meet link from the calendar event. The room page shows "Open Google Meet" (new tab), and nothing is embedded.
- **The join link in emails** points to the in-app room (`/portal/sessions/:id/room` for the client), never to a provider URL.
- **Tests:** the API specs use Prisma stand-ins and fake `fetch`. App tests use `renderWithApp` and fake only `utils/apiClient`, `context/AuthContext` and the two SDK packages (`vi.mock('@daily-co/daily-react')`, `vi.mock('@jitsi/react-sdk')`, the network edge). Run with `--maxWorkers=2 --minWorkers=1`.
- Migrations are hand-written SQL. Never run `prisma format`.
- Before writing SDK code, check its current docs via Context7 (`/daily-co/daily-react`, `/websites/daily_co_reference_rest-api`, `/websites/jitsi_github_io_handbook`).

## Review Focus

1. **Two people join at the same moment for a booking with no room yet.** Only one room is created, and both get credentials for it. This needs a conditional update on `videoRoomName IS NULL`.
2. **Daily's budget runs out mid-month.** Running and already-created rooms keep Daily; only new rooms go to JaaS.
3. **The Daily API errors when creating a room.** The router falls through to the next provider rather than failing the join.
4. **The client opens the room 20 minutes early.** A clear "opens at 9:45 AM" message, no credentials, and no usage recorded.
5. **A heartbeat stops (the tab closed).** Minutes are counted to the last heartbeat, never to "now".

---

## File Structure

**API:** `apps/api/src/modules/video/`
- `video.module.ts`
- `video-provider.ts`: the interface and types.
- `daily.provider.ts`, `jaas.provider.ts`, `link.provider.ts`.
- `video-router.service.ts`: chooses the provider.
- `video-usage.service.ts`: records joins, heartbeats and Daily reconciliation, and reports monthly totals.
- `video-room.service.ts`: `join(bookingId, caller)` (access, window, room-once, credentials, usage).
- `video.controller.ts`:
  - `POST /v1/video/bookings/:id/join`
  - `POST /v1/video/participants/:id/heartbeat`
  - `POST /v1/video/webhooks/daily`
  - `GET /v1/admin/video-usage`

**Prisma:**
- `ConsultBooking.videoProvider String?`.
- New `VideoParticipant`.
- `ConsultTherapistProfile.videoProvider` values become `BUILT_IN | GOOGLE_MEET`.
- Migration `20261003110000_video_rooms`.

**Modify:**
- `consult.service.ts`: stop creating meet.jit.si rooms at booking (`resolveVideoRoomLink` is removed).
- `booking-notifier.service.ts`: the join link becomes the in-app room.

**App:**
- `apps/app/src/components/video/`: `VideoStage.tsx`, `DailyStage.tsx`, `JaasStage.tsx`, `LinkStage.tsx`, `ControlBar.tsx`, `useHeartbeat.ts`, `types.ts`.
- `pages/practice/TelehealthVideoRoomPage.tsx`: the real stage replaces the mock.
- `pages/client/ClientSessionRoomPage.tsx`: new.
- `App.tsx`: the client route.
- `pages/practice/MyProfilePage.tsx`: provider choice.
- `pages/practice/OnboardingWizardPage.tsx`: the video line (ONB-08).
- `pages/admin/AdminVideoUsagePage.tsx` and its nav entry.

---

### Task 1: Data model and settings

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261003110000_video_rooms/migration.sql`
- Modify: `apps/api/.env.example` (or the env template the API uses: `ls apps/api/.env*`)

**Interfaces:**
- Produces:
  - `ConsultBooking.videoProvider String? @db.VarChar(20)`, with the values `DAILY | JAAS | LINK | GOOGLE_MEET`.
  - `VideoParticipant { id, tenantId, bookingId, profileId, provider, role ('THERAPIST'|'CLIENT'|'STAFF'), joinedAt, lastSeenAt, minutes Int @default(0), reconciled Boolean @default(false) }`, indexed `[tenantId, joinedAt]` and `[provider, joinedAt]`.

- [ ] **Step 1: Edit the schema by hand.** Add to `ConsultBooking`:

```prisma
  /// VID-01: which provider hosts this session's room, fixed when the room is first made.
  videoProvider               String?   @db.VarChar(20)
```

Then add the new model:

```prisma
/// VID-01: one person's time in one session's room, for budgets and planning.
model VideoParticipant {
  id         BigInt   @id @default(autoincrement())
  tenantId   BigInt
  bookingId  BigInt
  profileId  BigInt
  provider   String   @db.VarChar(20)
  role       String   @db.VarChar(20)
  joinedAt   DateTime @default(now())
  lastSeenAt DateTime @default(now())
  /// Whole minutes in the room: from heartbeats, replaced by Daily's own figure when it arrives.
  minutes    Int      @default(0)
  reconciled Boolean  @default(false)

  @@index([tenantId, joinedAt])
  @@index([provider, joinedAt])
  @@index([bookingId])
}
```

Update the `videoProvider` comment on `ConsultTherapistProfile` to `// "BUILT_IN" (Unclutter Desk video) or "GOOGLE_MEET"`, and its default to `"BUILT_IN"`.

```sql
-- prisma/migrations/20261003110000_video_rooms/migration.sql
ALTER TABLE "ConsultBooking" ADD COLUMN "videoProvider" VARCHAR(20);
CREATE TABLE "VideoParticipant" (
  "id" BIGSERIAL PRIMARY KEY,
  "tenantId" BIGINT NOT NULL,
  "bookingId" BIGINT NOT NULL,
  "profileId" BIGINT NOT NULL,
  "provider" VARCHAR(20) NOT NULL,
  "role" VARCHAR(20) NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "minutes" INTEGER NOT NULL DEFAULT 0,
  "reconciled" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "VideoParticipant_tenantId_joinedAt_idx" ON "VideoParticipant"("tenantId", "joinedAt");
CREATE INDEX "VideoParticipant_provider_joinedAt_idx" ON "VideoParticipant"("provider", "joinedAt");
CREATE INDEX "VideoParticipant_bookingId_idx" ON "VideoParticipant"("bookingId");
-- Everyone who wasn't on Google Meet moves to the built-in room.
UPDATE "ConsultTherapistProfile" SET "videoProvider" = 'BUILT_IN' WHERE "videoProvider" IS NULL OR "videoProvider" <> 'GOOGLE_MEET';
ALTER TABLE "ConsultTherapistProfile" ALTER COLUMN "videoProvider" SET DEFAULT 'BUILT_IN';
-- Old meet.jit.si names on future bookings are dropped; rooms are made on first join now.
UPDATE "ConsultBooking" b SET "videoRoomName" = NULL
  FROM "ConsultAvailability" a
  WHERE b."availabilityId" = a."id" AND a."startsAt" > now() AND b."videoRoomName" NOT LIKE 'http%';
```

Add to the env template, with comments:

```
DAILY_API_KEY=
JAAS_APP_ID=
JAAS_KEY_ID=
JAAS_PRIVATE_KEY=
VIDEO_DAILY_MONTHLY_MINUTES=9500
VIDEO_JAAS_MONTHLY_USERS=23
DAILY_WEBHOOK_SECRET=
```

- [ ] **Step 2:** Run `npx prisma migrate deploy && npx prisma generate`. Expected: applied.
- [ ] **Step 3: Commit.** `git commit -m "VID-01: booking video provider, participant usage records, built-in video as the default"`

---

### Task 2: Providers (Daily, JaaS, Link)

**Files:**
- Create: `apps/api/src/modules/video/video-provider.ts`, `daily.provider.ts`, `jaas.provider.ts`, `link.provider.ts`
- Test: `apps/api/src/modules/video/providers.spec.ts`
- Run: `cd apps/api && npm install jose` (if `jose` isn't already a dependency)

**Interfaces:**
- Produces:

```ts
// video-provider.ts
export type ProviderKey = 'DAILY' | 'JAAS' | 'LINK';
export interface RoomWindow { opensAt: Date; closesAt: Date }
export interface Participant { profileId: bigint; name: string; owner: boolean }
export type JoinCredentials =
  | { provider: 'DAILY'; roomUrl: string; token: string }
  | { provider: 'JAAS'; appId: string; roomName: string; jwt: string }
  | { provider: 'LINK'; url: string }
  | { provider: 'GOOGLE_MEET'; url: string };
export interface VideoProvider {
  readonly key: ProviderKey;
  available(): boolean;
  /** Returns the room's name (stored on the booking). Throws on provider failure. */
  createRoom(bookingId: bigint, window: RoomWindow): Promise<string>;
  credentials(roomName: string, who: Participant, window: RoomWindow): Promise<JoinCredentials>;
}
export const VIDEO_PROVIDERS = Symbol('VIDEO_PROVIDERS');
```

- [ ] **Step 1: Write the failing tests**

```ts
// apps/api/src/modules/video/providers.spec.ts
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { DailyProvider } from './daily.provider';
import { JaasProvider } from './jaas.provider';
import { LinkProvider } from './link.provider';

const window = { opensAt: new Date('2026-10-06T09:45:00Z'), closesAt: new Date('2026-10-06T11:50:00Z') };
const therapist = { profileId: 7n, name: 'Sarah Smith', owner: true };

describe('Daily', () => {
  beforeEach(() => { process.env.DAILY_API_KEY = 'dk'; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.DAILY_API_KEY; });

  it('is unavailable without a key', () => {
    delete process.env.DAILY_API_KEY;
    expect(new DailyProvider().available()).toBe(false);
  });

  it('creates a private room that closes with the window', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: 'ud-900-x', url: 'https://ud.daily.co/ud-900-x' }) });
    vi.stubGlobal('fetch', fetchMock);
    const name = await new DailyProvider().createRoom(900n, window);
    expect(name).toBe('ud-900-x');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.daily.co/v1/rooms');
    expect(body.privacy).toBe('private');
    expect(body.properties.exp).toBe(Math.floor(window.closesAt.getTime() / 1000));
    expect(body.name).toMatch(/^ud-900-[a-f0-9]{16}$/);
  });

  it('gives each person a token for that room, owner only for the therapist', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ domain_name: 'ud' }) });
    vi.stubGlobal('fetch', fetchMock);
    const creds = await new DailyProvider().credentials('ud-900-x', therapist, window);
    expect(creds).toEqual({ provider: 'DAILY', roomUrl: 'https://ud.daily.co/ud-900-x', token: 'tok' });
    const props = JSON.parse(fetchMock.mock.calls[0][1].body).properties;
    expect(props).toMatchObject({ room_name: 'ud-900-x', is_owner: true, user_name: 'Sarah Smith', user_id: '7', exp: Math.floor(window.closesAt.getTime() / 1000) });
  });

  it('throws when Daily refuses, so the router can fall through', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({ error: 'payment-required' }) }));
    await expect(new DailyProvider().createRoom(900n, window)).rejects.toThrow(/Daily/);
  });
});

describe('JaaS', () => {
  it('signs an RS256 token for the room with our key id, moderator only for the therapist', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.JAAS_APP_ID = 'vpaas-magic-cookie-abc';
    process.env.JAAS_KEY_ID = 'vpaas-magic-cookie-abc/k1';
    process.env.JAAS_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const p = new JaasProvider();
    expect(p.available()).toBe(true);
    const room = await p.createRoom(900n, window);
    const creds: any = await p.credentials(room, { profileId: 5n, name: 'Ada Okafor', owner: false }, window);
    expect(creds.provider).toBe('JAAS');
    expect(decodeProtectedHeader(creds.jwt)).toMatchObject({ alg: 'RS256', kid: 'vpaas-magic-cookie-abc/k1' });
    const claims: any = decodeJwt(creds.jwt);
    expect(claims).toMatchObject({ aud: 'jitsi', iss: 'chat', sub: 'vpaas-magic-cookie-abc', room, exp: Math.floor(window.closesAt.getTime() / 1000) });
    expect(claims.context.user).toMatchObject({ name: 'Ada Okafor', id: '5', moderator: 'false' });
  });
});

describe('Link', () => {
  it('always works and points at a long random meet.jit.si room', async () => {
    const p = new LinkProvider();
    const room = await p.createRoom(900n, window);
    expect(room).toMatch(/^unclutterdesk-[a-f0-9]{32}$/);
    expect(await p.credentials(room, therapist, window)).toEqual({ provider: 'LINK', url: `https://meet.jit.si/${room}` });
  });
});
```

- [ ] **Step 2: Run it, to see it fail.** Run: `cd apps/api && npx vitest run src/modules/video/providers.spec.ts`. Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

```ts
// daily.provider.ts
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JoinCredentials, Participant, RoomWindow, VideoProvider } from './video-provider';

const API = 'https://api.daily.co/v1';
const unix = (d: Date) => Math.floor(d.getTime() / 1000);

@Injectable()
export class DailyProvider implements VideoProvider {
  readonly key = 'DAILY' as const;
  private domain: string | null = null;

  available() { return !!process.env.DAILY_API_KEY; }

  private async call(path: string, init: RequestInit = {}) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}`, 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Daily ${path} failed: ${res.status} ${(data as any)?.error ?? ''}`);
    return data as any;
  }

  async createRoom(bookingId: bigint, window: RoomWindow) {
    const room = await this.call('/rooms', {
      method: 'POST',
      body: JSON.stringify({
        name: `ud-${bookingId}-${randomBytes(8).toString('hex')}`,
        privacy: 'private',
        properties: { nbf: unix(window.opensAt), exp: unix(window.closesAt), eject_at_room_exp: true, enable_chat: true, enable_screenshare: true, max_participants: 6 },
      }),
    });
    return room.name as string;
  }

  async credentials(roomName: string, who: Participant, window: RoomWindow): Promise<JoinCredentials> {
    const { token } = await this.call('/meeting-tokens', {
      method: 'POST',
      body: JSON.stringify({ properties: { room_name: roomName, is_owner: who.owner, user_name: who.name, user_id: who.profileId.toString(), exp: unix(window.closesAt), eject_at_token_exp: true } }),
    });
    if (!this.domain) this.domain = (await this.call('/')).domain_name;
    return { provider: 'DAILY', roomUrl: `https://${this.domain}.daily.co/${roomName}`, token };
  }
}
```

(`GET /v1/` returns the domain's settings, including `domain_name`. Confirm this in the Daily REST docs via Context7. If it differs, read the room URL from `GET /v1/rooms/:name` → `url` instead, and update the test's second fetch mock to match.)

```ts
// jaas.provider.ts
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SignJWT, importPKCS8 } from 'jose';
import { JoinCredentials, Participant, RoomWindow, VideoProvider } from './video-provider';

@Injectable()
export class JaasProvider implements VideoProvider {
  readonly key = 'JAAS' as const;
  available() { return !!(process.env.JAAS_APP_ID && process.env.JAAS_KEY_ID && process.env.JAAS_PRIVATE_KEY); }

  async createRoom(bookingId: bigint) {
    // JaaS rooms exist when the first person with a valid token joins.
    return `ud-${bookingId}-${randomBytes(12).toString('hex')}`;
  }

  async credentials(roomName: string, who: Participant, window: RoomWindow): Promise<JoinCredentials> {
    const appId = process.env.JAAS_APP_ID!;
    const key = await importPKCS8(process.env.JAAS_PRIVATE_KEY!.replace(/\\n/g, '\n'), 'RS256');
    const jwt = await new SignJWT({
      room: roomName,
      context: {
        user: { id: who.profileId.toString(), name: who.name, moderator: who.owner ? 'true' : 'false' },
        features: { recording: 'false', livestreaming: 'false', transcription: 'false', 'outbound-call': 'false' },
      },
    })
      .setProtectedHeader({ alg: 'RS256', kid: process.env.JAAS_KEY_ID!, typ: 'JWT' })
      .setAudience('jitsi')
      .setIssuer('chat')
      .setSubject(appId)
      .setNotBefore(Math.floor(window.opensAt.getTime() / 1000))
      .setExpirationTime(Math.floor(window.closesAt.getTime() / 1000))
      .sign(key);
    return { provider: 'JAAS', appId, roomName, jwt };
  }
}
```

```ts
// link.provider.ts
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JoinCredentials, VideoProvider } from './video-provider';

/** Last resort: a long random meet.jit.si room, opened in a new tab. */
@Injectable()
export class LinkProvider implements VideoProvider {
  readonly key = 'LINK' as const;
  available() { return true; }
  async createRoom() { return `unclutterdesk-${randomBytes(16).toString('hex')}`; }
  async credentials(roomName: string): Promise<JoinCredentials> { return { provider: 'LINK', url: `https://meet.jit.si/${roomName}` }; }
}
```

- [ ] **Step 4: Run, to see it pass.** Run: `cd apps/api && npx vitest run src/modules/video/providers.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "VID-01: Daily, JaaS and link video providers behind one interface"`

---

### Task 3: Usage records and the budget router

**Files:**
- Create: `apps/api/src/modules/video/video-usage.service.ts`, `video-router.service.ts`
- Test: `apps/api/src/modules/video/router-usage.spec.ts`

**Interfaces:**
- Consumes: `VideoProvider` and the providers (Task 2), `VideoParticipant` (Task 1).
- Produces:
  - `monthStart(now: Date): Date`: midnight on the 1st in WAT, as a UTC `Date`.
  - `VideoUsageService.recordJoin(input: { tenantId: bigint; bookingId: bigint; profileId: bigint; provider: string; role: string }): Promise<bigint>`: the participant ID. It reuses an existing row for the same booking and profile if `lastSeenAt` is within 2 minutes.
  - `VideoUsageService.heartbeat(participantId: bigint, profileId: bigint): Promise<void>`: sets `lastSeenAt = now` and `minutes = ceil((now - joinedAt)/60000)`. It only affects the caller's own row (`profileId` match) and isn't reconciled.
  - `VideoUsageService.dailyMinutesThisMonth(now?: Date): Promise<number>`
  - `VideoUsageService.jaasUsersThisMonth(now?: Date): Promise<number>`: distinct `profileId` with provider `JAAS`.
  - `VideoUsageService.report(month: string /* 'YYYY-MM' */): Promise<{ month; totals: { provider; minutes; participants }[]; practices: { tenantId; name; provider; minutes; sessions }[] }>`
  - `VideoRouter.choose(now?: Date): Promise<VideoProvider>`: Daily if available and under budget, then JaaS if available and under budget, then Link. Budgets come from the env (Global Constraints).

- [ ] **Step 1: Write the failing tests**

```ts
// apps/api/src/modules/video/router-usage.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { VideoRouter } from './video-router.service';
import { VideoUsageService, monthStart } from './video-usage.service';

const provider = (key: string, available = true) => ({ key, available: () => available }) as any;

function router({ dailyMin = 0, jaasUsers = 0, dailyOk = true, jaasOk = true } = {}) {
  const usage: any = { dailyMinutesThisMonth: vi.fn().mockResolvedValue(dailyMin), jaasUsersThisMonth: vi.fn().mockResolvedValue(jaasUsers) };
  return new VideoRouter(usage, [provider('DAILY', dailyOk), provider('JAAS', jaasOk), provider('LINK')]);
}

describe('choosing a provider for a new room', () => {
  it('uses Daily while under its monthly minutes', async () => {
    expect((await router({ dailyMin: 9499 }).choose()).key).toBe('DAILY');
  });
  it('moves to JaaS once Daily reaches the limit', async () => {
    expect((await router({ dailyMin: 9500 }).choose()).key).toBe('JAAS');
  });
  it('moves to a link once JaaS reaches its users', async () => {
    expect((await router({ dailyMin: 9500, jaasUsers: 23 }).choose()).key).toBe('LINK');
  });
  it('skips a provider without keys', async () => {
    expect((await router({ dailyOk: false }).choose()).key).toBe('JAAS');
  });
  it('reads the limits from the environment', async () => {
    process.env.VIDEO_DAILY_MONTHLY_MINUTES = '100';
    expect((await router({ dailyMin: 100 }).choose()).key).toBe('JAAS');
    delete process.env.VIDEO_DAILY_MONTHLY_MINUTES;
  });
});

describe('usage', () => {
  it('starts the month at midnight WAT', () => {
    expect(monthStart(new Date('2026-10-31T23:30:00Z')).toISOString()).toBe('2026-10-31T23:00:00.000Z');
    expect(monthStart(new Date('2026-10-15T12:00:00Z')).toISOString()).toBe('2026-09-30T23:00:00.000Z');
  });

  it('counts minutes up to the last heartbeat, only on the caller\'s own row', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-06T10:12:30Z'));
    const prisma: any = { videoParticipant: { findFirst: vi.fn().mockResolvedValue({ id: 1n, joinedAt: new Date('2026-10-06T10:00:00Z') }), updateMany: vi.fn() } };
    await new VideoUsageService(prisma).heartbeat(1n, 5n);
    expect(prisma.videoParticipant.findFirst.mock.calls[0][0].where).toMatchObject({ id: 1n, profileId: 5n, reconciled: false });
    expect(prisma.videoParticipant.updateMany.mock.calls[0][0].data).toMatchObject({ minutes: 13 });
    vi.useRealTimers();
  });

  it('sums Daily minutes since the start of the month', async () => {
    const prisma: any = { videoParticipant: { aggregate: vi.fn().mockResolvedValue({ _sum: { minutes: 420 } }) } };
    expect(await new VideoUsageService(prisma).dailyMinutesThisMonth(new Date('2026-10-15T12:00:00Z'))).toBe(420);
    expect(prisma.videoParticipant.aggregate.mock.calls[0][0].where).toMatchObject({ provider: 'DAILY', joinedAt: { gte: new Date('2026-09-30T23:00:00Z') } });
  });
});
```

- [ ] **Step 2: Run, to see it fail.**

- [ ] **Step 3: Implement**

```ts
// video-usage.service.ts (core)
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const WAT_OFFSET_MS = 60 * 60 * 1000; // Africa/Lagos is UTC+1 all year

export function monthStart(now: Date): Date {
  const wat = new Date(now.getTime() + WAT_OFFSET_MS);
  return new Date(Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), 1) - WAT_OFFSET_MS);
}

@Injectable()
export class VideoUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async recordJoin(input: { tenantId: bigint; bookingId: bigint; profileId: bigint; provider: string; role: string }) {
    const recent = await this.prisma.videoParticipant.findFirst({
      where: { bookingId: input.bookingId, profileId: input.profileId, lastSeenAt: { gte: new Date(Date.now() - 2 * 60_000) } },
      orderBy: { joinedAt: 'desc' },
    });
    if (recent) return recent.id;
    const row = await this.prisma.videoParticipant.create({ data: input });
    return row.id;
  }

  async heartbeat(participantId: bigint, profileId: bigint) {
    const row = await this.prisma.videoParticipant.findFirst({ where: { id: participantId, profileId, reconciled: false } });
    if (!row) return;
    const now = new Date();
    await this.prisma.videoParticipant.updateMany({
      where: { id: row.id, reconciled: false },
      data: { lastSeenAt: now, minutes: Math.ceil((now.getTime() - row.joinedAt.getTime()) / 60_000) },
    });
  }

  async dailyMinutesThisMonth(now = new Date()) {
    const r = await this.prisma.videoParticipant.aggregate({ where: { provider: 'DAILY', joinedAt: { gte: monthStart(now) } }, _sum: { minutes: true } });
    return r._sum.minutes ?? 0;
  }

  async jaasUsersThisMonth(now = new Date()) {
    const rows = await this.prisma.videoParticipant.findMany({ where: { provider: 'JAAS', joinedAt: { gte: monthStart(now) } }, distinct: ['profileId'], select: { profileId: true } });
    return rows.length;
  }
}
```

`report(month)`: group by `provider` (`groupBy` with `_sum.minutes` and `_count.profileId`), and by `tenantId` + `provider` (`_sum.minutes`, and `_count` of distinct bookings via a second `findMany` with `distinct: ['bookingId']`). Join tenant names with one `tenant.findMany({ where: { id: { in } } })`. Months parse `YYYY-MM` and use `monthStart` for the range `[start, nextStart)`. Add a test for one month containing two practices on two providers.

```ts
// video-router.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { VIDEO_PROVIDERS, VideoProvider } from './video-provider';
import { VideoUsageService } from './video-usage.service';

const limit = (name: string, fallback: number) => Number(process.env[name] ?? fallback);

/** VID-01: Daily while its monthly budget lasts, then JaaS, then a link. */
@Injectable()
export class VideoRouter {
  constructor(private readonly usage: VideoUsageService, @Inject(VIDEO_PROVIDERS) private readonly providers: VideoProvider[]) {}

  private get(key: string) { return this.providers.find((p) => p.key === key && p.available()); }

  async choose(now = new Date()): Promise<VideoProvider> {
    const daily = this.get('DAILY');
    if (daily && (await this.usage.dailyMinutesThisMonth(now)) < limit('VIDEO_DAILY_MONTHLY_MINUTES', 9500)) return daily;
    const jaas = this.get('JAAS');
    if (jaas && (await this.usage.jaasUsersThisMonth(now)) < limit('VIDEO_JAAS_MONTHLY_USERS', 23)) return jaas;
    return this.get('LINK')!;
  }

  /** The next provider after one that failed to create a room. */
  after(key: string): VideoProvider {
    const order = ['DAILY', 'JAAS', 'LINK'];
    for (const k of order.slice(order.indexOf(key) + 1)) { const p = this.get(k); if (p) return p; }
    return this.get('LINK')!;
  }

  byKey(key: string) { return this.get(key) ?? this.get('LINK')!; }
}
```

- [ ] **Step 4: Run, to see it pass.**
- [ ] **Step 5: Commit.** `git commit -m "VID-01: session-minute records and a monthly-budget provider router"`

---

### Task 4: Joining a session's room (access, window, one room, credentials)

**Files:**
- Create: `apps/api/src/modules/video/video-room.service.ts`, `video.controller.ts`, `video.module.ts`
- Modify: `apps/api/src/app.module.ts` (import `VideoModule`)
- Modify: `apps/api/src/client-surface.spec.ts` (review the new client-callable routes)
- Test: `apps/api/src/modules/video/video-room.spec.ts`

**Interfaces:**
- Consumes: `VideoRouter`, `VideoUsageService`, the providers.
- Produces:
  - `VideoRoomService.join(tenantId: bigint, bookingId: bigint, caller: { profileId: bigint; canSeeClinical: boolean }, now?: Date): Promise<JoinCredentials & { participantId: string | null; closesAt: string; role: 'THERAPIST' | 'CLIENT' | 'STAFF' }>`
  - `POST /v1/video/bookings/:id/join` (any authenticated profile in the tenant; the service decides access)
  - `POST /v1/video/participants/:id/heartbeat`

`join` rules:
1. Load the booking scoped to the tenant (`where: { id, tenantId }`), with `availability` (`startsAt`, `endsAt`, `providerProfileId`), `client`, the therapist profile (`videoProvider`, `googleRefreshToken`) and names. If it's missing → 404.
2. Role:
   - the caller is `clientProfileId` → `CLIENT`;
   - the caller is `availability.providerProfileId` → `THERAPIST` (owner);
   - otherwise `caller.canSeeClinical` → `STAFF` (owner);
   - otherwise 404 (don't reveal that it exists).
3. `status !== 'CONFIRMED'` → 403 "This session isn't confirmed yet."
4. Window: `opensAt = startsAt − 15 min`, `closesAt = endsAt + 60 min`.
   - `now < opensAt` → 403 "This room opens at {h:mm a WAT}."
   - `now > closesAt` → 403 "This session has ended."
5. **Google Meet:** the therapist's `videoProvider === 'GOOGLE_MEET'` and `booking.videoRoomName?.startsWith('https://meet.google.com')` → `{ provider: 'GOOGLE_MEET', url }`, with `participantId: null`. No usage is recorded, because we can't see Meet's time.
6. **Room once:**
   - If `booking.videoProvider` is set, use `router.byKey(booking.videoProvider)` and the stored `videoRoomName`.
   - Otherwise, `p = await router.choose(now)`. Try `p.createRoom`; on throw, `p = router.after(p.key)` and retry (at most 3 attempts).
   - Then `updateMany({ where: { id, videoProvider: null }, data: { videoProvider: p.key, videoRoomName: name } })`. If the count is 0, someone else won: reload the booking and use their provider and room.
7. `credentials(room, { profileId, name, owner: role !== 'CLIENT' }, window)`, then `usage.recordJoin(...)` for embedded providers and `LINK`, and return the result.

- [ ] **Step 1: Write the failing tests** in `video-room.spec.ts`, covering each rule with Prisma stand-ins and fake providers:
  - the client of the booking gets `DAILY` credentials and a `participantId`;
  - a stranger gets `NotFoundException`;
  - a `PENDING_PAYMENT` booking gets `ForbiddenException` with "confirmed";
  - 20 minutes early gets `ForbiddenException` whose message contains "opens at";
  - an existing `videoProvider: 'JAAS'` is reused, and `router.choose` isn't called;
  - Daily's `createRoom` rejects, so JaaS is used, and the stored provider is `JAAS`;
  - a lost race (`updateMany` count 0) reloads the booking and uses the winner's room, and only the winner's `createRoom` result is stored;
  - a Google Meet therapist gets `{ provider: 'GOOGLE_MEET', url }`, and no usage is recorded.

```ts
// skeleton for the fakes
const fakeProvider = (key: string, opts: { fail?: boolean } = {}) => ({
  key,
  available: () => true,
  createRoom: opts.fail ? vi.fn().mockRejectedValue(new Error(`${key} down`)) : vi.fn().mockResolvedValue(`${key.toLowerCase()}-room`),
  credentials: vi.fn(async (room: string) => (key === 'DAILY' ? { provider: 'DAILY', roomUrl: `https://ud.daily.co/${room}`, token: 't' } : key === 'JAAS' ? { provider: 'JAAS', appId: 'a', roomName: room, jwt: 'j' } : { provider: 'LINK', url: `https://meet.jit.si/${room}` })),
});
```

- [ ] **Step 2: Run, to see it fail.**
- [ ] **Step 3: Implement** the service per the rules, plus the controller:

```ts
@Controller('v1/video')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VideoController {
  constructor(private readonly rooms: VideoRoomService, private readonly usage: VideoUsageService) {}

  @Permissions('any.authenticated')
  @Post('bookings/:id/join')
  join(@Req() req: any, @Param('id') id: string) {
    return this.rooms.join(authenticatedTenantId(req), BigInt(id), {
      profileId: authenticatedProfileId(req),
      canSeeClinical: hasPermission(req, 'clinical.record'),
    });
  }

  @Permissions('any.authenticated')
  @Post('participants/:id/heartbeat')
  async heartbeat(@Req() req: any, @Param('id') id: string) {
    await this.usage.heartbeat(BigInt(id), authenticatedProfileId(req));
    return { ok: true };
  }
}
```

(Find the existing helper that checks a permission on the request: `grep -rn "clinical.record" apps/api/src/common`. Use it rather than writing `hasPermission`.) In `video.module.ts`:
- provide `DailyProvider`, `JaasProvider` and `LinkProvider`;
- provide `{ provide: VIDEO_PROVIDERS, useFactory: (d, j, l) => [d, j, l], inject: [DailyProvider, JaasProvider, LinkProvider] }`;
- provide `VideoUsageService`, `VideoRouter`, `VideoRoomService` and `PrismaService`;
- export `VideoUsageService`.

- [ ] **Step 4: Run the API suite, including `client-surface.spec.ts` and the tenant-isolation check.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "VID-01: join a session's room, made once per booking, with access and time-window checks"`

---

### Task 5: Daily reconciliation, admin usage report, and stop making rooms at booking

**Files:**
- Modify: `apps/api/src/modules/video/video.controller.ts` (the Daily webhook), `video-usage.service.ts` (`reconcileDaily(roomName)`)
- Modify: `apps/api/src/modules/admin/admin.controller.ts` (`GET /v1/admin/video-usage?month=YYYY-MM`, `PlatformAdminGuard`)
- Modify: `apps/api/src/modules/consult/consult.service.ts`:
  - remove `resolveVideoRoomLink` and the `videoRoomName` it sets in `createBooking`;
  - staff-made bookings: `grep -rn resolveVideoRoomLink apps/api/src` and remove those calls too;
  - **keep** the Google Meet link that `calendar.service.ts` writes to `videoRoomName` when the Google event is created.
- Modify: `apps/api/src/modules/notifications/booking-notifier.service.ts`: `roomLink` becomes `${tenantWebOrigin(b.tenant)}/portal/sessions/${b.id}/room` for online sessions. Google Meet bookings still show the Meet URL.
- Test: `video-reconcile.spec.ts`, plus updates to the notifier and consult specs that asserted meet.jit.si links.

**Interfaces:**
- `POST /v1/video/webhooks/daily` (public). It verifies Daily's HMAC signature with `DAILY_WEBHOOK_SECRET`; check the header names and algorithm in the Daily webhook docs via Context7 before implementing. On `meeting.ended`, it calls `reconcileDaily(payload.room)`.
- `reconcileDaily(roomName)`:
  - `GET /v1/meetings?room=<roomName>` to get `participants[{ user_id, duration }]`.
  - For the booking with `videoRoomName = roomName`, set each `VideoParticipant` (matched by `profileId = user_id`) to `minutes = ceil(sum(duration)/60)` and `reconciled = true`.

- [ ] **Step 1: Write the failing tests:**
  - reconciliation replaces the heartbeat minutes with Daily's (two participants: 1810 s → 31 min, 1795 s → 30 min) and marks them reconciled;
  - an invalid signature gets 401 and changes nothing;
  - the admin report returns totals per provider and per practice for `2026-10`;
  - the confirmed email's join link is `https://<practice origin>/portal/sessions/900/room`;
  - `createBooking` no longer returns a meet.jit.si `videoRoomLink`.
- [ ] **Step 2: Run, to see them fail.**
- [ ] **Step 3: Implement.** The webhook route needs the raw body for the HMAC. Check how the Paystack webhook gets its raw body (`grep -rn rawBody apps/api/src/main.ts apps/api/src/modules/billing`) and do the same.
- [ ] **Step 4: Run the full API suite and typecheck.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "VID-01: Daily minutes reconciled from its own records, an admin usage report, join links into the app"`

---

### Task 6: The app's video stage (Daily, JaaS, link) and the two room pages

**Files:**
- Run: `cd apps/app && npm install @daily-co/daily-js @daily-co/daily-react @jitsi/react-sdk` (`daily-react` needs `jotai`; install it if npm warns).
- Create in `apps/app/src/components/video/`:
  - `types.ts`: `JoinResponse` (mirrors `JoinCredentials` + `participantId`, `closesAt`, `role`) and `CallControls { muted; cameraOff; sharing; toggleMic(); toggleCamera(); toggleShare(); leave() }`.
  - `ControlBar.tsx`: the designed bar from `TelehealthVideoRoomPage` (MUTE, CAMERA, SHARE, plus optional extra buttons such as NOTES, and **End session** / **Leave**), driven by `CallControls`.
  - `DailyStage.tsx`: `Daily.createCallObject()`, then `join({ url: roomUrl, token })`, inside `<DailyProvider callObject>`. A grid of `<DailyVideo sessionId automirror>` for `useParticipantIds()` plus the screen share from `useScreenShare()`. The controls come from `useLocalSessionId`, `useAudioTrack`, `useVideoTrack` and `daily.setLocalAudio`/`setLocalVideo`/`startScreenShare`/`stopScreenShare`/`leave`. "Waiting for {other person} to join" shows while alone.
  - `JaasStage.tsx`: `<JaaSMeeting appId roomName={`${appId}/${roomName}`} jwt configOverwrite={{ prejoinPageEnabled: false, toolbarButtons: [], disableDeepLinking: true }} interfaceConfigOverwrite={{ MOBILE_APP_PROMO: false }} onApiReady={…} getIFrameRef={(n) => (n.style.height = '100%')} />`. The controls call `api.executeCommand('toggleAudio' | 'toggleVideo' | 'toggleShareScreen' | 'hangup')`, and state follows the `audioMuteStatusChanged`, `videoMuteStatusChanged` and `screenSharingStatusChanged` events. (Confirm the room-name format for JaaS in the handbook: the React SDK may prefix `appId` itself. If so, pass `roomName` alone.)
  - `LinkStage.tsx`: a calm panel saying "This session opens in a new tab." with **Open video call** (`window.open(url, '_blank', 'noopener')`). The copy names Google Meet when `provider === 'GOOGLE_MEET'`.
  - `useHeartbeat.ts`: while mounted and `participantId` is set, `POST /v1/video/participants/:id/heartbeat` every 60 s, plus one on `visibilitychange` to hidden.
  - `VideoStage.tsx`: `POST /v1/video/bookings/:id/join` on mount. Shows the loading state, or the 403 message (for example "This room opens at 9:45 AM.", with a **Check again** button). Then it renders the stage for `provider` and `ControlBar`, and starts the heartbeat. Props: `{ bookingId: string; extraButtons?: ControlButton[]; onLeft(): void; endLabel: string }`.
- Modify: `apps/app/src/pages/practice/TelehealthVideoRoomPage.tsx`. Replace the mock tile ("Room preview", initials) and the local `muted`/`videoOff`/`screenSharing` state with `<VideoStage bookingId={id} extraButtons={[NOTES]} endLabel="End session" onLeft={() => setShowEndModal(true)} />`. Keep the notes drawer, the prep data and the end-session modal exactly as they are.
- Create: `apps/app/src/pages/client/ClientSessionRoomPage.tsx`, the same stage, `endLabel="Leave"`, and `onLeft` → `/portal`. The header shows the therapist's name and session time, using the practice brand (`usePracticeBrand`).
- Modify: `apps/app/src/App.tsx`. Add `<Route path="/portal/sessions/:id/room" element={<ClientSessionRoomPage />} />` next to `/portal` (lazy, like the therapist room), under the same client-auth wrapper as `/portal`.
- Modify: the client portal's session list. Its "Join" button goes to `/portal/sessions/:id/room`. Find it with `grep -rn "Join" apps/app/src/pages/client`.
- Test: `apps/app/src/components/video/__tests__/VideoStage.test.tsx`, and the room page tests.

- [ ] **Step 1: Write the failing tests** (mock `@daily-co/daily-react`, `@daily-co/daily-js` and `@jitsi/react-sdk` at the module level, to plain components that render `data-testid` markers and record calls):
  - a Daily join response renders the Daily stage and calls `join({ url, token })`; clicking MUTE calls `setLocalAudio(false)`;
  - a JaaS response renders `JaaSMeeting` with `jwt`, and MUTE calls `executeCommand('toggleAudio')`;
  - a LINK response shows **Open video call**, and clicking it opens the URL in a new tab;
  - a 403 response shows its message and **Check again**;
  - the heartbeat posts after 60 s (fake timers);
  - the therapist page no longer shows "Room preview";
  - the client route renders the stage for `/portal/sessions/900/room`.
- [ ] **Step 2: Run, to see them fail.**
- [ ] **Step 3: Implement** as specified. Use `packages/ui` for buttons and cards. The stage fills the available height. Test the layout at 390px (controls wrap into two rows) and at 1280px.
- [ ] **Step 4: Run the app suite and typecheck.** Expected: PASS. Run `npx vite build` once to make sure the SDKs bundle.
- [ ] **Step 5: Commit.** `git commit -m "VID-01: real video in the session room for therapist and client, Daily or JaaS in the room, links in a new tab"`

---

### Task 7: Choosing video in My profile and setup (ONB-08), and the admin usage page

**Files:**
- Modify: `apps/app/src/pages/practice/MyProfilePage.tsx` (the `videoProvider` select at line ~130)
- Modify: `apps/app/src/pages/practice/OnboardingWizardPage.tsx` (the Services step, `key: 'availability'`)
- Modify: the API therapist-profile update. It accepts only `BUILT_IN` or `GOOGLE_MEET`; `GOOGLE_MEET` requires a connected Google account (`googleRefreshToken`), otherwise 400 "Connect Google Calendar first to use Google Meet."
- Create: `apps/app/src/pages/admin/AdminVideoUsagePage.tsx`, its route `/admin/video` in `App.tsx`, and a nav entry in `PlatformAdminLayout.tsx`.
- Test: the profile, onboarding and admin page tests, and an API spec for the validation.

UI:
- **My profile → Video sessions:** two radio cards.
  - **Unclutter Desk video (recommended):** "Sessions run inside Unclutter Desk. Nothing to install."
  - **Google Meet:** "Uses your connected Google account. Opens in a new tab." It's disabled with "Connect Google Calendar first" when Google isn't connected, linking to where Google is connected today.
- **Setup (ONB-08)**, Services step: one line, "Online sessions run in Unclutter Desk's own video room. You can switch to Google Meet later in My profile." No choice is needed during setup. This satisfies "setup asks about video" without adding a step that has nothing to decide.
- **Admin → Video usage:** a month picker (default this month), then:
  - provider totals (Daily minutes against the limit as a progress bar; JaaS users against the limit);
  - a table of practices × provider minutes and sessions.

- [ ] **Step 1: Write the failing tests:**
  - the profile shows both options, Google Meet is disabled without Google, and saving posts `videoProvider: 'BUILT_IN'`;
  - the onboarding Services step shows the video line;
  - the admin page renders totals and rows from a mocked report;
  - the API rejects `ZOOM` and rejects `GOOGLE_MEET` without Google.
- [ ] **Step 2: Run, to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run both suites and typecheck.**
- [ ] **Step 5: Commit.** `git commit -m "VID-01/ONB-08: choose built-in video or Google Meet; admins see monthly video usage"`

---

### Task 8: Live check and the testing sheet

- [ ] **Step 1:** Put real `DAILY_API_KEY` and JaaS keys in `apps/api/.env`. Start the servers.
- [ ] **Step 2:** Book and confirm a session that starts within 15 minutes (or move a confirmed booking's slot in the database).
  - Open the therapist room in Edge and the client room in a second profile or another browser.
  - Both see and hear each other, and mute, camera, share and leave work.
  - Heartbeat rows grow.
- [ ] **Step 3:** Set `VIDEO_DAILY_MONTHLY_MINUTES=0` and restart. A new booking's room is created on JaaS and works in the room. Then set `VIDEO_JAAS_MONTHLY_USERS=0`: the next one shows **Open video call** (meet.jit.si).
- [ ] **Step 4:** End a Daily call. Within a minute of `meeting.ended` (use a tunnel such as `cloudflared` for the webhook, or call `reconcileDaily` by hand), the participants are reconciled. `/admin/video` shows the minutes.
- [ ] **Step 5:** In `docs/testing-feedback.md`, set VID-01 and ONB-08 to **Fixed**, with the commits and what Steps 2–4 showed. Commit.
