// Stage-0 WFC patch: rewrites the DOL's NAS URLs to RWFC.
// Complements the runtime hooks in wasm/runtime/dol-hook.cpp.
import { DolFile } from './dol.js';
export class Stage0Patcher {
  constructor() { this.patches = []; }
  apply(dolBuffer, opts = {}) {
    const dol = new DolFile(dolBuffer);
    const nasHost = opts.nasHost || 'nas.rwfc.net';
    const rwfcHost = opts.rwfcHost || 'rwfc.net';
    const log = [];
    const urlPairs = [
      ['naswii.nintendowifi.net', nasHost],
      ['https://naswii.nintendowifi.net', 'https://' + nasHost],
      ['nintendowifi.net', rwfcHost],
    ];
    for (const [from, to] of urlPairs) {
      try {
        if (dol.replaceString(from, to)) log.push('url: ' + from + ' -> ' + to);
      } catch (e) {
        log.push('url skip: ' + from + ' (' + e.message + ')');
      }
    }
    const avail = dol.findString('available.gs.nintendowifi.net');
    if (avail >= 0) {
      try {
        dol.replaceString('available.gs.nintendowifi.net', 'available.gs.' + rwfcHost);
        log.push('available URL redirected');
      } catch (e) {
        log.push('available skip: ' + e.message);
      }
    }
    this.patches = log;
    return { buffer: dol.buf, log, dol };
  }
  runtimeHooks() {
    return [
      { symbol: 'DWCi_Auth_HandleResponse', action: 'return-success',
        instructions: [0x38600000, 0x4E800020] },
      { symbol: 'GSIStartAvailableCheckA', action: 'skip' },
    ];
  }
}