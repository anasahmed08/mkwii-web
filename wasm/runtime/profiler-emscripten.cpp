#include <emscripten.h>
#include <cstdint>
extern "C" {
EM_JS(void, profiler_js_begin, (const char* name), {
  if (window.__mkwii_profiler) window.__mkwii_profiler.mark(UTF8ToString(name));
});
EM_JS(void, profiler_js_end, (const char* name, const char* startMark), {
  if (window.__mkwii_profiler) window.__mkwii_profiler.measure(UTF8ToString(name), UTF8ToString(startMark));
});
EMSCRIPTEN_KEEPALIVE void profiler_begin_scheduler() { profiler_js_begin("scheduler"); }
EMSCRIPTEN_KEEPALIVE void profiler_end_scheduler()   { profiler_js_end("scheduler", "scheduler"); }
EMSCRIPTEN_KEEPALIVE void profiler_begin_guest_frame() { profiler_js_begin("guest_frame"); }
EMSCRIPTEN_KEEPALIVE void profiler_end_guest_frame()   { profiler_js_end("guest_frame", "guest_frame"); }
EMSCRIPTEN_KEEPALIVE void profiler_begin_gx_flush() { profiler_js_begin("gx_flush"); }
EMSCRIPTEN_KEEPALIVE void profiler_end_gx_flush()   { profiler_js_end("gx_flush", "gx_flush"); }
EMSCRIPTEN_KEEPALIVE void profiler_begin_render() { profiler_js_begin("render"); }
EMSCRIPTEN_KEEPALIVE void profiler_end_render()   { profiler_js_end("render", "render"); }
}