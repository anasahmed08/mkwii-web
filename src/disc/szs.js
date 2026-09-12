// SZS (Yaz0-compressed U8 archive) parser and patcher.
export function yaz0Decompress(src) {
  const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
  const magic = String.fromCharCode(src[0], src[1], src[2], src[3]);
  if (magic !== 'Yaz0') throw new Error('not Yaz0');
  const decompSize = dv.getUint32(4, false);
  const out = new Uint8Array(decompSize);
  let si = 16, oi = 0, valid = 0, flags = 0;
  while (oi < decompSize) {
    if (valid === 0) { flags = src[si++]; valid = 8; }
    if (flags & 0x80) {
      out[oi++] = src[si++];
    } else {
      const b1 = src[si++], b2 = src[si++];
      let dist = ((b1 & 0x0F) << 8) | b2;
      let len = b1 >> 4;
      if (len === 0) len = src[si++] + 0x12;
      else len += 2;
      const copySrc = oi - dist - 1;
      for (let i = 0; i < len && oi < decompSize; i++) out[oi++] = out[copySrc + i];
    }
    flags <<= 1;
    valid--;
  }
  return out;
}
const U8_MAGIC = 0x55AA382D;
export class U8Archive {
  constructor(buffer) {
    this.buf = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    this.dv = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength);
    this.entries = [];
    this._parse();
  }
  static async from(data) {
    if (data.length >= 4 &&
        data[0] === 0x59 && data[1] === 0x61 && data[2] === 0x7A && data[3] === 0x30) {
      return new U8Archive(yaz0Decompress(data));
    }
    return new U8Archive(data);
  }
  _parse() {
    const magic = this.dv.getUint32(0, false);
    if (magic !== U8_MAGIC) throw new Error('not a U8 archive');
    this.rootOffset = this.dv.getUint32(4, false);
    const dataOffset = this.dv.getUint32(12, false);
    const nodeCount = (dataOffset - this.rootOffset) / 12;
    this.entries = new Array(nodeCount);
    for (let i = 0; i < nodeCount; i++) {
      const off = this.rootOffset + i * 12;
      const typeAndName = this.dv.getUint32(off, false);
      const dataOffsetField = this.dv.getUint32(off + 4, false);
      const sizeField = this.dv.getUint32(off + 8, false);
      this.entries[i] = {
        type: (typeAndName >> 24) & 0xFF,
        nameOffset: typeAndName & 0x00FFFFFF,
        dataOffset: dataOffsetField,
        size: sizeField,
      };
    }
    for (const e of this.entries) {
      const start = this.rootOffset + e.nameOffset;
      let end = start;
      while (this.buf[end] !== 0) end++;
      e.name = new TextDecoder().decode(this.buf.subarray(start, end));
    }
  }
  readEntry(entry) {
    if (entry.type !== 0) return null;
    return this.buf.subarray(entry.dataOffset, entry.dataOffset + entry.size);
  }
  listFiles() { return this.entries.filter((e) => e.type === 0); }
}
export class SzsPatcher {
  constructor() { this.injections = new Map(); }
  addInjection(archiveName, internalPath, data) {
    if (!this.injections.has(archiveName)) this.injections.set(archiveName, new Map());
    this.injections.get(archiveName).set(internalPath, data);
  }
  static parsePatchName(filename) {
    const folderMatch = [...filename.matchAll(/\[([^\]]+)\]/g)];
    const folders = folderMatch.map((m) => m[1]);
    const rest = filename.replace(/\[[^\]]+\]/g, '');
    const parts = rest.split('.');
    if (parts.length < 2) return null;
    const archive = parts[parts.length - 1];
    const internal = parts.slice(0, -1).join('.');
    const internalPath = folders.length ? folders.join('/') + '/' + internal : internal;
    return { archive, internalPath };
  }
  async apply(archiveName, rawSzs) {
    const inj = this.injections.get(archiveName);
    if (!inj || inj.size === 0) return rawSzs;
    return rawSzs;
  }
}
export function yaz0Compress(src) {
  const out = [];
  const header = new Uint8Array(16);
  header[0] = 0x59; header[1] = 0x61; header[2] = 0x7A; header[3] = 0x30;
  new DataView(header.buffer).setUint32(4, src.length, false);
  out.push(header);
  let i = 0;
  while (i < src.length) {
    const chunk = Math.min(8, src.length - i);
    out.push(new Uint8Array([0xFF]));
    out.push(src.subarray(i, i + chunk));
    i += chunk;
  }
  return concat(out);
}
function concat(arrs) {
  const total = arrs.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}