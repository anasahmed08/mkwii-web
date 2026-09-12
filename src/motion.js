export class MotionController {
  constructor(worker) {
    this.worker = worker;
    this.enabled = false;
    this.calibrated = false;
    this.neutral = { beta: 0, gamma: 0 };
    this.sensitivity = 1.0;
    this._handler = null;
  }
  async requestPermission() {
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const state = await DeviceOrientationEvent.requestPermission();
      return state === 'granted';
    }
    return true;
  }
  async start() {
    const ok = await this.requestPermission();
    if (!ok) return false;
    this._handler = (e) => {
      if (!this.enabled) return;
      if (!this.calibrated) {
        this.neutral = { beta: e.beta || 0, gamma: e.gamma || 0 };
        this.calibrated = true;
        return;
      }
      const dGamma = ((e.gamma || 0) - this.neutral.gamma) * this.sensitivity;
      const dBeta = ((e.beta || 0) - this.neutral.beta) * this.sensitivity;
      const steer = Math.max(-1, Math.min(1, dGamma / 45));
      const accel = Math.max(-1, Math.min(1, -dBeta / 30));
      this.worker.postMessage({ type: 'motion', steer, accel });
    };
    window.addEventListener('deviceorientation', this._handler, true);
    this.enabled = true;
    return true;
  }
  calibrate() { this.calibrated = false; }
  stop() {
    if (this._handler) {
      window.removeEventListener('deviceorientation', this._handler, true);
      this._handler = null;
    }
    this.enabled = false;
  }
}