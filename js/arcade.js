/* The little arcade cabinet in the field: a menu of the arcade games.
   Each game closes back to this menu; the "x" here goes back to the field.
   A game shows up here once its file has loaded (window.<NAME>.open). */
window.ARCADE = (() => {
  'use strict';
  const C = window.KAMY, S = window.SPRITES;
  const P = C.arcade || {};
  const W = 160, H = 224;

  // [id, global, default title, one-line pitch]
  const GAMES = [
    ['wrongway', 'WRONGWAY', 'wrong way home', 'rotate the roads. get the car home.'],
    ['pinball', 'PINBALL', 'pineapple pinball', 'bumpers, flippers, inside jokes.'],
    ['prank', 'PRANK', 'prank platformer', 'trust nothing. especially the signs.'],
    ['ghost', 'GHOSTRACE', 'beat my ghost', 'race me, even when i\'m not here.'],
    ['backpack', 'BACKPACK', 'backpack panic', 'it all has to fit.'],
    ['campus', 'CAMPUS', 'rit after dark', 'find your stuff. get out.']
  ];
  const done = id => { try { const v = localStorage.getItem('kamy.arcade.' + id); return v === '1' || v === 'true'; } catch (e) { return false; } };
  const mark = id => { try { localStorage.setItem('kamy.arcade.' + id, 'true'); } catch (e) {} };

  /* ---- The cabinet (drawn in the field by main.js) ------------------------ */
  const CAB = [
    '.ooooooo.',
    'oPPPPPPPo',
    'oPkkkkkPo',
    'oPkbbbkPo',
    'oPkbBbkPo',
    'oPkbbbkPo',
    'oPkkkkkPo',
    'oPPPPPPPo',
    'ohhhhhhho',
    'ohyhhrhro',
    'oPPPPPPPo',
    'oPPdddPPo',
    'oPPPPPPPo',
    'ooooooooo'
  ];
  const cabPal = (b, B) => ({ o: '#1a1030', P: '#6d63b0', k: '#1a1030', b, B, h: '#8a80cc', y: '#ffd23f', r: '#ff5c8a', d: '#4b438a' });
  const cabinet = [S.make(CAB, cabPal('#3fb8a0', '#c8f0ea')), S.make(CAB, cabPal('#ff9ec4', '#fff0f6'))];

  /* ---- The menu ------------------------------------------------------------ */
  let api = null, t = 0, next = null;
  const stars = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * 9 }));

  function start(a) {
    api = a; t = 0; next = null;
    const list = GAMES.filter(([, g]) => window[g] && window[g].open);
    const rows = list.map(([id, , title, pitch]) => {
      const name = (C[id] && C[id].title) || title;
      const b = api.button((done(id) ? '★ ' : '') + name, () => { next = id; api.close({ pick: id }); });
      b.title = pitch;
      return b;
    });
    const wrap = api.el('div', 'arcade-list');
    wrap.append(...rows);
    api.show([
      api.el('h3', 'game-title', P.title || 'the arcade'),
      api.el('p', 'line', P.intro || 'pick a game. a star means you beat it.'),
      wrap
    ]);
  }

  function render(g) {
    g.fillStyle = '#0b0a24'; g.fillRect(0, 0, W, H);
    for (const s of stars) { g.fillStyle = Math.sin(t * 1.4 + s.p) > 0.5 ? '#8a8fd0' : '#2e3170'; g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (let y = (Math.floor(t * 20) % 3); y < H; y += 3) g.fillRect(0, y, W, 1);   // scanlines
  }

  const def = { W, H, start, update: dt => { t += dt; }, render, stop: () => {} };

  function open(done) {
    window.MINI.open(def, res => {
      const id = res && res.pick;
      if (!id) { if (done) done(); return; }
      const G = GAMES.find(x => x[0] === id);
      window[G[1]].open(r => {
        if (r && r.complete) mark(id);
        setTimeout(() => open(done), 0); // back to the menu
      });
    });
  }

  return { open, cabinet, done, GAMES };
})();
