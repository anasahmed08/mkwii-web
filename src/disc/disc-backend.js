// Unified disc backend used by the worker.
// Combines WiiDisc, DiscOverlay, RVZ/WBFS readers, and DOL patching.
import { WiiDisc } from './wii-disc.js';
import { DiscOverlay } from './overlay.js';
import { RvzReader } from './rvz.js';
import { WbfsReader } from './wbfs.js';
import { Stage0Patcher } from './dol-patcher.js';
export class DiscBackend {
  constructor() {
    this.disc = null;
    this.overlay = new DiscOverlay();
    this.cache = new Map();
    this.cacheLimit = 64;
    this.rvz = null;
    this.wbfs = null;
    this._source = null;
    this.dolPatches = [];
    this.dolHooks = [];
    this._patchError = null;
    this.szsPatcher = null;
  }
  async load(file, opts = {}) {
    if (file.size > 4) {
      const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      const magic = new DataView(head.buffer).getUint32(0, false);
      if (magic === 0x52565a01 || magic === 0x57494101) {
        this.rvz = new RvzReader(file);
        await this.rvz.init();
        const shim = {
          size: this.rvz.size,
          slice: (a, b) => ({ arrayBuffer: async () => (await this.rvz.slice(a, b)).buffer }),
        };
        this.disc = await new WiiDisc(shim).init();
        this._source = 'rvz';
      } else if (magic === 0x57424653) {
        this.wbfs = new WbfsReader(file);
        await this.wbfs.init();
        const shim = {
          size: this.wbfs.size,
          slice: (a, b) => ({ arrayBuffer: async () => (await this.wbfs.slice(a, b)).buffer }),
        };
        this.disc = await new WiiDisc(shim).init();
        this._source = 'wbfs';
      } else {
        this.disc = await new WiiDisc(file).init();
        this._source = 'iso';
      }
    } else {
      this.disc = await new WiiDisc(file).init();
      this._source = 'iso';
    }
    if (opts.patchWfc !== false) {
      try { await this._patchDol(opts); }
      catch (e) { this._patchError = e.message; }
    }
    return this.disc;
  }
  get ready() { return !!this.disc; }
  get info() {
    if (!this.disc) return null;
    return {
      gameId: this.disc.gameId,
      title: this.disc.title,
      size: this.disc.size,
      partitionOffset: this.disc.partitionOffset,
      source: this._source,
    };
  }
  async readRaw(offset, length) {
    const o = this.overlay.resolve(offset, length);
    if (o) return o;
    if (length <= 0x10000) {
      const key = offset + ':' + length;
      const hit = this.cache.get(key);
      if (hit) return hit;
      const buf = await this.disc.readRaw(offset, length);
      if (this.cache.size >= this.cacheLimit) {
        const first = this.cache.keys().next().value;
        this.cache.delete(first);
      }
      this.cache.set(key, buf);
      return buf;
    }
    return this.disc.readRaw(offset, length);
  }
  async readFile(path) {
    if (!this.disc) throw new Error('disc not loaded');
    const entry = this.disc.stat(path);
    if (!entry) throw new Error('ENOENT: ' + path);
    const abs = this.disc.partitionOffset + entry.offset;
    const o = this.overlay.resolve(abs, entry.size);
    if (o) return o;
    return this.disc.readFile(path);
  }
  addModFile(path, data) {
    if (!this.disc) throw new Error('disc not loaded');
    const entry = this.disc.stat(path);
    if (!entry) return { path, added: false, reason: 'not-in-fst' };
    const abs = this.disc.partitionOffset + entry.offset;
    this.overlay.addRegion(abs, entry.size, data);
    return { path, added: true, replaced: entry.size };
  }
  clearMods() {
    this.overlay.clear();
    this.cache.clear();
  }
  async _patchDol(opts) {
    const dolBytes = await this.disc.readFile('/main.dol');
    const patcher = new Stage0Patcher();
    const result = patcher.apply(dolBytes, opts);
    this.dolPatches = result.log;
    this.patchedDol = result.buffer;
    this.dolHooks = patcher.runtimeHooks();
    const entry = this.disc.stat('/main.dol');
    if (entry) {
      const abs = this.disc.partitionOffset + entry.offset;
      this.overlay.addRegion(abs, entry.size, result.buffer);
    }
  }
}