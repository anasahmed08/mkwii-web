#!/usr/bin/env bash
# Builds the complete project zip.
set -euo pipefail
NAME="mkwii-browser-recomp"
STAGE="/tmp/$NAME-stage"
OUT="$PWD/$NAME.zip"
rm -rf "$STAGE"
mkdir -p "$STAGE/$NAME"
cd "$(dirname "$0")"
for f in package.json vite.config.js index.html README.md RUN.md .gitignore package.sh PROJECT_TREE.txt; do
  [ -f "$f" ] && cp "$f" "$STAGE/$NAME/"
done
for d in src wasm server docs public projects; do
  [ -d "$d" ] && cp -R "$d" "$STAGE/$NAME/"
done
rm -f "$STAGE/$NAME/public/wasm/"*.js "$STAGE/$NAME/public/wasm/"*.wasm 2>/dev/null || true
touch "$STAGE/$NAME/public/wasm/.gitkeep"
mkdir -p "$STAGE/$NAME/vendor"
[ -f vendor/setup.sh ]      && cp vendor/setup.sh      "$STAGE/$NAME/vendor/"
[ -f vendor/dol-probe.mjs ] && cp vendor/dol-probe.mjs "$STAGE/$NAME/vendor/"
cp package.sh "$STAGE/$NAME/"
rm -rf "$STAGE/$NAME/server/work" "$STAGE/$NAME/server/node_modules" \
       "$STAGE/$NAME/wasm/build"  "$STAGE/$NAME/node_modules" 2>/dev/null || true
cd "$STAGE"
if command -v zip >/dev/null 2>&1; then
  zip -rq "$OUT" "$NAME"
else
  echo "ERROR: 'zip' not found. Install it or use: tar czf $NAME.tar.gz $NAME"
  exit 1
fi
SIZE=$(du -h "$OUT" | cut -f1)
echo
echo "Created: $OUT ($SIZE)"