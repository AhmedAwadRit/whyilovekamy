/* Pixel-art sprites, defined as text grids. Each character maps to a colour
   in the palette passed alongside it; "." (or any unmapped char) is empty. */
window.SPRITES = (() => {
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function make(rows, pal) {
    const h = rows.length;
    const w = Math.max(...rows.map(r => r.length));
    const c = canvas(w, h);
    const g = c.getContext('2d');
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = pal[row[x]];
        if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
      }
    });
    return c;
  }

  /* A 1px outline around every opaque pixel, used for hover highlights. */
  function outline(sprite, color) {
    const w = sprite.width, h = sprite.height;
    const src = sprite.getContext('2d').getImageData(0, 0, w, h).data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
    const c = canvas(w + 2, h + 2);
    const g = c.getContext('2d');
    g.fillStyle = color;
    for (let y = -1; y <= h; y++) {
      for (let x = -1; x <= w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
          g.fillRect(x + 1, y + 1, 1, 1);
        }
      }
    }
    g.drawImage(sprite, 1, 1);
    return c;
  }

  const OUT = '#1a1030';

  const headphones = make([
    '....oooooooo....',
    '..oobhhhhhbboo..',
    '.obbooooooooBbo.',
    '.obo........oBo.',
    'obo..........oBo',
    'obo..........obo',
    'ooooo......ooooo',
    'ochCCo....ochCCo',
    'ochcCo....ochcCo',
    'occcCo....occcCo',
    'occcCo....occcCo',
    '.oooo......oooo.'
  ], { o: OUT, b: '#f5b6cf', h: '#ffe3ee', B: '#c9829f', c: '#ff7aa8', C: '#c4507e' });

  const envelope = make([
    'ooooooooooooooooo',
    'oslwwwwwwwwwwwlso',
    'owslwwwwwwwwwlswo',
    'owwslwwwwwwwlswwo',
    'owwwslrrwrrlswwwo',
    'owwwwsrhrrrswwwwo',
    'owwwwwsrrrswwwwwo',
    'owwwwwwsrswwwwwwo',
    'owwwwwwwswwwwwwwo',
    'owwwwwwwwwwwwwwwo',
    'ossssssssssssssso',
    'ooooooooooooooooo'
  ], { o: OUT, w: '#fbeedd', s: '#e3cdb4', l: '#c9ab8f', r: '#ff5c8a', h: '#ffc2d4' });

  const camera = make([
    '..oooo.....ooo..',
    '.odddo.....oro..',
    'oooooooooooooooo',
    'odddddoooooddffo',
    'obbbboLLLLLobbbo',
    'obbboLgghggLobbo',
    'obbboLghgggLobbo',
    'obbboLgggggLobbo',
    'obbboLgggggLobbo',
    'obbbboLLLLLobbbo',
    'oddddddddddddddo',
    'oooooooooooooooo'
  ], { o: OUT, d: '#7a6a9e', b: '#e8e0f0', L: '#3a2b55', g: '#6ec6ff', h: '#e6f7ff', r: '#ff6f7d', f: '#fff6c2' });

  const tape = make([
    'oooooooooooooooo',
    'obbbbbbbbbbbbbbo',
    'obwwwwwwwwwwwwbo',
    'obwllllllllllwbo',
    'obwwwwwwwwwwwwbo',
    'obwkrkwwwwkrkwbo',
    'obwrkrwwwwrkrwbo',
    'obwkrkwwwwkrkwbo',
    'obwwwwwwwwwwwwbo',
    'obbbbkkkkkkbbbbo',
    'oooooooooooooooo'
  ], { o: OUT, b: '#5b4f9a', w: '#fff4e2', l: '#ff9ec4', k: '#2a2150', r: '#d8d0f0' });

  const seeds = make([
    '.oooooooooo.',
    'okkkkkkkkkko',
    'oKKKKKKKKKKo',
    'okwwwwwwwwko',
    'okwwwpwwwwko',
    'okwwpcpwwwko',
    'okwwwpwwwwko',
    'okwwwgwwwwko',
    'okwwggwwwwko',
    'okwwwwwwwwko',
    'okkkkkkkkkko',
    '.oooooooooo.'
  ], { o: OUT, k: '#d9a86c', K: '#b7834c', w: '#fff4e2', p: '#ff9ec4', c: '#ffe38a', g: '#46945c' });

  /* Two friends sitting on the hill, seen from behind, looking at the sky. */
  // Their bodies are 15x9; each frame is 20x13 so there's room for an arm
  // raised toward the sky. The bodies sit in the bottom-left of the frame.
  const FRIENDS = [
    '..kkk.....kkk..',
    '.kkkkm...kkkkm.',
    '.kkkkm...kkkkm.',
    '..kkm....kkkkm.',
    '.kkkkk..kkkkkm.',
    'kkkkkkm.kkkkkkm',
    'kkkkkkm.kkkkkkm',
    'kkkkkkmkkkkkkkm',
    'kkkkkkkkkkkkkkk'
  ];
  function friendsFrame(point, lean) {
    const grid = Array.from({ length: 13 }, () => Array(20).fill('.'));
    FRIENDS.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') grid[y + 4][x] = ch; }));
    if (lean) { // the one on the left tips her head toward the other
      const head = [];
      for (let y = 4; y < 8; y++) for (let x = 0; x < 7; x++) if (grid[y][x] !== '.') { head.push([x, y, grid[y][x]]); grid[y][x] = '.'; }
      head.forEach(([x, y, c]) => { grid[y + 1][x + 1] = c; });
    }
    if (point) { // the one on the right points up at a star
      [[15, 8, 'k'], [16, 7, 'k'], [17, 6, 'k'], [18, 5, 'k'], [19, 4, 'k'],
       [16, 8, 'm'], [17, 7, 'm'], [18, 6, 'm'], [19, 5, 'm']].forEach(([x, y, c]) => { grid[y][x] = c; });
    }
    return make(grid.map(r => r.join('')), { k: '#080a20', m: '#4a4f9a' });
  }
  const FRIEND_PAL = { k: '#080a20', m: '#4a4f9a' };
  const friends = {
    bodyW: 15, bodyH: 9,
    base: friendsFrame(false, false),
    point: friendsFrame(true, false),
    both: friendsFrame(true, true),
    // each of them on their own, for the tickle scene:
    // left = him (short hair), right = her (hair down to her shoulders)
    left: make(FRIENDS.map(r => r.slice(0, 7)), FRIEND_PAL),
    right: make(FRIENDS.map(r => r.slice(7)), FRIEND_PAL)
  };

  // her notebook, lying on the grass next to them
  const book = make(['pppppp', 'pwwwww', 'pppppp', '..r...'], { p: '#ff9ec4', w: '#fff4e2', r: '#ff5c8a' });
  // the little "angry" mark
  const anger = make(['.r.r.', 'rr.rr', '.....', 'rr.rr', '.r.r.'], { r: '#ff5c5c' });

  const pineappleTiny = make(['g.g', '.g.', 'yoy', 'oyo', 'yoy'], { g: '#4caf50', y: '#ffd23f', o: '#c98a1b' });

  const heart = make([
    '.rr.rr.',
    'rhrrrrr',
    'rrrrrrr',
    '.rrrrr.',
    '..rrr..',
    '...r...'
  ], { r: '#ff5c8a', h: '#ffc2d4' });

  const smallHeart = make([
    'r.r',
    'rrr',
    '.r.'
  ], { r: '#ff7aa8' });

  const speakerOn = make([
    '...w.....',
    '..ww..w..',
    'wwww...w.',
    'wwww.w.w.',
    'wwww...w.',
    '..ww..w..',
    '...w.....'
  ], { w: '#fff3d6' });

  const speakerOff = make([
    '...w.....',
    '..ww.....',
    'wwww.w.w.',
    'wwww..w..',
    'wwww.w.w.',
    '..ww.....',
    '...w.....'
  ], { w: '#fff3d6' });

  /* Glowing "reason" stars: two frames that alternate to sparkle. */
  const starPal = { W: '#ffffff', Y: '#ffe7a0', y: '#b89a55' };
  const readPal = { W: '#ffffff', Y: '#ffb3cf', y: '#a55f84' };
  const starA = ['..y..', '..Y..', 'yYWYy', '..Y..', '..y..'];
  const starB = ['y...y', '.Y.Y.', '..W..', '.Y.Y.', 'y...y'];
  const star = [make(starA, starPal), make(starB, starPal)];
  const starRead = [make(starA, readPal), make(starB, readPal)];
  const lockedPal = { W: '#ffffff', Y: '#d9b8ff', y: '#8d6fc4' };
  const starLocked = [make(starA, lockedPal), make(starB, lockedPal)];

  /* ---- Flowers --------------------------------------------------------- */
  const HEADS = [
    ['.p.', 'pcp', '.p.'],                              // tiny daisy
    ['..p..', '.ppp.', 'ppcpp', '.ppp.', '..p..'],      // big daisy
    ['p.p.p', 'ppppp', 'ppppp', '.ppp.'],               // tulip
    ['.pp.', 'pppp', 'p..p'],                           // bell
    ['.pp.', 'phdp', 'pddp', '.pp.'],                   // rose
    ['p.p', '.c.', 'p.p']                               // star flower
  ];
  const COLORS = [
    { p: '#ff9ec4', d: '#d86a9a', c: '#ffe38a', h: '#ffd6e6' }, // pink
    { p: '#c3a6ff', d: '#8e6fd6', c: '#fff1a8', h: '#e6dbff' }, // lavender
    { p: '#f4f1ff', d: '#c8c3e6', c: '#ffd36b', h: '#ffffff' }, // white
    { p: '#ffe27a', d: '#d6a93f', c: '#ff9a5c', h: '#fff4c2' }, // butter
    { p: '#ff8f7a', d: '#cf5c52', c: '#ffe0a0', h: '#ffc9bd' }, // coral
    { p: '#9fd4ff', d: '#5f9ad6', c: '#fff7c2', h: '#dff1ff' }  // sky
  ];
  const RARE_HEAD = ['.rr.rr.', 'rhrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
  const RARE_PAL = { r: '#ff4f7e', h: '#ffc2d4' };
  const STEM = '#2f6e45';
  const LEAF = '#46945c';

  /* Build both sway frames for one flower. Returns {frames, ax, ay} where
     (ax, ay) is the stem base inside the sprite. */
  function flower(f) {
    const head = f.rare ? make(RARE_HEAD, RARE_PAL) : make(HEADS[f.head], COLORS[f.color]);
    const hw = head.width, hh = head.height;
    const width = hw + 4, height = hh + f.stemH;
    const ax = Math.floor(width / 2), ay = height - 1;
    const frames = [0, 1].map(sway => {
      const c = canvas(width, height);
      const g = c.getContext('2d');
      g.fillStyle = STEM;
      for (let k = 0; k < f.stemH; k++) {
        const dx = sway && k >= f.stemH / 2 ? 1 : 0;
        g.fillRect(ax + dx, ay - k, 1, 1);
      }
      g.fillStyle = LEAF;
      g.fillRect(ax + f.leafSide, ay - f.leafY, 1, 1);
      if (f.stemH > 5) g.fillRect(ax + f.leafSide * 2, ay - f.leafY - 1, 1, 1);
      g.drawImage(head, ax - Math.floor(hw / 2) + sway, ay - f.stemH - hh + 1);
      return c;
    });
    return { frames, ax, ay, headH: hh };
  }

  return {
    canvas, make, outline, flower,
    headphones, envelope, camera, seeds, tape, friends, pineappleTiny, book, anger, heart, smallHeart,
    speakerOn, speakerOff, star, starRead, starLocked,
    HEAD_COUNT: HEADS.length, COLOR_COUNT: COLORS.length,
    COLORS
  };
})();
