import { log, logErr, logOk } from './logger.js';
const $ = (id) => document.getElementById(id);
let worker = null;
let canvas = null;
let ctx = null;
let wasmReady = false;
let discReady = false;
async function boot() {
  log('Booting...');
  worker = new Worker('/src/worker.js', { type: 'module' });
  worker.onmessage = onWorkerMessage;
  worker.postMessage({ type: 'init' });
  canvas = $('game-canvas');
  ctx = canvas.getContext('2d');
  canvas.width = 960;
  canvas.height = 540;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') return;
    worker.postMessage({ type: 'input', code: e.code, pressed: true });
  });
  window.addEventListener('keyup', (e) => {
    worker.postMessage({ type: 'input', code: e.code, pressed: false });
  });
  $('pick-btn').onclick = () => $('iso-input').click();
  $('drop-zone').onclick = () => $('iso-input').click();
  $('iso-input').onchange = (e) => { if (e.target.files[0]) sendIso(e.target.files[0]); };
  $('drop-zone').ondragover = (e) => e.preventDefault();
  $('drop-zone').ondrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) sendIso(e.dataTransfer.files[0]);
  };
  $('start-btn').onclick = () => { log('Launching...'); worker.postMessage({ type: 'start' }); };
  $('fullscreen-btn').onclick = () => {
    const el = $('app');
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };
  $('exit-btn').onclick = () => location.reload();
  $('clear-save-btn').onclick = () => logOk('Cleared');
  $('rr-toggle').onchange = (e) => worker.postMessage({ type: 'set-retro-rewind', enabled: e.target.checked });
  $('wifi-toggle').onchange = (e) => worker.postMessage({ type: 'wifi-toggle', enabled: e.target.checked });
  // Settings / controllers / rooms / profiler buttons
  const settingsBtn = $('settings-btn');
  const controllersBtn = $('controllers-btn');
  const roomsBtn = $('rooms-btn-hud') || $('rooms-btn');
  if (settingsBtn) settingsBtn.onclick = () => {
    const m = document.getElementById('settings-modal');
    if (m) m.classList.remove('hidden');
  };
  if (controllersBtn) controllersBtn.onclick = () => {
    const m = document.getElementById('controller-modal');
    if (m) m.classList.remove('hidden');
  };
  if (roomsBtn) roomsBtn.onclick = () => {
    const m = document.getElementById('rooms-modal');
    if (m) m.classList.remove('hidden');
  };
  // Close buttons inside modals
  document.querySelectorAll('[data-act="close"]').forEach((b) => {
    b.onclick = () => b.closest('.modal')?.classList.add('hidden');
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') {
      const p = document.getElementById('profiler-overlay');
      if (p) p.classList.toggle('hidden');
    }
  });
  const modeSel = $('mode-select');
  const serverRow = $('server-url-row');
  const serverInput = $('server-url');
  if (modeSel) {
    modeSel.onchange = () => {
      currentMode = modeSel.value;
      if (serverRow) serverRow.style.display = currentMode === 'server' ? '' : 'none';
      log('Mode: ' + currentMode);
    };
  }
  if (serverInput) {
    serverInput.oninput = () => { serverUrl = serverInput.value.trim(); };
    serverUrl = serverInput.value.trim();
  }
  logOk('Ready');
}
function sendIso(file) {
  log('Loading disc: ' + file.name + ' (' + (file.size / 1048576).toFixed(1) + ' MB)');
  if (currentMode === 'server') {
    translateOnServer(file);
    return;
  }
  worker.postMessage({ type: 'iso-file', file });
}
let currentMode = 'local';
let serverUrl = '';
async function translateOnServer(file) {
  if (!serverUrl) {
    logErr('Enter the translation server URL first (e.g. http://localhost:8787)');
    return;
  }
  const fill = document.getElementById('progress-fill');
  const wrap = document.getElementById('progress-wrap');
  const label = document.getElementById('progress-label');
  if (wrap) wrap.classList.remove('hidden');
  if (label) label.textContent = 'Uploading to ' + serverUrl + ' ...';
  try {
    const srcPath = prompt('Full path to ISO on this PC:', 'E:\\dolphin\\mkwii iso for tests\\MarioKart.iso');
    if (!srcPath) { if (label) label.textContent = 'Cancelled'; return; }
    const res = await fetch(serverUrl.replace(/\/$/, '') + '/api/translate-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: srcPath }),
    });
    if (!res.ok) throw new Error('upload failed ' + res.status);
    const { id } = await res.json();
    log('Job ' + id + ' started');
    const es = new EventSource(serverUrl.replace(/\/$/, '') + '/api/translate/' + id + '/log');
    es.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === 'log') log(m.line);
      else if (m.type === 'state') {
        if (fill) fill.style.width = (m.progress * 100).toFixed(1) + '%';
        if (label) label.textContent = m.stage + ' ' + (m.progress * 100).toFixed(0) + '%';
      } else if (m.type === 'done') {
        es.close();
        logOk('Translation complete');
        if (label) label.textContent = 'Done';
        // Load the compiled module
        worker.postMessage({ type: 'reload-module', wasmJsUrl: m.result.jsUrl, wasmUrl: m.result.wasmUrl });
      } else if (m.type === 'error') {
        es.close();
        logErr('Translation failed: ' + m.error);
        if (label) label.textContent = 'Failed';
      }
    };
    es.onerror = () => logErr('SSE connection error');
  } catch (err) {
    logErr('Server translation failed: ' + err.message);
  }
}
function onWorkerMessage(e) {
  const m = e.data;
  if (m.type === 'log') { m.cls === 'err' ? logErr(m.msg) : log(m.msg); return; }
  if (m.type === 'wasm-ready') { wasmReady = true; logOk('WASM ready'); updateStart(); return; }
  if (m.type === 'disc-ready') { discReady = true; logOk('Disc loaded: ' + (m.info?.title || m.info?.gameId || 'unknown')); updateStart(); return; }
  if (m.type === 'stub-frame') { draw(m.canvas); return; }
  if (m.type === 'started') {
    logOk('Game started');
    $('overlay').classList.add('hidden');
    $('hud').classList.remove('hidden');
    return;
  }
}
function draw(d) {
  if (!ctx) return;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, d.w, d.h);
  const cx = d.w / 2 + Math.sin(d.t) * d.w * 0.3;
  const cy = d.h / 2 + Math.cos(d.t * 1.3) * d.h * 0.2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(d.t * 2) * 0.2);
  ctx.fillStyle = 'hsl(' + ((d.t * 60) % 360) + ',70%,55%)';
  ctx.fillRect(-40, -30, 80, 60);
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('MKWii Browser — stub', 24, 40);
  ctx.font = '16px monospace';
  ctx.fillStyle = '#8f8';
  ctx.fillText('FPS: ' + d.fps.toFixed(0), 24, 68);
}
function updateStart() {
  $('start-btn').disabled = !(wasmReady && discReady);
}
boot().catch((e) => { console.error(e); logErr('Boot failed: ' + e.message); });