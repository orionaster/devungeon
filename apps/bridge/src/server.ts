import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import type { Bridge } from './bridge.ts';

const json = (res: ServerResponse, code: number, body: unknown) => { res.writeHead(code, {'Content-Type': 'application/json'}); res.end(JSON.stringify(body)); };
export function createBridgeServer(bridge: Bridge) {
  const clients = new Set<ServerResponse>();
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    const port = (server.address() as {port: number})?.port;
    const host = `127.0.0.1:${port}`;
    // Fixed Host defeats DNS rebinding. No CORS and no cookie/ambient credential auth.
    if (req.headers.host !== host || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') ||
      (req.headers.origin && req.headers.origin !== `http://${host}`) ||
      ['cross-site', 'same-site'].includes(String(req.headers['sec-fetch-site']))) return json(res, 403, {error: 'origin_denied'});
    if (req.method !== 'GET') return json(res, 405, {error: 'read_only_bridge'});
    let url: URL;
    try { url = new URL(req.url ?? '/', `http://${host}`); }
    catch { return json(res, 400, {error: 'invalid_request_target'}); }
    try {
      if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
      if (url.pathname === '/v1/status') return json(res, 200, bridge.status());
      if (url.pathname === '/v1/snapshot') return json(res, bridge.snapshot ? 200 : 503, {schema_version: '1.0', connection: bridge.status().connections.project, snapshot: bridge.snapshot});
      if (['/v1/events', '/v1/stream'].includes(url.pathname)) {
        const raw = req.headers['last-event-id'] ?? url.searchParams.get('after') ?? '0';
        if (typeof raw !== 'string' || !/^\d{1,8}$/.test(raw)) return json(res, 400, {error: 'invalid_cursor'});
        const cursor = Number(raw);
        if (cursor > bridge.journal.entries.length) return json(res, 409, {error: 'cursor_ahead', cursor: bridge.journal.entries.length});
        if (url.pathname === '/v1/events') {
          const limitRaw = url.searchParams.get('limit') ?? '100';
          if (!/^\d{1,4}$/.test(limitRaw) || Number(limitRaw) < 1 || Number(limitRaw) > 1000) return json(res, 400, {error: 'invalid_limit'});
          const entries = bridge.journal.entries.slice(cursor, cursor + Number(limitRaw));
          return json(res, 200, {schema_version: '1.0', mode: 'REPLAY', records: entries.map(e => bridge.envelope(e, true)), next_cursor: entries.at(-1)?.cursor ?? cursor, has_more: cursor + entries.length < bridge.journal.entries.length});
        }
        if (clients.size >= 8) return json(res, 503, {error: 'client_limit'});
        res.writeHead(200, {'Content-Type': 'text/event-stream', Connection: 'keep-alive'});
        const send = (type: string, data: unknown, id?: number) => {
          if (res.writableLength > 1_000_000) { res.destroy(); return; }
          res.write(`${id === undefined ? '' : `id: ${id}\n`}event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
        };
        res.write('retry: 2000\n\n'); clients.add(res);
        send('status', bridge.status());
        // No await between snapshot and subscription: a live record cannot fall in a gap.
        for (const entry of bridge.journal.entries.slice(cursor)) send('record', bridge.envelope(entry, true), entry.cursor);
        const record = (data: {cursor: number}) => send('record', data, data.cursor);
        const status = (data: unknown) => send('status', data);
        const snapshot = (data: unknown) => send('snapshot', data);
        bridge.on('record', record); bridge.on('status', status); bridge.on('snapshot', snapshot);
        const heartbeat = setInterval(() => send('status', bridge.status()), 5000);
        req.on('close', () => { clearInterval(heartbeat); clients.delete(res); bridge.off('record', record); bridge.off('status', status); bridge.off('snapshot', snapshot); });
        return;
      }
      const files: Record<string, string> = {'/': 'index.html', '/client.js': 'client.js', '/projection.js': 'projection.js', '/style.css': 'style.css'};
      const file = files[url.pathname];
      if (file) {
        res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css' : 'text/javascript');
        return res.end(await readFile(new URL(`../public/${file}`, import.meta.url)));
      }
      json(res, 404, {error: 'not_found'});
    } catch { if (!res.headersSent) json(res, 500, {error: 'bridge_error'}); else res.destroy(); }
  });
  const close = server.close.bind(server);
  server.close = ((callback?: (err?: Error) => void) => { for (const res of clients) res.end(); return close(callback); }) as typeof server.close;
  return server;
}
