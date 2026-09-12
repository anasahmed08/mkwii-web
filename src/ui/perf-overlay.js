export function mountPerfOverlay() {
  const el = document.createElement('div');
  el.id = 'perf-overlay';
  el.className = 'perf-overlay hidden';
  el.innerHTML = `
    <style>
      .perf-overlay { position: absolute; top: 4rem; right: 1rem;
        background: rgba(0,0,0,0.7); color: #2ed573;
        font-family: ui-monospace, monospace; font-size: 0.75rem;
        padding: 0.5rem 0.75rem; border-radius: 6px;
        line-height: 1.4; z-index: 20; }
      .perf-overlay.hidden { display: none; }
      .perf-overlay .warn { color: #ffa502; }
      .perf-overlay .bad { color: #ff4757; }
    </style>
    <div id="perf-fps">-- fps</div>
    <div id="perf-frame">-- ms</div>
  `;
  document.getElementById('app').appendChild(el);
  return {
    toggle() { el.classList.toggle('hidden'); },
    update({ fps, frameMs }) {
      const fpsEl = el.querySelector('#perf-fps');
      fpsEl.textContent = fps.toFixed(0) + ' fps';
      fpsEl.className = fps < 30 ? 'bad' : fps < 50 ? 'warn' : '';
      el.querySelector('#perf-frame').textContent = frameMs.toFixed(2) + ' ms';
    },
  };
}