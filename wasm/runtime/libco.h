#ifndef LIBCO_H
#define LIBCO_H
#ifdef __cplusplus
extern "C" {
#endif
typedef void* cothread_t;
cothread_t co_active(void);
cothread_t co_create(unsigned int heapsize, void (*coentry)(void));
void       co_delete(cothread_t handle);
void       co_switch(cothread_t handle);
int        co_is_finished(cothread_t handle);
int        co_is_main(cothread_t handle);
#ifdef __cplusplus
}
#endif
#endif