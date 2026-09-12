# Mario Kart Wii — Browser Recompilation
Runs a static recompilation of Mario Kart Wii (PAL RMCP01) in a browser, with
Retro Rewind mod support and Retro WFC online play.
## Status
- **Frontend runs today.** Disc parsing, FST reading, mod staging, and the
  stub renderer all work immediately after `npm install && npm run dev`.
- **True recompilation** needs the translation service, which requires
  .NET 8, Emscripten, and the vendor source trees.
- **Two upstream edits are required** before the recompiled WASM links
  cleanly. See `docs/EMITTER-CHANGES.md`.
See `docs/COMPLETION.md` for the honest completion percentage and
`docs/LIMITS.md` for what does not work.
## Quick start — frontend only (no build needed)
    npm install
    npm run dev
Open http://localhost:5173. Upload a `.iso` / `.rvz` / `.wbfs`. You will see
the animated stub renderer, real FST parsing, and mod staging. No
recompilation happens — this demonstrates the pipeline.
## Quick start — full recompilation
    # 1. Vendor + build the translator (.NET 8 required)
    bash vendor/setup.sh
    # 2. Start the translation service (Docker has .NET 8 + Emscripten)
    docker compose -f server/docker-compose.yml up --build
    # 3. Verify toolchain
    curl http://localhost:8787/api/health
    # 4. Frontend
    npm run dev
In the browser: **Mode → Server translation**, server URL
`http://localhost:8787`, upload your clean PAL `RMCP01` disc, optionally load
the Retro Rewind folder, hit **Launch**.
The first translation takes 20–40 minutes on a 16-core box. Later uploads of
the same disc hit the cache instantly.
## Requirements
- Node 20+
- .NET 8 SDK (for the translator)
- Emscripten 4.0.10+ (Docker image provides it)
- A legally obtained PAL Mario Kart Wii disc
  - Game ID: `RMCP01`
  - main.dol sha256: `80d18895b39c63bd80f457398bfcbb91b7d16ac116a41a88967e954080155b05`
  - StaticR.rel sha256: `16d9d146112541fefea701ecb5bc1a496f9d50e4a752fbb5b6778e7c6399f67d`
## iOS / Safari
Native `memory64` is not available in Safari. Build with
`WII_RECOMP_SAFARI_COMPAT=1 bash wasm/build.sh` to emit a wasm32-lowered
binary capped at 4 GB — the same technique QEMU uses. The 4 GB cap is fine
for MKW because the disc is streamed, not loaded into WASM memory.
## Directory map
    src/                    frontend
      main.js               orchestration
      worker.js             WASM host + disc backend
      disc/                 ISO / RVZ / WBFS / FST / SZS / DOL readers
      mods/                 Retro Rewind + Riivolution parser
      retrowfc/             Retro WFC protocol client + launch patcher
      ui/                   settings, controllers, rooms, overlays
    wasm/                   Emscripten build
      main.cpp              entry points
      project/              CMake wrapper (wasm64)
      runtime/              platform shims, libco port, disc bridge
    server/                 translation service
      translate-server.mjs  orchestration
      disc-stage.mjs        DOL + REL extraction with hash pinning
      audit-emitter.mjs     C++ portability audit
      build-cache.mjs       content-addressed cache
      Dockerfile
    projects/mkwii/         manifest mirror
    docs/                   EMITTER-CHANGES, LIBCO-PORT, LIMITS, COMPLETION, BUILD
    vendor/                 cloned by setup.sh
## Blockers
1. Eight `Translator.Emit` edits (`docs/EMITTER-CHANGES.md`) — upstream work.
2. aurora's WebGPU backend under wasm64 — upstream parity.
3. Asyncify fiber performance on real hardware — unmeasured.
## License
No copyrighted game code or assets are distributed. You must supply your own
legally obtained disc image.