/**
 * The public API, as fixtures, for the accessibility run. Only the reads the
 * profiles site makes are served: one profile, the sitemap and the public
 * plans. Everything else is a 404, exactly as the real API would answer.
 */
import { createServer } from 'node:http';
import { profileFor, sitemap } from './fixtures.mjs';

const PORT = Number(process.env.A11Y_API_PORT || 4399);

// The same shape GET /v1/billing/public-plans returns (apps/api public-plans.ts).
const PLANS = [
  { tier: 'FREE', name: 'Free', monthlyKobo: 0, monthlyPrice: '₦0', monthlyBookingLimit: 5, platformFeePercent: 5, bankTransferPayments: false, customDomain: false, staffRoles: ['THERAPIST'], googleCalendarSync: false, profilePdf: false },
  { tier: 'STARTER', name: 'Starter', monthlyKobo: 1500000, monthlyPrice: '₦15,000', monthlyBookingLimit: 40, platformFeePercent: 3, bankTransferPayments: true, customDomain: false, staffRoles: ['THERAPIST'], googleCalendarSync: true, profilePdf: true, introVideo: true, customBrandColor: true },
  { tier: 'PRO', name: 'Pro', monthlyKobo: 3500000, monthlyPrice: '₦35,000', monthlyBookingLimit: null, platformFeePercent: 2, bankTransferPayments: true, customDomain: true, staffRoles: ['THERAPIST', 'RECEPTIONIST'], googleCalendarSync: true, profilePdf: true, introVideo: true, customBrandColor: true, assessments: ['PHQ-9', 'GAD-7'] },
  { tier: 'CLINIC', name: 'Clinic', monthlyKobo: 7500000, monthlyPrice: '₦75,000', monthlyBookingLimit: null, platformFeePercent: 1, bankTransferPayments: true, customDomain: true, staffRoles: ['THERAPIST', 'RECEPTIONIST', 'ADMIN'], googleCalendarSync: true, profilePdf: true, introVideo: true, customBrandColor: true, assessments: ['PHQ-9', 'GAD-7'] },
];

const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const send = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  if (path === '/v1/profiles/sitemap') return send(200, sitemap());
  if (path === '/v1/billing/public-plans') return send(200, PLANS);

  const match = /^\/v1\/profiles\/([a-z0-9-]+)$/.exec(path);
  if (match) {
    const found = profileFor(match[1]);
    return found ? send(200, { profile: found }) : send(404, { message: 'Not found' });
  }

  return send(404, { message: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`fixture API on http://127.0.0.1:${PORT}`);
});