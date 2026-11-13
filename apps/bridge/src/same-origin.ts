/** Opt-in Node/Vite host seam, without a Vite/React dependency or CORS exception. */
import { request } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface ScoutHostOptions {
  /** Exact UI origin, e.g. http://127.0.0.1:5173. Only literal loopback IPv4. */
  hostOrigin: string;
  bridgePort: number;
  mountPath?: string;
}
export type ScoutMiddleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
const reply = (res: ServerResponse, status: number, error: string) => {
  if (res.headersSent) { res.destroy(); return; }
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(JSON.stringify({error}));
};

export function createScoutMiddleware(options: ScoutHostOptions): ScoutMiddleware {
  const origin = new URL(options.hostOrigin);
  if (origin.origin !== options.hostOrigin || origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || origin.username || origin.password || !origin.port) throw new Error('SCOUT host must have an exact http://127.0.0.1:<port> origin');
  if (!Number.isInteger(options.bridgePort) || options.bridgePort < 1024 || options.bridgePort > 65535) throw new Error('Invalid SCOUT bridge port');
  const mount = options.mountPath ?? '/scout-read';
  if (!/^\/[a-z][a-z0-9-]*$/.test(mount)) throw new Error('Invalid SCOUT mount path');
  const bridgePort = options.bridgePort;
  return (req, res, next) => {
    const raw = req.url ?? '';
    if (raw !== mount && !raw.startsWith(`${mount}/`) && !raw.startsWith(`${mount}?`)) { next(); return; }
    if (req.headers.host !== origin.host || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') ||
        (req.headers.origin && req.headers.origin !== origin.origin) ||
        (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site'])))) return reply(res, 403, 'scout_origin_denied');
    if (req.method !== 'GET') return reply(res, 405, 'scout_read_only');
    const path = raw.slice(mount.length);
    // Validate raw request targets, before URL normalization could hide traversal.
    if (!/^\/v1\/(status|snapshot|events|stream)(\?[a-z0-9=&]+)?$/.test(path)) return reply(res, 404, 'scout_route_denied');
    const url = new URL(path, origin.origin);
    const allowed = url.pathname === '/v1/events' ? ['after', 'limit'] : url.pathname === '/v1/stream' ? ['after'] : [];
    const seen = new Set<string>();
    for (const [key, value] of url.searchParams) {
      if (!allowed.includes(key) || seen.has(key) || !/^\d{1,8}$/.test(value) || key === 'limit' && (Number(value) < 1 || Number(value) > 1000)) return reply(res, 400, 'scout_invalid_query');
      seen.add(key);
    }
    const cursor = req.headers['last-event-id'];
    if (cursor !== undefined && (typeof cursor !== 'string' || !/^\d{1,8}$/.test(cursor))) return reply(res, 400, 'scout_invalid_cursor');
    // Fresh headers only: never forward browser Cookie, Authorization or Origin.
    const upstream = request({hostname: '127.0.0.1', port: bridgePort, method: 'GET', path,
      headers: {Host: `127.0.0.1:${bridgePort}`, ...(cursor ? {'Last-Event-ID': cursor} : {})}}, incoming => {
      if (res.destroyed) { incoming.destroy(); return; }
      res.writeHead(incoming.statusCode ?? 502, {'Content-Type': incoming.headers['content-type'] ?? 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
      incoming.on('error', () => res.destroy()); incoming.pipe(res);
    });
    upstream.setTimeout(15000, () => upstream.destroy(new Error('SCOUT idle timeout')));
    upstream.on('error', () => reply(res, 502, 'scout_bridge_unavailable'));
    res.on('close', () => upstream.destroy());
    upstream.end();
  };
}
