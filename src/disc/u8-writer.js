// Full U8 archive writer.
const U8_MAGIC = 0x55AA382D;
const ALIGN = 0x20;
export function buildU8(files) {
  const tree = buildTree(files);
  const nodes = flatten(tree);
  const nodeCount = nodes.length;
  const strParts = [];
  let strOff = 0;
  for (const n of nodes) {
    n.nameOffset = strOff;
    const enc = new TextEncoder().encode(n.name);
    strParts.push(enc);
    strParts.push(new Uint8Array([0]));
    strOff += enc.length + 1;
  }
  const strTable = concat(strParts);
  const strTablePadded = pad(strTable, ALIGN);
  const nodeTableSize = nodeCount * 12;
  const rootOffset = 0x20;
  const strTableOffset = rootOffset + nodeTableSize;
  const dataStart = strTableOffset + strTablePadded.length;
  let dataOff = 0;
  for (const n of nodes) {
    if (n.type === 0) {
      n.dataOffset = dataStart + dataOff;
      dataOff += align(n.data.length);
    } else {
      n.dataOffset = 0;
    }
  }
  const totalSize = dataStart + dataOff;
  const out = new Uint8Array(totalSize);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, U8_MAGIC, false);
  dv.setUint32(4, rootOffset, false);
  dv.setUint32(8, strTableOffset, false);
  dv.setUint32(12, dataStart, false);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const off = rootOffset + i * 12;
    dv.setUint32(off, (n.type << 24) | (n.nameOffset & 0x00FFFFFF), false);
    dv.setUint32(off + 4, n.dataOffset || 0, false);
    dv.setUint32(off + 8, n.data ? n.data.length : 0, false);
  }
  out.set(strTablePadded, strTableOffset);
  for (const n of nodes) {
    if (n.type === 0 && n.data) out.set(n.data, n.dataOffset);
  }
  return out;
}
function buildTree(files) {
  const root = { name: '', type: 1, children: new Map() };
  for (const [path, data] of files) {
    const parts = path.split('/').filter(Boolean);
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur.children.has(parts[i])) {
        cur.children.set(parts[i], { name: parts[i], type: 1, children: new Map() });
      }
      cur = cur.children.get(parts[i]);
    }
    const leaf = parts[parts.length - 1];
    cur.children.set(leaf, { name: leaf, type: 0, data });
  }
  return root;
}
function flatten(root) {
  const out = [];
  function walk(node) {
    out.push(node);
    if (node.type === 1 && node.children) for (const c of node.children.values()) walk(c);
  }
  walk(root);
  return out;
}
function align(n) { return Math.ceil(n / ALIGN) * ALIGN; }
function pad(buf, n) {
  const a = align(buf.length);
  if (a === buf.length) return buf;
  const out = new Uint8Array(a);
  out.set(buf, 0);
  return out;
}
function concat(arrs) {
  const total = arrs.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}