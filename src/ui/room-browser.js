import { RetroWfcClient } from '../retrowfc/client.js';
export function mountRoomBrowser() {
  const client = new RetroWfcClient();
  const root = document.createElement('div');
  root.id = 'rooms-modal';
  root.className = 'modal hidden';
  root.innerHTML = `
    <div class="modal-inner">
      <h2>Retro WFC Rooms</h2>
      <div class="rooms-status" id="rooms-status">Loading...</div>
      <div class="rooms-list" id="rooms-list"></div>
      <div class="actions">
        <button data-act="refresh">Refresh</button>
        <button data-act="close">Close</button>
      </div>
    </div>
    <style>
      .rooms-list { display: flex; flex-direction: column; gap: 0.5rem;
        max-height: 50vh; overflow-y: auto; margin-top: 1rem; }
      .room { display: flex; justify-content: space-between; align-items: center;
        padding: 0.7rem 0.9rem; background: #1a1a24; border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.06); }
      .room .name { font-weight: 600; font-size: 0.9rem; }
      .room .meta { font-size: 0.75rem; color: #888; margin-top: 0.15rem; }
      .room .count { font-size: 0.85rem; color: #2ed573; font-weight: 700; }
      .rooms-status { font-size: 0.85rem; color: #888; padding: 0.5rem 0;
        border-bottom: 1px solid rgba(255,255,255,0.06); }
      .rooms-status.ok { color: #2ed573; }
      .rooms-status.err { color: #ff4757; }
    </style>
  `;
  document.body.appendChild(root);
  const statusEl = root.querySelector('#rooms-status');
  const listEl = root.querySelector('#rooms-list');
  async function refresh() {
    statusEl.textContent = 'Querying RWFC...';
    statusEl.className = 'rooms-status';
    const st = await client.status();
    if (!st.online) {
      statusEl.textContent = 'RWFC unreachable: ' + (st.error || 'offline');
      statusEl.className = 'rooms-status err';
      listEl.innerHTML = '<div style="color:#666;text-align:center;padding:1rem">Offline</div>';
      return;
    }
    statusEl.textContent = 'RWFC online - ' + (st.players || 0) + ' players in ' + (st.rooms || 0) + ' rooms';
    statusEl.className = 'rooms-status ok';
    const rooms = await client.rooms();
    listEl.innerHTML = '';
    for (const r of rooms.rooms || []) {
      const el = document.createElement('div');
      el.className = 'room';
      el.innerHTML =
        '<div><div class="name">' + escapeHtml(r.name || r.id || 'Room') + '</div>' +
        '<div class="meta">' + escapeHtml(r.track || '-') + '</div></div>' +
        '<span class="count">' + (r.players || 0) + '/' + (r.max || 12) + '</span>';
      listEl.appendChild(el);
    }
    if (!rooms.rooms || !rooms.rooms.length) {
      listEl.innerHTML = '<div style="color:#666;text-align:center;padding:1rem">No active rooms</div>';
    }
  }
  root.addEventListener('click', (e) => {
    const act = e.target.dataset && e.target.dataset.act;
    if (act === 'close') root.classList.add('hidden');
    else if (act === 'refresh') refresh();
  });
  return {
    open() { root.classList.remove('hidden'); refresh(); },
    close() { root.classList.add('hidden'); },
  };
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}