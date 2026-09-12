// Fetches the RWFC payload the manifest pins.
import fs from 'node:fs/promises';
import path from 'node:path';
const PAYLOAD_URL = 'https://rwfc.net/api/wfc/payload?g=RMCPD00';
const LEGACY_BOOTSTRAP_HOOK = 0x800ED6E8;
export async function fetchRetroWfcPayload(jobDir, log) {
  const outDir = path.join(jobDir, 'wfc');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'payload.bin');
  try {
    log('Fetching RWFC payload from ' + PAYLOAD_URL);
    const r = await fetch(PAYLOAD_URL, { redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = new Uint8Array(await r.arrayBuffer());
    await fs.writeFile(outPath, buf);
    log('RWFC payload ' + buf.length + ' bytes staged');
    return { path: outPath, size: buf.length, bootstrapHook: LEGACY_BOOTSTRAP_HOOK, url: PAYLOAD_URL };
  } catch (e) {
    log('RWFC payload fetch failed (' + e.message + '); online play will require runtime fetch');
    return { path: null, size: 0, bootstrapHook: LEGACY_BOOTSTRAP_HOOK, url: PAYLOAD_URL };
  }
}