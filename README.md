# mkwii-web

**Archived experiment.** Run Mario Kart Wii in a browser tab — abandoned, but the work is here.

> **Original goal:** play MKWii on any device — desktop, Android, or iPhone — from nothing but a ROM and a browser.
>
> **Outcome:** not viable in 2026. The blockers are documented below. This repo is preserved as an artifact, not a product.

---

## Why I stopped

Three hard blockers, all outside my control:

1. **The recompiler C++ emitter emits x86-specific constructs.** Emscripten cannot link them without edits to upstream WiiCompiled source I do not own. Documented in [docs/EMITTER-CHANGES.md](docs/EMITTER-CHANGES.md).
2. **aurora WebGPU backend is not at parity under wasm64.** The GX to WebGPU layer that would render the game exists but is not ready.
3. **Apple has not shipped memory64 in Safari.** No timeline. iOS is the entire point of a browser port, and without it the target platform is unreachable.

Even if those were solved, a **hosted** version faces legal exposure from processing ISOs on my infrastructure, plus bandwidth and CPU costs that make the economics ugly. A local-first version — user runs docker compose up on their own PC — sidesteps the legal issue but is exactly what Dolphin and WiiCompiled already do, on platforms that do not have these blockers.

---

## What this is

A browser front-end wrapped around two existing PC projects:

- **[WiiCompiled](https://github.com/patchzyy/Wiicompiled)** — a static recompiler that translates Mario Kart Wii PowerPC code into portable C++, which is then compiled natively. This is the engine.
- **[WheelWizard](https://github.com/TeamWheelWizard/WheelWizard)** — the mod launcher for Mario Kart Wii, whose Retro Rewind pack format and RWFC online server this project targets.

This repo adds the missing piece: an **Emscripten + WebGPU platform layer** that lets the WiiCompiled runtime and its bundled [aurora](https://github.com/encounter/aurora) graphics backend compile to WebAssembly and run in a browser.

## What works

- Full web UI: disc loader, settings, controller config, profiler, in-browser log
- Disc readers for **ISO, RVZ, and WBFS** (FST parser, DOL parser, SZS/Yaz0)
- **Retro Rewind** mod staging (Riivolution XML + internal SZS injection)
- **Retro WFC** room browser and DOL hostname patcher
- Input: keyboard, gamepad, touch, and **gyroscope** (Wii Remote tilt on iPhone)
- Save state via IndexedDB, AudioWorklet output pipeline
- An animated stub renderer that proves the whole worker to WASM to canvas flow
- A Docker-based translation service that orchestrates WiiCompiled end-to-end
- An Emscripten platform layer with a **libco to fiber port** for guest threads

None of it plays Mario Kart. All of it is real code, and it works up to the point where it needs the recompiled binary.

## How it works

```
ROM upload ─┐
            ├─►  Node translation service  ─►  WiiCompiled translator
            │                                   │
            │                                   ▼
            │                              generated C++
            │                                   │
            │                                   ▼
            │                            emcmake + aurora
            │                                   │
            │                                   ▼
            └──────────────►  browser  ◄───  mkwii_recomp.wasm
                                 │
                                 ▼
                            WebGPU canvas
```

The translation service runs in Docker. The ROM never leaves the user machine, and the service deletes both the ROM and the intermediate sources immediately after the WASM is produced.

### Component map

| Path | Purpose |
|------|---------|
| `src/` | Browser frontend |
| `src/disc/` | ISO / RVZ / WBFS readers, FST parser, SZS/Yaz0, DOL parser + patcher |
| `src/mods/` | Retro Rewind + Riivolution XML parser |
| `src/retrowfc/` | Retro WFC protocol client + launch-time hostname patcher |
| `src/ui/` | Settings, controllers, rooms, perf + profiler overlays |
| `wasm/` | Emscripten build |
| `wasm/main.cpp` | Runtime entry points |
| `wasm/project/` | CMake wrapper (wasm64, with Safari fallback) |
| `wasm/runtime/` | Platform shims, libco to fiber port, disc bridge, audio, input |
| `server/` | Translation service |
| `server/translate-server.mjs` | Orchestrates the four WiiCompiled commands |
| `server/disc-stage.mjs` | DOL + REL extraction with sha256 pinning |
| `server/audit-emitter.mjs` | Scans emitted C++ for non-portable constructs |
| `server/build-cache.mjs` | Content-addressed build cache |
| `projects/mkwii/recomp.yml` | Manifest mirror (PAL constants, entry points, hashes) |
| `docs/` | EMITTER-CHANGES, LIBCO-PORT, LIMITS, COMPLETION, BUILD |

### Memory model

The upstream runtime requires `CMAKE_SIZEOF_VOID_P == 8`, which forces a **wasm64** build. Guest addresses stay 32-bit; host pointers are 64-bit. `wasm/runtime/prelude.hpp` is the contract: big-endian guest accessors, PPC FPU helpers, and a `static_assert` on pointer width. For Safari, `WII_RECOMP_SAFARI_COMPAT=1` emits a wasm32-lowered binary capped at 4 GB — the same technique QEMU uses.

### libco to fiber port

WiiCompiled runtime uses libco for guest OSThread scheduling on non-Win32 platforms. libco backends are assembly context switches with no WebAssembly equivalent. `wasm/runtime/libco-emscripten.c` implements the four libco entry points on Emscripten `fiber.h`, which uses Asyncify to save and restore C stacks. A cooperative scheduler in `wasm/runtime/thread-emscripten.cpp` runs one guest-thread step per frame. Details in [docs/LIBCO-PORT.md](docs/LIBCO-PORT.md).

### The eight emitter edits

The WiiCompiled translator emits portable C++ for most of its output, but a handful of constructs do not survive wasm32: raw `reinterpret_cast` on guest addresses, `__rdtsc`, `dcbz`, and function pointers. The full list is in [docs/EMITTER-CHANGES.md](docs/EMITTER-CHANGES.md). Each is a one-line pattern swap, but they must be made in upstream WiiCompiled source, which is why they were never applied.

## What this repo is useful for

- **A reference for anyone attempting the same thing.** The docs folder has the emitter port plan, the libco port, and the honest blockers.
- **A record of where an AI coding assistant hits its ceiling.** The pattern is consistent: anything inside the repo it can edit, it can build. Anything that requires modifying upstream source it cannot see, it cannot.
- **A front-end skeleton** for anyone who does solve the recompilation problem later. The worker, disc readers, mod staging, and input layer are recompiler-agnostic.

## Why this exists

> This started as a **vibe-coding stress test** — how far could DeepSeek take a real, underspecified, multi-week engineering problem without a human stepping in? The answer is roughly 80%, and the last 20% is exactly the part that required editing upstream code the model could not see. That is the interesting finding.

## Requirements (if you want to poke at it)

- Node 20+
- Docker Desktop
- .NET 8 SDK (for the translator)
- A legally obtained Mario Kart Wii PAL disc (RMCP01)

## Quick start (frontend only)

```bash
npm install
npm run dev
```

Open http://localhost:5173. Upload a disc image. In **Local** mode you will see the stub renderer and real disc parsing.

## Quick start (full pipeline)

```bash
powershell -File vendor/setup.ps1
docker compose -f server/docker-compose.yml up --build
curl http://localhost:8787/api/health
npm run dev
```

Switch to **Server translation** in the UI, enter http://localhost:8787, and use path mode to point the service at your ISO. Full walkthrough in [docs/BUILD.md](docs/BUILD.md).

## Credit

- **[WiiCompiled](https://github.com/patchzyy/Wiicompiled)** by patchzyy — the actual recompiler and runtime. Without it this project is nothing.
- **[WheelWizard](https://github.com/TeamWheelWizard/WheelWizard)** by Team WheelWizard — Retro Rewind, RWFC, and the launcher this project mod layer imitates.
- **[aurora](https://github.com/encounter/aurora)** by encounter — the GX to WebGPU graphics layer.
- **[Retro Rewind](https://rwfc.net)** — the mod itself.

## License

No copyrighted game code or assets are distributed. You must supply your own legally obtained Mario Kart Wii disc image. The original WiiCompiled, aurora, and WheelWizard licenses apply to their respective code.

The glue code in this repository (front-end, worker, Emscripten platform layer, translation service) is released under the **MIT License**.