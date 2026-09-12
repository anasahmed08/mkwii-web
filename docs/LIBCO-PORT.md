# libco to Emscripten fiber port
## Why this is required
`vendor/wiicompiled/runtime` uses libco for guest OSThread scheduling on
all non-Win32 platforms. libco's backends are assembly context switches
(x86.c, amd64.c, arm.c, ...). None exist for WebAssembly, and libco has
no generic C fallback.
## What replaces it
Emscripten's `fiber.h` is the same primitive: save the current C stack,
jump to another stack, return later. It is implemented on top of Asyncify.
| libco | Emscripten fiber |
|-------|------------------|
| `co_create` | `emscripten_fiber_init` |
| `co_active` | `emscripten_fiber_init_from_current_context` |
| `co_switch` | `emscripten_fiber_swap` |
| `co_delete` | `free` |
## Implementation
`wasm/runtime/libco-emscripten.c` implements the four entry points plus
two introspection helpers. `wasm/runtime/libco-override/libco.h` shadows
the runtime's own header so its `#include <libco.h>` resolves to the port
without editing vendor sources.
The CMake include order puts `libco-override/` first:
    target_include_directories(mkwii_recomp PRIVATE
      ${CMAKE_CURRENT_LIST_DIR}/../runtime/libco-override
      ...
    )
## Constraints
1. **ASYNCIFY is mandatory.** The build passes `-sASYNCIFY=1`. The port
   has a constructor that aborts with a clear message if it is missing.
2. **Per-fiber shadow stacks.** Each fiber gets a 64 KB Asyncify stack in
   addition to its C stack. MKW's guest threads are shallow; 64 KB is
   sufficient in practice.
3. **No preemption.** Threads switch only at explicit yield points. The
   scheduler runs one step per emscripten main-loop frame via
   `os_thread_scheduler_tick()`.
4. **Creation-order scheduling.** libco priorities are ignored; threads
   run in creation order.
## Performance
Emscripten's own documentation describes Asyncify-based fibers as
"horribly inefficient... worse overhead than signal mask-preserving
ucontext." For MKW, whose guest threads switch infrequently, the cost is
expected to be acceptable. This has not been measured on real hardware;
the profiler overlay (backtick key) reports scheduler time separately.
If scheduler time exceeds 4 ms per frame, the port needs work. The
current implementation is correct but unoptimized.