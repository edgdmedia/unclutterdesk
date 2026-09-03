import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('private app data policy', () => {
  test('does not ship demo records or demo fallback data', () => {
    const appSource = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');

    expect(appSource).not.toContain('FALLBACK_CLIENTS');
    expect(appSource).not.toContain('FALLBACK_SESSIONS');
    expect(appSource).not.toContain('FALLBACK_STAFF');
    expect(appSource).not.toContain('fallbackData:');
    expect(appSource).not.toContain('Adaeze Okonkwo');
    expect(appSource).not.toContain('Tunde Bello');
    expect(appSource).not.toContain('Access Bank');
  });
});
