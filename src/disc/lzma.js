// LZMA decoder for RVZ chunks, loaded from CDN on demand.
let _lzmaModule = null;
async function loadLzma() {
  if (_lzmaModule) return _lzmaModule;
  await import('https://cdn.jsdelivr.net/npm/lzma@2.3.2/src/lzma_worker-min.js');
  _lzmaModule = self.LZMA || (self.LZMA_WORKER && self.LZMA_WORKER.LZMA);
  if (!_lzmaModule) throw new Error('LZMA-JS failed to load');
  return _lzmaModule;
}
export async function decompressLzma(src, expectedSize) {
  const LZMA = await loadLzma();
  const bytes = src instanceof Uint8Array ? src : new Uint8Array(src);
  return new Promise((resolve, reject) => {
    LZMA.decompress(Array.from(bytes), (result, error) => {
      if (error) return reject(new Error(String(error)));
      const out = new Uint8Array(result);
      if (expectedSize && out.length !== expectedSize) {
        return reject(new Error('LZMA size mismatch: ' + out.length + ' != ' + expectedSize));
      }
      resolve(out);
    });
  });
}
export async function decompressRvzLzma(src, expectedSize) {
  if (src.length < 1) throw new Error('LZMA chunk too short');
  return decompressLzma(src.subarray(1), expectedSize);
}