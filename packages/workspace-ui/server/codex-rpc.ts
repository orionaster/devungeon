import { spawn } from "node:child_process";
import { TEXT_CONFIG, type Rpc } from "./codex-session.ts";

const allowed = new Set(["initialize", "initialized", "permissionProfile/list", "config/read", "thread/start", "turn/start", "turn/interrupt"]);
// TOML CLI overrides are passed as argv values, never assembled into shell code.
function toml(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(toml).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).map(([key, item]) => `${key}=${toml(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export const textOverrides = Object.entries(TEXT_CONFIG).flatMap(([key, value]) => ["-c", `${key}=${toml(value)}`]);

/** Host-only JSONL transport. Never forwards raw events, errors, config or stderr.
 * Caller must already hold the explicit local operator enablement.
 */
export function createCodexRpc(cwd: string): Rpc {
  const child = spawn(process.platform === "win32" ? "codex.exe" : "codex",
    [...textOverrides, "app-server", "--stdio"], {
      cwd, windowsHide: true, stdio: ["pipe", "pipe", "ignore"],
    });
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const listeners = new Set<(value: any) => void>();
  let nextId = 0;
  let buffer = "";
  let closed = false;
  const fail = () => {
    if (closed) return;
    closed = true;
    for (const value of pending.values()) {
      clearTimeout(value.timer);
      value.reject(new Error("Codex local protocol disconnected; outcome unknown"));
    }
    pending.clear();
    listeners.forEach((listener) => listener({ method: "local/disconnected" }));
    child.stdin.end();
    child.kill();
  };
  child.once("error", fail);
  child.once("exit", fail);
  child.stdin.on("error", fail);
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    if (buffer.length > 1_000_000) { fail(); return; }
    let end: number;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      let message: any;
      try { message = JSON.parse(line); } catch { fail(); return; }
      if (message.method && message.id !== undefined) {
        // Fail closed for every approval, tool, elicitation or new server request.
        child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601,
          message: "Devungeon text trial authorizes no tools, permissions or account actions" } }) + "\n");
      } else if (message.method) {
        listeners.forEach((listener) => listener(message));
      } else {
        const value = pending.get(message.id);
        if (!value) continue;
        pending.delete(message.id);
        clearTimeout(value.timer);
        if (message.error) value.reject(new Error("Codex RPC rejected; details withheld"));
        else value.resolve(message.result);
      }
    }
  });
  return {
    request(method, params) {
      if (!allowed.has(method) || closed) return Promise.reject(new Error("RPC unavailable or not allowlisted"));
      if (method === "initialized") {
        child.stdin.write(JSON.stringify({ method, params }) + "\n");
        return Promise.resolve(undefined);
      }
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("Codex RPC observation timed out; outcome unknown"));
        }, 15_000);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
      });
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    close: fail,
  };
}
