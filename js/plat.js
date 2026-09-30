/* A tiny platformer engine shared by the prank platformer and the ghost race.
   Levels are rows of characters, 8px per tile:
     #  ground            =  fake floor (looks like ground, you fall through)
     ^  spikes            S  spring (launches you way up)
     C  crumbling block   i  hidden block (invisible until you bump it from below)
     s  sign (text in level.signs)   n  a note that shows when you die near it
     P  start             F  flag (the goal)     f  fake flag (not the goal)
   The world is plain data plus a few functions, so the tests can save and
   restore it to search for a way through a level. */
window.PLAT = (() => {
  'use strict';
  const S = window.SPRITES;
  const T = 8, GRAV = 520, JUMP = 200, SPEED = 62, SPRING = 345, MAXFALL = 280;
  const PW = 6, PH = 8, CRUMBLE = 0.35, COYOTE = 0.09;
  const SOLID = new Set(['#', 'C', 'S']);

  /* ---- Levels ------------------------------------------------------------- */
  function parse(level) {
    const rows = level.rows.map(r => r.split(''));
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    rows.forEach(r => { while (r.length < w) r.push('.'); });
    let start = { x: 1, y: h - 3 };
    rows.forEach((r, y) => r.forEach((c, x) => { if (c === 'P') { start = { x, y }; r[x] = '.'; } }));
    const at = list => Object.fromEntries((list || []).map(o => [o.x + ',' + o.y, o.text]));
    return { w, h, base: rows, start, signs: at(level.signs), notes: (level.notes || []).slice() };
  }

  function create(level) {
    const L = parse(level);
    const wd = { L, t: 0 };

    wd.reset = () => {
      wd.tiles = L.base.map(r => r.slice());
      wd.p = { x: L.start.x * T + 1, y: (L.start.y + 1) * T - PH, vx: 0, vy: 0, ground: false, coyote: 0, held: false, cut: false, face: 1, walk: 0, dead: false, won: false };
      wd.crumble = {};      // "x,y" -> seconds left
      wd.seen = {};         // fake floors she's fallen through, hidden blocks found
      wd.spring = {};       // "x,y" -> bounce animation
      wd.sign = null;
    };
    wd.reset();

    const tile = (x, y) => (x < 0 || x >= L.w) ? '#' : (y < 0 || y >= L.h) ? '.' : wd.tiles[y][x];
    const solid = (x, y) => { const c = tile(x, y); return SOLID.has(c) || (c === 'i' && wd.seen[x + ',' + y]); };
    // every tile the player's box touches
    function each(fn) {
      const p = wd.p;
      for (let ty = Math.floor(p.y / T); ty <= Math.floor((p.y + PH - 0.01) / T); ty++)
        for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + PW - 0.01) / T); tx++) fn(tx, ty);
    }

    wd.update = (dt, input) => {
      const p = wd.p, ev = [];
      if (p.dead || p.won) return ev;
      wd.t += dt;
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      p.vx = dir * SPEED;
      if (dir) { p.face = dir; p.walk += dt; } else p.walk = 0;
      if (input.jump && !p.held && (p.ground || p.coyote > 0)) {
        p.vy = -JUMP; p.ground = false; p.coyote = 0; p.cut = false;
        ev.push({ type: 'jump' });
      }
      if (!input.jump && p.vy < 0 && !p.cut) { p.vy *= 0.45; p.cut = true; }   // a short hop if she lets go
      p.held = !!input.jump;
      p.vy = Math.min(MAXFALL, p.vy + GRAV * dt);

      // across
      p.x += p.vx * dt;
      each((tx, ty) => {
        if (!solid(tx, ty)) return;
        if (p.vx > 0) p.x = tx * T - PW; else if (p.vx < 0) p.x = (tx + 1) * T;
      });
      // up and down
      const wasGround = p.ground;
      p.ground = false;
      p.y += p.vy * dt;
      each((tx, ty) => {
        const c = tile(tx, ty);
        if (p.vy < 0 && c === 'i' && !wd.seen[tx + ',' + ty]) { wd.seen[tx + ',' + ty] = true; ev.push({ type: 'bump', x: tx, y: ty }); }
        if (!solid(tx, ty)) return;
        if (p.vy > 0) { p.y = ty * T - PH; p.vy = 0; p.ground = true; }
        else if (p.vy < 0) { p.y = (ty + 1) * T; p.vy = 0; }
      });
      if (!p.ground) {
        // standing exactly on top of something counts too
        const fy = Math.floor((p.y + PH) / T);
        if ((p.y + PH) % T === 0) for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + PW - 0.01) / T); tx++) if (solid(tx, fy) && p.vy >= 0) p.ground = true;
      }
      p.coyote = p.ground ? COYOTE : Math.max(0, p.coyote - dt);
      if (p.ground && !wasGround) ev.push({ type: 'land' });

      // what she's standing on
      if (p.ground) {
        const fy = Math.round((p.y + PH) / T);
        for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + PW - 0.01) / T); tx++) {
          const c = tile(tx, fy), k = tx + ',' + fy;
          if (c === 'S') { p.vy = -SPRING; p.ground = false; p.cut = true; wd.spring[k] = 0.3; ev.push({ type: 'spring' }); break; }
          if (c === 'C' && wd.crumble[k] === undefined) wd.crumble[k] = CRUMBLE;
        }
      }
      for (const k in wd.crumble) {
        if (wd.crumble[k] <= 0) continue;
        wd.crumble[k] -= dt;
        if (wd.crumble[k] <= 0) { const [x, y] = k.split(',').map(Number); wd.tiles[y][x] = '.'; ev.push({ type: 'crumble', x, y }); }
      }
      for (const k in wd.spring) wd.spring[k] = Math.max(0, wd.spring[k] - dt);

      // things she's touching
      let onSign = null;
      each((tx, ty) => {
        const c = tile(tx, ty), k = tx + ',' + ty;
        if (c === '=') wd.seen[k] = true;
        if (c === '^') {
          // spikes only hurt in their bottom part
          if (p.y + PH > ty * T + 3 && p.x + PW > tx * T + 1 && p.x < tx * T + 7) die('spikes');
        }
        if (c === 'F') { p.won = true; ev.push({ type: 'win' }); }
        if (c === 'f') { wd.tiles[ty][tx] = '.'; ev.push({ type: 'fakeflag', x: tx, y: ty }); }
        if (c === 's') onSign = k;
      });
      if (onSign !== wd.sign) { wd.sign = onSign; if (onSign && L.signs[onSign]) ev.push({ type: 'sign', text: L.signs[onSign] }); }
      if (p.y > L.h * T + 24) die('fall');

      function die(why) {
        if (p.dead) return;
        p.dead = true;
        const cx = p.x + PW / 2, cy = Math.min(p.y + PH / 2, L.h * T);
        // the closest note within 4 tiles
        let note = null, best = 4 * T;
        for (const n of L.notes) { const d = Math.hypot(n.x * T + 4 - cx, n.y * T + 4 - cy); if (d < best) { best = d; note = n.text; } }
        ev.push({ type: 'die', why, x: cx, y: cy, note });
      }
      return ev;
    };

    wd.camera = (vw, vh) => {
      const p = wd.p, lw = L.w * T, lh = L.h * T;
      const x = Math.max(0, Math.min(lw - vw, p.x + PW / 2 - vw / 2));
      const y = lh <= vh ? lh - vh : Math.max(0, Math.min(lh - vh, p.y - vh * 0.55));
      return { x: Math.round(x), y: Math.round(y) };
    };

    // for the level-solving tests
    wd.save = () => JSON.stringify({ p: wd.p, tiles: wd.tiles, crumble: wd.crumble, seen: wd.seen, t: wd.t });
    wd.load = str => { const o = JSON.parse(str); Object.assign(wd, { p: o.p, tiles: o.tiles, crumble: o.crumble, seen: o.seen, t: o.t }); };
    return wd;
  }

  /* ---- Drawing ------------------------------------------------------------ */
  const cache = {};
  function art(id, draw, w = T, h = T) {
    if (cache[id]) return cache[id];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'));
    return (cache[id] = c);
  }
  const px = (g, col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const groundTop = () => art('gt', g => { px(g, '#6b4a3a', 0, 0, 8, 8); px(g, '#4caf50', 0, 0, 8, 2); px(g, '#2f8a3a', 0, 2, 8, 1); px(g, '#8a6250', 2, 5); px(g, '#8a6250', 6, 4); px(g, '#7cd07c', 1, 0); px(g, '#7cd07c', 5, 0); });
  const groundIn = () => art('gi', g => { px(g, '#6b4a3a', 0, 0, 8, 8); px(g, '#5a3d30', 1, 2); px(g, '#8a6250', 5, 5); px(g, '#5a3d30', 3, 6); });
  const crumble = () => art('cr', g => { px(g, '#b08a6a', 0, 0, 8, 8); px(g, '#8a6a50', 0, 3, 8, 1); px(g, '#8a6a50', 3, 0, 1, 3); px(g, '#8a6a50', 6, 4, 1, 4); px(g, '#5a3d30', 2, 5, 2, 1); px(g, '#d8b894', 1, 1); });
  const spikes = () => art('sp', g => { for (let k = 0; k < 2; k++) { const x = k * 4; px(g, '#c8c8e0', x + 1, 5, 3, 3); px(g, '#c8c8e0', x + 2, 3, 1, 2); px(g, '#8a8ab0', x + 3, 5, 1, 3); } });
  const spring = up => art('sg' + up, g => { px(g, '#8a8ab0', 1, 7 - up, 6, 1); for (let y = 4 + (up ? 0 : 2); y < 7; y += 2) px(g, '#c8c8e0', 2, y, 4, 1); px(g, '#ff5c8a', 0, up ? 2 : 4, 8, 2); px(g, '#ffb3cf', 1, up ? 2 : 4, 3, 1); });
  const hidden = () => art('hd', g => { px(g, '#d9a02a', 0, 0, 8, 8); px(g, '#ffd23f', 1, 1, 6, 6); px(g, '#8a6218', 3, 2, 2, 1); px(g, '#8a6218', 4, 3, 1, 1); px(g, '#8a6218', 3, 5, 1, 1); });
  const sign = () => art('sn', g => { px(g, '#8a6f45', 3, 4, 2, 4); px(g, '#c9a36b', 0, 0, 8, 5); px(g, '#8a6f45', 1, 1, 6, 1); px(g, '#8a6f45', 1, 3, 4, 1); });
  const flag = fake => art('fl' + fake, g => { px(g, '#e8e8f8', 1, 0, 1, 16); px(g, '#ffd23f', 0, 0, 3, 1); px(g, fake ? '#ff66a3' : '#ff5c8a', 2, 1, 6, 4); px(g, '#ffb3cf', 3, 2, 2, 1); px(g, '#6b4a3a', 0, 15, 3, 1); }, 8, 16);
  const noteIcon = () => art('nt', g => { px(g, '#fff4e2', 0, 0, 8, 5); px(g, '#fff4e2', 1, 5, 2, 2); px(g, '#8a80cc', 1, 1, 5, 1); px(g, '#8a80cc', 1, 3, 3, 1); });
  const startIcon = () => art('st', g => { px(g, '#9be3b0', 1, 1, 6, 7); px(g, '#2f8a3a', 2, 2, 4, 6); px(g, '#ffd23f', 5, 5); });

  // the player: Kamy (long hair) or Ahmed (short hair), two walking frames
  const PEOPLE = {
    kamy: [
      ['.hhhh.', 'hhffhh', 'hhffhh', 'h.ff.h', '.pppp.', 'hppppf', '.pppp.', '.l..l.', '.l..l.'],
      ['.hhhh.', 'hhffhh', 'hhffhh', 'h.ff.h', '.pppp.', 'hppppf', '.pppp.', '.l.l..', 'l...l.']
    ],
    ahmed: [
      ['.hhhh.', '.hffh.', '.ffff.', '..ff..', '.bbbb.', 'fbbbbf', '.bbbb.', '.l..l.', '.l..l.'],
      ['.hhhh.', '.hffh.', '.ffff.', '..ff..', '.bbbb.', 'fbbbbf', '.bbbb.', '.l.l..', 'l...l.']
    ]
  };
  const PAL = { h: '#2a1e18', f: '#f2c9a0', p: '#ff9ec4', b: '#6a8cff', l: '#3a3560' };
  const people = {};
  for (const who in PEOPLE) people[who] = PEOPLE[who].map(rows => { const r = S.make(rows, PAL); return [r, flipped(r)]; });
  function flipped(src) {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
    return c;
  }
  function person(who, face, walk) {
    const frames = people[who] || people.kamy;
    return frames[walk > 0 && Math.floor(walk * 8) % 2 ? 1 : 0][face < 0 ? 1 : 0];
  }

  const skyStars = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97) % 480, y: (i * 53) % 150, p: i % 7 }));
  function sky(g, vw, vh, cam, t) {
    const grad = g.createLinearGradient(0, 0, 0, vh);
    grad.addColorStop(0, '#0b0a24'); grad.addColorStop(1, '#2a2458');
    g.fillStyle = grad; g.fillRect(0, 0, vw, vh);
    for (const s of skyStars) {
      const x = Math.round(((s.x - cam.x * 0.2) % 480 + 480) % 480), y = s.y;
      if (x < vw && y < vh) px(g, Math.sin(t * 1.3 + s.p) > 0.5 ? '#8a8fd0' : '#3b3878', x, y);
    }
    g.fillStyle = '#1d1a44';
    for (let x = 0; x < vw; x++) { const hx = x + cam.x * 0.4; g.fillRect(x, Math.round(vh - 30 - Math.sin(hx * 0.03) * 8 - Math.sin(hx * 0.071) * 4), 1, 60); }
  }

  // editing: also shows the invisible things (notes, the start, hidden blocks)
  function draw(g, wd, vw, vh, opts = {}) {
    const cam = opts.cam || wd.camera(vw, vh), L = wd.L, t = wd.t;
    sky(g, vw, vh, cam, t);
    const x0 = Math.floor(cam.x / T), x1 = Math.ceil((cam.x + vw) / T), y0 = Math.floor(cam.y / T), y1 = Math.ceil((cam.y + vh) / T);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (y < 0 || y >= L.h || x < 0 || x >= L.w) continue;
      const c = wd.tiles[y][x], sx = x * T - cam.x, sy = y * T - cam.y, k = x + ',' + y;
      const above = y > 0 ? wd.tiles[y - 1][x] : '.';
      const grassy = !(above === '#' || above === '=');
      if (c === '#') g.drawImage(grassy ? groundTop() : groundIn(), sx, sy);
      else if (c === '=') {
        g.drawImage(grassy ? groundTop() : groundIn(), sx, sy);
        if (wd.seen[k] || opts.edit) { g.fillStyle = 'rgba(10,8,24,.55)'; g.fillRect(sx, sy, T, T); if (opts.edit) { px(g, '#ff5c8a', sx + 2, sy + 3, 4, 1); } }
      } else if (c === 'C') {
        const shake = wd.crumble[k] > 0 ? Math.round(Math.sin(t * 60)) : 0;
        g.drawImage(crumble(), sx + shake, sy);
      } else if (c === '^') g.drawImage(spikes(), sx, sy);
      else if (c === 'S') g.drawImage(spring(wd.spring[k] > 0 ? 1 : 0), sx, sy);
      else if (c === 'i') { if (wd.seen[k]) g.drawImage(hidden(), sx, sy); else if (opts.edit) { g.globalAlpha = 0.4; g.drawImage(hidden(), sx, sy); g.globalAlpha = 1; } }
      else if (c === 's') g.drawImage(sign(), sx, sy);
      else if (c === 'F' || c === 'f') g.drawImage(flag(c === 'f' ? 1 : 0), sx, sy - T);
      if (opts.edit && (c === 'f')) px(g, '#ff5c8a', sx + 5, sy + 5, 2, 2);
    }
    if (opts.edit) {
      for (const n of L.notes) g.drawImage(noteIcon(), n.x * T - cam.x, n.y * T - cam.y);
      g.drawImage(startIcon(), L.start.x * T - cam.x, L.start.y * T - cam.y);
    }
    // ghosts first, so she's always on top
    for (const gh of opts.ghosts || []) {
      g.globalAlpha = gh.alpha || 0.45;
      g.drawImage(person(gh.who, gh.face, gh.walk), Math.round(gh.x - cam.x), Math.round(gh.y - cam.y) - 1);
      g.globalAlpha = 1;
    }
    const p = wd.p;
    if (!opts.edit && !(p.dead && Math.floor(t * 20) % 2)) g.drawImage(person(opts.who, p.face, p.ground ? p.walk : 0), Math.round(p.x - cam.x), Math.round(p.y - cam.y) - 1);
    return cam;
  }

  /* ---- Touch pads and keys ------------------------------------------------ */
  // three pads along the bottom of the canvas: left, right, jump
  function pads(W, H, top) {
    const input = { left: false, right: false, jump: false };
    const who = {};   // pointer id -> pad
    const padAt = (x, y) => y < top ? null : x < W * 0.25 ? 'left' : x < W * 0.5 ? 'right' : 'jump';
    function sync() { input.left = input.right = input.jump = false; for (const k in who) if (who[k]) input[who[k]] = true; Object.assign(input, keys.left ? { left: true } : {}, keys.right ? { right: true } : {}, keys.jump ? { jump: true } : {}); }
    const keys = { left: false, right: false, jump: false };
    return {
      input,
      pointer(type, p, e) {
        const id = e ? e.pointerId : 0;
        if (type === 'down' || (type === 'move' && who[id] !== undefined)) who[id] = padAt(p.x, p.y);
        if (type === 'up' || type === 'cancel') delete who[id];
        sync();
      },
      key(type, k) {
        const down = type === 'down';
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = down;
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = down;
        else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'z' || k === 'Z') keys.jump = down;
        sync();
      },
      clear() { for (const k in who) delete who[k]; keys.left = keys.right = keys.jump = false; sync(); },
      draw(g) {
        g.fillStyle = '#0b0a24'; g.fillRect(0, top, W, H - top);
        const box = (x, w, on, glyph) => {
          g.fillStyle = on ? '#6d63b0' : '#2a2458'; g.fillRect(x + 2, top + 3, w - 4, H - top - 6);
          g.fillStyle = on ? '#fff3d6' : '#8a80cc';
          const cx = Math.round(x + w / 2), cy = Math.round(top + (H - top) / 2);
          if (glyph === 'L') for (let k = 0; k < 5; k++) g.fillRect(cx - 2 + k, cy - k, 1, k * 2 + 1);
          if (glyph === 'R') for (let k = 0; k < 5; k++) g.fillRect(cx + 2 - k, cy - k, 1, k * 2 + 1);
          if (glyph === 'J') for (let k = 0; k < 5; k++) g.fillRect(cx - k, cy - 2 + k, k * 2 + 1, 1);
        };
        box(0, W * 0.25, input.left, 'L'); box(W * 0.25, W * 0.25, input.right, 'R'); box(W * 0.5, W * 0.5, input.jump, 'J');
      }
    };
  }

  // who's playing: Kamy, unless this device was opened once with ?ahmed
  // (?kamy switches it back). Used for the player sprite and who made a level.
  const iam = (() => {
    try {
      const q = new URLSearchParams(location.search);
      if (q.has('ahmed')) localStorage.setItem('kamy.iam', 'ahmed');
      if (q.has('kamy')) localStorage.removeItem('kamy.iam');
      return localStorage.getItem('kamy.iam') === 'ahmed' ? 'ahmed' : 'kamy';
    } catch (e) { return 'kamy'; }
  })();

  // builds a level from a few fills instead of hand-typed rows
  function builder(w, h) {
    const g = Array.from({ length: h }, () => Array(w).fill('.'));
    const b = {
      set: (x, y, c) => { g[y][x] = c; return b; },
      fill: (x0, x1, y0, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c; return b; },
      rows: () => g.map(r => r.join(''))
    };
    return b;
  }

  return { create, draw, pads, person, builder, iam, T, PW, PH, flipped, art: { noteIcon, startIcon, groundTop, crumble, spikes, spring, hidden, sign, flag } };
})();
