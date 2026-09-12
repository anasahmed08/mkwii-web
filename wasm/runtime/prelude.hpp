#pragma once
#include <cstdint>
#include <cstring>
#include <cmath>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
static_assert(sizeof(uintptr_t) == 4 || sizeof(uintptr_t) == 8,
              "wasm32-lowered or native wasm64 required");
#endif
extern "C" {
  extern uint8_t* g_mem_base;
  extern uint32_t g_mem_size;
}
constexpr uint32_t GUEST_MEM_MASK = 0x03FFFFFFu;
constexpr uint32_t GUEST_ADDR_BASE = 0x80000000u;
inline uint8_t* guest_ptr(uint32_t ea) { return g_mem_base + (ea & GUEST_MEM_MASK); }
template <typename T> inline T guest_read(uint32_t ea);
template <typename T> inline void guest_write(uint32_t ea, T v);
template <> inline uint8_t guest_read<uint8_t>(uint32_t ea) {
  return g_mem_base[ea & GUEST_MEM_MASK];
}
template <> inline uint16_t guest_read<uint16_t>(uint32_t ea) {
  uint16_t v; std::memcpy(&v, guest_ptr(ea), 2);
  return __builtin_bswap16(v);
}
template <> inline uint32_t guest_read<uint32_t>(uint32_t ea) {
  uint32_t v; std::memcpy(&v, guest_ptr(ea), 4);
  return __builtin_bswap32(v);
}
template <> inline uint64_t guest_read<uint64_t>(uint32_t ea) {
  uint64_t v; std::memcpy(&v, guest_ptr(ea), 8);
  return __builtin_bswap64(v);
}
template <> inline void guest_write<uint8_t>(uint32_t ea, uint8_t v) {
  g_mem_base[ea & GUEST_MEM_MASK] = v;
}
template <> inline void guest_write<uint16_t>(uint32_t ea, uint16_t v) {
  v = __builtin_bswap16(v); std::memcpy(guest_ptr(ea), &v, 2);
}
template <> inline void guest_write<uint32_t>(uint32_t ea, uint32_t v) {
  v = __builtin_bswap32(v); std::memcpy(guest_ptr(ea), &v, 4);
}
template <> inline void guest_write<uint64_t>(uint32_t ea, uint64_t v) {
  v = __builtin_bswap64(v); std::memcpy(guest_ptr(ea), &v, 8);
}
inline float  ppc_fres(float x)        { return 1.0f / std::sqrt(x); }
inline float  ppc_frsqrte(float x)     { return 1.0f / std::sqrt(x); }
inline double ppc_fres_d(double x)     { return 1.0 / std::sqrt(x); }
inline double ppc_frsqrte_d(double x)  { return 1.0 / std::sqrt(x); }
inline float  ppc_fsel(float a, float b, float c)      { return c >= 0.0f ? a : b; }
inline double ppc_fsel_d(double a, double b, double c) { return c >= 0.0 ? a : b; }
inline void ppc_dcbz(uint32_t, uint32_t) {}
extern "C" double wii_platform_time_nanos();
inline uint64_t ppc_mftb() { return (uint64_t)wii_platform_time_nanos(); }
#ifndef WII_RECOMP_SINGLE_THREADED
#define WII_RECOMP_SINGLE_THREADED 1
#endif
inline uint32_t ppc_lwarx(uint32_t ea) { return guest_read<uint32_t>(ea); }
inline int ppc_stwcx(uint32_t ea, uint32_t v) { guest_write<uint32_t>(ea, v); return 1; }