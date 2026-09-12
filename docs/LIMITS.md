# Known limitations
## Hard blockers
1. **Translator emitter x86 constructs.** `docs/EMITTER-CHANGES.md`
   lists the eight edits required in `Translator.Emit`. Until they are
   applied to the upstream source, the WASM link fails on the first
   SSE intrinsic, inline asm, or hardcoded pointer cast. The audit tool
   reports precisely which files and lines offend.
2. **aurora's WebGPU backend parity under wasm64.** aurora ships an
   Emscripten path, but whether a given revision compiles cleanly under
   `-sMEMORY64=1` plus `--use-port=emdawnwebgpu` needs verification
   against that specific commit.
3. **Asyncify fiber overhead.** The libco port is correct in principle,
   but every guest-thread switch unwinds and rewinds an instrumented
   stack. MKW's threads are shallow, so this is expected to be fine; it
   needs profiling to confirm.
## Soft limitations
4. **iOS Safari has no memory64.** Native `-sMEMORY64=1` binaries will
   not load. Use `WII_RECOMP_SAFARI_COMPAT=1` to build the wasm32-lowered
   variant capped at 4 GB — the same approach QEMU uses. The 4 GB cap
   does not hurt MKW because the disc is streamed through a Blob, not
   loaded into WASM memory.
5. **RVZ LZMA/bzip2 decoders download from CDN.** First load of an
   RVZ using those codecs fetches LZMA-JS or seek-bzip from
   jsdelivr. Subsequent loads hit the browser cache. Convert to Zstd
   RVZ for the fastest path.
6. **Save-state granularity.** Saves mirror `/saves` to IndexedDB every
   15 seconds. Mid-race RAM snapshots are not implemented; only
   NAND-level saves survive a reload.
7. **Audio/video sync drift.** The AudioWorklet pull and the WASM frame
   loop are independently paced. Long sessions will drift. A proper
   resampler is not implemented.
8. **Wiimmfi/RWFC protocol handshake.** The WebSocket bridge and DOL
   hostname patch are correct. The full NAS/GPCM authentication
   handshake depends on RWFC's server implementation, which is not
   fully documented publicly. Offline and local play work fully.
9. **No Bluetooth Wii remote.** Browsers cannot access Bluetooth HID
   for arbitrary devices. Keyboard, gamepad, touch, and gyroscope work.
10. **Netplay is not implemented.** The rollback scaffolding exists in
    the codebase but has no WebRTC transport. Direct peer-to-peer play
    requires a signaling server.
## Not attempted
- Texture pack per-pack UI
- Input recording / replay
- Screenshot capture
- Video export
- Multi-instance netplay lobbies