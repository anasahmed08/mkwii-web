# Build walkthrough
## Prerequisites
| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Frontend + server |
| .NET SDK | 8 | Translator (WiiCompiled) |
| Emscripten | 4.0.10+ | WASM compilation |
| Docker | Latest | Recommended for the service |
| CMake + Ninja | 3.20+ / 1.10+ | WASM build |
The Docker image bundles .NET 8 and Emscripten so only Docker is required
for the full pipeline.
## Stage 1 — Frontend only
    npm install
    npm run dev
Verify http://localhost:5173 shows the panel. Upload any disc image and
check the log for FST parsing.
## Stage 2 — Vendor the translator
    bash vendor/setup.sh
This clones `wiicompiled` and `aurora` into `vendor/` and runs
`dotnet build` on the translator CLI. The DLL it produces is what
`server/translate-server.mjs` invokes.
If .NET is missing: install from https://dotnet.microsoft.com/download.
## Stage 3 — Start the translation service
    docker compose -f server/docker-compose.yml up --build
Verify:
    curl http://localhost:8787/api/health
Every field in the JSON response must be `true`. If `translatorDll` is
false, the translator build in stage 2 failed. If `manifest` is false,
the `wiicompiled` clone is incomplete.
## Stage 4 — Translate
Open http://localhost:5173, switch to **Server translation**, enter
`http://localhost:8787`, upload your ISO.
Watch the log stream in the browser. The stages are:
1. `staging` — extract main.dol and StaticR.rel, verify sha256
2. `manifest` — copy recomp.yml and MAP.txt into the workspace
3. `translate-recursive` — translator runs on DOL + REL
4. `translate-mod` — Retro Rewind profile statically linked
5. `generate-data-init` — runtime data initializers
6. `emit-build-shards` — split generated C++ into translation units
7. `auditing` — scan for non-portable constructs
8. `configuring` + `compiling` — emcmake + ninja build
9. `packaging` — copy .js and .wasm into public/wasm/
Stage 7 is the gate. If the audit reports fatal findings, the build stops
and lists exactly which files and lines offend. See `EMITTER-CHANGES.md`
for the fixes.
## Stage 5 — Direct WASM build (advanced)
Once a translation has produced a workspace with generated sources:
    source ~/emsdk/emsdk_env.sh
    bash wasm/build.sh server/work/jobs/<id>
For Safari (wasm32-lowered):
    WII_RECOMP_SAFARI_COMPAT=1 bash wasm/build.sh server/work/jobs/<id>
## Directory conventions
The translation service expects this layout inside the job workspace:
    <job>/
      Assets/
        main.dol
        StaticR.rel
      projects/mkwii/
        recomp.yml
        MAP.txt
      generated/           (translator output)
      build-wasm/          (emcmake output)
`disc-stage.mjs` produces the first two. The translator produces the rest.
## Common failures
- **`main.dol sha256 mismatch`** — your disc is not the clean PAL RMCP01
  revision the manifest pins. Verify with a known-good rip.
- **`StaticR.rel not found`** — the FST lookup tried
  `/rel/StaticR.rel`, `/files/rel/StaticR.rel`, `/StaticR.rel`. If none
  matched, the disc layout differs from expectations.
- **`Translator not built`** — `npm run setup` failed. Check .NET 8 is on
  PATH: `dotnet --version` should print `8.x`.
- **`emcmake not found`** — Emscripten is not sourced. Run
  `source ~/emsdk/emsdk_env.sh` or use the Docker image.
- **`--use-port=emdawnwebgpu` unknown** — your Emscripten is older than
  4.0.10. Update the SDK.
- **Audit reports FATAL** — the C++ emitter produces constructs wasm32
  cannot compile. Apply the fixes in `EMITTER-CHANGES.md`.
## Verifying the build
After a successful translation the job's output directory contains:
    public/wasm/<job-id>/
      mkwii_recomp.js       Emscripten glue
      mkwii_recomp.wasm     the compiled binary
Load the frontend, switch to Server translation, upload the same disc
again — the cache should hit and the WASM should load immediately. The
renderer switches from the stub to aurora's WebGPU output.