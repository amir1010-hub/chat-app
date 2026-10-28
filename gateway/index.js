'use strict';
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const httpProxy = require('http-proxy');

const bootstrap = fs.readFileSync(path.join(__dirname, 'bootstrap.js'), 'utf8');
const wrapper = fs.readFileSync(path.join(__dirname, '../index.html'));
const agent = new https.Agent({ keepAlive: true, maxSockets: 32 });
const cache = new Map();
let cacheBytes = 0;
const CACHE_LIMIT = 96 * 1024 * 1024;
const TEXT_LIMIT = 24 * 1024 * 1024;
const ALLOWED_HOST = /^(?:[a-z0-9-]+\.)?web\.telegram\.org$/i;
const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' wss:; worker-src 'self' blob:; img-src 'self' blob: data:; media-src 'self' blob: data:; font-src 'self' data:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

function route(url) {
  const u = new URL(url, 'http://relay.local');
  if (u.pathname.startsWith('/a/')) return { host: 'web.telegram.org', path: u.pathname + u.search, asset: true };
  const mapped = /^\/__telegram\/([^/]+)(\/.*)$/.exec(u.pathname);
  if (mapped) {
    const host = mapped[1].toLowerCase();
    if (!ALLOWED_HOST.test(host)) return null;
    return { host, path: mapped[2] + u.search, asset: host === 'web.telegram.org' && mapped[2].startsWith('/a/') };
  }
  const legacy = /^\/tgproxy\/(ws|http)\/([1-5](?:-1)?)$/.exec(u.pathname);
  if (legacy) {
    const suffix = (u.searchParams.has('test') ? '_test' : '') + (u.searchParams.has('premium') ? '_premium' : '');
    return { host: 'zws' + legacy[2] + '.web.telegram.org', path: '/' + (legacy[1] === 'ws' ? 'apiws' : 'apiw1') + suffix, asset: false };
  }
  return null;
}

function security(res, req) {
  const host = req.headers.host;
  const wsOrigin = host && /^[a-z0-9.:-]+$/i.test(host) ? 'wss://' + host : '';
  res.setHeader('Content-Security-Policy', csp.replace("connect-src 'self' wss:", "connect-src 'self' " + wsOrigin));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function transform(body, type) {
  if (/javascript|ecmascript/i.test(type)) return bootstrap + '\n' + body;
  if (/text\/html/i.test(type)) {
    return body.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, '')
      .replace(/\s+integrity\s*=\s*(["']).*?\1/gi, '')
      .replace(/https:\/\/web\.telegram\.org(?=\/)/g, '')
      .replace(/<head([^>]*)>/i, '<head$1><script src="/__relay/bootstrap.js"></script>');
  }
  return body;
}

function fail(res, status, text) {
  if (res.headersSent) return res.destroy();
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

function upstream(req, res, target) {
  const key = target.host + target.path;
  const entry = req.method === 'GET' && target.asset ? cache.get(key) : null;
  if (entry) {
    res.writeHead(entry.status, entry.headers);
    return res.end(entry.body);
  }
  const headers = {
    'user-agent': 'Mozilla/5.0 TelegramWebRelay/1.0',
    'accept': req.headers.accept || '*/*',
    'accept-encoding': 'identity',
    'origin': 'https://web.telegram.org',
    'referer': 'https://web.telegram.org/a/',
  };
  for (const h of ['content-type', 'content-length', 'range', 'if-range']) {
    if (req.headers[h]) headers[h] = req.headers[h];
  }
  const remote = https.request({ hostname: target.host, port: 443, path: target.path,
    method: req.method, headers, agent, timeout: 45000 }, (response) => {
    const type = response.headers['content-type'] || 'application/octet-stream';
    const out = { 'Content-Type': type, 'Cache-Control': target.asset ? 'public, max-age=300' : 'no-store' };
    for (const h of ['content-range', 'accept-ranges']) if (response.headers[h]) out[h] = response.headers[h];
    const location = response.headers.location;
    if (location) {
      const u = new URL(location, 'https://' + target.host + target.path);
      if (!ALLOWED_HOST.test(u.hostname)) { response.resume(); return fail(res, 502, 'Upstream redirect rejected'); }
      out.Location = '/__telegram/' + u.hostname + u.pathname + u.search;
    }
    const text = target.asset && /javascript|ecmascript|text\/html/i.test(type);
    if (!text || req.method === 'HEAD') {
      res.writeHead(response.statusCode, out);
      response.on('error', () => res.destroy());
      return response.pipe(res);
    }
    let size = 0;
    const chunks = [];
    response.on('data', chunk => {
      size += chunk.length;
      if (size > TEXT_LIMIT) { response.destroy(); fail(res, 502, 'Upstream asset too large'); }
      else chunks.push(chunk);
    });
    response.on('error', () => fail(res, 502, 'Upstream read failed'));
    response.on('end', () => {
      if (res.destroyed || size > TEXT_LIMIT) return;
      const body = Buffer.from(transform(Buffer.concat(chunks).toString('utf8'), type));
      if (response.statusCode === 200 && req.method === 'GET' && !/text\/html/i.test(type) && body.length < CACHE_LIMIT) {
        while (cacheBytes + body.length > CACHE_LIMIT && cache.size) {
          const first = cache.keys().next().value;
          cacheBytes -= cache.get(first).body.length;
          cache.delete(first);
        }
        cache.set(key, { status: response.statusCode, headers: out, body });
        cacheBytes += body.length;
      }
      res.writeHead(response.statusCode, out);
      res.end(body);
    });
  });
  remote.on('timeout', () => remote.destroy(new Error('timeout')));
  remote.on('error', () => fail(res, 502, 'Telegram upstream unavailable'));
  req.on('aborted', () => remote.destroy());
  req.pipe(remote);
}

const websocket = httpProxy.createProxyServer({ ws: true, changeOrigin: true, secure: true });
websocket.on('proxyReqWs', proxyReq => {
  for (const h of ['cookie', 'authorization', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto']) proxyReq.removeHeader(h);
  proxyReq.setHeader('origin', 'https://web.telegram.org');
});
websocket.on('error', (_error, _req, socket) => socket.destroy());
websocket.on('open', () => console.log('Telegram WebSocket connected'));

const server = http.createServer((req, res) => {
  security(res, req);
  const url = new URL(req.url, 'http://relay.local');
  if (url.pathname === '/__health' || url.pathname === '/tgproxy/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    return res.end('ok');
  }
  if (url.pathname === '/__relay/bootstrap.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' });
    return res.end(bootstrap);
  }
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(wrapper);
  }
  if (url.pathname === '/a') { res.writeHead(302, { Location: '/a/' }); return res.end(); }
  const target = route(req.url);
  if (!target) return fail(res, 404, 'Not found');
  if (target.asset && !['GET', 'HEAD'].includes(req.method)) return fail(res, 405, 'Method not allowed');
  upstream(req, res, target);
});
server.on('upgrade', (req, socket, head) => {
  const target = route(req.url);
  if (!target || !/^\/apiws(?:_test)?(?:_premium)?$/.test(target.path)) {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return;
  }
  req.url = target.path;
  websocket.ws(req, socket, head, { target: 'wss://' + target.host });
});
if (require.main === module) server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log('Telegram window ready on port ' + (process.env.PORT || 3000));
});
module.exports = { route, transform, server };
