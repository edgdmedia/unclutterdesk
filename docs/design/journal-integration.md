# Desk ↔ Unclutter Journal: a practitioner's plan, in the client's Journal

Status: **agreed** (2026-11-10). The client links her own account; the
practitioner writes the prompts; Desk sees progress always and an entry's
words only when the client shares that entry; both repos follow the same rules
(fresh worktree, PR, never push to a deploying branch directly).

Environments: the Suite's `development` branch deploys the **test** Suite API;
`main` deploys production. Journal is at `https://journal.unclutter.com.ng`;
the Suite API at `https://api.unclutter.com.ng/v1`.

## 1. What it is for

After a session the practitioner often sets a daily practice: "Days 1–5, sit
quietly for ten minutes and notice your day; from day 6, one question a day."
Today that lives in the recap as tick-boxes. Unclutter Journal already does
daily delivery well (a series of prompts, the subscriber's own cadence and
time, reminders, responses kept in her journal). This joins the two:

- the practitioner writes a short **Journal plan** beside the recap in Desk;
- the client chooses **Add to my Unclutter Journal** on her portal recap page;
- Journal delivers it, privately, as a series only she can see;
- Desk shows the practitioner **how far she has got**, and the words of any
  entry **she chooses to share** with her practitioner.

Nothing is sent to Journal until she asks. Her journal stays hers.

## 2. Who holds what

| | Desk (unclutterdesk) | Journal (Unclutter Suite, edgdmedia/unclutter) |
|---|---|---|
| The plan as written | `JournalPlan` on the booking (source of truth) | a private copy as a series |
| Delivery, reminders, responses | — | existing prompt-series engine |
| Link between the two accounts | `JournalLink` (client profile ↔ Suite profile) | `DeskLink` (Suite profile ↔ Desk practice + client) |
| Progress | read from Journal, shown, not stored long term | `JournalPromptInstance` (exists) |
| Shared entries | received copies, encrypted like notes | `JournalEntry` + a share record |

Only practices with `ecosystemIntegrationEnabled` (platform-admin switch) see
any of it.

## 3. The plan (Desk)

Written on the session page under the recap. Small and structured, not free
text, so Journal can deliver it:

```ts
JournalPlan {
  title: string                 // "Reflection practice after our first session"
  intro?: string                // shown once, at the start
  steps: Array<
    | { kind: 'repeat'; days: number; prompt: string }      // Days 1–5: the same prompt
    | { kind: 'sequence'; prompts: string[] }               // then one per day, in order
  >
  cadence: 'daily'              // first version; 'weekdays' later
  startsOn: 'next_day' | date   // the client can move it when she adds it
}
```

The recap's tick-box items can be turned into steps with one click, so the
practitioner writes the practice once. Limits: up to 60 prompts in all, each up
to 600 characters.

## 4. Linking accounts (the client, once)

An OAuth-style handshake, so neither side ever sees the other's password and
the link exists only because she completed it:

1. **Portal → Journal.** "Add to my Unclutter Journal" sends her to
   `https://journal.unclutter.com.ng/link/desk?request=<signed>`. The request
   is `base64url(JSON) + "." + base64url(HMAC-SHA256(secret, base64url(JSON)))`
   with JSON `{ v: 1, nonce, iat, exp, practice_name, practitioner_name,
   client_ref, return_url }` (seconds; `exp - iat` at most 10 minutes; the
   nonce is single-use). `return_url` must be https on an allowed Desk origin
   (Suite env `DESK_RETURN_ORIGINS`, default `https://*.unclutterdesk.com`).
   Reference implementation: Suite `apps/api/src/modules/desk-integration/desk-signing.ts`.
2. **Journal.** She signs in or creates her account (existing Suite auth),
   sees exactly what is being linked and what Desk will see (progress; only
   entries she shares), and confirms.
3. **Journal → Desk.** Redirect back to the return URL with `code` (one-time,
   valid 5 minutes) and `state` (the request's nonce, which Desk checks), or
   with `error=declined&state=…` if she said no.
4. **Desk ↔ Journal, server to server.** Desk exchanges the code for a
   `linkId`. From then on every call carries the `linkId`, signed with the
   shared secret. No user tokens cross between the systems.

One link per (practice, client). Either side can end it: she disconnects in
Journal or the portal; the practice's switch going off ends all its links.
Ending a link stops delivery of that practice's series and stops sharing;
nothing she wrote is deleted from her journal.

## 5. The server-to-server API (Journal side)

All under `/v1/integrations/desk/` on the Suite API, each request signed with
headers `X-Desk-Timestamp` (Unix seconds) and `X-Desk-Signature`
= hex `HMAC-SHA256(secret, METHOD + "\n" + pathWithQuery + "\n" + timestamp + "\n" + hex(sha256(exactBodyBytes)))`,
where `pathWithQuery` includes `/v1` (e.g. `/v1/integrations/desk/plans/p_1/progress?link_id=dl_…`)
and an empty body hashes the empty string. Rejected if the timestamp is more
than 5 minutes off. Replays inside that window are harmless: the code exchange
is single-use, plan writes and ends are idempotent, the rest are reads.
Without `DESK_INTEGRATION_SECRET` set, every route answers 503.

| Call | What it does |
|---|---|
| `POST link/exchange { code }` → `{ link_id, profile_name }` | finishes linking |
| `PUT plans/:planRef { link_id, plan, timezone?, delivery_time_local?, starts_on? }` → `{ series_id, subscription_id, days, next_delivery_at }` | creates or replaces her private series and subscribes her (idempotent on `planRef`; carries on from her day). Defaults: `Africa/Lagos`, `08:00`, `next_day` |
| `DELETE plans/:planRef?link_id=` | ends that plan (subscription stops; past entries stay hers) |
| `GET plans/:planRef/progress?link_id=` → `{ status, total, delivered, responded, last_responded_at, next_delivery_at, days: [{ day, delivered_at, responded_at }] }` | progress, no words |
| `GET links/:linkId/shared` → `[{ entry_id, plan_ref, prompt_text, content, written_at, updated_at, shared_at }]` | the entries she shares **now** (Desk replaces its copy, so un-sharing is reflected) |
| `DELETE links/:linkId` | Desk ends the link |

`planRef`: 1–64 of `[A-Za-z0-9_-]`. An unknown or ended link answers 404.

Webhooks (Journal → Desk: `link.ended`, `entry.shared`, `entry.unshared`)
are a later addition; until then Desk polls `progress` and `shared`, and treats
a 404 on the link as "ended".

## 6. Journal changes (Suite)

- `JournalPromptSeries` gains `visibility` (`public` | `private`),
  `ownerProfileId` and `source` (`curated` | `desk`) plus `externalRef`
  (the plan ref). Private series never appear in the catalogue; only the
  owner can subscribe.
- `desk_links` table (link id, Suite profile, practice name, practitioner
  name, Desk client ref, created, ended).
- Entry sharing: on an entry answered from a Desk series, "Share with
  <practitioner>" (off by default) creates a `desk_entry_shares` row; un-sharing
  removes it and tells Desk. Shared means the words of that entry only.
- The `/link/desk` page in the Journal app, and a "Connected practices" list
  in her settings with Disconnect.

## 7. Desk changes

- `JournalPlan` on the session page (practitioner, clinical staff only).
- Portal recap page: "Add to my Unclutter Journal" (when a plan exists and
  the practice has the switch on), the time she wants her prompt, and
  "Connected to your Unclutter Journal · Disconnect" once linked.
- `journal_links`, the plan's `planRef`, received `journal_shared_entries`
  (encrypted like SOAP, clinical staff only).
- Session and client pages: "Journal: 5 of 8 days" and the shared entries.
- A signed client for the Suite API and a webhook receiver; the shared
  secret and the Suite base URL in env.

## 8. Privacy and consent

- Consent is the link itself: she sees, on Journal's own page, what the
  practice will see, and confirms. It is recorded with the time and wording.
- Desk never receives entries she has not shared; progress carries no words.
- Shared entries in Desk are clinical records: encrypted, clinical staff only,
  included in her data export, removed if she un-shares (Desk keeps a note that
  one was shared and withdrawn, not the words).
- Ending the link (either side, or the practice's switch) stops everything
  going forward.

## 9. Order of work

1. **This document** agreed.
2. **Suite PR:** private series, desk links, the signed integration API,
   `/link/desk`, sharing. Its own tests; deployed to an environment we can
   point Desk at.
3. **Desk PR:** the plan, the portal button and handshake, progress, shared
   entries, webhook.
4. End-to-end check with a test client on both sides, then switch it on for
   the founder's practice.

## 10. Settled details

1. **Testing.** Suite PRs go into `development`, which deploys the test Suite
   API; Desk's dev environment points at it. `main` (production) only after
   the end-to-end check.
2. **Addresses.** Journal: `https://journal.unclutter.com.ng` (the
   `/link/desk` page). Suite API: `https://api.unclutter.com.ng/v1`.
3. **Delivery time.** 08:00 in her own timezone unless she chooses another.
4. **When the plan ends**, Journal offers her a curated series to carry on
   with (her choice; nothing is subscribed for her).
