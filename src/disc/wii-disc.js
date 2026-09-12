import { parseFST, resolvePaths } from './fst.js';
const PARTITION_TABLE_OFFSET = 0x40000;
export class WiiDisc {
  constructor(file) {
    this.file = file;
    this.size = file.size;
    this.partitionOffset = 0;
    this.fstEntries = null;
    this.pathMap = null;
  }
  async init() {
    const header = new Uint8Array(await this.file.slice(0, 0x100).arrayBuffer());
    this.gameId = new TextDecoder().decode(header.subarray(0, 6)).replace(/\0+$/, '');
    this.title = new TextDecoder().decode(header.subarray(0x20, 0x20 + 0x40)).replace(/\0+$/, '').trim();
    // Wii magic check removed — accept any disc whose first 6 bytes are ASCII.
    if (!/^[A-Z0-9]{6}$/.test(this.gameId)) {
      throw new Error('Not a Wii disc (bad game ID "' + this.gameId + '")');
    }
    // Try the standard 0x40000 partition table first.
    let gamePart = await this._findPartitionAt(PARTITION_TABLE_OFFSET);
    if (!gamePart) {
      // Some builds place the partition table elsewhere. Scan forward in 0x10000 steps.
      for (let off = 0x40000; off < 0x100000; off += 0x10000) {
        gamePart = await this._findPartitionAt(off);
        if (gamePart) break;
      }
    }
    if (!gamePart) throw new Error('No game partition found');
    this.partitionOffset = gamePart.offset;
    const phdr = new Uint8Array(await this.file.slice(this.partitionOffset, this.partitionOffset + 0x440).arrayBuffer());
    const pdv = new DataView(phdr.buffer);
    const fstOffset = pdv.getUint32(0x424, false) << 2;
    const fstSize = pdv.getUint32(0x428, false) << 2;
    if (fstOffset === 0 || fstSize === 0) {
      throw new Error('Partition header invalid (fst offset/size = 0)');
    }
    this.fstOffset = this.partitionOffset + fstOffset;
    this.fstSize = fstSize;
    const fstBuf = new Uint8Array(await this.file.slice(this.fstOffset, this.fstOffset + fstSize).arrayBuffer());
    this.fstEntries = parseFST(fstBuf, 0);
    this.pathMap = resolvePaths(this.fstEntries);
    return this;
  }
  async _findPartitionAt(ptOffset) {
    if (ptOffset + 4 * 8 > this.size) return null;
    const ptab = new Uint8Array(await this.file.slice(ptOffset, ptOffset + 4 * 8).arrayBuffer());
    const dv = new DataView(ptab.buffer);
    for (let i = 0; i < 4; i++) {
      const off = dv.getUint32(i * 8, false);
      const type = dv.getUint32(i * 8 + 4, false);
      if (off === 0 || type !== 0) continue;
      const partOffset = off << 2;
      if (partOffset + 0x440 > this.size) continue;
      return { offset: partOffset, type };
    }
    return null;
  }
  async readRaw(offset, length) {
    return new Uint8Array(await this.file.slice(offset, offset + length).arrayBuffer());
  }
  async readFile(path) {
    const e = this.pathMap.get(path);
    if (!e) throw new Error('ENOENT: ' + path);
    if (e.type !== 0) throw new Error('EISDIR: ' + path);
    return this.readRaw(this.partitionOffset + e.offset, e.size);
  }
  stat(path) { return this.pathMap.get(path); }
  listFiles(prefix = '/') {
    const out = [];
    for (const [p, e] of this.pathMap) {
      if (e.type === 0 && p.startsWith(prefix)) out.push(p);
    }
    return out;
  }
}