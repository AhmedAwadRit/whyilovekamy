/* Our blanket fort: a little room she decorates. Lights, pillows, the
   window view and the music are hers to choose, and it stays how she
   leaves it (saved on her device). */
window.FORT = (() => {
  'use strict';
  const C = window.KAMY, S = window.SPRITES, A = window.AUDIO;
  const F = C.fort || {};
  const W = 200, H = 150, FLOOR = 110;
  const KEY = 'kamy.fort';
  const OPTIONS = {
    lights: ['warm', 'pink', 'rainbow', 'candles', 'off'],
    pillows: ['pink', 'lavender', 'mint', 'stripes', 'hearts'],
    window: ['stars', 'rain', 'snow', 'sunrise'],
    music: ['our song', 'lullaby', 'rain', 'quiet']
  };
  const MUSIC = { 'our song': null, lullaby: 'lullaby', rain: 'rain', quiet: 'quiet' };
  const BULBS = { warm: ['#ffd87a', '#ffe9b0'], pink: ['#ff9ec4', '#ffc2d9'], rainbow: ['#ff7a7a', '#ffd87a', '#9fe0a0', '#9fd4ff', '#c3a6ff'], candles: [], off: ['#3a3350'] };
  const INSIDE = { warm: '#3b2b27', pink: '#3a2436', rainbow: '#2d2a42', candles: '#34272a', off: '#161020' };
  const PILLOW = { pink: ['#ff9ec4', '#d86a9a'], lavender: ['#c3a6ff', '#8e6fd6'], mint: ['#9fe0c0', '#5fae8a'], stripes: ['#fff4e2', '#ff9ec4'], hearts: ['#fff4e2', '#ff5c8a'] };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  let api = null, s = null, room = null;
  const flakes = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), v: 0.3 + Math.random() * 0.7 }));

  function start(a) {
    api = a;
    const saved = store.get(KEY, {});
    s = { t: 0, choice: {} };
    for (const k of Object.keys(OPTIONS)) s.choice[k] = OPTIONS[k].includes(saved[k]) ? saved[k] : OPTIONS[k][0];
    buildRoom();
    A.setOverride(MUSIC[s.choice.music]);
    api.setHud(F.hint || '');
    setTimeout(() => { if (s) api.setHud(''); }, 4500);
    api.setControls(Object.keys(OPTIONS).map(k => ({
      id: k, label: `${k}: ${s.choice[k]}`,
      onClick: b => {
        const list = OPTIONS[k];
        s.choice[k] = list[(list.indexOf(s.choice[k]) + 1) % list.length];
        b.textContent = `${k}: ${s.choice[k]}`;
        store.set(KEY, s.choice);
        A.sfx('blip');
        if (k === 'music') A.setOverride(MUSIC[s.choice.music]);
        else buildRoom();
      }
    })));
  }

  // edges of the blanket at height y (it hangs from a line and flares out)
  const leftEdge = y => 74 - (y - 18) * 0.1;
  const rightEdge = y => 188 + (y - 18) * 0.08;
  const archTop = x => 60 + Math.pow((x - 131) / 30, 2) * 50; // the opening at the front

  // everything that doesn't move, drawn once per change
  function buildRoom() {
    room = S.canvas(W, H);
    const g = room.getContext('2d');
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    // wall + wallpaper dots
    R(0, 0, W, FLOOR, '#2b2342');
    for (let y = 6; y < FLOOR; y += 10) for (let x = (y / 10) % 2 ? 4 : 9; x < W; x += 10) R(x, y, 1, 1, '#3a3058');
    // floor planks
    R(0, FLOOR, W, H - FLOOR, '#3a2a32');
    for (let y = FLOOR + 8; y < H; y += 9) R(0, y, W, 1, '#30232a');
    for (let y = FLOOR; y < H; y += 9) for (let x = ((y / 9) % 2 ? 20 : 45); x < W; x += 50) R(x, y, 1, 9, '#30232a');
    R(0, FLOOR, W, 1, '#4a3842');
    // rug
    for (let y = -6; y <= 6; y++) { const hw = Math.round(Math.sqrt(1 - (y / 6.5) ** 2) * 46); R(131 - hw, 136 + y, hw * 2, 1, y % 3 ? '#5b4f9a' : '#6d63b0'); }
    // window frame (the view is drawn live)
    R(10, 14, 48, 40, '#6b5a8a'); R(12, 16, 44, 36, '#000');
    R(10, 53, 50, 3, '#7d6c9c');
    // the fort: quilt squares, with the opening showing the lit inside
    const inside = INSIDE[s.choice.lights];
    for (let y = 18; y < 128; y++) {
      for (let x = Math.round(leftEdge(y)); x <= Math.round(rightEdge(y)); x++) {
        const open = x > 101 && x < 161 && y > archTop(x);
        if (open) { g.fillStyle = inside; }
        else {
          const q = (Math.floor(x / 8) + Math.floor(y / 8)) % 2;
          const edge = (x % 8 === 0 || y % 8 === 0);
          g.fillStyle = edge ? '#8a3f5e' : q ? '#c96a8a' : '#b35a7a';
        }
        g.fillRect(x, y, 1, 1);
      }
    }
    // folds and shading
    for (let y = 20; y < 128; y += 2) { R(Math.round(leftEdge(y)), y, 1, 1, '#6e2f4a'); R(Math.round(rightEdge(y)), y, 1, 1, '#6e2f4a'); }
    // the line it hangs from
    for (let x = 66; x <= 196; x++) R(x, 16 + Math.round(Math.sin((x - 66) / 130 * Math.PI) * 2), 1, 1, '#9a8aac');
    // pillows
    const [pa, pb] = PILLOW[s.choice.pillows];
    const pillow = (x, y, w, h) => {
      R(x + 1, y, w - 2, h, pa); R(x, y + 1, w, h - 2, pa);
      if (s.choice.pillows === 'stripes') for (let k = 1; k < w - 1; k += 3) R(x + k, y + 1, 1, h - 2, pb);
      else if (s.choice.pillows === 'hearts') { const cx = x + (w >> 1) - 1, cy = y + (h >> 1) - 1; R(cx - 1, cy, 1, 1, pb); R(cx + 1, cy, 1, 1, pb); R(cx - 1, cy + 1, 3, 1, pb); R(cx, cy + 2, 1, 1, pb); }
      else { R(x + 1, y + h - 2, w - 2, 1, pb); R(x + 2, y + 1, w - 4, 1, '#ffffff33'); }
    };
    pillow(106, 113, 18, 11); pillow(140, 113, 18, 11); pillow(122, 110, 20, 13);
    // the two of you, snuggled in
    g.drawImage(S.friends.base, 124, 101);
  }

  function drawView(g, t) {
    const x0 = 12, y0 = 16, w = 44, h = 36, v = s.choice.window;
    const R = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
    if (v === 'sunrise') {
      ['#9fb8e8', '#c9b8e8', '#ffc2b0', '#ffb38a', '#ff9a6b'].forEach((c, i) => R(x0, y0 + i * 7, w, 8, c));
      for (let yy = -6; yy <= 0; yy++) { const hw = Math.round(Math.sqrt(36 - yy * yy)); R(x0 + 22 - hw, y0 + h + yy - 1, hw * 2, 1, '#fff1a8'); }
    } else {
      R(x0, y0, w, h, v === 'rain' ? '#1c2238' : v === 'snow' ? '#141a36' : '#0b0e2c');
      if (v === 'stars') {
        for (let k = 0; k < 14; k++) { const sx = (k * 37) % w, sy = (k * 23) % (h - 4); if (Math.sin(t * 2 + k) > -0.3) R(x0 + sx, y0 + sy, 1, 1, '#d6d9ff'); }
        for (let yy = -3; yy <= 3; yy++) { const hw = Math.round(Math.sqrt(9.5 - yy * yy)); R(x0 + 33 - hw, y0 + 8 + yy, hw * 2 + 1, 1, '#fff3d6'); }
      } else if (v === 'rain') {
        for (let k = 0; k < 16; k++) { const rx = (k * 29 + t * 30) % w, ry = (k * 17 + t * 90) % h; R(x0 + Math.floor(rx), y0 + Math.floor(ry), 1, 3, '#6f7fb8'); }
      } else if (v === 'snow') {
        for (const f of flakes) { const fx = (f.x * w + Math.sin(t + f.x * 9) * 2 + w) % w, fy = (f.y * h + t * 8 * f.v) % h; R(x0 + Math.floor(fx), y0 + Math.floor(fy), 1, 1, '#ffffff'); }
        R(x0, y0 + h - 3, w, 3, '#e8eeff');
      }
    }
    // window cross
    R(x0 + 21, y0, 2, h, '#6b5a8a'); R(x0, y0 + 17, w, 2, '#6b5a8a');
  }

  function update(dt) { if (s) s.t += dt; }

  function render(g) {
    if (!s || !room) return;
    const t = s.t, L = s.choice.lights;
    g.drawImage(room, 0, 0);
    drawView(g, t);
    // fairy lights along the top of the fort
    const cols = BULBS[L];
    if (cols.length) {
      for (let k = 0; k < 16; k++) {
        const x = 70 + k * 8, y = 19 + Math.round(Math.sin((x - 66) / 130 * Math.PI) * 2);
        const on = L === 'off' ? false : Math.sin(t * 2 + k * 1.7) > -0.6;
        const c = L === 'off' ? cols[0] : cols[k % cols.length];
        if (on) { g.fillStyle = '#ffffff22'; g.fillRect(x - 1, y - 1, 3, 3); }
        g.fillStyle = on ? c : '#4a4060';
        g.fillRect(x, y, 1, 2);
      }
    }
    if (L === 'candles') {
      [[22, 124], [30, 126], [180, 125]].forEach(([x, y], k) => {
        g.fillStyle = '#fff4e2'; g.fillRect(x, y - 6, 3, 6);
        const fl = Math.floor(t * 8 + k) % 2;
        g.fillStyle = '#ffd87a'; g.fillRect(x + 1, y - 9 + fl, 1, 3 - fl);
        g.fillStyle = '#ff9a3c'; g.fillRect(x + 1, y - 7, 1, 1);
        if (Math.sin(t * 5 + k) > 0) { g.fillStyle = '#ffd87a33'; g.fillRect(x - 2, y - 11, 7, 7); }
      });
    }
  }

  const def = { W, H, start, update, render, stop: () => { s = null; room = null; A.setOverride(null); } };
  return { open: done => window.MINI.open(def, done) };
})();
