#!/usr/bin/env node
/**
 * Adds the proxy headers the API needs to an nginx site, idempotently.
 *
 *   node scripts/nginx-proxy-headers.mjs                 # show what would change
 *   sudo node scripts/nginx-proxy-headers.mjs --apply    # write, test, reload
 *   sudo node scripts/nginx-proxy-headers.mjs --apply --sse   # also SSE settings
 *   node scripts/nginx-proxy-headers.mjs --file /etc/nginx/sites-available/api
 *
 * Headers go inside the `location` block that proxies to the API, not at server
 * level, because nginx does not merge `proxy_set_header` across levels: a
 * location with even one of its own discards every inherited one, silently.
 *
 * --apply backs the file up, edits it, runs `nginx -t`, and restores the backup
 * automatically if the test fails. It reloads only after a passing test.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const wantSse = args.includes('--sse');
const fileArg = args[args.indexOf('--file') + 1];
const explicitFile = args.includes('--file') ? fileArg : null;

const HEADERS = [
  ['Host', '$host'],
  ['X-Real-IP', '$remote_addr'],
  ['X-Forwarded-For', '$proxy_add_x_forwarded_for'],
  ['X-Forwarded-Proto', '$scheme'],
];

// Server-Sent Events: /v1/notifications/stream arrives in batches, or not at
// all, if nginx buffers it.
const SSE = [
  ['proxy_http_version', '1.1'],
  ['proxy_set_header Connection', '""'],
  ['proxy_buffering', 'off'],
  ['proxy_read_timeout', '3600s'],
];

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// ── Locate the site file ─────────────────────────────────────────────────────
function findCandidates() {
  const dirs = ['/etc/nginx/sites-enabled', '/etc/nginx/sites-available', '/etc/nginx/conf.d'];
  const hits = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const path = resolve(dir, name);
      let text;
      try {
        text = readFileSync(path, 'utf8');
      } catch {
        continue;
      }
      if (/server_name[^;]*api\.unclutterdesk\.com/.test(text) && /proxy_pass/.test(text)) {
        hits.push(path);
      }
    }
  }
  // sites-enabled entries are usually symlinks to sites-available; prefer the
  // real file so the edit is not lost.
  return [...new Set(hits.map((p) => p.replace('/sites-enabled/', '/sites-available/')))];
}

const file = explicitFile || findCandidates()[0];
if (!file) {
  die(
    'Could not find an nginx site for api.unclutterdesk.com. ' +
      'Pass one with --file /etc/nginx/sites-available/<name>',
  );
}
if (!existsSync(file)) die(`${file} does not exist`);

const original = readFileSync(file, 'utf8');
const lines = original.split('\n');

// ── Find the location block containing proxy_pass ────────────────────────────
// Brace counting is enough here: nginx configs are simple, and a wrong guess
// shows up as a failed `nginx -t` rather than a silent misconfiguration.
let proxyPassLine = -1;
let blockStart = -1;
let blockEnd = -1;

for (let i = 0; i < lines.length; i += 1) {
  if (!/^\s*proxy_pass\s/.test(lines[i])) continue;

  let depth = 0;
  for (let j = i; j >= 0; j -= 1) {
    depth += (lines[j].match(/}/g) || []).length;
    depth -= (lines[j].match(/{/g) || []).length;
    if (depth < 0 && /^\s*location\s/.test(lines[j])) {
      blockStart = j;
      break;
    }
  }
  if (blockStart === -1) continue;

  let open = 0;
  for (let j = blockStart; j < lines.length; j += 1) {
    open += (lines[j].match(/{/g) || []).length;
    open -= (lines[j].match(/}/g) || []).length;
    if (open === 0 && j > blockStart) {
      blockEnd = j;
      break;
    }
  }
  proxyPassLine = i;
  break;
}

if (proxyPassLine === -1) die(`No location block with proxy_pass found in ${file}`);

const block = lines.slice(blockStart, blockEnd + 1).join('\n');
const indent = (lines[proxyPassLine].match(/^\s*/) || [''])[0];

// ── Work out what is missing ─────────────────────────────────────────────────
const missing = HEADERS.filter(
  ([name]) => !new RegExp(`^\\s*proxy_set_header\\s+${name}\\b`, 'im').test(block),
);
const missingSse = wantSse
  ? SSE.filter(([directive]) => {
      const head = directive.split(' ')[0];
      const rest = directive.split(' ')[1];
      const pattern = rest
        ? `^\\s*${head}\\s+${rest}\\b`
        : `^\\s*${head}\\b`;
      return !new RegExp(pattern, 'im').test(block);
    })
  : [];

console.log(`\nnginx site: ${file}`);
console.log(`location block: line ${blockStart + 1}-${blockEnd + 1}, proxy_pass on line ${proxyPassLine + 1}\n`);

for (const [name, value] of HEADERS) {
  const has = !missing.some(([n]) => n === name);
  console.log(`  ${has ? '✓' : '+'} proxy_set_header ${name} ${value};`);
}
if (wantSse) {
  for (const [directive, value] of SSE) {
    const has = !missingSse.some(([d]) => d === directive);
    console.log(`  ${has ? '✓' : '+'} ${directive} ${value};`);
  }
}

if (missing.length === 0 && missingSse.length === 0) {
  console.log('\nNothing to change.\n');
  process.exit(0);
}

const additions = [
  ...missing.map(([name, value]) => `${indent}proxy_set_header ${name} ${value};`),
  ...missingSse.map(([directive, value]) => `${indent}${directive} ${value};`),
];

if (!apply) {
  console.log('\nWould insert after proxy_pass:\n');
  for (const line of additions) console.log(line);
  console.log('\nDry run. Re-run with sudo and --apply to write it.\n');
  process.exit(0);
}

// ── Apply, with rollback ─────────────────────────────────────────────────────
const backup = `${file}.bak-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
copyFileSync(file, backup);
console.log(`\nBacked up to ${backup}`);

const updated = [
  ...lines.slice(0, proxyPassLine + 1),
  ...additions,
  ...lines.slice(proxyPassLine + 1),
].join('\n');

writeFileSync(file, updated);
console.log(`Wrote ${additions.length} line(s) to ${file}`);

try {
  execFileSync('nginx', ['-t'], { stdio: 'pipe' });
  console.log('nginx -t passed');
} catch (e) {
  copyFileSync(backup, file);
  console.error(String(e.stderr || e.message));
  die(`nginx rejected the result — ${file} restored from ${backup}, nothing reloaded`);
}

try {
  execFileSync('systemctl', ['reload', 'nginx'], { stdio: 'pipe' });
  console.log('nginx reloaded\n');
} catch (e) {
  die(`Config is valid but reload failed: ${String(e.stderr || e.message).trim()}`);
}
