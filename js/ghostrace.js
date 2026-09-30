/* Beat My Ghost: a short obstacle course. Ahmed records a run (open the
   site once with ?ahmed on his phone); she races a see-through replay of
   it whenever she wants, and her fastest run becomes a ghost for him to
   chase. Each of you keeps only your fastest run. Deaths send you back to
   the last checkpoint, so it's all about the time. */
window.GHOSTRACE = (() => {
  'use strict';
  const C = window.KAMY, PL = window.PLAT, CL = window.CLOUD;
  const P = C.ghost || {};
  const W = 160, H = 224, T = PL.T, PAD = H - 36, FPS = 30;
  const NAME = { kamy: P.herName || 'kamy', ahmed: P.myName || 'ahmed' };
  const ME = PL.iam, THEM = ME === 'ahmed' ? 'kamy' : 'ahmed';

  /* ---- The course ---------------------------------------------------------- */
  const CHECKPOINTS = [2, 34, 64, 84];
  const COURSE = (() => {
    const b = PL.builder(110, 20);
    b.fill(0, 109, 17, 19, '#').set(2, 16, 'P');
    b.fill(8, 9, 17, 19, '.');                                        // a little gap
    b.set(13, 16, '#').fill(14, 14, 15, 16, '#').fill(15, 20, 14, 16, '#'); // steps up
    b.fill(22, 24, 16, 16, '^');                                      // spikes
    b.fill(28, 31, 17, 19, '.');                                      // a wide gap
    b.set(38, 16, 'S').fill(40, 48, 8, 16, '#');                      // spring up the wall
    b.fill(55, 61, 17, 19, '.').fill(55, 61, 17, 17, 'C');           // crumbling bridge
    b.fill(68, 80, 16, 16, '^');                                      // spike field...
    b.fill(69, 70, 14, 14, '#').fill(73, 74, 14, 14, '#').fill(77, 78, 14, 14, '#'); // ...with stepping stones
    b.fill(88, 91, 17, 19, '.');                                      // one last gap
    b.set(104, 16, 'F');
    return { rows: b.rows(), signs: [], notes: [] };
  })();

  /* ---- Saved runs ------------------------------------------------------------ */
  const LOCAL = 'kamy.ghosts';
  const local = () => { try { return JSON.parse(localStorage.getItem(LOCAL)) || {}; } catch (e) { return {}; } };
  async function loadGhosts() {
    const out = local();
    if (CL.enabled && CL.ghosts) {
      try { for (const r of await CL.ghosts()) out[r.who] = { time: r.time, run: r.run }; } catch (e) {}
    }
    return out;
  }
  async function saveGhost(time, run) {
    const all = local();
    if (!all[ME] || all[ME].time > time) { all[ME] = { time, run }; try { localStorage.setItem(LOCAL, JSON.stringify(all)); } catch (e) {} }
    if (CL.enabled && CL.saveGhost) { try { await CL.saveGhost(ME, time, run); } catch (e) {} }
  }
  const fmt = t => t == null ? '—' : t.toFixed(2) + 's';

  /* ---- Game --------------------------------------------------------------------- */
  let api = null, s = null, ghosts = {};
  const pads = PL.pads(W, H, PAD);

  async function start(a) {
    api = a;
    s = null;
    api.show([api.el('h3', 'game-title', P.title || 'beat my ghost'), api.el('p', 'line', '...')]);
    ghosts = await loadGhosts();
    lobby();
  }

  function lobby() {
    s = null;
    pads.clear();
    api.setHud('');
    const them = ghosts[THEM], mine = ghosts[ME];
    const parts = [api.el('h3', 'game-title', P.title || 'beat my ghost')];
    if (ME === 'ahmed') parts.push(api.el('p', 'line', P.recordIntro || 'record a run for kamy. only your fastest one is kept.'));
    else parts.push(api.el('p', 'line', P.intro || 'race my ghost. i ran this course once; beat my time.'));
    parts.push(api.el('p', 'line', them ? `${NAME[THEM]}'s best: ${fmt(them.time)}` : (ME === 'ahmed' ? `${NAME[THEM]} hasn't raced yet.` : (P.noGhost || `no ghost from ${NAME[THEM]} yet. set a time!`))));
    parts.push(api.el('p', 'line', `your best: ${fmt(mine && mine.time)}`));
    parts.push(api.button(ME === 'ahmed' ? 'record a run' : 'race', () => race()));
    api.show(parts);
  }

  function race() {
    api.hideScreen();
    pads.clear();
    const wd = PL.create(COURSE);
    const opp = ghosts[THEM];
    s = { wd, t: 0, count: 3.2, run: [], rec: 0, cp: CHECKPOINTS[0], dead: 0, deaths: 0, done: false, opp: opp && opp.run, oppTime: opp && opp.time };
  }

  function respawn() {
    const wd = s.wd;
    wd.reset();
    wd.p.x = s.cp * T + 1;
    wd.p.y = 17 * T - PL.PH;
    pads.clear();
  }

  function update(dt) {
    if (!s || s.done) return;
    if (s.count > 0) {
      const before = Math.ceil(s.count);
      s.count -= dt;
      if (Math.ceil(s.count) !== before) api.sfx(s.count <= 0 ? 'star' : 'blip');
      api.setHud(s.count > 0 ? `${Math.ceil(s.count)}...` : 'go!');
      return;
    }
    s.t += dt;
    const wd = s.wd, p = wd.p;
    // record where she is, 30 times a second
    s.rec += dt;
    while (s.rec >= 1 / FPS) {
      s.rec -= 1 / FPS;
      s.run.push(Math.round(p.x), Math.round(p.y), (p.face < 0 ? 1 : 0) + (p.walk > 0 && p.ground ? 2 : 0));
    }
    if (p.dead) { if ((s.dead -= dt) <= 0) respawn(); }
    else {
      for (const e of wd.update(dt, pads.input)) {
        if (e.type === 'die') { s.deaths++; s.dead = 0.7; api.sfx('hurt'); }
        if (e.type === 'win') finish();
        if (e.type === 'jump') api.sfx('type');
        if (e.type === 'spring') api.sfx('grow');
        if (e.type === 'crumble') api.sfx('pop');
      }
      for (const c of CHECKPOINTS) if (c > s.cp && p.x > c * T) { s.cp = c; api.sfx('pickup'); }
    }
    if (!s.done) api.setHud(`${fmt(s.t)}${s.oppTime ? ` · ${NAME[THEM]}: ${fmt(s.oppTime)}` : ''}`);
  }

  function finish() {
    s.done = true;
    const time = Math.round(s.t * 100) / 100, opp = s.oppTime;
    const mine = ghosts[ME];
    const record = !mine || time < mine.time;
    if (record) { ghosts[ME] = { time, run: s.run }; saveGhost(time, s.run); }
    const beat = !opp || time < opp;
    if (ME === 'kamy' && beat) { try { localStorage.setItem('kamy.arcade.ghost', 'true'); } catch (e) {} }
    api.sfx(beat ? 'win' : 'sad');
    const parts = [
      api.el('h3', 'game-title', !opp ? (P.firstTitle || 'finished!') : beat ? (P.beatTitle || 'you beat me!') : (P.loseTitle || 'so close')),
      api.el('p', 'line', `${fmt(time)}${opp ? ` vs ${fmt(opp)}` : ''}${s.deaths ? ` · ${s.deaths} ${s.deaths === 1 ? 'death' : 'deaths'}` : ''}`)
    ];
    if (record) parts.push(api.el('p', 'line', mine ? `new best! (was ${fmt(mine.time)})` : (ME === 'ahmed' ? 'saved. kamy can race it now.' : 'saved as your ghost.')));
    if (opp && beat && ME === 'kamy') { const l = api.el('p', 'win-note', ''); parts.push(l); setTimeout(() => api.typeInto(l, P.beatLine || ''), 30); }
    parts.push(api.button('race again', () => race()), api.button('back', () => lobby()));
    setTimeout(() => { if (s) { api.show(parts); api.setHud(''); } }, 600);
  }

  // where the other person's ghost is at time t
  function ghostAt(run, t) {
    const n = run.length / 3;
    if (!n) return null;
    const f = Math.min(n - 1, t * FPS), i = Math.floor(f), j = Math.min(n - 1, i + 1), k = f - i;
    const x = run[i * 3] + (run[j * 3] - run[i * 3]) * k, y = run[i * 3 + 1] + (run[j * 3 + 1] - run[i * 3 + 1]) * k;
    const flags = run[i * 3 + 2];
    return { x, y, face: flags & 1 ? -1 : 1, walk: flags & 2 ? t : 0, who: THEM, alpha: 0.45 };
  }

  function render(g) {
    g.fillStyle = '#0b0a24'; g.fillRect(0, 0, W, H);
    if (!s) return;
    const gh = s.opp ? ghostAt(s.opp, s.t) : null;
    const cam = PL.draw(g, s.wd, W, PAD, { who: ME, ghosts: gh ? [gh] : [] });
    // checkpoint flags (green once reached)
    for (const c of CHECKPOINTS.slice(1)) {
      const x = c * T - cam.x, y = 17 * T - cam.y;
      if (x < -8 || x > W) continue;
      g.fillStyle = '#c8c8e0'; g.fillRect(x + 1, y - 12, 1, 12);
      g.fillStyle = s.cp >= c ? '#9be3b0' : '#6d63b0'; g.fillRect(x + 2, y - 12, 5, 3);
    }
    // an arrow at the screen edge when the ghost is off-screen
    if (gh) {
      const gx = gh.x - cam.x;
      g.fillStyle = 'rgba(200,200,224,.6)';
      if (gx > W) for (let k = 0; k < 4; k++) g.fillRect(W - 3 - k, 40 - k, 1, k * 2 + 1);
      if (gx < -6) for (let k = 0; k < 4; k++) g.fillRect(2 + k, 40 - k, 1, k * 2 + 1);
    }
    pads.draw(g);
  }

  const def = {
    W, H, start, update, render,
    pointer: (type, p, e) => { if (s && !api.screenOpen()) pads.pointer(type, p, e); },
    key: (type, k) => { if (s) pads.key(type, k); },
    stop: () => { s = null; pads.clear(); },
    help: () => `run to the flag as fast as you can: left, right and jump pads at the bottom (or arrow keys and space). the see-through runner is ${NAME[THEM]}'s fastest run. dying sends you back to the last green checkpoint, but the clock keeps going. your fastest run is saved as your own ghost.`
  };
  return {
    open: done => window.MINI.open(def, done),
    COURSE,
    debug: { state: () => s && { t: s.t, done: s.done, cp: s.cp, deaths: s.deaths, count: s.count, frames: s.run.length / 3 }, world: () => s && s.wd, ghosts: () => ghosts, finish: () => s && finish() }
  };
})();
