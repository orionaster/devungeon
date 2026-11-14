import { request } from "node:http";
import type { Plugin } from "vite";

/** Optional local development host, explicitly enabled with SCOUT_BRIDGE_PORT.
 * Fixed loopback upstream; only the read-only stream/status routes are forwarded.
 * Keep SCOUT's server Host/Origin rules intact; never forward browser credentials.
 */
export function scoutProxy(): Plugin {
  return {
    name: "devungeon-local-scout-read",
    configureServer(server) {
      const rawPort = process.env.SCOUT_BRIDGE_PORT;
      if (!rawPort) return;
      const port = Number(rawPort);
      if (!Number.isInteger(port) || port < 1024 || port > 65535)
        throw new Error("Invalid SCOUT_BRIDGE_PORT");
      server.middlewares.use("/scout-read", (req, res) => {
        const local = "127.0.0.1:4174";
        if (
          req.method !== "GET" ||
          req.headers.host !== local ||
          (req.headers.origin && req.headers.origin !== `http://${local}`) ||
          (req.headers["sec-fetch-site"] &&
            !["same-origin", "none"].includes(
              String(req.headers["sec-fetch-site"]),
            ))
        ) {
          res.writeHead(403);
          res.end("read_only_origin_denied");
          return;
        }
        const path = req.url ?? "";
        if (!/^\/v1\/(status|stream)(\?after=\d{1,8})?$/.test(path)) {
          res.writeHead(404);
          res.end("route_not_allowed");
          return;
        }
        const upstream = request(
          {
            hostname: "127.0.0.1",
            port,
            method: "GET",
            path,
            headers: {
              Host: `127.0.0.1:${port}`,
              ...(req.headers["last-event-id"]
                ? { "Last-Event-ID": String(req.headers["last-event-id"]) }
                : {}),
            },
          },
          (incoming) => {
            res.writeHead(incoming.statusCode ?? 502, {
              "Content-Type":
                incoming.headers["content-type"] ?? "application/json",
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            });
            incoming.pipe(res);
          },
        );
        upstream.on("error", () => {
          if (!res.headersSent) res.writeHead(502);
          res.end("scout_bridge_unavailable");
        });
        res.on("close", () => upstream.destroy());
        upstream.end();
      });
    },
  };
}
