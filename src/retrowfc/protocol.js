// Retro WFC protocol client (HTTP side: NAS, DLS).
const DEFAULT_NAS = 'https://nas.rwfc.net';
export class RetroWfcProtocol {
  constructor(opts = {}) {
    this.nasBase = opts.nasBase || DEFAULT_NAS;
    this.gameId = opts.gameId || 'RMCP';
    this.gameVersion = opts.gameVersion || '1.1';
    this.consoleId = opts.consoleId || randomHex(16);
    this.profileId = opts.profileId || randomProfileId();
    this.token = opts.token || null;
    this.ingamesn = opts.ingamesn || randomHex(8).toUpperCase();
  }
  async login() {
    const body = new URLSearchParams({
      action: 'login',
      gameid: this.gameId,
      version: this.gameVersion,
      console: this.consoleId,
      ingamesn: this.ingamesn,
    });
    const r = await fetch(this.nasBase + '/ac', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) throw new Error('NAS login failed: ' + r.status);
    const parsed = parseNasResponse(await r.text());
    this.token = parsed.token || null;
    return parsed;
  }
  async fetchProfile(token = this.token) {
    if (!token) throw new Error('no token');
    const r = await fetch(this.nasBase + '/ac?action=profile&token=' + encodeURIComponent(token));
    if (!r.ok) throw new Error('profile fetch failed: ' + r.status);
    return parseNasResponse(await r.text());
  }
  gpcmCredentials() {
    return { gameId: this.gameId, token: this.token, profileId: this.profileId };
  }
  bridgeFor(service) {
    const ports = { nas: 29900, gpcm: 29901, gpsp: 29920, dls: 28910 };
    return { port: ports[service] || 0 };
  }
}
function parseNasResponse(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}
function randomHex(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
function randomProfileId() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 0xFFFFFFF0) + 8;
}