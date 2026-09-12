# Translator emitter changes for wasm32
All edits are in `vendor/wiicompiled/translator/src/Translator.Emit/`.
The audit tool (`server/audit-emitter.mjs`) reports which are still
missing after any change.
## 1. Replace raw pointer casts with guest_read / guest_write
Every memory access the emitter produces should route through
`guest_read<T>(ea)` / `guest_write<T>(ea, v)` from
`wasm/runtime/prelude.hpp`. Grep the generated C++ for
`reinterpret_cast` — each hit is a bug on wasm32.
    // before
    *reinterpret_cast<uint32_t*>(ea) = value;
    // after
    guest_write<uint32_t>(ea, value);
## 2. Ban inline asm and intrinsics
The emitter must not produce:
- `__asm` / `asm(...)`
- `_mm*` / `__m*` (SSE)
- `__builtin_ia32_*`
- `__rdtsc` / `__cpuid`
- `<immintrin.h>` / `<x86intrin.h>`
Portable replacements:
- `__builtin_popcount*` — keep as-is (portable)
- `__builtin_bswap*` — keep as-is (portable)
- `__rdtsc()` — use `ppc_mftb()` from prelude.hpp
- `__cpuid` — drop entirely
## 3. Guest pointer arithmetic must be uint32_t
Anywhere the emitter computes an offset, keep it as `uint32_t`, not
`size_t` or `uintptr_t`. Add:
    static_assert(sizeof(uintptr_t) == 4);
under `#ifdef __EMSCRIPTEN__` in the generated prelude (already present
in `wasm/runtime/prelude.hpp`).
## 4. DCBZ becomes a no-op
Grep for `dcbz`. It must emit `ppc_dcbz(ea, 0)`. Do not emit
`__builtin_clear_cache`.
## 5. Atomics
`lwarx`/`stwcx.` pairs become `std::atomic<uint32_t>` under pthreads,
plain load/store under the single-threaded model. Guard with
`#ifdef WII_RECOMP_SINGLE_THREADED`.
## 6. Timed waits
`mftb` / `mftbu` emit `ppc_mftb()`. The runtime resolves it to
`wii_platform_time_nanos()`.
## 7. Floating-point status register
Emit no-ops. MKW does not read FPSCR in any behavior-affecting path.
## 8. Function pointers
Keep the existing function-table index layout. Do not emit raw function
pointers — wasm requires table indices.
## Verifying
    node server/audit-emitter.mjs path/to/generated
Exit code 0 means clean. Any output containing `FATAL` must be fixed
before the build will link.