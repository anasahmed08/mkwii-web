#include <emscripten.h>
#include <cstdint>
#include <cstring>
#include <cstdio>
EM_ASYNC_JS(int, disc_js_read_raw,
            (uint32_t offset, uint8_t* out, uint32_t len), {
  const be = Module.discBackend;
  if (!be || !be.readRaw) return -1;
  try {
    const buf = await be.readRaw(offset, len);
    if (!buf || !buf.length) return 0;
    const n = Math.min(buf.length, len);
    HEAPU8.set(buf.subarray(0, n), out);
    return n;
  } catch (e) { console.error('[disc] readRaw', e); return -1; }
});
EM_ASYNC_JS(int, disc_js_read_file,
            (const char* pathPtr, uint8_t* out, uint32_t maxLen), {
  const be = Module.discBackend;
  if (!be || !be.readFile) return -1;
  const path = UTF8ToString(pathPtr);
  try {
    const buf = await be.readFile(path);
    const n = Math.min(buf.length, maxLen);
    HEAPU8.set(buf.subarray(0, n), out);
    return buf.length;
  } catch (e) { return 0; }
});
EM_ASYNC_JS(int, disc_js_stat,
            (const char* pathPtr, uint32_t* outSize, uint32_t* outOff), {
  const be = Module.discBackend;
  if (!be || !be.stat) return 0;
  const path = UTF8ToString(pathPtr);
  try {
    const s = await be.stat(path);
    if (!s) return 0;
    HEAPU32[outSize >> 2] = s.size;
    HEAPU32[outOff >> 2] = s.offset || 0;
    return 1;
  } catch (e) { return 0; }
});
EM_ASYNC_JS(int, disc_js_is_overlaid, (const char* pathPtr), {
  const be = Module.discBackend;
  if (!be || !be.isOverlaid) return 0;
  return be.isOverlaid(UTF8ToString(pathPtr)) ? 1 : 0;
});
extern "C" {
EMSCRIPTEN_KEEPALIVE int disc_read_raw(uint32_t o, uint8_t* b, uint32_t n) {
  return disc_js_read_raw(o, b, n);
}
EMSCRIPTEN_KEEPALIVE int disc_read_file(const char* p, uint8_t* b, uint32_t n) {
  return disc_js_read_file(p, b, n);
}
EMSCRIPTEN_KEEPALIVE int disc_stat(const char* p, uint32_t* sz, uint32_t* off) {
  return disc_js_stat(p, sz, off);
}
EMSCRIPTEN_KEEPALIVE int disc_is_overlaid(const char* p) {
  return disc_js_is_overlaid(p);
}
EMSCRIPTEN_KEEPALIVE
int wii_disc_open(const char* path, uint32_t* out_size) {
  uint32_t sz = 0, off = 0;
  if (!disc_stat(path, &sz, &off)) return 0;
  if (out_size) *out_size = sz;
  return 1;
}
EMSCRIPTEN_KEEPALIVE
int wii_disc_read(const char* path, uint32_t offset, uint8_t* out, uint32_t len) {
  uint32_t sz = 0, off = 0;
  if (disc_stat(path, &sz, &off)) {
    if (offset + len > sz) return -1;
    return disc_read_file(path, out, len);
  }
  return disc_read_raw(offset, out, len);
}
}