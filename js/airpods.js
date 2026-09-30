/* The airpod hunt: she's lost 15 airpods over the years, and they all ended
   up here. Three messy piles (her bed, her backpack, the car): drag things
   out of the way and tap the airpods underneath. A few white things that
   are NOT airpods are mixed in. No timer to beat, but it tells her how
   long it took at the end. */
window.AIRPODS = (() => {
  'use strict';
  const C = window.KAMY, S = window.SPRITES;
  const P = C.airpods || {};
  const W = 160, H = 224, TOP = 22, OUT = '#1a1030';

  /* ---- The three piles --------------------------------------------------- */
  // count: airpods hidden in it; layers: how many things are on top of each
  const ROOMS = [
    { id: 'bed', name: 'your bed', count: 4, clutter: 30, layers: 1, decoys: ['tictac', 'bean'] },
    { id: 'backpack', name: 'your backpack', count: 5, clutter: 40, layers: 2, decoys: ['mint', 'tictac', 'qtip'] },
    { id: 'car', name: 'the car', count: 6, clutter: 46, layers: 2, decoys: ['tictac', 'mint', 'qtip', 'bean'] }
  ].map((r, i) => ({ ...r, ...((P.rooms || [])[i] || {}) }));
  const TOTAL = ROOMS.reduce((n, r) => n + r.count, 0);

  const KINDS = {
    bed: { cover: ['blanket', 'blanket', 'pillow', 'hoodie'], clutter: ['sock', 'sock', 'claw', 'phone', 'shirt', 'book', 'hoodie', 'pillow', 'blanket', 'balm', 'sock'] },
    backpack: { cover: ['book', 'book', 'hoodie', 'shirt'], clutter: ['book', 'book', 'book', 'book', 'hoodie', 'shirt', 'shirt', 'receipt', 'receipt', 'charger', 'bottle', 'id', 'keys', 'claw', 'phone', 'chips', 'sticky', 'balm'] },
    car: { cover: ['hoodie', 'blanket', 'bag', 'bag'], clutter: ['bag', 'bag', 'bag', 'hoodie', 'hoodie', 'blanket', 'shirt', 'cup', 'cup', 'cup', 'receipt', 'receipt', 'receipt', 'chips', 'bottle', 'charger', 'id', 'keys', 'sock', 'sticky', 'pineapple'] }
  };

  /* ---- Little helpers ---------------------------------------------------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k)));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('');
  }
  function flip(src) {
    const c = cv(src.width, src.height), g = c.getContext('2d');
    g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
    return c;
  }
  // a sprite plus which of its pixels are solid (for picking things up)
  function solid(c) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const mask = new Uint8Array(c.width * c.height);
    for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    return { c, mask, w: c.width, h: c.height };
  }
  const outlined = c => S.outline(c, OUT);
  const hits = (o, X, Y) => {
    const x = X - o.x, y = Y - o.y;
    return x >= 0 && y >= 0 && x < o.w && y < o.h && o.mask[y * o.w + x] === 1;
  };

  /* ---- The stuff in the piles -------------------------------------------- */
  const COLS = ['#ff9ec4', '#8fb3ff', '#ffd87a', '#9be3b0', '#c7a0ff', '#ff8a6b', '#7fd1c7', '#f4a8ff'];

  function blanket(w, h, col) {
    const c = cv(w, h), g = c.getContext('2d'), c2 = shade(col, 0.82), kind = ri(0, 2);
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.fillStyle = c2;
    if (kind === 0) for (let x = 2; x < w; x += 6) g.fillRect(x, 0, 2, h);
    else if (kind === 1) for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 * 4; x < w; x += 8) g.fillRect(x, y, 4, 4);
    else for (let y = 2; y < h; y += 4) for (let x = (y % 8 ? 5 : 2); x < w; x += 6) g.fillRect(x, y, 1, 1);
    g.fillStyle = shade(col, 1.12); g.fillRect(0, 0, w, 2);   // the hem
    g.clearRect(w - 1, h - 1, 1, 1); g.clearRect(0, h - 1, 1, 1);
    return c;
  }
  function pillow(w, h, col) {
    const c = cv(w, h), g = c.getContext('2d');
    g.fillStyle = col; g.fillRect(1, 0, w - 2, h); g.fillRect(0, 1, w, h - 2);
    g.fillStyle = shade(col, 1.12); g.fillRect(2, 1, w - 6, 1); g.fillRect(1, 2, 1, h - 5);
    g.fillStyle = shade(col, 0.85); g.fillRect(2, h - 2, w - 3, 1); g.fillRect(w - 2, 2, 1, h - 3);
    return c;
  }
  function book(w, h, col) {
    const c = cv(w, h), g = c.getContext('2d');
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.fillStyle = shade(col, 0.72); g.fillRect(0, 0, 3, h);
    g.fillStyle = '#fff4e2'; g.fillRect(w - 1, 1, 1, h - 1); g.fillRect(3, h - 1, w - 3, 1);
    g.fillStyle = shade(col, 1.25); g.fillRect(6, 3, w - 10, 2); g.fillRect(6, 6, w - 13, 1);
    return c;
  }
  function hoodie(col) {
    const w = ri(26, 36), h = Math.round(w * 0.8), sl = Math.round(w * 0.2), mid = w >> 1;
    const c = cv(w, h), g = c.getContext('2d'), d = shade(col, 0.8);
    g.fillStyle = col;
    g.fillRect(sl, 3, w - sl * 2, h - 3); g.fillRect(0, 4, sl, h - 6); g.fillRect(w - sl, 4, sl, h - 6);
    g.fillStyle = d;
    g.fillRect(mid - 5, 0, 10, 5);                                          // hood
    g.fillRect(mid - 6, Math.round(h * 0.6), 12, Math.round(h * 0.22));      // pocket
    g.fillRect(0, h - 5, sl, 3); g.fillRect(w - sl, h - 5, sl, 3); g.fillRect(sl, h - 2, w - sl * 2, 2); // cuffs
    g.fillStyle = '#fff4e2'; g.fillRect(mid - 2, 5, 1, 5); g.fillRect(mid + 1, 5, 1, 5); // strings
    return c;
  }
  function shirt(col) {
    const w = ri(20, 26), h = Math.round(w * 0.8), sl = 4, mid = w >> 1;
    const c = cv(w, h), g = c.getContext('2d');
    g.fillStyle = col; g.fillRect(sl, 1, w - sl * 2, h - 1); g.fillRect(0, 2, sl, 7); g.fillRect(w - sl, 2, sl, 7);
    g.fillStyle = shade(col, 0.78); g.fillRect(mid - 3, 1, 6, 2); g.fillRect(sl, h - 1, w - sl * 2, 1);
    g.clearRect(mid - 1, 1, 2, 1);
    return c;
  }
  // a crumpled takeout bag
  function bag() {
    const w = ri(18, 24), h = ri(22, 28), c = cv(w, h), g = c.getContext('2d');
    g.fillStyle = '#c9a36b'; g.fillRect(0, 3, w, h - 3);
    g.fillStyle = '#b08a55'; for (let x = 1; x < w; x += 2) g.fillRect(x, 0, 1, 4 + (x % 3)); // the crumpled top
    g.fillStyle = '#dcb97f'; g.fillRect(0, 3, w, 1);
    g.fillStyle = '#a07c48'; g.fillRect(w - 3, 4, 3, h - 4); g.fillRect(3, Math.round(h * 0.4), 1, Math.round(h * 0.3));
    g.fillStyle = pick(['#ff66a3', '#ff8a2a', '#e0473c']); g.fillRect((w >> 1) - 4, Math.round(h * 0.5), 7, 5);
    return c;
  }
  function receipt() {
    const w = ri(6, 8), h = ri(10, 14), c = cv(w, h), g = c.getContext('2d');
    g.fillStyle = '#f3ecdc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b9b0a0';
    for (let y = 2; y < h - 2; y += 2) g.fillRect(1, y, ri(2, w - 2), 1);
    for (let x = 0; x < w; x += 2) g.clearRect(x, h - 1, 1, 1);   // torn edge
    return c;
  }
  const grid = (rows, pal) => S.make(rows, pal);
  const MAKERS = {
    blanket: () => blanket(ri(44, 72), ri(28, 44), pick(COLS)),
    pillow: () => pillow(ri(32, 42), ri(18, 24), pick(['#fff0f6', '#e8e2ff', '#ffe9c7', '#dff5ff'])),
    book: () => Math.random() < 0.5 ? book(ri(18, 24), ri(24, 32), pick(COLS)) : book(ri(24, 32), ri(17, 22), pick(COLS)),
    hoodie: () => hoodie(pick(['#6d63b0', '#ff9ec4', '#5b6b8a', '#9be3b0', '#c4507e', '#8a6f45'])),
    shirt: () => shirt(pick(COLS)),
    receipt, bag,
    sock: () => grid(['cc...', 'ss...', 'cc...', 'cc...', 'ccc..', 'ccccc', '.cccc'], { c: pick(['#fff4e2', '#ff9ec4', '#8fb3ff', '#ffd87a']), s: '#c4507e' }),
    cup: () => grid(['WWWWWWW', '.WWWWW.', '.ppppp.', '.OOOOO.', '.OwOwO.', '.OOOOO.', '.ppppp.', '..ppp..'], { W: '#f4f0ff', p: '#ff66a3', O: '#ff8a2a', w: '#fff4e2' }),
    pineapple: () => grid(['g.g.g', '.ggg.', '..g..', 'yYyYy', 'YyYyY', 'yYyYy', 'YyYyY', '.yYy.'], { g: '#4caf50', y: '#ffd23f', Y: '#c98a1b' }),
    chips: () => grid(['RRRRRRRRR', 'RRRRRRRRR', '.RyyyyyR.', '.RyYYYyR.', '.RyYYYyR.', '.RyyyyyR.', '.RRRRRRR.', '.RRRRRRR.', 'RRRRRRRRR'], { R: pick(['#e0473c', '#4a7be0', '#3fa35a']), y: '#ffd23f', Y: '#ff8a2a' }),
    phone: () => grid(['kkkkk', 'kbbbk', 'kbBbk', 'kbbbk', 'kbbBk', 'kbbbk', 'kbbbk', 'kkkkk'], { k: '#2a2a3a', b: '#6a8cff', B: '#a8c0ff' }),
    id: () => grid(['OOOOOOOOOOO', 'OwwwOOkkkkO', 'OwswOOOOOOO', 'OwwwOOkkkOO', 'OOOOOOOOOOO', 'WWWWWWWWWWW'], { O: '#f76902', w: '#fff4e2', s: '#8a6f45', k: '#2a1e18', W: '#ffffff' }),
    keys: () => grid(['yyy.....', 'y.yyyyyy', 'yyy..y.y'], { y: '#ffd23f' }),
    claw: () => grid(['p.p.p.p', 'ppppppp', '.ppppp.'], { p: pick(['#ff9ec4', '#c7a0ff', '#8a6f45']) }),
    bottle: () => grid(['.cc.', '.cc.', 'BBBB', 'BbBB', 'BbBB', 'BbBB', 'WWWW', 'WWWW', 'BBBB', 'BBBB', 'BBBB'], { c: '#2a2a3a', B: '#7fd1c7', b: '#c8f0ea', W: '#fff4e2' }),
    charger: () => grid(['www.......', 'wwwwwwww..', 'www....w..', '.......w..', '....www...'], { w: '#e6e2f4' }),
    sticky: () => grid(['yyyyyyy', 'yyyyyyy', 'ykkkkyy', 'yyyyyyy', 'ykkkyyy', 'yyyyyyy'], { y: '#fff27a', k: '#b8a94a' }),
    balm: () => grid(['kk', 'pp', 'pp', 'pp', 'pp'], { k: '#fff4e2', p: '#ff66a3' })
  };
  function makeItem(kind) {
    let c = outlined(MAKERS[kind]());
    if (Math.random() < 0.5) c = flip(c);
    return { ...solid(c), kind, x: 0, y: 0 };
  }

  /* ---- The airpods (and the things that aren't) -------------------------- */
  const POD = S.outline(S.make(['.www.', 'wwwwg', 'wwwwg', '.wwg.', '..wg', '..wg', '..wg', '..gg'], { w: '#ffffff', g: '#b8bcd0' }), '#3a3560');
  const PODS = [POD, flip(POD)];
  const DECOYS = {
    tictac: S.make(['.ww.', 'wwww', '.ww.'], { w: '#ffffff' }),
    mint: S.make(['.ww.', 'wwbw', 'wwww', '.ww.'], { w: '#ffffff', b: '#8fd3ff' }),
    qtip: S.make(['ww.....ww', 'wwsssssww', 'ww.....ww'], { w: '#ffffff', s: '#e8e4f8' }),
    bean: S.make(['.bb.', 'bbbb', 'bBbb', '.bb.'], { b: '#c89a6a', B: '#8a5a3a' })
  };
  const DECOY_LINES = Object.assign({
    tictac: 'a tic tac. not an airpod.',
    mint: 'a mint. close, but no.',
    qtip: 'a q-tip. nice try.',
    bean: 'a bean. ew. you hate beans.'
  }, P.decoys || {});
  // the tiny one lying in the grass on the main scene
  const tiny = S.make(['ww.', 'wwg', '.wg', '.wg'], { w: '#ffffff', g: '#b8bcd0' });

  /* ---- Backgrounds ------------------------------------------------------- */
  function background(id) {
    const c = cv(W, H), g = c.getContext('2d');
    if (id === 'bed') {
      g.fillStyle = '#8f82cc'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#9d91d8';
      for (let y = 0; y < H; y += 12) for (let x = (y / 12) % 2 * 6; x < W; x += 12) { g.fillRect(x + 2, y + 1, 1, 3); g.fillRect(x + 1, y + 2, 3, 1); }
      g.fillStyle = '#7a6db8'; for (let y = 36; y < H; y += 48) g.fillRect(0, y, W, 1);   // wrinkles
    } else if (id === 'backpack') {
      g.fillStyle = '#2e3456'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#363d66';
      for (let y = 0; y < H; y += 3) for (let x = y % 6 ? 1 : 0; x < W; x += 3) g.fillRect(x, y, 1, 1);
      g.fillStyle = '#8a8fb0';                                                       // zipper around the edge
      for (let x = 0; x < W; x += 3) { g.fillRect(x, 0, 2, 2); g.fillRect(x, H - 2, 2, 2); }
      for (let y = 0; y < H; y += 3) { g.fillRect(0, y, 2, 2); g.fillRect(W - 2, y, 2, 2); }
    } else {
      g.fillStyle = '#4a4858'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#3c3a48';
      for (let x = 20; x < W; x += 40) g.fillRect(x, 0, 1, H * 0.62);                // seat stitching
      g.fillStyle = '#55536a';
      for (let y = 4; y < H * 0.62; y += 5) for (let x = 4 + (y % 10 ? 2 : 0); x < W; x += 5) g.fillRect(x, y, 1, 1);
      g.fillStyle = '#2f2d38'; g.fillRect(0, Math.round(H * 0.62), W, H);            // the floor mat
      g.fillStyle = '#383644';
      for (let y = Math.round(H * 0.62) + 3; y < H; y += 4) g.fillRect(6, y, W - 12, 1);
    }
    return c;
  }

  /* ---- Building a pile --------------------------------------------------- */
  // is every solid pixel of `small` hidden under `it`?
  function covers(it, small) {
    for (let y = 0; y < small.h; y++) for (let x = 0; x < small.w; x++) {
      if (small.mask[y * small.w + x] && !hits(it, small.x + x, small.y + y)) return false;
    }
    return true;
  }
  function coverOver(small, kinds) {
    for (let k = 0; k < 40; k++) {
      const it = makeItem(pick(kinds)), wob = 1 - k / 40;
      it.x = Math.round(small.x + small.w / 2 - it.w / 2 + rnd(-0.3, 0.3) * it.w * wob);
      it.y = Math.round(small.y + small.h / 2 - it.h / 2 + rnd(-0.3, 0.3) * it.h * wob);
      if (covers(it, small)) return it;
    }
    return null;
  }
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function buildPile(room) {
    const K = KINDS[room.id], spots = [];
    const place = sprite => {
      for (let k = 0; k < 200; k++) {
        const x = ri(12, W - 12 - sprite.width), y = ri(TOP + 10, H - 14 - sprite.height);
        if (spots.every(p => Math.hypot(p.x - x, p.y - y) > 18)) { const o = { ...solid(sprite), x, y }; spots.push(o); return o; }
      }
      const o = { ...solid(sprite), x: ri(12, W - 20), y: ri(TOP + 10, H - 24) };
      spots.push(o);
      return o;
    };
    const pods = Array.from({ length: room.count }, () => ({ ...place(pick(PODS)), pod: true, found: false }));
    const decoys = room.decoys.map(id => ({ ...place(DECOYS[id]), decoy: id, found: false }));
    const items = [];
    for (const p of pods) for (let l = 0; l < room.layers; l++) { const it = coverOver(p, K.cover); if (it) items.push(it); }
    for (const d of decoys) { const it = coverOver(d, K.cover.concat(K.clutter)); if (it) items.push(it); }
    for (let n = 0; n < room.clutter; n++) {
      const it = makeItem(pick(K.clutter));
      it.x = ri(Math.round(-it.w * 0.2), Math.round(W - it.w * 0.8));
      it.y = ri(TOP, Math.round(H - it.h * 0.8));
      items.push(it);
    }
    return { pods, decoys, items: shuffle(items) };
  }

  /* ---- Game -------------------------------------------------------------- */
  let api = null, s = null;

  function start(a) {
    api = a;
    s = null;
    api.show([
      api.el('h3', 'game-title', P.title || 'the airpod hunt'),
      api.el('p', 'line', P.intro || ''),
      api.el('p', 'line', ROOMS[0].line || ''),
      api.button('start looking', () => begin(0))
    ]);
  }

  function begin(i, keep) {
    api.hideScreen();
    const room = ROOMS[i], pile = buildPile(room);
    s = {
      i, room, ...pile, bg: background(room.id), t: 0,
      found: keep ? keep.found : 0, time: keep ? keep.time : 0,
      drag: null, fx: [], msg: '', msgT: 0, idle: 0, hintT: 0, phase: 'play'
    };
    hud();
  }

  function hud() {
    if (!s || s.phase === 'done') return;
    api.setHud(s.msg ? s.msg : `${s.room.name} · ${s.found}/${TOTAL}`);
  }
  function say(msg) { s.msg = msg; s.msgT = 2.4; hud(); }

  const covered = (X, Y) => s.items.some(it => it !== (s.drag && s.drag.item) && hits(it, X, Y));
  // how much of an airpod (or decoy) is showing, 0 to 1
  function showing(o) {
    let n = 0, open = 0;
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      if (!o.mask[y * o.w + x]) continue;
      n++;
      if (!covered(o.x + x, o.y + y)) open++;
    }
    return n ? open / n : 0;
  }
  const smalls = () => s.pods.concat(s.decoys).filter(o => !o.found);
  // the airpod or decoy nearest the finger, if enough of it is showing
  function smallAt(p, reach, need) {
    let best = null, bd = reach;
    for (const o of smalls()) {
      const d = Math.hypot(p.x - (o.x + o.w / 2), p.y - (o.y + o.h / 2));
      if (d <= bd && showing(o) >= need) { bd = d; best = o; }
    }
    return best;
  }
  function itemAt(p) {
    const X = Math.floor(p.x), Y = Math.floor(p.y);
    for (let k = s.items.length - 1; k >= 0; k--) if (hits(s.items[k], X, Y)) return s.items[k];
    return null;
  }

  function pointer(type, p) {
    if (!s || s.phase !== 'play' || api.screenOpen()) return;
    if (type === 'down') {
      // an airpod that's clearly showing wins over the stuff next to it
      const easy = smallAt(p, 5, 0.6);
      if (easy) return grab(easy);
      const it = itemAt(p);
      if (it) {
        s.items.splice(s.items.indexOf(it), 1);
        s.items.push(it);   // whatever she picks up comes to the top
        s.drag = { item: it, dx: p.x - it.x, dy: p.y - it.y };
        return;
      }
      const o = smallAt(p, 7, 0.3);
      if (o) grab(o);
    } else if (type === 'move' && s.drag) {
      const it = s.drag.item;
      it.x = Math.round(p.x - s.drag.dx);
      it.y = Math.round(p.y - s.drag.dy);
    } else if ((type === 'up' || type === 'cancel') && s.drag) {
      const it = s.drag.item;
      s.drag = null;
      // dropped off the edge: it's gone
      const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
      if (cx < 0 || cx > W || cy < TOP - 6 || cy > H) {
        s.items.splice(s.items.indexOf(it), 1);
        api.sfx('close');
      }
    }
  }

  function grab(o) {
    o.found = true;
    s.idle = 0;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      s.fx.push({ type: 'spark', x: cx, y: cy, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26, t: 0, life: 0.5, col: o.pod ? '#fff3d6' : '#8a8fb0' });
    }
    if (o.decoy) {
      s.fx.push({ type: 'toss', c: o.c, x: o.x, y: o.y, vx: rnd(-30, 30), vy: -60, t: 0, life: 1 });
      api.sfx('sad');
      return say(DECOY_LINES[o.decoy] || 'not an airpod.');
    }
    s.found++;
    s.fx.push({ type: 'fly', c: o.c, x: o.x, y: o.y, t: 0, life: 0.8 });
    api.sfx(s.found === TOTAL ? 'win' : 'pickup');
    const line = P.found && P.found[s.found];
    if (line) say(line); else { s.msg = ''; hud(); }
    if (s.pods.every(q => q.found)) { s.phase = 'clear'; setTimeout(roomDone, 1100); }
  }

  function roomDone() {
    if (!s) return;
    const next = ROOMS[s.i + 1];
    if (!next) return finish();
    const keep = { found: s.found, time: s.time };
    api.showSoft([
      api.el('h3', 'game-title', `${s.found}/${TOTAL}`),
      api.el('p', 'line', next.line || `now ${next.name}.`),
      api.button('keep looking', () => begin(s.i + 1, keep))
    ]);
  }

  const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  function finish() {
    s.phase = 'done';
    const line = api.el('p', 'win-note', '');
    api.show([
      api.el('h3', 'game-title', P.doneTitle || `${TOTAL}/${TOTAL}`),
      line,
      api.el('p', 'line', `found in ${clock(s.time)}.`),
      api.button('back to the field', () => api.close({ complete: true, time: s.time }))
    ]);
    api.typeInto(line, P.doneLine || '');
    api.setHud('');
  }

  function update(dt) {
    if (!s) return;
    s.t += dt;
    if (s.phase === 'play' && !api.screenOpen()) { s.time += dt; s.idle += dt; }
    if (s.msgT > 0 && (s.msgT -= dt) <= 0) { s.msg = ''; hud(); }
    for (const f of s.fx) {
      f.t += dt;
      if (f.type === 'spark' || f.type === 'toss') { f.x += f.vx * dt; f.y += f.vy * dt; if (f.type === 'toss') f.vy += 200 * dt; }
    }
    s.fx = s.fx.filter(f => f.t < f.life);
    // stuck for a while: something shimmers where one is hiding
    if (s.idle > 25 && s.phase === 'play') {
      s.hintT -= dt;
      if (s.hintT <= 0) {
        s.hintT = 5;
        const o = pick(s.pods.filter(q => !q.found));
        if (o) {
          s.fx.push({ type: 'hint', x: o.x + o.w / 2, y: o.y + o.h / 2, t: 0, life: 1.2 });
          if (!s.hinted) { s.hinted = true; say(P.hint || 'hmm. something\'s under there...'); }
        }
      }
    }
  }

  function star(g, x, y, col, big) {
    x = Math.round(x); y = Math.round(y);
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
    if (big) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
  }

  function render(g) {
    if (!s) { g.fillStyle = '#2e3456'; g.fillRect(0, 0, W, H); return; }
    g.drawImage(s.bg, 0, 0);
    for (const o of smalls()) g.drawImage(o.c, o.x, o.y);
    for (const it of s.items) {
      if (s.drag && it === s.drag.item) {
        // lifted: a soft shadow underneath and a highlight around it
        g.globalAlpha = 0.35;
        g.drawImage(it.shadow || (it.shadow = silhouette(it.c)), it.x + 2, it.y + 3);
        g.globalAlpha = 1;
        g.drawImage(it.glow || (it.glow = S.outline(it.c, '#fff3d6')), it.x - 1, it.y - 2);
      } else g.drawImage(it.c, it.x, it.y);
    }
    // airpods that are showing catch the light now and then
    for (const o of s.pods) {
      if (o.found) continue;
      const ph = (s.t * 0.7 + o.x * 0.013) % 1;
      if (ph < 0.12 && showing(o) > 0.4) star(g, o.x + 2, o.y + 2, '#ffffff', ph > 0.04 && ph < 0.08);
    }
    for (const f of s.fx) {
      const k = f.t / f.life;
      if (f.type === 'spark') star(g, f.x, f.y, f.col, false);
      else if (f.type === 'toss') { g.globalAlpha = 1 - k; g.drawImage(f.c, Math.round(f.x), Math.round(f.y)); g.globalAlpha = 1; }
      else if (f.type === 'fly') {
        // floats up into the counter
        const e = k * k, x = f.x + (W - 20 - f.x) * e, y = f.y + (4 - f.y) * e;
        g.globalAlpha = 1 - k * 0.6; g.drawImage(f.c, Math.round(x), Math.round(y)); g.globalAlpha = 1;
      } else if (f.type === 'hint') {
        const r = Math.round(3 + k * 6);
        g.fillStyle = k < 0.5 ? '#fff3d6' : '#a99fe0';
        for (let a = 0; a < 8; a++) g.fillRect(Math.round(f.x + Math.cos(a * Math.PI / 4) * r), Math.round(f.y + Math.sin(a * Math.PI / 4) * r), 1, 1);
      }
    }
  }
  function silhouette(src) {
    const c = cv(src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#0a0818'; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  const def = {
    W, H, start, update, render, pointer, stop: () => { s = null; },
    help: `you've lost ${TOTAL} airpods, and they're all hiding in three messy piles. drag things out of the way (drop them off the edge to get rid of them), then tap an airpod when you can see it. careful: not everything small and white is an airpod. if you're stuck for a while, something will shimmer where one is hiding.`
  };
  return {
    open: done => window.MINI.open(def, done),
    tiny, TOTAL,
    debug: {
      state: () => s && { i: s.i, found: s.found, phase: s.phase, left: s.pods.filter(q => !q.found).length, items: s.items.length },
      pods: () => s && s.pods.map(o => ({ x: o.x + o.w / 2, y: o.y + o.h / 2, found: o.found, showing: showing(o) })),
      clear: () => { if (s) s.items = []; },
      level: i => begin(i, s && { found: s.found, time: s.time })
    }
  };
})();
