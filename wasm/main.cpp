#include <cstdio>
#include <cstring>
#include <string>
#include <emscripten.h>
extern "C" {
  __attribute__((weak)) int recomp_init(const char* p) { std::printf("[mkwii] recomp_init stub (%s)\n", p ? p : ""); return 0; }
  __attribute__((weak)) void recomp_run_frame() {}
  __attribute__((weak)) void recomp_shutdown() {}
  __attribute__((weak)) void recomp_input(int, int) {}
  __attribute__((weak)) int recomp_load_rel(const char*, uint32_t) { return 0; }
}
extern "C" {
  void gx_webgpu_init();
  void gx_webgpu_frame_begin();
  void gx_webgpu_frame_end();
  void gx_webgpu_present();
  void gx_webgpu_resize(int, int);
  void memfs_bootstrap();
  void dol_apply_hooks();
  void input_set(int, int);
  void mod_set_enabled(int);
  void os_thread_scheduler_tick();
}
static std::string g_disc_path;
static std::string g_rel_path;
static uint32_t g_rel_load_address = 0x805102E0;
static int g_retro_rewind = 0;
static bool g_running = false;
extern "C" {
EMSCRIPTEN_KEEPALIVE void set_disc_path(const char* p) { if (p) g_disc_path = p; }
EMSCRIPTEN_KEEPALIVE void set_rel_path(const char* p) { if (p) g_rel_path = p; }
EMSCRIPTEN_KEEPALIVE void set_rel_load_address(uint32_t a) { g_rel_load_address = a; }
EMSCRIPTEN_KEEPALIVE void set_retro_rewind(int v) { g_retro_rewind = v; }
EMSCRIPTEN_KEEPALIVE void inject_input(int code, int pressed) { input_set(code, pressed); }
EMSCRIPTEN_KEEPALIVE void resize_canvas(int w, int h) { gx_webgpu_resize(w, h); }
EMSCRIPTEN_KEEPALIVE int mkwii_start() {
  if (g_running) return 0;
  memfs_bootstrap();
  gx_webgpu_init();
  std::printf("[mkwii] recomp_init (disc=%s, rel=%s @ 0x%08X, rr=%d)\n",
              g_disc_path.empty() ? "(backend)" : g_disc_path.c_str(),
              g_rel_path.empty() ? "(none)" : g_rel_path.c_str(),
              g_rel_load_address, g_retro_rewind);
  if (recomp_init("(disc-backend)") != 0) {
    std::fprintf(stderr, "[mkwii] recomp_init failed\n");
    return -1;
  }
  if (!g_rel_path.empty()) {
    if (recomp_load_rel(g_rel_path.c_str(), g_rel_load_address) != 0) {
      std::fprintf(stderr, "[mkwii] rel load failed: %s\n", g_rel_path.c_str());
    }
  }
  dol_apply_hooks();
  mod_set_enabled(g_retro_rewind);
  g_running = true;
  emscripten_set_main_loop([]() {
    os_thread_scheduler_tick();
    gx_webgpu_frame_begin();
    recomp_run_frame();
    gx_webgpu_frame_end();
    gx_webgpu_present();
  }, 0, 1);
  return 0;
}
}
int main(int, char**) {
  std::printf("[mkwii] main() — call _mkwii_start() from JS\n");
  return 0;
}