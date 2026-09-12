export function mountProfilerOverlay(profiler) {
  const el = document.createElement('div');
  el.id = 'profiler-overlay';
  el.className = 'profiler-overlay hidden';
  el.innerHTML = `
    <style>
      .profiler-overlay { position: absolute; top: 6rem; right: 1rem;
        background: rgba(0,0,0,0.85); color: #2ed573;
        font-family: ui-monospace, monospace; font-size: 0.7rem;
        padding: 0.6rem 0.8rem; border-radius: 6px;
        line-height: 1.5; z-index: 21; min-width: 220px; }
      .profiler-overlay.hidden { display: none; }
      .profiler-overlay .title { color: #ffa502; font-weight: 700; margin-bottom: 0.3rem; }
      .profiler-overlay .row { display: flex; justify-content: space-between; gap: 1rem; }
    </style>
    <div class="title">Frame breakdown</div>
    <div id="prof-rows"></div>
  `;
  document.getElementById('app').appendChild(el);
  let raf = null;
  function update() {
    const rows = el.querySelector('#prof-rows');
    rows.innerHTML = '';
    for (const [name, s] of Object.entries(profiler.all())) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = '<span>' + name + '</span><span>' + s.avg.toFixed(2) + ' ms</span>';
      rows.appendChild(row);
    }
    raf = requestAnimationFrame(update);
  }
  return {
    toggle() {
      el.classList.toggle('hidden');
      if (!el.classList.contains('hidden')) raf = requestAnimationFrame(update);
      else if (raf) { cancelAnimationFrame(raf); raf = null; }
    },
  };
}