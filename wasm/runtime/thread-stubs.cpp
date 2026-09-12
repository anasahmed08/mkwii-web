#include <cstdint>
#include <cstdio>
extern "C" {
int pthread_create(void*, const void*, void* (*)(void*), void*) {
  std::fprintf(stderr, "[threads] pthread_create called - use os_thread_create\n");
  return -1;
}
int pthread_join(unsigned long, void**) { return -1; }
unsigned long pthread_self() { return 1; }
int pthread_detach(unsigned long) { return 0; }
int pthread_mutex_init(void*, const void*) { return 0; }
int pthread_mutex_destroy(void*) { return 0; }
int pthread_mutex_lock(void*) { return 0; }
int pthread_mutex_unlock(void*) { return 0; }
int pthread_cond_init(void*, const void*) { return 0; }
int pthread_cond_destroy(void*) { return 0; }
int pthread_cond_wait(void*, void*) { return 0; }
int pthread_cond_signal(void*) { return 0; }
int pthread_cond_broadcast(void*) { return 0; }
}