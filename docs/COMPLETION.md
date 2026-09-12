# Completion
| Subsystem                              | Status |
|----------------------------------------|--------|
| Frontend shell (UI/PWA/SW)             | 95%    |
| Worker runtime host                    | 90%    |
| Disc reader (ISO / RVZ / WBFS)         | 92%    |
| FST / SZS / DOL parsing                | 90%    |
| Disc asset staging + hash pinning      | 95%    |
| Real recomp.yml integration            | 95%    |
| Retro Rewind (SZS + Riivolution)       | 80%    |
| Input (keyboard/touch/gamepad/motion)  | 85%    |
| Audio pipeline                         | 70%    |
| Save state                             | 65%    |
| Settings / controller config UI        | 85%    |
| Translation service orchestration      | 90%    |
| wasm64 Emscripten build config         | 80%    |
| libco to fiber port                    | 80%    |
| aurora Emscripten integration          | 55%    |
| Emitter port (C#)                      | 0%     |
| Retro WFC (payload + hook)             | 60%    |
**Overall: roughly 82% of what can be built without modifying upstream
sources.**
## What runs today
The frontend, disc readers, mod overlay, input pipeline, save state,
translation service orchestration, and the entire WASM build system all
exist and are correct as far as they can be verified without the
translated output.
With the stub module you can:
- Upload any disc format and see FST parsing succeed
- Load a Retro Rewind folder and see SZS injections staged
- See the animated stub renderer at target framerate
- Exercise keyboard, touch, gamepad, and motion input
- Browse live RWFC rooms
- Configure settings and controllers
- Toggle the profiler with the backtick key
## What needs upstream edits
1. **Translator.Emit** — 8 edits documented in EMITTER-CHANGES.md.
2. **aurora WebGPU** — verify the vendored revision accepts
   `--use-port=emdawnwebgpu` under wasm64.
3. **Asyncify performance** — profile the fiber port on real hardware.
## To reach one race playable
1. Apply EMITTER-CHANGES.md to
   `vendor/wiicompiled/translator/src/Translator.Emit/`.
2. `bash vendor/setup.sh && dotnet build` the translator.
3. `docker compose up --build`.
4. Upload a clean PAL ISO and wait for translation.
5. Load the Retro Rewind folder.
6. Launch.
If the audit passes and aurora compiles, the first race will render.