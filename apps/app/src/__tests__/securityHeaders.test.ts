import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * VID-01: the session room uses the camera, microphone and screen inside the
 * app (Daily) and inside JaaS's frame (8x8.vc). The production headers must
 * allow both, or every call fails to start, silently, only in production.
 */
const headers = readFileSync(resolve(__dirname, '../../public/_headers'), 'utf8');
const header = (name: string) => new RegExp(`^\\s*${name}:\\s*(.+)$`, 'm').exec(headers)?.[1] ?? '';

describe('production headers for the session room', () => {
  const policy = header('Permissions-Policy');
  const allows = (feature: string) => new RegExp(`${feature}=\\(([^)]*)\\)`).exec(policy)?.[1] ?? '';

  it.each(['camera', 'microphone', 'display-capture', 'autoplay'])('lets the app and JaaS use %s', (feature) => {
    expect(allows(feature)).toContain('self');
    expect(allows(feature)).toContain('"https://8x8.vc"');
  });

  it('keeps everything else switched off', () => {
    for (const feature of ['geolocation', 'payment', 'usb']) expect(allows(feature)).toBe('');
  });

  it("lets the security policy load Daily and frame JaaS", () => {
    const csp = header('Content-Security-Policy-Report-Only');
    expect(csp).toMatch(/script-src[^;]*https:\/\/c\.daily\.co/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.daily\.co[^;]*wss:\/\/\*\.daily\.co/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/8x8\.vc/);
    expect(csp).toMatch(/media-src[^;]*blob:/);
  });
});
