export class Profiler {
  constructor() {
    this.marks = new Map();
    this.samples = new Map();
    this.maxSamples = 300;
    this.enabled = false;
  }
  enable() { this.enabled = true; }
  disable() { this.enabled = false; }
  mark(name) {
    if (!this.enabled) return;
    this.marks.set(name, performance.now());
  }
  measure(name, startMark) {
    if (!this.enabled) return 0;
    const start = this.marks.get(startMark);
    if (start === undefined) return 0;
    const dt = performance.now() - start;
    let arr = this.samples.get(name);
    if (!arr) { arr = []; this.samples.set(name, arr); }
    arr.push(dt);
    if (arr.length > this.maxSamples) arr.shift();
    this.marks.delete(startMark);
    return dt;
  }
  stats(name) {
    const arr = this.samples.get(name);
    if (!arr || !arr.length) return { avg: 0, min: 0, max: 0, p95: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      avg,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }
  all() {
    const out = {};
    for (const name of this.samples.keys()) out[name] = this.stats(name);
    return out;
  }
  reset() { this.samples.clear(); this.marks.clear(); }
}