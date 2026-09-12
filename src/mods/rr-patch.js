// WheelWizard / Retro Rewind patch parser.
// Handles Riivolution XML plus literal files/ overlays.
export class RrPatchSet {
  constructor() {
    this.replacements = new Map();
    this.xmlMappings = [];
  }
  async addFiles(fileList) {
    const xmlFiles = [];
    const dataFiles = [];
    for (const f of fileList) {
      const rel = f.webkitRelativePath || f.name;
      if (rel.toLowerCase().endsWith('.xml')) xmlFiles.push({ rel, file: f });
      else dataFiles.push({ rel, file: f });
    }
    for (const x of xmlFiles) {
      try {
        const text = await x.file.text();
        this.parseRiivolution(text, x.rel);
      } catch (e) {
        console.warn('[rr] bad xml', x.rel, e);
      }
    }
    for (const d of dataFiles) {
      const fstPath = normalisePath(d.rel);
      if (!fstPath) continue;
      const data = new Uint8Array(await d.file.arrayBuffer());
      this.replacements.set(fstPath, { data });
    }
    return {
      files: this.replacements.size,
      xmlMappings: this.xmlMappings.length,
    };
  }
  parseRiivolution(xmlText, source) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('invalid XML');
    for (const el of doc.querySelectorAll('file')) {
      const disc = el.getAttribute('disc');
      const external = el.getAttribute('external');
      if (disc && external) {
        this.xmlMappings.push({
          disc: normalisePath(disc),
          external: external.replace(/^\/file\//i, ''),
          source,
        });
      }
    }
  }
  resolveXmlMappings() {
    for (const m of this.xmlMappings) {
      if (!m.disc) continue;
      for (const [p, r] of this.replacements) {
        if (p.endsWith(m.external) || p.endsWith('/' + m.external)) {
          this.replacements.set(m.disc, r);
          break;
        }
      }
    }
  }
}
function normalisePath(rel) {
  let p = rel.replace(/\\/g, '/');
  const parts = p.split('/');
  if (parts.length > 1) parts.shift();
  p = parts.join('/');
  p = p.replace(/^files\//i, '');
  p = p.replace(/^riivolution\//i, '');
  if (!p) return '';
  return '/' + p.replace(/^\//, '');
}