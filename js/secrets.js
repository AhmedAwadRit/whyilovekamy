(() => {
  'use strict';
  const C = window.KAMY;
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, fast ? 0 : ms));
  let fast = false;

  /* ---- Pixel sky + moon ------------------------------------------------ */
  const sky = $('sky'), sg = sky.getContext('2d');
  let stars = [];
  function sizeSky() {
    const s = 4;
    sky.width = Math.ceil(innerWidth / s); sky.height = Math.ceil(innerHeight / s);
    stars = Array.from({ length: Math.round(sky.width * sky.height / 70) }, () => ({
      x: Math.floor(Math.random() * sky.width), y: Math.floor(Math.random() * sky.height),
      p: Math.random() * 10, s: 0.5 + Math.random() * 1.5
    }));
  }
  const LV = ['#16183f', '#2e3170', '#6a6fb8', '#cfd2ff'];
  function drawSky(t) {
    sg.fillStyle = '#05061a';
    sg.fillRect(0, 0, sky.width, sky.height);
    for (const st of stars) {
      const v = Math.sin(t / 1000 * st.s + st.p);
      sg.fillStyle = LV[v > 0.85 ? 3 : v > 0.3 ? 2 : v > -0.4 ? 1 : 0];
      sg.fillRect(st.x, st.y, 1, 1);
    }
    requestAnimationFrame(drawSky);
  }
  addEventListener('resize', sizeSky);
  sizeSky();
  requestAnimationFrame(drawSky);

  const mg = $('moon').getContext('2d');
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
    const inMoon = (x - 7) ** 2 + (y - 7) ** 2 <= 49.5;
    const inBite = (x - 10) ** 2 + (y - 5) ** 2 <= 36;
    if (inMoon && !inBite) { mg.fillStyle = x < 4 ? '#f0dcb0' : '#fff3d6'; mg.fillRect(x, y, 1, 1); }
  }

  /* ---- Messages -------------------------------------------------------- */
  const parse = s => {
    if (typeof s !== 'string') return s;
    const m = s.match(/^(.*?)\s+[-–—]\s+([^-–—]+)$/);
    return m ? { text: m[1], status: m[2] } : { text: s, status: 'unsent' };
  };
  const secrets = (C.secrets || []).map(parse);
  $('intro').textContent = C.secretsIntro || '';
  $('send').textContent = C.secretsSendButton || 'send them anyway?';

  const thread = $('thread');
  const nodes = [];

  async function typeInto(el, text, speed) {
    const caret = document.createElement('span');
    caret.className = 'caret';
    const typed = document.createTextNode('');
    el.textContent = '';
    el.append(typed, caret);
    for (let i = 1; i <= text.length && !fast; i++) {
      typed.nodeValue = text.slice(0, i);
      await sleep(speed + (/[,.?!]/.test(text[i - 1]) ? 180 : 0));
    }
    el.textContent = text;
  }

  async function play() {
    await sleep(900);
    for (const s of secrets) {
      const msg = document.createElement('div');
      msg.className = 'msg';
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      const status = document.createElement('div');
      status.className = 'status';
      msg.append(bubble, status);
      thread.appendChild(msg);
      nodes.push({ msg, bubble, status, s });
      if (!fast) msg.scrollIntoView({ behavior: 'smooth', block: 'center' });

      await typeInto(bubble, s.text, 70);
      await sleep(900);
      msg.classList.add('ghost');
      if (/delet/i.test(s.status)) bubble.classList.add('struck');
      status.textContent = s.status;
      status.classList.add('show');
      await sleep(1100);
    }
    fast = false;
    $('skip').classList.add('hidden');
    await sleep(600);
    $('send').classList.remove('hidden');
  }

  document.addEventListener('click', e => {
    if (e.target.id === 'send') return;
    if ($('send').classList.contains('hidden')) fast = true;
  });

  $('send').addEventListener('click', async () => {
    $('send').classList.add('hidden');
    for (const n of nodes) {
      n.msg.classList.remove('ghost');
      n.bubble.classList.remove('struck');
      n.msg.classList.add('delivered');
      n.status.textContent = 'delivered';
      n.msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(420);
    }
    await sleep(700);
    const outro = $('outro');
    await typeInto(outro, C.secretsOutro || '', 60);
    outro.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(play);
})();
