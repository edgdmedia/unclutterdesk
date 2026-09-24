import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarService } from './calendar.service';

// Google compares this to the OAuth client's registered URIs character for character.
describe('Google Calendar redirect URI', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is the API host in production', () => {
    vi.stubEnv('GOOGLE_REDIRECT_URI', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(CalendarService.redirectUri()).toBe('https://api.unclutterdesk.com/v1/calendar/google/callback');
  });

  it('can be set in the environment without a code change', () => {
    vi.stubEnv('GOOGLE_REDIRECT_URI', 'https://api.example.test/v1/calendar/google/callback');
    expect(CalendarService.redirectUri()).toBe('https://api.example.test/v1/calendar/google/callback');
  });
});
