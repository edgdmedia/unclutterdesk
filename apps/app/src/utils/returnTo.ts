export function isSafeReturnPath(path?: string | null): path is string {
  if (!path || typeof path !== 'string') return false;
  // Only same-site paths starting with a single '/'
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  // Disallow protocol-relative and full URLs
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
  // Reject backslashes and control characters
  if (/[\\]/.test(path)) return false;
  if (/[\u0000-\u001F\u007F]/.test(path)) return false;
  // Confirm same-origin via URL constructor
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return false;
  } catch {
    return false;
  }
  return true;
}

export function resolveReturnTo(stateReturnTo?: string | null, searchParamsReturnTo?: string | null, fallback = '/portal'): string {
  const candidate = stateReturnTo ?? searchParamsReturnTo ?? null;
  return isSafeReturnPath(candidate) ? candidate : fallback;
}
