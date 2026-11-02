/**
 * Normalise a hostname for practice lookups: lowercases and removes one trailing dot.
 * This ensures consistent matching across the router and API when headers come from
 * different sources (e.g., Cloudflare for SaaS vs. the API's own checks).
 */
export function normalizeHost(hostname: string): string {
  const lower = hostname.toLowerCase();
  return lower.endsWith('.') ? lower.slice(0, -1) : lower;
}