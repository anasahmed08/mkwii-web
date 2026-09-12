const KEY = 'mkwii-settings-v1';
const DEFAULTS = {
  mode: 'local',
  serverUrl: '',
  bridgeUrl: 'ws://localhost:8788/rwfc',
  rwfcDns: 'rwfc.net',
  resolution: 'auto',
  aspect: '16:9',
  vsync: true,
  audioEnabled: true,
  volume: 0.8,
  saveAutosave: true,
  wifiEnabled: false,
  showFps: false,
  wfcHost: 'rwfc.net',
  nasHost: 'nas.rwfc.net',
  patchDol: true,
};
export function load() {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }; }
  catch { return { ...DEFAULTS }; }
}
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
export function reset() { try { localStorage.removeItem(KEY); } catch {} return { ...DEFAULTS }; }