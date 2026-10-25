/* Band tools: metronome, rudiment trainer, tuner. Plain JS, Web Audio, no files.
   Each mount(el) builds its own UI inside el and returns a cleanup() function. */
(() => {
  'use strict';
  let ctx = null;
  function audio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!ctx || ctx.state === 'closed') ctx = new AC();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  }
  // Click voices: [frequency, decay seconds, wave, volume]
  const VOICES = {
    click:   { accent: [2000, 0.03, 'square', 0.5], beat: [1400, 0.025, 'square', 0.32], sub: [1000, 0.018, 'square', 0.16] },
    wood:    { accent: [1250, 0.06, 'sine', 0.9], beat: [880, 0.05, 'sine', 0.7], sub: [660, 0.035, 'sine', 0.35] },
    beep:    { accent: [1760, 0.08, 'sine', 0.6], beat: [880, 0.07, 'sine', 0.45], sub: [660, 0.05, 'sine', 0.22] },
    cowbell: { accent: [800, 0.12, 'square', 0.35], beat: [560, 0.1, 'square', 0.28], sub: [540, 0.05, 'square', 0.12] },
  };
  function tick(c, t, [f, d, w, v], loud = 1) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = w; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.min(1, v * loud), t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
    if (w === 'square' && f === 800) { // cowbell = two detuned squares
      const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.setValueAtTime(f * 1.48, t); o2.connect(g); o2.start(t); o2.stop(t + d + 0.02);
    }
  }
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

  // ===================================================================== METRONOME
  const SUBS = [
    { k: 1, label: '♩', name: 'Quarters' }, { k: 2, label: '♫', name: '8ths' }, { k: 3, label: '3', name: 'Triplets' },
    { k: 4, label: '♬', name: '16ths' }, { k: 5, label: '5', name: 'Quintuplets' }, { k: 6, label: '6', name: 'Sextuplets' }, { k: 'swing', label: 'Sw', name: 'Swing 8ths' },
  ];
  const METERS = [[2, 4], [3, 4], [4, 4], [5, 4], [6, 8], [7, 8], [9, 8], [12, 8], [2, 2]];
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

  function Metronome(opts = {}) {
    const st = Object.assign({ bpm: 120, beats: 4, unit: 4, sub: 1, voice: 'wood', accents: null, volume: 1, flash: true,
      trainer: false, trainStep: 4, trainEvery: 4, trainMax: 180 }, load('lh_metro', {}), opts);
    if (!st.accents || st.accents.length !== st.beats) st.accents = Array.from({ length: st.beats }, (_, i) => (i === 0 ? 2 : 1)); // 2 accent, 1 normal, 0 mute
    let running = false, nextTime = 0, beat = 0, subIdx = 0, timer = null, bars = 0, onBeat = null;
    const persist = () => save('lh_metro', { bpm: st.bpm, beats: st.beats, unit: st.unit, sub: st.sub, voice: st.voice, accents: st.accents, volume: st.volume, flash: st.flash, trainStep: st.trainStep, trainEvery: st.trainEvery, trainMax: st.trainMax });
    // In 6/8, 9/8, 12/8 the click follows the dotted-quarter pulse when "pulse" is on; keep it simple: click every written beat.
    const secPerBeat = () => (60 / st.bpm) * (st.unit === 8 ? 0.5 : st.unit === 2 ? 2 : 1);
    function schedule() {
      const c = audio(); const v = VOICES[st.voice] || VOICES.wood;
      while (nextTime < c.currentTime + 0.12) {
        const spb = secPerBeat();
        const swing = st.sub === 'swing';
        const n = swing ? 2 : st.sub;
        let t = nextTime;
        if (swing && subIdx === 1) t = nextTime + spb * (2 / 3) - spb / 2; // swung 8th lands on the triplet
        const acc = st.accents[beat];
        if (subIdx === 0) { if (acc) tick(c, t, acc === 2 ? v.accent : v.beat, st.volume); }
        else if (acc !== 0 || true) tick(c, t, v.sub, st.volume);
        const b = beat, s = subIdx, when = t;
        const delay = Math.max(0, (when - c.currentTime) * 1000);
        setTimeout(() => onBeat && onBeat(b, s, n), delay);
        // advance
        nextTime += spb / n;
        subIdx++;
        if (subIdx >= n) {
          subIdx = 0; beat++;
          if (beat >= st.beats) {
            beat = 0; bars++;
            if (st.trainer && bars % st.trainEvery === 0 && st.bpm < st.trainMax) { st.bpm = Math.min(st.trainMax, st.bpm + st.trainStep); onBeat && onBeat(-1, 0, n); }
          }
        }
      }
    }
    return {
      st, persist,
      set onBeat(fn) { onBeat = fn; },
      get running() { return running; },
      start() { const c = audio(); running = true; beat = 0; subIdx = 0; bars = 0; nextTime = c.currentTime + 0.08; schedule(); timer = setInterval(schedule, 25); },
      stop() { running = false; clearInterval(timer); timer = null; },
      setMeter(b, u) { st.beats = b; st.unit = u; st.accents = Array.from({ length: b }, (_, i) => (i === 0 ? 2 : (u === 8 && b % 3 === 0 && i % 3 === 0) ? 2 : 1)); beat = 0; subIdx = 0; persist(); },
    };
  }

  function mountMetronome(el) {
    const m = Metronome();
    const st = m.st;
    const taps = [];
    el.innerHTML = `
      <div class="tool metro">
        <div class="metro-dots" aria-hidden="true"></div>
        <div class="metro-bpm">
          <button class="tool-btn round" data-m="minus" aria-label="Slower">−</button>
          <div class="bpm-read"><output class="bpm-num" aria-live="off">${st.bpm}</output><span>BPM</span><small class="tempo-name"></small></div>
          <button class="tool-btn round" data-m="plus" aria-label="Faster">+</button>
        </div>
        <input class="bpm-slider" type="range" min="30" max="300" value="${st.bpm}" aria-label="Tempo in beats per minute">
        <div class="metro-row">
          <button class="tool-btn big go" data-m="toggle">▶ Start</button>
          <button class="tool-btn big" data-m="tap">Tap tempo</button>
        </div>
        <div class="tool-field"><span>Time signature</span><div class="chips" data-g="meter">${METERS.map(([b, u]) => `<button class="chip" data-meter="${b}/${u}" aria-pressed="${st.beats === b && st.unit === u}">${b}/${u}${b === 2 && u === 2 ? ' (cut)' : ''}</button>`).join('')}</div></div>
        <div class="tool-field"><span>Subdivision</span><div class="chips" data-g="sub">${SUBS.map((s) => `<button class="chip" data-sub="${s.k}" aria-pressed="${String(st.sub) === String(s.k)}" title="${s.name}"><b>${s.label}</b> ${s.name}</button>`).join('')}</div></div>
        <div class="tool-field"><span>Accents <small>(tap a beat: accent → normal → silent)</small></span><div class="accent-row"></div></div>
        <div class="tool-field"><span>Sound</span><div class="chips" data-g="voice">${Object.keys(VOICES).map((k) => `<button class="chip" data-voice="${k}" aria-pressed="${st.voice === k}">${{ click: 'Click', wood: 'Woodblock', beep: 'Beep', cowbell: 'Cowbell' }[k]}</button>`).join('')}</div></div>
        <label class="tool-field"><span>Volume</span><input type="range" min="0.2" max="1.6" step="0.1" value="${st.volume}" data-m="vol" aria-label="Volume"></label>
        <label class="switch-row"><span>Flash the screen on beat 1 (for loud rehearsals)</span><input type="checkbox" role="switch" data-m="flash" ${st.flash ? 'checked' : ''}></label>
        <details class="trainer"><summary>Speed trainer</summary>
          <p class="small muted">Starts at the tempo above and speeds up as you go. Great for rudiments and fast runs.</p>
          <div class="trainer-grid">
            <label>Add <input type="number" min="1" max="20" value="${st.trainStep}" data-m="tstep"> BPM</label>
            <label>every <input type="number" min="1" max="32" value="${st.trainEvery}" data-m="tevery"> bars</label>
            <label>up to <input type="number" min="40" max="300" value="${st.trainMax}" data-m="tmax"> BPM</label>
          </div>
          <label class="switch-row"><span>Speed trainer on</span><input type="checkbox" role="switch" data-m="trainer" ${st.trainer ? 'checked' : ''}></label>
        </details>
      </div>`;
    const $ = (s) => el.querySelector(s);
    const NAMES = [[40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'], [120, 'Moderato'], [156, 'Allegro'], [176, 'Vivace'], [200, 'Presto'], [999, 'Prestissimo']];
    const showBpm = () => {
      $('.bpm-num').textContent = st.bpm; $('.bpm-slider').value = st.bpm;
      $('.tempo-name').textContent = NAMES.find(([v]) => st.bpm < v)[1];
    };
    const drawAccents = () => {
      $('.accent-row').innerHTML = st.accents.map((a, i) => `<button class="acc acc-${a}" data-acc="${i}" aria-label="Beat ${i + 1}: ${['silent', 'normal', 'accent'][a]}">${i + 1}</button>`).join('');
      $('.metro-dots').innerHTML = st.accents.map((a, i) => `<i class="dot ${a === 2 ? 'big' : ''}" data-dot="${i}"></i>`).join('');
    };
    showBpm(); drawAccents();
    const setBpm = (v) => { st.bpm = Math.max(30, Math.min(300, Math.round(v))); showBpm(); m.persist(); };
    m.onBeat = (b, s) => {
      if (b === -1) { showBpm(); return; }
      if (s !== 0) return;
      el.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('on', i === b));
      if (b === 0 && st.flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    };
    const press = (group, btn) => el.querySelectorAll(`[data-g="${group}"] .chip`).forEach((c) => c.setAttribute('aria-pressed', String(c === btn)));
    const onClick = (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.m === 'toggle') {
        if (m.running) { m.stop(); t.textContent = '▶ Start'; t.classList.add('go'); el.querySelectorAll('.dot').forEach((d) => d.classList.remove('on')); }
        else { m.start(); t.textContent = '■ Stop'; t.classList.remove('go'); }
      } else if (t.dataset.m === 'plus') setBpm(st.bpm + 1);
      else if (t.dataset.m === 'minus') setBpm(st.bpm - 1);
      else if (t.dataset.m === 'tap') {
        const now = performance.now(); taps.push(now); while (taps.length > 6) taps.shift();
        if (taps.length > 1 && now - taps[taps.length - 2] > 2000) taps.splice(0, taps.length - 1);
        if (taps.length >= 2) { const gaps = taps.slice(1).map((x, i) => x - taps[i]); setBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)); }
      } else if (t.dataset.meter) { const [b, u] = t.dataset.meter.split('/').map(Number); m.setMeter(b, u); press('meter', t); drawAccents(); }
      else if (t.dataset.sub) { st.sub = t.dataset.sub === 'swing' ? 'swing' : Number(t.dataset.sub); press('sub', t); m.persist(); }
      else if (t.dataset.voice) { st.voice = t.dataset.voice; press('voice', t); m.persist(); }
      else if (t.dataset.acc) { const i = Number(t.dataset.acc); st.accents[i] = (st.accents[i] + 2) % 3; drawAccents(); m.persist(); }
    };
    const onInput = (e) => {
      const t = e.target;
      if (t.classList.contains('bpm-slider')) setBpm(Number(t.value));
      if (t.dataset.m === 'vol') { st.volume = Number(t.value); m.persist(); }
      if (t.dataset.m === 'flash') { st.flash = t.checked; m.persist(); }
      if (t.dataset.m === 'trainer') st.trainer = t.checked;
      if (t.dataset.m === 'tstep') st.trainStep = Math.max(1, Number(t.value) || 1);
      if (t.dataset.m === 'tevery') st.trainEvery = Math.max(1, Number(t.value) || 1);
      if (t.dataset.m === 'tmax') st.trainMax = Math.max(40, Number(t.value) || 180);
      m.persist();
    };
    el.addEventListener('click', onClick); el.addEventListener('input', onInput); el.addEventListener('change', onInput);
    return () => { m.stop(); el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); el.removeEventListener('change', onInput); };
  }

  // ===================================================================== RUDIMENTS
  // Sticking: R/L = stroke, r/l before a note = grace note (flam = one, drag = two), > = accent on the next note.
  // `sub` = notes per beat used for play-along.
  const RUDIMENTS = [
    { cat: 'Roll rudiments', name: 'Single Stroke Roll', st: 'R L R L R L R L', sub: 4 },
    { cat: 'Roll rudiments', name: 'Single Stroke Four', st: 'R L R >L L R L >R', sub: 4, note: 'Three notes as a triplet, landing on the accented fourth.' },
    { cat: 'Roll rudiments', name: 'Single Stroke Seven', st: 'R L R L R L >R', sub: 6 },
    { cat: 'Roll rudiments', name: 'Double Stroke Roll', st: 'R R L L R R L L', sub: 4 },
    { cat: 'Roll rudiments', name: 'Triple Stroke Roll', st: 'R R R L L L R R R L L L', sub: 6 },
    { cat: 'Roll rudiments', name: 'Five Stroke Roll', st: 'R R L L >R L L R R >L', sub: 4 },
    { cat: 'Roll rudiments', name: 'Six Stroke Roll', st: '>R L L R R >L', sub: 6 },
    { cat: 'Roll rudiments', name: 'Seven Stroke Roll', st: 'R R L L R R >L', sub: 6 },
    { cat: 'Roll rudiments', name: 'Nine Stroke Roll', st: 'R R L L R R L L >R', sub: 4 },
    { cat: 'Diddle rudiments', name: 'Single Paradiddle', st: '>R L R R >L R L L', sub: 4 },
    { cat: 'Diddle rudiments', name: 'Double Paradiddle', st: '>R L R L R R >L R L R L L', sub: 6 },
    { cat: 'Diddle rudiments', name: 'Triple Paradiddle', st: '>R L R L R L R R >L R L R L R L L', sub: 4 },
    { cat: 'Diddle rudiments', name: 'Paradiddle-diddle', st: '>R L R R L L >R L R R L L', sub: 6 },
    { cat: 'Flam rudiments', name: 'Flam', st: 'lR rL lR rL', sub: 1 },
    { cat: 'Flam rudiments', name: 'Flam Accent', st: 'lR L R rL R L', sub: 3 },
    { cat: 'Flam rudiments', name: 'Flam Tap', st: 'lR R rL L', sub: 4 },
    { cat: 'Flam rudiments', name: 'Flamacue', st: 'lR >L R L lR', sub: 4, note: 'Accent the second note; the last flam lands on the next beat.' },
    { cat: 'Flam rudiments', name: 'Flam Paradiddle', st: 'lR L R R rL R L L', sub: 4 },
    { cat: 'Flam rudiments', name: 'Pataflafla', st: 'lR L R rL', sub: 4 },
    { cat: 'Flam rudiments', name: 'Swiss Army Triplet', st: 'lR R L lR R L', sub: 3 },
    { cat: 'Flam rudiments', name: 'Inverted Flam Tap', st: 'lR L rL R', sub: 4 },
    { cat: 'Drag rudiments', name: 'Drag (Ruff)', st: 'llR rrL', sub: 1 },
    { cat: 'Drag rudiments', name: 'Single Drag Tap', st: 'llR L rrL R', sub: 2 },
    { cat: 'Drag rudiments', name: 'Single Ratamacue', st: 'llR L R >L rrL R L >R', sub: 4 },
  ];
  const parse = (st) => st.split(' ').map((tok) => {
    const acc = tok.startsWith('>'); const t = tok.replace('>', '');
    const main = t.slice(-1), grace = t.slice(0, -1);
    return { acc, main, grace };
  });
  function mountRudiments(el) {
    const m = Metronome({ sub: 1, accents: null });
    const st = m.st; st.beats = 4; st.unit = 4; st.accents = [2, 1, 1, 1]; st.trainer = false;
    let cur = Number(load('lh_rudiment', 9)) || 0, notes = [], step = 0;
    el.innerHTML = `
      <div class="tool rud">
        <label class="tool-field"><span>Rudiment</span><select class="field" data-r="pick">${[...new Set(RUDIMENTS.map((r) => r.cat))].map((c) => `<optgroup label="${c}">${RUDIMENTS.map((r, i) => r.cat === c ? `<option value="${i}">${r.name}</option>` : '').join('')}</optgroup>`).join('')}</select></label>
        <div class="rud-card"><h3 class="rud-name"></h3><div class="sticking" aria-live="off"></div><p class="small muted rud-note"></p></div>
        <div class="metro-bpm">
          <button class="tool-btn round" data-r="minus" aria-label="Slower">−</button>
          <div class="bpm-read"><output class="bpm-num">${st.bpm}</output><span>BPM</span></div>
          <button class="tool-btn round" data-r="plus" aria-label="Faster">+</button>
        </div>
        <input class="bpm-slider" type="range" min="30" max="240" value="${st.bpm}" aria-label="Tempo">
        <div class="metro-row"><button class="tool-btn big go" data-r="toggle">▶ Play along</button></div>
        <label class="switch-row"><span>Speed up 4 BPM every 4 bars</span><input type="checkbox" role="switch" data-r="trainer"></label>
        <p class="small muted">Capital letters are full strokes, small letters are grace notes (flams and drags), and <b>&gt;</b> is an accent. Start slow and clean, then speed up.</p>
      </div>`;
    const $ = (s) => el.querySelector(s);
    const draw = () => {
      const r = RUDIMENTS[cur]; notes = parse(r.st);
      $('[data-r=pick]').value = String(cur);
      $('.rud-name').textContent = r.name;
      $('.rud-note').textContent = r.note || '';
      $('.sticking').innerHTML = notes.map((n, i) => `<span class="stk-note ${n.main === 'R' ? 'r' : 'l'} ${n.acc ? 'acc' : ''}" data-i="${i}">${n.acc ? '<i>&gt;</i>' : ''}${n.grace ? `<small>${n.grace}</small>` : ''}${n.main}</span>`).join('');
      st.sub = r.sub; step = 0;
    };
    draw();
    m.onBeat = (b, s) => {
      if (b === -1) { $('.bpm-num').textContent = st.bpm; $('.bpm-slider').value = st.bpm; return; }
      el.querySelectorAll('.stk-note').forEach((x, i) => x.classList.toggle('on', i === step % notes.length));
      step++;
    };
    const setBpm = (v) => { st.bpm = Math.max(30, Math.min(240, Math.round(v))); $('.bpm-num').textContent = st.bpm; $('.bpm-slider').value = st.bpm; };
    const onClick = (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.r === 'toggle') { if (m.running) { m.stop(); t.textContent = '▶ Play along'; t.classList.add('go'); } else { step = 0; m.start(); t.textContent = '■ Stop'; t.classList.remove('go'); } }
      if (t.dataset.r === 'plus') setBpm(st.bpm + 2);
      if (t.dataset.r === 'minus') setBpm(st.bpm - 2);
    };
    const onInput = (e) => {
      const t = e.target;
      if (t.dataset.r === 'pick') { cur = Number(t.value); save('lh_rudiment', cur); const was = m.running; m.stop(); draw(); if (was) m.start(); }
      if (t.classList.contains('bpm-slider')) setBpm(Number(t.value));
      if (t.dataset.r === 'trainer') { st.trainer = t.checked; st.trainStep = 4; st.trainEvery = 4; st.trainMax = 240; }
    };
    el.addEventListener('click', onClick); el.addEventListener('input', onInput); el.addEventListener('change', onInput);
    return () => { m.stop(); el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); el.removeEventListener('change', onInput); };
  }

  // ===================================================================== TUNER
  const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const TRANSPOSE = [
    { k: 0, name: 'Concert pitch (flute, oboe, trombone, baritone BC, tuba, mallets, timpani)' },
    { k: 2, name: 'B♭ instruments (trumpet, clarinet, tenor sax, baritone TC)' },
    { k: 9, name: 'E♭ instruments (alto sax, bari sax, E♭ clarinet)' },
    { k: 7, name: 'F instruments (mellophone, French horn)' },
  ];
  function detect(buf, rate) { // autocorrelation
    let rms = 0; for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length); if (rms < 0.01) return -1;
    let r1 = 0, r2 = buf.length - 1; const th = 0.2;
    for (let i = 0; i < buf.length / 2; i++) if (Math.abs(buf[i]) < th) { r1 = i; break; }
    for (let i = 1; i < buf.length / 2; i++) if (Math.abs(buf[buf.length - i]) < th) { r2 = buf.length - i; break; }
    const b = buf.slice(r1, r2); const n = b.length; const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) c[i] += b[j] * b[j + i];
    let d = 0; while (d < n - 1 && c[d] > c[d + 1]) d++;
    let max = -1, pos = -1; for (let i = d; i < n; i++) if (c[i] > max) { max = c[i]; pos = i; }
    if (pos <= 0) return -1;
    const x1 = c[pos - 1], x2 = c[pos], x3 = c[pos + 1] ?? x2; const a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
    return rate / (a ? pos - bb / (2 * a) : pos);
  }
  function mountTuner(el) {
    let stream = null, raf = 0, analyser = null, trans = Number(load('lh_tuner_tr', 0)) || 0, a4 = Number(load('lh_tuner_a4', 440)) || 440;
    el.innerHTML = `
      <div class="tool tuner">
        <div class="tuner-face">
          <div class="tuner-note">–</div><div class="tuner-oct"></div>
          <div class="tuner-meter"><i class="needle"></i><span class="zero"></span></div>
          <div class="tuner-cents">Tap Start and play a long note</div>
          <div class="tuner-hz small muted"></div>
        </div>
        <div class="metro-row"><button class="tool-btn big go" data-t="toggle">🎤 Start</button></div>
        <label class="tool-field"><span>My instrument</span><select class="field" data-t="tr">${TRANSPOSE.map((t) => `<option value="${t.k}" ${t.k === trans ? 'selected' : ''}>${t.name}</option>`).join('')}</select></label>
        <label class="tool-field"><span>A4 =</span><select class="field" data-t="a4">${[438, 439, 440, 441, 442].map((v) => `<option ${v === a4 ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <p class="small muted">Uses your microphone only while it's on — nothing is recorded or uploaded.</p>
      </div>`;
    const $ = (s) => el.querySelector(s);
    const buf = new Float32Array(2048);
    function loop() {
      analyser.getFloatTimeDomainData(buf);
      const f = detect(buf, audio().sampleRate);
      if (f > 40 && f < 2500) {
        const n = 12 * Math.log2(f / a4) + 69; const near = Math.round(n); const cents = Math.round((n - near) * 100);
        const written = near + trans;
        $('.tuner-note').textContent = NOTE_NAMES[((written % 12) + 12) % 12];
        $('.tuner-oct').textContent = Math.floor(written / 12) - 1;
        $('.tuner-cents').textContent = Math.abs(cents) <= 3 ? 'In tune ✓' : cents > 0 ? `${cents}¢ sharp — go down` : `${-cents}¢ flat — go up`;
        $('.tuner-hz').textContent = `${f.toFixed(1)} Hz${trans ? ` · concert ${NOTE_NAMES[((near % 12) + 12) % 12]}` : ''}`;
        $('.needle').style.transform = `rotate(${Math.max(-50, Math.min(50, cents)) * 0.9}deg)`;
        el.querySelector('.tuner').classList.toggle('good', Math.abs(cents) <= 5);
      }
      raf = requestAnimationFrame(loop);
    }
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch { $('.tuner-cents').textContent = 'Microphone blocked — allow it in your browser settings.'; return false; }
      const c = audio(); const src = c.createMediaStreamSource(stream);
      analyser = c.createAnalyser(); analyser.fftSize = 2048; src.connect(analyser); loop(); return true;
    }
    function stop() { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); stream = null; }
    const onClick = async (e) => {
      const t = e.target.closest('[data-t=toggle]'); if (!t) return;
      if (stream) { stop(); t.textContent = '🎤 Start'; t.classList.add('go'); }
      else if (await start()) { t.textContent = '■ Stop'; t.classList.remove('go'); }
    };
    const onInput = (e) => {
      if (e.target.dataset.t === 'tr') { trans = Number(e.target.value); save('lh_tuner_tr', trans); }
      if (e.target.dataset.t === 'a4') { a4 = Number(e.target.value); save('lh_tuner_a4', a4); }
    };
    el.addEventListener('click', onClick); el.addEventListener('change', onInput);
    return () => { stop(); el.removeEventListener('click', onClick); el.removeEventListener('change', onInput); };
  }

  window.BandTools = { metronome: mountMetronome, rudiments: mountRudiments, tuner: mountTuner, RUDIMENTS, detect };
})();
