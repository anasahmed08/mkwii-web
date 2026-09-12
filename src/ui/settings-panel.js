import * as Settings from '../settings.js';
export function mountSettings(getWorker) {
  const root = document.createElement('div');
  root.id = 'settings-modal';
  root.className = 'modal hidden';
  root.innerHTML = `
    <div class="modal-inner">
      <h2>Settings</h2>
      <div class="row"><label>Resolution</label>
        <select data-k="resolution">
          <option value="auto">Auto</option>
          <option value="720p">720p</option>
          <option value="1080p">1080p</option>
          <option value="native">Native</option>
        </select>
      </div>
      <div class="row"><label>Aspect ratio</label>
        <select data-k="aspect">
          <option value="16:9">16:9</option>
          <option value="4:3">4:3</option>
        </select>
      </div>
      <div class="row"><label>VSync</label>
        <input type="checkbox" data-k="vsync" />
      </div>
      <div class="row"><label>Audio</label>
        <input type="checkbox" data-k="audioEnabled" />
      </div>
      <div class="row"><label>Volume</label>
        <input type="range" min="0" max="1" step="0.05" data-k="volume" />
      </div>
      <div class="row"><label>Show FPS</label>
        <input type="checkbox" data-k="showFps" />
      </div>
      <div class="row"><label>Autosave</label>
        <input type="checkbox" data-k="saveAutosave" />
      </div>
      <div class="row"><label>RWFC DNS</label>
        <input type="text" data-k="rwfcDns" placeholder="rwfc.net" />
      </div>
      <div class="row"><label>RWFC bridge URL</label>
        <input type="url" data-k="bridgeUrl" placeholder="ws://localhost:8788/rwfc" />
      </div>
      <div class="actions">
        <button data-act="reset">Reset</button>
        <button data-act="close">Close</button>
        <button class="primary" data-act="save">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  const s = Settings.load();
  const fields = root.querySelectorAll('[data-k]');
  for (const f of fields) {
    const k = f.dataset.k;
    const v = s[k];
    if (f.type === 'checkbox') f.checked = !!v;
    else f.value = v;
  }
  function gather() {
    const out = Settings.load();
    for (const f of fields) {
      const k = f.dataset.k;
      if (f.type === 'checkbox') out[k] = f.checked;
      else if (f.type === 'range' || f.type === 'number') out[k] = parseFloat(f.value);
      else out[k] = f.value;
    }
    return out;
  }
  function applyToRuntime(s) {
    const worker = getWorker();
    if (!worker) return;
    worker.postMessage({ type: 'settings', settings: s });
    if (s.bridgeUrl) worker.postMessage({ type: 'network-bridge', url: s.bridgeUrl });
    if (s.rwfcDns) worker.postMessage({ type: 'network-set-dns', dns: s.rwfcDns });
  }
  root.addEventListener('click', (e) => {
    const act = e.target.dataset && e.target.dataset.act;
    if (act === 'close') root.classList.add('hidden');
    else if (act === 'save') {
      const next = gather();
      Settings.save(next);
      applyToRuntime(next);
      root.classList.add('hidden');
    } else if (act === 'reset') {
      const fresh = Settings.reset();
      for (const f of fields) {
        const k = f.dataset.k;
        if (f.type === 'checkbox') f.checked = !!fresh[k];
        else f.value = fresh[k];
      }
    }
  });
  return {
    open() { root.classList.remove('hidden'); },
    close() { root.classList.add('hidden'); },
  };
}