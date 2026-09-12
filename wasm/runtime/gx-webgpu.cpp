#include <emscripten.h>
#include <cstdint>
#include <cstdio>
#ifdef AURORA_BACKEND_WEBGPU
#include <aurora/gfx.h>
#include <aurora/gx.h>
#include <aurora/webgpu/context.h>
#endif
extern "C" {
#ifdef AURORA_BACKEND_WEBGPU
EMSCRIPTEN_KEEPALIVE int gx_webgpu_init() {
  aurora::gfx::initialize();
  std::printf("[gx] aurora WebGPU backend initialized\n");
  return 0;
}
EMSCRIPTEN_KEEPALIVE void gx_webgpu_frame_begin() { aurora::gfx::begin_frame(); }
EMSCRIPTEN_KEEPALIVE void gx_webgpu_frame_end()   { aurora::gfx::end_frame(); }
EMSCRIPTEN_KEEPALIVE void gx_webgpu_submit(const uint8_t* fifo, uint32_t size) {
  aurora::gx::process_fifo(fifo, size);
}
EMSCRIPTEN_KEEPALIVE void gx_webgpu_upload_texture(uint32_t dst, uint32_t src, uint32_t size,
                                                    uint32_t format, uint32_t tlut) {
  aurora::gx::upload_texture(dst, src, size, format, tlut);
}
EMSCRIPTEN_KEEPALIVE void gx_webgpu_present() { aurora::gfx::present(); }
EMSCRIPTEN_KEEPALIVE void gx_webgpu_resize(int w, int h) { aurora::gfx::on_resize(w, h); }
#else
EMSCRIPTEN_KEEPALIVE int  gx_webgpu_init() { return 0; }
EMSCRIPTEN_KEEPALIVE void gx_webgpu_frame_begin() {}
EMSCRIPTEN_KEEPALIVE void gx_webgpu_frame_end() {}
EMSCRIPTEN_KEEPALIVE void gx_webgpu_submit(const uint8_t*, uint32_t) {}
EMSCRIPTEN_KEEPALIVE void gx_webgpu_upload_texture(uint32_t,uint32_t,uint32_t,uint32_t,uint32_t) {}
EMSCRIPTEN_KEEPALIVE void gx_webgpu_present() {}
EMSCRIPTEN_KEEPALIVE void gx_webgpu_resize(int, int) {}
#endif
}