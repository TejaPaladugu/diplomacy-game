import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [resolve(__dirname, 'src/test-setup.ts')],
    env: {
      DIPLOMACY_DB_PATH: resolve(__dirname, 'data/test.sqlite'),
    },
  },
});
