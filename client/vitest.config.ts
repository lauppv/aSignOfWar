import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Client tests run in jsdom. We reuse Vite's `@`/`@shared` aliases so test
// imports match app code. `coverage.include` is an explicit allow-list: a file
// joins the 90% gate only once it has tests — grow it as suites are added.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      all: true,
      reporter: ["text", "text-summary", "html", "json", "json-summary"],
      include: [
        "src/shared/lib/labels.ts",
        "src/features/city/lib/cityHelpers.ts",
        "src/shared/api/client.ts",
        "src/shared/hooks/useClickOutside.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
