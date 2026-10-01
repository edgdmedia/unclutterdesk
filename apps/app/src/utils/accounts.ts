/** Practice staff; not a client, and not the platform admin console. */
export function isPracticeAccount(profile: { type?: string; tenantId?: string } | null | undefined): boolean {
  return Boolean(profile?.tenantId) && profile?.type !== 'user' && profile?.type !== 'platform_admin';
}
