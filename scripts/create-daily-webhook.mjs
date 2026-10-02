// VID-01: subscribe Daily's meeting.ended event to our API, so each call's
// minutes come from Daily's own records. Daily has no dashboard screen for
// webhooks; they are created through its API, which this does.
//
// Run on the server, from the app folder, AFTER the API with the video code is
// deployed and restarted with DAILY_WEBHOOK_SECRET set (Daily checks the
// endpoint answers before it creates the webhook):
//   node --env-file=.env --env-file=apps/api/.env scripts/create-daily-webhook.mjs
//
// Needs DAILY_API_KEY and DAILY_WEBHOOK_SECRET (a base64 secret you made with
// `openssl rand -base64 32`). Safe to run again: an existing webhook for the
// same address is updated instead of duplicated. Prints no secrets.
const API = 'https://api.daily.co/v1';
const key = process.env.DAILY_API_KEY;
const hmac = process.env.DAILY_WEBHOOK_SECRET;
const url = process.env.DAILY_WEBHOOK_URL || `${(process.env.API_URL || 'https://api.unclutterdesk.com').replace(/\/$/, '')}/v1/video/webhooks/daily`;

if (!key || !hmac) {
  console.error('Set DAILY_API_KEY and DAILY_WEBHOOK_SECRET first (see docs/VPS_PREPARATION.md).');
  process.exit(1);
}
if (!/^[A-Za-z0-9+/]+=*$/.test(hmac)) {
  console.error('DAILY_WEBHOOK_SECRET must be base64, e.g. the output of: openssl rand -base64 32');
  process.exit(1);
}

async function daily(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${body.error ?? ''} ${body.info ?? ''}`.trim());
  return body;
}

const existing = await daily('/webhooks');
const list = Array.isArray(existing) ? existing : existing.data ?? [];
const mine = list.find((w) => w.url === url);
const body = JSON.stringify({ url, eventTypes: ['meeting.ended'], hmac });
const saved = mine
  ? await daily(`/webhooks/${mine.uuid}`, { method: 'POST', body })
  : await daily('/webhooks', { method: 'POST', body });

console.log(`${mine ? 'Updated' : 'Created'} the Daily webhook → ${saved.url} (${saved.state ?? 'ACTIVE'}), events: ${(saved.eventTypes ?? []).join(', ')}`);
