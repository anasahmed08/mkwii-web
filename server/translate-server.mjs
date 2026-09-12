// WiiCompiled translation service.
//
// Pipeline:
//   translate-recursive  --project recomp.yml
//   translate-mod        --project recomp.yml --profile retro-rewind
//   generate-data-init   --project recomp.yml
//   emit-build-shards    --project recomp.yml
//   emcmake + ninja (wasm64)
import express from 'express';
import multer from 'multer';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { BuildCache } from './build-cache.mjs';
import { auditEmitter } from './audit-emitter.mjs';
import { stageDiscAssets } from './disc-stage.mjs';
import { fetchRetroWfcPayload } from './retro-wfc.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const WORK = process.env.WORK_DIR || path.join(ROOT, 'server', 'work');
const WIICOMPILED = process.env.WIICOMPILED_DIR || path.join(ROOT, 'vendor', 'wiicompiled');
const AURORA = process.env.AURORA_DIR || path.join(ROOT, 'vendor', 'aurora');
const DOTNET = process.env.DOTNET_BIN || 'dotnet';
const EMCMAKE = process.env.EMCMAKE_BIN || 'emcmake';
const PUBLIC_OUT = process.env.PUBLIC_OUT || path.join(ROOT, 'public', 'wasm');
const TRANSLATOR_DLL = process.env.TRANSLATOR_DLL ||
  path.join(WIICOMPILED, 'translator', 'src', 'Translator.Cli', 'bin', 'Release', 'net8.0', 'Translator.Cli.dll');
const app = express();
const upload = multer({ dest: path.join(WORK, 'uploads'), limits: { fileSize: 8 * 1024 * 1024 * 1024 } });
await fs.mkdir(path.join(WORK, 'uploads'), { recursive: true });
await fs.mkdir(path.join(WORK, 'jobs'), { recursive: true });
await fs.mkdir(PUBLIC_OUT, { recursive: true });
const cache = new BuildCache(path.join(WORK, 'cache'));
await cache.init();
const jobs = new Map();
const discCache = new Map(); // size -> { id, result }
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
app.use('/static', (req, res, next) => {
  if (req.path.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
  next();
});
app.use('/static', express.static(PUBLIC_OUT));
app.get('/api/health', async (_req, res) => {
  const checks = {
    translatorDll: fss.existsSync(TRANSLATOR_DLL),
    wiicompiledDir: fss.existsSync(WIICOMPILED),
    auroraDir: fss.existsSync(AURORA),
    manifest: fss.existsSync(path.join(WIICOMPILED, 'projects', 'mkwii', 'recomp.yml')),
    functionMap: fss.existsSync(path.join(WIICOMPILED, 'projects', 'mkwii', 'MAP.txt')),
    dotnet: await which(DOTNET),
    emcmake: await which(EMCMAKE),
  };
  const ok = Object.values(checks).every(Boolean);
  res.status(ok ? 200 : 503).json({ ok, checks });
});
app.post('/api/translate-path', express.json(), async (req, res) => {
  const srcPath = req.body && req.body.path;
  if (!srcPath) return res.status(400).json({ error: 'missing path' });
  if (!fss.existsSync(srcPath)) return res.status(400).json({ error: 'file not found: ' + srcPath });
  const id = randomUUID();
  const jobDir = path.join(WORK, 'jobs', id);
  await fs.mkdir(jobDir, { recursive: true });
  const isoPath = path.join(jobDir, 'game.iso');
  // Hardlink when possible; copy fallback.
  try { await fs.link(srcPath, isoPath); }
  catch { await fs.copyFile(srcPath, isoPath); }
  const job = {
    id, status: 'queued', stage: 'queued', progress: 0, log: [],
    createdAt: Date.now(), isoPath, jobDir, result: null, error: null, clients: new Set(),
  };
  jobs.set(id, job);
  runTranslation(job).catch((err) => {
    job.status = 'failed';
    job.error = err.message;
    broadcast(job, { type: 'error', error: err.message });
  });
  res.json({ id });
});
app.post('/api/translate', upload.single('iso'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'missing iso' });
  const id = randomUUID();
  const jobDir = path.join(WORK, 'jobs', id);
  await fs.mkdir(jobDir, { recursive: true });
  const isoPath = path.join(jobDir, 'game.iso');
  await fs.rename(req.file.path, isoPath);
  const job = {
    id, status: 'queued', stage: 'queued', progress: 0, log: [],
    createdAt: Date.now(), isoPath, jobDir, result: null, error: null, clients: new Set(),
  };
  jobs.set(id, job);
  runTranslation(job).catch((err) => {
    job.status = 'failed';
    job.error = err.message;
    broadcast(job, { type: 'error', error: err.message });
  });
  res.json({ id });
});
app.get('/api/translate/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'unknown job' });
  res.json({
    id: job.id, status: job.status, stage: job.stage,
    progress: job.progress, result: job.result, error: job.error,
  });
});
app.get('/api/translate/:id/log', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'unknown job' });
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  for (const line of job.log) res.write('data: ' + JSON.stringify({ type: 'log', line }) + '\n\n');
  res.write('data: ' + JSON.stringify({ type: 'state', status: job.status, stage: job.stage, progress: job.progress }) + '\n\n');
  const send = (msg) => res.write('data: ' + JSON.stringify(msg) + '\n\n');
  job.clients.add(send);
  req.on('close', () => job.clients.delete(send));
});
function broadcast(job, msg) { for (const c of job.clients) { try { c(msg); } catch {} } }
function setStage(job, stage, progress) {
  job.stage = stage;
  if (typeof progress === 'number') job.progress = progress;
  broadcast(job, { type: 'state', status: job.status, stage, progress: job.progress });
}
function log(job, line) {
  job.log.push(line);
  if (job.log.length > 4000) job.log.shift();
  broadcast(job, { type: 'log', line });
}
async function runTranslation(job) {
  job.status = 'running';
  setStage(job, 'staging', 0);
  log(job, '[' + job.id + '] WiiCompiled translation started');
  try {
    setStage(job, 'staging', 0.01);
    const staged = await stageDiscAssets(job.isoPath, job.jobDir, (m) => log(job, m));
    setStage(job, 'manifest', 0.03);
    await stageManifest(job, log);
    const rwfc = await fetchRetroWfcPayload(job.jobDir, (m) => log(job, m));
    setStage(job, 'cache-lookup', 0.04);
    const dolHash = await cache.dolHash(staged.dolPath);
    const cacheKey = await cache.key({
      dolHash, wiicompiledDir: WIICOMPILED, auroraDir: AURORA,
      emsdkVersion: process.env.EMSDK_VERSION || '',
    });
    log(job, 'cache key=' + cacheKey);
    const cached = await cache.lookup(cacheKey);
    if (cached.hit) {
      log(job, 'Cache HIT');
      setStage(job, 'cache-hit', 0.9);
      await packageArtifacts(job, cached.dir);
      await cleanup(job);
      finish(job);
      return;
    }
    const manifestPath = path.join(job.jobDir, 'projects', 'mkwii', 'recomp.yml');
    setStage(job, 'translate-recursive', 0.05);
    await runTranslator(job, ['translate-recursive', '--project', manifestPath], 0.05, 0.35);
    setStage(job, 'translate-mod', 0.35);
    await runTranslator(job, ['translate-mod', '--project', manifestPath, '--profile', 'retro-rewind'], 0.35, 0.44);
    setStage(job, 'generate-data-init', 0.44);
    await runTranslator(job, ['generate-data-init', '--project', manifestPath], 0.44, 0.48);
    setStage(job, 'emit-build-shards', 0.48);
    await runTranslator(job, ['emit-build-shards', '--project', manifestPath], 0.48, 0.52);
    setStage(job, 'auditing', 0.52);
    log(job, 'Auditing emitted C++ for non-portable constructs...');
    const audit = await auditEmitter(path.join(job.jobDir, 'generated'));
    log(job, 'Audit: ' + audit.scanned + ' files, ' + audit.findings.length + ' findings, ' + audit.fatalCount + ' fatal');
    for (const f of audit.findings.slice(0, 40)) {
      log(job, '  ' + (f.fatal ? 'FATAL' : 'warn') + '  ' + f.file + ':' + f.line + '  [' + f.kind + ']');
    }
    if (!audit.ok) {
      throw new Error(
        audit.fatalCount + ' non-portable construct(s) in generated C++. ' +
        'Apply docs/EMITTER-CHANGES.md to Translator.Emit.'
      );
    }
    setStage(job, 'configuring', 0.54);
    const buildDir = path.join(job.jobDir, 'build-wasm');
    await fs.mkdir(buildDir, { recursive: true });
    await run(job, EMCMAKE, [
      'cmake', '-G', 'Ninja',
      '-DCMAKE_BUILD_TYPE=Release',
      '-DCMAKE_CXX_FLAGS_RELEASE=-O2 -DNDEBUG',
      '-DAURORA_SOURCE_DIR=' + AURORA,
      '-DWIICOMPILED_DIR=' + WIICOMPILED,
      '-DWIICOMPILED_WORKSPACE=' + job.jobDir,
      '-DWII_RECOMP_RUNTIME_DIR=' + path.join(WIICOMPILED, 'runtime'),
      '-DWII_RECOMP_WASM64=ON',
      '-DWII_RECOMP_PROFILE=retro-rewind',
      rwfc.path ? '-DWII_RECOMP_RWFC_PAYLOAD=' + rwfc.path : '-DWII_RECOMP_RWFC_PAYLOAD=',
      '-S', path.join(__dirname, '..', 'wasm', 'project'),
      '-B', buildDir,
    ], 0.54, 0.58);
    setStage(job, 'compiling', 0.58);
    const j = Math.max(1, os.cpus().length);
    await run(job, 'cmake', ['--build', buildDir, '--target', 'mkwii_recomp', '-j', String(j)], 0.58, 0.94);
    setStage(job, 'packaging', 0.94);
    const outDir = path.join(PUBLIC_OUT, job.id);
    await fs.mkdir(outDir, { recursive: true });
    for (const n of ['mkwii_recomp.js', 'mkwii_recomp.wasm']) {
      const src = path.join(buildDir, n);
      if (fss.existsSync(src)) await fs.copyFile(src, path.join(outDir, n));
    }
    await cache.store(cacheKey, buildDir);
    log(job, 'Cached as ' + cacheKey);
    await cleanup(job);
    finish(job);
  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    log(job, 'FAILED: ' + err.message);
    broadcast(job, { type: 'error', error: err.message });
  }
}
async function stageManifest(job, log) {
  const srcRoot = path.join(WIICOMPILED, 'projects', 'mkwii');
  const dstRoot = path.join(job.jobDir, 'projects', 'mkwii');
  await fs.mkdir(dstRoot, { recursive: true });
  for (const f of ['recomp.yml', 'MAP.txt']) {
    const s = path.join(srcRoot, f);
    const d = path.join(dstRoot, f);
    if (!fss.existsSync(s)) throw new Error('missing vendor file: ' + s);
    await fs.copyFile(s, d);
  }
  log('Manifest + function map staged from vendor/wiicompiled');
}
async function packageArtifacts(job, srcDir) {
  const outDir = path.join(PUBLIC_OUT, job.id);
  await fs.mkdir(outDir, { recursive: true });
  for (const n of ['mkwii_recomp.js', 'mkwii_recomp.wasm']) {
    const src = path.join(srcDir, n);
    if (fss.existsSync(src)) await fs.copyFile(src, path.join(outDir, n));
  }
}
async function cleanup(job) {
  await fs.rm(job.isoPath, { force: true });
  await fs.rm(job.jobDir, { recursive: true, force: true });
}
function finish(job) {
  job.result = {
    wasmUrl: '/static/' + job.id + '/mkwii_recomp.wasm',
    jsUrl: '/static/' + job.id + '/mkwii_recomp.js',
  };
  job.status = 'done';
  setStage(job, 'done', 1);
  broadcast(job, { type: 'done', result: job.result });
}
async function runTranslator(job, args, p0, p1) {
  if (!fss.existsSync(TRANSLATOR_DLL)) {
    throw new Error('Translator not built: ' + TRANSLATOR_DLL + '\nRun: npm run setup');
  }
  return run(job, DOTNET, [TRANSLATOR_DLL, ...args], p0, p1);
}
function run(job, cmd, args, p0 = 0, p1 = 1) {
  return new Promise((resolve, reject) => {
    log(job, '$ ' + cmd + ' ' + args.join(' '));
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let lines = 0;
    const tick = () => { lines++; setStage(job, job.stage, p0 + (p1 - p0) * Math.min(0.95, lines / 4000)); };
    child.stdout.on('data', (b) => { for (const l of b.toString().split(/\r?\n/)) if (l) { log(job, l); tick(); } });
    child.stderr.on('data', (b) => { for (const l of b.toString().split(/\r?\n/)) if (l) { log(job, l); tick(); } });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) { setStage(job, job.stage, p1); resolve(); }
      else reject(new Error(cmd + ' exited ' + code));
    });
  });
}
async function which(cmd) {
  return new Promise((res) => {
    const c = spawn('which', [cmd]);
    c.on('exit', (code) => res(code === 0));
    c.on('error', () => res(false));
  });
}
const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log('WiiCompiled translation service on :' + PORT);
  console.log('  translator: ' + TRANSLATOR_DLL);
  console.log('  manifest:   ' + path.join(WIICOMPILED, 'projects', 'mkwii', 'recomp.yml'));
  console.log('  health:     http://localhost:' + PORT + '/api/health');
});