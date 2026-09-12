#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${EMSDK:-}" ]; then
  if [ -d "$HOME/emsdk" ]; then source "$HOME/emsdk/emsdk_env.sh"
  else echo "ERROR: emsdk not found" >&2; exit 1; fi
fi
WORKSPACE="${1:-$PWD/server/work/jobs/latest}"
BUILD_DIR="wasm/build"
OUT_DIR="public/wasm"
if [ ! -d "$WORKSPACE" ]; then
  echo "ERROR: workspace not found: $WORKSPACE" >&2
  echo "Run a translation via the service first, or pass a workspace path." >&2
  exit 1
fi
mkdir -p "$BUILD_DIR" "$OUT_DIR"
SAFARI_FLAG=""
if [ "${WII_RECOMP_SAFARI_COMPAT:-0}" = "1" ]; then
  SAFARI_FLAG="-DWII_RECOMP_SAFARI_COMPAT=ON"
fi
emcmake cmake -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DAURORA_SOURCE_DIR="$PWD/vendor/aurora" \
  -DWIICOMPILED_DIR="$PWD/vendor/wiicompiled" \
  -DWIICOMPILED_WORKSPACE="$WORKSPACE" \
  $SAFARI_FLAG \
  -S wasm/project -B "$BUILD_DIR"
cmake --build "$BUILD_DIR" --target mkwii_recomp -j"$(nproc 2>/dev/null || sysctl -n hw.ncpu)"
cp "$BUILD_DIR/mkwii_recomp.js"   "$OUT_DIR/" 2>/dev/null || true
cp "$BUILD_DIR/mkwii_recomp.wasm" "$OUT_DIR/" 2>/dev/null || true
echo "Built: $OUT_DIR/mkwii_recomp.{js,wasm}"