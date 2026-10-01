/* Backpack Panic: fit her stuff into a tiny backpack before the bus comes.
   Everything she packed stays packed, and each round adds one more thing,
   so she has to keep repacking until the last round, where everything
   fills the bag exactly. Drag to move, tap to turn. (Every round has been
   checked to fit: see the rounds list below.) */
window.BACKPACK = (() => {
  'use strict';
  const C = window.KAMY, S = window.SPRITES;
  const P = C.backpack || {};
  const W = 160, H = 224, CELL = 14, GW = 6, GH = 6;
  const GX = Math.round((W - GW * CELL) / 2), GY = 34, TRAY = GY + GH * CELL + 16;

  const SHAPES = {
    id: ['##'], charger: ['#.', '#.', '##'], snacks: ['##', '##'], headphones: ['###', '#.#'],
    bottle: ['#', '#', '#'], laptop: ['####', '####'], pineapple: ['.#.', '###', '.#.'],
    umbrella: ['####'], airpods: ['#']
  };
  // the order things get added, one per round (starting with three)
  const ORDER = ['id', 'charger', 'snacks', 'headphones', 'bottle', 'laptop', 'pineapple', 'umbrella', 'airpods'];
  const ROUNDS = ORDER.length - 2;
  const COLORS = { id: '#f76902', charger: '#c8c8e0', snacks: '#e0473c', headphones: '#ff9ec4', bottle: '#7fd1c7', laptop: '#8a8fb0', pineapple: '#ffd23f', umbrella: '#6d63b0', airpods: '#ffffff' };
  const NAMES = Object.assign({ id: 'RIT ID', charger: 'charger', snacks: 'snacks', headphones: 'headphones', bottle: 'water bottle', laptop: 'laptop', pineapple: 'a pineapple', umbrella: 'umbrella', airpods: 'airpods' }, P.names || {});

  /* ---- Little pictures on each item ---------------------------------------- */
  const ICONS = {
    id: S.make(['wwwoookk', 'wswoooo.', 'wwwokkko'], { w: '#fff4e2', s: '#8a6f45', o: '#f76902', k: '#2a1e18' }),
    charger: S.make(['www...', 'wwww..', 'www.w.', '....w.', '..ww..'], { w: '#ffffff' }),
    snacks: S.make(['yyyyy', 'yYYYy', 'yYYYy', 'yyyyy'], { y: '#ffd23f', Y: '#ff8a2a' }),
    headphones: S.headphones,
    bottle: S.make(['.k.', 'bbb', 'bwb', 'bbb', 'bbb'], { k: '#2a2a3a', b: '#c8f0ea', w: '#fff4e2' }),
    laptop: S.make(['kkkkkkkk', 'kbbbbbbk', 'kbbbbbbk', 'kkkppkkk'], { k: '#2a2a3a', b: '#8fb3ff', p: '#ff5c8a' }),
    pineapple: S.make(['g.g.g', '.ggg.', 'yYyYy', 'YyYyY', 'yYyYy', '.yYy.'], { g: '#4caf50', y: '#fff27a', Y: '#c98a1b' }),
    umbrella: S.make(['k.........', 'kppppppppp', 'k.........'], { k: '#2a1e18', p: '#ff9ec4' }),
    airpods: S.make(['.ww.', 'wwww', 'wkkw', 'wwww'], { w: '#e8e8f8', k: '#b8bcd0' })
  };

  /* ---- Shapes ---------------------------------------------------------------- */
  const cellsOf = rows => rows.flatMap((r, y) => [...r].map((c, x) => (c === '#' ? [x, y] : null)).filter(Boolean));
  function turn(cs) {
    const r = cs.map(([x, y]) => [-y, x]);
    const mx = Math.min(...r.map(c => c[0])), my = Math.min(...r.map(c => c[1]));
    return r.map(([x, y]) => [x - mx, y - my]);
  }
  const size = cs => ({ w: Math.max(...cs.map(c => c[0])) + 1, h: Math.max(...cs.map(c => c[1])) + 1 });

  function paint(it) {
    const { w, h } = size(it.cells);
    const c = document.createElement('canvas'); c.width = w * CELL; c.height = h * CELL;
    const g = c.getContext('2d'), col = COLORS[it.id];
    const has = (x, y) => it.cells.some(q => q[0] === x && q[1] === y);
    for (const [x, y] of it.cells) {
      g.fillStyle = col; g.fillRect(x * CELL, y * CELL, CELL, CELL);
      g.fillStyle = 'rgba(255,255,255,.25)';
      if (!has(x, y - 1)) g.fillRect(x * CELL, y * CELL, CELL, 1);
      if (!has(x - 1, y)) g.fillRect(x * CELL, y * CELL, 1, CELL);
      g.fillStyle = '#1a1030';
      if (!has(x, y - 1)) g.fillRect(x * CELL, y * CELL, CELL, 1);
      if (!has(x, y + 1)) g.fillRect(x * CELL, y * CELL + CELL - 1, CELL, 1);
      if (!has(x - 1, y)) g.fillRect(x * CELL, y * CELL, 1, CELL);
      if (!has(x + 1, y)) g.fillRect(x * CELL + CELL - 1, y * CELL, 1, CELL);
    }
    // the picture, turned with the item, kept inside its shape
    const icon = ICONS[it.id];
    const m = document.createElement('canvas'); m.width = c.width; m.height = c.height;
    const mg = m.getContext('2d');
    mg.translate(Math.round(c.width / 2), Math.round(c.height / 2));
    mg.rotate(it.rot * Math.PI / 2);
    mg.drawImage(icon, -Math.floor(icon.width / 2), -Math.floor(icon.height / 2));
    mg.setTransform(1, 0, 0, 1, 0, 0);
    mg.globalCompositeOperation = 'destination-in';   // (one fill for all cells: each fill would erase the rest)
    mg.beginPath();
    for (const [x, y] of it.cells) mg.rect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    mg.fill();
    g.drawImage(m, 0, 0);
    it.canvas = c; it.w = w; it.h = h;
  }

  function makeItem(id) {
    const it = { id, rot: 0, cells: cellsOf(SHAPES[id]), x: 0, y: 0, bag: null };
    paint(it);
    return it;
  }

  /* ---- The bag ------------------------------------------------------------------ */
  let api = null, s = null;
  const taken = (except) => {
    const g = new Set();
    for (const it of s.items) if (it !== except && it.bag) for (const [x, y] of it.cells) g.add((it.bag.x + x) + ',' + (it.bag.y + y));
    return g;
  };
  function fits(it, bx, by) {
    const g = taken(it);
    return it.cells.every(([x, y]) => bx + x >= 0 && by + y >= 0 && bx + x < GW && by + y < GH && !g.has((bx + x) + ',' + (by + y)));
  }
  function put(it, bx, by) { it.bag = { x: bx, y: by }; it.x = GX + bx * CELL; it.y = GY + by * CELL; }

  // spread the loose things along the tray
  function tidy(list) {
    let x = 4, y = TRAY + 4, row = 0;
    for (const it of list) {
      const w = it.w * CELL, h = it.h * CELL;
      if (x + w > W - 4) { x = 4; y += row + 4; row = 0; }
      it.x = x; it.y = Math.min(y, H - h - 2);
      x += w + 6; row = Math.max(row, h);
    }
  }

  /* ---- Rounds ------------------------------------------------------------------- */
  function start(a) {
    api = a;
    s = null;
    api.show([
      api.el('h3', 'game-title', P.title || 'backpack panic'),
      api.el('p', 'line', P.intro || ''),
      api.button('start', () => round(0, []))
    ]);
  }

  function round(i, keep) {
    api.hideScreen();
    const count = i + 3;
    // what was packed last round stays packed; everything else goes in the tray
    const items = ORDER.slice(0, count).map(id => {
      const old = keep.find(k => k.id === id);
      if (!old) return makeItem(id);
      const it = { ...old };
      return it;
    });
    s = { i, items, t: 0, time: (P.seconds || 40) + i * 12, phase: 'play', drag: null, snapshot: items.map(it => ({ ...it, bag: it.bag && { ...it.bag } })) };
    tidy(items.filter(it => !it.bag));
    const fresh = items[items.length - 1];
    api.setHud(`round ${i + 1}/${ROUNDS} · + ${NAMES[fresh.id]}`);
    s.hudT = 2;
  }

  function retry() {
    const i = s.i, snap = s.snapshot;
    round(i, snap.filter(it => it.bag));
  }

  function hud() {
    if (s.hudT > 0) return;
    api.setHud(`round ${s.i + 1}/${ROUNDS} · ${Math.ceil(s.time)}s`);
  }

  function itemAt(p) {
    for (let k = s.items.length - 1; k >= 0; k--) {
      const it = s.items[k], cx = Math.floor((p.x - it.x) / CELL), cy = Math.floor((p.y - it.y) / CELL);
      if (it.cells.some(([x, y]) => x === cx && y === cy)) return it;
    }
    return null;
  }

  function pointer(type, p) {
    if (!s || s.phase !== 'play' || api.screenOpen()) return;
    if (type === 'down') {
      const it = itemAt(p);
      if (!it) return;
      s.items.splice(s.items.indexOf(it), 1); s.items.push(it);   // to the top
      s.drag = { it, dx: p.x - it.x, dy: p.y - it.y, sx: p.x, sy: p.y, t: s.t, from: it.bag };
      it.bag = null;
      api.sfx('blip');
    } else if (type === 'move' && s.drag) {
      const d = s.drag;
      d.it.x = Math.round(p.x - d.dx); d.it.y = Math.round(p.y - d.dy);
    } else if ((type === 'up' || type === 'cancel') && s.drag) {
      const d = s.drag, it = d.it;
      s.drag = null;
      const tap = Math.hypot(p.x - d.sx, p.y - d.sy) < 4 && s.t - d.t < 0.4;
      if (tap) {
        // a tap turns it a quarter turn (in place, if it still fits)
        it.rot = (it.rot + 1) % 4; it.cells = turn(it.cells); paint(it);
        api.sfx('type');
        if (d.from && fits(it, d.from.x, d.from.y)) put(it, d.from.x, d.from.y);
        else if (d.from) { it.y = Math.max(it.y, TRAY); clampLoose(it); }
        else clampLoose(it);
        return check();
      }
      const bx = Math.round((it.x - GX) / CELL), by = Math.round((it.y - GY) / CELL);
      if (fits(it, bx, by)) { put(it, bx, by); api.sfx('pickup'); }
      else { clampLoose(it); if (it.y < TRAY - 8 && it.x > GX - it.w * CELL && it.x < GX + GW * CELL) { it.y = TRAY; clampLoose(it); api.sfx('close'); } }
      check();
    }
  }
  function clampLoose(it) {
    it.x = Math.max(0, Math.min(W - it.w * CELL, it.x));
    it.y = Math.max(TRAY - 10, Math.min(H - it.h * CELL, it.y));
  }

  function check() {
    if (!s.items.every(it => it.bag)) return;
    s.phase = 'packed';
    api.sfx('win');
    const lines = P.rounds || [];
    const last = s.i === ROUNDS - 1;
    const keep = s.items.map(it => ({ ...it }));
    setTimeout(() => {
      if (!s) return;
      if (last) return finish();
      api.showSoft([
        api.el('h3', 'game-title', P.packedTitle || 'packed!'),
        api.el('p', 'line', lines[s.i] || `${Math.ceil(s.time)} seconds to spare.`),
        api.button('next', () => round(s.i + 1, keep))
      ]);
    }, 600);
  }

  function finish() {
    try { localStorage.setItem('kamy.arcade.backpack', 'true'); } catch (e) {}
    const line = api.el('p', 'win-note', '');
    api.show([
      api.el('h3', 'game-title', P.doneTitle || 'everything fits.'),
      line,
      api.button('back to the arcade', () => api.close({ complete: true }))
    ]);
    api.typeInto(line, P.doneLine || '');
    api.setHud('');
  }

  function update(dt) {
    if (!s || s.phase !== 'play') return;
    s.t += dt;
    if (s.hudT > 0) s.hudT -= dt;
    const before = Math.ceil(s.time);
    s.time -= dt;
    if (Math.ceil(s.time) !== before && s.time < 5.5 && s.time > 0) api.sfx('type');
    hud();
    if (s.time <= 0) {
      s.phase = 'late';
      api.sfx('sad');
      if (s.drag) s.drag = null;
      api.showSoft([
        api.el('h3', 'game-title', P.lateTitle || 'the bus left'),
        api.el('p', 'line', P.lateLine || 'without you. try that round again.'),
        api.button('try again', () => retry())
      ]);
    }
  }

  /* ---- Drawing ------------------------------------------------------------------ */
  function render(g) {
    g.fillStyle = '#16123a'; g.fillRect(0, 0, W, H);
    // the backpack: straps, body, pocket
    const bx = GX - 6, by = GY - 8, bw = GW * CELL + 12, bh = GH * CELL + 16;
    g.fillStyle = '#6d3a5a';
    g.fillRect(bx + 14, by - 8, 4, 10); g.fillRect(bx + bw - 18, by - 8, 4, 10); g.fillRect(bx + 14, by - 10, bw - 28, 3);
    g.fillStyle = '#1a1030'; g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    g.fillStyle = '#c4507e'; g.fillRect(bx, by, bw, bh);
    g.fillStyle = '#e07aa6'; g.fillRect(bx, by, bw, 3);
    g.fillStyle = '#8a3560'; g.fillRect(bx, by + bh - 3, bw, 3);
    g.fillStyle = '#ffd87a'; for (let x = bx + 3; x < bx + bw - 3; x += 3) g.fillRect(x, by + 4, 2, 1);
    // the inside
    g.fillStyle = '#2a1830'; g.fillRect(GX, GY, GW * CELL, GH * CELL);
    g.fillStyle = '#3a2440';
    for (let x = 0; x <= GW; x++) g.fillRect(GX + x * CELL, GY, 1, GH * CELL);
    for (let y = 0; y <= GH; y++) g.fillRect(GX, GY + y * CELL, GW * CELL, 1);
    // where the dragged thing would land
    if (s && s.drag) {
      const it = s.drag.it, px = Math.round((it.x - GX) / CELL), py = Math.round((it.y - GY) / CELL);
      if (fits(it, px, py)) {
        g.fillStyle = 'rgba(155,232,155,.35)';
        for (const [x, y] of it.cells) g.fillRect(GX + (px + x) * CELL + 1, GY + (py + y) * CELL + 1, CELL - 1, CELL - 1);
      }
    }
    // the tray
    g.fillStyle = '#0e0b28'; g.fillRect(0, TRAY - 8, W, H - TRAY + 8);
    g.fillStyle = '#2e2766'; g.fillRect(0, TRAY - 8, W, 1);
    if (!s) return;
    for (const it of s.items) {
      if (s.drag && s.drag.it === it) {
        g.globalAlpha = 0.35; g.fillStyle = '#000';
        for (const [x, y] of it.cells) g.fillRect(it.x + x * CELL + 2, it.y + y * CELL + 3, CELL, CELL);
        g.globalAlpha = 1;
        g.drawImage(it.canvas, it.x, it.y - 1);
      } else g.drawImage(it.canvas, it.x, it.y);
    }
    // the clock, as a little bar under the bag
    const frac = Math.max(0, s.time / ((P.seconds || 40) + s.i * 12));
    g.fillStyle = '#2e2766'; g.fillRect(GX, GY + GH * CELL + 10, GW * CELL, 2);
    g.fillStyle = frac < 0.2 ? '#ff5c8a' : '#9be3b0'; g.fillRect(GX, GY + GH * CELL + 10, Math.round(GW * CELL * frac), 2);
  }

  const def = {
    W, H, start, update, render, pointer,
    stop: () => { s = null; },
    help: 'drag things into the backpack; a green outline shows where they\'ll go. tap something to turn it. everything you packed stays in the bag, and each round adds one more thing, so you\'ll have to move stuff around. pack everything before the bar under the bag runs out. the last round fills the bag exactly (it really does fit, promise).'
  };
  return {
    open: done => window.MINI.open(def, done),
    ROUNDS, SHAPES, ORDER,
    debug: {
      state: () => s && { i: s.i, phase: s.phase, time: s.time, items: s.items.map(it => ({ id: it.id, bag: it.bag, x: it.x, y: it.y, w: it.w, h: it.h, rot: it.rot, cells: it.cells })) },
      // pack using a given solution: [[id, rot, bx, by], ...]
      pack: plan => { for (const [id, rot, bx, by] of plan) { const it = s.items.find(q => q.id === id); while (it.rot !== rot) { it.rot = (it.rot + 1) % 4; it.cells = turn(it.cells); } paint(it); put(it, bx, by); } check(); },
      time: t => { if (s) s.time = t; }
    }
  };
})();
