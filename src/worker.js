import { DiscBackend } from './disc/disc-backend.js';
import { SzsPatcher } from './disc/szs.js';
let Module = null;
let disc = new DiscBackend();
let szsPatcher = null;
let modQueue = [];
let injectionQueue = [];
async function initWasm() {
  self.postMessage({ type: 'log', msg: 'Loading WASM module...' });
  const mod = await import('./wasm/mkwii_recomp.js');
  Module = await mod.default({
    print: (t) => self.postMessage({ type: 'log', msg: t }),
    printErr: (t) => self.postMessage({ type: 'log', msg: t, cls: 'err' }),
  });
  Module.discBackend = {
    readRaw: (o, n) => disc.readRaw(o, n),
    readFile: (p) => disc.readFile(p),
    stat: async (p) => {
      const e = disc.disc && disc.disc.stat(p);
      if (!e) return null;
      return { size: e.size, offset: e.offset };
    },
    isOverlaid: () => disc.overlay.count > 0,
  };
  self.postMessage({ type: 'wasm-ready' });
}
async function loadIso(file) {
  self.postMessage({ type: 'log', msg: 'Parsing disc: ' + file.name });
  try {
    await disc.load(file, { patchWfc: true });
    const d = disc.disc;
    self.postMessage({ type: 'log', msg: 'Disc: ' + d.gameId + ' "' + d.title + '" (' + disc._source + ')', cls: 'ok' });
    if (disc.dolPatches && disc.dolPatches.length) {
      for (const p of disc.dolPatches) self.postMessage({ type: 'log', msg: 'WFC: ' + p });
    }
    if (disc._patchError) self.postMessage({ type: 'log', msg: 'WFC skipped: ' + disc._patchError });
    self.postMessage({ type: 'disc-ready', info: disc.info, fileCount: d.pathMap.size });
  } catch (err) {
    self.postMessage({ type: 'log', msg: 'Disc parse failed: ' + err.message, cls: 'err' });
    self.postMessage({ type: 'disc-ready', info: { gameId: 'stub', title: file.name }, fileCount: 0 });
  }
}
function flushMods() {
  for (const m of modQueue) disc.addModFile(m.path, m.data);
  modQueue = [];
  if (!szsPatcher) szsPatcher = new SzsPatcher();
  for (const inj of injectionQueue) {
    szsPatcher.addInjection(inj.archive, inj.internalPath, inj.data);
  }
  injectionQueue = [];
  disc.szsPatcher = szsPatcher;
}
self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') { await initWasm(); return; }
    if (msg.type === 'iso-file') { await loadIso(msg.file); return; }
    if (msg.type === 'mods-begin') { disc.clearMods(); modQueue = []; injectionQueue = []; return; }
    if (msg.type === 'mod-file') {
      if (!disc.ready) modQueue.push({ path: msg.path, data: new Uint8Array(msg.data) });
      else disc.addModFile(msg.path, new Uint8Array(msg.data));
      return;
    }
    if (msg.type === 'mod-injection') {
      injectionQueue.push({ archive: msg.archive, internalPath: msg.internalPath, data: new Uint8Array(msg.data) });
      return;
    }
    if (msg.type === 'mods-end') {
      flushMods();
      self.postMessage({ type: 'mods-applied', regions: disc.overlay.count });
      return;
    }
    if (msg.type === 'start') {
      if (!Module) { self.postMessage({ type: 'log', msg: 'WASM not loaded', cls: 'err' }); return; }
      self.postMessage({ type: 'log', msg: 'startGame' });
      Module._mkwii_start();
      self.postMessage({ type: 'started' });
      return;
    }
    if (msg.type === 'stub-frame') { self.postMessage(msg); return; }
    if (msg.type === 'input') { if (Module._inject_input) Module._inject_input(msg.code, msg.pressed ? 1 : 0); return; }
    if (msg.type === 'set-retro-rewind') { if (Module._set_retro_rewind) Module._set_retro_rewind(msg.enabled ? 1 : 0); return; }
    if (msg.type === 'resize') { return; }
    if (msg.type === 'wifi-toggle') { return; }
    if (msg.type === 'get-dol-hooks') { self.postMessage({ type: 'dol-hooks', id: msg.id, hooks: [], patches: disc.dolPatches || [], error: null }); return; }
  } catch (err) {
    self.postMessage({ type: 'log', msg: 'Worker err [' + msg.type + ']: ' + err.message, cls: 'err' });
  }
};