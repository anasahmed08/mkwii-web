// Replicates WheelWizard's launch-time hostname redirection.
const RWFC_HOSTS = {
  'nas.nintendowifi.net': 'nas.rwfc.net',
  'gpcm.gs.nintendowifi.net': 'gpcm.rwfc.net',
  'gpsp.gs.nintendowifi.net': 'gpsp.rwfc.net',
  'dls.nintendowifi.net': 'dls.rwfc.net',
  'mariokartwii.race.gs.nintendowifi.net': 'race.rwfc.net',
  'mariokartwii.natneg1.gs.nintendowifi.net': 'natneg.rwfc.net',
};
const RWFC_PORTS = { nas: 29900, gpcm: 29901, gpsp: 29920, dls: 28910 };
export class LaunchPatcher {
  constructor(worker) {
    this.worker = worker;
    this.hostMap = { ...RWFC_HOSTS };
    this.enabled = false;
  }
  enable() {
    this.enabled = true;
    this.worker.postMessage({
      type: 'network-patch',
      hostMap: this.hostMap,
      ports: RWFC_PORTS,
    });
  }
  disable() {
    this.enabled = false;
    this.worker.postMessage({ type: 'network-patch', hostMap: {}, ports: {} });
  }
  resolve(hostname) {
    if (!this.enabled) return hostname;
    return this.hostMap[hostname] || hostname;
  }
  portFor(service) { return RWFC_PORTS[service] || 0; }
}