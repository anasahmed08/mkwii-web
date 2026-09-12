// Audit translator-emitted C++ for non-portable constructs.
import fs from 'node:fs/promises';
import path from 'node:path';
const PATTERNS = [
  { re: /\b__asm\b|\basm\s*\(/, name: 'inline-asm', fatal: true },
  { re: /\b__builtin_ia32_\w+/, name: 'x86-builtin', fatal: true },
  { re: /\b_mm\d*_\w+|\b__m\d+\b/, name: 'sse-intrinsic', fatal: true },
  { re: /\b__builtin_arm_\w+/, name: 'arm-builtin', fatal: true },
  { re: /\b__rdtsc\b|\b__cpuid\b/, name: 'x86-syscall', fatal: true },
  { re: /reinterpret_cast<\s*\w+\s*\*>\s*\(\s*0x[0-9a-fA-F]+\s*\)/, name: 'hardcoded-pointer', fatal: false },
  { re: /\bVirtualAlloc\b|\bVirtualProtect\b/, name: 'win32-mem', fatal: true },
  { re: /\bmprotect\b|\bmmap\b/, name: 'posix-mem', fatal: true },
  { re: /#include\s*<immintrin\.h>/, name: 'immintrin', fatal: true },
  { re: /#include\s*<x86intrin\.h>/, name: 'x86intrin', fatal: true },
  { re: /\b__declspec\b/, name: 'msvc-declspec', fatal: true },
];
export async function auditEmitter(rootDir) {
  const files = [];
  await walk(rootDir, files);
  const findings = [];
  let scanned = 0;
  for (const f of files) {
    if (!/\.(cpp|cc|cxx|c|h|hpp)$/.test(f)) continue;
    scanned++;
    const src = await fs.readFile(f, 'utf8');
    for (const p of PATTERNS) {
      let m;
      p.re.lastIndex = 0;
      while ((m = p.re.exec(src))) {
        const line = src.slice(0, m.index).split('\n').length;
        findings.push({
          file: path.relative(rootDir, f),
          line,
          kind: p.name,
          fatal: p.fatal,
          snippet: src.slice(Math.max(0, m.index - 40), m.index + 80).replace(/\n/g, ' '),
        });
        if (findings.length > 500) break;
      }
    }
  }
  const fatals = findings.filter((f) => f.fatal);
  return { scanned, findings, fatalCount: fatals.length, ok: fatals.length === 0 };
}
async function walk(dir, out) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['.git', 'bin', 'obj', 'node_modules', 'build-wasm'].includes(e.name)) continue;
      await walk(p, out);
    } else {
      out.push(p);
    }
  }
}
if (import.meta.url === 'file://' + process.argv[1]) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: audit-emitter.mjs <dir>'); process.exit(2); }
  const r = await auditEmitter(dir);
  console.log('Scanned ' + r.scanned + ' files, ' + r.findings.length + ' findings, ' + r.fatalCount + ' fatal');
  for (const f of r.findings.slice(0, 50)) {
    console.log('  ' + (f.fatal ? 'FATAL' : 'warn ') + '  ' + f.file + ':' + f.line + '  [' + f.kind + ']  ' + f.snippet);
  }
  process.exit(r.ok ? 0 : 1);
}