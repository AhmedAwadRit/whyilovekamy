/* "Snack attack": a tiny vertical shooter.
   Shoot the foods she hates, catch the ones she loves, beat the boss. */
window.GAME = (() => {
  'use strict';
  const C = window.KAMY, S = window.SPRITES, A = window.AUDIO;
  const G = C.game || {};
  const $ = id => document.getElementById(id);
  const W = 160, H = 224;
  const KILLS = G.killsToBoss || 24;
  const BOSS_HP = 90;
  const MAX_HP = 5;

  /* ---- Sprites ---------------------------------------------------------- */
  const OUT = '#1a1030';
  const whiteOf = rows => S.make(rows.map(r => r.replace(/[^.]/g, '#')), { '#': '#ffffff' });

  // Foods she doesn't like (enemies)
  const FOES = [
    { name: 'tomato', hp: 1, pal: { r: '#e8453c', h: '#ff9a8a', d: '#a82a2a', g: '#3fa34d' }, rows: [
      '...g.g...', '....g....', '.rrrrrrr.', 'rhhrrrrrr', 'rhrrrrrrr', 'rrrrrrrrd', 'rrrrrrrrd', '.rrrrrdd.', '..rrrdd..'] },
    { name: 'banana', hp: 1, pal: { y: '#ffe066', d: '#d4a52a', k: '#5a3d1e' }, rows: [
      '.........k', '........yk', '.......yy.', '......yyd.', '....yyyyd.', '..yyyyydd.', 'kyyyyydd..', '.ddddd....'] },
    { name: 'coriander', hp: 1, pal: { g: '#4caf50', G: '#8be08e', s: '#2e7d32' }, rows: [
      '.gg...gg.', 'gGgg.gGgg', '.ggg.ggg.', '..gg.gg..', '...s.s...', '.gg.s.gg.', 'gGgg.gGgg', '.gg.s.gg.', '....s....', '....s....'] },
    { name: 'cilantro', hp: 1, pal: { g: '#62c466', G: '#b0f0a0', s: '#357a38' }, rows: [
      '..gg...gg', '.gGgg.gGg', '..ggg.gg.', '...gg.g..', '....s.s..', '..gg.s.gg', '.gGgg.gGg', '..gg.s.g.', '.....s...', '.....s...'] },
    { name: 'onion', hp: 1, pal: { p: '#c98ad6', w: '#f3dff7', g: '#6fbf5a' }, rows: [
      '....g....', '....g....', '...ppp...', '..ppwpp..', '.pppwppp.', 'ppppwpppp', 'ppppwpppp', '.pppwppp.', '..ppppp..', '...w.w...'] },
    { name: 'beans', hp: 1, pal: { b: '#8b3a2e', h: '#c96a5a' }, rows: [
      '.bb...bb..', 'bbbb.bbbb.', 'bhbb.bhbb.', 'bbb..bbb..', '...bb.....', '..bbbb....', '..bhbb....', '..bbb.....'] },
    { name: 'cabbage', hp: 3, pal: { c: '#9ccc65', C: '#d7f0a8' }, rows: [
      '..cccccc..', '.cCccccCc.', 'cccCccCccc', 'ccccCCcccc', 'ccccCCcccc', 'cccCccCccc', '.cCccccCc.', '..cccccc..'] },
    { name: 'broccoli', hp: 2, pal: { g: '#2e7d32', G: '#66bb6a', l: '#9ccc65' }, rows: [
      '..gg.gg...', '.gggggggg.', 'gggGgggGgg', 'gGgggGgggg', '.gggggggg.', '...lll....', '....ll....', '...lll....', '...ll.....'] },
    { name: 'sweet melon', hp: 3, pal: { m: '#e6c27a', n: '#b8924a' }, rows: [
      '..mmmmmm..', '.mnmmnmmm.', 'mmmnmmnmmm', 'mnmmnmmnmm', 'mmnmmnmmnm', 'mmmnmmnmmm', '.mnmmnmmm.', '..mmmmmm..'] }
  ];

  // Foods she loves (catch them: +1 heart and triple shot)
  const FAVES = [
    { name: 'pineapple', pal: { y: '#ffd23f', o: '#c98a1b', g: '#4caf50' }, rows: [
      '..g.g.g..', '...ggg...', '..g.g.g..', '...ggg...', '..yyyyy..', '.yoyyyoy.', '.yyoyoyy.', '.yyyoyyy.', '.yyoyoyy.', '.yoyyyoy.', '.yyyyyyy.', '..yyyyy..'] },
    { name: 'sweet corn', pal: { y: '#ffe066', Y: '#fff3a8', g: '#4caf50' }, rows: [
      'g.....g', '.g.y.g.', '.gyyyg.', 'gyYyYyg', 'gyyYyyg', 'gyYyYyg', 'gyyYyyg', 'gyYyYyg', '.gyyyg.', '..gyg..', '...g...'] },
    { name: 'sweet potato', pal: { p: '#c75b7a', h: '#e88ba3', d: '#8e3a55' }, rows: [
      '....ppppp...', '..pppppppp..', '.pphppppppp.', 'pppppppppppp', '.ppppppppdp.', '..pppppddd..', '....dddd....'] },
    { name: 'cucumber', pal: { g: '#3d9a4a', G: '#7ed17f', d: '#2a6b33' }, rows: [
      '..ggggggg...', '.gGgGgGgggg.', 'gggggggggggg', 'gGggGggGgggg', '.ggggggggggd', '..ddddddddd.'] },
    { name: 'lychee', pal: { r: '#d64561', R: '#ff8fa6', g: '#4caf50' }, rows: [
      '....g....', '..rrrrr..', '.rRrrRrr.', 'rrrrRrrRr', 'rRrrrrRrr', 'rrrRrrrrr', '.rrrrRrr.', '..rrrrr..'] }
  ];

  [...FOES, ...FAVES].forEach(f => { f.img = S.make(f.rows, f.pal); f.flash = whiteOf(f.rows); });

  const SHIP_ROWS = [
    '.....w.....', '....www....', '....wbw....', '...wwbww...', '..wwwwwww..',
    '.pwwwwwwwp.', 'ppwwpwpwwpp', 'pp.wwwww.pp', 'p...fff...p', '....f.f....'];
  const SHIP_PAL = { w: '#f5f0ff', b: '#6ec6ff', p: '#ff7aa8', f: '#ffd23f' };
  const ship = [
    S.make(SHIP_ROWS, SHIP_PAL),
    S.make(SHIP_ROWS.map((r, i) => i === 9 ? '...f...f...' : i === 8 ? 'p...fFf...p' : r), { ...SHIP_PAL, F: '#ff8a3d' })
  ];

  const BOSS_ROWS = [
    'K............................K',
    'kK..........................Kk',
    '.kK........................Kk.',
    '.kkK......................Kkk.',
    '..kkK....rrrrrrrrrrrr....Kkk..',
    '..kkkKrrrrrrrrrrrrrrrrrrKkkk..',
    '...kkrRRRrrrrrrrrrrrrRRRrkk...',
    '....rRRrrrrrrrrrrrrrrrrRRr....',
    '...rrrrrrrrrrrrrrrrrrrrrrrr...',
    '..rrrddddrrrrrrrrrrrrddddrrr..',
    '..rrrrrdddrrrrrrrrrrdddrrrrr..',
    '.rrrryyyyyrrrrrrrrrryyyyyrrrr.',
    '.rrryyyeyyyrrrrrrrryyyeyyyrrr.',
    '.rrryyeeeyyrrrrrrrryyeeeyyrrr.',
    '.rrrryyyyyrrrrrrrrrryyyyyrrrr.',
    '.rrrrrrrrrrrrddrrrrrrrrrrrrrr.',
    '.rrrrrrrrrrrdrrdrrrrrrrrrrrrr.',
    '..rrrrrrrrrrrrrrrrrrrrrrrrrr..',
    '..rrreeeeeeeeeeeeeeeeeeeerrr..',
    '..rrewwewwewwewwewwewwewerrr..',
    '...rreeeeeeeeeeeeeeeeeeeerr...',
    '...rrewewewewewewewewewewerr..',
    '....rreeeeeeeeeeeeeeeeeerr....',
    '.....rrrrrrrrrrrrrrrrrrrr.....',
    '.......rrrrrrrrrrrrrrrr.......',
    '.........dddddddddddd.........'
  ];
  const boss = S.make(BOSS_ROWS, { k: '#f2e6c9', K: '#b8a47a', r: '#c62f3a', R: '#e85a5a', d: '#6e1420', y: '#ffe066', e: '#1a1030', w: '#ffffff' });
  const bossFlash = whiteOf(BOSS_ROWS);
  const heartFull = S.heart;
  const heartEmpty = S.make(['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], { r: '#3b3878' });

  /* ---- DOM -------------------------------------------------------------- */
  const root = $('game'), frame = $('game-frame'), cv = $('game-canvas');
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const screen = $('game-screen');
  let scale = 3;

  function fit() {
    const s = Math.min(window.innerWidth / W, (window.innerHeight * 0.96) / H);
    scale = s;
    frame.style.width = W * scale + 'px';
    frame.style.height = H * scale + 'px';
  }

  const icon = (c, zoom) => { const i = new Image(); i.src = c.toDataURL(); i.width = c.width * zoom; i.height = c.height * zoom; i.alt = ''; return i; };

  function floater(x, y, text, cls) {
    const d = document.createElement('div');
    d.className = 'floater ' + (cls || '');
    d.textContent = text;
    d.style.left = (x / W) * 100 + '%';
    d.style.top = (y / H) * 100 + '%';
    $('game-floaters').appendChild(d);
    setTimeout(() => d.remove(), 1100);
  }

  function renderHud() {
    const hearts = $('game-hearts');
    if (run.mode === 'party') {
      hearts.replaceChildren();
      $('game-score').textContent = `${Math.max(0, Math.ceil(run.time))}s · ${run.stack.length} high`;
      $('boss-bar').hidden = true;
      return;
    }
    hearts.replaceChildren(...Array.from({ length: MAX_HP }, (_, i) => icon(i < run.hp ? heartFull : heartEmpty, 2)));
    $('game-score').textContent = run.boss ? '' : `${Math.min(run.kills, KILLS)}/${KILLS}`;
    const bar = $('boss-bar');
    bar.hidden = !run.boss;
    if (run.boss) $('boss-hp').style.width = Math.max(0, run.boss.hp / BOSS_HP) * 100 + '%';
  }

  /* ---- Screens (briefing / game over / win) ----------------------------- */
  function show(parts) {
    screen.replaceChildren(...parts);
    screen.hidden = false;
    fireBtn.hidden = true;
    keys.delete(' '); mouseFire = false; fireOff();
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const button = (text, fn) => { const b = el('button', 'pixel-btn', text); b.type = 'button'; b.addEventListener('click', e => { e.stopPropagation(); A.sfx('blip'); fn(); }); return b; };
  function foodGrid(list) {
    const grid = el('div', 'food-grid');
    list.forEach(f => { const c = el('figure', 'food'); c.append(icon(f.img, 3), el('figcaption', '', f.name)); grid.appendChild(c); });
    return grid;
  }

  function briefing() {
    const touch = matchMedia('(hover: none)').matches;
    show([
      el('h3', 'game-title', G.title || 'snack attack'),
      el('p', 'label', 'shoot these:'),
      foodGrid(FOES),
      el('p', 'label good', 'catch these (don\'t shoot them!)'),
      foodGrid(FAVES),
      el('p', 'hint', touch
        ? 'drag to fly. hold the fire button to shoot.'
        : 'arrow keys or mouse to fly. hold space (or click) to shoot.'),
      button('start', () => begin(false)),
      ...(hasWon() ? [button(G.afterpartyButton || 'afterparty', partyIntro)] : [])
    ]);
  }

  function gameOver() {
    run.phase = 'over';
    A.sfx('hurt');
    const parts = [el('h3', 'game-title', 'game over'), el('p', 'line', G.loseLine || '')];
    if (run.reachedBoss) parts.push(button(`fight ${G.bossName || 'the boss'} again`, () => begin(true)));
    parts.push(button('start over', () => begin(false)), button('leave', close));
    setTimeout(() => show(parts), 700);
  }

  function win() {
    run.phase = 'won';
    A.sfx('win');
    try { localStorage.setItem('kamy.game.won', '1'); } catch (e) {}
    const note = el('p', 'win-note', '');
    // a secret symbol, tucked into the victory screen
    const sym = el('button', 'secret-sym');
    if (window.SECRET) {
      sym.type = 'button'; sym.setAttribute('aria-label', 'a tiny symbol');
      const im = new Image(); im.src = window.SECRET.img('crown');
      const num = el('b', '', window.SECRET.has('crown') ? '3' : '');
      sym.append(im, num);
      if (window.SECRET.has('crown')) sym.classList.add('found');
      sym.addEventListener('click', e => { e.stopPropagation(); window.SECRET.found('crown'); num.textContent = '3'; sym.classList.add('found'); });
    }
    show([
      el('h3', 'game-title', G.winTitle || 'you win!'),
      el('p', 'line', G.winSubtitle || ''),
      note,
      sym,
      button(G.afterpartyButton || 'afterparty', partyIntro),
      button('play again', () => begin(false)),
      button('back to the stars', close)
    ]);
    const text = G.winNote || '';
    let i = 0;
    const timer = setInterval(() => {
      if (!screen.contains(note)) return clearInterval(timer);
      note.textContent = text.slice(0, ++i);
      if (i % 3 === 0) A.sfx('type');
      if (i >= text.length) clearInterval(timer);
    }, 38);
  }

  /* ---- Afterparty: stack her favourite foods into a victory snack ------- */
  const HORN = { name: "sofian's horn", pal: { k: '#f2e6c9', K: '#b8a47a' }, rows: ['K....', 'kK...', '.kK..', '.kkK.', '..kkK', '..kkk'] };
  HORN.img = S.make(HORN.rows, HORN.pal);
  const PLATE = S.make(['wwwwwwwwwwwwwwwwww', '.gwwwwwwwwwwwwwwg.', '..gggggggggggggg..'], { w: '#f5f0ff', g: '#b9b3d9' });
  const ADJ = { pineapple: 'Tropical', 'sweet corn': 'Golden', 'sweet potato': 'Cozy', cucumber: 'Crunchy', lychee: 'Juicy', "sofian's horn": 'Devilish' };
  const hasWon = () => { try { return localStorage.getItem('kamy.game.won') === '1'; } catch (e) { return false; } };
  let pendingSnack = null;

  function snackName(stack) {
    if (!stack.length) return 'An Empty Plate (a bold choice)';
    const counts = {};
    stack.forEach(s => { counts[s.f.name] = (counts[s.f.name] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const most = top[0][1];
    const mult = most >= 6 ? 'Mega ' : most >= 4 ? 'Quadruple ' : most === 3 ? 'Triple ' : most === 2 ? 'Double ' : '';
    const adj = top.slice(0, 2).map(([n]) => ADJ[n] || 'Mystery').join('-');
    const n = stack.length;
    const noun = n <= 3 ? 'Bite' : n <= 7 ? 'Stack' : n <= 12 ? 'Tower' : n <= 18 ? 'Skyscraper' : 'Space Elevator';
    const suffix = counts["sofian's horn"] ? "of Sofian's Defeat" : ['Supreme', 'Deluxe', 'Royale', 'Extravaganza'][n % 4];
    return `The ${mult}${adj} ${noun} ${suffix}`;
  }

  function partyIntro() {
    show([
      el('h3', 'game-title', G.afterpartyButton || 'afterparty'),
      el('p', 'line', G.afterpartyIntro || ''),
      foodGrid(FAVES),
      el('p', 'hint', matchMedia('(hover: none)').matches ? 'drag to move the plate.' : 'arrow keys or mouse to move the plate.'),
      button('go', beginParty)
    ]);
  }

  function beginParty() {
    screen.hidden = true;
    fireBtn.hidden = true;
    run = { mode: 'party', phase: 'party', t: 0, time: G.afterpartyTime || 35, x: W / 2, y: H - 20, stack: [], falling: [], tumbling: [], parts: [], spawnT: 0.4, shake: 0, cam: 0, hp: 0 };
    renderHud();
  }

  // where each stacked food sits (x centre, top y) and where the next one lands
  function stackLayout() {
    let x = run.x, yb = H - 13;
    const pos = [];
    for (const s of run.stack) {
      x += s.dx;
      const h = s.f.img.height;
      pos.push({ s, x, top: yb - h });
      yb = yb - h + 2;
    }
    return { pos, x, y: yb };
  }

  function updateParty(dt) {
    const r = run;
    r.t += dt;
    if (r.phase === 'party') {
      const kx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
      r.x += kx * 110 * dt;
      if (mouse) { const dx = mouse.x - r.x; r.x += Math.sign(dx) * Math.min(Math.abs(dx), 170 * dt); }
      r.x = Math.max(10, Math.min(W - 10, r.x));
      const before = Math.ceil(r.time);
      r.time -= dt;
      if (Math.ceil(r.time) !== before) renderHud();
      if (r.time <= 0) return endParty();
      r.spawnT -= dt;
      if (r.spawnT <= 0) {
        r.spawnT = 0.55 + Math.random() * 0.45;
        const f = Math.random() < 0.07 ? HORN : FAVES[Math.floor(Math.random() * FAVES.length)];
        r.falling.push({ f, x: 10 + Math.random() * (W - 20), y: -r.cam - 8, vy: 34 + Math.random() * 20 + (35 - r.time) * 0.8 });
      }
    }
    const top = stackLayout();
    r.cam += (Math.max(0, 70 - top.y) - r.cam) * Math.min(1, dt * 3); // follow a tall stack upward
    for (const it of r.falling) {
      it.y += it.vy * dt;
      const h = it.f.img.height;
      if (r.phase === 'party' && Math.abs(it.x - top.x) < 9 && it.y + h / 2 >= top.y && it.y + h / 2 < top.y + 7) {
        it.caught = true;
        r.stack.push({ f: it.f, dx: Math.max(-4, Math.min(4, Math.round(it.x - top.x))) });
        A.sfx('pickup');
        floater(it.x, top.y - h + r.cam, it.f.name, 'yum');
        balance();
        renderHud();
      }
    }
    r.falling = r.falling.filter(it => !it.caught && it.y < H + 12);
    for (const tb of r.tumbling) { tb.x += tb.vx * dt; tb.y += tb.vy * dt; tb.vy += 170 * dt; tb.rot += tb.vr * dt; }
    r.tumbling = r.tumbling.filter(tb => tb.y < H + 30);
    for (const p of r.parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; }
    r.parts = r.parts.filter(p => p.age < p.life);
    r.shake = Math.max(0, r.shake - dt);
  }

  // lean too far and the top of the stack slides off (silly, not fatal)
  function balance() {
    const lean = run.stack.reduce((a, s) => a + s.dx, 0);
    if (Math.abs(lean) <= 11 || run.stack.length < 4) return;
    const { pos } = stackLayout();
    const n = Math.ceil(run.stack.length / 3);
    const falling = pos.slice(-n);
    run.stack.splice(run.stack.length - n);
    falling.forEach(p => run.tumbling.push({ f: p.s.f, x: p.x, y: p.top + p.s.f.img.height / 2, vx: Math.sign(lean) * (20 + Math.random() * 30), vy: -30, rot: 0, vr: Math.sign(lean) * 6 }));
    floater(run.x, H * 0.4, 'whoa!', 'sad');
    A.sfx('sad');
    run.shake = 0.3;
  }

  function snackImage() {
    const { pos } = stackLayout();
    const minX = Math.min(run.x - 9, ...pos.map(p => p.x - p.s.f.img.width / 2));
    const maxX = Math.max(run.x + 9, ...pos.map(p => p.x + p.s.f.img.width / 2));
    const minY = Math.min(H - 14, ...pos.map(p => p.top));
    const c = S.canvas(Math.ceil(maxX - minX) + 2, Math.ceil(H - 11 - minY) + 2);
    const cg = c.getContext('2d');
    cg.drawImage(PLATE, Math.round(run.x - 9 - minX + 1), Math.round(H - 14 - minY + 1));
    pos.forEach(p => cg.drawImage(p.s.f.img, Math.round(p.x - p.s.f.img.width / 2 - minX + 1), Math.round(p.top - minY + 1)));
    return c;
  }

  function endParty() {
    const r = run;
    r.phase = 'done';
    keys.clear();
    const name = snackName(r.stack);
    const colors = r.stack.map(s => Object.values(s.f.pal)[0]);
    try {
      const best = JSON.parse(localStorage.getItem('kamy.snack') || 'null');
      if (!best || r.stack.length > best.count) localStorage.setItem('kamy.snack', JSON.stringify({ name, count: r.stack.length }));
    } catch (e) {}
    A.sfx('win');
    const img = snackImage();
    const pic = icon(img, 3);
    pic.className = 'snack-pic';
    show([
      el('h3', 'game-title', 'your victory snack'),
      pic,
      el('p', 'snack-name', name),
      el('p', 'line', `${r.stack.length} ${r.stack.length === 1 ? 'thing' : 'things'} high`),
      button('take it to the field', () => { pendingSnack = { name, colors }; close(); }),
      button('make another', beginParty)
    ]);
  }

  function renderParty() {
    const r = run;
    if (r.shake > 0) g.setTransform(1, 0, 0, 1, Math.round((Math.random() - 0.5) * 3), 0);
    g.translate(0, Math.round(r.cam));
    g.fillStyle = '#2a2150'; g.fillRect(0, H - 11, W, 11 + Math.ceil(r.cam));
    g.fillStyle = '#3d3278'; g.fillRect(0, H - 11, W, 1);
    g.drawImage(PLATE, Math.round(r.x - 9), H - 14);
    for (const p of stackLayout().pos) g.drawImage(p.s.f.img, Math.round(p.x - p.s.f.img.width / 2), Math.round(p.top));
    for (const it of r.falling) g.drawImage(it.f.img, Math.round(it.x - it.f.img.width / 2), Math.round(it.y - it.f.img.height / 2));
    for (const tb of r.tumbling) {
      g.save(); g.translate(Math.round(tb.x), Math.round(tb.y)); g.rotate(tb.rot);
      g.drawImage(tb.f.img, -Math.round(tb.f.img.width / 2), -Math.round(tb.f.img.height / 2));
      g.restore();
    }
    for (const p of r.parts) { g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ---- Run state -------------------------------------------------------- */
  let run = null, raf = 0, last = 0, isOpen = false, onClose = null;
  const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 6 + Math.random() * 30 }));

  function begin(atBoss) {
    screen.hidden = true;
    fireBtn.hidden = !matchMedia('(hover: none)').matches;
    run = {
      phase: 'play', t: 0, hp: MAX_HP, inv: 0, cool: 0, triple: 0,
      x: W / 2, y: H - 26, shots: [], bullets: [], foes: [], faves: [], parts: [],
      kills: atBoss ? KILLS : 0, spawnT: 1.2, faveT: 5, boss: null, shake: 0, warnT: 0,
      reachedBoss: atBoss
    };
    if (atBoss) startWarning();
    renderHud();
  }

  function startWarning() {
    run.phase = 'warning';
    run.warnT = 3;
    run.reachedBoss = true;
    $('game-warning').textContent = G.bossWarning || 'warning';
    $('game-warning').hidden = false;
    A.sfx('warning');
  }

  function spawnBoss() {
    $('game-warning').hidden = true;
    run.phase = 'boss';
    run.boss = { x: W / 2, y: -20, hp: BOSS_HP, t: 0, fanT: 2, spiralT: 0, ang: 0, minionT: 4, flash: 0, entering: true };
    $('boss-name').textContent = G.bossName || 'boss';
    renderHud();
  }

  function spawnFoe(kind, x, y) {
    const f = kind || FOES[Math.floor(Math.random() * FOES.length)];
    const pattern = ['drift', 'drift', 'zig', 'dive'][Math.floor(Math.random() * 4)];
    run.foes.push({
      f, hp: f.hp, x: x != null ? x : 8 + Math.random() * (W - 16), y: y != null ? y : -8,
      pattern, vx: (Math.random() < 0.5 ? -1 : 1) * (22 + Math.random() * 18), vy: 16 + Math.random() * 14,
      ph: Math.random() * 6, flash: 0,
      shootT: run.kills > 6 && Math.random() < 0.35 ? 1 + Math.random() * 2 : Infinity
    });
  }

  function aimed(x, y, speed, offset = 0) {
    const a = Math.atan2(run.x - x, run.y - y) + offset;
    run.bullets.push({ x, y, vx: Math.sin(a) * speed, vy: Math.cos(a) * speed });
  }

  function burst(x, y, colors, n, sp) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random() * 0.7);
      run.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.5, age: 0, c: colors[i % colors.length] });
    }
  }

  const hit = (a, aw, ah, b, bw, bh) => Math.abs(a.x - b.x) * 2 < aw + bw && Math.abs(a.y - b.y) * 2 < ah + bh;

  function hurt() {
    if (run.inv > 0 || run.phase === 'over' || run.phase === 'won') return;
    run.hp--;
    run.inv = 1.6;
    run.shake = 0.3;
    A.sfx('hurt');
    burst(run.x, run.y, ['#ff7aa8', '#ffffff'], 10, 40);
    renderHud();
    if (run.hp <= 0) gameOver();
  }

  /* ---- Input ------------------------------------------------------------ */
  const keys = new Set();
  let drag = null, mouse = null, mouseFire = false, touchFire = false;
  const toLogical = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };

  cv.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') { mouse = toLogical(e); if (e.button === 0) mouseFire = true; return; }
    drag = { x: e.clientX, y: e.clientY };
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') { mouse = toLogical(e); return; }
    if (!drag || !run) return;
    const k = W / cv.getBoundingClientRect().width * 1.4;
    run.x += (e.clientX - drag.x) * k;
    run.y += (e.clientY - drag.y) * k;
    drag = { x: e.clientX, y: e.clientY };
  });
  const endDrag = () => { drag = null; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') mouse = null; });
  window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') mouseFire = false; });

  // on-screen fire button for phones: hold to shoot
  const fireBtn = $('game-fire');
  const fireOn = e => { e.preventDefault(); touchFire = true; fireBtn.classList.add('down'); try { fireBtn.setPointerCapture(e.pointerId); } catch (err) {} };
  const fireOff = () => { touchFire = false; fireBtn.classList.remove('down'); };
  fireBtn.addEventListener('pointerdown', fireOn);
  fireBtn.addEventListener('pointerup', fireOff);
  fireBtn.addEventListener('pointercancel', fireOff);
  fireBtn.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('keydown', e => {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); return close(); }
    if (e.key === ' ' && screen.hidden) { e.preventDefault(); keys.add(' '); return; }
    if (/^Arrow|^[wasd]$/i.test(e.key)) { e.preventDefault(); keys.add(e.key.toLowerCase()); mouse = null; }
  });
  document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

  /* ---- Update ----------------------------------------------------------- */
  function update(dt) {
    for (const s of stars) { s.y += s.v * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } }
    if (!run) return;
    if (run.mode === 'party') return updateParty(dt);
    run.t += dt;
    const live = run.phase === 'play' || run.phase === 'warning' || run.phase === 'boss';

    // move the ship
    if (live) {
      const kx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
      const ky = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
      run.x += kx * 95 * dt; run.y += ky * 95 * dt;
      if (mouse) {
        const dx = mouse.x - run.x, dy = mouse.y - run.y, d = Math.hypot(dx, dy), step = 150 * dt;
        if (d > 0.5) { run.x += dx / d * Math.min(step, d); run.y += dy / d * Math.min(step, d); }
      }
      run.x = Math.max(6, Math.min(W - 6, run.x));
      run.y = Math.max(H * 0.42, Math.min(H - 8, run.y));

      // fire only while she holds space / the mouse button / the fire button
      run.cool -= dt;
      const firing = keys.has(' ') || mouseFire || touchFire;
      if (firing && run.cool <= 0) {
        run.cool = 0.17;
        run.shots.push({ x: run.x, y: run.y - 6, vx: 0 });
        if (run.triple > 0) run.shots.push({ x: run.x - 3, y: run.y - 4, vx: -35 }, { x: run.x + 3, y: run.y - 4, vx: 35 });
        A.sfx('shoot');
      }
    }
    run.inv = Math.max(0, run.inv - dt);
    run.triple = Math.max(0, run.triple - dt);
    run.shake = Math.max(0, run.shake - dt);

    for (const s of run.shots) { s.y -= 190 * dt; s.x += s.vx * dt; }
    run.shots = run.shots.filter(s => s.y > -6 && s.x > -4 && s.x < W + 4);
    for (const b of run.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    run.bullets = run.bullets.filter(b => b.y < H + 4 && b.y > -8 && b.x > -4 && b.x < W + 4);

    // spawning
    if (run.phase === 'play') {
      run.spawnT -= dt;
      if (run.spawnT <= 0) {
        const p = run.kills / KILLS;
        run.spawnT = 1.05 - p * 0.5 + Math.random() * 0.3;
        spawnFoe();
      }
    }
    if (run.phase === 'play' || run.phase === 'boss') {
      run.faveT -= dt;
      if (run.faveT <= 0) {
        run.faveT = 5.5 + Math.random() * 3;
        const f = FAVES[Math.floor(Math.random() * FAVES.length)];
        run.faves.push({ f, x: 10 + Math.random() * (W - 20), y: -10, ph: Math.random() * 6 });
      }
    }
    if (run.phase === 'warning') {
      run.warnT -= dt;
      if (run.warnT <= 0) spawnBoss();
    }

    // foes
    for (const e of run.foes) {
      e.flash = Math.max(0, e.flash - dt);
      if (e.pattern === 'zig') { e.x += e.vx * dt; if (e.x < 6 || e.x > W - 6) e.vx *= -1; e.y += e.vy * 0.8 * dt; }
      else if (e.pattern === 'dive') {
        if (e.y < 50) e.y += e.vy * 1.4 * dt;
        else { if (!e.dir) { const a = Math.atan2(run.x - e.x, run.y - e.y); e.dir = { x: Math.sin(a) * 70, y: Math.cos(a) * 70 }; } e.x += e.dir.x * dt; e.y += e.dir.y * dt; }
      } else { e.y += e.vy * dt; e.x += Math.sin(run.t * 2 + e.ph) * 12 * dt; }
      e.shootT -= dt;
      if (e.shootT <= 0 && e.y > 0 && e.y < H * 0.6 && live) { e.shootT = 2.2 + Math.random(); aimed(e.x, e.y + 4, 52); }
    }
    run.foes = run.foes.filter(e => e.y < H + 12 && e.x > -16 && e.x < W + 16 && e.hp > 0);

    for (const f of run.faves) { f.y += 20 * dt; f.x += Math.sin(run.t * 1.5 + f.ph) * 10 * dt; }
    run.faves = run.faves.filter(f => f.y < H + 12 && !f.gone);

    // boss
    const b = run.boss;
    if (b && run.phase === 'boss') {
      b.t += dt;
      b.flash = Math.max(0, b.flash - dt);
      if (b.entering) { b.y += 18 * dt; if (b.y >= 50) { b.y = 50; b.entering = false; b.t = 0; } }
      else {
        const rage = b.hp < BOSS_HP / 2;
        b.x = W / 2 + Math.sin(b.t * (rage ? 0.95 : 0.7)) * 46;
        b.y = 50 + Math.sin(b.t * 1.3) * 5;
        b.fanT -= dt;
        if (b.fanT <= 0) {
          b.fanT = rage ? 1.5 : 1.25;
          const n = rage ? 7 : 5;
          for (let i = 0; i < n; i++) aimed(b.x, b.y + 12, rage ? 58 : 50, (i - (n - 1) / 2) * 0.22);
        }
        if (rage) {
          b.spiralT -= dt;
          if (b.spiralT <= 0) { b.spiralT = 0.2; b.ang += 0.55; run.bullets.push({ x: b.x, y: b.y + 6, vx: Math.sin(b.ang) * 42, vy: Math.cos(b.ang) * 42 }); }
        }
        b.minionT -= dt;
        if (b.minionT <= 0) { b.minionT = rage ? 3.5 : 5; spawnFoe(FOES[4], b.x, b.y + 14); }
      }
    }
    if (run.phase === 'dying') {
      run.dieT -= dt;
      run.shake = 0.2;
      if (Math.random() < dt * 14) {
        burst(b.x + (Math.random() - 0.5) * 30, b.y + (Math.random() - 0.5) * 24, ['#ffe066', '#ff7a3d', '#ffffff', '#c62f3a'], 12, 50);
        A.sfx('pop');
      }
      if (run.dieT <= 0) { run.boss = null; renderHud(); win(); }
    }

    // collisions: shots
    for (const s of run.shots) {
      for (const e of run.foes) {
        if (e.hp > 0 && hit(s, 2, 4, e, e.f.img.width, e.f.img.height)) {
          s.dead = true; e.hp--; e.flash = 0.06;
          if (e.hp <= 0) {
            burst(e.x, e.y, Object.values(e.f.pal), 12, 45);
            A.sfx('pop');
            if (run.phase === 'play') {
              run.kills++;
              renderHud();
              if (run.kills >= KILLS) startWarning();
            }
          }
          break;
        }
      }
      if (s.dead) continue;
      for (const f of run.faves) {
        if (!f.gone && hit(s, 2, 4, f, f.f.img.width, f.f.img.height)) {
          s.dead = true; f.gone = true;
          burst(f.x, f.y, Object.values(f.f.pal), 8, 25);
          floater(f.x, f.y, (G.shotLikedLine || 'not the {name}!').replace('{name}', f.f.name), 'sad');
          A.sfx('sad');
          break;
        }
      }
      if (s.dead) continue;
      if (b && run.phase === 'boss' && !b.entering && hit(s, 2, 4, b, boss.width - 6, boss.height - 6)) {
        s.dead = true; b.hp--; b.flash = 0.05;
        renderHud();
        if (b.hp <= 0) {
          run.phase = 'dying'; run.dieT = 2.2;
          run.bullets = []; run.foes = [];
          A.sfx('boom');
        }
      }
    }
    run.shots = run.shots.filter(s => !s.dead);

    // collisions: ship
    if (live) {
      const me = { x: run.x, y: run.y + 1 };
      for (const bl of run.bullets) if (hit(me, 5, 6, bl, 2, 2)) { bl.dead = true; hurt(); }
      run.bullets = run.bullets.filter(bl => !bl.dead);
      for (const e of run.foes) if (e.hp > 0 && hit(me, 7, 7, e, e.f.img.width - 2, e.f.img.height - 2)) { e.hp = 0; burst(e.x, e.y, Object.values(e.f.pal), 10, 40); hurt(); }
      if (b && run.phase === 'boss' && hit(me, 7, 7, b, boss.width - 8, boss.height - 8)) hurt();
      for (const f of run.faves) {
        if (!f.gone && hit(me, 11, 10, f, f.f.img.width, f.f.img.height)) {
          f.gone = true;
          run.hp = Math.min(MAX_HP, run.hp + 1);
          run.triple = 7;
          floater(f.x, f.y, (G.caughtLine || 'yum, {name}!').replace('{name}', f.f.name), 'yum');
          burst(f.x, f.y, ['#ffe066', '#ffffff', '#ff9ec4'], 10, 30);
          A.sfx('pickup');
          renderHud();
        }
      }
    }

    for (const p of run.parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95; }
    run.parts = run.parts.filter(p => p.age < p.life);
  }

  /* ---- Draw ------------------------------------------------------------- */
  const draw = (img, x, y) => g.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));

  function render() {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#070920';
    g.fillRect(0, 0, W, H);
    for (const s of stars) { g.fillStyle = s.v > 26 ? '#d6d9ff' : s.v > 16 ? '#8a8fd0' : '#3d4080'; g.fillRect(Math.round(s.x), Math.round(s.y), 1, s.v > 26 ? 2 : 1); }
    if (!run) return;
    if (run.mode === 'party') return renderParty();
    if (run.shake > 0) g.setTransform(1, 0, 0, 1, Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 4));

    for (const f of run.faves) {
      if (f.gone) continue;
      if (Math.floor(run.t * 4) % 2) { g.fillStyle = '#4b4f93'; g.fillRect(Math.round(f.x) - 1, Math.round(f.y - f.f.img.height / 2) - 3, 3, 1); }
      draw(f.f.img, f.x, f.y);
    }
    for (const e of run.foes) if (e.hp > 0) draw(e.flash > 0 ? e.f.flash : e.f.img, e.x, e.y);

    const b = run.boss;
    if (b && (run.phase !== 'dying' || Math.floor(run.t * 12) % 2)) draw(b.flash > 0 ? bossFlash : boss, b.x, b.y);

    g.fillStyle = '#ffe066';
    for (const s of run.shots) g.fillRect(Math.round(s.x), Math.round(s.y) - 2, 1, 4);
    for (const bl of run.bullets) {
      const x = Math.round(bl.x), y = Math.round(bl.y);
      g.fillStyle = '#ff5c8a'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
      g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1);
    }

    const live = run.phase === 'play' || run.phase === 'warning' || run.phase === 'boss' || run.phase === 'dying' || run.phase === 'won';
    if (live && (run.inv <= 0 || Math.floor(run.t * 14) % 2)) {
      draw(ship[Math.floor(run.t * 12) % 2], run.x, run.y);
      if (run.triple > 0 && Math.floor(run.t * 6) % 2) { g.fillStyle = '#ffe066'; g.fillRect(Math.round(run.x) - 6, Math.round(run.y) + 5, 1, 1); g.fillRect(Math.round(run.x) + 6, Math.round(run.y) + 5, 1, 1); }
    }
    for (const p of run.parts) { g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
  }

  function frameLoop(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    update(dt);
    render();
    raf = requestAnimationFrame(frameLoop);
  }

  /* ---- Open / close ----------------------------------------------------- */
  function open(done) {
    if (isOpen) return;
    isOpen = true;
    onClose = done;
    root.hidden = false;
    fit();
    run = null;
    briefing();
    A.setGame(true);
    last = performance.now();
    raf = requestAnimationFrame(frameLoop);
  }

  function close() {
    if (!isOpen) return;
    const won = !!run && run.phase === 'won';
    isOpen = false;
    cancelAnimationFrame(raf);
    root.hidden = true;
    keys.clear(); drag = null; mouse = null; run = null; mouseFire = false; fireOff();
    $('game-warning').hidden = true;
    $('game-floaters').replaceChildren();
    A.setGame(false);
    A.sfx('close');
    const snack = pendingSnack;
    pendingSnack = null;
    if (onClose) onClose({ won, snack });
  }

  $('game-close').addEventListener('click', close);
  window.addEventListener('resize', () => { if (isOpen) fit(); });

  return {
    open, close,
    get isOpen() { return isOpen; },
    shipSprite: ship,
    // used by scripts/shoot.mjs
    debug: {
      begin,
      skipToBoss: () => begin(true),
      party: () => beginParty(),
      endParty: () => { if (run && run.mode === 'party') endParty(); },
      fillStack: n => { if (run && run.mode === 'party') for (let i = 0; i < n; i++) run.stack.push({ f: FAVES[i % FAVES.length], dx: i % 2 ? 1 : -1 }); },
      setBossHp: n => { if (run && run.boss) run.boss.hp = n; },
      shield: () => { if (run) run.inv = 999; },
      state: () => run && { phase: run.phase, hp: run.hp, kills: run.kills, boss: run.boss && run.boss.hp }
    }
  };
})();
