#include <emscripten.h>
#include <cstdio>
#include <cstring>
#include <sys/stat.h>
extern "C" void memfs_bootstrap() {
  mkdir("/logs", 0755);
  mkdir("/saves", 0755);
  mkdir("/mods", 0755);
  mkdir("/mods/retrorewind", 0755);
  FILE* f = std::fopen("/Config.toml", "wb");
  if (f) {
    const char* cfg =
      "[Core]\n"
      "CPUThread = false\n"
      "MMU = false\n"
      "DCBZ = true\n"
      "BAT = true\n"
      "\n"
      "[Display]\n"
      "Fullscreen = true\n"
      "RenderToMain = true\n"
      "\n"
      "[Audio]\n"
      "Backend = \"worklet\"\n"
      "SampleRate = 48000\n"
      "BufferMs = 40\n"
      "\n"
      "[Input]\n"
      "PadType0 = \"WiiRemoteNunchuk\"\n"
      "PadType1 = \"WiiRemoteNunchuk\"\n"
      "\n"
      "[RetroRewind]\n"
      "Enabled = false\n"
      "Root = \"/mods/retrorewind\"\n";
    std::fwrite(cfg, 1, std::strlen(cfg), f);
    std::fclose(f);
  }
  std::printf("[memfs] bootstrapped\n");
}