import { describe, expect, it } from 'vitest';
import { APP_BASE_URL, getBookingUrl } from '../apiClient';

describe('getBookingUrl', () => {
  it('builds a tenant subdomain booking URL on localhost in dev', () => {
    const port = window.location.port;
    expect(getBookingUrl('dr-smith')).toBe(`http://dr-smith.localhost${port ? `:${port}` : ''}`);
  });

  it('falls back to the app base URL when no slug is provided', () => {
    expect(getBookingUrl('')).toBe(APP_BASE_URL);
  });
});
