// Wii disc File System Table parser.
// Layout (all big-endian): https://wiibrew.org/wiki/Wii_Disc
export function parseFST(buf, base = 0) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const count = dv.getUint32(base, false);
  const entriesBase = base + 4;
  const namesBase = entriesBase + count * 12;
  const entries = new Array(count);
  for (let i = 0; i < count; i++) {
    const off = entriesBase + i * 12;
    const type = buf[off];
    const nameOff = (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3];
    let end = namesBase + nameOff;
    while (end < buf.length && buf[end] !== 0) end++;
    const name = new TextDecoder().decode(buf.subarray(namesBase + nameOff, end));
    if (i === 0) {
      entries[i] = { type: 1, name: '/', parent: 0, offset: 0, size: 0 };
      continue;
    }
    if (type === 1) {
      const parent = dv.getUint32(off + 4, false) & 0xFFFFFF;
      entries[i] = { type: 1, name, parent, offset: 0, size: 0 };
    } else {
      const parent = dv.getUint32(off + 4, false) & 0xFFFFFF;
      const fileOff = dv.getUint32(off + 4, false);
      const fileSize = dv.getUint32(off + 8, false);
      entries[i] = { type: 0, name, parent, offset: fileOff, size: fileSize };
    }
  }
  return entries;
}
export function resolvePaths(entries) {
  const map = new Map();
  const byParent = new Map();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!byParent.has(e.parent)) byParent.set(e.parent, []);
    byParent.get(e.parent).push(i);
  }
  function walk(idx, prefix) {
    const e = entries[idx];
    const path = e.type === 1
      ? (prefix === '' ? '/' : prefix)
      : prefix + '/' + e.name;
    map.set(path, e);
    if (e.type === 1) {
      const kids = byParent.get(idx) || [];
      for (const k of kids) walk(k, path === '/' ? '' : path);
    }
  }
  walk(0, '');
  return map;
}