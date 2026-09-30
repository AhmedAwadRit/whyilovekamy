/* Paper plane delivery: fly three notes to three meaningful places.
   Hold to rise, let go to glide. Gentle, with unlimited retries. */
window.PLANE = (() => {
  'use strict';
  const C = window.KAMY, S = window.SPRITES;
  const P = C.plane || {};
  const W = 240, H = 150, GROUND = H - 12, SPEED = 34, LEG = 700, PLANE_X = 48;
  const deliveries = (P.deliveries || []).slice(0, 3);

  const planeImg = S.make([
    'ww..........',
    'wwww........',
    'wwwwww......',
    '.wwwwwwwww..',
    '..gggwwwwwww',
    '....gggg....'
  ], { w: '#f5f0ff', g: '#b9b3d9' });

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // storm clouds for one leg: columns with a gap to fly through (wider early on)
  function legClouds(leg) {
    const r = rng(leg * 101 + 7), gap = [70, 60, 52][leg] || 52, list = [];
    for (let x = 190; x < LEG - 40; x += 105 + r() * 45) {
      const top = 14 + r() * (GROUND - gap - 24);
      const kind = r();
      list.push({ x, w: 24 + r() * 10, top: kind < 0.25 ? -1 : top, bottom: kind > 0.8 ? GROUND + 1 : top + gap });
    }
    return list;
  }

  const stars = Array.from({ length: 60 }, (_, i) => { const r = rng(i + 3); return { x: r() * W, y: r() * (GROUND - 30), d: 0.1 + r() * 0.3 }; });

  let api = null, s = null;

  function start(a) {
    api = a;
    s = null;
    api.show([
      api.el('h3', 'game-title', P.title || 'paper plane delivery'),
      api.el('p', 'line', P.intro || ''),
      api.button('start', () => beginLeg(0))
    ]);
  }

  function beginLeg(leg) {
    api.hideScreen();
    s = { leg, dist: 0, y: H / 2 - 10, vy: 0, hold: false, phase: 'fly', t: 0, clouds: legClouds(leg), crashT: 0, spin: 0, land: null };
    hud();
  }

  function hud() {
    if (!s) return api.setHud('');
    const pct = Math.min(100, Math.round(s.dist / LEG * 100));
    api.setHud(`delivery ${s.leg + 1}/${deliveries.length} · ${pct}%`);
  }

  function crash() {
    if (s.phase !== 'fly') return;
    s.phase = 'crash'; s.crashT = 0;
    api.sfx('sad');
    api.setHud('whoops! trying that one again...');
  }

  function update(dt) {
    if (!s) return;
    s.t += dt;
    const d = deliveries[s.leg];
    if (s.phase === 'fly') {
      s.dist += SPEED * dt;
      s.vy += (s.hold ? -95 : 48) * dt;
      s.vy = Math.max(-42, Math.min(38, s.vy));
      s.y += s.vy * dt;
      if (s.y < 6) { s.y = 6; s.vy = 0; }
      if (s.y > GROUND - 6) { s.y = GROUND - 6; s.vy = 0; } // skims the grass, no harm
      const wx = s.dist + PLANE_X;
      for (const c of s.clouds) {
        if (Math.abs(c.x - wx) > c.w * 0.45 + 3) continue; // matches the drawn puffs
        if (s.y - 2 < c.top - 2 || s.y + 3 > c.bottom + 2) { crash(); break; }
      }
      if (Math.floor(s.t * 4) !== Math.floor((s.t - dt) * 4)) hud();
      if (s.dist >= LEG) { s.phase = 'arrive'; hud(); }
    } else if (s.phase === 'crash') {
      s.crashT += dt; s.spin += dt * 12; s.y += 40 * dt;
      if (s.crashT > 1.3) beginLeg(s.leg);
    } else if (s.phase === 'arrive') {
      // keep scrolling until the destination is on screen, then glide in to land
      const target = LEG + 20; // stops with the place at x = 170
      if (s.dist < target) s.dist = Math.min(target, s.dist + SPEED * 1.3 * dt);
      else if (!s.land) s.land = { t0: s.t, y0: s.y };
      if (s.land) {
        const k = Math.min(1, (s.t - s.land.t0) / 1.6);
        s.landX = PLANE_X + (placeScreenX() - 16 - PLANE_X) * k;
        s.y = s.land.y0 + (GROUND - 5 - s.land.y0) * k;
        if (k >= 1) { s.phase = 'note'; api.sfx('pickup'); showNote(d); }
      }
    }
  }

  const placeScreenX = () => LEG + 190 - s.dist;

  function showNote(d) {
    const last = s.leg >= deliveries.length - 1;
    const note = api.el('p', 'win-note', '');
    api.showSoft([
      api.el('h3', 'game-title', `delivered: ${d.name}`),
      note,
      last ? api.button('back to the field', () => api.close({ complete: true }))
           : api.button('next delivery', () => beginLeg(s.leg + 1))
    ]);
    api.typeInto(note, d.note || '');
    if (last) api.setHud(P.doneLine || '');
  }

  /* ---- Drawing ---------------------------------------------------------- */
  function puff(g, px, py, pr, col) {
    g.fillStyle = col;
    for (let y = -pr; y <= pr; y++) {
      const hw = Math.floor(Math.sqrt(pr * pr - y * y));
      g.fillRect(Math.round(px - hw), Math.round(py + y), hw * 2 + 1, 1);
    }
  }

  // a column of puffy storm cloud filling y0..y1, with a moonlit rim on the
  // side facing the gap (it never pokes past the edge she has to fly by)
  function drawCloud(g, cx, y0, y1, w, gapBelow, seed) {
    if (y1 <= y0) return;
    const pr = Math.max(6, Math.round(w * 0.45));
    const dir = gapBelow ? -1 : 1;                 // from the gap edge, outward
    const edgeY = gapBelow ? y1 - pr : y0 + pr;    // the puff nearest the gap
    const farY = gapBelow ? y0 : y1;
    for (let k = 1, y = edgeY + dir * pr * 0.9; dir < 0 ? y > farY - pr : y < farY + pr; k++, y += dir * pr * 0.9) {
      const jit = ((k * 37 + seed) % 5) - 2;
      puff(g, cx + jit, y, Math.round(pr * (0.9 + 0.12 * ((k + seed) % 2))), '#26244f');
    }
    puff(g, cx, edgeY, pr, '#3d3b78');
    puff(g, cx, edgeY + dir, pr, '#26244f');
  }

  function drawPlace(g, kind, x, gy) {
    const R = (x0, y0, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x0), Math.round(y0), w, h); };
    const tw = Math.floor(s ? s.t * 3 : 0) % 2;
    if (kind === 'cafe') {
      R(x - 17, gy - 24, 34, 4, '#4a2a24');
      R(x - 15, gy - 20, 30, 20, '#7a4a3a');
      for (let i = 0; i < 15; i++) R(x - 15 + i * 2, gy - 14, 2, 3, i % 2 ? '#fff4e2' : '#ff9ec4');
      R(x - 13, gy - 9, 9, 6, '#1a1030'); R(x - 12, gy - 8, 7, 4, '#ffd87a');
      R(x + 3, gy - 10, 7, 10, '#3a2420'); R(x + 8, gy - 5, 1, 1, '#ffd87a');
      R(x - 3, gy - 31, 5, 5, '#fff4e2'); R(x + 2, gy - 30, 2, 3, '#fff4e2'); R(x - 2, gy - 29, 3, 2, '#7a4a3a');
      R(x - 2 + tw, gy - 34, 1, 2, '#b9b3d9'); R(x + 1 - tw, gy - 35, 1, 2, '#b9b3d9');
    } else if (kind === 'campus') {
      R(x - 20, gy - 3, 40, 3, '#8a86b0');
      R(x - 17, gy - 19, 34, 16, '#3a3470');
      for (let i = 0; i < 5; i++) R(x - 15 + i * 7, gy - 18, 3, 15, '#f0ecff');
      for (let row = 0; row < 7; row++) R(x - 18 + row * 2.4, gy - 20 - row, 36 - row * 4.8, 1, '#b0a9dd');
      R(x - 4, gy - 36, 8, 10, '#c9c4e6'); R(x - 2, gy - 34, 4, 4, '#fff4e2'); R(x, gy - 33, 1, 2, '#1a1030');
      R(x - 1, gy - 40, 2, 4, '#c9c4e6');
      R(x - 13 + 7, gy - 12, 3, 3, tw ? '#ffd87a' : '#e6b85c');
    } else if (kind === 'tower') {
      for (let yy = 0; yy <= 42; yy++) {
        const half = Math.round(1 + 13 * Math.pow((42 - yy) / 42, 2.2));
        R(x - half, gy - yy, 1, 1, '#c9a86b'); R(x + half, gy - yy, 1, 1, '#c9a86b');
        if (yy % 4 === 0 && half > 2) for (let k = -half + 1; k < half; k += 2) R(x + k, gy - yy, 1, 1, '#8a6f45');
      }
      R(x - 9, gy - 14, 19, 1, '#c9a86b'); R(x - 5, gy - 26, 11, 1, '#c9a86b');
      R(x, gy - 47, 1, 5, '#c9a86b');
      for (let i = 0; i < 6; i++) if ((i + tw) % 2) R(x - 6 + i * 2, gy - 10 - i * 5, 1, 1, '#ffe066');
    } else if (kind === 'lighthouse') {
      for (let yy = 0; yy < 30; yy++) { const half = Math.round(5 - yy / 10); R(x - half, gy - yy, half * 2 + 1, 1, Math.floor(yy / 5) % 2 ? '#fff4e2' : '#e8453c'); }
      R(x - 4, gy - 32, 9, 2, '#3a3470'); R(x - 2, gy - 37, 5, 5, '#ffe066'); R(x - 3, gy - 39, 7, 2, '#3a3470');
      const dir = tw ? 1 : -1;
      for (let i = 1; i < 18; i++) if (i % 2) R(x + dir * (3 + i), gy - 35 + (i % 3 === 0 ? 1 : 0), 1, 1, '#fff7c2');
    } else { // home
      R(x - 14, gy - 16, 28, 16, '#7a6fc0');
      for (let row = 0; row < 9; row++) R(x - 16 + row * 2, gy - 17 - row, 32 - row * 4, 1, '#4a2f5a');
      R(x - 10, gy - 11, 7, 6, '#ffd87a'); R(x + 3, gy - 10, 6, 10, '#3a2420');
    }
    // a little sign with the place's name marker
    R(x - 1, gy - 1, 3, 1, '#1a1030');
  }

  function render(g) {
    // sky
    const bands = ['#070920', '#0b0e2c', '#12153c', '#1d1d52', '#2a2560', '#3a2d6c'];
    const bh = GROUND / bands.length;
    bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, Math.floor(i * bh), W, Math.ceil(bh) + 1); });
    const dist = s ? s.dist : 0;
    for (const st of stars) {
      g.fillStyle = st.d > 0.3 ? '#d6d9ff' : '#6a6fa8';
      g.fillRect(Math.round(((st.x - dist * st.d) % W + W) % W), Math.round(st.y), 1, 1);
    }
    // moon
    g.fillStyle = '#fff3d6';
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y <= 38) g.fillRect(200 + x, 22 + y, 1, 1);
    // far hills
    g.fillStyle = '#151a3d';
    for (let x = 0; x < W; x++) {
      const wx = x + dist * 0.3;
      const y = GROUND - 10 - Math.sin(wx * 0.03) * 6 - Math.sin(wx * 0.011 + 1) * 5;
      g.fillRect(x, Math.round(y), 1, GROUND - Math.round(y));
    }
    // ground
    g.fillStyle = '#1d4031'; g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = '#2a5a40'; g.fillRect(0, GROUND, W, 1);
    if (!s) return;

    for (const c of s.clouds) {
      const sx = c.x - s.dist;
      if (sx < -30 || sx > W + 30) continue;
      const seed = Math.round(c.x);
      if (c.top > 0) drawCloud(g, sx, -4, c.top, c.w, true, seed);
      if (c.bottom < GROUND) drawCloud(g, sx, c.bottom, GROUND + 4, c.w, false, seed);
      if (Math.sin(s.t * 3 + c.x) > 0.97) { g.fillStyle = '#ffe066'; g.fillRect(Math.round(sx), Math.round((c.top > 0 ? c.top : c.bottom) + 3), 1, 3); }
    }

    const d = deliveries[s.leg];
    if (d) drawPlace(g, d.place, placeScreenX(), GROUND);

    const px = s.landX != null && s.phase !== 'fly' && s.phase !== 'crash' ? s.landX : PLANE_X;
    g.save();
    g.translate(Math.round(px), Math.round(s.y));
    if (s.phase === 'crash') g.rotate(Math.sin(s.spin) * 0.8);
    else g.rotate(Math.max(-0.35, Math.min(0.35, s.vy / 110)));
    g.drawImage(planeImg, -6, -3);
    g.restore();
    // the note riding on the plane
    if (s.phase !== 'note') { g.fillStyle = '#ff9ec4'; g.fillRect(Math.round(px) - 2, Math.round(s.y) - 1, 2, 1); }
  }

  function pointer(type) {
    if (!s) return;
    if (type === 'down') s.hold = true;
    if (type === 'up' || type === 'cancel') s.hold = false;
  }
  function key(type, k) {
    if (!s || (k !== ' ' && k !== 'ArrowUp' && k !== 'w')) return;
    s.hold = type === 'down';
  }

  const def = {
    W, H, start, update, render, pointer, key, stop: () => { s = null; },
    help: 'hold anywhere on the screen (or hold space) to fly up. let go to glide down. fly through the gaps between the storm clouds. brushing the grass is fine. bumping a cloud just restarts that delivery, so try as many times as you like. there are three notes to deliver, and each place you reach opens one.'
  };
  return {
    open: done => window.MINI.open(def, done),
    debug: { skipLeg: () => { if (s) { s.dist = LEG; s.phase = 'arrive'; s.y = 60; } }, state: () => s && { leg: s.leg, phase: s.phase, dist: Math.round(s.dist) } }
  };
})();
