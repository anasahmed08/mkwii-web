#include <emscripten.h>
#include <emscripten/html5.h>
#include <cstdio>
#include <cstdint>
extern "C" {
EMSCRIPTEN_KEEPALIVE double wii_platform_time_seconds() { return emscripten_get_now() / 1000.0; }
EMSCRIPTEN_KEEPALIVE double wii_platform_time_nanos()   { return emscripten_get_now() * 1000000.0; }
EMSCRIPTEN_KEEPALIVE void   wii_platform_sleep_ms(int ms) { emscripten_sleep(ms); }
EMSCRIPTEN_KEEPALIVE int    wii_platform_num_cores() { return emscripten_num_logical_cores(); }
EMSCRIPTEN_KEEPALIVE void   wii_platform_log(const char* m) { if (m) std::fprintf(stderr, "[runtime] %s\n", m); }
EMSCRIPTEN_KEEPALIVE
void wii_platform_set_canvas_size(int w, int h) {
  emscripten_set_canvas_element_size("#game-canvas", w, h);
}
EMSCRIPTEN_KEEPALIVE
void wii_platform_get_canvas_size(int* outW, int* outH) {
  int w = 0, h = 0;
  emscripten_get_canvas_element_size("#game-canvas", &w, &h);
  if (outW) *outW = w;
  if (outH) *outH = h;
}
EMSCRIPTEN_KEEPALIVE
void wii_platform_toggle_fullscreen() {
  EmscriptenFullscreenStrategy s = {};
  s.scaleMode = EMSCRIPTEN_FULLSCREEN_SCALE_STRETCH;
  s.canvasResolutionScaleMode = EMSCRIPTEN_FULLSCREEN_CANVAS_SCALE_STDDEF;
  s.filteringMode = EMSCRIPTEN_FULLSCREEN_FILTERING_DEFAULT;
  emscripten_request_fullscreen_strategy("#game-canvas", true, &s);
}
}