#include <cstdint>
#include <cstring>
#include <cstdio>
#include <emscripten.h>
extern "C" {
  extern uint8_t* g_mem_base;
  extern uint32_t g_mem_size;
}
namespace {
struct Hook {
  char symbol[128];
  uint32_t address;
  uint32_t instructions[4];
  int count;
  int mode;
};
Hook g_hooks[32];
int g_hookCount = 0;
inline void write_u32_be(uint32_t ea, uint32_t v) {
  uint32_t off = ea & 0x03FFFFFF;
  if (off + 4 > g_mem_size) return;
  g_mem_base[off + 0] = (v >> 24) & 0xFF;
  g_mem_base[off + 1] = (v >> 16) & 0xFF;
  g_mem_base[off + 2] = (v >>  8) & 0xFF;
  g_mem_base[off + 3] = (v      ) & 0xFF;
}
}
extern "C" {
EMSCRIPTEN_KEEPALIVE
int dol_add_hook(const char* symbol, uint32_t address, int mode,
                 uint32_t i0, uint32_t i1, uint32_t i2, uint32_t i3, int count) {
  if (g_hookCount >= 32) return -1;
  Hook& h = g_hooks[g_hookCount++];
  std::strncpy(h.symbol, symbol ? symbol : "", sizeof(h.symbol) - 1);
  h.address = address;
  h.mode = mode;
  h.instructions[0] = i0;
  h.instructions[1] = i1;
  h.instructions[2] = i2;
  h.instructions[3] = i3;
  h.count = count;
  return 0;
}
EMSCRIPTEN_KEEPALIVE
void dol_apply_hooks() {
  for (int i = 0; i < g_hookCount; i++) {
    Hook& h = g_hooks[i];
    if (h.address == 0) continue;
    if (h.mode == 0) {
      for (int j = 0; j < h.count && j < 4; j++) write_u32_be(h.address + j * 4, h.instructions[j]);
      std::printf("[dol-hook] %s: wrote %d instr at %08x\n", h.symbol, h.count, h.address);
    } else if (h.mode == 1) {
      uint32_t dest = h.instructions[0];
      int32_t off = (int32_t)(dest - h.address);
      uint32_t branch = 0x48000000 | (off & 0x03FFFFFC);
      write_u32_be(h.address, branch);
      std::printf("[dol-hook] %s: branch at %08x -> %08x\n", h.symbol, h.address, dest);
    } else if (h.mode == 2) {
      for (int j = 0; j < h.count && j < 4; j++) write_u32_be(h.address + j * 4, 0x60000000);
      std::printf("[dol-hook] %s: nop'd %d instr\n", h.symbol, h.count);
    }
  }
  g_hookCount = 0;
}
}