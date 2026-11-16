import { defineConfig } from 'vitest/config';

// §6.16: the end-to-end test in workerd (test/practice-host.workerd.ts). Kept
// out of `pnpm test`, because it needs the built Worker: run `pnpm test:workerd`.
export default defineConfig({
  test: { include: ['test/**/*.workerd.ts'], testTimeout: 30_000, hookTimeout: 180_000 },
});
