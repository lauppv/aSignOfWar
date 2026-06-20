import { defineConfig } from "vitest/config";
import path from "node:path";

// The Vitest root is the repo root so that shared/ (which lives a level above
// the server package) is inside the coverage scope. Server runs in a Node
// environment (CommonJS); the shared/ game-config and battle calculator are
// pure logic and are exercised from here so they are measured in a single
// place rather than double-counted on the client.
//
// `coverage.include` is an explicit allow-list: a file only falls under the
// 90% gate once it has tests. Grow this list as new suites land — that keeps
// the threshold green and meaningful instead of red on day one.
export default defineConfig({
  root: path.resolve(__dirname, ".."),
  test: {
    environment: "node",
    include: ["server/test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      all: true,
      reporter: ["text", "text-summary", "html", "json", "json-summary"],
      reportsDirectory: path.resolve(__dirname, "coverage"),
      include: [
        "shared/gameConfig.ts",
        "shared/battleCalc.ts",
        "server/src/middleware/validate.ts",
        "server/src/middleware/auth.ts",
        "server/src/modules/map/slotAllocator.ts",
        "server/src/modules/auth/auth.schema.ts",
        "server/src/modules/city/city.schema.ts",
        "server/src/modules/command/command.schema.ts",
        "server/src/modules/recruitment/recruitment.schema.ts",
        "server/src/modules/governor/governor.schema.ts",
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
