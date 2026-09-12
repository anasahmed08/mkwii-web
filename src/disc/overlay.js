// Mod overlay: intercepts reads that fall inside a replaced file's disc range.
export class DiscOverlay {
  constructor() { this.regions = []; }
  addRegion(discStart, discLength, data) {
    this.regions.push({ start: discStart, end: discStart + discLength, data });
    this.regions.sort((a, b) => a.start - b.start);
  }
  resolve(offset, length) {
    for (const r of this.regions) {
      if (offset >= r.start && offset + length <= r.end) {
        return r.data.subarray(offset - r.start, offset - r.start + length);
      }
    }
    return null;
  }
  clear() { this.regions = []; }
  get count() { return this.regions.length; }
}