#include <emscripten/fiber.h>
#include <emscripten.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdio.h>
#define ASYNCIFY_STACK_SIZE (64 * 1024)
typedef struct {
  emscripten_fiber_t  fiber;
  void*               c_stack;
  unsigned            c_stack_size;
  unsigned char*      asyncify_stack;
  void              (*entry)(void);
  int                 is_main;
  int                 finished;
} co_context;
static co_context* g_main_ctx = NULL;
static co_context* g_current  = NULL;
static void co_trampoline(void* arg) {
  co_context* ctx = (co_context*)arg;
  ctx->entry();
  ctx->finished = 1;
  for (;;) {
    emscripten_fiber_swap(&ctx->fiber, &g_main_ctx->fiber);
  }
}
cothread_t co_active(void) {
  if (!g_current) {
    if (!g_main_ctx) {
      g_main_ctx = (co_context*)calloc(1, sizeof(co_context));
      if (!g_main_ctx) return NULL;
      g_main_ctx->asyncify_stack = (unsigned char*)malloc(ASYNCIFY_STACK_SIZE);
      g_main_ctx->is_main = 1;
      emscripten_fiber_init_from_current_context(
        &g_main_ctx->fiber,
        g_main_ctx->asyncify_stack,
        ASYNCIFY_STACK_SIZE);
    }
    g_current = g_main_ctx;
  }
  return (cothread_t)g_current;
}
cothread_t co_create(unsigned int heapsize, void (*coentry)(void)) {
  co_context* ctx = (co_context*)calloc(1, sizeof(co_context));
  if (!ctx) return NULL;
  unsigned stack_size = heapsize < 131072 ? 131072 : heapsize;
  ctx->c_stack_size = stack_size;
  ctx->c_stack      = malloc(stack_size);
  ctx->asyncify_stack = (unsigned char*)malloc(ASYNCIFY_STACK_SIZE);
  ctx->entry = coentry;
  if (!ctx->c_stack || !ctx->asyncify_stack) {
    free(ctx->c_stack); free(ctx->asyncify_stack); free(ctx);
    return NULL;
  }
  emscripten_fiber_init(
    &ctx->fiber,
    co_trampoline,
    ctx,
    (void*)((uintptr_t)ctx->c_stack + stack_size),
    stack_size,
    ctx->asyncify_stack,
    ASYNCIFY_STACK_SIZE);
  return (cothread_t)ctx;
}
void co_delete(cothread_t handle) {
  if (!handle) return;
  co_context* ctx = (co_context*)handle;
  if (ctx->is_main) return;
  free(ctx->c_stack);
  free(ctx->asyncify_stack);
  free(ctx);
}
void co_switch(cothread_t handle) {
  if (!handle) return;
  co_context* to = (co_context*)handle;
  if (!g_current) co_active();
  co_context* from = g_current;
  if (from == to) return;
  g_current = to;
  emscripten_fiber_swap(&from->fiber, &to->fiber);
}
int co_is_finished(cothread_t handle) {
  if (!handle) return 1;
  return ((co_context*)handle)->finished;
}
int co_is_main(cothread_t handle) {
  if (!handle) return 0;
  return ((co_context*)handle)->is_main;
}
__attribute__((constructor))
static void co_verify_asyncify(void) {
  if (!emscripten_has_asyncify()) {
    fprintf(stderr, "[libco] FATAL: Emscripten fibers require -sASYNCIFY=1\n");
  }
}