(() => {
  'use strict';
  const C = window.KAMY;
  const $ = id => document.getElementById(id);

  // behind the same passcode as the main page
  let passed = false;
  try { passed = !C.gate || JSON.parse(localStorage.getItem('kamy.gate') || 'null') === C.gate.hash; } catch (e) {}
  if (!passed) { location.replace('./'); return; }
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

  let sent = false;
  document.addEventListener('click', e => {
    if (e.target.id === 'send' || sent) return;
    if ($('send').classList.contains('hidden')) fast = true; // tap to skip ahead
  });

  $('send').addEventListener('click', async () => {
    sent = true; fast = false;
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
    if (callReady()) setTimeout(showCallButton, 1800);
  });

  /* ---- A call from the moon ----------------------------------------------- */
  /* Your recorded clips play with subtitles; between them she chooses what
     to say. A part with no choices ends the call. */
  const CALL = C.call || {};
  const real = s => (typeof s === 'string' && !s.includes('[REPLACE') ? s : '');
  const isLocal = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  // on the live site the call only appears once you've written its texts
  const callReady = () => !!(CALL.parts && CALL.start && (isLocal || Object.values(CALL.parts).some(p => real(p.text))));
  const shown = s => real(s) || (isLocal ? s : '');

  let ac = null, ringTimer = null, clip = null, callT0 = 0, clock = null;
  function beep(f, when, dur, vol = 0.05) {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(vol, ac.currentTime + when); g.gain.setValueAtTime(0, ac.currentTime + when + dur);
    o.connect(g); g.connect(ac.destination); o.start(ac.currentTime + when); o.stop(ac.currentTime + when + dur + 0.02);
  }
  const ring = () => { beep(880, 0, 0.12); beep(660, 0.15, 0.12); beep(880, 0.3, 0.12); beep(660, 0.45, 0.12); };

  function showCallButton() {
    $('call-btn').textContent = CALL.button || 'the moon is calling...';
    $('call-wrap').classList.remove('hidden');
    $('call-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // the caller picture: the same pixel moon
  const cm = $('call-moon').getContext('2d');
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
    if ((x - 7) ** 2 + (y - 7) ** 2 <= 49.5 && !((x - 10) ** 2 + (y - 5) ** 2 <= 36)) { cm.fillStyle = x < 4 ? '#f0dcb0' : '#fff3d6'; cm.fillRect(x, y, 1, 1); }
  }

  $('call-btn').addEventListener('click', () => {
    $('call').hidden = false;
    $('call-name').textContent = CALL.caller || 'the moon';
    $('call-status').textContent = 'incoming call...';
    $('call-sub').textContent = ''; $('call-sub').classList.remove('me');
    $('call-choices').replaceChildren();
    $('call-actions').hidden = false;
    ring(); ringTimer = setInterval(ring, 1600);
  });

  $('call-decline').addEventListener('click', () => {
    clearInterval(ringTimer);
    $('call').hidden = true;
    $('call-btn').textContent = 'call back';
  });

  $('call-accept').addEventListener('click', () => {
    clearInterval(ringTimer);
    $('call-actions').hidden = true;
    callT0 = Date.now();
    const tick = () => { const s = Math.floor((Date.now() - callT0) / 1000); $('call-status').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    tick(); clock = setInterval(tick, 1000);
    beep(1320, 0, 0.08, 0.04);
    setTimeout(() => speak(CALL.start), 700);
  });

  // plays one part of the call: the clip (if it exists) with its words as subtitles
  function speak(id) {
    const part = CALL.parts[id];
    if (!part) return hangUp();
    const sub = $('call-sub'), wave = $('call-wave'), text = shown(part.text);
    sub.classList.remove('me');
    sub.textContent = '';
    $('call-choices').replaceChildren();
    wave.classList.add('talking');
    let done = false, typing = null;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(typing);
      sub.textContent = text;
      wave.classList.remove('talking');
      setTimeout(() => offerChoices(part), 450);
    };
    // type the subtitle at the pace of the clip (or a gentle speaking pace without one)
    const typeAt = ms => { let i = 0; clearInterval(typing); typing = setInterval(() => { sub.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(typing); }, ms); };
    clip = part.audio ? new Audio(part.audio) : null;
    if (clip) {
      clip.addEventListener('loadedmetadata', () => typeAt(Math.max(25, (clip.duration * 1000 * 0.85) / Math.max(1, text.length))));
      clip.addEventListener('ended', finish);
      clip.addEventListener('error', () => { clip = null; typeAt(55); setTimeout(finish, text.length * 55 + 900); });
      clip.play().catch(() => { typeAt(55); setTimeout(finish, text.length * 55 + 900); });
    } else {
      typeAt(55);
      setTimeout(finish, text.length * 55 + 900);
    }
  }

  function offerChoices(part) {
    const box = $('call-choices');
    if (!part.choices || !part.choices.length) {
      const b = document.createElement('button');
      b.className = 'pixel-btn'; b.type = 'button'; b.textContent = 'hang up';
      b.addEventListener('click', hangUp);
      box.replaceChildren(b);
      return;
    }
    box.replaceChildren(...part.choices.map(ch => {
      const b = document.createElement('button');
      b.className = 'pixel-btn'; b.type = 'button'; b.textContent = ch.say;
      b.addEventListener('click', () => {
        box.replaceChildren();
        const sub = $('call-sub');
        sub.classList.add('me'); sub.textContent = ch.say; // what she said
        setTimeout(() => speak(ch.next), 1300);
      });
      return b;
    }));
  }

  function hangUp() {
    if (clip) { clip.pause(); clip = null; }
    clearInterval(clock);
    beep(440, 0, 0.1, 0.04); beep(330, 0.12, 0.15, 0.04);
    $('call-status').textContent = 'call ended · ' + $('call-status').textContent;
    $('call-wave').classList.remove('talking');
    setTimeout(() => { $('call').hidden = true; $('call-btn').textContent = 'call again'; }, 1400);
  }

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(play);
})();
