const logEl = () => document.getElementById('log');
export function log(msg, cls = '') {
  const el = logEl();
  if (!el) { console.log(msg); return; }
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
  console.log(msg);
}
export function logErr(msg) { log(msg, 'err'); }
export function logOk(msg)  { log(msg, 'ok'); }