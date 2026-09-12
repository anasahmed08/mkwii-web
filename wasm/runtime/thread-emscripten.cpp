#include <cstdint>
#include <cstdio>
#include <cstring>
#include <vector>
#include <emscripten.h>
extern "C" {
  void* co_active();
  void* co_create(unsigned int heapsize, void (*coentry)(void));
  void  co_delete(void* handle);
  void  co_switch(void* handle);
  int   co_is_finished(void* handle);
  int   co_is_main(void* handle);
}
namespace {
struct GuestThread {
  void*    co;
  void   (*entry)(void*);
  void*    arg;
  uint32_t id;
  bool     started;
  bool     finished;
  char     name[32];
};
std::vector<GuestThread*> g_threads;
GuestThread* g_current = nullptr;
uint32_t g_nextId = 1;
void thread_trampoline_impl(GuestThread* t) {
  t->entry(t->arg);
  t->finished = true;
}
}
extern "C" {
void* os_thread_create(void (*entry)(void*), void* arg, unsigned stack_size,
                       const char* name) {
  GuestThread* t = new GuestThread();
  t->entry = entry;
  t->arg   = arg;
  t->id    = g_nextId++;
  t->started = false;
  t->finished = false;
  std::strncpy(t->name, name ? name : "guest", sizeof(t->name) - 1);
  static GuestThread* s_bind = nullptr;
  s_bind = t;
  t->co = co_create(stack_size ? stack_size : (1u << 20),
                    []() { thread_trampoline_impl(s_bind); });
  g_threads.push_back(t);
  return t;
}
void os_thread_start(void* handle) {
  GuestThread* t = (GuestThread*)handle;
  if (!t || t->started) return;
  t->started = true;
}
void os_thread_yield() {
  if (!g_current) {
    co_switch(g_threads.empty() ? co_active() : g_threads.front()->co);
    return;
  }
  co_switch(co_active());
}
void os_thread_join(void* handle) {
  GuestThread* t = (GuestThread*)handle;
  if (!t) return;
  while (!t->finished) {
    co_switch(t->co);
    if (co_is_finished(t->co)) t->finished = true;
  }
}
void os_thread_destroy(void* handle) {
  GuestThread* t = (GuestThread*)handle;
  if (!t) return;
  co_delete(t->co);
  for (auto it = g_threads.begin(); it != g_threads.end(); ++it) {
    if (*it == t) { g_threads.erase(it); break; }
  }
  delete t;
}
void os_thread_scheduler_tick() {
  for (GuestThread* t : g_threads) {
    if (!t->started || t->finished) continue;
    g_current = t;
    co_switch(t->co);
    if (co_is_finished(t->co)) t->finished = true;
    g_current = nullptr;
  }
}
int os_thread_count() { return (int)g_threads.size(); }
}