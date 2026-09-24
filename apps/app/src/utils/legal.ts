/**
 * The legal documents, in one place.
 *
 * There used to be two of each. The marketing site served a policy written for
 * the NDPA — controller and processor split out, retention, sub-processors,
 * breach notification, governing law — and the app served its own 30-line
 * version that mentioned none of that and named a company called "Unclutter
 * OS". Whoever signed up in the app was agreeing to the weaker one.
 *
 * Worse, the signup checkbox pointed at /terms-of-service and /privacy-policy,
 * which existed in neither app. Someone accepted clinical liability under
 * documents they could not open.
 *
 * The marketing site is now the only copy. The app links out to it rather than
 * keeping a second version to drift from — which is exactly how the first drift
 * happened.
 */

function marketingBase(): string {
  const configured = import.meta.env.VITE_MARKETING_URL;
  if (configured) return String(configured).replace(/\/+$/, '');
  // The landing site runs on its own dev server; astro's default is 4321.
  return import.meta.env.DEV ? 'http://localhost:4321' : 'https://unclutterdesk.com';
}

export const MARKETING_BASE_URL = marketingBase();

/**
 * Paths, not full URLs, so the link-integrity test can check that a real page
 * exists in apps/landing/src/pages for each one.
 */
export const LEGAL_PATHS = {
  terms: '/terms',
  privacy: '/privacy',
} as const;

export const LEGAL_URLS = {
  terms: `${MARKETING_BASE_URL}${LEGAL_PATHS.terms}`,
  privacy: `${MARKETING_BASE_URL}${LEGAL_PATHS.privacy}`,
} as const;
