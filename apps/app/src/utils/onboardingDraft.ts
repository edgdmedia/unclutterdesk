/** Before drafts were per practice, every account in a browser shared this one. */
const LEGACY_KEY = 'unclutter_onboarding_v1';

/**
 * Where a practice's half-finished setup is kept in this browser. Per practice,
 * because the draft holds its bank details and must never be shown to another
 * account signed in on the same machine.
 */
export function onboardingDraftKey(tenantId: string) {
  return `${LEGACY_KEY}:${tenantId}`;
}

/** The shared draft can't be attributed to anyone, so it is dropped, not migrated. */
export function dropLegacyOnboardingDraft() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Storage unavailable: nothing to drop.
  }
}
