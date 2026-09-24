import { describe, it, expect, afterEach } from 'vitest';
import { appOrigin, isAllowedRedirectTarget, isPlatformOrigin, tenantWebOrigin } from './origins';

/**
 * Where a payer may be sent back to.
 *
 * `callbackUrl` arrived in the request body and was handed to Paystack, which
 * redirects the paying client wherever it is told. On the booking flow that
 * body is public, so anyone could have pointed a real practice's checkout at a
 * page of their own: the client pays the practice, lands somewhere else, and
 * still believes they are with their therapist.
 *
 * No client ever sent the field. Both call sites now build the address, and
 * these rules are what a built one is held to.
 */
const PROD = { isProduction: true };

afterEach(() => {
  delete process.env.APP_URL;
});

describe('what counts as one of our origins', () => {
  it('accepts the marketing site', () => {
    expect(isPlatformOrigin('https://unclutterdesk.com', true)).toBe(true);
    expect(isPlatformOrigin('https://www.unclutterdesk.com', true)).toBe(true);
  });

  it('accepts a practice subdomain', () => {
    expect(isPlatformOrigin('https://drjane.unclutterdesk.com', true)).toBe(true);
  });

  // The suffix and prefix tricks, which a naive endsWith or includes allows.
  it('rejects a host that merely contains our domain', () => {
    expect(isPlatformOrigin('https://unclutterdesk.com.evil.com', true)).toBe(false);
    expect(isPlatformOrigin('https://notunclutterdesk.com', true)).toBe(false);
  });

  it('rejects a nested subdomain, which is not a practice site', () => {
    expect(isPlatformOrigin('https://a.b.unclutterdesk.com', true)).toBe(false);
  });

  it('rejects plain http in production', () => {
    expect(isPlatformOrigin('http://drjane.unclutterdesk.com', true)).toBe(false);
  });

  it('allows localhost only outside production', () => {
    expect(isPlatformOrigin('http://demo.localhost:5173', false)).toBe(true);
    expect(isPlatformOrigin('http://demo.localhost:5173', true)).toBe(false);
  });
});

describe('a redirect target', () => {
  it('accepts a page on a practice subdomain', () => {
    expect(isAllowedRedirectTarget('https://drjane.unclutterdesk.com/booking/confirmed', PROD)).toBe(
      true,
    );
  });

  it('accepts a verified custom domain that was passed in', () => {
    expect(
      isAllowedRedirectTarget('https://booking.drjane.ng/booking/confirmed', {
        ...PROD,
        customDomains: ['booking.drjane.ng'],
      }),
    ).toBe(true);
  });

  it('rejects a custom domain belonging to nobody', () => {
    expect(
      isAllowedRedirectTarget('https://evil.com/booking/confirmed', {
        ...PROD,
        customDomains: ['booking.drjane.ng'],
      }),
    ).toBe(false);
  });

  it('rejects an outright foreign host', () => {
    expect(isAllowedRedirectTarget('https://evil.com/pay-again', PROD)).toBe(false);
  });

  // A browser resolves "//evil.com" against the current scheme and follows it.
  it('rejects a protocol-relative URL', () => {
    expect(isAllowedRedirectTarget('//evil.com', PROD)).toBe(false);
  });

  it('rejects a script scheme', () => {
    expect(isAllowedRedirectTarget('javascript:alert(1)', PROD)).toBe(false);
    expect(isAllowedRedirectTarget('data:text/html,<script>', PROD)).toBe(false);
  });

  /*
   * "https://drjane.unclutterdesk.com@evil.com" is a request to evil.com with a
   * username. Someone skimming the address bar reads the part before the @.
   */
  it('rejects credentials used to disguise the real host', () => {
    expect(isAllowedRedirectTarget('https://drjane.unclutterdesk.com@evil.com/', PROD)).toBe(false);
  });

  it('rejects something that is not an absolute URL', () => {
    expect(isAllowedRedirectTarget('', PROD)).toBe(false);
    expect(isAllowedRedirectTarget('/booking/confirmed', PROD)).toBe(false);
  });
});

describe('the address a practice payer returns to', () => {
  it('is the practice own domain once it is verified', () => {
    expect(
      tenantWebOrigin(
        { slug: 'drjane', customDomain: 'booking.drjane.ng', customDomainStatus: 'ACTIVE' },
        true,
      ),
    ).toBe('https://booking.drjane.ng');
  });

  // A pending domain does not resolve yet; sending a paying client there
  // strands them on a dead host at the worst possible moment.
  it('falls back to the subdomain while a custom domain is still pending', () => {
    expect(
      tenantWebOrigin(
        { slug: 'drjane', customDomain: 'booking.drjane.ng', customDomainStatus: 'PENDING' },
        true,
      ),
    ).toBe('https://drjane.unclutterdesk.com');
  });

  it('is the subdomain when there is no custom domain', () => {
    expect(tenantWebOrigin({ slug: 'drjane', customDomain: null }, true)).toBe(
      'https://drjane.unclutterdesk.com',
    );
  });

  it('is a target this platform would accept', () => {
    const origin = tenantWebOrigin({ slug: 'drjane', customDomain: null }, true);
    expect(isAllowedRedirectTarget(`${origin}/booking/confirmed`, PROD)).toBe(true);
  });
});

describe('the workspace origin', () => {
  it('follows APP_URL when it is set', () => {
    process.env.APP_URL = 'https://app.unclutterdesk.com/';
    expect(appOrigin(true)).toBe('https://app.unclutterdesk.com');
  });

  it('has a production default this platform would accept', () => {
    expect(isAllowedRedirectTarget(`${appOrigin(true)}/dashboard/settings/subscription`, PROD)).toBe(
      true,
    );
  });
});
