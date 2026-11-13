import { defineConfig } from "vitest/config";
// Keep isolated source archives and their dependencies out of the active suite.
export default defineConfig({
  test: {
    include: ["packages/workspace-ui/tests/i18n.test.ts"],
    exclude: ["output/**", "node_modules/**"],
    environment: "node",
  },
});
