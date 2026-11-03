import type { ProfilesConfig } from './config';

/**
 * "Report this profile" (spec §6.15). The form posts to this site (it works
 * without JavaScript); the Worker checks it, applies its own per-visitor rate
 * limit, and forwards it to the public API server to server. No cookies or
 * credentials are ever sent, and the visitor's IP is used only for the
 * limit, never stored or forwarded.
 */

export const REPORT_REASONS = [
  { value: 'IMPERSONATION', label: 'Pretending to be someone else', hint: 'Not this person, or not a real therapist' },
  { value: 'MISLEADING', label: 'Misleading', hint: 'False qualifications or claims' },
  { value: 'UNSAFE', label: 'Unsafe', hint: 'Harmful advice or content' },
  { value: 'OTHER', label: 'Something else', hint: null },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];
export const DETAILS_MAX = 2000;

export interface ReportForm {
  type: ReportReason;
  details: string;
  /** Honeypot: hidden from people, filled in by bots. */
  website: string;
}

export type ParsedReport = { ok: true; form: ReportForm } | { ok: false; error: string };

export function parseReportForm(data: FormData): ParsedReport {
  const type = String(data.get('type') ?? '');
  if (!REPORT_REASONS.some((r) => r.value === type)) return { ok: false, error: 'Choose what’s wrong with this profile.' };
  const details = String(data.get('details') ?? '').replace(/\r\n?/g, '\n').trim();
  if (details.length > DETAILS_MAX) return { ok: false, error: `Keep the details to ${DETAILS_MAX} characters or fewer.` };
  return { ok: true, form: { type: type as ReportReason, details, website: String(data.get('website') ?? '') } };
}

export type ReportOutcome = 'sent' | 'missing' | 'limited' | 'invalid' | 'error';

/** Forward a checked report to the API. `fetchImpl` is the network, so tests can stand in for it. */
export async function sendReport(config: ProfilesConfig, handle: string, form: ReportForm, fetchImpl: typeof fetch = fetch): Promise<ReportOutcome> {
  let res: Response;
  try {
    res = await fetchImpl(`${config.apiOrigin}/v1/profiles/${encodeURIComponent(handle)}/report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ type: form.type, details: form.details || undefined, website: form.website || undefined }),
      redirect: 'manual',
    });
  } catch {
    return 'error';
  }
  if (res.status === 202 || res.status === 201 || res.status === 200) return 'sent';
  if (res.status === 404) return 'missing';
  if (res.status === 429) return 'limited';
  if (res.status === 400) return 'invalid';
  return 'error';
}

export const OUTCOME_MESSAGES: Record<Exclude<ReportOutcome, 'sent'>, string> = {
  missing: 'This profile isn’t available any more, so it can’t be reported.',
  limited: 'Too many reports from your connection just now. Please try again in a few minutes.',
  invalid: 'We couldn’t accept that report. Check the form and try again.',
  error: 'Something went wrong on our side. Please try again in a few minutes.',
};

/** The Workers rate-limit binding (wrangler.jsonc "ratelimits"). Absent in local dev. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** True when this visitor may send another report. Without a limiter or an IP, the API's own limit still applies. */
export async function withinRateLimit(limiter: RateLimiter | undefined, ip: string | null): Promise<boolean> {
  if (!limiter || !ip) return true;
  const { success } = await limiter.limit({ key: `report:${ip}` });
  return success;
}
