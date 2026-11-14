import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { CodexTextSession, fileAudit } from "../server/codex-session.ts";
import { createCodexRpc } from "../server/codex-rpc.ts";

/** Development only, loopback and same-origin. No static-build command server.
 * Enabling this env flag is an operator action after explicit account-use approval.
 */
export function codexDev(): Plugin {
  return {
    name: "devungeon-local-codex-text-trial",
    configureServer(server) {
      const approved = process.env.DEVUNGEON_CODEX_TEXT_TRIAL === "approved-two-turns";
      const cwd = fileURLToPath(new URL("../output/codex-text/sandbox/", import.meta.url));
      const session = new CodexTextSession({ approved, cwd,
        audit: fileAudit(fileURLToPath(new URL("../output/codex-text/audit.jsonl", import.meta.url))),
        createRpc: () => createCodexRpc(cwd),
      });
      let directory: Promise<unknown> | undefined;
      server.httpServer?.once("close", () => session.close());
      server.middlewares.use("/codex-text", async (req, res) => {
        const json = (status: number, body: unknown) => {
          if (res.destroyed) return;
          res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
          res.end(JSON.stringify(body));
        };
        const local = "127.0.0.1:4174";
        const sameOrigin = req.headers.host === local &&
          (!req.headers.origin || req.headers.origin === `http://${local}`) &&
          (!req.headers["sec-fetch-site"] || ["same-origin", "none"].includes(String(req.headers["sec-fetch-site"])));
        if (!sameOrigin || (req.method === "POST" && (
          req.headers.origin !== `http://${local}` ||
          req.headers["x-devungeon-intent"] !== "codex-text" ||
          req.headers["content-type"] !== "application/json"
        ))) { json(403, { error: "local_origin_denied" }); return; }
        if (!((req.method === "GET" && req.url === "/snapshot") ||
          (req.method === "POST" && req.url === "/commands"))) {
          json(404, { error: "route_not_supported" }); return;
        }
        try {
          if (approved) await (directory ??= mkdir(cwd, { recursive: true }));
          if (req.method === "GET") { json(200, await session.snapshot()); return; }
          let body = "";
          let size = 0;
          for await (const chunk of req) {
            size += Buffer.byteLength(chunk);
            if (size > 32768) { json(413, { error: "command_too_large" }); return; }
            body += chunk.toString();
          }
          json(200, await session.send(JSON.parse(body)));
        } catch {
          // Keep provider/config/auth details out of HTTP errors and Vite logs.
          json(409, { error: "拒绝发送或回执未知；请核对活动和原始指令 ID。文本试验默认关闭，且只允许两次 turn。" });
        }
      });
    },
  };
}
