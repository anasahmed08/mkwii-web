export async function initAudio(module) {
  if (window.__mkwii_audio_ready) return window.__mkwii_audio_ctx;
  const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
  await ctx.audioWorklet.addModule('/worklets/mkwii-pcm.js');
  const scratchL = module._malloc(128 * 4);
  const scratchR = module._malloc(128 * 4);
  const node = new AudioWorkletNode(ctx, 'mkwii-pcm');
  node.port.postMessage({ type: 'ready' });
  self.__mkwii_pull_scratchL = scratchL;
  self.__mkwii_pull_scratchR = scratchR;
  self.__mkwii_pull = (l, r, n) => module._wii_audio_pull(l, r, n);
  self.Module = module;
  node.connect(ctx.destination);
  window.__mkwii_audio_ready = true;
  window.__mkwii_audio_ctx = ctx;
  window.__mkwii_audio_node = node;
  return ctx;
}
export async function resumeAudio() {
  const ctx = window.__mkwii_audio_ctx;
  if (ctx && ctx.state === 'suspended') await ctx.resume();
}