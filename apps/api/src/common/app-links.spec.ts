import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Links into the app are built by appOrigin() alone. Three places built their
 * own: Google Calendar sent therapists to localhost:5173 in production, staff
 * invitations pointed at the marketing site's (missing) /invite/claim, and
 * password resets read three other variable names.
 */
const SRC = join(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('app links', () => {
  const sources = files(SRC).filter((f) => !f.endsWith('common/origins.ts'));

  it('are not built from APP_URL or a hard-coded app address outside origins.ts', () => {
    const offenders = sources
      .filter((f) => /process\.env\.(APP_URL|APP_BASE_URL|WEB_BASE_URL|VITE_APP_URL)|localhost:5173/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
