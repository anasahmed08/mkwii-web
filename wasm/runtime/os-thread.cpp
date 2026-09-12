#include "os-thread.hpp"
extern "C" {
  void* os_thread_create(void (*)(void*), void*, unsigned, const char*);
  void  os_thread_start(void*);
  void  os_thread_join(void*);
  void  os_thread_yield();
  void  os_thread_destroy(void*);
  void  os_thread_scheduler_tick();
  int   os_thread_count();
  int   co_is_finished(void*);
}
OSThread::OSThread(Entry entry, void* arg, unsigned stack_size, const char* name) {
  handle_ = os_thread_create(entry, arg, stack_size, name);
}
OSThread::~OSThread() { if (handle_) os_thread_destroy(handle_); }
void OSThread::start()  { os_thread_start(handle_); }
void OSThread::join()   { os_thread_join(handle_); }
void OSThread::yield()  { os_thread_yield(); }
bool OSThread::finished() const {
  return handle_ ? co_is_finished(handle_) : true;
}
void OSThread::schedulerTick() { os_thread_scheduler_tick(); }
int  OSThread::count() { return os_thread_count(); }