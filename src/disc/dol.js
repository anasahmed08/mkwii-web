// DOL (GameCube/Wii executable) parser.
const DOL_HEADER = {
  TEXT_OFFSETS: 0x00, DATA_OFFSETS: 0x1C,
  TEXT_ADDRESSES: 0x48, DATA_ADDRESSES: 0x64,
  TEXT_SIZES: 0x90, DATA_SIZES: 0xAC,
  BSS_ADDRESS: 0xD8, BSS_SIZE: 0xDC, ENTRYPOINT: 0xE0,
};
export class DolFile {
  constructor(buffer) {
    this.buf = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    this.dv = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength);
    this.sections = [];
    this._parseHeader();
  }
  _parseHeader() {
    const dv = this.dv;
    const readSections = (offOff, addrOff, sizeOff, count, kind) => {
      for (let i = 0; i < count; i++) {
        const fileOff = dv.getUint32(offOff + i * 4, false);
        const addr = dv.getUint32(addrOff + i * 4, false);
        const size = dv.getUint32(sizeOff + i * 4, false);
        if (size === 0) continue;
        this.sections.push({ kind, index: i, fileOffset: fileOff, address: addr, size });
      }
    };
    readSections(DOL_HEADER.TEXT_OFFSETS, DOL_HEADER.TEXT_ADDRESSES, DOL_HEADER.TEXT_SIZES, 7, 'text');
    readSections(DOL_HEADER.DATA_OFFSETS, DOL_HEADER.DATA_ADDRESSES, DOL_HEADER.DATA_SIZES, 11, 'data');
    this.bssAddress = dv.getUint32(DOL_HEADER.BSS_ADDRESS, false);
    this.bssSize = dv.getUint32(DOL_HEADER.BSS_SIZE, false);
    this.entrypoint = dv.getUint32(DOL_HEADER.ENTRYPOINT, false);
  }
  vaToOffset(va) {
    for (const s of this.sections) {
      if (va >= s.address && va < s.address + s.size) {
        return s.fileOffset + (va - s.address);
      }
    }
    return -1;
  }
  readAt(va, n) {
    const off = this.vaToOffset(va);
    if (off < 0) throw new Error('VA 0x' + va.toString(16) + ' not in any section');
    return this.buf.subarray(off, off + n);
  }
  writeAt(va, data) {
    const off = this.vaToOffset(va);
    if (off < 0) throw new Error('VA 0x' + va.toString(16) + ' not in any section');
    if (off + data.length > this.buf.length) throw new Error('write past EOF');
    this.buf.set(data, off);
  }
  findPattern(bytes, startVa = 0x80000000) {
    const needle = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    outer:
    for (const s of this.sections) {
      if (s.address + s.size < startVa) continue;
      const start = Math.max(0, startVa - s.address);
      const end = s.size - needle.length;
      for (let i = start; i <= end; i++) {
        for (let j = 0; j < needle.length; j++) {
          if (this.buf[s.fileOffset + i + j] !== needle[j]) continue outer;
        }
        return s.address + i;
      }
    }
    return -1;
  }
  findString(str) {
    const enc = new TextEncoder();
    const needle = new Uint8Array([...enc.encode(str), 0]);
    return this.findPattern(needle);
  }
  replaceString(oldStr, newStr) {
    const va = this.findString(oldStr);
    if (va < 0) return false;
    if (newStr.length > oldStr.length) {
      throw new Error('replacement "' + newStr + '" longer than original "' + oldStr + '"');
    }
    const padded = new Uint8Array(oldStr.length + 1);
    padded.set(new TextEncoder().encode(newStr), 0);
    this.writeAt(va, padded);
    return true;
  }
}