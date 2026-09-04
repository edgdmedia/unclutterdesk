import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('app and landing polish', () => {
  test('does not ship legacy unclutterOS branding in the main auth and admin surfaces', () => {
    const files = [
      '../../pages/auth/LoginPage.tsx',
      '../../components/AuthSplitShell.tsx',
      '../../pages/admin/PlatformAdminLoginPage.tsx',
      '../../pages/admin/PlatformAdminLayout.tsx',
      '../../pages/admin/AdminTenantsPage.tsx',
    ];

    for (const relativePath of files) {
      const source = readFileSync(resolve(__dirname, relativePath), 'utf8');
      expect(source).not.toContain('unclutterOS');
      expect(source).not.toContain('unclutterOS Inc.');
    }
  });

  test('does not leave placeholder social links in the landing footer', () => {
    const landing = readFileSync(
      resolve(__dirname, '../../../../landing/src/components/LandingPage.tsx'),
      'utf8',
    );

    expect(landing).not.toContain('href="#"');
  });
});
