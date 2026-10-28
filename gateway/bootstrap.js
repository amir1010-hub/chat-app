(function () {
  'use strict';
  if (globalThis.__telegramRelayInstalled) return;
  Object.defineProperty(globalThis, '__telegramRelayInstalled', { value: true });
  const origin = globalThis.location.origin;
  function route(value) {
    const u = new URL(String(value), globalThis.location.href);
    if (u.hostname === 'web.telegram.org' || /^[a-z0-9-]+\.web\.telegram\.org$/i.test(u.hostname)) {
      if (!['https:', 'http:', 'wss:', 'ws:'].includes(u.protocol)) return String(value);
      const websocket = u.protocol === 'ws:' || u.protocol === 'wss:';
      return (websocket ? origin.replace(/^http/, 'ws') : origin)
        + '/__telegram/' + u.hostname + u.pathname + u.search + u.hash;
    }
    return value;
  }
  if (globalThis.WebSocket) {
    const Native = globalThis.WebSocket;
    globalThis.WebSocket = class WebSocket extends Native {
      constructor(url, protocols) {
        if (protocols === undefined) super(route(url));
        else super(route(url), protocols);
      }
    };
  }
  if (globalThis.fetch) {
    const nativeFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = function (input, options) {
      if (input instanceof Request) {
        const url = route(input.url);
        return nativeFetch(url === input.url ? input : new Request(url, input), options);
      }
      return nativeFetch(route(input), options);
    };
  }
  if (globalThis.XMLHttpRequest) {
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      return open.call(this, method, route(url), ...rest);
    };
  }
  if (globalThis.EventSource) {
    const Native = globalThis.EventSource;
    globalThis.EventSource = class EventSource extends Native {
      constructor(url, options) { super(route(url), options); }
    };
  }
  // Calls use direct WebRTC connections. Keep them disabled in relay mode.
  if (globalThis.RTCPeerConnection) {
    globalThis.RTCPeerConnection = class RTCPeerConnection {
      constructor() { throw new DOMException('Calls are unavailable in relay mode', 'NotSupportedError'); }
    };
    globalThis.webkitRTCPeerConnection = globalThis.RTCPeerConnection;
  }
})();
