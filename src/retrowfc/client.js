const DEFAULT_BASE = 'https://rwfc.net/api';
export class RetroWfcClient {
  constructor(baseUrl = DEFAULT_BASE) {
    this.base = baseUrl.replace(/\/$/, '');
  }
  async status() {
    try {
      const r = await fetch(this.base + '/status');
      if (!r.ok) throw new Error('status ' + r.status);
      return await r.json();
    } catch (e) {
      return { online: false, error: e.message };
    }
  }
  async rooms() {
    try {
      const r = await fetch(this.base + '/rooms');
      if (!r.ok) throw new Error('rooms ' + r.status);
      return await r.json();
    } catch (e) {
      return { rooms: [], error: e.message };
    }
  }
  async leaderboard(limit = 20) {
    try {
      const r = await fetch(this.base + '/leaderboard?limit=' + limit);
      if (!r.ok) throw new Error('leaderboard ' + r.status);
      return await r.json();
    } catch (e) {
      return { entries: [], error: e.message };
    }
  }
  async friendCode(profileId) {
    if (!profileId) return null;
    const n = BigInt(profileId);
    const fc = ((n & 0xFFFFFFFFn) * 1000000000n + (n >> 32n) * 1000n) % 10000000000000n;
    return fc.toString().padStart(12, '0');
  }
}