const KEYMAP = {
  ArrowUp:'UP', ArrowDown:'DOWN', ArrowLeft:'LEFT', ArrowRight:'RIGHT',
  KeyW:'ACCEL', KeyS:'BRAKE', KeyA:'ITEM', KeyD:'DRIFT', Space:'JUMP',
  ShiftLeft:'DRIFT', KeyZ:'LOOK_BACK', Enter:'START', Escape:'HOME',
};
export function setupKeyboard(worker) {
  const held = new Set();
  window.addEventListener('keydown', (e) => {
    const b = KEYMAP[e.code]; if (!b || held.has(e.code)) return;
    held.add(e.code);
    worker.postMessage({ type: 'input', code: b, pressed: true });
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const b = KEYMAP[e.code]; if (!b) return;
    held.delete(e.code);
    worker.postMessage({ type: 'input', code: b, pressed: false });
    e.preventDefault();
  });
  window.addEventListener('blur', () => {
    for (const c of held) {
      const b = KEYMAP[c]; if (b) worker.postMessage({ type: 'input', code: b, pressed: false });
    }
    held.clear();
  });
}
export function setupTouchControls(container, worker) {
  const layout = [
    { id:'ACCEL', label:'A', pos:'right-bottom' },
    { id:'BRAKE', label:'B', pos:'right-top' },
    { id:'DRIFT', label:'R', pos:'right-mid' },
    { id:'ITEM',  label:'X', pos:'left-top' },
    { id:'LEFT',  label:'L', pos:'left-mid-l' },
    { id:'RIGHT', label:'R', pos:'left-mid-r' },
    { id:'JUMP',  label:'U', pos:'left-bottom' },
  ];
  const pad = document.createElement('div');
  pad.className = 'touch-pad';
  pad.innerHTML = `<style>
    .touch-pad{position:absolute;inset:0;pointer-events:none;z-index:15}
    .touch-btn{position:absolute;pointer-events:auto;width:72px;height:72px;border-radius:50%;
      background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.25);color:#fff;
      font-size:1.4rem;font-weight:700;display:flex;align-items:center;justify-content:center;
      backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);user-select:none;-webkit-user-select:none;
      touch-action:none}
    .touch-btn.pressed{background:rgba(255,71,87,.5)}
    .p-right-bottom{right:24px;bottom:32px}
    .p-right-top{right:24px;bottom:120px}
    .p-right-mid{right:110px;bottom:76px}
    .p-left-top{left:24px;top:80px}
    .p-left-mid-l{left:24px;bottom:120px}
    .p-left-mid-r{left:110px;bottom:76px}
    .p-left-bottom{left:24px;bottom:32px}
    @media(hover:hover) and (pointer:fine){.touch-pad{display:none}}
  </style>`;
  for (const b of layout) {
    const el = document.createElement('div');
    el.className = `touch-btn p-${b.pos}`;
    el.textContent = b.label;
    const press   = (ev) => { ev.preventDefault(); el.classList.add('pressed'); worker.postMessage({ type:'input', code:b.id, pressed:true }); };
    const release = (ev) => { ev.preventDefault(); el.classList.remove('pressed'); worker.postMessage({ type:'input', code:b.id, pressed:false }); };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release);
    pad.appendChild(el);
  }
  container.appendChild(pad);
}
export function setupGamepad(worker) {
  const state = {};
  function poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const prev = state[p.index] || {};
      const map = { 0:'ACCEL', 1:'BRAKE', 2:'ITEM', 3:'JUMP', 4:'LOOK_BACK', 5:'DRIFT', 12:'UP', 13:'DOWN', 14:'LEFT', 15:'RIGHT', 9:'START' };
      for (const [idx, name] of Object.entries(map)) {
        const pressed = p.buttons[idx]?.pressed || false;
        if (prev[name] !== pressed) { worker.postMessage({ type:'input', code:name, pressed }); prev[name] = pressed; }
      }
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0, dz = 0.4;
      const dirs = { LEFT: ax < -dz, RIGHT: ax > dz, UP: ay < -dz, DOWN: ay > dz };
      for (const [name, on] of Object.entries(dirs)) {
        if (prev['stick_' + name] !== on) { worker.postMessage({ type:'input', code:name, pressed:on }); prev['stick_' + name] = on; }
      }
      state[p.index] = prev;
    }
    requestAnimationFrame(poll);
  }
  poll();
}