// RVZ (Dolphin) disc image reader.
// Spec: https://github.com/dolphin-emu/dolphin/blob/master/docs/WiaAndRvz.md
const RVZ_MAGIC = 0x52565a01;
const WIA_MAGIC = 0x57494101;
const COMPRESSION = {
  0: 'none',
  1: 'purge',
  2: 'bzip2',
  3: 'lzma',
  4: 'lzma2',
  5: 'zstd',
};
export class RvzReader {
  constructor(file) {
    this.file = file;
    this.isRvz = true;
    this.isoSize = 0;
    this.chunkSize = 0;
    this.chunks = [];
    this._init = null;
    this._chunkCache = new Map();
  }
  async init() {
    if (this._init) return this._init;
    this._init = (async () => {
      const head = new Uint8Array(await this.file.slice(0, 0x100).arrayBuffer());
      const dv = new DataView(head.buffer);
      const magic = dv.getUint32(0, false);
      if (magic !== RVZ_MAGIC && magic !== WIA_MAGIC) {
        throw new Error('Not an RVZ/WIA file');
      }
      this.isoSize = Number(dv.getBigUint64(0x0c, false));
      this.chunkSize = dv.getUint32(0x14, false);
      this.discType = dv.getUint32(0x18, false);
      this.numPartitions = dv.getUint32(0x1c, false);
      const partEntries = [];
      let p = 0x20;
      for (let i = 0; i < this.numPartitions; i++) {
        const partEntry = await this.file.slice(p, p + 8).arrayBuffer();
        const pdv = new DataView(partEntry);
        partEntries.push({
          offset: pdv.getUint32(0, false),
          size: pdv.getUint32(4, false),
        });
        p += 8;
      }
      const rawPartTable = partEntries[0];
      const partTableBytes = new Uint8Array(
        await this.file.slice(rawPartTable.offset, rawPartTable.offset + rawPartTable.size).arrayBuffer()
      );
      const ptdv = new DataView(partTableBytes.buffer);
      const numChunks = ptdv.getUint32(0, false);
      let cp = 4;
      for (let i = 0; i < numChunks; i++) {
        this.chunks.push({
          compType: ptdv.getUint32(cp, false),
          compSize: ptdv.getUint32(cp + 4, false),
          decompSize: ptdv.getUint32(cp + 8, false),
          offset: rawPartTable.offset + ptdv.getUint32(cp + 12, false),
        });
        cp += 16;
      }
      this._numChunks = this.chunks.length;
      return this;
    })();
    return this._init;
  }
  get size() { return this.isoSize; }
  async slice(start, end) {
    await this.init();
    const out = new Uint8Array(end - start);
    let written = 0;
    while (written < out.length) {
      const abs = start + written;
      const chunkIdx = Math.floor(abs / this.chunkSize);
      const chunkOff = abs % this.chunkSize;
      if (!this.chunks[chunkIdx]) throw new Error('RVZ: chunk ' + chunkIdx + ' out of range');
      const data = await this._getChunk(chunkIdx);
      const take = Math.min(this.chunkSize - chunkOff, out.length - written);
      out.set(data.subarray(chunkOff, chunkOff + take), written);
      written += take;
    }
    return out;
  }
  async arrayBuffer() { return (await this.slice(0, this.isoSize)).buffer; }
  async _getChunk(idx) {
    const hit = this._chunkCache.get(idx);
    if (hit) return hit;
    const c = this.chunks[idx];
    const raw = new Uint8Array(
      await this.file.slice(c.offset, c.offset + c.compSize).arrayBuffer()
    );
    let data;
    switch (COMPRESSION[c.compType]) {
      case 'none': data = raw; break;
      case 'purge': data = rvzDecompressPurge(raw, c.decompSize); break;
      case 'zstd': data = await decompressZstd(raw, c.decompSize); break;
      case 'lzma':
      case 'lzma2': {
        const { decompressRvzLzma } = await import('./lzma.js');
        data = await decompressRvzLzma(raw, c.decompSize);
        break;
      }
      case 'bzip2': data = await decompressBzip2(raw, c.decompSize); break;
      default: throw new Error('RVZ unknown compression ' + c.compType);
    }
    if (data.length !== c.decompSize) {
      throw new Error('RVZ chunk ' + idx + ' size mismatch (' + data.length + ' != ' + c.decompSize + ')');
    }
    if (this._chunkCache.size > 32) {
      const first = this._chunkCache.keys().next().value;
      this._chunkCache.delete(first);
    }
    this._chunkCache.set(idx, data);
    return data;
  }
}
function rvzDecompressPurge(src, outSize) {
  const out = new Uint8Array(outSize);
  const flagsLen = Math.ceil(outSize / 8);
  const flags = src.subarray(0, flagsLen);
  let si = flagsLen, oi = 0;
  const flag = (i) => (flags[i >> 3] >> (i & 7)) & 1;
  while (oi < outSize) {
    if (flag(oi)) {
      const run = src[si++] + 1;
      for (let i = 0; i < run && oi < outSize; i++) out[oi++] = src[si++];
    } else {
      const run = src[si++] + 1;
      for (let i = 0; i < run && oi < outSize; i++) out[oi++] = 0;
    }
  }
  return out;
}
async function decompressZstd(src, outSize) {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const ds = new DecompressionStream('zstd');
      const stream = new Blob([src]).stream().pipeThrough(ds);
      const buf = await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    } catch (_) {}
  }
  if (!self.__fzstd) {
    const mod = await import('https://cdn.jsdelivr.net/npm/fzstd@0.1.1/+esm');
    self.__fzstd = mod.decompress || mod.default;
  }
  return self.__fzstd(src, new Uint8Array(outSize));
}
async function decompressBzip2(src, expectedSize) {
  if (!self.__seekBzip) {
    const mod = await import('https://cdn.jsdelivr.net/npm/seek-bzip@2.0.0/+esm');
    self.__seekBzip = mod.default || mod;
  }
  const out = self.__seekBzip.decode(src);
  const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
  if (expectedSize && bytes.length !== expectedSize) {
    throw new Error('bzip2 size mismatch: ' + bytes.length + ' != ' + expectedSize);
  }
  return bytes;
}