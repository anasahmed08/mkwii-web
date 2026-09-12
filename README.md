# mkwii-web

**Archived experiment.** Run Mario Kart Wii in a browser tab — abandoned, but the work is here.

> **Original goal:** play MKWii on any device — desktop, Android, or iPhone — from
> nothing but a ROM and a browser.
>
> **Outcome:** not viable in 2026. The blockers are documented below. This repo
> is preserved as an artifact, not a product.

---

## Why I stopped

Three hard blockers, all outside my control:

1. **The recompiler's C++ emitter emits x86-specific constructs.** Emscripten can't
   link them without edits to upstream WiiCompiled source I don't own. Documented
   in [`docs/EMITTER-CHANGES.md`](docs/EMITTER-CHANGES.md).
2. **aurora's WebGPU backend isn't at parity under wasm64.** The GX→WebGPU layer
   that would render the game exists but isn't ready.
3. **Apple hasn't shipped `memory64` in Safari.** No timeline. iOS is the entire
   point of a browser port, and without it the target platform is unreachable.

Even if those were solved, a **hosted** version faces legal exposure from
processing ISOs on my infrastructure, plus bandwidth and CPU costs that make the
economics ugly. A local-first version — user runs `docker compose up` on their
own PC — sidesteps the legal issue but is exactly what Dolphin and WiiCompiled
already do, on platforms that don't have these blockers.

## What actually exists here

This started as a **vibe-coding stress test** — how far could DeepSeek take a
real, underspecified, multi-week engineering problem without a human stepping in?
The answer is roughly 80%, and the last 20% is exactly the part that required
editing upstream code the model couldn't see. That's the interesting finding.

What was built:

- Full web UI: disc loader, settings, controller config, profiler, in-browser log
- Disc readers for **ISO, RVZ, and WBFS** (FST parser, DOL parser, SZS/Yaz0)
- **Retro Rewind** mod staging (Riivolution XML + internal SZS injection)
- **Retro WFC** room browser and DOL hostname patcher
- Input: keyboard, gamepad, touch, and gyroscope
- Save state via IndexedDB, AudioWorklet output pipeline
- An animated stub renderer that proves the full worker→WASM→canvas flow
- A Docker-based translation service that orchestrates WiiCompiled end-to-end
- An Emscripten platform layer with a libco→fiber port for guest threads

None of it plays Mario Kart. All of it is real code, and it works up to the
point where it needs the recompiled binary.

## What this repo is useful for

- **A reference for anyone attempting the same thing.** The `docs/` folder has
  the emitter port plan, the libco port, and the honest blockers.
- **A record of where an AI coding assistant hits its ceiling.** The pattern is
  consistent: anything inside the repo it can edit, it can build. Anything that
  requires modifying upstream source it can't see, it can't.
- **A front-end skeleton** for anyone who does solve the recompilation problem
  later. The worker, disc readers, mod staging, and input layer are
  recompiler-agnostic.

## Credit

- **[WiiCompiled](https://github.com/patchzyy/Wiicompiled)** by patchzyy — the
  actual recompiler. Without it this project doesn't exist.
- **[WheelWizard](https://github.com/TeamWheelWizard/WheelWizard)** by Team
  WheelWizard — Retro Rewind and RWFC.
- **[aurora](https://github.com/encounter/aurora)** by encounter — the GX →
  WebGPU graphics layer.
- **[Retro Rewind](https://rwfc.net)** — the mod itself.

## License

No copyrighted game code or assets are distributed. The original WiiCompiled,
aurora, and WheelWizard licenses apply to their respective code.

The glue code in this repository (front-end, worker, Emscripten platform layer,
translation service) is released under the **MIT License**.
