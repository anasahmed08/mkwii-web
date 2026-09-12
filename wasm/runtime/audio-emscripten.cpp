#include <emscripten.h>
#include <cstdint>
#include <cstring>
namespace {
constexpr int RING_FRAMES = 48000 * 3;
float g_ring[2][RING_FRAMES];
volatile uint32_t g_write = 0;
volatile uint32_t g_read = 0;
float g_volume = 0.8f;
}
extern "C" {
EMSCRIPTEN_KEEPALIVE
void wii_audio_init() {
  EM_ASM({
    if (window.__mkwii_audio) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
    window.__mkwii_audio = { ctx };
  });
}
EMSCRIPTEN_KEEPALIVE
void wii_audio_push(const float* interleaved, int frames) {
  for (int i = 0; i < frames; i++) {
    g_ring[0][g_write] = interleaved[i * 2 + 0];
    g_ring[1][g_write] = interleaved[i * 2 + 1];
    g_write = (g_write + 1) % RING_FRAMES;
  }
}
EMSCRIPTEN_KEEPALIVE
void wii_audio_pull(float* outL, float* outR, int frames) {
  for (int i = 0; i < frames; i++) {
    if (g_read == g_write) { outL[i] = 0.0f; outR[i] = 0.0f; continue; }
    outL[i] = g_ring[0][g_read] * g_volume;
    outR[i] = g_ring[1][g_read] * g_volume;
    g_read = (g_read + 1) % RING_FRAMES;
  }
}
EMSCRIPTEN_KEEPALIVE void wii_audio_set_volume(float v) {
  if (v < 0.0f) v = 0.0f;
  if (v > 1.0f) v = 1.0f;
  g_volume = v;
}
EMSCRIPTEN_KEEPALIVE float wii_audio_get_volume() { return g_volume; }
EMSCRIPTEN_KEEPALIVE
void wii_audio_resume() {
  EM_ASM({
    const a = window.__mkwii_audio;
    if (a && a.ctx.state === 'suspended') a.ctx.resume();
  });
}
}