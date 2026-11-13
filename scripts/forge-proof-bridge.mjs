// Test-owned instance of the actual SCOUT bridge; no test transport or fake data.
// Graceful IPC shutdown lets Windows release the journal and SSE connections.
import { resolve } from "node:path";
import { GithubProjectAdapter } from "../packages/project-adapters/github.ts";
import { MetadataAgentAdapter } from "../packages/agent-adapters/metadata.ts";
import { Bridge } from "../apps/bridge/src/bridge.ts";
import { createBridgeServer } from "../apps/bridge/src/server.ts";

const [data, file, rawPort] = process.argv.slice(2);
const port = Number(rawPort);
if (!data || !file || !Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Usage: node scripts/forge-proof-bridge.mjs <data> <metadata> <port>");
const project = new GithubProjectAdapter("orionaster/devungeon");
const bridge = new Bridge(project, resolve(data), new MetadataAgentAdapter(project.projectId, resolve(file)));
await bridge.init();
const server = createBridgeServer(bridge);
server.on("error", async (error) => {
  console.error(error);
  await bridge.close();
  process.exit(1);
});
await new Promise((done) => server.listen(port, "127.0.0.1", done));
bridge.start();
process.send?.({ ready: true, port });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await new Promise((done) => server.close(done));
  await bridge.close();
  process.exit(0);
}
process.on("message", (message) => { if (message === "close") void close(); });
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());
