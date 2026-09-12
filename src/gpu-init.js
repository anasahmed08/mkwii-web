export async function checkWebGPU() {
  if (!('gpu' in navigator)) {
    return { ok: false, reason: 'WebGPU not available (iOS 17+ Safari, Chrome 113+, or Firefox Nightly)' };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return { ok: false, reason: 'No WebGPU adapter found' };
    const device = await adapter.requestDevice();
    const info = adapter.info || {};
    return { ok: true, vendor: info.vendor || 'unknown', architecture: info.architecture || 'unknown', device };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
export function configureCanvasForWasm(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.floor(rect.width  * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ro = new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect();
    canvas.width  = Math.floor(r.width  * dpr);
    canvas.height = Math.floor(r.height * dpr);
    canvas.dispatchEvent(new CustomEvent('canvas-resize'));
  });
  ro.observe(canvas);
  return ro;
}