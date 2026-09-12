#include <emscripten.h>
#include <cstdint>
extern "C" {
static float g_steer = 0.0f;
static float g_accel = 0.0f;
EMSCRIPTEN_KEEPALIVE void motion_set(float steer, float accel) { g_steer = steer; g_accel = accel; }
EMSCRIPTEN_KEEPALIVE float motion_get_steer() { return g_steer; }
EMSCRIPTEN_KEEPALIVE float motion_get_accel() { return g_accel; }
EMSCRIPTEN_KEEPALIVE void motion_clear() { g_steer = 0.0f; g_accel = 0.0f; }
}