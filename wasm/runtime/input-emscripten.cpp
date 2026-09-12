#include <emscripten.h>
#include <cstdint>
#include <cstring>
extern "C" {
static uint32_t g_buttons = 0;
EMSCRIPTEN_KEEPALIVE
void input_set(int code, int pressed) {
  if (code < 0 || code >= 32) return;
  const uint32_t m = 1u << code;
  if (pressed) g_buttons |= m; else g_buttons &= ~m;
}
EMSCRIPTEN_KEEPALIVE uint32_t input_get_mask() { return g_buttons; }
EMSCRIPTEN_KEEPALIVE
int input_is_pressed(int code) {
  if (code < 0 || code >= 32) return 0;
  return (g_buttons >> code) & 1u;
}
static float g_sticks[4][4] = {};
EMSCRIPTEN_KEEPALIVE
void input_set_stick(int port, int axis, float value) {
  if (port < 0 || port > 3 || axis < 0 || axis > 3) return;
  g_sticks[port][axis] = value;
}
EMSCRIPTEN_KEEPALIVE
float input_get_stick(int port, int axis) {
  if (port < 0 || port > 3 || axis < 0 || axis > 3) return 0.0f;
  return g_sticks[port][axis];
}
EMSCRIPTEN_KEEPALIVE
void input_rumble(int port, float low, float high) {
  EM_ASM({
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads[$0];
    if (p && p.vibrationActuator) {
      p.vibrationActuator.playEffect('dual-rumble', {
        duration: 60, strongMagnitude: $2, weakMagnitude: $1,
      });
    }
  }, port, low, high);
}
}