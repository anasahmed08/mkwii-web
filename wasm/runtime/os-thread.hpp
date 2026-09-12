#pragma once
#include <cstdint>
class OSThread {
public:
  using Entry = void(*)(void*);
  OSThread(Entry entry, void* arg, unsigned stack_size = 0,
           const char* name = "guest");
  ~OSThread();
  void start();
  void join();
  void yield();
  bool finished() const;
  static void schedulerTick();
  static int  count();
private:
  void* handle_ = nullptr;
};