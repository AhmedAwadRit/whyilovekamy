(() => {
  'use strict';

  const C = window.KAMY;
  const S = window.SPRITES;
  const A = window.AUDIO;
  const $ = id => document.getElementById(id);

  /* ---- Storage (never throws: private mode / blocked storage) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const KEY_GARDEN = 'kamy.garden', KEY_STARS = 'kamy.stars', KEY_PLANTED = 'kamy.planted';
  const CLOUD = window.CLOUD;
  const everyVisit = (C.flowers && C.flowers.growOnce) === 'visit';

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // placeholder text ("[REPLACE: ...]") counts as not written yet, so it never shows on the live site
  const real = s => (typeof s === 'string' && !s.includes('[REPLACE') ? s : '');
  const isLocal = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  // passcodes ignore capitals, spaces and symbols (must match scripts/lock.mjs)
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  async function sha256(s) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

  /* ---- Visits → flowers ------------------------------------------------ */
  /* URL helpers for you (not her):
       ?preview      look around without growing a flower
       ?flowers=60   preview what the field looks like with 60 flowers
       ?reset        wipe this browser's flowers and read stars
                     (with Supabase on, reset the server with the SQL at
                     the bottom of supabase/schema.sql)                   */
  function registerVisit() {
    const q = new URLSearchParams(location.search);
    if (q.has('reset') && isLocal) { // only for testing on your computer
      store.del(KEY_GARDEN); store.del(KEY_STARS); store.del(KEY_PLANTED);
      try { sessionStorage.clear(); } catch (e) {}
    }
    const g = store.get(KEY_GARDEN, { count: 0, last: null, first: null });
    const done = Promise.resolve();
    if (q.has('flowers')) return { count: Math.max(0, parseInt(q.get('flowers'), 10) || 0), grew: false, preview: true, ready: done };
    if (q.has('preview')) {
      const out = { count: g.count, grew: false, preview: true, ready: done };
      if (CLOUD.enabled) out.ready = CLOUD.getGarden().then(r => { out.count = r.count; }).catch(() => {}).then(onGardenReady);
      return out;
    }

    let newSession = true;
    try { newSession = !sessionStorage.getItem('kamy.session'); sessionStorage.setItem('kamy.session', '1'); } catch (e) {}

    const local = () => {
      const isNew = everyVisit ? newSession : g.last !== todayKey();
      if (isNew) {
        g.count++;
        g.last = todayKey();
        g.first = g.first || todayKey();
        store.set(KEY_GARDEN, g);
      }
      return { count: g.count, grew: isNew };
    };
    if (!CLOUD.enabled) return { ...local(), ready: done };

    // Shared garden: show the last known count until the server answers.
    const out = { count: g.count, grew: false };
    const req = everyVisit && !newSession ? CLOUD.getGarden() : CLOUD.registerVisit(everyVisit);
    out.ready = req
      .then(r => { out.count = r.count; out.grew = !!r.grew; g.count = r.count; store.set(KEY_GARDEN, g); })
      .catch(err => { console.warn('Supabase unreachable, using this browser only:', err.message); Object.assign(out, local()); })
      .then(onGardenReady);
    return out;
  }

  /* ---- State ----------------------------------------------------------- */
  const canvas = $('scene');
  const ctx = canvas.getContext('2d');
  let W, H, scale, w, h, groundY;
  let bg, fg, moonSprite, moonGlow = [], cloudSprite;
  let moon, rocket, rocketOutline, wishStar, noteStar, airpod, items = [], stars = [], dust = [], flowers = [], planted = [], drawables = [];
  let fireflies = [], clouds = [], particles = [], mound;

  const garden = registerVisit();
  const state = {
    t: 0, started: false, hover: null, modal: null, dialog: false,
    visible: garden.grew ? garden.count - 1 : garden.count, // flowers currently shown
    growing: null, shooting: null, nextShoot: 9, heartT: 6, placing: null, constellation: null,
    calm: 0, moment: { next: 40, t0: null }, wishGlow: null, sealing: null, // first quiet moment after 40s
    read: new Set(store.get(KEY_STARS, []).filter(i => i < C.reasons.length))
  };

  function onGardenReady() {
    if (!state.growing) state.visible = garden.grew ? garden.count - 1 : garden.count;
    layoutFlowers();
    updateHud();
  }

  /* ---- Layout ---------------------------------------------------------- */
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    scale = Math.max(2, Math.round(Math.min(W, H) / 180));
    w = Math.ceil(W / scale); h = Math.ceil(H / scale);
    canvas.width = w; canvas.height = h;
    canvas.style.width = w * scale + 'px';
    canvas.style.height = h * scale + 'px';
    ctx.imageSmoothingEnabled = false;
    groundY = Math.round(h * (h > w ? 0.6 : 0.66));
    mound = { cx: Math.round(w * 0.24), r: Math.max(34, Math.round(w * 0.2)), hgt: 14 };
    // the rolling hills shift the bump's real summit, so find it (middle of any flat top)
    let top = Infinity, first = mound.cx, last = mound.cx;
    for (let x = mound.cx - mound.r; x <= mound.cx + mound.r; x++) {
      const y = hillY(x);
      if (y < top) { top = y; first = last = x; } else if (y === top) last = x;
    }
    mound.peakX = Math.round((first + last) / 2);
    layout();
    buildBackground();
    buildForeground();
  }

  function hillY(x) {
    const rolling = Math.sin(x * 0.045 + 0.5) * 4 + Math.sin(x * 0.013 + 2) * 5 + 9;
    const d = (x - mound.cx) / mound.r;
    const bump = Math.abs(d) < 1 ? Math.pow(Math.cos(d * Math.PI / 2), 2) * mound.hgt : 0;
    return Math.round(groundY - 6 - rolling - bump);
  }
  const farHillY = x => Math.round(groundY - 24 - Math.sin(x * 0.03 + 1) * 7 - Math.sin(x * 0.071) * 3);

  function layout() {
    const R = clamp(Math.round(Math.min(w, h) * 0.07), 9, 16);
    moon = { kind: 'moon', x: Math.round(w * 0.78), y: Math.round(Math.max(R + 10, groundY * 0.24)), r: R };
    rocket = { kind: 'ship', x: Math.round(w * 0.13), y: Math.round(groundY * 0.52) };
    wishStar = { kind: 'wish', x: Math.round(w * 0.9), y: Math.round(groundY * 0.6) };
    noteStar = { kind: 'piano', x: Math.round(w * 0.62), y: Math.round(Math.max(12, groundY * 0.1)) };

    // Items on the grass
    const fieldH = h - groundY;
    const iy = groundY + Math.round(fieldH * 0.42);
    // another lost airpod, lying in the grass (the airpod hunt)
    airpod = { kind: 'airpod', x: Math.round(w * 0.6), y: Math.min(h - 6, groundY + Math.round(fieldH * 0.78)) };
    const defs = [
      { id: 'headphones', sprite: S.headphones, fx: 0.11, dy: -4, label: 'our playlist', action: openPlaylist },
      { id: 'tape', sprite: S.tape, fx: 0.3, dy: 7, label: C.voiceNote.title, action: openTape },
      { id: 'envelope', sprite: S.envelope, fx: 0.5, dy: -2, label: 'a letter for you', action: openLetter },
      { id: 'camera', sprite: S.camera, fx: 0.7, dy: 6, label: 'our photos', action: openGallery },
      { id: 'seeds', sprite: S.seeds, fx: 0.89, dy: -3, label: C.planting.title, action: openPlanter }
    ];
    items = defs.map((d, i) => ({
      ...d, kind: 'item',
      w: d.sprite.width, h: d.sprite.height,
      x: Math.round(w * d.fx - d.sprite.width / 2),
      y: iy + d.dy - d.sprite.height,
      outline: S.outline(d.sprite, '#fff3d6'),
      glintT: 1 + i * 1.3,
      bobPhase: i * 1.9
    }));

    // Glowing reason stars: spread out, away from the moon and hills
    const r = rng(7);
    stars = [];
    let minD = 26, tries = 0;
    while (stars.length < C.reasons.length && tries < 4000) {
      tries++;
      if (tries % 400 === 0) minD = Math.max(8, minD - 3);
      const x = 8 + r() * (w - 16);
      const y = 10 + r() * (groundY - 52);
      if (y > hillY(x) - 16) continue;
      if (Math.hypot(x - moon.x, y - moon.y) < moon.r + 14) continue;
      if (Math.hypot(x - rocket.x, y - rocket.y) < 16) continue;
      if (Math.hypot(x - wishStar.x, y - wishStar.y) < 14) continue;
      if (Math.hypot(x - noteStar.x, y - noteStar.y) < 14) continue;
      if (x * scale < 190 && y * scale < 44) continue; // keep clear of the HUD
      if ((w - x) * scale < 64 && y * scale < 60) continue; // and the mute button
      if (stars.some(s => Math.hypot(s.x - x, s.y - y) < minD)) continue;
      stars.push({ x: Math.round(x), y: Math.round(y), kind: 'star', phase: r() * 10, speed: 0.6 + r() * 0.6 });
    }
    stars.forEach((s, i) => { s.i = i; s.homeX = s.x; s.homeY = s.y; });
    layoutConstellation();

    // Background dust stars
    const r2 = rng(42);
    dust = [];
    const n = Math.round(w * groundY / 90);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(r2() * w), y = Math.floor(r2() * groundY);
      if (y > hillY(x) - 2) continue;
      if (Math.hypot(x - moon.x, y - moon.y) < moon.r + 3) continue;
      dust.push({ x, y, base: Math.floor(r2() * r2() * 3), phase: r2() * 20, speed: 0.4 + r2() * 1.6 });
    }

    // Fireflies
    const r3 = rng(99);
    fireflies = Array.from({ length: Math.round(w / 22) + 4 }, () => ({
      bx: r3() * w, by: groundY - 10 + r3() * (h - groundY), ph: r3() * 50, sp: 0.2 + r3() * 0.3
    }));

    // Clouds
    if (!cloudSprite) cloudSprite = buildCloud();
    clouds = [
      { x: w * 0.1, y: Math.round(groundY * 0.18), v: 1.6 },
      { x: w * 0.62, y: Math.round(groundY * 0.46), v: 1.0 }
    ];

    layoutFlowers();
  }

  /* ---- Constellation: once every star is found, they form a heart ------ */
  let heartPts = [];
  function layoutConstellation() {
    const n = stars.length;
    if (n < 3) { heartPts = []; return; }
    const size = Math.min(w * 0.36, groundY * 0.5);
    const cx = w * 0.46, cy = groundY * 0.44;
    // trace the heart finely, then place stars at equal distances along it
    // (starting at the top dip, so with an even count one lands on the tip)
    const curve = [];
    for (let k = 0; k <= 400; k++) {
      const t = (k / 400) * Math.PI * 2;
      curve.push({
        x: 16 * Math.pow(Math.sin(t), 3),
        y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
      });
    }
    const dist = [0];
    for (let k = 1; k < curve.length; k++) dist.push(dist[k - 1] + Math.hypot(curve[k].x - curve[k - 1].x, curve[k].y - curve[k - 1].y));
    const total = dist[dist.length - 1];
    let k = 0;
    heartPts = Array.from({ length: n }, (_, i) => {
      const target = (i / n) * total;
      while (dist[k + 1] < target) k++;
      const c = curve[k];
      return { x: Math.round(cx + (c.x / 32) * size), y: Math.round(cy + (c.y / 32) * size), i };
    });
    // pair stars with heart points by angle so they don't cross paths
    const ang = p => Math.atan2(p.y - cy, p.x - cx);
    const byAngle = [...stars].sort((a, b) => ang({ x: a.homeX, y: a.homeY }) - ang({ x: b.homeX, y: b.homeY }));
    const ptsByAngle = [...heartPts].sort((a, b) => ang(a) - ang(b));
    byAngle.forEach((s, k) => { const p = ptsByAngle[k]; s.hx = p.x; s.hy = p.y; p.star = s; });
  }

  const ease = p => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const FORM_TIME = 2.6, LINE_TIME = 2.2, K_TIME = 1.0;

  /* The glowing initial in the middle of the heart. */
  const K_ROWS = ['kk...kk', 'kk..kk.', 'kk.kk..', 'kkkk...', 'kkk....', 'kkkk...', 'kk.kk..', 'kk..kk.', 'kk...kk'];
  const kSprite = S.make(K_ROWS, { k: '#fff0c4' });
  // two pulse frames: the K with a 1px glow around it
  const kGlow = [S.outline(kSprite, '#8f86d9'), S.outline(kSprite, '#6d63b0')];
  const kPixels = [];
  K_ROWS.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'k') kPixels.push({ x, y, delay: Math.random() * K_TIME * 0.8 }); }));
  const kPos = () => {
    const size = Math.min(w * 0.36, groundY * 0.5);
    return { x: Math.round(w * 0.46 - kSprite.width / 2), y: Math.round(groundY * 0.44 + size * 0.07 - kSprite.height / 2) };
  };
  // seconds since the K started appearing (negative = not yet)
  const kAge = c => state.t - c.t0 - FORM_TIME - LINE_TIME - 0.3;

  function drawInitial() {
    const c = state.constellation;
    if (!c || c.reverse) return;
    const age = kAge(c);
    if (age <= 0) return;
    const { x, y } = kPos();
    if (age >= K_TIME) {
      ctx.drawImage(kGlow[Math.sin(state.t * 1.6) > 0 ? 0 : 1], x - 1, y - 1);
      return;
    }
    // appearing: pixels sparkle in one by one
    for (const p of kPixels) {
      if (age < p.delay) continue;
      ctx.fillStyle = age - p.delay < 0.12 ? '#ffffff' : '#fff0c4';
      ctx.fillRect(x + p.x, y + p.y, 1, 1);
    }
  }

  // on reset the K crumbles into drifting pixels, left to right
  function disintegrateInitial() {
    const c = state.constellation;
    if (!c || c.reverse || kAge(c) <= 0) return;
    const { x, y } = kPos();
    for (const p of kPixels) {
      particles.push({
        x: x + p.x, y: y + p.y,
        vx: 4 + Math.random() * 12, vy: -(6 + Math.random() * 14), g: -6,
        age: 0, life: 0.8 + Math.random() * 0.9,
        delay: (p.x / 7) * 0.5 + Math.random() * 0.25,
        color: Math.random() < 0.7 ? '#fff0c4' : '#8f86d9'
      });
    }
  }

  function moveStarsToHeart() {
    const c = state.constellation;
    if (!c) return;
    const k = clamp((state.t - c.t0) / FORM_TIME, 0, 1);
    const p = c.reverse ? 1 - ease(k) : ease(k);
    for (const s of stars) {
      s.x = Math.round(s.homeX + (s.hx - s.homeX) * p);
      s.y = Math.round(s.homeY + (s.hy - s.homeY) * p);
    }
    if (c.reverse && k >= 1) state.constellation = null; // back home
  }

  function drawConstellation() {
    const c = state.constellation;
    if (!c || c.reverse || !heartPts.length) return;
    const q = clamp((state.t - c.t0 - FORM_TIME) / LINE_TIME, 0, 1);
    if (q <= 0) return;
    const n = heartPts.length, segs = q * n;
    const glow = Math.sin(state.t * 1.4) > 0 ? '#9a90e6' : '#7d74c9';
    ctx.fillStyle = glow;
    for (let k = 0; k < Math.ceil(segs); k++) {
      const a = heartPts[k].star, b = heartPts[(k + 1) % n].star;
      const part = Math.min(1, segs - k);
      const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      for (let j = 1; j < steps * part; j++) {
        if (j % 2) continue; // dotted, like a star chart
        ctx.fillRect(Math.round(a.x + (b.x - a.x) * j / steps), Math.round(a.y + (b.y - a.y) * j / steps), 1, 1);
      }
    }
  }

  /* Reset: stars drift back to where they started and become unread. */
  function resetStars() {
    state.read.clear();
    store.set(KEY_STARS, []);
    disintegrateInitial();
    const c = state.constellation;
    if (c && !c.reverse) {
      // start the return trip from wherever they are now (even mid-formation)
      const k = ease(clamp((state.t - c.t0) / FORM_TIME, 0, 1));
      for (const s of stars) { s.hx = s.homeX + (s.hx - s.homeX) * k; s.hy = s.homeY + (s.hy - s.homeY) * k; }
      state.constellation = { t0: state.t, reverse: true };
      setTimeout(layoutConstellation, FORM_TIME * 1000 + 100); // restore the true heart spots
    }
    A.sfx('close');
    updateHud();
    toast('the stars are back where they started.', 3000);
    setTimeout(showHint, 1500);
  }

  const resetBtn = $('reset-stars');
  let resetTimer = null;
  resetBtn.addEventListener('click', () => {
    if (!resetBtn.classList.contains('confirm')) {
      resetBtn.classList.add('confirm');
      resetBtn.textContent = 'sure?';
      A.sfx('blip');
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { resetBtn.classList.remove('confirm'); resetBtn.textContent = 'reset'; }, 3000);
      return;
    }
    clearTimeout(resetTimer);
    resetBtn.classList.remove('confirm');
    resetBtn.textContent = 'reset';
    resetStars();
  });

  function formConstellation(instant) {
    if (stars.length < 3 || (state.constellation && !state.constellation.reverse)) return;
    state.constellation = { t0: instant ? -1000 : state.t };
    if (!instant) {
      A.sfx('wish');
      setTimeout(() => A.sfx('star'), (FORM_TIME + LINE_TIME) * 1000);
    }
  }

  function makeFlower(i) {
    const r = rng(i * 7919 + 13);
    const n = i + 1;
    const f = {
      i, kind: 'flower',
      fx: r(), fy: r(),
      rare: n % 10 === 0,
      head: Math.floor(r() * S.HEAD_COUNT),
      color: Math.floor(r() * S.COLOR_COUNT),
      stemH: 3 + Math.floor(r() * 4),
      leafSide: r() < 0.5 ? -1 : 1,
      phase: r() * 6
    };
    if (f.rare) f.stemH += 2;
    if (n === 1) Object.assign(f, { fx: 0.51, fy: 0.22, head: 1, color: 0, stemH: 6 }); // the first one deserves a good spot
    f.leafY = 1 + Math.floor(r() * Math.max(1, f.stemH - 2));
    Object.assign(f, S.flower(f));
    return f;
  }

  /* A flower she planted herself, from a saved record. */
  function makePlanted(rec) {
    const f = {
      kind: 'flower', planted: true,
      fx: rec.fx, fy: rec.fy, head: rec.head, color: rec.color,
      stemH: 5, leafSide: rec.fx < 0.5 ? 1 : -1, leafY: 2, phase: rec.fx * 6,
      note: rec.note, date: rec.created_at, glintT: 1 + Math.random() * 4
    };
    return Object.assign(f, S.flower(f));
  }

  function loadPlanted() {
    const local = store.get(KEY_PLANTED, []);
    const use = recs => { planted = recs.map(makePlanted); layoutFlowers(); };
    use(local);
    if (CLOUD.enabled) CLOUD.planted().then(r => use([...r, ...local])).catch(() => {});
  }

  // The strip of grass flowers can grow in, in canvas pixels.
  const field = () => { const top = groundY + 5; return { top, span: h - top - 3 }; };
  const onItem = (x, y, tall) =>
    items.some(it => x > it.x - 5 && x < it.x + it.w + 5 && y - tall < it.y + it.h + 3 && y > it.y - 2);

  function layoutFlowers() {
    while (flowers.length < garden.count) flowers.push(makeFlower(flowers.length));
    const { top, span } = field();
    flowers.forEach(f => {
      // nudge flowers that would land on an item
      let fx = f.fx, fy = f.fy;
      for (let k = 0; k < 8; k++) {
        if (!onItem(3 + fx * (w - 6), top + fy * span, f.frames[0].height)) break;
        fx = (fx + 0.137) % 1; fy = (fy + 0.31) % 1;
      }
      f.x = Math.round(3 + fx * (w - 6));
      f.y = Math.round(top + fy * span);
    });
    planted.forEach(f => {
      f.x = Math.round(3 + f.fx * (w - 6));
      f.y = Math.round(top + f.fy * span);
    });
    drawables = [...flowers, ...planted, ...items].sort((a, b) => baseY(a) - baseY(b));
  }
  const baseY = d => d.kind === 'item' ? d.y + d.h : d.y;

  /* ---- Pre-rendered layers --------------------------------------------- */
  function buildBackground() {
    bg = S.canvas(w, h);
    const g = bg.getContext('2d');
    const cols = ['#060819', '#090c25', '#0d1030', '#12153c', '#181a48', '#201f54', '#29245e', '#342a68', '#41306f'];
    const n = cols.length;
    for (let y = 0; y < h; y++) {
      const f = Math.min(n - 1.001, (y / groundY) * (n - 1));
      const i = Math.floor(f), frac = f - i;
      g.fillStyle = cols[i];
      g.fillRect(0, y, w, 1);
      // ordered dither into the next band
      const next = cols[i + 1];
      if (!next || frac < 0.5) continue;
      g.fillStyle = next;
      for (let x = 0; x < w; x++) {
        const on = frac < 0.72 ? (x % 2 === 0 && y % 2 === 0) : frac < 0.88 ? (x + y) % 2 === 0 : !(x % 2 === 1 && y % 2 === 1);
        if (on) g.fillRect(x, y, 1, 1);
      }
    }

    // Moon
    const R = moon.r;
    const size = R * 2 + 1;
    moonSprite = S.canvas(size, size);
    const m = moonSprite.getContext('2d');
    const disc = (cx, cy, rr, col) => {
      m.fillStyle = col;
      for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++)
        if (x * x + y * y <= rr * rr + rr * 0.8) m.fillRect(cx + x, cy + y, 1, 1);
    };
    disc(R, R, R, '#f0dcb0');
    disc(R + 1, R - 1, R - 1, '#fff3d6');
    disc(R - Math.round(R * 0.35), R - Math.round(R * 0.2), Math.max(1, Math.round(R * 0.22)), '#e8d3a4');
    disc(R + Math.round(R * 0.35), R + Math.round(R * 0.35), Math.max(1, Math.round(R * 0.15)), '#e8d3a4');
    disc(R + Math.round(R * 0.1), R - Math.round(R * 0.55), Math.max(1, Math.round(R * 0.1)), '#e8d3a4');
    disc(R - Math.round(R * 0.25), R + Math.round(R * 0.5), Math.max(1, Math.round(R * 0.09)), '#ecd9ad');

    // Two glow frames, pulsing
    moonGlow = [0, 1].map(k => {
      const gr = R + 10 + k;
      const c = S.canvas(gr * 2 + 1, gr * 2 + 1);
      const gg = c.getContext('2d');
      for (let y = -gr; y <= gr; y++) for (let x = -gr; x <= gr; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d <= R) continue;
        if (d <= R + 3 + k && (x + y) % 2 === 0) { gg.fillStyle = '#5d5596'; gg.fillRect(x + gr, y + gr, 1, 1); }
        else if (d <= R + 6 + k && x % 2 === 0 && y % 2 === 0) { gg.fillStyle = '#4a4488'; gg.fillRect(x + gr, y + gr, 1, 1); }
        else if (d <= gr && (x % 3 === 0 && y % 3 === 0)) { gg.fillStyle = '#39357a'; gg.fillRect(x + gr, y + gr, 1, 1); }
      }
      return c;
    });
  }

  function buildCloud() {
    const c = S.canvas(40, 10);
    const g = c.getContext('2d');
    const blobs = [[8, 6, 4], [15, 4, 5], [23, 5, 5], [30, 6, 4], [19, 7, 4]];
    const inside = (x, y) => blobs.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= br * br) && y <= 8;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 40; x++) {
      if (!inside(x, y)) continue;
      g.fillStyle = !inside(x, y - 1) ? '#4a4686' : '#2c2a62';
      g.fillRect(x, y, 1, 1);
    }
    return c;
  }

  function buildForeground() {
    fg = S.canvas(w, h);
    const g = fg.getContext('2d');
    // far hills
    g.fillStyle = '#1c1f4c';
    for (let x = 0; x < w; x++) { const y = farHillY(x); g.fillRect(x, y, 1, groundY - y + 2); }
    // near hills with a moonlit rim
    for (let x = 0; x < w; x++) {
      const y = hillY(x);
      g.fillStyle = '#12173a'; g.fillRect(x, y, 1, groundY - y + 2);
      g.fillStyle = '#262c5e'; g.fillRect(x, y, 1, 1);
    }
    // the two friends, centred on the summit and sitting flush on the grass
    // (drawn every frame in draw(), so they can have their quiet moment)
    const fw = S.friends.bodyW, fx0 = mound.peakX - Math.floor(fw / 2);
    let ground = 0;
    for (let x = fx0; x < fx0 + fw; x++) ground = Math.max(ground, hillY(x));
    mound.friendsX = fx0;
    mound.friendsTop = ground - S.friends.bodyH + 1;

    // ground bands
    const bands = ['#1d4031', '#193a2c', '#163326', '#132d22', '#11281e'];
    const bandH = Math.ceil((h - groundY) / bands.length);
    for (let i = 0; i < bands.length; i++) {
      g.fillStyle = bands[i];
      g.fillRect(0, groundY + i * bandH, w, bandH + 1);
      if (i > 0) { // dither the seam
        g.fillStyle = bands[i - 1];
        for (let x = 0; x < w; x += 2) g.fillRect(x + (i % 2), groundY + i * bandH, 1, 1);
      }
    }
    // grassy edge
    const r = rng(3);
    for (let x = 0; x < w; x++) {
      g.fillStyle = '#2a5a40';
      g.fillRect(x, groundY, 1, 1);
      if (r() < 0.35) { g.fillStyle = '#2f6a48'; g.fillRect(x, groundY - 1, 1, 1); }
      if (r() < 0.08) { g.fillStyle = '#2f6a48'; g.fillRect(x, groundY - 2, 1, 1); }
    }
    // grass tufts
    const count = Math.round(w * (h - groundY) / 60);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(r() * w), y = groundY + 3 + Math.floor(r() * (h - groundY - 3));
      g.fillStyle = r() < 0.5 ? '#24503a' : '#2b5f44';
      g.fillRect(x, y, 1, 1);
      g.fillRect(x - 1, y - 1, 1, 1);
      g.fillRect(x + 1, y - 1, 1, 1);
    }
    // shadows under items
    items.forEach(it => {
      g.fillStyle = '#0d2219';
      g.fillRect(it.x + 1, it.y + it.h, it.w - 2, 1);
      g.fillRect(it.x + 3, it.y + it.h + 1, it.w - 6, 1);
    });
  }

  /* ---- Drawing --------------------------------------------------------- */
  const DUST = ['#2a2d63', '#4b4f93', '#8a8fd0', '#d6d9ff'];

  function draw() {
    const t = state.t;
    ctx.drawImage(bg, 0, 0);

    for (const d of dust) {
      const tw = Math.sin(t * d.speed + d.phase);
      const lvl = clamp(d.base + (tw > 0.75 ? 2 : tw > 0.2 ? 1 : 0), 0, 3);
      ctx.fillStyle = DUST[lvl];
      ctx.fillRect(d.x, d.y, 1, 1);
    }

    for (const c of clouds) ctx.drawImage(cloudSprite, Math.round(c.x), c.y);

    // moon + glow
    const gl = moonGlow[Math.floor(t * 0.8) % 2];
    ctx.drawImage(gl, moon.x - (gl.width >> 1), moon.y - (gl.height >> 1));
    ctx.drawImage(moonSprite, moon.x - moon.r, moon.y - moon.r);
    if (state.hover === moon) ring(moon.x, moon.y, moon.r + 2, '#fff3d6');

    drawConstellation();
    drawInitial();
    drawNoteStars();

    // reason stars
    for (const s of stars) {
      const frames = state.read.has(s.i) ? S.starRead : isLocked(C.reasons[s.i]) ? S.starLocked : S.star;
      const f = Math.floor(t * s.speed + s.phase) % 2;
      const hover = state.hover === s;
      if (hover || Math.sin(t * 1.7 + s.phase) > 0.2) {
        ctx.fillStyle = hover ? '#6d63b0' : '#3b3878';
        ctx.fillRect(s.x - 3, s.y, 1, 1); ctx.fillRect(s.x + 3, s.y, 1, 1);
        ctx.fillRect(s.x, s.y - 3, 1, 1); ctx.fillRect(s.x, s.y + 3, 1, 1);
      }
      ctx.drawImage(frames[hover ? 0 : f], s.x - 2, s.y - 2);
    }

    drawShootingStar();

    // the little spaceship that opens the minigame, hovering in the sky
    const ships = window.GAME.shipSprite;
    const sy = rocket.y + Math.round(Math.sin(t * 1.8) * 1.5);
    if (state.hover === rocket) {
      rocketOutline = rocketOutline || S.outline(ships[0], '#fff3d6');
      ctx.drawImage(rocketOutline, rocket.x - 6, sy - 6);
    } else {
      ctx.drawImage(ships[Math.floor(t * 10) % 2], rocket.x - 5, sy - 5);
    }

    ctx.drawImage(fg, 0, 0);

    // the two friends (frames are 4px taller than their bodies, for the arm)
    // (after the afterparty they hop and cheer for a few seconds)
    const cheering = state.party && state.t - state.party.t0 < 6;
    const hop = cheering && Math.floor(state.t * 6) % 2 ? 1 : 0;
    if (state.tickle) drawTickle();
    else ctx.drawImage(cheering ? (hop ? S.friends.point : S.friends.base) : friendsFrame(), mound.friendsX, mound.friendsTop - 4 - hop);
    drawBook();
    drawSnackTower();
    drawWishStar();

    drawDoor();

    // the little heart hovering over the two of them (it opens the blanket fort)
    const hb = heartPos(), beat = state.heartT < 0.8 && Math.floor(state.heartT * 8) % 2 === 0;
    if (state.hover && state.hover.kind === 'fortheart') { ctx.fillStyle = '#fff3d6'; ctx.fillRect(hb.x - 1, hb.y - 1, 5, 5); }
    ctx.drawImage(S.smallHeart, hb.x, hb.y - (beat ? 1 : 0));

    // flowers and items, back to front
    const g = state.growing;
    for (const d of drawables) {
      if (d.kind === 'item') { drawItem(d); continue; }
      if (!d.planted && d.i >= state.visible) continue;
      if (g && g.f === d) { drawGrowing(g); continue; }
      if (d.planted && state.hover === d) {
        ctx.drawImage(d.outline || (d.outline = S.outline(d.frames[0], '#fff3d6')), d.x - d.ax - 1, d.y - d.ay - 1);
        continue;
      }
      const wave = Math.sin(t * 1.6 - d.x * 0.06 + d.phase * 0.3);
      const fr = d.frames[wave > 0.55 ? 1 : 0];
      ctx.drawImage(fr, d.x - d.ax, d.y - d.ay);
    }

    // where her flower will go while she's choosing a spot
    const pl = state.placing;
    if (pl && pl.at) {
      ctx.globalAlpha = Math.sin(t * 6) > 0 ? 0.75 : 0.45;
      ctx.drawImage(pl.ghost.frames[0], pl.at.x - pl.ghost.ax, pl.at.y - pl.ghost.ay);
      ctx.globalAlpha = 1;
    }

    // fireflies (the first one is the lost one: brighter, always lit, tappable)
    fireflies.forEach((f, i) => {
      const special = i === 0;
      const x = Math.round(f.bx + Math.sin(t * f.sp + f.ph) * (special ? 22 : 14));
      const y = Math.round(f.by + Math.sin(t * f.sp * 1.7 + f.ph * 2) * 7);
      f.x = x; f.y = y;
      const b = special ? 0.7 + Math.sin(t * 2.4) * 0.3 : Math.sin(t * 1.3 + f.ph);
      if (b < -0.1) return;
      if (special) {
        ctx.fillStyle = state.hover && state.hover.kind === 'firefly' ? '#9fb85a' : '#3f5424';
        ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5);
      }
      if (b > 0.6) {
        ctx.fillStyle = '#56702c';
        ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
      }
      ctx.fillStyle = special ? '#fdffd0' : b > 0.3 ? '#f4ff9a' : '#a8b85a';
      ctx.fillRect(x, y, 1, 1);
    });

    drawAirpod();
    drawFinale();
    for (const p of particles) drawParticle(p);
  }

  // the airpod in the grass, with a little glint every few seconds
  function drawAirpod() {
    const { x, y } = airpod, pod = window.AIRPODS.tiny;
    if (state.hover === airpod) ctx.drawImage(airpodOutline || (airpodOutline = S.outline(pod, '#fff3d6')), x - 2, y - 3);
    else ctx.drawImage(pod, x - 1, y - 2);
    const ph = state.t % 4;
    if (ph < 0.3) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 2, y - 3, 1, 1);
      if (ph > 0.1 && ph < 0.2) { ctx.fillRect(x + 1, y - 3, 3, 1); ctx.fillRect(x + 2, y - 4, 1, 3); }
    }
  }
  let airpodOutline = null;

  function ring(cx, cy, r, col) {
    ctx.fillStyle = col;
    for (let a = 0; a < 360; a += 360 / (r * 7)) {
      const x = Math.round(cx + Math.cos(a * Math.PI / 180) * r);
      const y = Math.round(cy + Math.sin(a * Math.PI / 180) * r);
      if ((x + y) % 2 === 0) ctx.fillRect(x, y, 1, 1);
    }
  }

  // items float gently above their shadows, each on its own beat
  const bob = it => -Math.round(Math.sin(state.t * 2.2 + it.bobPhase) + 1);

  function drawItem(it) {
    const y = it.y + bob(it);
    if (state.hover === it) ctx.drawImage(it.outline, it.x - 1, y - 2);
    else ctx.drawImage(it.sprite, it.x, y);
  }

  function drawGrowing(g) {
    const f = g.f, p = clamp((state.t - g.t0) / 1.6, 0, 1);
    if (p >= 1) { ctx.drawImage(f.frames[0], f.x - f.ax, f.y - f.ay); return; }
    const stem = Math.max(1, Math.ceil(f.stemH * Math.min(1, p * 2)));
    ctx.fillStyle = '#2f6e45';
    ctx.fillRect(f.x, f.y - stem + 1, 1, stem);
    if (p > 0.5 && p < 0.75) { ctx.fillStyle = '#ffd6e6'; ctx.fillRect(f.x, f.y - f.stemH, 1, 1); }
    if (p >= 0.75) ctx.drawImage(f.frames[0], f.x - f.ax, f.y - f.ay);
  }

  function drawParticle(p) {
    const k = p.age / p.life;
    if (p.type === 'glint') {
      ctx.fillStyle = '#fff3d6';
      const x = Math.round(p.x), y = Math.round(p.y);
      if (k < 0.25 || k > 0.75) ctx.fillRect(x, y, 1, 1);
      else {
        ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
        if (k > 0.4 && k < 0.6) { ctx.fillStyle = '#a99fe0'; ctx.fillRect(x - 2, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x, y - 2, 1, 1); ctx.fillRect(x, y + 2, 1, 1); }
      }
      return;
    }
    if (k > 0.7 && Math.floor(p.age * 20) % 2) return;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }

  function drawShootingStar() {
    const s = state.shooting;
    if (!s) return;
    const trail = s.victory
      ? ['#fff7c2', '#ffe066', '#ffd23f', '#f0bc2e', '#d9a02a', '#b88420', '#8a6218', '#5c4212', '#3a2a0c']
      : ['#ffffff', '#fff3d6', '#d6d9ff', '#9aa0d8', '#6a6fa8', '#4b4f93', '#2c2f66'];
    const gap = s.victory ? 0.05 : 0.045; // keeps the tail long now that it's slower
    for (let i = trail.length - 1; i >= 0; i--) {
      ctx.fillStyle = trail[i];
      const tx = Math.round(s.x - s.vx * i * gap), ty = Math.round(s.y - s.vy * i * gap);
      ctx.fillRect(tx, ty, 1, 1);
      if (s.victory && i < 4) ctx.fillRect(tx, ty + 1, 1, 1); // a thicker, golden tail
    }
    if (s.victory) ctx.drawImage(S.pineappleTiny, Math.round(s.x) - 1, Math.round(s.y) - 3);
  }

  /* ---- Update ---------------------------------------------------------- */
  function burst(x, y, colors, n = 14, spread = 30) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spread * (0.4 + Math.random() * 0.6);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, g: 30, age: 0, life: 0.7 + Math.random() * 0.6, color: colors[i % colors.length] });
    }
  }

  function update(dt) {
    const t = (state.t += dt);
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > w + 4) c.x = -cloudSprite.width - 4;
    }
    state.heartT += dt;
    if (state.heartT > 11) state.heartT = 0;
    moveStarsToHeart();
    updateMoment(dt);
    const canReplay = kReady();
    if (replayBtn.hidden === canReplay) replayBtn.hidden = !canReplay;

    // item glints hint that they're clickable
    for (const it of items) {
      it.glintT -= dt;
      if (it.glintT <= 0) {
        it.glintT = 2.5 + Math.random() * 2.5;
        particles.push({ type: 'glint', x: it.x + 2 + Math.random() * (it.w - 4), y: it.y + bob(it) - 1 + Math.random() * 4, age: 0, life: 0.7, vx: 0, vy: 0, g: 0 });
      }
    }
    // her planted flowers sparkle too, so she knows the notes are inside
    for (const f of planted) {
      if (state.growing && state.growing.f === f) continue;
      f.glintT -= dt;
      if (f.glintT <= 0) {
        f.glintT = 4 + Math.random() * 5;
        particles.push({ type: 'glint', x: f.x + Math.round(Math.random() * 4 - 2), y: f.y - f.ay - 2, age: 0, life: 0.7, vx: 0, vy: 0, g: 0 });
      }
    }

    // shooting star
    if (state.shooting) {
      const s = state.shooting;
      s.x += s.vx * dt; s.y += s.vy * dt; s.age += dt;
      if (s.age > s.life) state.shooting = null;
    } else if (state.started && (state.nextShoot -= dt) <= 0) {
      state.nextShoot = 14 + Math.random() * 16;
      const dir = Math.random() < 0.5 ? -1 : 1;
      state.shooting = {
        kind: 'shooting',
        x: w * (dir < 0 ? 0.55 + Math.random() * 0.4 : 0.05 + Math.random() * 0.4),
        y: 6 + Math.random() * groundY * 0.3,
        // slow enough to catch with a mouse: about 3 seconds across
        vx: dir * (42 + Math.random() * 14), vy: 16, age: 0, life: 3.3
      };
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.delay > 0) { p.delay -= dt; continue; } // waits in place before it moves
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt;
      p.vx *= 0.96;
    }

    if (state.growing && t - state.growing.t0 > 1.6 && !state.growing.done) {
      state.growing.done = true;
      const f = state.growing.f;
      burst(f.x, f.y - f.stemH - 2, ['#fff3d6', '#ffe7a0', '#ff9ec4', '#c3a6ff'], 18, 26);
      A.sfx('grow');
      if (f.planted) toast(C.planting.planted);
      else onFlowerGrown(f.i + 1);
    }
  }

  /* ---- Flower growth --------------------------------------------------- */
  function growNewFlower() {
    const f = flowers[garden.count - 1];
    if (!f) return;
    state.visible = garden.count;
    state.growing = { f, t0: state.t };
  }

  function onFlowerGrown(n) {
    updateHud();
    const m = C.flowers && C.flowers.milestones && C.flowers.milestones[n];
    if (m) setTimeout(() => openDialog(`flower #${n}`, m), 500);
    else toast(`a new flower grew. that's ${n}.`);
  }

  /* ---- Hit testing ----------------------------------------------------- */
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }

  function hitTest(p) {
    for (const it of items)
      if (p.x >= it.x - 3 && p.x <= it.x + it.w + 3 && p.y >= it.y - 4 && p.y <= it.y + it.h + 3) return it;
    const fr = Math.max(4, 14 / scale);
    for (let i = planted.length - 1; i >= 0; i--) {
      const f = planted[i];
      if (Math.abs(p.x - f.x) <= fr && p.y >= f.y - f.ay - 3 && p.y <= f.y + 2) return f;
    }
    const s = state.shooting;
    if (s && Math.hypot(p.x - s.x, p.y - s.y) < Math.max(12, 44 / scale)) return s;
    if (Math.hypot(p.x - moon.x, p.y - moon.y) <= moon.r + 3) return moon;
    if (Math.hypot(p.x - rocket.x, p.y - rocket.y) <= Math.max(8, 22 / scale)) return rocket;
    if (wishes.length && Math.hypot(p.x - wishStar.x, p.y - wishStar.y) <= Math.max(5, 20 / scale)) return wishStar;
    if (kReady()) {
      const k = kPos();
      if (p.x >= k.x - 3 && p.x <= k.x + 10 && p.y >= k.y - 3 && p.y <= k.y + 12) return { kind: 'initial', x: k.x + 3, y: k.y };
    }
    // her notebook, on the grass beside them
    const bk = bookPos();
    if (p.x >= bk.x - 3 && p.x <= bk.x + 9 && p.y >= bk.y - 4 && p.y <= bk.y + 6) return { kind: 'book', x: bk.x + 3, y: bk.y };
    // the heart above them (blanket fort)
    const hb = heartPos();
    if (Math.hypot(p.x - (hb.x + 1), p.y - (hb.y + 1)) <= Math.max(4, 16 / scale)) return { kind: 'fortheart', x: hb.x + 1, y: hb.y };
    // the tiny door in the hill (secret room)
    const dp = doorPos();
    if (p.x >= dp.x - 2 && p.x <= dp.x + 7 && p.y >= dp.y - 2 && p.y <= dp.y + 8) return { kind: 'door', x: dp.x + 2, y: dp.y };
    // the music-note stars (star piano)
    if (Math.hypot(p.x - noteStar.x, p.y - noteStar.y) <= Math.max(6, 22 / scale)) return noteStar;
    // the two of them: a little tickle fight
    if (p.x >= mound.friendsX - 1 && p.x <= mound.friendsX + 16 && p.y >= mound.friendsTop - 3 && p.y <= mound.friendsTop + 9) {
      return { kind: 'friends', x: mound.friendsX + 7, y: mound.friendsTop };
    }
    // the airpod in the grass
    if (Math.hypot(p.x - airpod.x, p.y - airpod.y) <= Math.max(5, 18 / scale)) return airpod;
    // the lost firefly
    const ff = fireflies[0];
    if (ff && ff.x != null && Math.hypot(p.x - ff.x, p.y - ff.y) <= Math.max(7, 26 / scale)) return { kind: 'firefly', x: ff.x, y: ff.y };
    const reach = Math.max(5, 22 / scale);
    let best = null, bd = reach;
    for (const st of stars) {
      const d = Math.hypot(p.x - st.x, p.y - st.y);
      if (d < bd) { bd = d; best = st; }
    }
    if (best) return best;
    // the drifting clouds (shadow theater)
    for (const c of clouds) {
      if (p.x >= c.x + 2 && p.x <= c.x + cloudSprite.width - 2 && p.y >= c.y - 1 && p.y <= c.y + cloudSprite.height) return { kind: 'cloud', x: c.x + cloudSprite.width / 2, y: c.y };
    }
    return null;
  }

  function labelFor(t) {
    if (t.kind === 'item') return t.label;
    if (t.kind === 'moon') return 'things i never tell you';
    if (t.kind === 'star') return state.read.has(t.i) ? `reason #${t.i + 1} (read)` : isLocked(C.reasons[t.i]) ? 'a locked reason' : 'a reason';
    if (t.kind === 'shooting') return 'catch it!';
    if (t.planted) return 'a note';
    if (t.kind === 'ship') return (C.game && C.game.shipLabel) || 'a little game';
    if (t.kind === 'wish') return WI.starTitle;
    if (t.kind === 'initial') return 'psst';
    if (t.kind === 'book') return (C.notebook && C.notebook.label) || 'a notebook';
    if (t.kind === 'fortheart') return (C.fort && C.fort.label) || 'our blanket fort';
    if (t.kind === 'door') return (C.secretRoom && C.secretRoom.doorLabel) || 'a tiny door';
    if (t.kind === 'piano') return (C.piano && C.piano.label) || 'star piano';
    if (t.kind === 'cloud') return (C.shadows && C.shadows.label) || 'shadow theater';
    if (t.kind === 'friends') return 'the two of you';
    if (t.kind === 'firefly') return (C.fireflies && C.fireflies.label) || 'a lost firefly';
    if (t.kind === 'airpod') return (C.airpods && C.airpods.label) || 'an airpod?';
    if (t.kind === 'shooting' && t.victory) return 'catch it!';
    return '';
  }
  const fmtDate = iso => iso
    ? new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).toLowerCase()
    : 'today';

  const tooltip = $('tooltip');
  function setHover(t) {
    state.hover = t;
    canvas.style.cursor = t ? 'pointer' : 'default';
    if (!t) { tooltip.classList.remove('show'); return; }
    let x, y;
    if (t.kind === 'item') { x = t.x + t.w / 2; y = t.y - 4; }
    else if (t.kind === 'moon') { x = t.x; y = t.y - t.r - 4; }
    else if (t.planted) { x = t.x; y = t.y - t.ay - 3; }
    else { x = t.x; y = t.y - 6; }
    tooltip.textContent = labelFor(t);
    tooltip.style.left = clamp(x * scale, 90, W - 90) + 'px';
    tooltip.style.top = Math.max(40, y * scale) + 'px';
    tooltip.classList.add('show');
  }

  canvas.addEventListener('pointermove', e => {
    if (!state.started || state.modal || state.dialog || e.pointerType === 'touch') return;
    if (state.placing) {
      const p = toLogical(e);
      state.placing.at = validSpot(p) ? { x: Math.round(p.x), y: Math.round(p.y) } : null;
      canvas.style.cursor = state.placing.at ? 'pointer' : 'not-allowed';
      return;
    }
    const t = hitTest(toLogical(e));
    if (t !== state.hover) setHover(t);
  });
  canvas.addEventListener('pointerleave', () => { setHover(null); if (state.placing) state.placing.at = null; });

  canvas.addEventListener('click', e => {
    if (!state.started || state.modal || state.dialog) return;
    if (state.placing) return plantAt(toLogical(e));
    const t = hitTest(toLogical(e));
    setHover(null);
    if (t) activate(t);
  });

  function activate(t) {
    if (t.kind === 'star') return openStar(t);
    if (t.kind === 'moon') {
      A.sfx('open');
      burst(moon.x, moon.y, ['#fff3d6', '#ffe7a0'], 16, 34);
      window.open('secrets.html', '_blank');
      return;
    }
    if (t.kind === 'shooting') {
      A.sfx('wish');
      state.shooting = null;
      if (t.victory) {
        burst(t.x, t.y, ['#ffd23f', '#fff7c2', '#4caf50'], 24, 40);
        return openDialog(C.game.victoryStarTitle, C.game.victoryStar);
      }
      burst(t.x, t.y, ['#ffffff', '#ffe7a0', '#ff9ec4'], 24, 40);
      return openWish();
    }
    if (t.kind === 'wish') { A.sfx('star'); return openDialog(WI.starTitle, wishStarLine()); }
    if (t.kind === 'initial') return openK();
    if (t.kind === 'book') return openNotebook();
    if (t.kind === 'fortheart') { A.sfx('open'); return window.FORT.open(() => {}); }
    if (t.kind === 'door') return openDoor();
    if (t.kind === 'piano') { A.sfx('star'); return window.PIANO.open(() => {}); }
    if (t.kind === 'cloud') { A.sfx('open'); return window.SHADOWS.open(res => { if (res && res.complete) store.set('kamy.shadows.done', true); }); }
    if (t.kind === 'friends') return startTickle();
    if (t.kind === 'firefly') return openFireflies();
    if (t.kind === 'airpod') {
      A.sfx('open');
      return window.AIRPODS.open(res => {
        if (!res || !res.complete) return;
        store.set('kamy.airpods.done', true);
        burst(airpod.x, airpod.y, ['#ffffff', '#fff3d6', '#b8bcd0'], 18, 30);
      });
    }
    if (t.kind === 'item') { A.sfx('open'); t.action(); }
    if (t.planted) { A.sfx('star'); openDialog(`planted ${fmtDate(t.date)}`, t.note); }
    if (t.kind === 'ship') {
      A.sfx('open');
      hideHint();
      // after beating Sofian she comes back to a pineapple shooting star
      window.GAME.open(res => {
        if (res && res.won) setTimeout(victoryStar, 1300);
        if (res && res.snack) celebrate(res.snack);
      });
    }
  }

  function openStar(s) {
    const reason = C.reasons[s.i];
    if (isLocked(reason)) return openLockedStar(s, reason);
    showReason(s, reason);
  }

  function showReason(s, text) {
    A.sfx('star');
    burst(s.x, s.y, ['#fff3d6', '#ffe7a0', '#ffb3cf'], 12, 22);
    const first = !state.read.has(s.i);
    state.read.add(s.i);
    store.set(KEY_STARS, [...state.read]);
    updateHud();
    hideHint();
    const all = first && state.read.size === stars.length && stars.length === C.reasons.length;
    openDialog(`reason #${s.i + 1}`, text, all ? () => {
      formConstellation(false);
      setTimeout(() => openDialog('every star', C.allStarsFound), (FORM_TIME + LINE_TIME) * 1000 + 900);
    } : null);
  }

  /* ---- Locked stars ------------------------------------------------------ */
  /* A star can hold { locked: "..." } instead of text: its words are
     encrypted with a passcode (scripts/lock.mjs), so they aren't readable
     in the site's files. Once unlocked, the code is kept for this browsing
     session only, so the stars lock again if the site is shown later. */
  const KEY_STARCODE = 'kamy.starcode';
  const LS = C.lockedStars || {};
  const isLocked = r => !!(r && typeof r === 'object' && r.locked);
  $('lock-title').textContent = LS.title || 'a locked reason';
  $('lock-text').textContent = LS.prompt || '';
  let lockTarget = null;

  // each star has its own question, so remember each answer separately
  const session = {
    get(i) { try { return sessionStorage.getItem(`${KEY_STARCODE}.${i}`); } catch (e) { return null; } },
    set(i, v) { try { sessionStorage.setItem(`${KEY_STARCODE}.${i}`, v); } catch (e) {} }
  };

  // try every accepted answer; "your smile" also works when the prefix is "Your"
  async function unlockWith(r, code) {
    const tries = [code];
    const pre = norm(r.prefix || '');
    if (pre && norm(code).startsWith(pre)) tries.push(norm(code).slice(pre.length));
    for (const c of tries) {
      for (const p of [].concat(r.locked)) {
        try { return await decryptReason(p, c); } catch (e) { /* not this one */ }
      }
    }
    throw new Error('wrong answer');
  }

  async function decryptReason(payload, code) {
    const bytes = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
    const salt = bytes.slice(0, 16), iv = bytes.slice(16, 28), data = bytes.slice(28);
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(norm(code)), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data));
  }

  async function openLockedStar(s, reason) {
    const saved = session.get(s.i);
    if (saved) {
      try { return showReason(s, await unlockWith(reason, saved)); } catch (e) { /* fall through to asking */ }
    }
    lockTarget = s;
    A.sfx('blip');
    $('lock-text').textContent = reason.question || LS.prompt || '';
    $('lock-prefix').textContent = reason.prefix || '';
    $('lock-prefix').hidden = !reason.prefix;
    $('lock-input').value = '';
    $('lock-msg').textContent = '';
    openModal('lock-modal');
    setTimeout(() => $('lock-input').focus(), 50);
  }

  $('lock-form').addEventListener('submit', async e => {
    e.preventDefault();
    const s = lockTarget, code = $('lock-input').value;
    if (!s) return;
    try {
      const text = await unlockWith(C.reasons[s.i], code);
      session.set(s.i, code);
      closeModal();
      showReason(s, text);
    } catch (err) {
      $('lock-msg').textContent = 'not quite. try again?';
      A.sfx('close');
      const box = document.querySelector('.lockbox');
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
    }
  });

  /* ---- Dialog (typewriter text box) ------------------------------------ */
  const dlgLayer = $('dialog-layer'), dlg = $('dialog'), dlgText = $('dialog-text');
  let dlgTimer = null, dlgFull = '', dlgAfter = null;

  function openDialog(title, text, after) {
    clearInterval(dlgTimer);
    state.dialog = true;
    dlgAfter = after || null;
    $('dialog-title').textContent = title;
    dlgText.textContent = '';
    dlgFull = text;
    dlg.classList.remove('done');
    dlgLayer.classList.add('open');
    let i = 0;
    dlgTimer = setInterval(() => {
      i++;
      dlgText.textContent = dlgFull.slice(0, i);
      if (i % 3 === 0 && dlgFull[i - 1] !== ' ') A.sfx('type');
      if (i >= dlgFull.length) { clearInterval(dlgTimer); dlgTimer = null; dlg.classList.add('done'); }
    }, 32);
  }

  function advanceDialog() {
    if (dlgTimer) { // finish typing first
      clearInterval(dlgTimer); dlgTimer = null;
      dlgText.textContent = dlgFull; dlg.classList.add('done');
      return;
    }
    dlgLayer.classList.remove('open');
    state.dialog = false;
    A.sfx('close');
    const after = dlgAfter; dlgAfter = null;
    if (after) after();
  }
  dlgLayer.addEventListener('click', advanceDialog);

  /* ---- Modals ---------------------------------------------------------- */
  function openModal(id) {
    const m = $(id);
    m.classList.add('open');
    state.modal = m;
  }
  function closeModal(m) {
    m = m || state.modal;
    if (!m) return;
    m.classList.remove('open');
    A.sfx('close');
    if (m.id === 'playlist-modal') { $('playlist-body').innerHTML = ''; A.setPaused(false); }
    if (m.id === 'tape-modal') stopTape(true);
    if (m.id === 'lightbox') stopFilm();
    if (m.id === 'room-modal') {
      cancelAnimationFrame(roomRaf);
      if (roomAudio && !roomAudio.paused) { roomAudio.pause(); $('room-play').textContent = 'play'; A.setPaused(false); }
    }
    if (m.id === 'k-modal' && kAudio && !kAudio.paused) { kAudio.pause(); $('k-play').textContent = 'play'; A.setPaused(false); }
    state.modal = m.id === 'lightbox' && $('gallery-modal').classList.contains('open') ? $('gallery-modal') : null;
  }
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target.hasAttribute('data-close')) closeModal(m); });
  });

  function openLetter() {
    const L = C.letter;
    $('letter-greeting').textContent = L.greeting;
    const body = $('letter-body');
    body.innerHTML = '';
    L.paragraphs.forEach(p => { const el = document.createElement('p'); el.textContent = p; body.appendChild(el); });
    $('letter-signoff').textContent = L.signoff;
    $('letter-signature').textContent = L.signature;
    openModal('letter-modal');
    $('letter-modal').querySelector('.paper').scrollTop = 0;
  }

  function embedUrl(u) {
    if (!u) return null;
    let m = u.match(/open\.spotify\.com\/(?:intl-\w+\/)?(playlist|album|track)\/([A-Za-z0-9]+)/);
    if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}?theme=0`;
    m = u.match(/[?&]list=([\w-]+)/);
    if (m && /youtube\.com|youtu\.be/.test(u)) return `https://www.youtube.com/embed/videoseries?list=${m[1]}`;
    if (/music\.apple\.com/.test(u)) return u.replace('music.apple.com', 'embed.music.apple.com');
    return null;
  }

  function openPlaylist() {
    const P = C.playlist;
    $('playlist-title').textContent = P.title;
    const body = $('playlist-body');
    body.innerHTML = '';
    const src = embedUrl(P.url);
    if (src) {
      A.setPaused(true); // let her playlist take over
      const f = document.createElement('iframe');
      f.src = src;
      f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      f.loading = 'lazy';
      body.appendChild(f);
    } else if (!P.url) {
      body.innerHTML = '<p>the playlist is still being made. check back soon.</p>';
    }
    if (P.url) {
      const a = document.createElement('a');
      a.className = 'pixel-btn'; a.href = P.url; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = 'open in app';
      body.appendChild(a);
    }
    openModal('playlist-modal');
  }

  let lbIndex = 0;
  function openGallery() {
    A.sfx('shutter');
    const fl = $('flash');
    fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    renderGallery();
    setTimeout(() => openModal('gallery-modal'), 180);
  }

  // the prompt and the reset button follow what's still undeveloped
  function galleryChrome() {
    const shown = C.photos.filter(p => !$('gallery-grid').children[C.photos.indexOf(p)]?.classList.contains('is-missing'));
    const anyBlurry = shown.some(undeveloped), anyDone = shown.some(p => !undeveloped(p));
    $('gallery-hint').textContent = anyBlurry ? (C.galleryHint || 'tap a photo, then rub it gently to develop it.') : '';
    $('gallery-reset').hidden = !anyDone;
  }

  function renderGallery() {
    const grid = $('gallery-grid');
    grid.innerHTML = '';
    C.photos.forEach((p, i) => {
      const fig = document.createElement('figure');
      fig.className = 'polaroid';
      const img = document.createElement('img');
      img.className = 'ph'; img.alt = real(p.caption); img.loading = 'lazy'; img.src = p.src;
      const cap = document.createElement('figcaption');
      img.onerror = () => {
        // not uploaded yet: a gentle placeholder that can't be opened
        const d = document.createElement('div');
        d.className = 'missing';
        d.textContent = isLocal ? `add ${p.src.split('/').pop()}` : 'still developing...';
        img.replaceWith(d);
        fig.classList.add('is-missing');
        fig.classList.remove('undeveloped');
        cap.textContent = '';
        galleryChrome();
      };
      cap.textContent = undeveloped(p) ? (C.filmThumbHint || 'rub to develop') : real(p.caption);
      if (undeveloped(p)) fig.classList.add('undeveloped');
      fig.append(img, cap);
      fig.addEventListener('click', () => { if (!fig.classList.contains('is-missing')) openLightbox(i); });
      grid.appendChild(fig);
    });
    galleryChrome();
  }

  // reset: every photo goes back to blurry (asks "sure?" first)
  const galleryReset = $('gallery-reset');
  galleryReset.addEventListener('click', () => {
    if (!galleryReset.classList.contains('confirm')) {
      galleryReset.classList.add('confirm'); galleryReset.textContent = 'sure?';
      A.sfx('blip');
      setTimeout(() => { galleryReset.classList.remove('confirm'); galleryReset.textContent = 'reset photos'; }, 3000);
      return;
    }
    galleryReset.classList.remove('confirm'); galleryReset.textContent = 'reset photos';
    store.set(KEY_DEV, []);
    A.sfx('shutter');
    renderGallery();
  });

  function openLightbox(i) {
    const n = C.photos.length;
    lbIndex = (i + n) % n;
    const p = C.photos[lbIndex];
    $('lb-img').src = p.src;
    $('lb-img').alt = real(p.caption);
    $('lb-caption').textContent = real(p.caption);
    const multi = n > 1;
    $('lb-prev').style.visibility = $('lb-next').style.visibility = multi ? 'visible' : 'hidden';
    if (!$('lightbox').classList.contains('open')) A.sfx('blip');
    stopFilm();
    if (undeveloped(p)) startFilm(p);
    openModal('lightbox');
  }
  $('lb-prev').addEventListener('click', () => openLightbox(lbIndex - 1));
  $('lb-next').addEventListener('click', () => openLightbox(lbIndex + 1));

  /* ---- Photos she develops by rubbing them ------------------------------ */
  /* Every photo starts blurry and dim. Rubbing it sharpens the real photo a
     patch at a time; once most of it is clear, the rest develops with a flash. */
  const KEY_DEV = 'kamy.developed';
  const LV = 3; // rubs each patch needs
  const filmCv = $('lb-film'), fctx = filmCv.getContext('2d');
  const film = { on: false, cols: 0, rows: 0, level: null, cool: null, rubbing: false, done: false, photo: null, blur: null, img: null };
  function undeveloped(p) { return p.develop !== false && !store.get(KEY_DEV, []).includes(p.src); }

  function placeFilm() {
    const img = $('lb-img');
    Object.assign(filmCv.style, { left: img.offsetLeft + 'px', top: img.offsetTop + 'px', width: img.clientWidth + 'px', height: img.clientHeight + 'px' });
  }

  function startFilm(p) {
    const img = $('lb-img');
    film.on = true; film.done = false; film.photo = p;
    $('lb-caption').textContent = C.filmHint || 'rub it gently to develop';
    const setup = () => {
      if (!film.on || !img.naturalWidth || !img.clientWidth) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(img.clientWidth * dpr), H = Math.round(img.clientHeight * dpr);
      filmCv.width = W; filmCv.height = H;
      // patches she rubs clear; each takes a few rubs
      film.cols = 20;
      film.rows = Math.max(8, Math.round(20 * H / W));
      const n = film.cols * film.rows;
      film.level = new Float32Array(n).fill(LV);
      film.cool = new Float64Array(n);
      // the undeveloped look: shrink then stretch the photo (blur), and dim it
      const tiny = S.canvas(Math.max(4, Math.round(W / 20)), Math.max(4, Math.round(H / 20)));
      const tg = tiny.getContext('2d');
      tg.imageSmoothingQuality = 'high';
      tg.drawImage(img, 0, 0, tiny.width, tiny.height);
      film.blur = S.canvas(W, H);
      const bg = film.blur.getContext('2d');
      bg.imageSmoothingEnabled = true; bg.imageSmoothingQuality = 'high';
      bg.drawImage(tiny, 0, 0, W, H);
      bg.fillStyle = 'rgba(42, 30, 38, 0.5)';
      bg.fillRect(0, 0, W, H);
      film.img = img;
      placeFilm();
      filmCv.hidden = false;
      drawFilm();
    };
    if (img.complete && img.naturalWidth) requestAnimationFrame(setup);
    else img.addEventListener('load', () => requestAnimationFrame(setup), { once: true });
  }

  function stopFilm() { film.on = false; film.rubbing = false; filmCv.hidden = true; }

  // blurry base, with the sharp photo showing through wherever she's rubbed
  function drawFilm() {
    const W = filmCv.width, H = filmCv.height, cw = W / film.cols, ch = H / film.rows;
    const sx = film.img.naturalWidth / W, sy = film.img.naturalHeight / H;
    fctx.globalAlpha = 1;
    fctx.drawImage(film.blur, 0, 0);
    for (let i = 0; i < film.level.length; i++) {
      const l = film.level[i];
      if (l >= LV) continue;
      const x = (i % film.cols) * cw, y = Math.floor(i / film.cols) * ch;
      fctx.globalAlpha = 1 - l / LV;
      fctx.drawImage(film.img, x * sx, y * sy, cw * sx, ch * sy, x, y, cw + 0.5, ch + 0.5);
    }
    fctx.globalAlpha = 1;
  }

  function rub(e) {
    if (!film.on || film.done || !film.level) return;
    const r = filmCv.getBoundingClientRect();
    const cx = (e.clientX - r.left) / r.width * film.cols, cy = (e.clientY - r.top) / r.height * film.rows;
    const now = performance.now();
    let changed = false;
    for (let y = Math.floor(cy - 2); y <= cy + 2; y++) for (let x = Math.floor(cx - 2); x <= cx + 2; x++) {
      if (x < 0 || y < 0 || x >= film.cols || y >= film.rows) continue;
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > 1.9) continue;
      const i = y * film.cols + x;
      if (film.level[i] > 0 && now - film.cool[i] > 100) { film.level[i]--; film.cool[i] = now; changed = true; }
    }
    if (!changed) return;
    drawFilm();
    if (Math.random() < 0.25) A.sfx('type');
    const left = film.level.reduce((a, b) => a + b, 0) / (film.level.length * LV);
    if (left <= 0.4) finishFilm();
  }

  // once she's rubbed enough, the rest develops by itself with a flash
  function finishFilm() {
    film.done = true;
    const dev = store.get(KEY_DEV, []);
    if (!dev.includes(film.photo.src)) { dev.push(film.photo.src); store.set(KEY_DEV, dev); }
    const fade = setInterval(() => {
      let any = false;
      for (let i = 0; i < film.level.length; i++) if (film.level[i] > 0) { film.level[i] = Math.max(0, film.level[i] - 0.4); any = true; }
      drawFilm();
      if (!any) { clearInterval(fade); stopFilm(); galleryChrome(); }
    }, 60);
    const fl = $('flash');
    fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    A.sfx('wish');
    $('lb-caption').textContent = real(film.photo.caption);
    const fig = $('gallery-grid').children[C.photos.indexOf(film.photo)];
    if (fig) { fig.classList.remove('undeveloped'); fig.querySelector('figcaption').textContent = real(film.photo.caption); }
  }

  filmCv.addEventListener('pointerdown', e => { film.rubbing = true; try { filmCv.setPointerCapture(e.pointerId); } catch (err) {} rub(e); });
  filmCv.addEventListener('pointermove', e => { if (film.rubbing) rub(e); });
  ['pointerup', 'pointercancel'].forEach(t => filmCv.addEventListener(t, () => { film.rubbing = false; }));
  window.addEventListener('resize', () => { if (film.on && !filmCv.hidden) placeFilm(); });

  /* ---- Paper plane delivery (from the letter) --------------------------- */
  $('letter-plane').textContent = (C.plane && C.plane.button) || 'fold it into a paper plane';
  $('letter-plane').hidden = !(C.plane && C.plane.deliveries && C.plane.deliveries.length);
  $('letter-plane').addEventListener('click', () => {
    closeModal();
    A.sfx('open');
    window.PLANE.open(res => { if (res && res.complete) store.set('kamy.plane.done', true); });
  });

  /* ---- Her notebook (tap the two silhouettes) ---------------------------- */
  const NB = C.notebook || {};
  const KEY_NB = 'kamy.notebook';
  $('nb-title').textContent = NB.title || 'your notebook';
  $('nb-text').placeholder = NB.placeholder || '';
  $('nb-privacy').textContent = NB.privacy || '';
  const pageDate = iso => {
    const d = new Date(iso);
    return `${d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`.toLowerCase();
  };

  function renderPages() {
    const pages = store.get(KEY_NB, []);
    const box = $('nb-pages');
    box.replaceChildren();
    if (!pages.length) {
      const p = document.createElement('p');
      p.className = 'nb-body'; p.style.color = '#b9a58c'; p.textContent = NB.empty || '';
      box.appendChild(p);
    }
    pages.forEach(pg => {
      const wrap = document.createElement('div'); wrap.className = 'nb-page';
      const head = document.createElement('div'); head.className = 'nb-date';
      const when = document.createElement('span'); when.textContent = pageDate(pg.date);
      const del = document.createElement('button'); del.type = 'button'; del.className = 'nb-del'; del.textContent = 'tear out';
      del.addEventListener('click', () => {
        if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.textContent = 'sure?'; setTimeout(() => { del.classList.remove('confirm'); del.textContent = 'tear out'; }, 3000); return; }
        store.set(KEY_NB, store.get(KEY_NB, []).filter(x => x.id !== pg.id));
        A.sfx('close');
        renderPages();
      });
      head.append(when, del);
      const body = document.createElement('p'); body.className = 'nb-body'; body.textContent = pg.text;
      wrap.append(head, body);
      box.appendChild(wrap);
    });
    $('nb-download').hidden = !pages.length;
  }

  function openNotebook() {
    A.sfx('open');
    $('nb-msg').textContent = '';
    renderPages();
    openModal('notebook-modal');
  }

  $('nb-save').addEventListener('click', () => {
    const text = $('nb-text').value.trim();
    if (!text) { $('nb-msg').textContent = 'write a little something first'; return; }
    const pages = store.get(KEY_NB, []);
    pages.unshift({ id: Date.now(), date: new Date().toISOString(), text });
    store.set(KEY_NB, pages);
    const saved = store.get(KEY_NB, []).length === pages.length;
    $('nb-msg').textContent = saved ? 'saved.' : "couldn't save on this device (private browsing?)";
    if (saved) { $('nb-text').value = ''; A.sfx('grow'); }
    renderPages();
  });

  $('nb-download').addEventListener('click', () => {
    const pages = store.get(KEY_NB, []).slice().reverse();
    const txt = pages.map(p => `${pageDate(p.date)}\n\n${p.text}`).join('\n\n------\n\n');
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'my-notebook.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  /* ---- Firefly rescue finale: they gather above the two of you ---------- */
  const FONT = {
    A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'],
    D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
    G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'],
    J: ['001', '001', '001', '101', '010'], K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'],
    M: ['101', '111', '111', '101', '101'], N: ['110', '101', '101', '101', '101'], O: ['010', '101', '101', '101', '010'],
    P: ['110', '101', '110', '100', '100'], Q: ['010', '101', '101', '110', '011'], R: ['110', '101', '110', '101', '101'],
    S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'], U: ['101', '101', '101', '101', '111'],
    V: ['101', '101', '101', '101', '010'], W: ['101', '101', '111', '111', '101'], X: ['101', '101', '010', '101', '101'],
    Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'],
    0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['110', '001', '010', '100', '111'],
    3: ['110', '001', '010', '001', '110'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '110', '001', '110'],
    6: ['011', '100', '110', '101', '010'], 7: ['111', '001', '010', '010', '010'], 8: ['010', '101', '010', '101', '010'],
    9: ['010', '101', '011', '001', '110'], '!': ['010', '010', '010', '000', '010'], '?': ['110', '001', '010', '000', '010'],
    '+': ['000', '010', '111', '010', '000'], '.': ['000', '000', '000', '000', '010'], ' ': ['000', '000', '000', '000', '000']
  };
  const HEART5 = ['01010', '11111', '11111', '01110', '00100'];

  function finalePoints(text) {
    const t = String(text || '<3').toUpperCase();
    const glyphs = [];
    for (let i = 0; i < t.length; i++) {
      if ((t[i] === '<' && t[i + 1] === '3') || t[i] === '♥') { glyphs.push(HEART5); if (t[i] === '<') i++; continue; }
      glyphs.push(FONT[t[i]] || FONT[' ']);
    }
    const pts = [];
    let x = 0;
    glyphs.forEach(gl => {
      gl.forEach((row, y) => [...row].forEach((c, dx) => { if (c === '1') pts.push([(x + dx) * 2, y * 2]); }));
      x += gl[0].length + 1;
    });
    return { pts, w: (x - 1) * 2 - 1 };
  }

  function fireflyFinale() {
    const { pts, w: tw } = finalePoints(C.fireflies && C.fireflies.finale);
    const cx = mound.friendsX + 7;
    const left = clamp(Math.round(cx - tw / 2), 3, w - tw - 3), top = mound.friendsTop - 20;
    state.finale = {
      t0: state.t,
      flies: pts.map(([x, y]) => ({
        tx: left + x, ty: top + y,
        sx: Math.random() * w, sy: groundY + Math.random() * (h - groundY),
        vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, ph: Math.random() * 6
      }))
    };
    setTimeout(() => A.sfx('star'), 2600);
  }

  function drawFinale() {
    const f = state.finale;
    if (!f) return;
    const e = state.t - f.t0;
    if (e > 12) { state.finale = null; return; }
    for (const fl of f.flies) {
      let x, y;
      if (e < 2.6) { const k = ease(e / 2.6); x = fl.sx + (fl.tx - fl.sx) * k; y = fl.sy + (fl.ty - fl.sy) * k + Math.sin(e * 3 + fl.ph) * 3 * (1 - k); }
      else if (e < 9) { x = fl.tx + (Math.sin(state.t * 2 + fl.ph) > 0.95 ? 1 : 0); y = fl.ty; }
      else { const k = e - 9; x = fl.tx + fl.vx * k; y = fl.ty + fl.vy * k; if (Math.random() < k / 3) continue; }
      x = Math.round(x); y = Math.round(y);
      const bright = e < 9 || Math.sin(state.t * 8 + fl.ph) > 0;
      if (bright) { ctx.fillStyle = '#56702c'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
      ctx.fillStyle = Math.sin(state.t * 3 + fl.ph) > -0.5 ? '#f4ff9a' : '#c8d86a';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function openFireflies() {
    A.sfx('open');
    hideHint();
    window.FIREFLIES.open(res => { if (res && res.complete) { store.set('kamy.fireflies.done', true); setTimeout(fireflyFinale, 700); } });
  }

  /* ---- Tickle fight (tap the two of them) -------------------------------- */
  /* She tickles him, he laughs; he tickles her back, she gets mad; then
     they sit back down like nothing happened. */
  const TICKLE_LEN = 8;

  function startTickle() {
    if (state.tickle) return;
    state.moment.t0 = null; // interrupt any quiet moment, and give them a minute before the next
    state.moment.next = state.calm + 60;
    state.tickle = { t0: state.t };
    A.sfx('blip');
  }

  function tinyText(str, x, y, color) {
    ctx.fillStyle = color;
    let cx = Math.round(x);
    for (const ch of str.toUpperCase()) {
      const gl = FONT[ch] || FONT[' '];
      gl.forEach((row, yy) => [...row].forEach((c, xx) => { if (c === '1') ctx.fillRect(cx + xx, Math.round(y) + yy, 1, 1); }));
      cx += gl[0].length + 1;
    }
  }

  // a short arm from (x0,y0) to (x1,y1), with a moonlit pixel on it
  function arm(x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    ctx.fillStyle = '#080a20';
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1);
    ctx.fillStyle = '#4a4f9a';
    ctx.fillRect(Math.round(x1), Math.round(y1) - 1, 1, 1);
  }

  // He's on the left (short hair); she's on the right (hair down to her shoulders).
  function drawTickle() {
    const tk = state.tickle, e = state.t - tk.t0;
    const x0 = mound.friendsX, top = mound.friendsTop;
    const wig = Math.floor(e * 12) % 2;
    let hx = 0, hy = 0, sx = 0, sy = 0, who = null, angry = false, sweat = false; // h = him, s = her

    if (e < 0.5) sx = -1;                                  // she turns to him...
    else if (e < 2.9) {                                    // ...and tickles; he can't stop laughing
      sx = -1; who = 'her';
      hx = -(Math.floor(e * 10) % 2); hy = -(Math.floor(e * 7) % 2);
    } else if (e < 3.5) { /* he catches his breath */ }
    else if (e < 4.2) { hx = 1; who = 'him'; }             // his turn...
    else if (e < 6.2) {                                    // ...she is NOT amused: stands up, scoots away
      hx = 1; who = e < 5.2 ? 'him' : null; angry = true;
      sx = 2; sy = -2;
      sweat = e > 5.2;
    } else if (e < 6.9) { angry = true; sx = 1; sy = -1; sweat = true; } // sitting back down, still grumpy
    // then back to how they were

    ctx.drawImage(S.friends.left, x0 + hx, top + hy);
    ctx.drawImage(S.friends.right, x0 + 7 + sx, top + sy);

    if (who === 'her') arm(x0 + 8 + sx, top + sy + 5, x0 + 5 + hx, top + hy + 5 + wig);
    if (who === 'him') arm(x0 + 5 + hx, top + hy + 5, x0 + 8 + sx, top + sy + 5 + wig);

    // "HA HA" floating up while he laughs
    for (let k = 0; k < 5; k++) {
      const age = e - (0.7 + k * 0.42);
      if (age < 0 || age > 1.1) continue;
      if (age > 0.8 && Math.floor(age * 20) % 2) continue;
      tinyText('HA', x0 + 1 + hx + (k % 2 ? 3 : -5), top - 7 - age * 7, k % 2 ? '#ffe7a0' : '#ff9ec4');
    }
    if (angry && Math.floor(e * 5) % 2 === 0) ctx.drawImage(S.anger, x0 + 9 + sx, top + sy - 7);
    if (angry && e > 4.3 && e < 5.0) tinyText('!', x0 + 15 + sx, top + sy - 8, '#ff5c5c');
    if (sweat) { ctx.fillStyle = '#9fd4ff'; ctx.fillRect(x0 - 1 + hx, top + hy - 1 + Math.floor((e * 4) % 3), 1, 2); }

    if (e >= TICKLE_LEN - 1) {                             // they've made up
      state.tickle = null;
      state.heartT = 0;
    }
  }

  function bookPos() {
    const x = mound.friendsX - 9;
    return { x, y: hillY(x + 3) - 3 };
  }
  function drawBook() {
    const { x, y } = bookPos();
    if (state.hover && state.hover.kind === 'book') {
      ctx.fillStyle = '#fff3d6';
      ctx.fillRect(x - 1, y - 1, 8, 1); ctx.fillRect(x - 1, y + 3, 8, 1);
      ctx.fillRect(x - 1, y, 1, 3); ctx.fillRect(x + 6, y, 1, 3);
    }
    ctx.drawImage(S.book, x, y);
    // a little glint now and then, so she knows it's something
    if (Math.sin(state.t * 0.9) > 0.985) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 4, y - 2, 1, 1); }
  }

  /* ---- The afterparty snack: the two of them celebrate it --------------- */
  function celebrate(snack) {
    state.party = { t0: state.t, colors: (snack.colors || []).slice(0, 14), name: snack.name };
    setTimeout(() => toast(`they're celebrating "${snack.name}"!`, 5500), 600);
  }

  function drawSnackTower() {
    const p = state.party;
    if (!p) return;
    const x = mound.friendsX + 19, base = hillY(x) - 1;
    ctx.fillStyle = '#f5f0ff';
    ctx.fillRect(x - 2, base, 5, 1);
    p.colors.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x - 1 + (i % 2 ? 1 : 0), base - 1 - i, 2, 1); });
  }

  /* ---- Cassette: voice note -------------------------------------------- */
  const V = C.voiceNote;
  const tapeAudio = $('tape-audio'), tapeCv = $('tape-canvas'), tg = tapeCv.getContext('2d');
  const tapeState = { playing: false, angle: 0, raf: 0, last: 0, broken: false, deck: null };
  $('tape-title').textContent = V.title;
  $('tape-label').textContent = V.label;

  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function drawTape() {
    const g = tg, W2 = 64;
    g.clearRect(0, 0, W2, 40);
    const px = (x, y, w2, h2, c) => { g.fillStyle = c; g.fillRect(x, y, w2, h2); };
    // shell
    px(1, 0, 62, 40, '#1a1030'); px(0, 1, 64, 38, '#1a1030');
    px(1, 1, 62, 38, '#5b4f9a'); px(2, 2, 60, 1, '#7a6fc0');
    [[3, 3], [59, 3], [3, 35], [59, 35]].forEach(([x, y]) => { px(x, y, 2, 2, '#2a2150'); px(x, y, 1, 1, '#9c93d8'); });
    // label
    px(6, 3, 52, 15, '#fff4e2'); px(6, 14, 52, 2, '#ff9ec4'); px(6, 17, 52, 1, '#e8d6bd');
    // window + reels (the tape pack moves from left reel to right as it plays)
    px(14, 20, 36, 11, '#1a1030');
    const prog = tapeAudio.duration ? tapeAudio.currentTime / tapeAudio.duration : 0;
    reel(22, 25, 2 + Math.round((1 - prog) * 3));
    reel(42, 25, 2 + Math.round(prog * 3));
    px(26, 28, 12, 1, '#4a2f2a');
    // bottom head area
    px(16, 33, 32, 6, '#4a4088');
    [20, 30, 42].forEach(x => px(x, 35, 2, 2, '#1a1030'));

    function reel(cx, cy, pack) {
      g.fillStyle = '#4a2f2a';
      for (let y = -pack; y <= pack; y++) for (let x = -pack; x <= pack; x++) if (x * x + y * y <= pack * pack + 1) g.fillRect(cx + x, cy + y, 1, 1);
      g.fillStyle = '#f5f0ff';
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) g.fillRect(cx + x, cy + y, 1, 1);
      g.fillStyle = '#2a2150';
      for (let k = 0; k < 3; k++) {
        const a = tapeState.angle + k * Math.PI * 2 / 3;
        g.fillRect(cx + Math.round(Math.cos(a) * 1.6), cy + Math.round(Math.sin(a) * 1.6), 1, 1);
      }
      g.fillRect(cx, cy, 1, 1);
    }
  }

  function tapeLoop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - tapeState.last) / 1000));
    tapeState.last = now;
    if (tapeState.playing) tapeState.angle += dt * 5;
    drawTape();
    const d = tapeAudio.duration || 0;
    $('tape-bar').style.width = d ? (tapeAudio.currentTime / d) * 100 + '%' : '0';
    $('tape-time').textContent = fmtTime(tapeAudio.currentTime || 0) + (d && isFinite(d) ? ' / ' + fmtTime(d) : '');
    tapeState.raf = requestAnimationFrame(tapeLoop);
  }

  function openTape() {
    $('tape-msg').textContent = '';
    $('tape-play').textContent = 'play';
    tapeState.broken = false;
    if (!tapeAudio.getAttribute('src')) tapeAudio.src = V.src;
    openModal('tape-modal');
    tapeState.last = performance.now();
    cancelAnimationFrame(tapeState.raf);
    tapeState.raf = requestAnimationFrame(tapeLoop);
  }

  tapeAudio.addEventListener('error', () => {
    tapeState.broken = true;
    $('tape-msg').textContent = V.missing;
    stopTape(false);
  });

  function playTape() {
    const deck = tapeState.deck = A.tapeDeck(tapeAudio);
    A.setPaused(true); // the song steps aside for your voice
    tapeState.playing = true;
    $('tape-play').textContent = 'stop';
    if (deck) { deck.clunk(); deck.hiss(true); }
    // a beat of hiss before the voice, like a real tape
    setTimeout(() => {
      if (!tapeState.playing) return;
      if (tapeAudio.ended) tapeAudio.currentTime = 0;
      tapeAudio.play().catch(() => { tapeState.broken = true; $('tape-msg').textContent = V.missing; stopTape(false); });
    }, 600);
  }

  function stopTape(closing) {
    const was = tapeState.playing;
    tapeState.playing = false;
    tapeAudio.pause();
    const deck = tapeState.deck;
    if (deck) { deck.hiss(false); if (was) deck.clunk(); }
    $('tape-play').textContent = tapeAudio.ended ? 'play again' : 'play';
    if (was || closing) A.setPaused(false);
    if (closing) cancelAnimationFrame(tapeState.raf);
  }

  tapeAudio.addEventListener('ended', () => setTimeout(() => stopTape(false), 700));

  $('tape-play').addEventListener('click', () => {
    if (tapeState.broken) return;
    if (tapeState.playing) stopTape(false);
    else playTape();
  });

  /* ---- The friends' quiet moment ---------------------------------------- */
  /* If she lingers in the field, one of them points at a star and the
     other leans in. No prompt, no reward: just something to notice. */
  const MOMENT_AGAIN = 150; // seconds until it happens again

  function friendsFrame() {
    const m = state.moment;
    if (!m.t0) return S.friends.base;
    const e = state.t - m.t0;
    const pointing = e > 0.4 && e < 11;
    const leaning = e > 1.8 && e < 10;
    return pointing && leaning ? S.friends.both : pointing ? S.friends.point : S.friends.base;
  }

  // the star closest to where the arm points (up and to the right)
  function pointTarget() {
    const ox = mound.friendsX + 19, oy = mound.friendsTop;
    let best = null, bestScore = Infinity;
    for (const s of [...stars, ...dust]) {
      const dx = s.x - ox, dy = oy - s.y;
      if (dx <= 4 || dy <= 4) continue;
      const off = Math.abs(Math.atan2(dy, dx) - Math.PI / 4); // arm is at 45 degrees
      const score = off * 60 + Math.hypot(dx, dy) * 0.15;
      if (score < bestScore) { bestScore = score; best = s; }
    }
    return best;
  }

  function updateMoment(dt) {
    const calm = state.started && !state.modal && !state.dialog && !state.placing && !state.tickle && !window.GAME.isOpen && !window.MINI.isOpen && !document.hidden;
    if (calm) state.calm += dt;
    // confetti while they celebrate a victory snack
    const pa = state.party;
    if (pa && state.t - pa.t0 < 6 && Math.random() < dt * 4) {
      burst(mound.friendsX + 7 + (Math.random() - 0.5) * 12, mound.friendsTop - 6, ['#ff9ec4', '#ffe066', '#c3a6ff', '#9fd4ff'], 6, 18);
    }
    const m = state.moment;
    if (!m.t0) {
      if (calm && state.calm >= m.next) { m.t0 = state.t; m.target = pointTarget(); m.glints = 0; }
      return;
    }
    const e = state.t - m.t0;
    if (m.target && ((m.glints === 0 && e > 1.1) || (m.glints === 1 && e > 4.5))) {
      m.glints++;
      particles.push({ type: 'glint', x: m.target.x, y: m.target.y, age: 0, life: 0.9, vx: 0, vy: 0, g: 0 });
    }
    if (e > 12) { m.t0 = null; m.next = state.calm + MOMENT_AGAIN; }
  }

  /* ---- Wishes on a shooting star ---------------------------------------- */
  const KEY_WISHES = 'kamy.wishes';
  const WI = C.wish;
  // only the dates are kept: the words themselves are never stored
  let wishes = store.get(KEY_WISHES, []);
  $('wish-title').textContent = WI.title;
  $('wish-prompt').textContent = C.shootingStar;
  $('wish-text').placeholder = WI.placeholder;
  $('wish-share-label').textContent = WI.shareLabel;
  $('wish-seal').textContent = WI.button;

  function openWish() {
    $('wish-text').value = '';
    $('wish-share').checked = false;
    $('wish-msg').textContent = '';
    openModal('wish-modal');
  }

  $('wish-seal').addEventListener('click', () => {
    const text = $('wish-text').value.trim();
    if (!text) { $('wish-msg').textContent = 'write a little something first'; A.sfx('close'); return; }
    const share = $('wish-share').checked;
    $('wish-text').value = ''; // gone: sealed, not saved
    wishes.push({ date: new Date().toISOString(), shared: share });
    store.set(KEY_WISHES, wishes);
    closeModal();
    // a spark carries the wish up to its star
    state.sealing = { t0: state.t, from: { x: w / 2, y: h * 0.55 } };
    A.sfx('wish');
    if (share && CLOUD.enabled) {
      CLOUD.shareWish(text).then(() => toast(WI.sealed, 4000)).catch(() => toast(WI.shareFailed, 4500));
    } else {
      setTimeout(() => toast(WI.sealed, 4000), 1400);
    }
  });

  function drawWishStar() {
    if (!wishes.length && !state.sealing) return;
    const { x, y } = wishStar;
    // the spark flying up
    const sl = state.sealing;
    if (sl) {
      const p = clamp((state.t - sl.t0) / 1.4, 0, 1), e = ease(p);
      for (let k = 4; k >= 0; k--) {
        const q = Math.max(0, e - k * 0.04);
        const sx = sl.from.x + (x - sl.from.x) * q, sy = sl.from.y + (y - sl.from.y) * q - Math.sin(q * Math.PI) * 18;
        ctx.fillStyle = k === 0 ? '#ffffff' : k < 3 ? '#cfe3ff' : '#6f7fb8';
        ctx.fillRect(Math.round(sx), Math.round(sy), k === 0 ? 2 : 1, k === 0 ? 2 : 1);
      }
      if (p >= 1) {
        state.sealing = null;
        state.wishGlow = { t0: state.t, dur: 3.5 };
        burst(x, y, ['#ffffff', '#cfe3ff', '#ffe7a0'], 14, 22);
        A.sfx('star');
      }
      if (!wishes.length) return;
    }
    if (!wishes.length) return;
    const g = state.wishGlow;
    const glowing = g && state.t - g.t0 < g.dur;
    const pulse = Math.sin(state.t * (glowing ? 6 : 1.2)) > 0;
    if (glowing) {
      ctx.fillStyle = pulse ? '#4b4f93' : '#39357a';
      for (let a = 0; a < 16; a++) {
        const px = Math.round(x + Math.cos(a / 16 * Math.PI * 2) * 5), py = Math.round(y + Math.sin(a / 16 * Math.PI * 2) * 5);
        if ((px + py) % 2 === 0) ctx.fillRect(px, py, 1, 1);
      }
      ctx.fillStyle = '#cfe3ff';
      ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    } else {
      ctx.fillStyle = pulse ? '#8fa3d8' : '#6f7fb8';
      ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillStyle = '#e6efff';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function wishStarLine() {
    if (wishes.length > 1) return WI.starLineMany.replace('{n}', wishes.length);
    return WI.starLine.replace('{date}', fmtDate(wishes[0].date));
  }

  /* ---- A pineapple star after beating Sofian --------------------------- */
  function victoryStar() {
    state.shooting = {
      kind: 'shooting', victory: true,
      x: w * 0.08, y: 8 + groundY * 0.08,
      vx: 62, vy: 22, age: 0, life: 3.4
    };
    A.sfx('wish');
  }

  /* ---- What's behind the K --------------------------------------------- */
  const KS = C.kSecret || {};
  let kAudio = null;
  $('k-line').textContent = KS.line || '';
  if (KS.image) { $('k-image').src = KS.image; $('k-image').hidden = false; $('k-image').onerror = () => { $('k-image').hidden = true; }; }
  if (KS.audio) {
    $('k-play').hidden = false;
    kAudio = new Audio(KS.audio);
    kAudio.addEventListener('ended', () => { $('k-play').textContent = 'play again'; A.setPaused(false); });
    kAudio.addEventListener('error', () => { $('k-play').hidden = true; });
    $('k-play').addEventListener('click', () => {
      if (kAudio.paused) { A.setPaused(true); kAudio.currentTime = kAudio.ended ? 0 : kAudio.currentTime; kAudio.play().catch(() => {}); $('k-play').textContent = 'pause'; }
      else { kAudio.pause(); A.setPaused(false); $('k-play').textContent = 'play'; }
    });
  }
  const kReady = () => { const c = state.constellation; return !!(c && !c.reverse && kAge(c) >= K_TIME); };

  function openK() {
    A.sfx('star');
    burst(kPos().x + 3, kPos().y + 4, ['#fff0c4', '#8f86d9', '#ffffff'], 16, 26);
    openModal('k-modal');
  }

  /* ---- Replay the constellation (keeps her stars read) ----------------- */
  const replayBtn = $('replay-stars');
  replayBtn.addEventListener('click', () => {
    if (!kReady()) return;
    disintegrateInitial();
    state.constellation = { t0: state.t, reverse: true };
    A.sfx('close');
    setTimeout(() => {
      if (state.read.size !== stars.length) return; // she reset in the meantime
      state.constellation = null;
      formConstellation(false);
    }, FORM_TIME * 1000 + 400);
  });

  /* ---- The title heart's inside joke ----------------------------------- */
  const TS = C.titleSecret || {};
  let heartTaps = 0;
  $('title-heart').addEventListener('animationend', e => { if (e.animationName === 'squish') e.target.classList.remove('squish'); });
  $('title-heart-btn').addEventListener('click', e => {
    e.stopPropagation(); // tapping the heart doesn't start the site
    heartTaps++;
    const img = $('title-heart');
    img.classList.remove('squish'); void img.offsetWidth; img.classList.add('squish');
    if (heartTaps < (TS.taps || 5) || (!real(TS.line) && !TS.sound)) { A.sfx('blip'); return; }
    if (heartTaps === (TS.taps || 5)) {
      $('title-secret').textContent = real(TS.line);
      $('title-secret').classList.add('show');
      if (TS.sound) new Audio(TS.sound).play().catch(() => A.sfx('wish'));
      else A.sfx('wish');
    }
  });

  /* ---- The secret room: three hidden symbols and a tiny door ------------ */
  /* Symbols hide on the cassette (1), in the letter (2) and on the snack
     attack victory screen (3). Found symbols show their number. Entering
     all three, in order, at the tiny door in the hill opens the room. */
  const SR = C.secretRoom || {};
  const KEY_SYMS = 'kamy.symbols', KEY_ROOM = 'kamy.room';
  const SECRET_ORDER = ['moon', 'flower', 'crown'];
  const KEYPAD = ['star', 'moon', 'heart', 'leaf', 'crown', 'drop', 'flower', 'key', 'note'];
  const symImg = id => S.symbols[id].toDataURL();

  function markSymbol(id) {
    const btn = $('sym-' + id);
    if (!btn) return;
    const found = store.get(KEY_SYMS, []).includes(id);
    btn.classList.toggle('found', found);
    btn.querySelector('b').textContent = found ? String(SECRET_ORDER.indexOf(id) + 1) : '';
  }

  window.SECRET = {
    img: symImg,
    has: id => store.get(KEY_SYMS, []).includes(id),
    found(id) {
      const list = store.get(KEY_SYMS, []);
      const n = SECRET_ORDER.indexOf(id) + 1;
      if (!list.includes(id)) {
        list.push(id);
        store.set(KEY_SYMS, list);
        A.sfx('wish');
        toast(`a secret symbol! it has a little ${n} on it. (${list.length}/3 found)`, 4500);
      } else {
        A.sfx('blip');
        toast(`symbol ${n}. (${list.length}/3 found)`, 2500);
      }
      markSymbol(id);
    }
  };
  ['moon', 'flower'].forEach(id => {
    const b = $('sym-' + id);
    b.querySelector('img').src = symImg(id);
    b.addEventListener('click', e => { e.stopPropagation(); window.SECRET.found(id); });
    markSymbol(id);
  });

  // the door in the hill
  const doorPos = () => { const x = mound.peakX + 14; return { x, y: groundY - 9 }; };
  function drawDoor() {
    const { x, y } = doorPos();
    if (state.hover && state.hover.kind === 'door') { ctx.fillStyle = '#ffd87a'; ctx.fillRect(x - 1, y - 1, 7, 9); }
    ctx.drawImage(S.door, x, y);
    if (Math.sin(state.t * 0.7) > 0.97) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 3, y + 3, 1, 1); }
  }

  let doorEntry = [];
  function renderDoor() {
    const slots = $('door-slots');
    slots.replaceChildren(...[0, 1, 2].map(k => {
      const d = document.createElement('div'); d.className = 'door-slot';
      if (doorEntry[k]) { const i = new Image(); i.src = symImg(doorEntry[k]); d.appendChild(i); }
      return d;
    }));
  }
  function openDoor() {
    if (store.get(KEY_ROOM, false)) return openRoom();
    A.sfx('open');
    doorEntry = [];
    $('door-title').textContent = SR.doorLabel || 'a tiny door';
    $('door-text').textContent = `${SR.doorText || ''} (${store.get(KEY_SYMS, []).length}/3 found)`;
    $('door-msg').textContent = '';
    $('door-keys').replaceChildren(...KEYPAD.map(id => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'door-key'; b.setAttribute('aria-label', id);
      const i = new Image(); i.src = symImg(id); b.appendChild(i);
      b.addEventListener('click', () => pressKey(id));
      return b;
    }));
    renderDoor();
    openModal('door-modal');
  }
  function pressKey(id) {
    if (doorEntry.length >= 3) return;
    doorEntry.push(id);
    A.sfx('blip');
    renderDoor();
    if (doorEntry.length < 3) return;
    if (doorEntry.every((s, k) => s === SECRET_ORDER[k])) {
      store.set(KEY_ROOM, true);
      A.sfx('win');
      setTimeout(() => { closeModal(); openRoom(); }, 600);
    } else {
      $('door-msg').textContent = 'the door stays shut. try again?';
      A.sfx('close');
      const box = document.querySelector('.doorbox');
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      setTimeout(() => { doorEntry = []; renderDoor(); }, 700);
    }
  }

  // the room itself: a warm little pixel room with a fireplace
  let roomRaf = 0, roomAudio = null;
  $('room-title').textContent = SR.title || 'our secret room';
  $('room-note').textContent = real(SR.note);
  if (SR.image) { $('room-image').src = SR.image; $('room-image').hidden = false; $('room-image').onerror = () => { $('room-image').hidden = true; }; }
  if (SR.audio) {
    roomAudio = new Audio(SR.audio);
    $('room-play').hidden = false;
    roomAudio.addEventListener('error', () => { $('room-play').hidden = true; });
    roomAudio.addEventListener('ended', () => { $('room-play').textContent = 'play again'; A.setPaused(false); });
    $('room-play').addEventListener('click', () => {
      if (roomAudio.paused) { A.setPaused(true); roomAudio.play().catch(() => {}); $('room-play').textContent = 'pause'; }
      else { roomAudio.pause(); A.setPaused(false); $('room-play').textContent = 'play'; }
    });
  }
  function drawRoom(t) {
    const g = $('room-canvas').getContext('2d'), R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    R(0, 0, 120, 48, '#4a2f3a');
    for (let x = 0; x < 120; x += 8) R(x, 0, 4, 48, '#52343f');
    R(0, 48, 120, 16, '#3a2420'); for (let x = 0; x < 120; x += 15) R(x, 48, 1, 16, '#2e1c19');
    // fireplace
    R(44, 22, 32, 26, '#6e4a3a'); R(42, 20, 36, 3, '#8a5f4a'); R(50, 30, 20, 18, '#1a100e');
    for (let k = 0; k < 9; k++) {
      const hgt = 4 + Math.round((Math.sin(t * 9 + k * 1.7) + 1) * 3) + (k % 3 === 1 ? 3 : 0);
      R(51 + k * 2, 47 - hgt, 2, hgt, k % 2 ? '#ff9a3c' : '#ffd87a');
    }
    R(50, 46, 20, 2, '#4a2a20');
    // a framed heart, two cushions, candles, a rug
    R(14, 10, 16, 14, '#ffd87a'); R(16, 12, 12, 10, '#2a1f2a');
    [[19, 15], [23, 15]].forEach(([x, y]) => R(x, y, 2, 1, '#ff5c8a')); R(18, 16, 8, 2, '#ff5c8a'); R(19, 18, 6, 1, '#ff5c8a'); R(21, 19, 2, 1, '#ff5c8a');
    R(88, 42, 14, 7, '#ff9ec4'); R(100, 43, 13, 6, '#c3a6ff');
    [[92, 14], [100, 12], [108, 15]].forEach(([x, y], k) => { R(x, y, 2, 6, '#fff4e2'); R(x, y - 2 - (Math.floor(t * 6 + k) % 2), 2, 2, '#ffd87a'); });
    for (let y = -3; y <= 3; y++) { const hw = Math.round(Math.sqrt(1 - (y / 3.5) ** 2) * 26); R(60 - hw, 57 + y, hw * 2, 1, y % 2 ? '#8e3a55' : '#a8506c'); }
  }
  function openRoom() {
    A.sfx('open');
    openModal('room-modal');
    const loop = now => { drawRoom(now / 1000); roomRaf = requestAnimationFrame(loop); };
    cancelAnimationFrame(roomRaf);
    roomRaf = requestAnimationFrame(loop);
  }

  /* ---- The little heart above them opens the blanket fort --------------- */
  const heartPos = () => ({ x: mound.peakX - 1, y: mound.friendsTop - 7 + Math.round(Math.sin(state.t * 1.5)) });

  /* ---- The music-note stars open the star piano ------------------------- */
  const NOTE_ROWS = ['..ooo', '..o.o', '..o.o', '..o..', 'ooo..', 'ooo..', '.o...'];
  function drawNoteStars() {
    const { x, y } = noteStar, hov = state.hover && state.hover.kind === 'piano';
    NOTE_ROWS.forEach((row, yy) => [...row].forEach((c, xx) => {
      if (c !== 'o') return;
      const tw = Math.sin(state.t * 2.2 + xx * 1.3 + yy * 0.7);
      ctx.fillStyle = hov ? '#e6efff' : tw > 0.5 ? '#c8d8ff' : tw > -0.3 ? '#8fa3e0' : '#5a6aa8';
      ctx.fillRect(x - 2 + xx, y - 3 + yy, 1, 1);
    }));
  }

  /* ---- The field guide ("?" in the bottom-left corner) ------------------ */
  /* Where everything is and how it works, with her progress. Where the
     secret symbols are is hidden behind a spoiler button. */
  const flag = k => { try { return localStorage.getItem(k) === '1' || localStorage.getItem(k) === 'true'; } catch (e) { return false; } };
  function guideSections() {
    const photos = C.photos.length, dev = C.photos.filter(p => !undeveloped(p)).length;
    const syms = store.get(KEY_SYMS, []).length;
    const tick = (done, text) => ({ done, text });
    return [
      ['the sky', [
        ['the glowing stars', `each one holds a reason. tap them all. the lilac ones are locked with a question only you know the answer to. once you've found every star, they make a heart with a K in the middle, so tap the K too. "replay" and "reset" at the top let you watch it again or start over.`, tick(state.read.size >= stars.length, `${state.read.size}/${stars.length}`)],
        ['shooting stars', 'every so often one streaks across the sky. catch it to make a wish and seal it in a star of its own.'],
        ['the moon', 'tap it for "things i never tell you". stay until the end.'],
        ['the music-note stars', 'the little note shape made of stars near the top opens the star piano. there\'s a tune waiting there for you.'],
        ['the clouds', 'tap a drifting cloud for the shadow theater: slide clouds across the moon to make pictures.', tick(flag('kamy.shadows.done'), flag('kamy.shadows.done') ? 'done' : '')],
        ['the little spaceship', 'snack attack! shoot the foods you hate, catch the ones you love, and beat the boss. winning unlocks an afterparty.', tick(flag('kamy.game.won'), flag('kamy.game.won') ? 'won' : '')]
      ]],
      ['the field', [
        ['the flowers', 'a new one grows every day you visit. some days are special.', tick(false, `${state.visible} so far`)],
        ['the headphones', 'our playlist.'],
        ['the cassette', 'a tape I recorded for you.'],
        ['the envelope', 'a letter. at the bottom, fold it into a paper plane and fly three little notes to three places.', tick(flag('kamy.plane.done'), flag('kamy.plane.done') ? 'done' : '')],
        ['the camera', 'our photos. they start blurry: tap one and rub it gently to develop it. "reset photos" makes them blurry again.', tick(dev >= photos, `${dev}/${photos}`)],
        ['the seed packet', 'plant your own flower with a note tucked inside. it stays in the field for good.'],
        ['the brightest firefly', 'a lost one. tap it and draw glowing paths to lead the fireflies home.', tick(flag('kamy.fireflies.done'), flag('kamy.fireflies.done') ? 'done' : '')],
        ['the airpod in the grass', `you lost another one. tap it: all ${window.AIRPODS.TOTAL} of the ones you've lost are hiding in three messy piles.`, tick(flag('kamy.airpods.done'), flag('kamy.airpods.done') ? 'all found' : '')]
      ]],
      ['the hill', [
        ['the two of us', 'tap them and see what happens. and if you stay in the field a while, watch them.'],
        ['the little heart above them', 'our blanket fort. decorate it however you like; it stays that way.'],
        ['the pink book', 'your notebook. only you can read it.'],
        ['the tiny door', 'a secret room. three symbols are hidden around the site; find them, then enter them here in order.', tick(flag('kamy.room'), flag('kamy.room') ? 'open' : `${syms}/3 symbols`)]
      ]],
      ['little secrets', [
        ['the title heart', 'on the first screen, tap the heart a few times.'],
        ['in every game', 'the "?" in the top-left corner explains how to play.']
      ]]
    ];
  }

  const SPOILERS = [
    'symbol 1: on the cassette. open the tape and look at the bottom-right corner of the cassette.',
    'symbol 2: in the letter. scroll to the very bottom, under the signature.',
    'symbol 3: on the snack attack victory screen, right under the note you get for beating the boss.',
    'then tap the tiny door in the side of the hill and enter them in order: 1, 2, 3.'
  ];

  function openGuide() {
    A.sfx('open');
    const body = $('guide-body');
    body.replaceChildren();
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    for (const [title, items] of guideSections()) {
      body.appendChild(mk('h3', '', title));
      for (const [name, how, prog] of items) {
        const row = mk('div', 'guide-item');
        row.append(mk('b', '', name), prog && prog.text ? mk('span', prog.done ? 'done' : 'todo', prog.done ? '✓ ' + prog.text : prog.text) : mk('span'));
        row.appendChild(mk('p', '', how));
        body.appendChild(row);
      }
    }
    // where the symbols are, only if she asks
    const sp = mk('div'); sp.id = 'guide-spoilers';
    const btn = mk('button', 'pixel-btn', 'show me where the symbols are');
    btn.type = 'button';
    btn.addEventListener('click', () => { btn.remove(); SPOILERS.forEach(t => sp.appendChild(mk('p', 'spoiler', t))); A.sfx('blip'); });
    sp.appendChild(btn);
    body.appendChild(sp);
    openModal('guide-modal');
    body.parentElement.scrollTop = 0;
  }
  $('guide-btn').addEventListener('click', openGuide);

  /* ---- Planting her own flower ----------------------------------------- */
  const P = C.planting;
  const pick = { head: 1, color: 0 };
  $('plant-title').textContent = P.title;
  $('plant-note-label').textContent = P.notePrompt;
  $('plant-go').textContent = P.button;
  $('place-hint').textContent = P.placeHint;

  function pixelated(canvasEl, zoom) {
    canvasEl.style.width = canvasEl.width * zoom + 'px';
    return canvasEl;
  }

  function renderPicker() {
    const heads = $('pick-head'), cols = $('pick-color');
    heads.innerHTML = ''; cols.innerHTML = '';
    for (let i = 0; i < S.HEAD_COUNT; i++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pick';
      b.setAttribute('aria-label', `flower ${i + 1}`);
      b.setAttribute('aria-pressed', String(i === pick.head));
      b.appendChild(pixelated(S.flower({ head: i, color: pick.color, stemH: 2, leafSide: 1, leafY: 1 }).frames[0], 3));
      b.addEventListener('click', () => { pick.head = i; A.sfx('blip'); renderPicker(); });
      heads.appendChild(b);
    }
    S.COLORS.forEach((col, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pick swatch';
      b.style.background = col.p;
      b.setAttribute('aria-label', `color ${i + 1}`);
      b.setAttribute('aria-pressed', String(i === pick.color));
      b.addEventListener('click', () => { pick.color = i; A.sfx('blip'); renderPicker(); });
      cols.appendChild(b);
    });
    const big = S.flower({ head: pick.head, color: pick.color, stemH: 6, leafSide: 1, leafY: 2 }).frames[0];
    $('plant-preview').replaceChildren(pixelated(big, 7));
  }

  function openPlanter() {
    renderPicker();
    $('plant-msg').textContent = '';
    openModal('plant-modal');
  }

  $('plant-note').addEventListener('input', e => {
    $('plant-count').textContent = `${e.target.value.length}/280`;
    $('plant-msg').textContent = '';
  });

  $('plant-go').addEventListener('click', () => {
    const note = $('plant-note').value.trim();
    if (!note) { $('plant-msg').textContent = P.empty; A.sfx('close'); return; }
    closeModal();
    const rec = { head: pick.head, color: pick.color, note, fx: 0.5, fy: 0.5 };
    state.placing = { rec, ghost: makePlanted(rec), at: null };
    hideHint();
    $('place-bar').classList.remove('hidden');
  });

  function endPlacing() {
    state.placing = null;
    canvas.style.cursor = 'default';
    $('place-bar').classList.add('hidden');
  }
  $('place-cancel').addEventListener('click', () => { A.sfx('close'); endPlacing(); });

  function validSpot(p) {
    const { top, span } = field();
    return p.x >= 3 && p.x <= w - 3 && p.y >= top && p.y <= top + span && !onItem(p.x, p.y, 12);
  }

  function plantAt(p) {
    if (!validSpot(p)) { toast('try a spot on the grass', 2000); return; }
    const { top, span } = field();
    const rec = {
      ...state.placing.rec,
      fx: clamp((Math.round(p.x) - 3) / (w - 6), 0, 1),
      fy: clamp((Math.round(p.y) - top) / span, 0, 1),
      created_at: new Date().toISOString()
    };
    endPlacing();
    $('plant-note').value = '';
    $('plant-count').textContent = '0/280';

    const f = makePlanted(rec);
    planted.push(f);
    layoutFlowers();
    state.growing = { f, t0: state.t };
    A.sfx('open');

    const saveHere = () => store.set(KEY_PLANTED, [...store.get(KEY_PLANTED, []), rec]);
    if (!CLOUD.enabled) return saveHere();
    CLOUD.plant(rec).catch(err => {
      if (/planted_limit/.test(err.message)) {
        planted.splice(planted.indexOf(f), 1);
        layoutFlowers();
        if (state.growing && state.growing.f === f) state.growing = null;
        toast(P.limit, 4500);
      } else {
        saveHere(); // offline: keep it on this device instead
      }
    });
  }

  document.addEventListener('keydown', e => {
    if (!state.started) {
      if ((e.key === 'Enter' || e.key === ' ') && !needsGate()) { e.preventDefault(); start(); }
      return;
    }
    if (state.dialog && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { e.preventDefault(); return advanceDialog(); }
    if (e.key === 'Escape' && state.placing) return endPlacing();
    if (e.key === 'Escape' && state.modal) return closeModal();
    if (state.modal && state.modal.id === 'lightbox') {
      if (e.key === 'ArrowLeft') openLightbox(lbIndex - 1);
      if (e.key === 'ArrowRight') openLightbox(lbIndex + 1);
    }
  });

  /* ---- HUD, hint, toast ------------------------------------------------ */
  const icon = sprite => sprite.toDataURL();
  $('hud-flower').src = icon(S.make(['.p.p.', 'ppcpp', '.ppp.', '..g..', '.gg..'], { ...S.COLORS[0], g: '#46945c' }));
  $('hud-star').src = icon(S.star[0]);
  $('title-heart').src = icon(S.heart);

  function updateHud() {
    $('flower-count').textContent = state.visible;
    $('star-count').textContent = `${state.read.size}/${stars.length}`;
    $('reset-stars').hidden = state.read.size === 0;
  }

  let toastTimer;
  function toast(msg, ms = 3800) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  let hintTimer;
  function showHint() {
    if (state.read.size > 0) return;
    const el = $('hint');
    el.textContent = matchMedia('(hover: none)').matches ? 'tap the glowing stars' : 'click the glowing stars';
    el.classList.remove('hidden');
    hintTimer = setTimeout(hideHint, 20000);
  }
  function hideHint() { clearTimeout(hintTimer); $('hint').classList.add('hidden'); }

  const muteBtn = $('mute');
  function renderMute() {
    $('mute-icon').src = icon(A.muted ? S.speakerOff : S.speakerOn);
    muteBtn.setAttribute('aria-label', A.muted ? 'Unmute music' : 'Mute music');
  }
  muteBtn.addEventListener('click', () => { A.setMuted(!A.muted); renderMute(); });
  renderMute();

  // pause the music when she switches tabs (e.g. after clicking the moon)
  document.addEventListener('visibilitychange', () => {
    if (!state.started) return;
    const onPlaylist = state.modal && state.modal.id === 'playlist-modal' && document.querySelector('#playlist-body iframe');
    A.setPaused(document.hidden || !!onPlaylist || tapeState.playing);
  });

  /* ---- Title screen ---------------------------------------------------- */
  $('title-text').textContent = C.title;
  $('title-sub').textContent = C.subtitle;
  document.title = C.title;

  /* The passcode at the start. Only a hash of it is in the site's files
     (made with scripts/lock.mjs); once she's in, this device remembers. */
  const titleScreen = $('title-screen');
  const gate = $('gate');
  const KEY_GATE = 'kamy.gate';
  const needsGate = () => !!(C.gate && store.get(KEY_GATE, '') !== C.gate.hash);
  if (needsGate()) {
    gate.classList.remove('hidden');
    $('gate-q').textContent = C.gate.question;
    $('start').textContent = 'enter';
    gate.addEventListener('submit', e => { e.preventDefault(); tryGate(); });
  }
  async function tryGate() {
    const h = await sha256(norm($('gate-input').value));
    if (h === C.gate.hash) { store.set(KEY_GATE, h); return start(); }
    $('gate-msg').textContent = 'hmm, not quite. try again?';
    A.sfx('close');
    gate.classList.remove('shake'); void gate.offsetWidth; gate.classList.add('shake');
  }
  titleScreen.addEventListener('click', e => {
    if (needsGate()) { if (e.target.id === 'start') tryGate(); return; }
    start();
  });

  function start() {
    if (state.started) return;
    state.started = true;
    // her own tune from the star piano plays first, then the music fades in
    const tune = window.PIANO && window.PIANO.savedTune();
    const tuneLen = tune && tune.length ? A.playNotes(tune, 150) : 0;
    A.start(C.song, tuneLen ? tuneLen + 0.4 : 0);
    titleScreen.classList.add('gone');
    $('hud').classList.remove('hidden');
    muteBtn.classList.remove('hidden');
    $('guide-btn').classList.remove('hidden');
    updateHud();
    setTimeout(() => garden.ready.then(() => {
      if (garden.grew) growNewFlower();
      else if (!garden.preview && !everyVisit && C.flowers.alreadyToday) toast(C.flowers.alreadyToday, 4500);
    }), 1400);
    setTimeout(showHint, garden.grew ? 6000 : 2500);
    // welcome back: if she found every star before, they gather into the heart again
    if (stars.length === C.reasons.length && state.read.size === stars.length) setTimeout(() => formConstellation(false), 900);
    // a wish she sealed on an earlier visit glows briefly to welcome her back
    if (wishes.length) setTimeout(() => { state.wishGlow = { t0: state.t, dur: 4.5 }; }, 2600);
  }

  // used by scripts/shoot.mjs to find things on the canvas
  window.__debug = {
    star0: () => stars[0],
    star: i => stars[i],
    item: id => items.find(i => i.id === id),
    field: () => ({ w, h, groundY }),
    planted: () => planted.map(f => ({ x: f.x, y: f.y, ay: f.ay, note: f.note })),
    kCenter: () => { const k = kPos(); return { x: k.x + 3, y: k.y + 4, ready: kReady() }; },
    wishStar: () => ({ ...wishStar, wishes: wishes.length }),
    spawnShooting: () => { state.shooting = { kind: 'shooting', x: w * 0.5, y: 20, vx: 8, vy: 3, age: 0, life: 30 }; return state.shooting; },
    victory: () => victoryStar(),
    moment: at => { state.calm = at; state.moment.next = 0; },
    friends: () => ({ x: mound.friendsX, top: mound.friendsTop, peakX: mound.peakX }),
    firefly: () => ({ x: fireflies[0].x, y: fireflies[0].y }),
    airpod: () => airpod,
    finale: () => fireflyFinale(),
    book: () => bookPos(),
    heart: () => heartPos(),
    door: () => doorPos(),
    note: () => noteStar,
    cloud: () => clouds[0] && { x: clouds[0].x + cloudSprite.width / 2, y: clouds[0].y + 4 },
    tickling: () => !!state.tickle,
    celebrate: s => celebrate(s),
    visible: () => state.visible
  };

  /* ---- Loop ------------------------------------------------------------ */
  window.addEventListener('resize', () => { resize(); setHover(null); });
  resize();
  loadPlanted();
  // ?stars=all previews the finished constellation without saving anything
  if (new URLSearchParams(location.search).get('stars') === 'all') stars.forEach(s => state.read.add(s.i));
  // (if she's already found them all, they gather into the heart after she presses start)
  updateHud();

  let last = performance.now();
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05); // rAF's first timestamp can predate `last`
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
