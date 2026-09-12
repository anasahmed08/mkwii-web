# Translator port notes
The translator is architecture-agnostic by design: it parses DOL/REL files,
decodes PowerPC instructions, lifts through IR/SSA with type inference, and
emits portable C++. There are no x86 assembly backends in the output.
That is why the Emscripten path is viable. The remaining work is the eight
pattern swaps documented in EMITTER-CHANGES.md. Once those are applied, the
generated C++ compiles under wasm32/wasm64 without further changes.
## Commands
    translate-recursive --project recomp.yml     # DOL + REL
    translate-mod       --project recomp.yml --profile retro-rewind
    generate-data-init  --project recomp.yml
    emit-build-shards   --project recomp.yml
The manifest at `projects/mkwii/recomp.yml` supplies the memory layout the
translator needs. SDA bases are never guessed: they are read from the
manifest, which supplies values verified against the actual PAL binary.
## Memory layout
From the real manifest:
    base:      0x80000000
    size:      0x01A00000
    sda_base:  0x8038CC00
    sda2_base: 0x8038EFA0
    entry:     0x800060A4
    REL load:  0x805102E0
`vendor/dol-probe.mjs` extracts the same values by pattern-matching the
DOL's boot code (lis/ori pairs). Both should agree; the probe is useful
when validating a new disc dump.