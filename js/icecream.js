/* The ice cream cart: she builds her own ice cream (a cone or a cup, up to
   three scoops, toppings), and when she serves it, the two of you on the
   hill eat ice cream for a while, in her flavors. Flavors and their little
   notes are in content.js. */
window.ICECREAM = (() => {
  'use strict';
  const C = window.KAMY, S = window.SPRITES;
  const P = C.icecream || {};
  const $ = id => document.getElementById(id);
  const KEY = 'kamy.icecream';
  const MAX = 3;

  // look: base colour, then what's mixed in
  const LOOKS = {
    cottoncandy: { base: '#ff9ed2', light: '#ffd0ea', blotch: '#8fd3ff', specks: ['#b98cff', '#fff27a', '#8fd3ff'] },
    mintchip: { base: '#bff0d0', light: '#e2fbe9', chips: '#3a2418' },
    strawberrymocha: { base: '#f2a0b0', light: '#ffd0da', swirl: '#8a5a44' },
    pbchocolate: { base: '#d9a066', light: '#f0c890', ribbon: '#4a2a1a' },
    saltedcaramel: { base: '#d08a3c', light: '#f0b46a', chips: '#4a2a1a', specks: ['#ffffff'] },
    matcha: { base: '#a8c66c', light: '#cfe39a', specks: ['#8aa850'] },
    lychee: { base: '#fbeef0', light: '#ffffff', specks: ['#f5b8c8'] },
    pineapple: { base: '#ffe066', light: '#fff4b0', specks: ['#ffc21f'] },
    cookies: { base: '#f4f0e8', light: '#ffffff', chips: '#1e1a22' },
    moon: { base: '#2e3170', light: '#4b4f93', specks: ['#ffe7a0', '#ffffff', '#8fd3ff'] }
  };
  const FLAVORS = (P.flavors || []).filter(f => LOOKS[f.id]).map(f => ({ ...f, look: LOOKS[f.id] }));
  const HOLDERS = P.holders || [{ id: 'cone', name: 'cone' }, { id: 'waffle', name: 'waffle cone' }, { id: 'cup', name: 'cup' }];
  const TOPPINGS = P.toppings || [{ id: 'sprinkles', name: 'sprinkles' }, { id: 'fudge', name: 'hot fudge' }, { id: 'whip', name: 'whipped cream' }, { id: 'cherry', name: 'a cherry' }, { id: 'wafer', name: 'a wafer' }];
  const flavor = id => FLAVORS.find(f => f.id === id);

  /* ---- Drawing ---------------------------------------------------------------- */
  // a tiny repeatable "random" so each scoop keeps its own specks
  const rand = seed => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  function scoop(g, look, cx, cy, rx, ry, seed, drip) {
    const r = rand(seed);
    const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const top = !inside(x + 0.5, y - 1.5);
      g.fillStyle = top && x < cx ? look.light : look.base;
      g.fillRect(x, y, 1, 1);
    }
    // a wavy bottom edge (and a drip or two)
    g.fillStyle = look.base;
    for (let x = Math.ceil(cx - rx + 1); x < cx + rx - 1; x++) if ((x + seed) % 3 === 0) g.fillRect(x, Math.round(cy + ry), 1, 1);
    if (drip) { const dx = Math.round(cx - rx / 2 + r() * rx); g.fillRect(dx, Math.round(cy + ry), 1, 2 + Math.round(r() * 2)); }
    const spot = () => { for (let k = 0; k < 20; k++) { const x = Math.round(cx - rx + r() * rx * 2), y = Math.round(cy - ry + r() * ry * 2); if (inside(x + 0.5, y + 0.5)) return [x, y]; } return [Math.round(cx), Math.round(cy)]; };
    if (look.blotch) for (let k = 0; k < 4; k++) { const [x, y] = spot(); g.fillStyle = look.blotch; g.fillRect(x, y, 2, 2); if (inside(x + 2.5, y + 0.5)) g.fillRect(x + 2, y, 1, 1); }
    if (look.swirl) { g.fillStyle = look.swirl; for (let k = 0; k < rx * 2; k++) { const x = Math.round(cx - rx + 1 + k), y = Math.round(cy + Math.sin(k * 0.7) * ry * 0.45); if (inside(x + 0.5, y + 0.5)) g.fillRect(x, y, 1, 1); } }
    if (look.ribbon) { g.fillStyle = look.ribbon; for (let k = 0; k < rx * 2; k++) { const x = Math.round(cx - rx + 1 + k), y = Math.round(cy - ry * 0.2 + Math.sin(k * 0.5 + 1) * ry * 0.5); if (inside(x + 0.5, y + 0.5)) { g.fillRect(x, y, 1, 1); if (k % 3 === 0 && inside(x + 0.5, y + 1.5)) g.fillRect(x, y + 1, 1, 1); } } }
    if (look.chips) for (let k = 0; k < Math.round(rx * ry / 9); k++) { const [x, y] = spot(); g.fillStyle = look.chips; g.fillRect(x, y, 1, 1); }
    if (look.specks) for (let k = 0; k < Math.round(rx * ry / 6); k++) { const [x, y] = spot(); g.fillStyle = look.specks[k % look.specks.length]; g.fillRect(x, y, 1, 1); }
  }

  // the whole ice cream, centred in a w x h canvas
  function drawCreation(g, cr, w, h) {
    g.clearRect(0, 0, w, h);
    const cx = w / 2, base = h - 3;
    // the holder
    if (cr.holder === 'cup') {
      for (let y = 0; y < 14; y++) {
        const half = 10 - Math.floor(y / 4);
        for (let x = -half; x < half; x++) { g.fillStyle = (x + 20) % 6 < 3 ? '#ff9ec4' : '#fff4e2'; g.fillRect(Math.round(cx + x), base - 13 + y, 1, 1); }
      }
      g.fillStyle = '#c4507e'; g.fillRect(Math.round(cx - 10), base - 13, 20, 1);
    } else {
      const waffle = cr.holder === 'waffle', tall = waffle ? 24 : 20;
      for (let y = 0; y < tall; y++) {
        const half = Math.max(0, Math.round((waffle ? 9 : 7) * (1 - y / tall)));
        for (let x = -half; x <= half; x++) {
          const line = (x + y) % 4 === 0 || (x - y + 40) % 4 === 0;
          g.fillStyle = line ? (waffle ? '#8a5a2a' : '#b07a3a') : (waffle ? '#c98a3e' : '#e8b56a');
          g.fillRect(Math.round(cx + x), base - tall + y + 1, 1, 1);
        }
      }
      if (waffle) { g.fillStyle = '#4a2a1a'; g.fillRect(Math.round(cx - 9), base - 24, 19, 2); }
    }
    // the scoops, bottom to top
    const top0 = cr.holder === 'cup' ? base - 15 : base - (cr.holder === 'waffle' ? 25 : 21);
    let topY = top0;
    cr.scoops.forEach((id, i) => {
      const f = flavor(id);
      if (!f) return;
      const cy = top0 - i * 10;
      scoop(g, f.look, Math.round(cx), cy, 10 - i * 0.6, 6.5, 7 + i * 31, i === 0);
      topY = cy - 6;
    });
    if (!cr.scoops.length) return;
    const tops = new Set(cr.toppings || []);
    const tc = Math.round(cx);
    if (tops.has('fudge')) { g.fillStyle = '#4a2a1a'; for (let x = -7; x <= 7; x++) g.fillRect(tc + x, topY + 2 + Math.round(Math.abs(Math.sin(x)) * 2), 1, 1 + (x % 3 === 0 ? 3 : 1)); }
    if (tops.has('whip')) { g.fillStyle = '#ffffff'; g.fillRect(tc - 5, topY - 1, 11, 3); g.fillRect(tc - 3, topY - 3, 7, 2); g.fillRect(tc - 1, topY - 5, 3, 2); g.fillStyle = '#e8e4f0'; g.fillRect(tc - 5, topY + 1, 11, 1); topY -= 5; }
    if (tops.has('sprinkles')) { const r = rand(99); const cols = ['#ff5c8a', '#8fd3ff', '#fff27a', '#9be3b0', '#b98cff']; for (let k = 0; k < 14; k++) { g.fillStyle = cols[k % cols.length]; g.fillRect(tc - 7 + Math.round(r() * 14), topY + 1 + Math.round(r() * 5), 1, 1); } }
    if (tops.has('wafer')) { g.fillStyle = '#e8b56a'; g.fillRect(tc + 3, topY - 8, 3, 10); g.fillStyle = '#b07a3a'; g.fillRect(tc + 3, topY - 5, 3, 1); g.fillRect(tc + 3, topY - 2, 3, 1); }
    if (tops.has('cherry')) { g.fillStyle = '#2f6e45'; g.fillRect(tc, topY - 6, 1, 3); g.fillStyle = '#e0303c'; g.fillRect(tc - 2, topY - 3, 4, 3); g.fillStyle = '#ff8a8a'; g.fillRect(tc - 1, topY - 3, 1, 1); }
  }

  // one little ice cream for the silhouettes on the hill (bites: 0 = whole)
  function drawHeld(g, x, y, cr, i, bites) {
    const f = flavor(cr.scoops[Math.min(i, cr.scoops.length - 1)] || cr.scoops[0]);
    if (!f) return;
    const cup = cr.holder === 'cup';
    g.fillStyle = cup ? '#ff9ec4' : '#e8b56a';
    if (cup) g.fillRect(x - 1, y + 1, 3, 2); else { g.fillRect(x - 1, y + 1, 3, 1); g.fillRect(x, y + 2, 1, 2); }
    const left = 3 - Math.min(3, bites);
    if (left >= 1) { g.fillStyle = f.look.base; g.fillRect(x - 1, y, 3, 1); }
    if (left >= 2) { g.fillRect(x - 1, y - 1, 3, 1); g.fillStyle = f.look.light; g.fillRect(x - 1, y - 1, 1, 1); }
    if (left >= 3) { g.fillStyle = f.look.base; g.fillRect(x, y - 2, 1, 1); }
  }

  /* ---- The cart in the field ---------------------------------------------- */
  const cart = S.make([
    '.pwpwpwpwp.',
    'pwpwpwpwpwp',
    '.....o.....',
    '.....o.....',
    '.....o.....',
    '.bbbbbbbbb.',
    '.bWWWWWWWb.',
    '.bWpWyWgWb.',
    '.bbbbbbbbb.',
    '..k.....k..'
  ], { p: '#ff9ec4', w: '#fff4e2', o: '#c8c8e0', b: '#8fb3ff', W: '#e8f4ff', y: '#fff27a', g: '#9be3b0', k: '#1a1030' });

  /* ---- The order screen ----------------------------------------------------- */
  let cr = load(), onServe = null, built = false;
  function load() {
    try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && Array.isArray(o.scoops)) return { holder: o.holder || 'cone', scoops: o.scoops.filter(flavor).slice(0, MAX), toppings: o.toppings || [] }; } catch (e) {}
    return { holder: 'cone', scoops: [], toppings: [] };
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cr)); } catch (e) {} };

  function swatch(f) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 12;
    scoop(c.getContext('2d'), f.look, 8, 6, 7, 5, 3, false);
    return c;
  }
  function chip(label, on, click, pic) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ic-chip' + (on ? ' on' : '');
    if (pic) b.append(pic);
    b.append(document.createTextNode(label));
    b.addEventListener('click', click);
    return b;
  }

  function name() {
    if (!cr.scoops.length) return P.emptyName || 'pick some scoops';
    const names = cr.scoops.map(id => flavor(id).name.toLowerCase());
    const counts = {};
    names.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
    const parts = Object.entries(counts).map(([n, k]) => (k > 1 ? `${k}x ` : '') + n);
    const holder = (HOLDERS.find(h => h.id === cr.holder) || {}).name || 'cone';
    const tops = (cr.toppings || []).map(t => (TOPPINGS.find(x => x.id === t) || {}).name).filter(Boolean);
    return `${parts.join(' + ')} in a ${holder}${tops.length ? ', with ' + tops.join(' and ') : ''}`;
  }

  let lastNote = '';
  function render() {
    const art = $('ic-art'), g = art.getContext('2d');
    g.imageSmoothingEnabled = false;
    drawCreation(g, cr, art.width, art.height);
    $('ic-name').textContent = name();
    $('ic-desc').textContent = lastNote;
    $('ic-count').textContent = `${cr.scoops.length}/${MAX}`;
    $('ic-holders').replaceChildren(...HOLDERS.map(h => chip(h.name, cr.holder === h.id, () => { cr.holder = h.id; save(); blip(); render(); })));
    $('ic-flavors').replaceChildren(...FLAVORS.map(f => chip(f.name, false, () => {
      if (cr.scoops.length >= MAX) { lastNote = P.fullNote || 'three is the limit. (i\'ll share mine.)'; return render(); }
      cr.scoops.push(f.id); lastNote = f.note || ''; save(); blip(); render();
    }, swatch(f))));
    $('ic-toppings').replaceChildren(...TOPPINGS.map(t => chip(t.name, cr.toppings.includes(t.id), () => {
      cr.toppings = cr.toppings.includes(t.id) ? cr.toppings.filter(x => x !== t.id) : cr.toppings.concat(t.id);
      save(); blip(); render();
    })));
    $('ic-undo').disabled = !cr.scoops.length;
    $('ic-serve').disabled = !cr.scoops.length;
  }
  const blip = () => window.AUDIO && window.AUDIO.sfx('blip');

  function build() {
    if (built) return;
    built = true;
    $('ic-title').textContent = P.title || 'the ice cream cart';
    $('ic-intro').textContent = P.intro || '';
    $('ic-undo').textContent = P.undoLabel || 'take one off';
    $('ic-serve').textContent = P.serveLabel || 'serve';
    $('ic-undo').addEventListener('click', () => { cr.scoops.pop(); lastNote = ''; save(); render(); });
    $('ic-serve').addEventListener('click', () => { if (cr.scoops.length && onServe) onServe({ ...cr, scoops: cr.scoops.slice(), toppings: cr.toppings.slice() }, name()); });
  }

  function open(serve) {
    onServe = serve;
    build();
    lastNote = '';
    render();
  }

  return { open, cart, drawHeld, drawCreation, FLAVORS, current: () => cr };
})();
