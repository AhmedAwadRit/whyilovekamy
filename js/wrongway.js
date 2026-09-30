/* Wrong Way Home: tap road tiles to turn them and connect RIT to Dunkin to
   the house before the little car leaves. It drives whatever road is there;
   a gap, a wrong-way one-way street, or skipping Dunkin ends the trip.
   Later days add one-way streets and closed roads that force detours. */
window.WRONGWAY = (() => {
  'use strict';
  const C = window.KAMY, S = window.SPRITES;
  const P = C.wrongway || {};
  const W = 160, H = 224, TOP = 26, BOTTOM = 26; // room for the hud and the button
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // N E S W
  const bit = d => 1 << d, opp = d => (d + 2) % 4;
  const rot = m => ((m << 1) | (m >> 3)) & 15;        // a quarter turn clockwise
  const exitOf = (m, d) => [0, 1, 2, 3].find(k => k !== d && (m & bit(k)));

  const LEVELS = [
    { cols: 5, rows: 6, wait: 30, speed: 1.1, minLen: 8, maxLen: 14, oneWays: 0, closed: 0 },
    { cols: 6, rows: 7, wait: 32, speed: 1.2, minLen: 12, maxLen: 20, oneWays: 0, closed: 1 },
    { cols: 6, rows: 8, wait: 36, speed: 1.3, minLen: 15, maxLen: 26, oneWays: 1, closed: 2 },
    { cols: 7, rows: 8, wait: 40, speed: 1.4, minLen: 18, maxLen: 30, oneWays: 2, closed: 3 },
    { cols: 7, rows: 9, wait: 45, speed: 1.5, minLen: 22, maxLen: 36, oneWays: 3, closed: 4 }
  ];

  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ---- Pixel icons ------------------------------------------------------- */
  const ICONS = {
    rit: S.make(['..oooooo..', '.oOOOOOOo.', 'oOOOOOOOOo', 'obbbbbbbbo', 'obwbwbwbbo', 'obbbbbbbbo', 'obwbwbwbbo', 'obbbddbbbo', 'oooooooooo'], { o: '#1a1030', O: '#f76902', b: '#b5562a', w: '#ffe7a0', d: '#2a1e18' }),
    dunkin: S.make(['.oooooo.', 'oWWWWWWo', '.oppppo.', '.oOOOOo.', '.oOwwOo.', '.oOOOOo.', '.oppppo.', '..oooo..'], { o: '#1a1030', W: '#f4f0ff', p: '#ff66a3', O: '#ff8a2a', w: '#fff4e2' }),
    home: S.make(['....oo....', '...oRRo...', '..oRRRRo..', '.oRRRRRRo.', 'oRRRRRRRRo', '.owwwwwwo.', '.owyywddo.', '.owyywddo.', '.oooooooo.'], { o: '#1a1030', R: '#ff5c8a', w: '#fff4e2', y: '#ffd87a', d: '#8a6f45' }),
    cone: S.make(['..o..', '.oOo.', '.owo.', 'oOOOo', 'owwwo', 'ooooo'], { o: '#1a1030', O: '#ff8a2a', w: '#fff4e2' })
  };
  const carH = S.make(['.oooo.', 'oppwpo', 'oppppo', '.o..o.'], { o: '#1a1030', p: '#ff9ec4', w: '#c8f0ea' });
  const carV = S.make(['.oo.', 'opwo', 'oppo', 'oppo', 'oppo', '.oo.'], { o: '#1a1030', p: '#ff9ec4', w: '#c8f0ea' });

  /* ---- Building a day ---------------------------------------------------- */
  const key = (x, y) => x + ',' + y;
  // a random wandering route from a to b that avoids `used`
  function walk(a, b, used, L, avoid) {
    let budget = 4000;
    const path = [a];
    const seen = new Set(used); seen.add(key(...a));
    function go(x, y) {
      if (--budget < 0) return false;
      if (x === b[0] && y === b[1]) return true;
      const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
      for (const d of order) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1], k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= L.cols || ny >= L.rows || seen.has(k) || k === avoid) continue;
        seen.add(k); path.push([nx, ny]);
        if (go(nx, ny)) return true;
        path.pop(); seen.delete(k);
      }
      return false;
    }
    return go(...a) ? path : null;
  }
  const dirTo = (a, b) => DIRS.findIndex(([dx, dy]) => a[0] + dx === b[0] && a[1] + dy === b[1]);

  function make(L) {
    for (let tries = 0; tries < 400; tries++) {
      const start = [0, ri(0, L.rows - 1)], home = [L.cols - 1, ri(0, L.rows - 1)];
      const dunk = [ri(1, L.cols - 2), ri(1, L.rows - 2)];
      const a = walk(start, dunk, new Set(), L, key(...home));
      if (!a) continue;
      const b = walk(dunk, home, new Set(a.map(p => key(...p))), L);
      if (!b) continue;
      const path = a.concat(b.slice(1));
      if (path.length < L.minLen || path.length > L.maxLen) continue;
      const dunkI = a.length - 1;

      const grid = Array.from({ length: L.rows }, () => Array(L.cols).fill(null));
      path.forEach((p, i) => {
        let m = 0;
        if (i > 0) m |= bit(dirTo(p, path[i - 1]));
        if (i < path.length - 1) m |= bit(dirTo(p, path[i + 1]));
        const kind = i === 0 ? 'rit' : i === path.length - 1 ? 'home' : i === dunkI ? 'dunkin' : 'road';
        grid[p[1]][p[0]] = { kind, mask: m, want: m, fixed: kind !== 'road', onPath: true };
      });
      // one-way streets on straight stretches of the route, pointing the way home
      const straights = path.map((p, i) => [p, i]).filter(([p, i]) => { const c = grid[p[1]][p[0]]; return c.kind === 'road' && (c.mask === 5 || c.mask === 10); });
      for (let k = 0; k < L.oneWays && straights.length; k++) {
        const [[x, y], i] = straights.splice(Math.floor(Math.random() * straights.length), 1)[0];
        Object.assign(grid[y][x], { kind: 'oneway', fixed: true, arrow: dirTo(path[i], path[i + 1]) });
      }
      // everything else: spare road pieces, a few closed roads, a little grass
      const empty = [];
      for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.cols; x++) if (!grid[y][x]) empty.push([x, y]);
      for (let k = 0; k < L.closed && empty.length; k++) {
        const [x, y] = empty.splice(Math.floor(Math.random() * empty.length), 1)[0];
        grid[y][x] = { kind: 'closed', mask: 0, fixed: true };
      }
      for (const [x, y] of empty) {
        grid[y][x] = Math.random() < 0.1 ? { kind: 'grass', mask: 0, fixed: true } : { kind: 'road', mask: pick([5, 10, 3, 6, 12, 9]), fixed: false };
      }
      // scramble: every piece of the route starts turned the wrong way
      for (const row of grid) for (const c of row) {
        if (c.fixed) continue;
        const straight = c.mask === 5 || c.mask === 10;
        const turns = c.onPath ? (straight ? pick([1, 3]) : ri(1, 3)) : ri(0, 3);
        for (let k = 0; k < turns; k++) c.mask = rot(c.mask);
      }
      return { grid, start: path[0], cols: L.cols, rows: L.rows };
    }
    return null;
  }

  /* ---- Game -------------------------------------------------------------- */
  let api = null, s = null;

  function start(a) {
    api = a;
    s = null;
    api.show([
      api.el('h3', 'game-title', P.title || 'wrong way home'),
      api.el('p', 'line', P.intro || ''),
      api.button('start', () => begin(0))
    ]);
  }

  function begin(i, again) {
    api.hideScreen();
    const L = LEVELS[i];
    const board = again ? again : make(L);
    const snapshot = board.grid.map(r => r.map(c => ({ ...c })));
    const cell = Math.floor(Math.min((W - 8) / L.cols, (H - TOP - BOTTOM) / L.rows));
    s = {
      i, L, board, snapshot, cell,
      ox: Math.round((W - cell * L.cols) / 2), oy: TOP + Math.round((H - TOP - BOTTOM - cell * L.rows) / 2),
      t: 0, wait: L.wait, phase: 'build', car: null, dunkin: false, lit: new Set()
    };
    trace();
    api.setControls([{ label: P.goLabel || 'leave now', onClick: () => depart() }]);
    hud();
  }

  function hud() {
    if (!s) return;
    const day = `day ${s.i + 1}/${LEVELS.length}`;
    if (s.phase === 'build') api.setHud(`${day} · leaving in ${Math.ceil(s.wait)}`);
    else if (s.phase === 'drive') api.setHud(`${day} · ${s.dunkin ? 'dunkin ✓ · home!' : 'to dunkin'}`);
  }

  // which roads are connected to RIT right now (drawn brighter)
  function trace() {
    const { grid, start: [sx, sy] } = s.board;
    s.lit = new Set([key(sx, sy)]);
    let x = sx, y = sy, d = exitOf(grid[sy][sx].mask, -1), guard = 200;
    while (guard-- > 0) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
      const c = grid[ny] && grid[ny][nx];
      if (!c || !(c.mask & bit(opp(d)))) break;
      if (c.kind === 'oneway' && c.arrow !== d) break;
      s.lit.add(key(nx, ny));
      if (c.kind === 'home') break;
      x = nx; y = ny; d = exitOf(c.mask, opp(d));
      if (d === undefined || s.lit.size > 200) break;
    }
  }

  function depart() {
    if (!s || s.phase !== 'build') return;
    const [x, y] = s.board.start;
    s.phase = 'drive';
    s.car = { x, y, entry: -1, exit: exitOf(s.board.grid[y][x].mask, -1), t: 0.5 };
    s.board.grid[y][x].locked = true;
    api.setControls(null);
    api.sfx('open');
    hud();
  }

  function pointer(type, p) {
    if (type !== 'down' || !s || api.screenOpen() || s.phase === 'over') return;
    const x = Math.floor((p.x - s.ox) / s.cell), y = Math.floor((p.y - s.oy) / s.cell);
    const c = s.board.grid[y] && s.board.grid[y][x];
    if (!c) return;
    if (c.fixed || c.locked) { api.sfx('close'); return; }
    c.mask = rot(c.mask);
    c.spin = 1;
    api.sfx('blip');
    trace();
  }

  function crash(why) {
    s.phase = 'over';
    api.sfx('hurt');
    api.setControls(null);
    const lines = Object.assign({
      gap: 'the road just... ended.',
      oneway: 'that was a one-way street. wrong way.',
      dunkin: 'you drove right past dunkin?? turn around.',
      closed: 'road closed. told you.'
    }, P.fails || {});
    setTimeout(() => {
      if (!s) return;
      api.showSoft([
        api.el('h3', 'game-title', P.failTitle || 'uh oh'),
        api.el('p', 'line', lines[why]),
        api.button('try again', () => begin(s.i, { ...s.board, grid: s.snapshot }))
      ]);
    }, 700);
  }

  function arrive() {
    s.phase = 'over';
    api.sfx('win');
    const last = s.i === LEVELS.length - 1;
    const lines = P.days || [];
    setTimeout(() => {
      if (!s) return;
      if (last) return finish();
      api.showSoft([
        api.el('h3', 'game-title', P.homeTitle || 'home!'),
        api.el('p', 'line', lines[s.i] || 'made it.'),
        api.button('next day', () => begin(s.i + 1))
      ]);
    }, 900);
  }

  function finish() {
    const line = api.el('p', 'win-note', '');
    api.show([
      api.el('h3', 'game-title', P.doneTitle || 'home, every time.'),
      line,
      api.button('back to the arcade', () => api.close({ complete: true }))
    ]);
    api.typeInto(line, P.doneLine || '');
    api.setHud('');
  }

  function update(dt) {
    if (!s) return;
    s.t += dt;
    for (const row of s.board.grid) for (const c of row) if (c.spin) c.spin = Math.max(0, c.spin - dt * 8);
    if (s.phase === 'build') {
      const before = Math.ceil(s.wait);
      s.wait -= dt;
      if (Math.ceil(s.wait) !== before) { hud(); if (s.wait <= 3.2 && s.wait > 0) api.sfx('type'); }
      if (s.wait <= 0) depart();
      return;
    }
    if (s.phase !== 'drive') return;
    const car = s.car, grid = s.board.grid;
    car.t += dt * s.L.speed;
    if (car.t < 1) return;
    car.t -= 1;
    const d = car.exit, nx = car.x + DIRS[d][0], ny = car.y + DIRS[d][1];
    const c = grid[ny] && grid[ny][nx];
    if (!c) return crash('gap');
    if (c.kind === 'closed') return crash('closed');
    if (!(c.mask & bit(opp(d)))) return crash('gap');
    if (c.kind === 'oneway' && c.arrow !== d) return crash('oneway');
    Object.assign(car, { x: nx, y: ny, entry: opp(d), t: 0 });
    c.locked = true;
    if (c.kind === 'dunkin' && !s.dunkin) { s.dunkin = true; api.sfx('pickup'); hud(); }
    if (c.kind === 'home') { car.exit = -1; return s.dunkin ? arrive() : crash('dunkin'); }
    car.exit = exitOf(c.mask, car.entry);
  }

  /* ---- Drawing ----------------------------------------------------------- */
  function drawCell(g, c, x, y) {
    const n = s.cell, px = s.ox + x * n, py = s.oy + y * n;
    g.fillStyle = (x + y) % 2 ? '#3a6e44' : '#367040';
    g.fillRect(px, py, n, n);
    g.fillStyle = '#4f8a52';
    g.fillRect(px + 3, py + 4, 1, 1); g.fillRect(px + n - 5, py + n - 6, 1, 1);
    if (c.kind === 'grass') { g.fillRect(px + (n >> 1), py + (n >> 1), 1, 2); return; }
    if (c.kind === 'closed') {
      g.fillStyle = '#4a4858'; g.fillRect(px + 2, py + (n >> 1) - 2, n - 4, 4);
      g.fillStyle = '#fff4e2'; for (let k = px + 3; k < px + n - 3; k += 4) g.fillRect(k, py + (n >> 1) - 1, 2, 2);
      g.drawImage(ICONS.cone, px + (n >> 1) - 2, py + (n >> 1) - 7);
      return;
    }
    const rw = Math.max(6, Math.round(n * 0.42) & ~1), cx = px + (n >> 1), cy = py + (n >> 1), h = rw >> 1;
    const lit = s.lit.has(key(x, y));
    const road = lit ? '#5d5a70' : '#46445a', edge = lit ? '#8a86a6' : '#34323f';
    const arm = d => {
      if (d === 0) return [cx - h, py, rw, n / 2 + h];
      if (d === 1) return [cx - h, cy - h, n / 2 + h, rw];
      if (d === 2) return [cx - h, cy - h, rw, n / 2 + h];
      return [px, cy - h, n / 2 + h, rw];
    };
    for (let d = 0; d < 4; d++) if (c.mask & bit(d)) { const [a, b, w, hh] = arm(d); g.fillStyle = edge; g.fillRect(a - 1, b - (d === 0 ? 0 : 1), w + 2, hh + (d === 0 || d === 2 ? 0 : 2)); }
    for (let d = 0; d < 4; d++) if (c.mask & bit(d)) { const [a, b, w, hh] = arm(d); g.fillStyle = road; g.fillRect(a, b, w, hh); }
    // lane dashes
    g.fillStyle = lit ? '#ffd87a' : '#8a7a4a';
    for (let d = 0; d < 4; d++) if (c.mask & bit(d)) {
      for (let k = 2; k < n / 2 - 1; k += 3) g.fillRect(cx + DIRS[d][0] * k, cy + DIRS[d][1] * k, 1, 1);
    }
    if (c.kind === 'oneway') {
      g.fillStyle = '#fff4e2';
      const [dx, dy] = DIRS[c.arrow];
      for (let k = -3; k <= 3; k++) g.fillRect(cx + dx * k, cy + dy * k, 1, 1);
      g.fillRect(cx + dx * 2 - dy, cy + dy * 2 - dx, 1, 1); g.fillRect(cx + dx * 2 + dy, cy + dy * 2 + dx, 1, 1);
      g.fillRect(cx + dx * 1 - dy * 2, cy + dy * 1 - dx * 2, 1, 1); g.fillRect(cx + dx * 1 + dy * 2, cy + dy * 1 + dx * 2, 1, 1);
    }
    const icon = ICONS[c.kind];
    if (icon) g.drawImage(icon, cx - (icon.width >> 1), cy - (icon.height >> 1));
    if (c.kind === 'dunkin' && s.dunkin) { g.fillStyle = '#9be89b'; g.fillRect(px + n - 4, py + 2, 2, 2); }
    if (c.spin) { g.fillStyle = `rgba(255,243,214,${c.spin * 0.35})`; g.fillRect(px, py, n, n); }
  }

  function render(g) {
    g.fillStyle = '#1f3a2a'; g.fillRect(0, 0, W, H);
    if (!s) return;
    for (let y = 0; y < s.L.rows; y++) for (let x = 0; x < s.L.cols; x++) drawCell(g, s.board.grid[y][x], x, y);
    // the car
    const car = s.car;
    const n = s.cell;
    let x, y, d;
    if (!car) { [x, y] = s.board.start; x = s.ox + x * n + n / 2; y = s.oy + y * n + n / 2; d = exitOf(s.board.grid[s.board.start[1]][s.board.start[0]].mask, -1); }
    else {
      const cx = s.ox + car.x * n + n / 2, cy = s.oy + car.y * n + n / 2;
      if (car.t < 0.5 && car.entry >= 0) { const k = 0.5 - car.t; x = cx + DIRS[car.entry][0] * n * k; y = cy + DIRS[car.entry][1] * n * k; d = opp(car.entry); }
      else if (car.exit >= 0) { const k = car.t - 0.5; x = cx + DIRS[car.exit][0] * n * k; y = cy + DIRS[car.exit][1] * n * k; d = car.exit; }
      else { x = cx; y = cy; d = 1; }
    }
    const spr = d === 1 || d === 3 ? carH : carV;
    const bump = s.phase === 'drive' && Math.floor(s.t * 8) % 2 ? 1 : 0;
    g.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height / 2) - bump);
  }

  const def = {
    W, H, start, update, render, pointer,
    stop: () => { s = null; },
    help: 'tap a road tile to turn it. connect the road from RIT (the orange building) to dunkin, then to the house. the car leaves when the timer runs out (or tap "leave now"), and it drives whatever road is there, so you can keep fixing tiles ahead of it. roads connected to RIT light up. white arrows are one-way streets, and cones mean the road is closed. you have to stop at dunkin.'
  };
  return {
    open: done => window.MINI.open(def, done),
    LEVELS,
    debug: {
      state: () => s && { i: s.i, phase: s.phase, lit: s.lit.size, dunkin: s.dunkin },
      // turn every tile of the route the right way (for tests)
      solve: () => { if (!s) return; for (const row of s.board.grid) for (const c of row) if (c.onPath) c.mask = c.want; trace(); },
      board: () => s && s.board.grid.map(r => r.map(c => c.kind[0] + c.mask)),
      level: i => begin(i),
      go: () => depart()
    }
  };
})();
