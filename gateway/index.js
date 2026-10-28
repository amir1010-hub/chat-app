'use strict';
const http = require('node:http');
const path = require('node:path');
const proxy = require('http-proxy').createProxyServer({
  target: 'http://127.0.0.1:8080', ws: true, changeOrigin: false,
});
const serve = require('serve-static')(
  path.resolve(__dirname, '../telegram-client/dist'),
  { index: ['index.html'] },
);
const port = Number(process.env.PORT || 3000);
proxy.on('error', (err, req, res) => {
  console.error('Relay error:', err.message);
  if (res && !res.headersSent && typeof res.writeHead === 'function') {
    res.writeHead(502, {'content-type':'text/plain'});
    res.end('Telegram relay unavailable');
  }
});
const server = http.createServer((req, res) => {
  if (req.url?.startsWith('/tgproxy/')) return proxy.web(req, res);
  if (req.url === '/__health') {
    res.writeHead(200, {'content-type':'text/plain','cache-control':'no-store'});
    return res.end('gateway ok');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  serve(req, res, () => {
    res.statusCode=404;res.end('Not found');
  });
});
server.on('upgrade', (req, socket, head) => {
  if (!req.url?.startsWith('/tgproxy/ws/')) return socket.destroy();
  proxy.ws(req, socket, head);
});
server.listen(port, '0.0.0.0', () => {
  console.log('Gateway ready on port '+port+'. Open the forwarded Codespaces URL.');
});
