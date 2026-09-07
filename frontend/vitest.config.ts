import path from 'node:path';

import { defineConfig } from 'vitest/config';

// Split out of the old vite.config.ts at the Next.js cutover — vitest still runs on Vite
// under the hood for its own transform pipeline (independent of Next, which uses SWC), so
// this file's job is now just "unit test runner config", not "app build config".
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: './src/test/setup.ts',
  },
});
