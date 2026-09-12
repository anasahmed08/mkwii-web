// Extracts main.dol and StaticR.rel, hash-checks against the manifest pins.
// Reads slices directly from the file handle — never loads the whole disc.
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const EXPECTED = {
  dol: { sha256: '80d18895b39c63bd80f457398bfcbb91b7d16ac116a41a88967e954080155b05', name: 'main.dol' },
  rel: { sha256: '16d9d146112541fefea701ecb5bc1a496f9d50e4a752fbb5b6778e7c6399f67d', name: 'StaticR.rel' },
};
const REL_CANDIDATES = [
  '/rel/StaticR.rel',
  '/files/rel/StaticR.rel',
  '/StaticR.rel',
];
function fileShim(filePath) {
  const size = fss.statSync(filePath).size;
  return {
    size,
    slice: (start, end) => ({
      arrayBuffer: async () => {
        const fh = await fs.open(filePath, 'r');
        try {
          const len = end - start;
          const buf = Buffer.alloc(len);
          await fh.read(buf, 0, len, start);
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        } finally {
          await fh.close();
        }
      },
    }),
  };
}
export async function stageDiscAssets(isoPath, jobDir, log) {
  const { WiiDisc } = await import('../src/disc/wii-disc.js');
  const { RvzReader } = await import('../src/disc/rvz.js');
  const { WbfsReader } = await import('../src/disc/wbfs.js');
  const file = fileShim(isoPath);
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const magic = new DataView(head.buffer).getUint32(0, false);
  let source = file;
  let kind = 'iso';
  if (magic === 0x52565a01 || magic === 0x57494101) {
    const rvz = new RvzReader(file);
    await rvz.init();
    source = { size: rvz.size, slice: (a, b) => ({ arrayBuffer: async () => (await rvz.slice(a, b)).buffer }) };
    kind = 'rvz';
  } else if (magic === 0x57424653) {
    const wbfs = new WbfsReader(file);
    await wbfs.init();
    source = { size: wbfs.size, slice: (a, b) => ({ arrayBuffer: async () => (await wbfs.slice(a, b)).buffer }) };
    kind = 'wbfs';
  }
  const disc = await new WiiDisc(source).init();
  log('Disc: ' + disc.gameId + ' "' + disc.title + '" (' + kind + ')');
  if (disc.gameId !== 'RMCP01') {
    throw new Error('recomp.yml requires RMCP01; disc reports ' + disc.gameId);
  }
  const assetsDir = path.join(jobDir, 'Assets');
  await fs.mkdir(assetsDir, { recursive: true });
  const dol = await disc.readFile('/main.dol');
  const dolSha = sha256(dol);
  if (dolSha !== EXPECTED.dol.sha256) {
    throw new Error(
      'main.dol sha256 mismatch\n  expected ' + EXPECTED.dol.sha256 + '\n  got      ' + dolSha
    );
  }
  const dolPath = path.join(assetsDir, 'main.dol');
  await fs.writeFile(dolPath, dol);
  log('main.dol ' + dol.length + ' bytes, sha256 verified');
  let rel = null;
  let relPathUsed = null;
  for (const cand of REL_CANDIDATES) {
    try { rel = await disc.readFile(cand); relPathUsed = cand; break; }
    catch { /* try next */ }
  }
  if (!rel) throw new Error('StaticR.rel not found; tried ' + REL_CANDIDATES.join(', '));
  const relSha = sha256(rel);
  if (relSha !== EXPECTED.rel.sha256) {
    throw new Error('StaticR.rel sha256 mismatch\n  expected ' + EXPECTED.rel.sha256 + '\n  got      ' + relSha);
  }
  const relPath = path.join(assetsDir, 'StaticR.rel');
  await fs.writeFile(relPath, rel);
  log('StaticR.rel ' + rel.length + ' bytes (from ' + relPathUsed + '), sha256 verified');
  return { dolPath, relPath, disc };
}
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}