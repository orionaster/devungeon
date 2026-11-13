import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { createScoutMiddleware } from "../bridge/src/same-origin.ts";
const port = Number(process.env.DEVUNGEON_PORT ?? 5173);
const bridgePort = Number(process.env.DEVUNGEON_SCOUT_PORT ?? 4313);
const scoutRead = () =>
  createScoutMiddleware({ hostOrigin: `http://127.0.0.1:${port}`, bridgePort });
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [
    {
      name: "devungeon-selected-public-source",
      configureServer(server) {
        server.middlewares.use(scoutRead());
      },
      configurePreviewServer(server) {
        server.middlewares.use(scoutRead());
      },
    },
  ],
  resolve: { dedupe: ["react", "react-dom", "three", "@react-three/fiber"] },
  server: { host: "127.0.0.1", port, strictPort: true },
  preview: { host: "127.0.0.1", port, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
});
