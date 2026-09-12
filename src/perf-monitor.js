export class PerfMonitor {
  constructor() {
    this.samples = [];
    this.maxSamples = 120;
    this.lastTime = performance.now();
    this.fps = 0;
    this.frameMs = 0;
    this._raf = null;
  }
  start(onUpdate) {
    const tick = () => {
      const now = performance.now();
      const dt = now - this.lastTime;
      this.lastTime = now;
      this.samples.push(dt);
      if (this.samples.length > this.maxSamples) this.samples.shift();
      const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
      this.frameMs = avg;
      this.fps = 1000 / avg;
      if (onUpdate) onUpdate({ fps: this.fps, frameMs: this.frameMs });
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }
  stop() { if (this._raf) cancelAnimationFrame(this._raf); }
}