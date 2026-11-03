import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { profilesConfig } from '../config';
import { safeHttpsUrl, safeJsonLd, securityHeaders } from '../security';

const config = profilesConfig({ API_URL: 'https://api.example.test', MEDIA_URL: 'https://media.example.test' });

describe('security headers (§4.3)', () => {
  const h = securityHeaders(config);
  it('sets the strict CSP from the spec', () => {
    const csp = h['Content-Security-Policy'];
    for (const part of [
      "default-src 'none'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data: https://media.example.test",
      "font-src 'self'",
      'connect-src https://api.example.test',
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self' https://api.example.test",
    ]) expect(csp).toContain(part);
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
  });
  it('sets nosniff and the referrer policy', () => {
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });
});

describe('links and structured data are inert (§4.3 #4, §6.11)', () => {
  it.each(['javascript:alert(1)', 'http://x.test', 'https://user:pw@x.test', 'data:text/html,<b>', '', null, 42])('refuses %j as a link', (v) => {
    expect(safeHttpsUrl(v)).toBeNull();
  });
  it('keeps https links', () => {
    expect(safeHttpsUrl(' https://ada.example/x ')).toBe('https://ada.example/x');
  });
  it('escapes JSON-LD so therapist text cannot close the script element', () => {
    const out = safeJsonLd({ name: '</script><script>alert(1)</script>', other: 'a & b  ' });
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script>');
  });
});

/** Every source file of the site, for rules that must hold everywhere. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (n === '__tests__' ? [] : files(p)) : [p];
  });
}
const SRC = resolve(__dirname, '../..');
const sources = files(SRC).map((f) => ({ f: f.slice(SRC.length + 1), text: readFileSync(f, 'utf8') }));

describe('the renderer never trusts the visitor (§4.3 #1, #4)', () => {
  it('never reads cookies or Authorization', () => {
    for (const { f, text } of sources) {
      expect(text, f).not.toMatch(/Astro\.cookies|\.cookies\b|headers\.get\(\s*['"](cookie|authorization)['"]/i);
    }
  });
  it('renders therapist text as text: set:html only for the escaped JSON-LD', () => {
    for (const { f, text } of sources) {
      for (const m of text.matchAll(/set:html=\{([^}]*)\}/g)) expect(m[1], f).toMatch(/^safeJsonLd\(/);
      expect(text, f).not.toMatch(/dangerouslySetInnerHTML|\.innerHTML\b|set:text=|from ['"](marked|markdown-it|remark|micromark)/);
    }
  });
  it('ships no client scripts and no inline styles', () => {
    for (const { f, text } of sources.filter((s) => s.f.endsWith('.astro'))) {
      for (const m of text.matchAll(/<script\b([^>]*)>/g)) {
        // One exception: the home page's carousel enhancement. That page shows
        // no therapist-written content, and the file is a static script from
        // this site (CSP script-src 'self'). Profile pages stay script-free.
        if (f.endsWith('pages/index.astro') && m[1].trim() === 'src="/slider.js" defer') continue;
        expect(m[1], f).toContain('application/ld+json');
      }
      expect(text, f).not.toMatch(/<style\b|\sstyle=/);
    }
  });

  it('keeps the home carousel script inert: no network, no HTML writes, no storage', () => {
    const script = readFileSync(resolve(__dirname, '../../../public/slider.js'), 'utf8');
    expect(script).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|localStorage|sessionStorage|document\.cookie|import\(/);
  });
});
