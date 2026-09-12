# mkwii-web
Run **Mario Kart Wii** in a browser tab.
> **Goal:** play MKWii on any device — desktop, Android, or **iPhone/iPad** — from
> nothing but a ROM and a browser. No Dolphin, no launchers, no downloads beyond
> the disc image you already own.
> **Status:** experimental, incomplete, and honest about it. See
> [`docs/COMPLETION.md`](docs/COMPLETION.md).
---
## What this is
A browser front-end wrapped around two existing PC projects:
- **[WiiCompiled](https://github.com/patchzyy/Wiicompiled)** — a static
  recompiler that translates Mario Kart Wii's PowerPC code into portable C++,
  which is then compiled natively. This is the engine.
- **[WheelWizard](https://github.com/TeamWheelWizard/WheelWizard)** — the mod
  launcher for Mario Kart Wii, whose Retro Rewind pack format and RWFC online
  server this project targets.
This repo adds the missing piece: an **Emscripten + WebGPU platform layer** that
lets the WiiCompiled runtime and its bundled [aurora](https://github.com/encounter/aurora)
graphics backend compile to WebAssembly and run in a browser.
## What works today
- Full web UI: disc loader, settings, controller config, profiler, in-browser log
- Disc readers for **ISO, RVZ, and WBFS** (FST parser, DOL parser, SZS/Yaz0)
- **Retro Rewind** mod staging (Riivolution XML + internal SZS injection)
- **Retro WFC** room browser and DOL hostname patcher
- Input: keyboard, gamepad, touch, and **gyroscope** (Wii Remote tilt on iPhone)
- Save state via IndexedDB, AudioWorklet output pipeline
- An animated stub renderer that proves the whole worker→WASM→canvas flow
## What does not work yet
- **Real recompilation.** The translator emits C++ that needs eight small edits
  before Emscripten can link it. Documented in
  [`docs/EMITTER-CHANGES.md`](docs/EMITTER-CHANGES.md).
- **iOS Safari.** Native `memory64` is not available there yet. The build
  supports a wasm32-lowered fallback (`WII_RECOMP_SAFARI_COMPAT=1`), but it has
  not been tested end-to-end.
- Online play through RWFC. The transport exists, the handshake does not.
Read [`docs/LIMITS.md`](docs/LIMITS.md) for the full list.
## How it works
ROM upload ─┐
├─► Node translation service ─► WiiCompiled translator
│ │
│ ▼
│ generated C++
│ │
│ ▼
│ emcmake + aurora
│ │
│ ▼
└──────────────► browser ◄─── mkwii_recomp.wasm
│
▼
WebGPU canvas
text
The translation service runs in Docker on the user's own machine. The ROM never
leaves that machine, and the service deletes both the ROM and the intermediate
sources immediately after the WASM is produced.
## Requirements
- Node 20+
- Docker Desktop
- .NET 8 SDK (for the translator)
- A legally obtained Mario Kart Wii PAL disc (`RMCP01`)
## Quick start
```bash
npm install
npm run dev
Open http://localhost:5173. Upload a disc image. In Local mode you will see
the stub renderer and real disc parsing.
For real recompilation:
bash
powershell -File vendor/setup.ps1               # clone + build the translator
docker compose -f server/docker-compose.yml up --build
curl http://localhost:8787/api/health           # all checks should be true
npm run dev
In the browser, switch to Server translation, enter http://localhost:8787,
and use the path mode (the service reads the ISO directly off disk — no upload).
Full walkthrough: docs/BUILD.md.
Why this exists
This is a vibe-coded project — written end-to-end with DeepSeek as an
experiment in what an AI coding assistant can produce when given a real,
underspecified, multi-week engineering problem. It is not a product. It is a
stress test of the model's ability to hold architecture, cross-language glue,
and long-context state together across dozens of turns, and an honest record
of where that breaks down.
The final stretch — the eight edits in the C++ emitter, the aurora WebGPU
backend, and the Safari memory64 situation — are the parts where the AI hit its
ceiling and a human has to step in. Those are documented, not hidden.
Credit
WiiCompiled by patchzyy — the
actual recompiler and runtime. Without it this project is nothing.
WheelWizard by Team
WheelWizard — Retro Rewind, RWFC, and the launcher this project's mod layer
imitates.
aurora by encounter — the GX →
WebGPU graphics layer.
Retro Rewind — the mod itself.
License
No copyrighted game code or assets are distributed. You must supply your own
legally obtained Mario Kart Wii disc image. The original WiiCompiled, aurora,
and WheelWizard licenses apply to their respective code.
The glue code in this repository (front-end, worker, Emscripten platform layer,
translation service) is released under the MIT License.