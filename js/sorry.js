/* "i'm sorry": a letter that pops up as soon as she opens the site (after
   the passcode). A little animated scene sits on top: a starry night,
   peonies swaying in the corners, and Ahmed sitting alone under a rain
   cloud. It shows once per device (or every visit, if everyVisit is on);
   whyilovekamy.com/#sorry opens it again. All the words are in content.js. */
window.SORRY = (() => {
  'use strict';
  const C = window.KAMY, S = window.SPRITES;
  const P = C.sorry || {};
  const $ = id => document.getElementById(id);
  const KEY = 'kamy.sorry.seen';
  const W = 128, H = 84, GROUND = 70;

  const seen = () => { try { return localStorage.getItem(KEY) === String(P.id || 1); } catch (e) { return false; } };
  const due = () => !!(P.body && P.on !== false) && (P.everyVisit || !seen() || location.hash === '#sorry');

  /* ---- The scene ------------------------------------------------------------ */
  // him: sitting on the grass, arms around his knees, head down
  const HIM = [
    '....kkk.....',
    '...kkkkk....',
    '...kkkkk....',
    '....kkkkk...',
    '..kkkkkkkk..',
    '.kkkkkkkkkk.',
    '.kkkkk.kkkk.',
    '.kkkkk..kkk.',
    '.kkkkk..kkk.',
    '.kkkkk..kkk.',
    '.kkkkkkkkkk.',
    'kkkkkkkkkkkk'
  ];
  const him = (() => {
    const base = S.make(HIM, { k: '#07061a' });
    const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
    const g = c.getContext('2d');
    g.drawImage(base, 0, 0);
    // a thin edge of moonlight on his head and back
    g.fillStyle = '#4a4590';
    HIM.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== 'k') return;
      const up = y === 0 || HIM[y - 1][x] !== 'k', left = x === 0 || row[x - 1] !== 'k';
      if ((up && x < 7) || (left && y < 6)) g.fillRect(x, y, 1, 1);
    }));
    return c;
  })();
  const HX = 58, HY = GROUND - HIM.length + 1;

  const stars = Array.from({ length: 42 }, () => ({ x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * 46), p: Math.random() * 9, s: 0.6 + Math.random() }));
  const drops = Array.from({ length: 70 }, () => newDrop(true));
  function newDrop(anywhere) {
    // most of the rain comes from his cloud
    const under = Math.random() < 0.65;
    return {
      x: under ? HX - 10 + Math.random() * 34 : Math.random() * W,
      y: anywhere ? Math.random() * H : (under ? 20 : -4),
      v: 70 + Math.random() * 40, under
    };
  }
  const splashes = [];

  // a peony: ruffled layers of pink, lighter towards the middle
  function peony(g, cx, cy, r, ph, hue) {
    const pal = hue ? ['#c4507e', '#e0679b', '#ff9ec4', '#ffd6e6'] : ['#b5487a', '#ff7aa8', '#ffb3cf', '#fff0f6'];
    for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.hypot(x, y), a = Math.atan2(y, x);
      const edge = r * (0.84 + 0.16 * Math.sin(a * 7 + ph));
      if (d > edge) continue;
      const k = d / r;
      let col = k > 0.72 ? pal[1] : k > 0.42 ? pal[2] : pal[3];
      if (Math.sin(a * 5 + d * 0.9 + ph) > 0.9 && k > 0.3) col = pal[0];   // the folds between petals
      if (k > 0.95) col = pal[0];
      g.fillStyle = col;
      g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
    g.fillStyle = '#ffe7a0'; g.fillRect(Math.round(cx), Math.round(cy), 1, 1);
  }
  function leaf(g, x, y, dir) {
    g.fillStyle = '#2f6e45';
    for (let k = 0; k < 6; k++) g.fillRect(Math.round(x + dir * k), Math.round(y - k * 0.5), 2, 1);
    g.fillStyle = '#4caf50'; g.fillRect(Math.round(x + dir * 2), Math.round(y - 1), 1, 1);
  }
  const PEONIES = [
    [9, 76, 8, 0, 1], [22, 82, 6, 2, 0], [4, 62, 5, 4, 0],
    [119, 76, 8, 1, 0], [106, 82, 6, 3, 1], [125, 61, 5, 5, 1],
    [84, 80, 4, 6, 0]
  ];

  function draw(g, t) {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#05061a'); grad.addColorStop(0.75, '#1d1a44'); grad.addColorStop(1, '#2a2458');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    for (const s of stars) {
      const v = Math.sin(t * s.s + s.p);
      if (v < -0.3) continue;
      g.fillStyle = v > 0.8 ? '#fff3d6' : v > 0.3 ? '#8a8fd0' : '#3b3878';
      g.fillRect(s.x, s.y, 1, 1);
    }
    // a far hill and the grass he's sitting on
    g.fillStyle = '#15123a';
    for (let x = 0; x < W; x++) g.fillRect(x, Math.round(GROUND - 8 - Math.sin(x * 0.05 + 1) * 4), 1, 30);
    g.fillStyle = '#0f1a2a'; g.fillRect(0, GROUND + 1, W, H - GROUND);
    g.fillStyle = '#183a2c';
    for (let x = 0; x < W; x += 3) g.fillRect(x, GROUND + 1, 1, 1 + (x % 2));
    // the rain cloud over him
    const cx = HX + 6 + Math.round(Math.sin(t * 0.6));
    g.fillStyle = '#3a3a5a';
    for (const [dx, dy, r] of [[-11, 2, 6], [0, -1, 8], [11, 2, 6], [5, 3, 6], [-5, 3, 6]]) {
      for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); if (16 + dy + y < 22) g.fillRect(cx + dx - w, 16 + dy + y, w * 2 + 1, 1); }
    }
    g.fillStyle = '#4b4b70'; g.fillRect(cx - 6, 8, 9, 1); g.fillRect(cx - 12, 13, 5, 1);
    g.drawImage(him, HX, HY);
    // rain
    for (const d of drops) {
      g.fillStyle = d.under ? 'rgba(160,176,240,.75)' : 'rgba(120,130,200,.4)';
      g.fillRect(Math.round(d.x), Math.round(d.y), 1, 3);
    }
    for (const s of splashes) { g.fillStyle = 'rgba(160,176,240,.6)'; g.fillRect(Math.round(s.x) - 1, GROUND, 1, 1); g.fillRect(Math.round(s.x) + 1, GROUND, 1, 1); }
    // peonies in front, swaying a little
    for (const [x, y, r, ph, hue] of PEONIES) {
      const sx = x + Math.round(Math.sin(t * 0.9 + ph) * 0.8);
      leaf(g, sx - 2, y + r - 1, -1); leaf(g, sx + 2, y + r, 1);
      g.fillStyle = '#2f6e45'; g.fillRect(sx, y + r, 1, H - y - r);
      peony(g, sx, y, r, ph, hue);
    }
  }

  function step(dt) {
    for (const d of drops) {
      d.y += d.v * dt; d.x -= d.v * dt * 0.12;
      if (d.y > GROUND) { if (Math.random() < 0.4) splashes.push({ x: d.x, t: 0.12 }); Object.assign(d, newDrop(false)); }
    }
    for (const s of splashes) s.t -= dt;
    while (splashes.length && splashes[0].t <= 0) splashes.shift();
  }

  /* ---- The letter ----------------------------------------------------------- */
  let raf = 0, last = 0, t = 0;
  function open() {
    $('sorry-title').textContent = P.title || 'i\'m sorry';
    $('sorry-body').replaceChildren(...[].concat(P.body || []).map(text => { const p = document.createElement('p'); p.textContent = text; return p; }));
    $('sorry-sign').textContent = P.signature || '';
    $('sorry-close').textContent = P.closeLabel || 'close';
    const cv = $('sorry-art'), g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    cancelAnimationFrame(raf);
    last = performance.now();
    const loop = now => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; t += dt;
      step(dt); draw(g, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    $('sorry-modal').querySelector('.panel').scrollTop = 0;
  }
  function close() {
    cancelAnimationFrame(raf);
    try { localStorage.setItem(KEY, String(P.id || 1)); } catch (e) {}
    if (location.hash === '#sorry') history.replaceState(null, '', location.pathname + location.search);
  }

  return { due, open, close };
})();
