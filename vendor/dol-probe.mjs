// Probes a DOL for the memory layout values the manifest needs.
import fs from 'node:fs/promises';
function isLis(w) { return (w & 0xFC000000) === 0x3C000000; }
function isOri(w) { return (w & 0xFC000000) === 0x60000000; }
function decodeLis(w) { return { rt: (w >> 21) & 0x1F, imm: w & 0xFFFF }; }
function decodeOri(w) { return { rs: (w >> 21) & 0x1F, ra: (w >> 16) & 0x1F, imm: w & 0xFFFF }; }
export async function probeDol(dolPath) {
  const buf = await fs.readFile(dolPath);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const sections = [];
  for (let i = 0; i < 7; i++) {
    const off = dv.getUint32(0x00 + i * 4, false);
    const addr = dv.getUint32(0x48 + i * 4, false);
    const size = dv.getUint32(0x90 + i * 4, false);
    if (size) sections.push({ kind: 'text', off, addr, size });
  }
  for (let i = 0; i < 11; i++) {
    const off = dv.getUint32(0x1C + i * 4, false);
    const addr = dv.getUint32(0x64 + i * 4, false);
    const size = dv.getUint32(0xAC + i * 4, false);
    if (size) sections.push({ kind: 'data', off, addr, size });
  }
  const bssAddr = dv.getUint32(0xD8, false);
  const bssSize = dv.getUint32(0xDC, false);
  const entry = dv.getUint32(0xE0, false);
  const text = sections.find((s) => s.kind === 'text');
  let memBase = 0x80000000, sdaBase = 0, sda2Base = 0;
  for (let i = 0; i < Math.min(text.size / 4, 20000); i++) {
    const w0 = dv.getUint32(text.off + i * 4, false);
    const w1 = dv.getUint32(text.off + (i + 1) * 4, false);
    if (isLis(w0) && isOri(w1)) {
      const lis = decodeLis(w0);
      const ori = decodeOri(w1);
      if (lis.rt === ori.rs && lis.rt === ori.ra) {
        const val = ((lis.imm << 16) | ori.imm) >>> 0;
        if (val === 0x80000000) memBase = val;
        else if ((val & 0xFFFF0000) === 0x804D0000) {
          if (!sdaBase) sdaBase = val;
          else if (!sda2Base && val !== sdaBase) sda2Base = val;
        }
      }
    }
  }
  const maxEnd = Math.max(...sections.map((s) => s.addr + s.size), bssAddr + bssSize);
  const memSize = Math.ceil((maxEnd - memBase) / 0x100000) * 0x100000;
  return {
    sections,
    entrypoint: entry,
    bssAddress: bssAddr,
    bssSize,
    memory: {
      base: memBase,
      size: memSize || 0x01800000,
      sdaBase: sdaBase || 0x8038CC00,
      sda2Base: sda2Base || (sdaBase + 0x23A0) || 0x8038EFA0,
    },
  };
}
if (import.meta.url === 'file://' + process.argv[1]) {
  const p = process.argv[2];
  if (!p) { console.error('usage: dol-probe.mjs <main.dol>'); process.exit(2); }
  const r = await probeDol(p);
  console.log(JSON.stringify(r, null, 2));
}