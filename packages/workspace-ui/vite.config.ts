import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { scoutProxy } from "./demo/scout-proxy.ts";

export default defineConfig({
  plugins: [react(), scoutProxy()],
  base: "./",
  publicDir: "../../apps/web/public",
  resolve: { dedupe: ["react", "react-dom", "three", "@react-three/fiber"] },
  test: { include: ["tests/**/*.test.ts"] },
});
