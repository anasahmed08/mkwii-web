export default async function createMkwiiModule(opts = {}) {
  const print = opts.print || console.log;
  print('[stub] loaded');
  let running = false, t = 0, w = 960, h = 540;
  let fps = 0, frames = 0, lastFps = Date.now();
  function frame() {
    if (!running) return;
    t += 0.016;
    frames++;
    const now = Date.now();
    if (now - lastFps > 500) {
      fps = frames * 1000 / (now - lastFps);
      frames = 0;
      lastFps = now;
    }
    self.postMessage({ type: 'stub-frame', canvas: { t, fps, w, h } });
    setTimeout(frame, 16);
  }
  return {
    _mkwii_start: () => { print('[stub] start'); running = true; frame(); },
    _inject_input: () => {},
    _set_retro_rewind: () => {},
    _malloc: (n) => n,
    _free: () => {},
  };
}