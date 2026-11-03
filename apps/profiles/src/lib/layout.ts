import { PROFILE_LAYOUTS, type ProfileLayoutKey } from '@unclutterdesk/ui/src/brand/profileThemes';

/** A stored layout key, or the default when it's missing or unknown (§6.5). */
export function layoutOf(key: string | null | undefined): ProfileLayoutKey {
  return (PROFILE_LAYOUTS.find((l) => l.key === key) ?? PROFILE_LAYOUTS[0]).key;
}

/** Up to two initials for the no-photo state: "Dr. Folake Adeyemi" → "FA", "Amina Bello" → "AB". */
export function initialsOf(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .filter((w, i, all) => !(i === 0 && all.length > 1 && /^(dr|mr|mrs|ms|miss|prof|rev|pastor)$/i.test(w)));
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}
