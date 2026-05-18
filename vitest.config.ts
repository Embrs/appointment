import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/__tests__/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@@': fileURLToPath(new URL('./server', import.meta.url))
    }
  }
});
