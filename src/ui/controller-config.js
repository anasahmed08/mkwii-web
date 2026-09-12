export function mountControllerConfig(getWorker) {
  const root = document.createElement('div');
  root.id = 'controller-modal';
  root.className = 'modal hidden';
  root.innerHTML = `
    <div class="modal-inner">
      <h2>Controllers</h2>
      <p style="color:#888;font-size:.85rem;margin-bottom:1rem">Configure each Wii remote slot.</p>
      <div class="ports"></div>
      <div class="actions"><button data-act="close">Close</button></div>
    </div>
  `;
  document.body.appendChild(root);
  const state = JSON.parse(localStorage.getItem('mkwii-controllers') || 'null') || [
    { port: 0, type: 'keyboard' },
    { port: 1, type: 'none' },
    { port: 2, type: 'none' },
    { port: 3, type: 'none' },
  ];
  const portsRoot = root.querySelector('.ports');
  function render() {
    portsRoot.innerHTML = '';
    for (const p of state) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML =
        '<label>Port ' + (p.port + 1) + '</label>' +
        '<select data-port="' + p.port + '">' +
          '<option value="none"' + (p.type === 'none' ? ' selected' : '') + '>None</option>' +
          '<option value="keyboard"' + (p.type === 'keyboard' ? ' selected' : '') + '>Keyboard</option>' +
          '<option value="gamepad0"' + (p.type === 'gamepad0' ? ' selected' : '') + '>Gamepad 1</option>' +
          '<option value="gamepad1"' + (p.type === 'gamepad1' ? ' selected' : '') + '>Gamepad 2</option>' +
          '<option value="touch"' + (p.type === 'touch' ? ' selected' : '') + '>Touch (iPhone)</option>' +
        '</select>';
      portsRoot.appendChild(row);
    }
  }
  render();
  root.addEventListener('change', (e) => {
    const port = parseInt(e.target.dataset.port, 10);
    if (isNaN(port)) return;
    state[port].type = e.target.value;
    localStorage.setItem('mkwii-controllers', JSON.stringify(state));
    const worker = getWorker();
    if (worker) worker.postMessage({ type: 'controller-config', ports: state });
  });
  root.addEventListener('click', (e) => {
    if (e.target.dataset && e.target.dataset.act === 'close') root.classList.add('hidden');
  });
  return {
    open() { root.classList.remove('hidden'); },
    close() { root.classList.add('hidden'); },
  };
}