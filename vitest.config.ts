import { defineConfig } from "vitest/config";

// Engine tests are framework-free. Disable CSS/PostCSS discovery so the legacy
// AiEZ postcss.config.mjs at the repo root is never loaded during `vitest run`.
export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
