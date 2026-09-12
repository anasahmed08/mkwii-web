# How to run
## Frontend only (works immediately)
    npm install
    npm run dev
Open http://localhost:5173. In **Mode: Local**, upload any `.iso` / `.rvz` /
`.wbfs`. You will see the animated stub renderer plus real disc parsing,
FST reading, and mod staging.
## Full recompilation
Prerequisites: .NET 8 SDK, Docker Desktop, and a clean PAL RMCP01 disc.
    # 1. Clone and build the real translator
    bash vendor/setup.sh
    # 2. Start the translation service + RWFC bridge
    docker compose -f server/docker-compose.yml up --build
    # 3. Verify the toolchain
    curl http://localhost:8787/api/health
    # 4. Frontend
    npm run dev
In the browser:
1. **Mode → Server translation**
2. Server URL: `http://localhost:8787`
3. Upload your clean PAL RMCP01 ISO
4. (Optional) Load the Retro Rewind folder
5. (Optional) Enable Retro WFC
6. **Launch**
The first translation takes 20–40 minutes. Later runs of the same disc hit
the build cache instantly.
## Direct WASM build (advanced)
Once a translation has produced a workspace:
    source ~/emsdk/emsdk_env.sh
    bash wasm/build.sh server/work/jobs/<id>
For Safari compatibility (wasm32-lowered, 4 GB cap):
    WII_RECOMP_SAFARI_COMPAT=1 bash wasm/build.sh server/work/jobs/<id>
## Packaging
    bash package.sh
Produces `mkwii-browser-recomp.zip` in the project root.
## Known blockers
See `docs/COMPLETION.md`. In short: the translator's emitted C++ needs the
eight edits in `docs/EMITTER-CHANGES.md` applied upstream before Emscripten
can link it. The audit step fails loudly with the offending constructs if
you attempt a build before making them.