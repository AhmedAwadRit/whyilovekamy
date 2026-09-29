/* Firefly rescue: draw a glowing path to lead lost fireflies home to
   their jar, through a few short night-sky puzzles. No timer, no fail
   state: a path that doesn't work just fades so she can try again. */
window.FIREFLIES = (() => {
  'use strict';
  const C = window.KAMY, S = window.SPRITES;
  const F = C.fireflies || {};
  const W = 160, H = 220, SWARM = 6;

  // start: where the fireflies wait; home: their jar; clouds: [x, y, r]
  const LEVELS = [
    { start: [30, 185], home: [128, 48], clouds: [], hint: 'draw a path from the fireflies to their jar.' },
    { start: [28, 190], home: [130, 40], clouds: [[80, 112, 30]], hint: 'storm clouds scare them. go around.' },
    { start: [130, 195], home: [30, 40], clouds: [[60, 150, 24], [108, 88, 26]], lost: [120, 50], hint: 'one is lost. pick it up on the way.' },
    { start: [80, 200], home: [80, 30], clouds: [[40, 140, 22], [118, 140, 22], [80, 95, 20], [30, 60, 16], [130, 60, 16]], maxLen: 330, hint: 'their glow only lasts so long. find a short way.' }
  ];

  const jar = S.make([
    '.oooo.',
    'oLLLLo',
    'o....o',
    'o....o',
    'o....o',
    'o....o',
    '.oooo.'
  ], { o: '#b9b3d9', L: '#8a6f45' });

  const stars = Array.from({ length: 55 }, () => ({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * 9 }));

  let api = null, s = null;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function start(a) {
    api = a;
    s = null;
    api.show([
      api.el('h3', 'game-title', F.title || 'firefly rescue'),
      api.el('p', 'line', F.intro || ''),
      api.button('start', () => begin(0))
    ]);
  }

  function begin(i) {
    api.hideScreen();
    const L = LEVELS[i];
    s = { i, L, t: 0, phase: 'draw', path: [], len: 0, drawing: false, bad: false, fadeT: 0, followT: 0, lostFound: !L.lost, homeT: 0 };
    api.setHud(`${i + 1}/${LEVELS.length} · ${L.hint}`);
  }

  function hitsCloud(x, y) { return s.L.clouds.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r + 2); }

  function fail(msg) {
    s.phase = 'fade'; s.fadeT = 0; s.drawing = false;
    api.setHud(`${s.i + 1}/${LEVELS.length} · ${msg}`);
    api.sfx('sad');
  }

  function pointer(type, p) {
    if (!s || api.screenOpen()) return;
    const pt = [p.x, p.y];
    if (type === 'down' && s.phase === 'draw') {
      if (dist(pt, s.L.start) > 22) { api.setHud(`${s.i + 1}/${LEVELS.length} · start from the fireflies.`); return; }
      s.drawing = true; s.bad = false; s.len = 0;
      s.path = [s.L.start.slice(), pt];
      api.sfx('blip');
    } else if (type === 'move' && s.drawing) {
      const lastPt = s.path[s.path.length - 1], d = dist(pt, lastPt);
      if (d < 2.5) return;
      const steps = Math.ceil(d / 2);
      for (let k = 1; k <= steps; k++) {
        const x = lastPt[0] + (pt[0] - lastPt[0]) * k / steps, y = lastPt[1] + (pt[1] - lastPt[1]) * k / steps;
        if (hitsCloud(x, y)) { s.bad = true; s.path.push([x, y]); return fail('the storm scared them. try another way.'); }
      }
      if (s.L.maxLen && s.len + d > s.L.maxLen) { s.drawing = false; return release(); }
      s.len += d;
      s.path.push(pt);
      if (s.L.maxLen) api.setHud(`${s.i + 1}/${LEVELS.length} · glow left: ${Math.max(0, Math.round(100 - s.len / s.L.maxLen * 100))}%`);
    } else if ((type === 'up' || type === 'cancel') && s.drawing) {
      s.drawing = false;
      release();
    }
  }

  function release() {
    const end = s.path[s.path.length - 1];
    const reached = end && dist(end, s.L.home) < 15;
    const picked = !s.L.lost || s.path.some(q => dist(q, s.L.lost) < 13);
    if (!reached) return fail(s.L.maxLen && s.len >= s.L.maxLen - 3 ? 'their glow ran out. try a shorter way.' : 'almost! lead them all the way to the jar.');
    if (!picked) return fail('don\'t forget the lost one.');
    s.phase = 'follow'; s.followT = 0;
    api.setHud(`${s.i + 1}/${LEVELS.length} · ...`);
  }

  // a point a given distance along the path
  function along(d) {
    const p = s.path;
    let acc = 0;
    for (let k = 1; k < p.length; k++) {
      const seg = dist(p[k], p[k - 1]);
      if (acc + seg >= d) { const f = (d - acc) / seg; return [p[k - 1][0] + (p[k][0] - p[k - 1][0]) * f, p[k - 1][1] + (p[k][1] - p[k - 1][1]) * f]; }
      acc += seg;
    }
    return p[p.length - 1];
  }
  const pathLen = () => { let l = 0; for (let k = 1; k < s.path.length; k++) l += dist(s.path[k], s.path[k - 1]); return l; };

  function update(dt) {
    if (!s) return;
    s.t += dt;
    if (s.phase === 'fade') { s.fadeT += dt; if (s.fadeT > 1) { s.phase = 'draw'; s.path = []; } }
    if (s.phase === 'follow') {
      s.followT += dt;
      const lead = s.followT * 58;
      if (s.L.lost && !s.lostFound && dist(along(lead), s.L.lost) < 13) { s.lostFound = true; api.sfx('pickup'); }
      if (lead - SWARM * 7 > pathLen()) { s.phase = 'home'; s.homeT = 0; api.sfx('grow'); }
    }
    if (s.phase === 'home') {
      s.homeT += dt;
      if (s.homeT > 1.8) {
        if (s.i < LEVELS.length - 1) begin(s.i + 1);
        else finish();
      }
    }
  }

  function finish() {
    s.phase = 'done';
    const line = api.el('p', 'win-note', '');
    api.show([
      api.el('h3', 'game-title', F.doneTitle || 'all home.'),
      line,
      api.button('back to the field', () => api.close({ complete: true }))
    ]);
    api.typeInto(line, F.doneLine || '');
    api.setHud('');
  }

  /* ---- Drawing ---------------------------------------------------------- */
  function glowDot(g, x, y, bright) {
    x = Math.round(x); y = Math.round(y);
    if (bright) { g.fillStyle = '#56702c'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
    g.fillStyle = bright ? '#f4ff9a' : '#a8b85a';
    g.fillRect(x, y, 1, 1);
  }

  function render(g) {
    g.fillStyle = '#070920'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#0d1030'; g.fillRect(0, H * 0.55, W, H * 0.45);
    for (const st of stars) {
      g.fillStyle = Math.sin((s ? s.t : 0) * 1.3 + st.p) > 0.6 ? '#8a8fd0' : '#2e3170';
      g.fillRect(Math.round(st.x), Math.round(st.y), 1, 1);
    }
    if (!s) return;
    const L = s.L, t = s.t;

    // storm clouds, with a little rain
    for (const [cx, cy, r] of L.clouds) {
      // three puffs and a flat-ish bottom, drawn inside the cloud's circle
      const puffs = [[cx - r * 0.42, cy + r * 0.12, r * 0.55], [cx + r * 0.4, cy + r * 0.08, r * 0.6], [cx, cy - r * 0.18, r * 0.72]];
      for (const pass of [0, 1]) {
        for (const [px, py, pr] of puffs) {
          const rr = pass ? pr - 1.5 : pr;
          g.fillStyle = pass ? '#22204a' : '#3d3b78';
          for (let y = -rr; y <= rr; y++) {
            const hw = Math.floor(Math.sqrt(Math.max(0, rr * rr - y * y)));
            const yy = Math.round(py + y);
            if (yy > cy + r * 0.55) continue;
            g.fillRect(Math.round(px - hw), yy, hw * 2 + 1, 1);
          }
        }
      }
      g.fillStyle = '#4b4f93';
      for (let k = 0; k < 4; k++) { const rx = cx - r / 2 + k * r / 3, ry = cy + r * 0.8 + ((t * 30 + k * 7) % 10); g.fillRect(Math.round(rx), Math.round(ry), 1, 2); }
    }

    // the jar (glows when they're home)
    const [hx, hy] = L.home;
    if (s.phase === 'home' || s.phase === 'done') { g.fillStyle = '#56702c'; g.fillRect(hx - 5, hy - 4, 10, 9); for (let k = 0; k < 6; k++) glowDot(g, hx - 2 + (k % 3) * 2, hy - 1 + Math.floor(k / 3) * 3, Math.sin(t * 4 + k) > 0); }
    g.drawImage(jar, hx - 3, hy - 4);

    // the path
    const bad = s.bad, fading = s.phase === 'fade';
    for (let k = 0; k < s.path.length; k++) {
      if (k % 2) continue;
      const [x, y] = s.path[k];
      if (fading && Math.random() < s.fadeT) continue;
      g.fillStyle = bad || fading ? '#ff5c8a' : k % 4 ? '#8f9c4a' : '#f4ff9a';
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }

    // the lost firefly
    if (L.lost && !s.lostFound) glowDot(g, L.lost[0] + Math.sin(t * 2) * 3, L.lost[1] + Math.cos(t * 1.6) * 2, Math.sin(t * 5) > 0);

    // the swarm
    const count = SWARM + (L.lost && s.lostFound ? 1 : 0);
    for (let k = 0; k < count; k++) {
      let x, y;
      if (s.phase === 'follow') { [x, y] = along(Math.max(0, s.followT * 58 - k * 7)); x += Math.sin(t * 6 + k) * 1.5; y += Math.cos(t * 5 + k) * 1.5; }
      else if (s.phase === 'home' || s.phase === 'done') continue;
      else { x = L.start[0] + Math.cos(t * 2 + k * 1.1) * 6; y = L.start[1] + Math.sin(t * 2.6 + k * 1.7) * 4; }
      glowDot(g, x, y, Math.sin(t * 3 + k * 2) > -0.3);
    }
    // grass tuft where they wait
    g.fillStyle = '#2a5a40';
    const [sx, sy] = L.start;
    g.fillRect(sx - 4, sy + 6, 9, 1); g.fillRect(sx - 3, sy + 5, 1, 1); g.fillRect(sx + 1, sy + 4, 1, 2); g.fillRect(sx + 3, sy + 5, 1, 1);
  }

  const def = { W, H, start, update, render, pointer, stop: () => { s = null; } };
  return {
    open: done => window.MINI.open(def, done),
    LEVELS,
    debug: { state: () => s && { i: s.i, phase: s.phase }, level: i => begin(i) }
  };
})();
