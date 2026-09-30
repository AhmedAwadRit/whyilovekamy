/* Pineapple Pinball: a tiny table with three pineapple bumpers, two
   slingshots and five targets named after inside jokes. Lighting all five
   is the jackpot. Big moments (the jackpot, a bumper frenzy, losing a ball,
   a new best) can play a short voice clip if one is set in content.js;
   otherwise they just show a line. Reach the goal score to beat it. */
window.PINBALL = (() => {
  'use strict';
  const C = window.KAMY, S = window.SPRITES, A = window.AUDIO;
  const P = C.pinball || {};
  const W = 160, H = 224, R = 3, GRAV = 250, STEPS = 8;
  const BEST = 'kamy.pinball.best';
  const GOAL = P.goal || 15000;

  /* ---- The table ---------------------------------------------------------- */
  const segs = [];
  function wall(pts, extra) {
    for (let i = 1; i < pts.length; i++) segs.push({ ax: pts[i - 1][0], ay: pts[i - 1][1], bx: pts[i][0], by: pts[i][1], e: 0.4, ...(extra || {}) });
  }
  // the outer edge, over the top and down the right side of the launch lane
  wall([[8, 172], [8, 60], [12, 44], [22, 32], [36, 24], [56, 19], [104, 19], [124, 24], [138, 32], [148, 44], [152, 58], [152, 216]]);
  wall([[140, 216], [140, 76]]);                    // the launch lane's inner wall
  wall([[141, 210], [151, 210]], { e: 0.1 });       // the plunger
  wall([[8, 172], [46, 193]]);                      // the slopes down onto the flippers
  wall([[140, 172], [104, 193]]);
  wall([[18, 142], [32, 166]], { e: 0.3, kick: 110, sling: 0 });  // slingshots
  wall([[132, 142], [118, 166]], { e: 0.3, kick: 110, sling: 1 });
  wall([[18, 142], [18, 158], [30, 168]]);
  wall([[132, 142], [132, 158], [120, 168]]);
  const gate = { ax: 140, ay: 76, bx: 152, by: 64, e: 0.4, gate: true };   // closes the lane once the ball is out
  segs.push(gate);

  const TARGET_DEFS = [[10, 94, 10, 108], [10, 118, 10, 132], [138, 94, 138, 108], [138, 118, 138, 132], [68, 40, 84, 40]];
  const targetInfo = (P.targets || []).concat([
    { name: 'dunkin', line: 'dunkin run!' }, { name: 'sofian', line: 'SOFIAN.' }, { name: 'matcha', line: 'matcha, almond milk.' },
    { name: 'post malone', line: 'post malone karaoke!' }, { name: 'stray cats', line: 'a stray cat. run.' }
  ].slice((P.targets || []).length)).slice(0, 5);
  const targets = TARGET_DEFS.map(([ax, ay, bx, by], i) => {
    const s = { ax, ay, bx, by, e: 0.5, target: i };
    segs.push(s);
    return s;
  });
  const COLORS = ['#ff8a2a', '#ff5c8a', '#9be3b0', '#8fb3ff', '#ffd87a'];
  const bumpers = [{ x: 56, y: 72 }, { x: 98, y: 68 }, { x: 77, y: 100 }].map(b => ({ ...b, r: 8, flash: 0 }));

  // flippers: pivot, which side, current angle (0 = flat, + = down)
  const REST = 0.5, UP = -0.45, LEN = 22, SPEED = 22;
  const flippers = [{ px: 46, py: 196, side: 1 }, { px: 104, py: 196, side: -1 }].map(f => ({ ...f, a: REST, w: 0, held: false }));
  const tip = f => ({ x: f.px + f.side * Math.cos(f.a) * LEN, y: f.py + Math.sin(f.a) * LEN });

  /* ---- Sprites ------------------------------------------------------------ */
  const pineapple = S.make([
    '..g.g.g..', '...ggg...', '..g.g.g..', '....g....',
    '.ooooooo.', 'oyYyYyYyo', 'oYyYyYyYo', 'oyYyYyYyo', 'oYyYyYyYo', 'oyYyYyYyo', '.oyYyYyo.', '..ooooo..'
  ], { g: '#4caf50', o: '#1a1030', y: '#ffd23f', Y: '#c98a1b' });
  const pineLit = S.make([
    '..g.g.g..', '...ggg...', '..g.g.g..', '....g....',
    '.ooooooo.', 'oyWyWyWyo', 'oWyWyWyWo', 'oyWyWyWyo', 'oWyWyWyWo', 'oyWyWyWyo', '.oyWyWyo.', '..ooooo..'
  ], { g: '#8fe38f', o: '#1a1030', y: '#fff7c2', W: '#ffd23f' });
  const ballSpr = S.make(['.www.', 'wWwwg', 'wwwwg', 'wwwgg', '.ggg.'], { w: '#e8e8f8', W: '#ffffff', g: '#9a9ab8' });

  function line(g, x0, y0, x1, y1, col) {
    g.fillStyle = col;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1);
  }
  // the table itself never changes, so it's drawn once
  const table = (() => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#120e2e'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1b1542';
    for (let y = 0; y < H; y += 6) for (let x = (y / 6) % 2 * 6; x < W; x += 12) g.fillRect(x, y, 3, 3);
    // arrows pointing up the middle
    g.fillStyle = '#2e2766';
    for (const y of [132, 142, 152]) { line(g, 72, y + 4, 76, y, '#2e2766'); line(g, 76, y, 80, y + 4, '#2e2766'); }
    for (const s of segs) if (!s.target && !s.gate) {
      line(g, s.ax, s.ay, s.bx, s.by, s.kick ? '#ff9ec4' : '#8a80cc');
      line(g, s.ax + 1, s.ay, s.bx + 1, s.by, s.kick ? '#c4507e' : '#4b438a');
    }
    // the plunger lane
    g.fillStyle = '#0c0a22'; g.fillRect(141, 77, 11, 133);
    return c;
  })();

  /* ---- Physics ------------------------------------------------------------ */
  let api = null, s = null;

  function collide(b, seg, rad, surf) {
    const dx = seg.bx - seg.ax, dy = seg.by - seg.ay, L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((b.x - seg.ax) * dx + (b.y - seg.ay) * dy) / L2));
    const px = seg.ax + dx * t, py = seg.ay + dy * t;
    let nx = b.x - px, ny = b.y - py;
    const d = Math.hypot(nx, ny), min = R + rad;
    if (d >= min || d === 0) return 0;
    nx /= d; ny /= d;
    b.x = px + nx * min; b.y = py + ny * min;
    const sv = surf ? surf(px, py) : { x: 0, y: 0 };
    const vn = (b.vx - sv.x) * nx + (b.vy - sv.y) * ny;
    if (vn < 0) {
      b.vx -= (1 + seg.e) * vn * nx; b.vy -= (1 + seg.e) * vn * ny;
      if (seg.kick) { b.vx += nx * seg.kick; b.vy += ny * seg.kick; }
    }
    return -vn;
  }

  function step(dt) {
    const b = s.ball;
    for (const f of flippers) {
      const goal = f.held ? UP : REST;
      const prev = f.a;
      f.a = goal < f.a ? Math.max(goal, f.a - SPEED * dt) : Math.min(goal, f.a + SPEED * dt);
      f.w = (f.a - prev) / dt;
    }
    if (!b || b.waiting) return;
    b.vy += GRAV * dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (!b.out && b.x < 136) b.out = true;
    for (const seg of segs) {
      if (seg.gate && !b.out) continue;
      const hit = collide(b, seg, 0.5);
      if (!hit) continue;
      if (seg.target !== undefined && hit > 30) hitTarget(seg.target);
      if (seg.kick && hit > 20) { s.score += 10; api.sfx('pop'); }
    }
    for (const bu of bumpers) {
      const dx = b.x - bu.x, dy = b.y - bu.y, d = Math.hypot(dx, dy), min = R + bu.r - 2;
      if (d < min && d > 0) {
        const nx = dx / d, ny = dy / d;
        b.x = bu.x + nx * min; b.y = bu.y + ny * min;
        const vn = b.vx * nx + b.vy * ny;
        b.vx -= vn * nx; b.vy -= vn * ny;              // drop the inward part...
        b.vx += nx * 170; b.vy += ny * 170;            // ...and kick it away
        hitBumper(bu);
      }
    }
    for (const f of flippers) {
      const t = tip(f);
      collide(b, { ax: f.px, ay: f.py, bx: t.x, by: t.y, e: 0.25 }, 2, (px, py) => {
        const rx = px - f.px, ry = py - f.py;
        return { x: -f.side * f.w * ry, y: f.side * f.w * rx };  // how fast that spot on the flipper is moving
      });
    }
    // don't let it go absurdly fast
    const v = Math.hypot(b.vx, b.vy);
    if (v > 520) { b.vx *= 520 / v; b.vy *= 520 / v; }
    // stuck somewhere for a couple of seconds (and not being cradled): a tiny nudge
    if (b.out && Math.hypot(b.vx, b.vy) < 6 && !flippers.some(f => f.held)) {
      if ((b.still = (b.still || 0) + dt) > 2) { b.vx = (Math.random() - 0.5) * 60; b.vy = -40; b.still = 0; }
    } else b.still = 0;
    // a weak launch rolls back onto the plunger
    if (!b.out && b.x > 140 && b.y > 200 && Math.abs(b.vy) < 25) { b.waiting = true; b.x = 146; b.y = 206; b.vx = b.vy = 0; }
    if (b.y > H + 8) drain();
  }

  /* ---- Scoring and moments ------------------------------------------------ */
  function moment(ev) {
    if (!ev) return;
    const lines = [].concat(ev.lines || ev.line || []);
    if (lines.length) say(lines[Math.floor(Math.random() * lines.length)]);
    if (ev.audio && !A.muted) { try { const a = new Audio(ev.audio); a.volume = 0.9; a.play().catch(() => {}); } catch (e) {} }
  }
  function say(text) { s.msg = text; s.msgT = 2.6; }

  function hitTarget(i) {
    if (s.lit[i]) { s.score += 50; return; }
    s.lit[i] = true;
    s.score += 250;
    api.sfx('pickup');
    moment(targetInfo[i]);
    if (s.lit.every(Boolean)) {
      s.jackpots++;
      s.score += 5000 * s.jackpots;
      api.sfx('win');
      moment(P.jackpot || { line: 'JACKPOT. all of them.' });
      setTimeout(() => { if (s) s.lit = s.lit.map(() => false); }, 900);
    }
  }
  function hitBumper(bu) {
    bu.flash = 0.25;
    s.score += 100;
    api.sfx('blip');
    s.frenzy = s.frenzy.filter(t => s.t - t < 2).concat(s.t);
    if (s.frenzy.length >= 5) { s.frenzy = []; s.score += 1000; moment(P.frenzy || { line: 'pineapple frenzy!' }); }
  }
  function checkGoal() {
    if (!s.goalHit && s.score >= GOAL) { s.goalHit = true; api.sfx('win'); moment({ line: P.goalLine || 'goal reached!' , audio: P.goalAudio }); }
  }

  function newBall() {
    s.ball = { x: 146, y: 206, vx: 0, vy: 0, waiting: true, out: false };
    s.charge = 0; s.charging = false;
  }
  function drain() {
    s.ball = null;
    s.balls--;
    api.sfx('sad');
    if (s.balls > 0) { moment(P.drain || { line: 'noooo' }); setTimeout(() => { if (s && s.phase === 'play') newBall(); }, 1200); }
    else setTimeout(gameOver, 900);
  }
  function launch() {
    const b = s.ball;
    if (!b || !b.waiting) return;
    b.waiting = false;
    b.vy = -(230 + 260 * s.charge);
    s.charge = 0; s.charging = false;
    api.sfx('shoot');
  }

  function gameOver() {
    if (!s) return;
    s.phase = 'over';
    let best = 0;
    try { best = +localStorage.getItem(BEST) || 0; } catch (e) {}
    const record = s.score > best;
    if (record) { try { localStorage.setItem(BEST, String(s.score)); } catch (e) {} if (best > 0) moment(P.highScore || { line: 'new best!' }); }
    const won = s.score >= GOAL;
    const parts = [
      api.el('h3', 'game-title', won ? (P.doneTitle || 'you did it') : (P.overTitle || 'game over')),
      api.el('p', 'line', `score ${s.score.toLocaleString()} · best ${Math.max(best, s.score).toLocaleString()}`)
    ];
    if (won) { const l = api.el('p', 'win-note', ''); parts.push(l); setTimeout(() => api.typeInto(l, P.doneLine || ''), 50); }
    else parts.push(api.el('p', 'line', `get ${GOAL.toLocaleString()} to beat it.`));
    parts.push(api.button('play again', () => play()), api.button('back to the arcade', () => api.close({ complete: s.won || won })));
    s.won = s.won || won;
    api.show(parts);
    api.setHud('');
  }

  /* ---- Game --------------------------------------------------------------- */
  function start(a) {
    api = a;
    s = null;
    api.show([
      api.el('h3', 'game-title', P.title || 'pineapple pinball'),
      api.el('p', 'line', P.intro || ''),
      api.button('play', () => play())
    ]);
  }
  function play() {
    const won = s && s.won;
    api.hideScreen();
    s = { t: 0, score: 0, balls: 3, lit: targets.map(() => false), jackpots: 0, frenzy: [], msg: '', msgT: 0, phase: 'play', goalHit: false, won, ball: null, charge: 0, charging: false, pointers: {} };
    flippers.forEach(f => { f.held = false; f.a = REST; });
    newBall();
  }

  function update(dt) {
    if (!s) return;
    s.t += dt;
    if (s.charging) s.charge = Math.min(1, s.charge + dt * 1.2);
    for (const bu of bumpers) bu.flash = Math.max(0, bu.flash - dt);
    const h = dt / STEPS;
    if (s.phase === 'play') for (let k = 0; k < STEPS; k++) step(h);
    if (s.phase === 'play') checkGoal();
    if (s.msgT > 0) s.msgT -= dt;
    if (s.phase === 'play') {
      const b = s.ball;
      api.setHud(s.msgT > 0 ? s.msg : b && b.waiting ? (P.launchHint || 'hold to pull the plunger, let go to launch') : `${s.score.toLocaleString()} · ball ${4 - s.balls}/3`);
    }
  }

  /* ---- Input: left half = left flipper, right half = right flipper ------- */
  function press(which, down) {
    if (!s || s.phase !== 'play') return;
    if (which === 'P') {
      if (down && s.ball && s.ball.waiting) s.charging = true;
      else if (!down && s.charging) launch();
      return;
    }
    const f = flippers[which === 'L' ? 0 : 1];
    if (down && !f.held) api.sfx('type');
    f.held = down;
  }
  function pointer(type, p, e) {
    if (!s || api.screenOpen()) return;
    const id = e ? e.pointerId : 0;
    if (type === 'down') {
      const which = p.x < W / 2 ? 'L' : s.ball && s.ball.waiting ? 'P' : 'R';
      s.pointers[id] = which;
      press(which, true);
    } else if (type === 'up' || type === 'cancel') {
      const which = s.pointers[id];
      delete s.pointers[id];
      if (which) press(which, false);
    }
  }
  function key(type, k) {
    const down = type === 'down';
    if (k === 'ArrowLeft' || k === 'z' || k === 'Z' || k === 'a' || k === 'A') press('L', down);
    else if (k === 'ArrowRight' || k === 'm' || k === 'M' || k === '/' || k === 'd' || k === 'D') press('R', down);
    else if (k === ' ' || k === 'ArrowDown' || k === 'Enter') press('P', down);
  }

  /* ---- Drawing ------------------------------------------------------------ */
  function render(g) {
    g.drawImage(table, 0, 0);
    if (!s) return;
    // targets
    targets.forEach((t, i) => {
      const lit = s.lit[i];
      const col = lit ? COLORS[i] : '#3a3470';
      if (t.ay === t.by) { g.fillStyle = col; g.fillRect(t.ax, t.ay - 1, t.bx - t.ax + 1, 3); }
      else { g.fillStyle = col; g.fillRect(t.ax - 1, t.ay, 3, t.by - t.ay + 1); }
      if (lit && Math.floor(s.t * 6) % 2) { g.fillStyle = '#fff7c2'; g.fillRect(Math.round((t.ax + t.bx) / 2), Math.round((t.ay + t.by) / 2), 1, 1); }
    });
    // a row of lights showing the jackpot progress
    s.lit.forEach((l, i) => { g.fillStyle = l ? COLORS[i] : '#2e2766'; g.fillRect(64 + i * 5, 118, 3, 3); });
    // bumpers
    for (const bu of bumpers) {
      if (bu.flash > 0) { g.fillStyle = '#ffd23f'; for (let a = 0; a < 16; a++) g.fillRect(Math.round(bu.x + Math.cos(a / 16 * 6.283) * (bu.r + 2)), Math.round(bu.y + Math.sin(a / 16 * 6.283) * (bu.r + 2)), 1, 1); }
      // the bumper's rim, so you can see how big it really is
      g.fillStyle = bu.flash > 0 ? '#ff9ec4' : '#4b438a';
      for (let a = 0; a < 28; a++) g.fillRect(Math.round(bu.x + Math.cos(a / 28 * 6.283) * bu.r), Math.round(bu.y + Math.sin(a / 28 * 6.283) * bu.r), 1, 1);
      const spr = bu.flash > 0 ? pineLit : pineapple;
      g.drawImage(spr, bu.x - 4, bu.y - 7);
    }
    // flippers
    for (const f of flippers) {
      const t = tip(f), n = Math.ceil(LEN);
      for (let i = 0; i <= n; i++) {
        const k = i / n, x = f.px + (t.x - f.px) * k, y = f.py + (t.y - f.py) * k, r = k < 0.2 ? 2 : 1.5;
        g.fillStyle = '#c4507e'; g.fillRect(Math.round(x - r), Math.round(y - r + 1), Math.ceil(r * 2), Math.ceil(r * 2));
        g.fillStyle = '#ff9ec4'; g.fillRect(Math.round(x - r), Math.round(y - r), Math.ceil(r * 2), Math.ceil(r * 2) - 1);
      }
    }
    // the plunger spring
    const pull = Math.round(s.charge * 7);
    g.fillStyle = '#8a80cc';
    for (let y = 211 + pull; y < 222; y += 2) g.fillRect(143, y, 7, 1);
    g.fillStyle = '#ff9ec4'; g.fillRect(142, 210 + pull, 9, 2);
    // the ball
    const b = s.ball;
    if (b) g.drawImage(ballSpr, Math.round(b.x - 2), Math.round(b.y - 2 + (b.waiting ? pull : 0)));
    // the gate, once it's closed
    if (b && b.out) line(g, gate.ax, gate.ay, gate.bx, gate.by, '#6d63b0');
    // balls left
    for (let i = 0; i < s.balls - (b ? 1 : 0); i++) g.drawImage(ballSpr, 4 + i * 7, H - 8);
  }

  const def = {
    W, H, start, update, render, pointer, key,
    stop: () => { s = null; },
    help: `tap and hold the left half of the screen for the left flipper, the right half for the right one (or use the arrow keys). to launch, hold the right side, then let go: the longer you hold, the harder it shoots (space works too). hit all five colored targets for the jackpot, and hit the pineapples fast for a frenzy. score ${GOAL.toLocaleString()} to beat it. you get 3 balls.`
  };
  return {
    open: done => window.MINI.open(def, done),
    debug: {
      state: () => s && { score: s.score, balls: s.balls, phase: s.phase, ball: s.ball && { x: Math.round(s.ball.x), y: Math.round(s.ball.y), vy: Math.round(s.ball.vy), waiting: s.ball.waiting, out: s.ball.out }, lit: s.lit.filter(Boolean).length },
      score: n => { if (s) s.score = n; },
      place: (x, y, vx, vy) => { if (s) s.ball = { x, y, vx, vy, waiting: false, out: true }; },
      lightAll: () => { if (s) for (let i = 0; i < 5; i++) hitTarget(i); }
    }
  };
})();
