/* Prank Platformer: a short level from Ahmed full of fake floors, spring
   traps and signs that lie, with little notes that pop up where she falls.
   Once she beats it, she can build one for him in the editor (she has to
   beat her own level before she can save it). Saved levels go to Supabase,
   so whoever opens the site next can play them. */
window.PRANK = (() => {
  'use strict';
  const C = window.KAMY, PL = window.PLAT, CL = window.CLOUD;
  const P = C.prank || {};
  const W = 160, H = 224, T = PL.T, PAD = H - 36, VIEW_Y = 20, LW = 72, LH = 20;
  const NAME = { kamy: P.herName || 'kamy', ahmed: P.myName || 'ahmed' };
  const ME = PL.iam, THEM = ME === 'ahmed' ? 'kamy' : 'ahmed';

  /* ---- The level from Ahmed ------------------------------------------------ */
  function builtIn() {
    const b = PL.builder(76, LH);
    b.fill(0, 75, 17, 19, '#').set(2, 16, 'P');
    // 1. "nothing bad will happen" (a fake floor over a pit)
    b.set(5, 16, 's').fill(10, 12, 17, 17, '=').fill(10, 12, 18, 19, '.');
    // 2. "jump here!" (a hidden block right where you'd jump)
    b.set(15, 16, 's').fill(17, 18, 17, 19, '.').set(17, 13, 'i');
    // 3. "use the spring!" (it throws you onto spikes)
    b.set(22, 16, 's').set(25, 16, 'S').fill(27, 29, 16, 16, '^').fill(34, 38, 16, 16, '^');
    // 4. "take your time here" (a bridge that crumbles)
    b.set(41, 16, 's').fill(44, 49, 17, 17, 'C').fill(44, 49, 18, 19, '.');
    // 5. "the end! :)" (a fake flag on a fake floor)
    b.set(53, 16, 's').fill(56, 60, 14, 14, '#').set(58, 14, '=').set(58, 13, 'f');
    // 6. "this part is actually safe"
    b.set(63, 16, 's').fill(66, 67, 17, 17, '=').fill(66, 67, 18, 19, '.');
    b.set(72, 16, 'F');
    const t = P.signs || {};
    return {
      id: 'ahmed-1', author: 'ahmed', name: P.levelName || 'a totally normal walk', builtIn: true,
      data: {
        rows: b.rows(),
        signs: [
          { x: 5, y: 16, text: t.walk || 'just walk right. nothing bad will happen.' },
          { x: 15, y: 16, text: t.jump || 'jump here!' },
          { x: 22, y: 16, text: t.spring || 'use the spring! it goes right over the spikes.' },
          { x: 41, y: 16, text: t.bridge || 'take your time on this bridge :)' },
          { x: 53, y: 16, text: t.end || 'the end! :)' },
          { x: 63, y: 16, text: t.safe || 'ok this part is actually safe.' }
        ],
        notes: (P.notes || [
          { x: 11, y: 18, text: 'i said nothing bad would happen. i lied.' },
          { x: 17, y: 16, text: 'who puts a block there? me. tiny hops, my love.' },
          { x: 36, y: 15, text: 'you trusted a sign. adorable.' },
          { x: 46, y: 18, text: 'i said take your time. i lied again.' },
          { x: 58, y: 15, text: 'not that flag. keep going.' },
          { x: 66, y: 18, text: 'you believed me AGAIN?' }
        ])
      },
      winLine: P.winLine || 'you made it. you only have yourself to blame for trusting me.'
    };
  }

  /* ---- Saving levels ------------------------------------------------------- */
  const LOCAL = 'kamy.prank.levels';
  const local = () => { try { return JSON.parse(localStorage.getItem(LOCAL)) || []; } catch (e) { return []; } };
  async function levels() {
    let saved = local();
    if (CL.enabled && CL.levels) { try { saved = await CL.levels(); } catch (e) {} }
    return [builtIn()].concat(saved.map(r => ({ id: 'saved-' + r.id, author: r.author, name: r.name, data: r.data })));
  }
  async function saveLevel(name, data) {
    if (CL.enabled && CL.saveLevel) return CL.saveLevel(ME, name, data);
    const all = local();
    all.push({ id: Date.now(), author: ME, name, data });
    try { localStorage.setItem(LOCAL, JSON.stringify(all)); } catch (e) {}
  }
  const beaten = id => { try { return localStorage.getItem('kamy.prank.beat.' + id) === '1'; } catch (e) { return false; } };
  const markBeaten = id => { try { localStorage.setItem('kamy.prank.beat.' + id, '1'); } catch (e) {} };

  /* ---- Menus --------------------------------------------------------------- */
  let api = null, s = null;
  const pads = PL.pads(W, H, PAD);

  function start(a) {
    api = a;
    s = null;
    menu();
  }

  async function menu() {
    s = { mode: 'menu', t: 0 };
    api.setControls(null);
    api.setHud('');
    pads.clear();
    api.show([api.el('h3', 'game-title', P.title || 'prank platformer'), api.el('p', 'line', '...')]);
    const list = await levels();
    if (!s || s.mode !== 'menu') return;
    const mine = list.filter(l => l.author === THEM);
    const theirs = list.filter(l => l.author === ME);
    const btn = l => api.button(`${beaten(l.id) ? '★ ' : ''}${l.name}`, () => play(l));
    const parts = [
      api.el('h3', 'game-title', P.title || 'prank platformer'),
      api.el('p', 'line', P.intro || 'trust nothing. especially the signs.')
    ];
    const wrap = api.el('div', 'arcade-list');
    if (mine.length) { wrap.append(api.el('p', 'line', `from ${NAME[THEM]}:`), ...mine.map(btn)); }
    if (theirs.length) { wrap.append(api.el('p', 'line', 'you made:'), ...theirs.map(btn)); }
    wrap.append(api.button(`make one for ${NAME[THEM]}`, () => edit()));
    parts.push(wrap);
    api.show(parts);
  }

  /* ---- Playing --------------------------------------------------------------- */
  function play(level, test) {
    api.hideScreen();
    api.setControls(null);
    pads.clear();
    s = { mode: test ? 'test' : 'play', level, wd: PL.create(level.data), deaths: 0, msg: '', msgT: 0, deadT: 0, t: 0, edit: test || null };
    hud();
  }
  function hud() {
    if (!s || (s.mode !== 'play' && s.mode !== 'test')) return;
    if (s.msgT > 0) return api.setHud(s.msg);
    api.setHud(s.mode === 'test' ? `testing · deaths ${s.deaths}` : `${s.level.name} · deaths ${s.deaths}`);
  }
  function say(text, secs = 3) { s.msg = text; s.msgT = secs; hud(); }

  function won() {
    api.sfx('win');
    if (s.mode === 'test') {
      s.edit.verified = true;
      const ed = s.edit, n = s.deaths;
      return setTimeout(() => { edit(ed); edSay(`you beat it (${n} deaths). now you can save it.`, 4); }, 700);
    }
    const lv = s.level;
    if (lv.author !== ME) { markBeaten(lv.id); try { localStorage.setItem('kamy.arcade.prank', 'true'); } catch (e) {} }
    const deaths = s.deaths;
    setTimeout(() => {
      if (!s) return;
      const parts = [
        api.el('h3', 'game-title', P.wonTitle || 'you made it!'),
        api.el('p', 'line', `${deaths} ${deaths === 1 ? 'death' : 'deaths'}.`)
      ];
      if (lv.winLine) { const l = api.el('p', 'win-note', ''); parts.push(l); setTimeout(() => api.typeInto(l, lv.winLine), 30); }
      if (lv.author !== ME) parts.push(api.button(P.revengeLabel || `revenge: make one for ${NAME[THEM]}`, () => edit()));
      parts.push(api.button('back to the levels', () => menu()));
      api.show(parts);
      api.setHud('');
    }, 800);
  }

  function updatePlay(dt) {
    const wd = s.wd;
    if (s.msgT > 0 && (s.msgT -= dt) <= 0) hud();
    if (wd.p.dead) {
      if ((s.deadT -= dt) <= 0) { wd.reset(); pads.clear(); }
      return;
    }
    if (wd.p.won) return;
    for (const e of wd.update(dt, pads.input)) {
      if (e.type === 'die') {
        s.deaths++; s.deadT = 0.9;
        api.sfx('hurt');
        if (e.note) say(`${NAME[s.level.author] || s.level.author}: ${e.note}`, 3.4); else hud();
      }
      if (e.type === 'win') won();
      if (e.type === 'sign') say(`sign: "${e.text}"`, 3.2);
      if (e.type === 'fakeflag') { api.sfx('sad'); say(P.fakeFlag || 'the flag ran away. rude.', 2.6); }
      if (e.type === 'spring') api.sfx('grow');
      if (e.type === 'crumble') api.sfx('pop');
      if (e.type === 'bump') api.sfx('close');
      if (e.type === 'jump') api.sfx('type');
    }
  }

  /* ---- The editor ------------------------------------------------------------ */
  const TOOLS = [
    ['#', 'ground'], ['=', 'fake floor'], ['^', 'spikes'], ['S', 'spring'], ['C', 'crumbling block'],
    ['i', 'hidden block'], ['s', 'sign'], ['n', 'note (shows when they die near it)'], ['P', 'start'],
    ['F', 'flag (the goal)'], ['f', 'fake flag'], ['.', 'eraser'], ['pan', 'move around']
  ];
  const TW = W / TOOLS.length, TY = H - 44, TH = 18;

  function blank() {
    const b = PL.builder(LW, LH);
    b.fill(0, LW - 1, 17, 19, '#').set(LW - 4, 16, 'F');
    return { rows: b.rows().map(r => r.split('')), signs: [], notes: [], start: { x: 2, y: 16 }, cam: 0, verified: false, tool: '#' };
  }
  function toData(ed) {
    const rows = ed.rows.map(r => r.slice());
    rows[ed.start.y][ed.start.x] = 'P';
    return { rows: rows.map(r => r.join('')), signs: ed.signs.slice(), notes: ed.notes.slice() };
  }

  function edit(ed) {
    ed = ed || blank();
    api.hideScreen();
    pads.clear();
    s = { mode: 'edit', ed, t: 0, drag: null, msg: '', msgT: 0, wd: PL.create(toData(ed)) };
    api.setControls([
      { label: 'test', onClick: () => play({ name: 'test', author: ME, data: toData(ed) }, ed) },
      { label: 'save', onClick: () => trySave() },
      { label: 'levels', onClick: () => menu() }
    ]);
    toolHud();
  }
  function toolHud() {
    if (!s || s.mode !== 'edit') return;
    if (s.msgT > 0) return api.setHud(s.msg);
    const tool = TOOLS.find(t => t[0] === s.ed.tool);
    api.setHud(`editing · ${tool[1]}`);
  }
  function edSay(text, secs = 3) { s.msg = text; s.msgT = secs; toolHud(); }

  function ask(title, max, done) {
    const input = document.createElement('input');
    input.type = 'text'; input.maxLength = max; input.className = 'mini-input';
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') ok.click(); });
    const ok = api.button('ok', () => done(input.value.trim()));
    api.show([api.el('h3', 'game-title', title), input, ok, api.button('cancel', () => done(null))]);
    setTimeout(() => input.focus(), 60);
  }

  function trySave() {
    const ed = s.ed;
    if (!ed.verified) { api.sfx('sad'); return edSay(P.beatFirst || 'beat it yourself first: tap "test".', 3.5); }
    ask('name your level', 30, name => {
      if (name === null) return edit(ed);
      if (!name) return edit(ed);
      api.show([api.el('p', 'line', 'saving...')]);
      saveLevel(name, toData(ed)).then(() => {
        api.sfx('win');
        api.show([
          api.el('h3', 'game-title', 'saved!'),
          api.el('p', 'line', `it's waiting for ${NAME[THEM]} in the arcade.`),
          api.button('back to the levels', () => menu())
        ]);
      }).catch(() => {
        api.show([api.el('p', 'line', 'couldn\'t save it. check your internet and try again.'), api.button('back to the editor', () => edit(ed))]);
      });
    });
  }

  function paint(tx, ty) {
    const ed = s.ed, tool = ed.tool;
    if (tx < 0 || ty < 0 || tx >= LW || ty >= LH) return;
    const k = o => o.x === tx && o.y === ty;
    if (tool === 'P') { ed.start = { x: tx, y: ty }; ed.rows[ty][tx] = '.'; }
    else if (tool === 'n') {
      ask('a note for when they die here', 80, text => {
        if (text) { ed.notes = ed.notes.filter(o => !k(o)); ed.notes.push({ x: tx, y: ty, text }); ed.verified = false; }
        edit(ed);
      });
      return;
    } else if (tool === 's') {
      ask('what does the sign say?', 60, text => {
        if (text) { ed.signs = ed.signs.filter(o => !k(o)); ed.signs.push({ x: tx, y: ty, text }); ed.rows[ty][tx] = 's'; ed.verified = false; }
        edit(ed);
      });
      return;
    } else {
      if (ed.rows[ty][tx] === tool) return;
      ed.rows[ty][tx] = tool;
      if (tool === '.') { ed.notes = ed.notes.filter(o => !k(o)); ed.signs = ed.signs.filter(o => !k(o)); }
    }
    ed.verified = false;
    s.wd = PL.create(toData(ed));
  }

  function pointerEdit(type, p) {
    if (type === 'down' && p.y >= TY && p.y < TY + TH) {
      const t = TOOLS[Math.min(TOOLS.length - 1, Math.floor(p.x / TW))];
      s.ed.tool = t[0];
      api.sfx('blip');
      s.msgT = 0;
      return toolHud();
    }
    if (p.y >= TY) return;
    const tx = Math.floor((p.x + s.ed.cam) / T), ty = Math.floor((p.y - VIEW_Y) / T);
    if (type === 'down') {
      s.drag = { x: p.x, cam: s.ed.cam };
      if (s.ed.tool !== 'pan') paint(tx, ty);
    } else if (type === 'move' && s.drag) {
      if (s.ed.tool === 'pan') s.ed.cam = Math.max(0, Math.min(LW * T - W, s.drag.cam - (p.x - s.drag.x)));
      else if ('#=^CiS.'.includes(s.ed.tool)) paint(tx, ty);
    } else if (type === 'up' || type === 'cancel') s.drag = null;
  }

  /* ---- The loop ---------------------------------------------------------------- */
  function update(dt) {
    if (!s) return;
    s.t += dt;
    if (s.mode === 'play' || s.mode === 'test') updatePlay(dt);
    if (s.mode === 'edit' && s.msgT > 0 && (s.msgT -= dt) <= 0) toolHud();
  }

  // a small "back" corner in the top right while playing (under the hud line)
  const BACK = { x: W - 18, y: 20, w: 16, h: 14 };
  function pointer(type, p, e) {
    if (!s || api.screenOpen()) return;
    if (s.mode === 'edit') return pointerEdit(type, p);
    if (s.mode !== 'play' && s.mode !== 'test') return;
    if (type === 'down' && p.x >= BACK.x && p.y >= BACK.y && p.y <= BACK.y + BACK.h) {
      api.sfx('close');
      return s.mode === 'test' ? edit(s.edit) : menu();
    }
    pads.pointer(type, p, e);
  }
  function key(type, k) {
    if (!s) return;
    if (s.mode === 'play' || s.mode === 'test') pads.key(type, k);
    if (s.mode === 'edit' && type === 'down') {
      if (k === 'ArrowLeft') s.ed.cam = Math.max(0, s.ed.cam - 16);
      if (k === 'ArrowRight') s.ed.cam = Math.min(LW * T - W, s.ed.cam + 16);
    }
  }

  function render(g) {
    g.fillStyle = '#0b0a24'; g.fillRect(0, 0, W, H);
    if (!s || s.mode === 'menu') return;
    if (s.mode === 'edit') {
      PL.draw(g, s.wd, W, TY, { cam: { x: s.ed.cam, y: -VIEW_Y }, edit: true });
      // the grid, faintly
      g.fillStyle = 'rgba(138,128,204,.12)';
      for (let x = -(s.ed.cam % T); x < W; x += T) g.fillRect(x, VIEW_Y, 1, LH * T);
      for (let y = 0; y <= LH; y++) g.fillRect(0, VIEW_Y + y * T, W, 1);
      // how far along the level we are
      g.fillStyle = '#2a2458'; g.fillRect(0, TY - 3, W, 2);
      g.fillStyle = '#ff9ec4'; g.fillRect(Math.round(s.ed.cam / (LW * T) * W), TY - 3, Math.round(W / (LW * T) * W), 2);
      // the tool palette
      g.fillStyle = '#0b0a24'; g.fillRect(0, TY, W, H - TY);
      TOOLS.forEach(([id], i) => {
        const x = Math.round(i * TW), on = s.ed.tool === id;
        g.fillStyle = on ? '#6d63b0' : '#1d1a44'; g.fillRect(x + 1, TY + 1, Math.round(TW) - 2, TH - 2);
        const icon = toolIcon(id);
        if (icon) g.drawImage(icon, 0, 0, 8, 8, x + Math.round((TW - 8) / 2), TY + 5, 8, 8);
      });
      return;
    }
    PL.draw(g, s.wd, W, PAD, { who: ME });
    pads.draw(g);
    // back corner
    g.fillStyle = '#2a2458'; g.fillRect(BACK.x, BACK.y, BACK.w, BACK.h);
    g.fillStyle = '#8a80cc';
    for (let k = 0; k < 4; k++) { g.fillRect(BACK.x + 5 + k, BACK.y + 7 - k, 1, 1); g.fillRect(BACK.x + 5 + k, BACK.y + 7 + k, 1, 1); }
    g.fillRect(BACK.x + 5, BACK.y + 7, 7, 1);
  }
  const icons = {};
  function toolIcon(id) {
    if (icons[id]) return icons[id];
    const A = PL.art, c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const g = c.getContext('2d');
    const src = { '#': A.groundTop(), '=': A.groundTop(), '^': A.spikes(), S: A.spring(0), C: A.crumble(), i: A.hidden(), s: A.sign(), n: A.noteIcon(), P: A.startIcon(), F: A.flag(0), f: A.flag(1) }[id];
    if (src) g.drawImage(src, 0, 0, 8, 8, 0, 0, 8, 8);
    if (id === '=') { g.fillStyle = '#ff5c8a'; g.fillRect(2, 4, 4, 1); }
    if (id === 'f') { g.fillStyle = '#ff5c8a'; g.fillRect(5, 5, 2, 2); }
    if (id === '.') { g.fillStyle = '#ff5c8a'; for (let k = 0; k < 6; k++) { g.fillRect(1 + k, 1 + k, 1, 1); g.fillRect(6 - k, 1 + k, 1, 1); } }
    if (id === 'pan') { g.fillStyle = '#c8c8e0'; g.fillRect(1, 3, 6, 1); g.fillRect(0, 3, 1, 1); g.fillRect(1, 2, 1, 3); g.fillRect(6, 2, 1, 3); }
    return (icons[id] = c);
  }

  const def = {
    W, H, start, update, render, pointer, key,
    stop: () => { s = null; pads.clear(); },
    help: () => s && s.mode === 'edit'
      ? 'pick a tool along the bottom and tap or drag on the level to place it. "move around" (the arrows) scrolls the level. signs and notes ask you what they should say: notes are invisible and pop up when they die near them. fake floors and fake flags look real to them. you have to beat your level with "test" before you can save it.'
      : 'use the pads at the bottom: left, right, and the big one to jump (or arrow keys and space). tap and let go quickly for a small hop. the arrow in the top-right corner goes back. don\'t trust the signs.'
  };
  return {
    open: done => window.MINI.open(def, done),
    builtIn,
    debug: {
      state: () => s && { mode: s.mode, deaths: s.deaths, won: s.wd && s.wd.p.won, verified: s.ed && s.ed.verified, tool: s.ed && s.ed.tool },
      world: () => s && s.wd,
      playBuiltIn: () => play(builtIn()),
      win: () => { if (s && s.wd) { s.wd.p.won = true; won(); } }
    }
  };
})();
