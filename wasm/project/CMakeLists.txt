# Emscripten wrapper project for the WiiCompiled runtime.
#
# Upstream runtime/CMakeLists.txt requires CMAKE_SIZEOF_VOID_P == 8, so this
# project uses -sMEMORY64=1 (native wasm64) or -sMEMORY64=2 (wasm32-lowered,
# Safari-compatible) depending on WII_RECOMP_SAFARI_COMPAT.
cmake_minimum_required(VERSION 3.16)
project(mkwii_recomp_wasm C CXX)
if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "Configure with emcmake")
endif()
if(NOT DEFINED WIICOMPILED_WORKSPACE)
  message(FATAL_ERROR "WIICOMPILED_WORKSPACE is required")
endif()
if(NOT DEFINED AURORA_SOURCE_DIR)
  message(FATAL_ERROR "AURORA_SOURCE_DIR is required")
endif()
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(MKW_PLATFORM_LINUX TRUE)
# ---------------------------------------------------------------------------
# Memory model
# ---------------------------------------------------------------------------
option(WII_RECOMP_SAFARI_COMPAT "Emit wasm32-lowered binary for Safari" OFF)
if(WII_RECOMP_SAFARI_COMPAT)
  add_compile_options(-sMEMORY64=2)
  add_link_options(-sMEMORY64=2)
  add_link_options(-sMAXIMUM_MEMORY=4294967296)
else()
  add_compile_options(-sMEMORY64=1)
  add_link_options(-sMEMORY64=1)
  add_link_options(-sMAXIMUM_MEMORY=8589934592)
endif()
# ---------------------------------------------------------------------------
# Emscripten link flags
# ---------------------------------------------------------------------------
set(EM_LINK_FLAGS
  -sALLOW_MEMORY_GROWTH=1
  -sINITIAL_MEMORY=1073741824
  -sSTACK_SIZE=33554432
  -sFORCE_FILESYSTEM=1
  -sWASM_BIGINT=1
  -sENVIRONMENT=web,worker
  -sMODULARIZE=1
  -sEXPORT_NAME=createMkwiiModule
  -sASYNCIFY=1
  -sASYNCIFY_STACK_SIZE=8388608
  -sEXPORTED_RUNTIME_METHODS=FS,HEAPU8,HEAPU16,HEAPU32,HEAPU64,HEAPF32,HEAPF64,stringToUTF8,UTF8ToString,lengthBytesUTF8
  -sEXPORTED_FUNCTIONS=_main,_mkwii_start,_set_disc_path,_set_retro_rewind,_inject_input,_resize_canvas,_malloc,_free,_disc_read_raw,_disc_read_file,_disc_stat,_disc_is_overlaid,_mod_set_enabled,_mod_clear,_mod_resolve,_dol_apply_hooks,_dol_add_hook,_wii_audio_pull,_wii_audio_push,_wii_audio_set_volume,_motion_set,_network_set_bridge,_network_set_rwfc_dns,_network_set_wifi_enabled,_os_thread_scheduler_tick,_wii_platform_time_nanos,_memfs_bootstrap,_gx_webgpu_init,_gx_webgpu_submit,_gx_webgpu_present,_gx_webgpu_resize
  -sUSE_SDL=3
  -sUSE_ZLIB=1
  --use-port=emdawnwebgpu
)
# ---------------------------------------------------------------------------
# aurora
# ---------------------------------------------------------------------------
set(AURORA_ENABLE_GX ON CACHE BOOL "" FORCE)
set(AURORA_ENABLE_DVD OFF CACHE BOOL "" FORCE)
set(AURORA_ENABLE_CARD OFF CACHE BOOL "" FORCE)
set(AURORA_ENABLE_RMLUI OFF CACHE BOOL "" FORCE)
set(AURORA_CACHE_USE_ZSTD OFF CACHE BOOL "" FORCE)
set(AURORA_EMSCRIPTEN ON CACHE BOOL "" FORCE)
if(EXISTS ${AURORA_SOURCE_DIR}/CMakeLists.txt)
  add_subdirectory(${AURORA_SOURCE_DIR} ${CMAKE_BINARY_DIR}/aurora EXCLUDE_FROM_ALL)
endif()
# ---------------------------------------------------------------------------
# Upstream runtime
# ---------------------------------------------------------------------------
if(EXISTS ${WIICOMPILED_DIR}/runtime/CMakeLists.txt)
  set(MKW_BUILD_PRODUCTS OFF CACHE BOOL "" FORCE)
  add_subdirectory(${WIICOMPILED_DIR}/runtime ${CMAKE_BINARY_DIR}/runtime)
endif()
# ---------------------------------------------------------------------------
# Our platform layer
# ---------------------------------------------------------------------------
set(WII_PLATFORM_SHIM
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/platform-emscripten.cpp
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/audio-emscripten.cpp
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/input-emscripten.cpp
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/disc_bridge.cpp
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/memfs-bootstrap.cpp
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/dol-hook.cpp
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/motion-emscripten.cpp
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/network-retrowfc.cpp
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/gx-webgpu.cpp
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/thread-emscripten.cpp
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/thread-stubs.cpp
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/os-thread.cpp
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/libco-emscripten.c
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/profiler-emscripten.cpp
  ${CMAKE_CURRENT_LIST_DIR}/../main.cpp
)
add_executable(mkwii_recomp ${WII_PLATFORM_SHIM})
target_include_directories(mkwii_recomp PRIVATE
  ${CMAKE_CURRENT_LIST_DIR}/../runtime/libco-override
  ${CMAKE_BINARY_DIR}/generated
  ${WIICOMPILED_DIR}/runtime/include
  ${CMAKE_CURRENT_LIST_DIR}/../runtime
)
target_compile_definitions(mkwii_recomp PRIVATE
  AURORA_BACKEND_WEBGPU=1
  AURORA_EMSCRIPTEN=1
  WII_RECOMP_DISC_BACKEND=1
  WII_RECOMP_WASM64=1
  LIBCO_C=1
  WII_RECOMP_SINGLE_THREADED=1
)
if(EXISTS ${AURORA_SOURCE_DIR}/CMakeLists.txt)
  target_link_libraries(mkwii_recomp PRIVATE
    aurora::core aurora::gx aurora::vi aurora::gfx aurora::webgpu
  )
endif()
if(TARGET mkw_runtime_common)
  target_link_libraries(mkwii_recomp PRIVATE mkw_runtime_common)
endif()
target_link_options(mkwii_recomp PRIVATE ${EM_LINK_FLAGS})
set_target_properties(mkwii_recomp PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}
  OUTPUT_NAME mkwii_recomp
)