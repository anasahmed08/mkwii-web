# Redirect to the real project file.
cmake_minimum_required(VERSION 3.20)
message(STATUS "Configure with -S wasm/project instead of -S wasm")
include(${CMAKE_CURRENT_LIST_DIR}/project/CMakeLists.txt)