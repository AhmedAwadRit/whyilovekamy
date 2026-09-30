/* Star piano: tap stars to write an 8-note tune. Save it and it plays
   when she opens the site. A melody from him waits there first. */
window.PIANO = (() => {
  'use strict';
  const C = window.KAMY, A = window.AUDIO;
  const P = C.piano || {};
  const W = 160, H = 200, LEN = 8;
  const SCALE = [60, 62, 64, 67, 69, 72, 74, 76]; // a gentle pentatonic, low to high
  const KEY = 'kamy.tune', KEY_HEARD = 'kamy.tune.heard';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  // the 8 note-stars sit in an arc: higher stars, higher notes
  const STARS = SCALE.map((m, i) => ({ i, x: 14 + i * 18.5, y: 128 - i * 10 - Math.sin(i / 7 * Math.PI) * 18, flash: 0 }));
  const dust = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * 150, p: Math.random() * 9 }));
  const COLORS = ['#ff9ec4', '#ffb38a', '#ffe38a', '#b8f0a0', '#9fd4ff', '#b8a6ff', '#e6a6ff', '#fff3d6'];

  let api = null, s = null;

  function start(a) {
    api = a;
    s = { t: 0, notes: [], playing: null };
    const heard = store.get(KEY_HEARD, false);
    const mine = P.fromMe && P.fromMe.notes && P.fromMe.notes.length;
    if (mine && !heard) {
      api.show([
        api.el('h3', 'game-title', P.title || 'star piano'),
        api.el('p', 'line', P.fromMe.line || ''),
        api.button('listen', () => { api.hideScreen(); store.set(KEY_HEARD, true); play(P.fromMe.notes, true); setupControls(); })
      ]);
    } else {
      setupControls();
    }
    api.setHud(P.hint || '');
  }

  function setupControls() {
    const list = [
      { label: 'play', onClick: () => play(s.notes) },
      { label: 'undo', onClick: () => { s.notes.pop(); A.sfx('close'); } },
      { label: 'clear', onClick: () => { s.notes = []; A.sfx('close'); } },
      { label: 'save', onClick: save }
    ];
    if (P.fromMe && P.fromMe.notes) list.splice(3, 0, { label: 'his tune', onClick: () => play(P.fromMe.notes, true) });
    api.setControls(list);
  }

  function save() {
    if (!s.notes.length) { api.setHud('write a tune first'); return; }
    store.set(KEY, s.notes.map(i => SCALE[i]));
    A.sfx('grow');
    api.setHud(P.saved || 'saved.');
  }

  // plays a melody, lighting each star as its note sounds
  function play(notes, showLight) {
    if (!notes || !notes.length) return;
    const beat = 60 / 150;
    A.playNotes(notes.map(i => SCALE[i]), 150);
    s.playing = { t0: s.t, notes, beat, light: showLight !== false };
  }

  function tap(p) {
    let best = null, bd = 12;
    for (const st of STARS) { const d = Math.hypot(p.x - st.x, p.y - st.y); if (d < bd) { bd = d; best = st; } }
    if (!best) return;
    A.playNotes([SCALE[best.i]], 150);
    best.flash = 0.35;
    if (s.notes.length < LEN) s.notes.push(best.i);
    else { s.notes.shift(); s.notes.push(best.i); }
  }

  function update(dt) {
    if (!s) return;
    s.t += dt;
    for (const st of STARS) st.flash = Math.max(0, st.flash - dt);
    const pl = s.playing;
    if (pl) {
      const k = Math.floor((s.t - pl.t0) / pl.beat);
      if (k >= pl.notes.length) s.playing = null;
      else if (pl.light && pl.lastK !== k) { pl.lastK = k; STARS[pl.notes[k]].flash = 0.3; }
    }
  }

  function render(g) {
    const bands = ['#060819', '#0b0e2c', '#12153c', '#1b1b4d', '#26225d'];
    bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 34, W, 35); });
    g.fillStyle = '#10132f'; g.fillRect(0, 148, W, H - 148);
    for (const d of dust) { g.fillStyle = Math.sin(s ? s.t * 1.3 + d.p : d.p) > 0.6 ? '#8a8fd0' : '#2e3170'; g.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); }
    if (!s) return;
    // faint lines linking the notes, like a constellation
    g.fillStyle = '#2f2c6a';
    for (let i = 1; i < STARS.length; i++) {
      const a = STARS[i - 1], b = STARS[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
      for (let k = 0; k < n; k += 3) g.fillRect(Math.round(a.x + (b.x - a.x) * k / n), Math.round(a.y + (b.y - a.y) * k / n), 1, 1);
    }
    for (const st of STARS) {
      const x = Math.round(st.x), y = Math.round(st.y), lit = st.flash > 0, col = COLORS[st.i];
      if (lit) { g.fillStyle = '#4b4f93'; for (let a = 0; a < 12; a++) g.fillRect(Math.round(x + Math.cos(a / 12 * 6.28) * 6), Math.round(y + Math.sin(a / 12 * 6.28) * 6), 1, 1); }
      g.fillStyle = col;
      const r = lit ? 3 : 2;
      g.fillRect(x - r, y, r * 2 + 1, 1); g.fillRect(x, y - r, 1, r * 2 + 1);
      g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1);
    }
    // the tune so far: 8 little slots
    for (let k = 0; k < LEN; k++) {
      const x = 16 + k * 17, y = 154;
      g.fillStyle = '#2a2860'; g.fillRect(x, y, 13, 12);
      const n = s.notes[k];
      if (n != null) { g.fillStyle = COLORS[n]; g.fillRect(x + 4, y + 10 - n, 5, 2); g.fillRect(x + 6, y + 4, 1, 8 - n); }
      const pl = s.playing;
      if (pl && !pl.light && Math.floor((s.t - pl.t0) / pl.beat) === k) { g.fillStyle = '#fff3d6'; g.fillRect(x, y + 12, 13, 1); }
    }
  }

  function pointer(type, p) {
    if (type !== 'down' || !s || api.screenOpen()) return;
    tap(p);
  }

  const def = { W, H, start, update, render, pointer, stop: () => { s = null; } };
  return {
    open: done => window.MINI.open(def, done),
    // her saved tune (midi notes), or null
    savedTune: () => store.get(KEY, null)
  };
})();
