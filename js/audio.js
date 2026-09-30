/* Background music + 8-bit sound effects.
   Plays the song file from content.js; if it's missing, falls back to a
   gentle chiptune "Twinkle Twinkle Little Star" generated in the browser.
   The minigame swaps in its own battle theme while it's open. */
window.AUDIO = (() => {
  const el = document.getElementById('bgm');
  let ac = null, master = null, chipBus = null, sfxBus = null;
  let started = false, muted = false, paused = false, usingChip = false;
  // override replaces the normal music: 'battle' (snack attack), 'lullaby',
  // 'rain' or 'quiet' (the blanket fort), or null for the usual song
  let override = null;
  let targetVol = 0.45, fadeTimer = null, chip = null, holdUntil = 0;

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.connect(ac.destination);
      chipBus = ac.createGain();
      chipBus.gain.value = 0;
      chipBus.connect(master);
      sfxBus = ac.createGain();
      sfxBus.gain.value = 0.6;
      sfxBus.connect(master);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  /* ---- Song file -------------------------------------------------------- */
  function fadeEl(to, ms = 1500) {
    clearInterval(fadeTimer);
    const from = el.volume, steps = 30;
    let i = 0;
    fadeTimer = setInterval(() => {
      i++;
      el.volume = Math.max(0, Math.min(1, from + (to - from) * (i / steps)));
      if (i >= steps) clearInterval(fadeTimer);
    }, ms / steps);
  }

  // delay: seconds of quiet first (her entrance tune plays in that gap).
  // play() still happens right away, inside the tap, so phones allow it.
  function start(song, delay = 0) {
    if (started) return;
    started = true;
    ctx();
    holdUntil = ac ? ac.currentTime + delay : 0;
    targetVol = song && song.volume != null ? song.volume : 0.45;
    if (!song || !song.src) return startChip();
    el.addEventListener('error', startChip, { once: true });
    el.src = song.src;
    el.volume = 0;
    el.muted = muted;
    el.play().then(() => {
      if (override || paused) el.pause();
      else setTimeout(() => { if (!override && !paused) fadeEl(targetVol); }, delay * 1000);
    }).catch(startChip);
  }

  /* ---- Chiptune tracks -------------------------------------------------- */
  // Each event: beat offset, midi note, length in beats, voice.
  function lullaby() {
    const ev = [];
    const A = [[72,1],[72,1],[79,1],[79,1],[81,1],[81,1],[79,2],[77,1],[77,1],[76,1],[76,1],[74,1],[74,1],[72,2]];
    const B = [[79,1],[79,1],[77,1],[77,1],[76,1],[76,1],[74,2],[79,1],[79,1],[77,1],[77,1],[76,1],[76,1],[74,2]];
    const chordsA = [48,48,53,48,53,48,55,48];
    const chordsB = [48,53,48,55,48,53,48,55];
    let b = 0;
    [[A, chordsA], [B, chordsB], [A, chordsA]].forEach(([mel, chords]) => {
      let t = b;
      mel.forEach(([m, d]) => { ev.push({ b: t, m, d, v: 'soft' }); t += d; });
      chords.forEach((root, i) => {
        [0, 7, 16, 7].forEach((iv, j) => ev.push({ b: b + i * 2 + j * 0.5, m: root + iv, d: 0.5, v: 'bass' }));
      });
      b += 16;
    });
    ev.loop = b;
    return ev;
  }

  function battle() {
    const ev = [];
    const bars = [
      [45, [[76,.5],[81,.5],[84,.5],[83,.5],[81,1],[76,1]]],
      [41, [[77,.5],[81,.5],[84,.5],[81,.5],[77,1],[72,1]]],
      [48, [[79,.5],[76,.5],[79,.5],[84,.5],[83,1],[79,1]]],
      [43, [[74,.5],[79,.5],[83,.5],[86,.5],[83,2]]]
    ];
    let b = 0;
    for (let rep = 0; rep < 2; rep++) {
      bars.forEach(([root, mel]) => {
        for (let i = 0; i < 8; i++) ev.push({ b: b + i * 0.5, m: root + (i % 2 ? 12 : 0), d: 0.45, v: 'bass' });
        let t = b;
        mel.forEach(([m, d]) => { ev.push({ b: t, m: rep ? m : m - 12, d, v: 'lead' }); t += d; });
        b += 4;
      });
    }
    ev.loop = b;
    return ev;
  }

  const TRACKS = { lullaby: { bpm: 74, events: lullaby() }, battle: { bpm: 148, events: battle() } };
  TRACKS.lullaby.events.sort((x, y) => x.b - y.b);
  TRACKS.battle.events.sort((x, y) => x.b - y.b);

  const freq = m => 440 * Math.pow(2, (m - 69) / 12);

  function note(type, f, when, dur, vol, dest) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(dest);
    o.start(when); o.stop(when + dur + 0.05);
  }

  function chipNodes() {
    if (chip || !ctx()) return chip;
    const dry = ac.createGain(), delay = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain();
    fb.gain.value = 0.28; wet.gain.value = 0.35;
    dry.connect(chipBus);
    dry.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(chipBus);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    lp.connect(dry);
    chip = { dry, lp, delay, wet, track: null, idx: 0, loopStart: 0 };
    setInterval(schedule, 50);
    return chip;
  }

  function setTrack(name) {
    if (!chipNodes()) return;
    chip.track = name ? TRACKS[name] : null;
    chip.idx = 0;
    chip.loopStart = ac.currentTime + 0.15;
    if (chip.track) {
      const beat = 60 / chip.track.bpm;
      chip.delay.delayTime.value = beat * 0.75;
      chip.wet.gain.value = name === 'battle' ? 0.12 : 0.35;
    }
  }

  function schedule() {
    const tr = chip.track;
    if (!tr) return;
    const beat = 60 / tr.bpm, ev = tr.events, horizon = ac.currentTime + 0.3;
    for (;;) {
      const e = ev[chip.idx];
      const when = chip.loopStart + e.b * beat;
      if (when > horizon) break;
      if (when > ac.currentTime - 0.05) {
        if (e.v === 'soft') note('triangle', freq(e.m), when, e.d * beat * 0.95, 0.32, chip.dry);
        else if (e.v === 'lead') note('square', freq(e.m), when, e.d * beat * 0.9, 0.07, chip.dry);
        else note('square', freq(e.m), when, e.d * beat * 0.9, 0.05, chip.lp);
      }
      chip.idx++;
      if (chip.idx >= ev.length) { chip.idx = 0; chip.loopStart += ev.loop * beat; }
    }
  }

  function startChip() {
    if (usingChip) return;
    usingChip = true;
    el.pause();
    setTrack(trackFor());
    apply();
  }

  // which chiptune (if any) should be playing right now
  function trackFor() {
    if (override === 'battle') return 'battle';
    if (override === 'lullaby') return 'lullaby';
    if (!override && usingChip) return 'lullaby';
    return null;
  }

  /* ---- Controls --------------------------------------------------------- */
  function apply() {
    if (!ac) return;
    master.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.05);
    const chipLive = !!trackFor() && !paused && !muted;
    chipBus.gain.setTargetAtTime(chipLive ? targetVol * (override === 'battle' ? 0.8 : 1) : 0,
      Math.max(ac.currentTime, holdUntil), override === 'battle' ? 0.1 : 0.4);
    if (rainGain) rainGain.gain.setTargetAtTime(override === 'rain' && !paused ? 0.1 : 0, ac.currentTime, 0.4);
    if (!usingChip && started) {
      el.muted = muted;
      if (paused || override) el.pause();
      else el.play().catch(() => {});
    }
  }

  function setMuted(m) { muted = m; apply(); }
  function setPaused(p) { paused = p; if (!p) ctx(); apply(); }

  function setOverride(mode) {
    if (mode === override) return;
    override = mode || null;
    if (!ctx()) return;
    if (override === 'rain') rainBed();
    setTrack(trackFor());
    apply();
  }
  /* The minigame's battle theme replaces the song while it's open. */
  const setGame = on => setOverride(on ? 'battle' : null);

  // soft rain: filtered noise (built once, faded in and out)
  let rainGain = null;
  function rainBed() {
    if (rainGain) return;
    const len = ac.sampleRate * 3, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = last; }
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250;
    rainGain = ac.createGain(); rainGain.gain.value = 0;
    src.connect(hp); hp.connect(lp); lp.connect(rainGain); rainGain.connect(master);
    src.start();
  }

  /* A short melody (midi notes; null = rest). Returns its length in seconds. */
  function playNotes(notes, bpm = 150) {
    if (!ctx() || muted) return 0;
    const beat = 60 / bpm;
    let t = ac.currentTime + 0.05;
    notes.forEach(m => {
      if (m != null) {
        note('triangle', freq(m), t, beat * 0.95, 0.3, sfxBus);
        note('square', freq(m + 12), t, beat * 0.5, 0.025, sfxBus);
      }
      t += beat;
    });
    return notes.length * beat;
  }

  /* ---- Cassette deck ---------------------------------------------------- */
  /* Routes an <audio> element through a tape-style chain:
     band-limited + slightly boxy, soft saturation, wow & flutter (pitch
     wobble from a modulated delay), and a bed of tape hiss. */
  let deck = null;
  function softClip(k) {
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
    return curve;
  }
  function tapeDeck(mediaEl) {
    if (deck) return deck;
    if (!ctx()) return null;
    const src = ac.createMediaElementSource(mediaEl);
    // Kept gentle on purpose: it should feel like a tape, but her hearing
    // your voice clearly matters more than the effect.
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 100;
    const body = ac.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 1100; body.Q.value = 0.8; body.gain.value = 1.5;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; lp.Q.value = 0.5;
    const drive = ac.createWaveShaper(); drive.curve = softClip(1.1); drive.oversample = '2x';
    const pre = ac.createGain(); pre.gain.value = 1.0;
    const out = ac.createGain(); out.gain.value = 1.0;

    // wow (slow) + flutter (fast) wobble the pitch via a modulated delay
    const wobble = ac.createDelay(0.1); wobble.delayTime.value = 0.015;
    const wow = ac.createOscillator(), wowAmt = ac.createGain();
    wow.frequency.value = 0.5; wowAmt.gain.value = 0.0005;
    const flutter = ac.createOscillator(), flAmt = ac.createGain();
    flutter.frequency.value = 7; flAmt.gain.value = 0.00003;
    wow.connect(wowAmt); wowAmt.connect(wobble.delayTime);
    flutter.connect(flAmt); flAmt.connect(wobble.delayTime);
    wow.start(); flutter.start();

    src.connect(hp); hp.connect(body); body.connect(pre); pre.connect(drive); drive.connect(lp);
    lp.connect(wobble); wobble.connect(out); out.connect(master);

    // tape hiss: filtered noise, faded in/out with the transport
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const hiss = ac.createBufferSource(); hiss.buffer = buf; hiss.loop = true;
    const hissHp = ac.createBiquadFilter(); hissHp.type = 'highpass'; hissHp.frequency.value = 2200;
    const hissLp = ac.createBiquadFilter(); hissLp.type = 'lowpass'; hissLp.frequency.value = 9000;
    const hissGain = ac.createGain(); hissGain.gain.value = 0;
    hiss.connect(hissHp); hissHp.connect(hissLp); hissLp.connect(hissGain); hissGain.connect(master);
    hiss.start();

    deck = {
      hiss(on) { hissGain.gain.setTargetAtTime(on ? 0.007 : 0, ac.currentTime, 0.12); },
      clunk() {
        if (muted) return;
        const now = ac.currentTime;
        note('square', 70, now, 0.07, 0.12, sfxBus);
        note('triangle', 140, now + 0.01, 0.05, 0.2, sfxBus);
        noise(0.035, 0.35);
      }
    };
    return deck;
  }

  /* ---- Sound effects ---------------------------------------------------- */
  const SFX = {
    blip: [[880, 0.05], [1320, 0.08]],
    open: [[523, 0.06], [659, 0.06], [784, 0.06], [1047, 0.12]],
    close: [[784, 0.05], [523, 0.08]],
    grow: [[659, 0.08], [784, 0.08], [988, 0.08], [1319, 0.2]],
    star: [[1175, 0.06], [1568, 0.06], [2093, 0.14]],
    wish: [[1568, 0.05], [1760, 0.05], [2093, 0.05], [2637, 0.05], [3136, 0.2]],
    pickup: [[988, 0.05], [1319, 0.05], [1760, 0.1]],
    hurt: [[330, 0.06], [220, 0.06], [147, 0.12]],
    sad: [[523, 0.08], [494, 0.08], [440, 0.14]],
    warning: [[440, 0.18], [0, 0.08], [440, 0.18], [0, 0.08], [440, 0.18]],
    win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.1], [784, 0.1], [1047, 0.35]]
  };

  function noise(len, vol) {
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const s = ac.createBufferSource(), g = ac.createGain();
    g.gain.value = vol; s.buffer = buf; s.connect(g); g.connect(sfxBus); s.start();
  }

  let lastShot = 0;
  // (works before the music starts too, e.g. tapping the title heart)
  function sfx(name) {
    if (muted || !ctx()) return;
    const now = ac.currentTime;
    if (name === 'type') return note('square', 1400 + Math.random() * 200, now, 0.025, 0.035, sfxBus);
    if (name === 'shoot') {
      if (now - lastShot < 0.07) return;
      lastShot = now;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(1600, now);
      o.frequency.exponentialRampToValueAtTime(500, now + 0.06);
      g.gain.setValueAtTime(0.025, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      o.connect(g); g.connect(sfxBus); o.start(now); o.stop(now + 0.08);
      return;
    }
    if (name === 'shutter') return noise(0.12, 0.25);
    if (name === 'pop') return noise(0.1, 0.2);
    if (name === 'boom') return noise(0.45, 0.4);
    let t = now;
    (SFX[name] || SFX.blip).forEach(([f, d]) => { if (f) note('square', f, t, d, 0.06, sfxBus); t += d * 0.8; });
  }

  return {
    start, sfx, setMuted, setPaused, setGame, setOverride, playNotes, tapeDeck,
    get muted() { return muted; },
    get started() { return started; }
  };
})();
