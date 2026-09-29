/* A small shared shell for the cozy minigames (paper planes, fireflies):
   a pixel canvas in a frame, an overlay screen for menus and notes, and
   pointer/keyboard input passed through to whichever game is open. */
window.MINI = (() => {
  'use strict';
  const A = window.AUDIO;
  const $ = id => document.getElementById(id);
  const root = $('mini'), frame = $('mini-frame'), cv = $('mini-canvas');
  const screen = $('mini-screen'), hud = $('mini-hud');
  const g = cv.getContext('2d');
  let game = null, raf = 0, last = 0, onClose = null, W = 160, H = 224;

  function fit() {
    const s = Math.min(window.innerWidth / W, (window.innerHeight * 0.94) / H);
    frame.style.width = W * s + 'px';
    frame.style.height = H * s + 'px';
  }

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const button = (text, fn) => {
    const b = el('button', 'pixel-btn', text);
    b.type = 'button';
    b.addEventListener('click', e => { e.stopPropagation(); A.sfx('blip'); fn(); });
    return b;
  };
  function show(parts, soft) { screen.replaceChildren(...parts); screen.classList.toggle('soft', !!soft); screen.hidden = false; }
  // a lighter overlay at the top, so the scene underneath stays visible
  const showSoft = parts => show(parts, true);
  function hideScreen() { screen.hidden = true; }
  function setHud(text) { hud.textContent = text || ''; }

  // types text into an element, a few characters at a time
  function typeInto(node, text, ms = 34) {
    let i = 0;
    const timer = setInterval(() => {
      if (!screen.contains(node)) return clearInterval(timer);
      node.textContent = text.slice(0, ++i);
      if (i % 3 === 0) A.sfx('type');
      if (i >= text.length) clearInterval(timer);
    }, ms);
  }

  const toLogical = e => {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  };

  function loop(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (game) { game.update(dt); game.render(g); }
    raf = requestAnimationFrame(loop);
  }

  const api = {
    g, el, button, show, showSoft, hideScreen, setHud, typeInto,
    get W() { return W; }, get H() { return H; },
    screenOpen: () => !screen.hidden,
    sfx: n => A.sfx(n),
    close: result => close(result)
  };

  function open(def, done) {
    if (game) return;
    game = def;
    W = def.W; H = def.H;
    cv.width = W; cv.height = H;
    g.imageSmoothingEnabled = false;
    onClose = done;
    root.hidden = false;
    fit();
    setHud('');
    screen.hidden = true;
    def.start(api);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function close(result) {
    if (!game) return;
    cancelAnimationFrame(raf);
    const def = game;
    game = null;
    root.hidden = true;
    if (def.stop) def.stop();
    A.sfx('close');
    if (onClose) onClose(result || {});
  }

  ['down', 'move', 'up', 'cancel'].forEach(type => {
    cv.addEventListener('pointer' + type, e => {
      if (!game || !game.pointer) return;
      if (type === 'down') { try { cv.setPointerCapture(e.pointerId); } catch (err) {} }
      game.pointer(type, toLogical(e), e);
    });
  });
  document.addEventListener('keydown', e => {
    if (!game) return;
    if (e.key === 'Escape') { e.preventDefault(); return close(); }
    if (screen.hidden && (e.key === ' ' || e.key.startsWith('Arrow'))) e.preventDefault();
    if (game.key) game.key('down', e.key);
  });
  document.addEventListener('keyup', e => { if (game && game.key) game.key('up', e.key); });
  $('mini-close').addEventListener('click', () => close());
  window.addEventListener('resize', () => { if (game) fit(); });

  return { open, close, get isOpen() { return !!game; } };
})();
