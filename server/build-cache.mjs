// Content-addressed build cache.
// Keyed by DOL SHA-256, translator git rev, aurora git rev, emsdk version.
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
export class BuildCache {
  constructor(root) { this.root = root; }
  async init() { await fs.mkdir(this.root, { recursive: true }); }
  async dolHash(dolPath) {
    const h = crypto.createHash('sha256');
    await new Promise((resolve, reject) => {
      const s = fss.createReadStream(dolPath);
      s.on('data', (b) => h.update(b));
      s.on('end', resolve);
      s.on('error', reject);
    });
    return h.digest('hex');
  }
  async gitRev(dir) {
    try {
      return await new Promise((resolve, reject) => {
        const c = spawn('git', ['-C', dir, 'rev-parse', 'HEAD']);
        let s = '';
        c.stdout.on('data', (b) => (s += b.toString()));
        c.on('exit', (code) => (code === 0 ? resolve(s.trim()) : reject(new Error('git failed'))));
        c.on('error', reject);
      });
    } catch { return 'unknown'; }
  }
  async key({ dolHash, wiicompiledDir, auroraDir, emsdkVersion }) {
    const [tRev, aRev] = await Promise.all([
      this.gitRev(wiicompiledDir),
      this.gitRev(auroraDir),
    ]);
    const parts = [dolHash, tRev, aRev, emsdkVersion || 'unknown'].join('|');
    return crypto.createHash('sha256').update(parts).digest('hex').slice(0, 32);
  }
  cacheDir(key) { return path.join(this.root, key); }
  async lookup(key) {
    const dir = this.cacheDir(key);
    try {
      const m = JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8'));
      if (await exists(path.join(dir, 'mkwii_recomp.wasm'))) return { hit: true, dir, meta: m };
    } catch {}
    return { hit: false, dir };
  }
  async store(key, buildDir) {
    const dir = this.cacheDir(key);
    await fs.mkdir(dir, { recursive: true });
    for (const n of ['mkwii_recomp.js', 'mkwii_recomp.wasm', 'mkwii_recomp.worker.js']) {
      const src = path.join(buildDir, n);
      if (fss.existsSync(src)) await fs.copyFile(src, path.join(dir, n));
    }
    await fs.writeFile(
      path.join(dir, 'meta.json'),
      JSON.stringify({ builtAt: Date.now(), key }, null, 2)
    );
    return dir;
  }
}
async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}