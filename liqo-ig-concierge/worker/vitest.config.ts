import { defineConfig } from 'vitest/config'

// Explicit config so vitest/vite never walk up to an outer project's
// vitest or postcss config files.
export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
