import { RrPatchSet } from './mods/rr-patch.js';
import { SzsPatcher } from './disc/szs.js';
const MOD_ROOT = '/mods/retrorewind';
export async function collectModFiles(fileList) {
  const patch = new RrPatchSet();
  const szs = new SzsPatcher();
  const fullFiles = new Map();
  const injections = [];
  for (const f of fileList) {
    const rel = f.webkitRelativePath || f.name;
    const parts = rel.split('/');
    const localPath = parts.length > 1 ? parts.slice(1).join('/') : rel;
    const lastSeg = localPath.split('/').pop();
    const parsed = SzsPatcher.parsePatchName(lastSeg);
    if (parsed && localPath.includes('.')) {
      const data = new Uint8Array(await f.arrayBuffer());
      injections.push({ ...parsed, data, source: localPath });
      continue;
    }
    let fstPath = '/' + localPath.replace(/^files\//, '');
    const data = new Uint8Array(await f.arrayBuffer());
    fullFiles.set(fstPath, data);
  }
  return {
    patch,
    szs,
    fullFiles,
    injections,
    stats: { files: fullFiles.size, injections: injections.length },
  };
}
export function buildSzsPatcher(modInfo) {
  for (const inj of modInfo.injections) {
    modInfo.szs.addInjection(inj.archive, inj.internalPath, inj.data);
  }
  return modInfo.szs;
}