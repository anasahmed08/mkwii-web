#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p vendor
cd vendor

if ! command -v dotnet >/dev/null 2>&1; then
  echo ERROR: dotnet SDK not found >&2
  exit 1
fi

echo dotnet version: $(dotnet --version)

[ -d wiicompiled ] || git clone --depth 1 https://github.com/patchzyy/Wiicompiled.git wiicompiled
[ -d aurora ]      || git clone --depth 1 https://github.com/encounter/aurora.git aurora

echo '==> Building translator...'
cd wiicompiled
dotnet build translator/src/Translator.Cli/Translator.Cli.csproj -c Release || true
cd ..

DLL=wiicompiled/translator/src/Translator.Cli/bin/Release/net8.0/Translator.Cli.dll
if [ -f "$DLL" ]; then
  echo "==> Translator built: $DLL"
else
  echo '==> Looking for DLL anywhere...'
  find wiicompiled -name Translator.Cli.dll 2>/dev/null || true
fi
