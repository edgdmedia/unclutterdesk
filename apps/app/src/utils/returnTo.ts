export function isSafeReturnPath(path?: string | null): path is string {
  if (!path || typeof path !== 'string') return false;
  // Only same-site paths starting with a single '/'
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  // Disallow protocol-relative and full URLs
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
  return true;
}

export function resolveReturnTo(stateReturnTo?: string | null, searchParamsReturnTo?: string | null, fallback = '/portal'): string {
  const candidate = stateReturnTo ?? searchParamsReturnTo ?? null;
  return isSafeReturnPath(candidate) ? candidate : fallback;
}
