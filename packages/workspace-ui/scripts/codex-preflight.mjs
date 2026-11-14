/** Non-inference protocol probe. Never starts/resumes a thread or sends a turn.
 * Provider credentials, account details, process output and user config are not
 * returned to the browser or written to this repository.
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../../../", import.meta.url));
const executable = process.platform === "win32" ? "codex.exe" : "codex";
const child = spawn(executable, ["app-server", "--stdio"], {
  cwd,
  windowsHide: true,
  stdio: ["pipe", "pipe", "ignore"],
});
const lines = createInterface({ input: child.stdout });
const allowed = new Set([
  "initialize",
  "initialized",
  "permissionProfile/list",
]);
const sent = [];
function send(message) {
  if (!allowed.has(message.method)) throw new Error("Non-preflight RPC denied");
  sent.push(message.method);
  child.stdin.write(JSON.stringify(message) + "\n");
}
const result = await new Promise((resolve, reject) => {
  const timer = setTimeout(
    () =>
      reject(
        new Error("Codex preflight timed out; no inference request was sent"),
      ),
    15000,
  );
  child.once("error", () => {
    clearTimeout(timer);
    reject(new Error("Codex executable unavailable"));
  });
  child.once("exit", () => {
    clearTimeout(timer);
    reject(
      new Error("Codex preflight process exited before a profile response"),
    );
  });
  lines.on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.method && message.id !== undefined) {
      child.stdin.write(
        JSON.stringify({
          id: message.id,
          error: {
            code: -32601,
            message: "No actions are authorized during Devungeon preflight",
          },
        }) + "\n",
      );
      return;
    }
    if (message.id !== 0 && message.id !== 1) return;
    if (message.error) {
      clearTimeout(timer);
      reject(new Error(`Codex preflight RPC rejected (${message.error.code})`));
      return;
    }
    if (message.id === 0) {
      send({ method: "initialized", params: {} });
      send({
        id: 1,
        method: "permissionProfile/list",
        params: { cwd, limit: 50 },
      });
    } else {
      clearTimeout(timer);
      resolve({
        inference_requests_sent: 0,
        rpc_methods: sent,
        profiles: (message.result?.data ?? []).map((profile) => ({
          id: profile.id,
          allowed: profile.allowed,
        })),
      });
    }
  });
  send({
    id: 0,
    method: "initialize",
    params: {
      clientInfo: {
        name: "devungeon_workspace",
        title: "Devungeon workspace preflight",
        version: "0.1.0",
      },
      capabilities: { experimentalApi: true },
    },
  });
}).finally(() => {
  lines.close();
  child.stdin.end();
  // No model request exists in this process; this only disposes the local probe.
  child.kill();
});
console.log(JSON.stringify(result, null, 2));
