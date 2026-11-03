/**
 * Where a signed-in account belongs: platform admins in the console,
 * clients (type 'user') in the portal, practice staff in the workspace.
 * The one rule for every redirect that sends someone "home".
 */
export function homePathFor(profile: { type: string }): '/admin' | '/portal' | '/dashboard' {
  if (profile.type === 'platform_admin') return '/admin';
  if (profile.type === 'user') return '/portal';
  return '/dashboard';
}
