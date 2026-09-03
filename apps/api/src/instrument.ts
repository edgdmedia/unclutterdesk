/**
 * Sentry initialisation.
 *
 * Imported from main.ts immediately after `./env` and before anything else:
 * the SDK instruments http, express and Postgres by patching them at require
 * time, so it has to run before those modules are loaded — but after dotenv,
 * or there is no DSN to read.
 *
 * Without SENTRY_DSN this is inert. Nothing is sent, no network calls are made,
 * and the application behaves exactly as it did before.
 *
 * PII: this product stores clinical notes and assessment responses. The
 * scrubbing below is deliberately aggressive — request bodies, query strings,
 * cookies and auth headers are removed before an event leaves the process,
 * whatever the SDK would otherwise attach. A stack trace is worth having; the
 * SOAP note that triggered it is not.
 */
import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Set by the deploy so an event can be traced to a commit.
    release: process.env.SENTRY_RELEASE || undefined,

    // Never attach IPs, cookies or user data automatically.
    sendDefaultPii: false,

    // Tracing is off unless explicitly enabled: it samples real requests, and
    // the volume is a cost decision the operator should make deliberately.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),

    beforeSend(event) {
      if (event.request) {
        // The URL keeps its path but loses the query string, which carries
        // tokens on password-reset and verification links.
        if (event.request.query_string) delete event.request.query_string;
        if (typeof event.request.url === 'string') {
          event.request.url = event.request.url.split('?')[0];
        }

        // Bodies carry credentials, note content and assessment answers.
        delete event.request.data;
        delete event.request.cookies;

        if (event.request.headers) {
          const safe: Record<string, string> = {};
          for (const [key, value] of Object.entries(event.request.headers)) {
            // Allowlist, not denylist: a header added later is dropped by
            // default rather than leaking until someone notices.
            if (['content-type', 'user-agent', 'accept-language'].includes(key.toLowerCase())) {
              safe[key] = String(value);
            }
          }
          event.request.headers = safe;
        }
      }

      // Set from the exception filter; lets a user-quoted reference be found.
      return event;
    },

    beforeBreadcrumb(breadcrumb) {
      // Query breadcrumbs would otherwise include SQL parameters.
      if (breadcrumb.category === 'query') return null;
      if (breadcrumb.data && 'body' in breadcrumb.data) delete breadcrumb.data.body;
      return breadcrumb;
    },
  });

  // eslint-disable-next-line no-console
  console.log(`[sentry] error reporting enabled (${process.env.NODE_ENV || 'development'})`);
}

export const sentryEnabled = Boolean(dsn);
