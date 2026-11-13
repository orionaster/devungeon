import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { createScoutMiddleware } from '../src/same-origin.ts';
import type { IncomingHttpHeaders } from 'node:http';

const raw = (base: string, path: string, headers = {}, method = 'GET') => new Promise<{status: number; body: string}>((resolve, reject) => {
  const url = new URL(base);
  const req = request({hostname: url.hostname, port: url.port, path, headers, method}, res => {
    let body = ''; res.on('data', c => body += c); res.on('end', () => resolve({status: res.statusCode!, body}));
  }); req.on('error', reject); req.end();
});
test('same-origin host forwards only four read routes/cursors and strips ambient credentials', async () => {
  const received: {url: string; headers: IncomingHttpHeaders}[] = [];
  const upstream = createServer((req, res) => {
    received.push({url: req.url!, headers: req.headers}); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ok: true}));
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  let middleware: ReturnType<typeof createScoutMiddleware>;
  const host = createServer((req, res) => middleware(req, res, () => {res.writeHead(404); res.end('host route');}));
  host.listen(0, '127.0.0.1'); await once(host, 'listening');
  const base = `http://127.0.0.1:${(host.address() as {port: number}).port}`;
  middleware = createScoutMiddleware({hostOrigin: base, bridgePort: (upstream.address() as {port: number}).port});
  try {
    for (const path of ['status', 'snapshot', 'events?after=0&limit=10', 'stream?after=1']) {
      assert.equal((await raw(base, `/scout-read/v1/${path}`, {Origin: base, Cookie: 'private=never-forward', Authorization: 'Bearer never-forward', 'Last-Event-ID': '1'})).status, 200);
    }
    assert.equal(received.length, 4);
    for (const {headers} of received) {
      assert.equal(headers.cookie, undefined); assert.equal(headers.authorization, undefined); assert.equal(headers.origin, undefined); assert.equal(headers['last-event-id'], '1');
    }
    const before = received.length;
    for (const [path, headers, method, status] of [
      ['/scout-read/v1/status', {Origin: 'https://evil.invalid'}, 'GET', 403],
      ['/scout-read/v1/status', {Host: 'evil.invalid'}, 'GET', 403],
      ['/scout-read/v1/status', {'Sec-Fetch-Site': 'same-site'}, 'GET', 403],
      ['/scout-read/v1/status', {}, 'POST', 405],
      ['/scout-read/v1/commands', {}, 'GET', 404],
      ['/scout-read/v1/stream?after=0&after=2', {}, 'GET', 400],
      ['/scout-read/v1/snapshot?repo=private', {}, 'GET', 400],
      ['/scout-read/v1/events?limit=1001', {}, 'GET', 400],
      ['/scout-read/v1/stream', {'Last-Event-ID': 'bad'}, 'GET', 400],
      ['/scout-read/../v1/status', {}, 'GET', 404],
      ['/scout-read/v1/%73tatus', {}, 'GET', 404],
    ] as const) assert.equal((await raw(base, path, headers, method)).status, status, path);
    assert.equal(received.length, before, 'denied paths must never hit the bridge');
    assert.equal((await raw(base, '/other-host-route')).body, 'host route');
  } finally { host.closeAllConnections(); upstream.closeAllConnections(); await Promise.all([new Promise<void>(r => host.close(() => r())), new Promise<void>(r => upstream.close(() => r()))]); }
});
test('host validates explicit loopback configuration and unavailable bridge is recoverable', async () => {
  for (const hostOrigin of ['http://localhost:5173', 'https://127.0.0.1:5173', 'http://127.0.0.1:5173/path', 'http://127.0.0.1:5173/']) assert.throws(() => createScoutMiddleware({hostOrigin, bridgePort: 4313}));
  assert.throws(() => createScoutMiddleware({hostOrigin: 'http://127.0.0.1:5173', bridgePort: 0}));
  assert.throws(() => createScoutMiddleware({hostOrigin: 'http://127.0.0.1:5173', bridgePort: 4313, mountPath: '/../'}));
  const unused = createServer(); unused.listen(0, '127.0.0.1'); await once(unused, 'listening');
  const port = (unused.address() as {port: number}).port; await new Promise<void>(r => unused.close(() => r()));
  let middleware: ReturnType<typeof createScoutMiddleware>;
  const host = createServer((req, res) => middleware(req, res, () => res.end()));
  host.listen(0, '127.0.0.1'); await once(host, 'listening');
  const base = `http://127.0.0.1:${(host.address() as {port: number}).port}`;
  middleware = createScoutMiddleware({hostOrigin: base, bridgePort: port});
  try {const response = await raw(base, '/scout-read/v1/status'); assert.equal(response.status, 502); assert.equal(JSON.parse(response.body).error, 'scout_bridge_unavailable');}
  finally {host.closeAllConnections(); await new Promise<void>(r => host.close(() => r()));}
});
