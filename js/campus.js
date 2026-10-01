/* RIT After Dark: a dark pixel campus maze. Her stuff is scattered around;
   find it all, then get to the exit before campus security does their
   rounds. Only her flashlight and a few lamps light the way. Classroom
   doors are shortcuts... sometimes to somewhere completely wrong. */
window.CAMPUS = (() => {
  'use strict';
  const C = window.KAMY, S = window.SPRITES, PL = window.PLAT;
  const P = C.campus || {};
  const W = 160, H = 224, T = 8, VIEW = H - 40, STEP = 0.13;

  const NIGHTS = [
    { cw: 10, ch: 12, items: 3, doors: 4, time: 100, lamps: 8 },
    { cw: 13, ch: 16, items: 4, doors: 6, time: 130, lamps: 10 },
    { cw: 16, ch: 20, items: 5, doors: 8, time: 160, lamps: 12 }
  ];
  const BUILDINGS = P.buildings || ['GOL', 'the SAU', 'the library', 'Gleason', 'Gosnell', 'Booth', 'the field house', 'Crossroads', 'the Infinity Quad', 'Eastman'];
  const STUFF = ['airpods', 'id', 'charger', 'dunkin', 'hoodie'];
  const STUFF_NAMES = Object.assign({ airpods: 'your airpods', id: 'your RIT ID', charger: 'your charger', dunkin: 'your dunkin', hoodie: 'your hoodie' }, P.items || {});

  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ---- Sprites ----------------------------------------------------------------- */
  const ICONS = {
    airpods: S.make(['.ww.', 'wwww', 'wkkw', 'wwww'], { w: '#ffffff', k: '#b8bcd0' }),
    id: S.make(['oooooo', 'owwook', 'oooooo'], { o: '#f76902', w: '#fff4e2', k: '#2a1e18' }),
    charger: S.make(['www..', 'wwww.', 'www.w', '...w.'], { w: '#ffffff' }),
    dunkin: S.make(['WWWW', 'pppp', 'OOOO', 'OwwO', 'pppp'], { W: '#f4f0ff', p: '#ff66a3', O: '#ff8a2a', w: '#fff4e2' }),
    hoodie: S.make(['.pp.', 'pppp', 'pppp', 'pddp'], { p: '#ff9ec4', d: '#c4507e' })
  };
  const DOOR = S.make(['oooooo', 'obbbbo', 'obbbbo', 'obbbyo', 'obbbbo', 'oooooo'], { o: '#1a1030', b: '#4a7be0', y: '#ffd23f' });
  const GATE = [S.make(['g.g.g.', 'gggggg', 'g.g.g.', 'g.g.g.', 'gggggg', 'g.g.g.'], { g: '#8a8fb0' }), S.make(['g....g', 'g....g', 'g....g', 'g....g', 'g....g', 'g....g'], { g: '#9be3b0' })];

  /* ---- Building a campus ------------------------------------------------------- */
  function build(N) {
    const tw = N.cw * 2 + 1, th = N.ch * 2 + 1;
    const g = Array.from({ length: th }, () => Array(tw).fill(1));
    // a winding maze (depth-first), then knock out a few extra walls for loops
    const stack = [[0, 0]], seen = new Set(['0,0']);
    g[1][1] = 0;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const next = shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]).map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
        .find(([x, y]) => x >= 0 && y >= 0 && x < N.cw && y < N.ch && !seen.has(x + ',' + y));
      if (!next) { stack.pop(); continue; }
      const [x, y, dx, dy] = next;
      seen.add(x + ',' + y);
      g[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = 0;
      g[y * 2 + 1][x * 2 + 1] = 0;
      stack.push([x, y]);
    }
    for (let k = 0; k < N.cw * N.ch * 0.12; k++) {
      const x = ri(1, tw - 2), y = ri(1, th - 2);
      if (g[y][x] === 1 && ((g[y][x - 1] === 0 && g[y][x + 1] === 0) || (g[y - 1][x] === 0 && g[y + 1][x] === 0))) g[y][x] = 0;
    }
    // distances from the start, to put things far away
    const start = [1, 1];
    const dist = {};
    const q = [start]; dist['1,1'] = 0;
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (g[ny] && g[ny][nx] === 0 && dist[k] === undefined) { dist[k] = dist[x + ',' + y] + 1; q.push([nx, ny]); }
      }
    }
    const open = Object.keys(dist).map(k => k.split(',').map(Number));
    const deadEnds = open.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => g[y + dy][x + dx] === 0).length === 1 && !(x === 1 && y === 1));
    const far = (list) => list.slice().sort((a, b) => dist[b.join(',')] - dist[a.join(',')]);
    const exit = far(open)[0];
    const used = new Set([exit.join(','), '1,1']);
    const take = (list, n, minD) => {
      const out = [];
      for (const c of shuffle(list.slice())) {
        if (out.length >= n) break;
        const k = c.join(',');
        if (used.has(k) || dist[k] < minD) continue;
        used.add(k); out.push(c);
      }
      return out;
    };
    const items = take(deadEnds, N.items, 6);
    if (items.length < N.items) items.push(...take(open, N.items - items.length, 6));
    const doors = take(deadEnds.length > items.length + N.doors ? deadEnds : open, N.doors, 4);
    const lamps = take(open, N.lamps, 3);
    return {
      g, tw, th, start, exit,
      items: items.map((c, i) => ({ x: c[0], y: c[1], kind: STUFF[i % STUFF.length], got: false })),
      doors: doors.map(c => ({ x: c[0], y: c[1], name: pick(BUILDINGS) })),
      lamps: lamps.map(c => ({ x: c[0], y: c[1] }))
    };
  }

  /* ---- Game ------------------------------------------------------------------------- */
  let api = null, s = null;
  const held = { up: false, down: false, left: false, right: false };
  const touch = {};

  function start(a) {
    api = a;
    s = null;
    api.show([
      api.el('h3', 'game-title', P.title || 'rit after dark'),
      api.el('p', 'line', P.intro || ''),
      api.button('start', () => night(0))
    ]);
  }

  function night(i, again) {
    api.hideScreen();
    const N = NIGHTS[i];
    const map = again || build(N);
    map.items.forEach(it => { it.got = false; });
    s = { i, N, map, x: map.start[0], y: map.start[1], fx: map.start[0], fy: map.start[1], from: null, mt: 0, face: 1, time: N.time, t: 0, phase: 'play', msg: '', msgT: 0, flash: 0 };
    for (const k in held) held[k] = false;
    say(P.nights && P.nights[i] || `night ${i + 1}. find ${N.items} things.`, 3);
  }
  const found = () => s.map.items.filter(it => it.got).length;
  function say(text, secs = 2.6) { s.msg = text; s.msgT = secs; hud(); }
  function hud() {
    if (!s) return;
    if (s.msgT > 0) return api.setHud(s.msg);
    api.setHud(`night ${s.i + 1}/3 · ${found()}/${s.N.items} found · ${Math.ceil(s.time)}s`);
  }

  const wall = (x, y) => !s.map.g[y] || s.map.g[y][x] !== 0;
  function tryMove() {
    const dir = held.up ? [0, -1] : held.down ? [0, 1] : held.left ? [-1, 0] : held.right ? [1, 0] : null;
    if (!dir) return;
    const nx = s.x + dir[0], ny = s.y + dir[1];
    if (dir[0]) s.face = dir[0];
    if (wall(nx, ny)) return;
    s.from = [s.x, s.y]; s.x = nx; s.y = ny; s.mt = 0;
  }

  function arrive() {
    const m = s.map;
    for (const it of m.items) if (!it.got && it.x === s.x && it.y === s.y) {
      it.got = true; api.sfx('pickup');
      say(`${P.foundPrefix || 'found'} ${STUFF_NAMES[it.kind]}!${found() === s.N.items ? ' ' + (P.allFound || 'now get out.') : ''}`);
    }
    const d = m.doors.find(o => o.x === s.x && o.y === s.y);
    if (d) {
      // a classroom door: out some other door, who knows where
      const others = m.doors.filter(o => o !== d);
      const to = pick(others);
      s.x = s.fx = to.x; s.y = s.fy = to.y; s.from = null;
      // step off the door so she doesn't bounce straight back
      for (const [dx, dy] of shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]])) if (!wall(to.x + dx, to.y + dy)) { s.x = s.fx = to.x + dx; s.y = s.fy = to.y + dy; break; }
      s.flash = 0.4;
      api.sfx('open');
      const lines = P.doorLines || ['you took a door in {a} and somehow ended up in {b}.', '{a} -> {b}?? how.', 'that door in {a} goes to {b}. obviously.'];
      say(pick(lines).replace('{a}', d.name).replace('{b}', to.name === d.name ? pick(BUILDINGS) : to.name), 3);
    }
    if (s.x === m.exit[0] && s.y === m.exit[1]) {
      if (found() < s.N.items) say(P.notYet || `you can't leave without your stuff. ${s.N.items - found()} to go.`);
      else escape();
    }
  }

  function escape() {
    s.phase = 'out';
    api.sfx('win');
    const last = s.i === NIGHTS.length - 1, left = Math.ceil(s.time);
    setTimeout(() => {
      if (!s) return;
      if (last) return finish();
      api.showSoft([
        api.el('h3', 'game-title', P.outTitle || 'made it out'),
        api.el('p', 'line', (P.outLines && P.outLines[s.i]) || `${left} seconds to spare.`),
        api.button('next night', () => night(s.i + 1))
      ]);
    }, 500);
  }

  function finish() {
    try { localStorage.setItem('kamy.arcade.campus', 'true'); } catch (e) {}
    const line = api.el('p', 'win-note', '');
    api.show([
      api.el('h3', 'game-title', P.doneTitle || 'safe and sound'),
      line,
      api.button('back to the arcade', () => api.close({ complete: true }))
    ]);
    api.typeInto(line, P.doneLine || '');
    api.setHud('');
  }

  function update(dt) {
    if (!s || s.phase !== 'play') return;
    s.t += dt;
    if (s.msgT > 0 && (s.msgT -= dt) <= 0) hud();
    s.flash = Math.max(0, s.flash - dt);
    const before = Math.ceil(s.time);
    s.time -= dt;
    if (Math.ceil(s.time) !== before) { hud(); if (s.time < 10 && s.time > 0) api.sfx('type'); }
    if (s.time <= 0) {
      s.phase = 'caught';
      api.sfx('sad');
      const map = s.map, i = s.i;
      api.showSoft([
        api.el('h3', 'game-title', P.caughtTitle || 'busted'),
        api.el('p', 'line', P.caughtLine || 'campus security found you wandering around. try again.'),
        api.button('try again', () => night(i, map))
      ]);
      return;
    }
    // smooth steps from tile to tile
    if (s.from) {
      s.mt += dt / STEP;
      if (s.mt >= 1) { s.from = null; s.fx = s.x; s.fy = s.y; arrive(); }
      else { s.fx = s.from[0] + (s.x - s.from[0]) * s.mt; s.fy = s.from[1] + (s.y - s.from[1]) * s.mt; }
    }
    if (!s.from) tryMove();
  }

  /* ---- Input: a d-pad along the bottom, keys, or swipes on the map ---------- */
  const PADS = [['left', 0], ['up', 1], ['down', 2], ['right', 3]];
  function padAt(p) { return p.y >= VIEW ? PADS[Math.min(3, Math.floor(p.x / (W / 4)))][0] : null; }
  function sync() { for (const k in held) held[k] = keys[k]; for (const id in touch) if (touch[id].pad) held[touch[id].pad] = true; }
  const keys = { up: false, down: false, left: false, right: false };
  function pointer(type, p, e) {
    if (!s || api.screenOpen()) return;
    const id = e ? e.pointerId : 0;
    if (type === 'down') touch[id] = { pad: padAt(p), sx: p.x, sy: p.y };
    else if (type === 'move' && touch[id]) {
      const t = touch[id];
      if (t.pad || p.y >= VIEW) t.pad = padAt(p);
      else {
        // dragging on the map works like a joystick
        const dx = p.x - t.sx, dy = p.y - t.sy;
        if (Math.hypot(dx, dy) > 6) t.pad = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        t.swipe = true;
      }
    } else if (type === 'up' || type === 'cancel') delete touch[id];
    sync();
  }
  function key(type, k) {
    const down = type === 'down';
    const m = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' }[k];
    if (m) { keys[m] = down; sync(); }
  }

  /* ---- Drawing ------------------------------------------------------------------- */
  const dark = document.createElement('canvas'); dark.width = W; dark.height = VIEW;
  const dg = dark.getContext('2d');
  function render(g) {
    g.fillStyle = '#05040f'; g.fillRect(0, 0, W, H);
    if (!s) return;
    const m = s.map;
    const camX = Math.round(Math.max(0, Math.min(m.tw * T - W, s.fx * T + 4 - W / 2)));
    const camY = Math.round(Math.max(-20, Math.min(m.th * T - VIEW, s.fy * T + 4 - VIEW / 2)));
    const x0 = Math.floor(camX / T), y0 = Math.floor(camY / T);
    for (let y = y0; y <= y0 + VIEW / T + 1; y++) for (let x = x0; x <= x0 + W / T + 1; x++) {
      if (!m.g[y] || m.g[y][x] === undefined) continue;
      const sx = x * T - camX, sy = y * T - camY;
      if (m.g[y][x]) {
        // brick buildings (it's RIT)
        g.fillStyle = '#9a4a26'; g.fillRect(sx, sy, T, T);
        g.fillStyle = '#7a3a1e';
        g.fillRect(sx, sy + 3, T, 1); g.fillRect(sx, sy + 7, T, 1);
        g.fillRect(sx + ((y % 2) ? 2 : 6), sy, 1, 3); g.fillRect(sx + ((y % 2) ? 6 : 2), sy + 4, 1, 3);
        if (!m.g[y + 1] || m.g[y + 1][x] === 0) { g.fillStyle = '#5a2a14'; g.fillRect(sx, sy + 7, T, 1); }
        if ((x * 7 + y * 3) % 11 === 0) { g.fillStyle = '#ffd87a'; g.fillRect(sx + 3, sy + 1, 2, 2); }   // a lit window
      } else {
        g.fillStyle = (x + y) % 2 ? '#34323f' : '#2f2d3a'; g.fillRect(sx, sy, T, T);
        if ((x * 5 + y * 13) % 17 === 0) { g.fillStyle = '#2a4a32'; g.fillRect(sx + 2, sy + 5, 1, 1); g.fillRect(sx + 5, sy + 2, 1, 1); }
      }
    }
    // doors, the exit gate, lamps, her stuff
    for (const d of m.doors) g.drawImage(DOOR, d.x * T - camX + 1, d.y * T - camY + 1);
    const allIn = found() === s.N.items;
    g.drawImage(GATE[allIn ? 1 : 0], m.exit[0] * T - camX + 1, m.exit[1] * T - camY + 1);
    for (const l of m.lamps) { g.fillStyle = '#c8c8e0'; g.fillRect(l.x * T - camX + 4, l.y * T - camY + 2, 1, 6); g.fillStyle = '#fff7c2'; g.fillRect(l.x * T - camX + 3, l.y * T - camY + 1, 3, 2); }
    for (const it of m.items) if (!it.got) {
      const ic = ICONS[it.kind], bob = Math.round(Math.sin(s.t * 3 + it.x) * 1);
      g.drawImage(ic, it.x * T - camX + ((T - ic.width) >> 1), it.y * T - camY + ((T - ic.height) >> 1) + bob);
    }
    // her
    const who = PL.person(PL.iam, s.face, s.from ? s.t : 0);
    g.drawImage(who, Math.round(s.fx * T - camX + 1), Math.round(s.fy * T - camY - 2));

    // the dark, with a flashlight around her and pools of lamp light
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, W, VIEW);
    dg.fillStyle = 'rgba(4,3,14,0.95)'; dg.fillRect(0, 0, W, VIEW);
    dg.globalCompositeOperation = 'destination-out';
    const hole = (cx, cy, r) => {
      for (let k = 4; k >= 1; k--) {
        dg.fillStyle = `rgba(0,0,0,${0.25})`;
        dg.beginPath(); dg.arc(cx, cy, r * k / 4, 0, Math.PI * 2); dg.fill();
      }
    };
    hole(s.fx * T - camX + 4, s.fy * T - camY + 4, 38 + Math.sin(s.t * 9) * 0.6);
    for (const l of m.lamps) hole(l.x * T - camX + 4, l.y * T - camY + 3, 18);
    hole(m.exit[0] * T - camX + 4, m.exit[1] * T - camY + 4, allIn ? 20 : 10);
    g.drawImage(dark, 0, 0);
    // her stuff glints a little, even in the dark
    for (const it of m.items) if (!it.got && Math.sin(s.t * 2 + it.x * 1.7 + it.y) > 0.92) {
      g.fillStyle = '#fff3d6'; g.fillRect(it.x * T - camX + 4, it.y * T - camY + 1, 1, 1);
    }
    if (s.flash > 0) { g.fillStyle = `rgba(255,243,214,${s.flash})`; g.fillRect(0, 0, W, VIEW); }

    // the d-pad
    g.fillStyle = '#0b0a24'; g.fillRect(0, VIEW, W, H - VIEW);
    PADS.forEach(([name, i]) => {
      const x = i * W / 4, on = held[name];
      g.fillStyle = on ? '#6d63b0' : '#2a2458'; g.fillRect(x + 2, VIEW + 3, W / 4 - 4, H - VIEW - 6);
      g.fillStyle = on ? '#fff3d6' : '#8a80cc';
      const cx = Math.round(x + W / 8), cy = Math.round(VIEW + (H - VIEW) / 2);
      for (let k = 0; k < 5; k++) {
        if (name === 'left') g.fillRect(cx - 2 + k, cy - k, 1, k * 2 + 1);
        if (name === 'right') g.fillRect(cx + 2 - k, cy - k, 1, k * 2 + 1);
        if (name === 'up') g.fillRect(cx - k, cy - 2 + k, k * 2 + 1, 1);
        if (name === 'down') g.fillRect(cx - k, cy + 2 - k, k * 2 + 1, 1);
      }
    });
  }

  const def = {
    W, H, start, update, render, pointer, key,
    stop: () => { s = null; for (const k in touch) delete touch[k]; for (const k in keys) keys[k] = false; sync(); },
    help: 'walk with the arrows at the bottom (or drag on the map, or use the arrow keys). find all your stuff (it glints in the dark), then get to the gate. it turns green once you have everything. blue doors are classroom doors: they take you somewhere else on campus, and not always somewhere useful. be out before the timer runs out.'
  };
  return {
    open: done => window.MINI.open(def, done),
    NIGHTS,
    debug: {
      state: () => s && { i: s.i, x: s.x, y: s.y, phase: s.phase, found: found(), need: s.N.items, time: s.time, exit: s.map.exit, items: s.map.items, doors: s.map.doors.length, size: [s.map.tw, s.map.th] },
      // walk a path of tiles instantly (for tests)
      teleport: (x, y) => { if (s) { s.x = s.fx = x; s.y = s.fy = y; s.from = null; arrive(); } },
      time: t => { if (s) s.time = t; },
      map: () => s && s.map
    }
  };
})();
