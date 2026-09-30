/* Cloud shadow theater: drag cloud pieces across the moon to make a shadow
   picture. When it's complete, the shadow comes alive as a tiny scene. */
window.SHADOWS = (() => {
  'use strict';
  const C = window.KAMY;
  const SH = C.shadows || {};
  const W = 160, H = 200, MX = 80, MY = 76, MR = 54, SNAP = 7;
  const real = s => (typeof s === 'string' && !s.includes('[REPLACE') ? s : '');

  /* ---- Piece shapes (masks of filled pixels) ---------------------------- */
  function fromRows(rows, k = 1) {
    const px = [];
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) px.push([x * k + a, y * k + b]); }));
    return { px, w: Math.max(...rows.map(r => r.length)) * k, h: rows.length * k };
  }
  function trapezoid(top, bot, h) {
    const rows = [];
    for (let y = 0; y < h; y++) {
      const w = Math.round(top + (bot - top) * y / (h - 1)), pad = Math.round((top - w) / 2);
      rows.push('.'.repeat(pad) + 'o'.repeat(w) + '.'.repeat(Math.max(0, top - w - pad)));
    }
    rows[h - 1] = rows[h - 1].replace(/^\.o/, '..').replace(/o\.$/, '..');
    return fromRows(rows);
  }
  function ellipse(w, h) {
    const rows = [];
    for (let y = 0; y < h; y++) {
      let r = '';
      for (let x = 0; x < w; x++) r += ((x + 0.5 - w / 2) / (w / 2)) ** 2 + ((y + 0.5 - h / 2) / (h / 2)) ** 2 <= 1 ? 'o' : '.';
      rows.push(r);
    }
    return fromRows(rows);
  }
  const FRIEND_ROWS = ['..kkk.....kkk..', '.kkkk....kkkk..', '.kkkk....kkkk..', '..kk.....kkkk..', '.kkkkk..kkkkk..', 'kkkkkk..kkkkkk.', 'kkkkkk..kkkkkk.', 'kkkkkk..kkkkkk.', 'kkkkkk..kkkkkk.'];

  // each scene: pieces with a target spot (top-left, relative to the moon's centre)
  const SCENES = [
    { key: 'cup', pieces: [
      { m: trapezoid(22, 16, 18), tx: -13, ty: -12 },
      { m: fromRows(['ooo.', '...o', '...o', 'ooo.'], 2), tx: 7, ty: -9 },
      { m: ellipse(34, 5), tx: -17, ty: 6 }
    ] },
    { key: 'cat', pieces: [
      { m: fromRows(['o.......o', 'oo.....oo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', '.ooooooo.', '..ooooo..'], 2), tx: -11, ty: -22 },
      { m: ellipse(20, 22), tx: -12, ty: -8 },
      { m: fromRows(['......oo', '.......o', '.......o', '......oo', '....ooo.', 'oooooo..'], 2), tx: 4, ty: 2 }
    ] },
    { key: 'us', pieces: [
      { m: fromRows(FRIEND_ROWS.map(r => r.slice(0, 7)), 2), tx: -15, ty: -6 },
      { m: fromRows(FRIEND_ROWS.map(r => r.slice(7)), 2), tx: -1, ty: -6 },
      { m: fromRows(['.oo.oo.', 'ooooooo', 'ooooooo', '.ooooo.', '..ooo..', '...o...'], 2), tx: -7, ty: -26 }
    ] }
  ];
  SCENES.forEach(sc => sc.pieces.forEach(p => { p.set = new Set(p.m.px.map(([x, y]) => x + ',' + y)); }));

  const stars = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * 9 }));
  let api = null, s = null;

  function start(a) {
    api = a;
    s = null;
    api.show([
      api.el('h3', 'game-title', SH.title || 'cloud shadow theater'),
      api.el('p', 'line', SH.intro || ''),
      api.button('start', () => begin(0))
    ]);
  }

  function begin(i) {
    api.hideScreen();
    const sc = SCENES[i];
    // scatter the clouds along the bottom
    const slots = [[8, 150], [60, 168], [108, 148]];
    s = {
      i, sc, t: 0, phase: 'play', drag: null, doneT: 0,
      pieces: sc.pieces.map((p, k) => ({ ...p, x: slots[k][0] + (k === 1 ? 0 : Math.random() * 6), y: slots[k][1], locked: false }))
    };
    api.setHud(`${i + 1}/${SCENES.length}`);
  }

  const inMoon = (x, y) => (x - MX) ** 2 + (y - MY) ** 2 < MR * MR;
  const hitPiece = (p, x, y) => {
    const lx = Math.floor(x - p.x), ly = Math.floor(y - p.y);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (p.set.has((lx + a) + ',' + (ly + b))) return true;
    return false;
  };

  function pointer(type, pt) {
    if (!s || api.screenOpen() || s.phase !== 'play') return;
    if (type === 'down') {
      for (let k = s.pieces.length - 1; k >= 0; k--) {
        const p = s.pieces[k];
        if (!p.locked && hitPiece(p, pt.x, pt.y)) {
          s.drag = { p, dx: pt.x - p.x, dy: pt.y - p.y };
          s.pieces.splice(k, 1); s.pieces.push(p); // bring to front
          api.sfx('blip');
          return;
        }
      }
    } else if (type === 'move' && s.drag) {
      s.drag.p.x = Math.max(-10, Math.min(W - 8, pt.x - s.drag.dx));
      s.drag.p.y = Math.max(-10, Math.min(H - 8, pt.y - s.drag.dy));
    } else if ((type === 'up' || type === 'cancel') && s.drag) {
      const p = s.drag.p;
      s.drag = null;
      if (Math.hypot(p.x - (MX + p.tx), p.y - (MY + p.ty)) < SNAP) {
        p.x = MX + p.tx; p.y = MY + p.ty; p.locked = true;
        api.sfx('pickup');
        if (s.pieces.every(q => q.locked)) complete();
      }
    }
  }

  function complete() {
    s.phase = 'scene';
    s.doneT = s.t;
    api.sfx('wish');
    const info = (SH.scenes || [])[s.i] || {};
    setTimeout(() => {
      if (!s || s.phase !== 'scene') return;
      const cap = api.el('p', 'win-note', '');
      const last = s.i >= SCENES.length - 1;
      api.showSoft([
        api.el('h3', 'game-title', info.title || ''),
        cap,
        last ? api.button('back to the field', () => api.close({ complete: true }))
             : api.button('next', () => begin(s.i + 1))
      ]);
      api.typeInto(cap, real(info.caption) || (last ? (SH.doneLine || '') : ''));
    }, 2600);
  }

  /* ---- Drawing ---------------------------------------------------------- */
  function drawMask(g, p, ox, oy, shadowOnly) {
    for (const [x, y] of p.m.px) {
      const wx = Math.round(ox + x), wy = Math.round(oy + y);
      if (inMoon(wx, wy)) { g.fillStyle = '#141024'; g.fillRect(wx, wy, 1, 1); }
      else if (!shadowOnly) {
        g.fillStyle = p.set.has(x + ',' + (y - 1)) ? '#6d63b0' : '#a79fe3';
        g.fillRect(wx, wy, 1, 1);
      }
    }
  }

  function render(g) {
    ['#060819', '#0b0e2c', '#12153c', '#1b1b4d', '#26225d'].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 40, W, 41); });
    const t = s ? s.t : 0;
    for (const st of stars) { g.fillStyle = Math.sin(t * 1.2 + st.p) > 0.5 ? '#8a8fd0' : '#2e3170'; g.fillRect(Math.round(st.x), Math.round(st.y), 1, 1); }
    // the moon, with a soft glow
    for (let y = -MR - 5; y <= MR + 5; y++) for (let x = -MR - 5; x <= MR + 5; x++) {
      const d = x * x + y * y;
      if (d < MR * MR) { g.fillStyle = d > (MR - 2) ** 2 ? '#f0dcb0' : '#fff3d6'; g.fillRect(MX + x, MY + y, 1, 1); }
      else if (d < (MR + 5) ** 2 && (x + y) % 2 === 0) { g.fillStyle = '#4a4488'; g.fillRect(MX + x, MY + y, 1, 1); }
    }
    g.fillStyle = '#eddcb2';
    [[-24, -26, 6], [22, 18, 8], [-14, 30, 4], [30, -20, 3]].forEach(([cx, cy, r]) => {
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) g.fillRect(MX + cx + x, MY + cy + y, 1, 1);
    });
    if (!s) return;

    // faint dotted outline of where the shadow goes
    if (s.phase === 'play') {
      g.fillStyle = '#d9c38f';
      for (const p of s.pieces) if (!p.locked) for (const [x, y] of p.m.px) if ((x + y) % 3 === 0) g.fillRect(MX + p.tx + x, MY + p.ty + y, 1, 1);
    }

    if (s.phase === 'scene') return drawScene(g, t - s.doneT);
    for (const p of s.pieces) drawMask(g, p, p.x, p.y, false);
  }

  // the finished shadow comes alive
  function drawScene(g, e) {
    const k = s.sc.key;
    for (const p of s.pieces) {
      let ox = p.x, oy = p.y;
      if (k === 'cat' && p === s.pieces.find(q => q.tx === 4)) ox += Math.round(Math.sin(e * 4));   // tail swish
      if (k === 'us' && p.tx === -1) ox -= Math.sin(e * 1.5) > 0 ? 1 : 0;                       // she leans in
      if (k === 'us' && p.ty === -26) oy -= Math.round((Math.sin(e * 3) + 1));                   // heart bobs
      drawMask(g, p, ox, oy, true);
    }
    g.fillStyle = '#141024';
    if (k === 'cup') { // steam
      for (let w = 0; w < 3; w++) for (let y = 0; y < 14; y++) {
        const x = MX - 6 + w * 6 + Math.round(Math.sin(y * 0.5 - e * 4 + w) * 2);
        if ((y + Math.floor(e * 6)) % 5 !== 0) g.fillRect(x, MY - 16 - y, 1, 1);
      }
    }
    if (k === 'cat' && Math.floor(e * 1.2) % 4 !== 3) { // eyes catching the moonlight (they blink)
      g.fillStyle = '#fff3d6'; g.fillRect(MX - 6, MY - 14, 2, 1); g.fillRect(MX + 1, MY - 14, 2, 1);
    }
    if (k === 'us' && Math.sin(e * 6) > 0.6) { // a little sparkle by the heart
      g.fillStyle = '#fff3d6'; g.fillRect(MX + 8, MY - 30, 1, 1);
    }
  }

  function update(dt) { if (s) s.t += dt; }

  const def = {
    W, H, start, update, render, pointer, stop: () => { s = null; },
    help: 'drag the cloud pieces at the bottom onto the moon. whatever part covers the moon turns into a shadow. line them up with the faint dotted outline on the moon; a piece clicks into place when it\'s close. finish the picture to watch it come alive. there are three pictures.'
  };
  return {
    open: done => window.MINI.open(def, done),
    debug: { solve: () => { if (s && s.phase === 'play') { s.pieces.forEach(p => { p.x = MX + p.tx; p.y = MY + p.ty; p.locked = true; }); complete(); } }, state: () => s && { i: s.i, phase: s.phase } }
  };
})();
