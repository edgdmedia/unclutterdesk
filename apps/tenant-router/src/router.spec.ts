import { describe, it, expect } from 'vitest';
import { decide, originRequest, type RouterConfig } from './router';

const config: RouterConfig = {
  apexHost: 'unclutterdesk.com',
  originHost: 'app-unclutterdesk.pages.dev',
};

describe('decide', () => {
  it('serves a tenant booking subdomain, indexable', () => {
    expect(decide('dr-smith.unclutterdesk.com', config)).toEqual({ kind: 'serve', indexable: true });
    expect(decide('demo.unclutterdesk.com', config)).toEqual({ kind: 'serve', indexable: true });
  });

  it('serves the main app, which uses the same bundle as tenant hosts', () => {
    expect(decide('app.unclutterdesk.com', config)).toMatchObject({ kind: 'serve' });
  });

  it('serves a tenant custom domain arriving via Cloudflare for SaaS, indexable', () => {
    expect(decide('booking.drjanetherapy.com', config)).toEqual({ kind: 'serve', indexable: true });
  });

  it('is case-insensitive about the host', () => {
    expect(decide('DR-Smith.UnclutterDesk.com', config)).toEqual({ kind: 'serve', indexable: true });
  });

  // The signed-in app has no public content; letting it into search results
  // would compete with the practice booking pages meant to rank.
  it('marks the application shell hosts as not indexable', () => {
    expect(decide('app.unclutterdesk.com', config)).toEqual({ kind: 'serve', indexable: false });
    expect(decide('admin.unclutterdesk.com', config)).toEqual({ kind: 'serve', indexable: false });
  });

  it('does not let a tenant slug that merely contains "app" become non-indexable', () => {
    expect(decide('apple-therapy.unclutterdesk.com', config)).toEqual({ kind: 'serve', indexable: true });
    expect(decide('app-therapy.unclutterdesk.com', config)).toEqual({ kind: 'serve', indexable: true });
  });

  it('redirects www to the marketing site', () => {
    expect(decide('www.unclutterdesk.com', config)).toEqual({
      kind: 'redirect',
      to: 'https://unclutterdesk.com/',
    });
  });

  it('redirects the bare apex to the marketing site', () => {
    expect(decide('unclutterdesk.com', config)).toEqual({
      kind: 'redirect',
      to: 'https://unclutterdesk.com/',
    });
  });

  // Serving the SPA on the API host would turn a routing mistake into confusing
  // downstream failures, so this must fail loudly instead.
  it('refuses to serve the API host', () => {
    expect(decide('api.unclutterdesk.com', config)).toEqual({
      kind: 'misrouted',
      host: 'api.unclutterdesk.com',
    });
  });

  it('refuses multi-label hosts under the apex', () => {
    expect(decide('a.b.unclutterdesk.com', config)).toMatchObject({ kind: 'misrouted' });
    expect(decide('staging.api.unclutterdesk.com', config)).toMatchObject({ kind: 'misrouted' });
  });

  it('does not treat a lookalike domain as our zone', () => {
    // Must not be parsed as the "evil" tenant of unclutterdesk.com.
    expect(decide('unclutterdesk.com.evil.io', config)).toEqual({ kind: 'serve', indexable: true });
    expect(decide('evil-unclutterdesk.com', config)).toEqual({ kind: 'serve', indexable: true });
  });
});

describe('originRequest', () => {
  it('rewrites only the host, preserving path and query', () => {
    const req = originRequest(
      new Request('https://dr-smith.unclutterdesk.com/book?service=42#frag'),
      config,
    );
    const url = new URL(req.url);
    expect(url.hostname).toBe('app-unclutterdesk.pages.dev');
    expect(url.protocol).toBe('https:');
    expect(url.pathname).toBe('/book');
    expect(url.search).toBe('?service=42');
  });

  it('preserves method and headers', () => {
    const req = originRequest(
      new Request('https://dr-smith.unclutterdesk.com/api-ish', {
        method: 'POST',
        headers: { 'x-custom': 'kept', 'accept-language': 'en-NG' },
        body: 'payload',
      }),
      config,
    );
    expect(req.method).toBe('POST');
    expect(req.headers.get('x-custom')).toBe('kept');
    expect(req.headers.get('accept-language')).toBe('en-NG');
  });

  it('does not carry the original host through to the origin', () => {
    const req = originRequest(
      new Request('https://dr-smith.unclutterdesk.com/'),
      config,
    );
    // Pages would reject an unregistered custom domain in the Host header.
    expect(new URL(req.url).hostname).not.toContain('unclutterdesk.com');
  });

  it('upgrades a plaintext request to https at the origin', () => {
    const req = originRequest(new Request('http://dr-smith.unclutterdesk.com/x'), config);
    expect(new URL(req.url).protocol).toBe('https:');
  });
});
