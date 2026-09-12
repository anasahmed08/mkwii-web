// WBFS reader — corrected against libwbfs format.
// Header layout (from libwbfs.h):
//   0x00  u32  magic ("WBFS")
//   0x04  u32  n_hd_sec (big-endian)
//   0x08  u8   hd_sec_sz_s
//   0x09  u8   wbfs_sec_sz_s
//   0x0A  u8[2] padding
//   0x0C  u8[] disc_table (1 byte per disc slot; value * hd_sec_sz = disc info offset)
//
// Disc info (at disc_table[i] * hd_sec_sz):
//   0x00   u8[0x100]  disc header copy
//   0x100  u16[]      wlba table (big-endian, one entry per Wii block)
const WBFS_MAGIC = 0x57424653;
const WII_SEC_SZ = 0x8000;        // 32 KiB
const MAX_BLOCKS = 143432;        // dual-layer Wii disc
export class WbfsReader {
  constructor(file) {
    this.file = file;
    this._init = null;
  }
  async init() {
    if (this._init) return this._init;
    this._init = (async () => {
      const head = new Uint8Array(await this.file.slice(0, 0x1000).arrayBuffer());
      const dv = new DataView(head.buffer);
      const magic = dv.getUint32(0, false);
      if (magic !== WBFS_MAGIC) throw new Error('Not a WBFS file');
      this.nHdSec     = dv.getUint32(4, false);
      this.hdSecSzS   = head[8];
      this.wbfsSecSzS = head[9];
      this.hdSecSz    = 1 << this.hdSecSzS;
      this.wbfsSecSz  = 1 << this.wbfsSecSzS;
      // Find the first non-empty disc slot.
      let discInfoLba = -1;
      for (let i = 0; i < 500; i++) {
        const entry = head[0x0C + i];
        if (entry !== 0) { discInfoLba = entry; break; }
      }
      if (discInfoLba < 0) throw new Error('WBFS has no disc');
      const discInfoOffset = discInfoLba * this.hdSecSz;
      // Read disc header copy + start of wlba table.
      const info = new Uint8Array(
        await this.file.slice(discInfoOffset, discInfoOffset + 0x100 + 4096).arrayBuffer()
      );
      this.discHeader = info.slice(0, 0x100);
      this.gameId = new TextDecoder().decode(this.discHeader.subarray(0, 6)).replace(/\0+$/, '');
      // Read wlba table in chunks until we find the last non-zero entry.
      // Cap at MAX_BLOCKS to bound reads.
      const wlbaOffset = discInfoOffset + 0x100;
      const CHUNK = 8192; // entries per read (16 KiB)
      let lastNonZero = -1;
      let entriesRead = 0;
      while (entriesRead < MAX_BLOCKS) {
        const count = Math.min(CHUNK, MAX_BLOCKS - entriesRead);
        const bytes = new Uint8Array(
          await this.file.slice(wlbaOffset + entriesRead * 2,
                                wlbaOffset + (entriesRead + count) * 2).arrayBuffer()
        );
        const cdv = new DataView(bytes.buffer);
        let chunkHasData = false;
        for (let i = 0; i < count; i++) {
          if (cdv.getUint16(i * 2, false) !== 0) {
            lastNonZero = entriesRead + i;
            chunkHasData = true;
          }
        }
        entriesRead += count;
        // Stop early if this chunk was all zeros and we've seen data already.
        if (!chunkHasData && lastNonZero >= 0) break;
        if (!chunkHasData && entriesRead >= CHUNK && lastNonZero < 0) break; // empty disc
      }
      this.nlb = lastNonZero + 1;
      if (this.nlb === 0) throw new Error('WBFS has no disc (empty wlba table)');
      // Now read the full wlba table for the blocks we know exist.
      const wlbaBytes = new Uint8Array(
        await this.file.slice(wlbaOffset, wlbaOffset + this.nlb * 2).arrayBuffer()
      );
      const wdv = new DataView(wlbaBytes.buffer);
      this.wlba = new Uint16Array(this.nlb);
      for (let i = 0; i < this.nlb; i++) this.wlba[i] = wdv.getUint16(i * 2, false);
      this.isoSize = this.nlb * this.wbfsSecSz;
      this._dataStart = discInfoOffset + this._discInfoSize();
      return this;
    })();
    return this._init;
  }
  _discInfoSize() {
    // Disc info is padded to hd_sec_sz boundary.
    const raw = 0x100 + this.nlb * 2;
    return Math.ceil(raw / this.hdSecSz) * this.hdSecSz;
  }
  get size() { return this.isoSize; }
  async slice(start, end) {
    await this.init();
    const out = new Uint8Array(end - start);
    const BLOCK = this.wbfsSecSz;
    let written = 0;
    while (written < out.length) {
      const abs = start + written;
      const blockIdx = Math.floor(abs / BLOCK);
      const blockOff = abs % BLOCK;
      const phys = this.wlba[blockIdx];
      const take = Math.min(BLOCK - blockOff, out.length - written);
      if (phys === 0) { written += take; continue; } // sparse block
      // WBFS stores data blocks starting after the header region,
      // at (phys - 1) * wbfsSecSz from the data area base.
      const dataBase = this._dataStart;
      const physOffset = dataBase + (phys - 1) * BLOCK + blockOff;
      const chunk = new Uint8Array(
        await this.file.slice(physOffset, physOffset + take).arrayBuffer()
      );
      out.set(chunk, written);
      written += take;
    }
    return out;
  }
  async arrayBuffer() { return (await this.slice(0, this.isoSize)).buffer; }
}