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
    if (e.target.closest && e.target.closest('#tabs, #tab-sorry')) return;
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
  // on the live site the call only appears once it has recordings or written lines
  const callReady = () => !!(CALL.parts && CALL.start && (isLocal || Object.values(CALL.parts).some(p => real(p.text) || p.audio)));
  const shown = s => real(s) || (isLocal ? s : '');

  let ac = null, ringTimer = null, clip = null, callT0 = 0, clock = null;
  let speaking = null, onCall = false; // the part being said right now (so voicemail can pause it)
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

  /* Your voice goes through a phone line: only the middle of the voice gets
     through (like a real call), a little grit and squash, and a faint hiss.
     Each clip is downloaded and decoded, then played straight into the line
     (this works the same on every browser, including iPhones). */
  let line = null;
  function phoneLine() {
    if (line) return line;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const input = ac.createGain();
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350; hp.Q.value = 0.8;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3300; lp.Q.value = 0.9;
      const mid = ac.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1600; mid.Q.value = 0.9; mid.gain.value = 5;
      const drive = ac.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 1023 * 2 - 1; curve[i] = Math.tanh(2 * x) / Math.tanh(2); }
      drive.curve = curve;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -26; comp.ratio.value = 4;
      const out = ac.createGain(); out.gain.value = 1.3;
      const meter = ac.createAnalyser(); meter.fftSize = 1024;
      input.connect(hp); hp.connect(lp); lp.connect(mid); mid.connect(drive); drive.connect(comp); comp.connect(out);
      out.connect(meter); out.connect(ac.destination);
      // faint line hiss
      const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const hiss = ac.createBufferSource(); hiss.buffer = buf; hiss.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.6;
      const hissGain = ac.createGain(); hissGain.gain.value = 0;
      hiss.connect(bp); bp.connect(hissGain); hissGain.connect(ac.destination); hiss.start();
      line = {
        input,
        hiss: on => hissGain.gain.setTargetAtTime(on ? 0.005 : 0, ac.currentTime, 0.2),
        // how loud the voice coming out is right now (0 = silent)
        level() { const a = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(a); let s = 0; for (const v of a) s += v * v; return Math.sqrt(s / a.length); }
      };
    } catch (e) {
      line = { input: null, hiss() {}, level: () => -1 };
    }
    return line;
  }
  window.__callLevel = () => (line ? line.level() : -1); // (used by the tests)

  // decoded clips, fetched once
  const decoded = {};
  function loadClip(url) {
    if (!decoded[url]) {
      decoded[url] = fetch(url)
        .then(r => { if (!r.ok) throw new Error('missing ' + url); return r.arrayBuffer(); })
        .then(data => new Promise((res, rej) => ac.decodeAudioData(data, res, rej)));
      decoded[url].catch(() => {});
    }
    return decoded[url];
  }

  // if Web Audio can't play a clip, fall back to a plain player (no phone effect)
  const plainEl = new Audio();
  let current = null; // the clip playing now

  $('call-accept').addEventListener('click', () => {
    clearInterval(ringTimer);
    $('call-actions').hidden = true;
    onCall = true;
    $('vm-btn').hidden = !voicemails.length;
    const ln = phoneLine();
    if (ac && ac.state !== 'running') ac.resume(); // her tap unlocks sound
    ln.hiss(true);
    plainEl.play().catch(() => {}); // unlocks the fallback player too
    if (ln.input) Object.values(CALL.parts).forEach(p => { if (p.audio) loadClip(p.audio); }); // start loading everything
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
    speaking = { id, cancel: () => { done = true; clearInterval(typing); wave.classList.remove('talking'); } };
    const finish = () => {
      if (done) return;
      done = true;
      speaking = null;
      clearInterval(typing);
      sub.textContent = text;
      wave.classList.remove('talking');
      setTimeout(() => offerChoices(part), 450);
    };
    // type the subtitle at the pace of the clip (or a gentle speaking pace without one)
    const typeAt = ms => { let i = 0; clearInterval(typing); typing = setInterval(() => { sub.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(typing); }, ms); };
    const paced = secs => typeAt(Math.max(25, (secs * 1000 * 0.85) / Math.max(1, text.length)));
    const textOnly = () => { typeAt(55); setTimeout(finish, text.length * 55 + 900); };
    // plain player: used only if the phone-line version can't play
    const plain = () => {
      plainEl.src = part.audio;
      plainEl.onloadedmetadata = () => paced(plainEl.duration);
      plainEl.onended = finish;
      plainEl.onerror = textOnly;
      current = { stop: () => { plainEl.onended = plainEl.onerror = null; plainEl.pause(); } };
      plainEl.play().catch(textOnly);
    };
    if (!part.audio) return textOnly();
    if (!line || !line.input) return plain();
    loadClip(part.audio).then(buf => {
      if (done || $('call').hidden) return;
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(line.input);
      src.onended = finish;
      current = { stop: () => { src.onended = null; try { src.stop(); } catch (e) {} } };
      src.start();
      paced(buf.duration);
    }).catch(plain);
  }

  /* Endings: each one she reaches is remembered on her device, so she can
     see how many of them she's found and call back for the others. */
  const ENDKEY = 'kamy.call.endings';
  const allEndings = [...new Set(Object.values(CALL.parts || {}).flatMap(p => [p.ending, ...(p.choices || []).map(c => c.ending)]).filter(Boolean))];
  const foundEndings = () => { try { return (JSON.parse(localStorage.getItem(ENDKEY)) || []).filter(e => allEndings.includes(e)); } catch (e) { return []; } };
  function endCard(name) {
    const found = foundEndings(), fresh = !found.includes(name);
    if (fresh) { found.push(name); try { localStorage.setItem(ENDKEY, JSON.stringify(found)); } catch (e) {} }
    const note = document.createElement('p');
    note.className = 'call-ending';
    note.textContent = `${fresh ? 'new ending' : 'ending'}: "${name}" · ${found.length}/${allEndings.length} found`;
    const b = document.createElement('button');
    b.className = 'pixel-btn'; b.type = 'button'; b.textContent = 'hang up';
    b.addEventListener('click', hangUp);
    $('call-choices').replaceChildren(note, b);
    if (fresh) { beep(1568, 0, 0.08, 0.03); beep(2093, 0.1, 0.12, 0.03); }
  }

  function offerChoices(part) {
    const box = $('call-choices');
    if (part.then) { setTimeout(() => speak(part.then), 350); return; } // keeps talking
    if ((!part.choices || !part.choices.length) && part.ending) return endCard(part.ending);
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
        if (!ch.next && ch.ending) { $('call-wave').classList.remove('talking'); setTimeout(() => endCard(ch.ending), 1100); return; }
        setTimeout(() => speak(ch.next), 1300);
      });
      return b;
    }));
  }

  function hangUp() {
    if (current) { current.stop(); current = null; }
    onCall = false; speaking = null;
    stopVoicemail(); $('vm').hidden = true; $('vm-btn').hidden = true;
    if (line) line.hiss(false);
    clearInterval(clock);
    beep(440, 0, 0.1, 0.04); beep(330, 0.12, 0.15, 0.04);
    $('call-status').textContent = 'call ended · ' + $('call-status').textContent;
    $('call-wave').classList.remove('talking');
    const n = foundEndings().length;
    setTimeout(() => { $('call').hidden = true; $('call-btn').textContent = n && allEndings.length ? `call again (${n}/${allEndings.length} endings)` : 'call again'; }, 1400);
  }

  /* ---- Voicemail (secret) ------------------------------------------------- */
  /* During the call, the faint icon in the corner (or the moon) opens the
     voicemails you left other people. The call pauses, and picks up again
     from the same line when she goes back. */
  const VM = C.voicemail || {};
  const voicemails = (VM.list || []).filter(v => v.audio || isLocal);
  const vmIcon = $('vm-btn').querySelector('canvas').getContext('2d');
  vmIcon.fillStyle = '#fff3d6';
  [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [1, 3], [2, 3], [5, 0], [6, 0], [4, 1], [7, 1], [4, 2], [7, 2], [5, 3], [6, 3], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]]
    .forEach(([x, y]) => vmIcon.fillRect(x, y, 1, 1));   // the little "oo" voicemail sign
  $('vm-title').textContent = VM.title || 'voicemail';
  $('vm-intro').textContent = VM.intro || '';

  let vmNow = null, resumeId = null;
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  function openVoicemail() {
    if (!onCall || !voicemails.length || !$('vm').hidden) return;
    // pause whatever he's saying; that line starts over when she comes back
    if (speaking) { resumeId = speaking.id; if (current) { current.stop(); current = null; } speaking.cancel(); speaking = null; }
    $('vm-sub').textContent = '';
    $('vm-list').replaceChildren(...voicemails.map(v => {
      const row = document.createElement('button');
      row.type = 'button'; row.className = 'vm-row' + (v.audio ? '' : ' missing');
      const play = document.createElement('span'); play.className = 'play';
      const name = document.createElement('span');
      name.textContent = v.name;
      if (v.tag) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = ' · ' + v.tag; name.append(t); }
      const len = document.createElement('span'); len.className = 'len'; len.textContent = v.audio ? '' : 'no message yet';
      const bar = document.createElement('span'); bar.className = 'bar'; bar.append(document.createElement('i'));
      row.append(play, name, len, bar);
      row.addEventListener('click', () => playVoicemail(v, row));
      if (v.audio && line && line.input) loadClip(v.audio).then(b => { len.textContent = fmt(b.duration); }).catch(() => {});
      return row;
    }));
    $('vm').hidden = false;
    beep(1180, 0, 0.06, 0.03);
  }

  function stopVoicemail() {
    if (!vmNow) return;
    vmNow.stop();
    vmNow.row.classList.remove('playing');
    vmNow = null;
  }

  function playVoicemail(v, row) {
    const same = vmNow && vmNow.v === v;
    stopVoicemail();
    if (same || !v.audio) return;
    const sub = $('vm-sub'), words = v.translation || v.transcript || '';
    const fill = row.querySelector('.bar i');
    sub.textContent = '';
    row.classList.add('playing');
    let raf = 0, stopped = false;
    const show = k => { fill.style.width = (Math.min(1, k) * 100) + '%'; if (words) sub.textContent = words.slice(0, Math.ceil(words.length * Math.min(1, k * 1.15))); };
    const end = () => { if (stopped) return; show(1); stopVoicemail(); };
    const me = vmNow = { v, row, stop: () => { stopped = true; cancelAnimationFrame(raf); } };
    const plain = () => {
      if (me !== vmNow) return;
      plainEl.src = v.audio;
      plainEl.onended = end;
      plainEl.onerror = end;
      const tick = () => { if (plainEl.duration) show(plainEl.currentTime / plainEl.duration); raf = requestAnimationFrame(tick); };
      me.stop = () => { stopped = true; cancelAnimationFrame(raf); plainEl.onended = plainEl.onerror = null; plainEl.pause(); };
      plainEl.play().then(tick).catch(end);
    };
    beep(1000, 0, 0.3, 0.035);   // the voicemail beep
    if (!line || !line.input) { setTimeout(plain, 380); return; }
    loadClip(v.audio).then(buf => {
      if (me !== vmNow) return;
      setTimeout(() => {
        if (me !== vmNow) return;
        const src = ac.createBufferSource();
        src.buffer = buf; src.connect(line.input); src.onended = end;
        const t0 = ac.currentTime;
        src.start();
        const tick = () => { show((ac.currentTime - t0) / buf.duration); raf = requestAnimationFrame(tick); };
        tick();
        me.stop = () => { stopped = true; cancelAnimationFrame(raf); src.onended = null; try { src.stop(); } catch (e) {} };
      }, 380);
    }).catch(plain);
  }

  $('vm-btn').addEventListener('click', openVoicemail);
  $('call-moon').addEventListener('click', openVoicemail);
  $('vm-back').addEventListener('click', () => {
    stopVoicemail();
    $('vm').hidden = true;
    beep(880, 0, 0.06, 0.03);
    if (resumeId) { const id = resumeId; resumeId = null; setTimeout(() => speak(id), 400); }
  });
  window.__endings = () => ({ all: allEndings, found: foundEndings() }); // (tests)
  window.__vm = { open: openVoicemail, state: () => ({ open: !$('vm').hidden, playing: vmNow && vmNow.v.name, resumeId, speaking: speaking && speaking.id }) }; // (tests)

  /* ---- The "i'm sorry" tab ------------------------------------------------ */
  const SR = C.sorryTexts || {};
  const sorryMsgs = (SR.messages || []).map(parse);
  let sorryStarted = false, sorryFast = false;
  if (sorryMsgs.length) {
    $('tabs').hidden = false;
    const [tUnsent, tSorry] = $('tabs').querySelectorAll('.tab');
    tUnsent.textContent = SR.firstTab || 'unsent';
    tSorry.textContent = SR.tab || "i'm sorry";
    let opened = false;
    try { opened = localStorage.getItem('kamy.sorrytab') === '1'; } catch (e) {}
    if (!opened) tSorry.classList.add('new');
    $('tabs').addEventListener('click', e => {
      const b = e.target.closest('.tab');
      if (!b) return;
      for (const t of $('tabs').querySelectorAll('.tab')) t.classList.toggle('on', t === b);
      const which = b.dataset.tab;
      $('tab-unsent').hidden = which !== 'unsent';
      $('tab-sorry').hidden = which !== 'sorry';
      if (which === 'sorry') {
        b.classList.remove('new');
        try { localStorage.setItem('kamy.sorrytab', '1'); } catch (e) {}
        if (!sorryStarted) playSorry();
      }
    });
    $('tab-sorry').addEventListener('click', e => { if (e.target.id !== 'sorry-send' && e.target.id !== 'sorry-letter') sorryFast = true; });
  }

  async function playSorry() {
    sorryStarted = true;
    $('sorry-intro').textContent = SR.intro || '';
    const box = $('sorry-thread'), nodes2 = [];
    const nap = ms => new Promise(r => setTimeout(r, sorryFast ? 0 : ms));
    await nap(600);
    for (const s of sorryMsgs) {
      const msg = document.createElement('div'); msg.className = 'msg';
      const bubble = document.createElement('div'); bubble.className = 'bubble';
      const status = document.createElement('div'); status.className = 'status';
      msg.append(bubble, status);
      box.appendChild(msg);
      nodes2.push({ msg, bubble, status });
      if (!sorryFast) msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // typed slowly, letter by letter
      const caret = document.createElement('span'); caret.className = 'caret';
      const typed = document.createTextNode('');
      bubble.append(typed, caret);
      for (let i = 1; i <= s.text.length && !sorryFast; i++) {
        typed.nodeValue = s.text.slice(0, i);
        await nap(80 + (/[,.?!]/.test(s.text[i - 1]) ? 200 : 0));
      }
      bubble.textContent = s.text;
      await nap(800);
      msg.classList.add('ghost');
      status.textContent = s.status;
      status.classList.add('show');
      await nap(1000);
    }
    sorryFast = false;
    const send = $('sorry-send');
    send.textContent = SR.sendButton || 'send them';
    send.classList.remove('hidden');
    send.onclick = async () => {
      send.classList.add('hidden');
      for (const n of nodes2) {
        n.msg.classList.remove('ghost');
        n.msg.classList.add('delivered');
        n.status.textContent = 'delivered';
        n.msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(r => setTimeout(r, 450));
      }
      await new Promise(r => setTimeout(r, 600));
      const out = $('sorry-outro');
      out.textContent = SR.outro || '';
      out.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (C.sorry && C.sorry.body) {
        $('sorry-letter').textContent = SR.letterLink || 'read my letter again';
        setTimeout(() => $('sorry-letter-wrap').classList.remove('hidden'), 900);
      }
    };
  }

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(play);
})();
