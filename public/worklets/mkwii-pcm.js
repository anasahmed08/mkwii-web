class MkwiiPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ready = false;
    this.port.onmessage = (e) => { if (e.data.type === 'ready') this._ready = true; };
    this.port.postMessage({ type: 'hello' });
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0], R = out[1] || out[0];
    L.fill(0); R.fill(0);
    return true;
  }
}
registerProcessor('mkwii-pcm', MkwiiPcmProcessor);