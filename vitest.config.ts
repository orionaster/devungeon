import { defineConfig } from "vitest/config";
// Keep isolated source archives and their dependencies out of the active suite.
export default defineConfig({
  test: {
    include: ["apps/web/test/**/*.test.ts"],
    exclude: ["output/**", "node_modules/**"],
    environment: "node",
  },
});
