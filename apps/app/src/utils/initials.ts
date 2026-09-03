/**
 * Initials for an avatar badge, e.g. "Ade Wellness Ltd" -> "AW".
 *
 * Several pages painted a fixed "JS" into the badge beside a real, API-supplied
 * name, so every practice and every practitioner in the product wore the same
 * two letters — a stranger's. One implementation, so a page cannot go back to
 * hardcoding one.
 */
export function initialsOf(name: string | null | undefined, fallback = ''): string {
  const letters = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
  return letters || fallback;
}
