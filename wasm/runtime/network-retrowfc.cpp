#include <emscripten.h>
#include <cstdint>
#include <cstring>
#include <cstdio>
namespace {
constexpr int MAX_SOCKS = 32;
int g_sockState[MAX_SOCKS] = {};
}
extern "C" {
static char g_bridgeUrl[256] = {};
static char g_rwfcDns[128] = "rwfc.net";
static int g_wifiEnabled = 0;
EMSCRIPTEN_KEEPALIVE
void network_set_bridge(const char* url) {
  if (url) std::strncpy(g_bridgeUrl, url, sizeof(g_bridgeUrl) - 1);
  std::printf("[net] RWFC bridge = %s\n", g_bridgeUrl);
}
EMSCRIPTEN_KEEPALIVE
void network_set_rwfc_dns(const char* dns) {
  if (dns) std::strncpy(g_rwfcDns, dns, sizeof(g_rwfcDns) - 1);
  std::printf("[net] RWFC DNS = %s\n", g_rwfcDns);
}
EMSCRIPTEN_KEEPALIVE
void network_set_wifi_enabled(int enabled) {
  g_wifiEnabled = enabled;
  std::printf("[net] WiFi %s\n", enabled ? "enabled" : "disabled");
}
EM_JS(void, net_js_open, (int sock, const char* host, int port), {
  const h = UTF8ToString(host);
  if (!window.__mkwii_net) window.__mkwii_net = { socks: {}, bridge: '' };
  const ws = new WebSocket(
    window.__mkwii_net.bridge +
    '?host=' + encodeURIComponent(h) + '&port=' + port
  );
  ws.binaryType = 'arraybuffer';
  const entry = { ws, state: 0 };
  window.__mkwii_net.socks[sock] = entry;
  ws.onopen = () => { entry.state = 2; Module._net_on_open(sock); };
  ws.onclose = () => { entry.state = 3; Module._net_on_close(sock); };
  ws.onerror = () => { entry.state = 3; Module._net_on_error(sock); };
  ws.onmessage = (ev) => {
    const buf = new Uint8Array(ev.data);
    const ptr = Module._malloc(buf.length);
    HEAPU8.set(buf, ptr);
    Module._net_on_recv(sock, ptr, buf.length);
    Module._free(ptr);
  };
});
EM_JS(void, net_js_send, (int sock, const uint8_t* data, int len), {
  const e = window.__mkwii_net && window.__mkwii_net.socks[sock];
  if (!e || e.state !== 2) return;
  e.ws.send(HEAPU8.slice(data, data + len));
});
EM_JS(void, net_js_close, (int sock), {
  const e = window.__mkwii_net && window.__mkwii_net.socks[sock];
  if (!e) return;
  try { e.ws.close(); } catch (_) {}
  delete window.__mkwii_net.socks[sock];
});
EMSCRIPTEN_KEEPALIVE
int net_socket_open(const char* host, uint16_t port) {
  if (!g_bridgeUrl[0] || !g_wifiEnabled) return -1;
  for (int i = 0; i < MAX_SOCKS; i++) {
    if (g_sockState[i] == 0) {
      g_sockState[i] = 1;
      net_js_open(i, host, port);
      return i;
    }
  }
  return -1;
}
EMSCRIPTEN_KEEPALIVE
int net_socket_send(int sock, const uint8_t* data, int len) {
  if (sock < 0 || sock >= MAX_SOCKS || g_sockState[sock] != 2) return -1;
  net_js_send(sock, data, len);
  return len;
}
EMSCRIPTEN_KEEPALIVE
void net_socket_close(int sock) {
  if (sock < 0 || sock >= MAX_SOCKS) return;
  net_js_close(sock);
  g_sockState[sock] = 0;
}
__attribute__((weak)) void net_on_open(int) {}
__attribute__((weak)) void net_on_close(int) {}
__attribute__((weak)) void net_on_error(int) {}
__attribute__((weak)) void net_on_recv(int, const uint8_t*, int) {}
EMSCRIPTEN_KEEPALIVE void net_on_open(int sock) { g_sockState[sock] = 2; net_on_open(sock); }
EMSCRIPTEN_KEEPALIVE void net_on_close(int sock) { g_sockState[sock] = 3; net_on_close(sock); }
EMSCRIPTEN_KEEPALIVE void net_on_error(int sock) { g_sockState[sock] = 3; net_on_error(sock); }
EMSCRIPTEN_KEEPALIVE void net_on_recv(int sock, const uint8_t* data, int len) { net_on_recv(sock, data, len); }
EMSCRIPTEN_KEEPALIVE int net_is_available() { return (g_bridgeUrl[0] && g_wifiEnabled) ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE const char* net_get_rwfc_dns() { return g_rwfcDns; }
}