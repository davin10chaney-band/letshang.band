/* Let's Hang High School (letshang.band) — front end (vanilla JS, no build step).
   Visual layer: hs.css (themes: cardinal, stadium, program). Tools: tools.js. Jokes: jokes.js.
   The server enforces every permission; checks here are only for display. */
(() => {
  'use strict';

  // ================================================================ utilities
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const first = (n) => String(n || '').split(' ')[0];
  const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const sameDay = (a, b) => dayKey(a) === dayKey(b);
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
  function dayLabel(d) {
    const t = new Date(), tm = new Date(); tm.setDate(t.getDate() + 1);
    if (sameDay(d, t)) return 'Today';
    if (sameDay(d, tm)) return 'Tomorrow';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    const d = new Date(iso);
    if (sameDay(d, new Date())) return time(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time(iso);
  }
  const whenText = (iso) => `${dayLabel(new Date(iso))} · ${time(iso)}`;
  const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hm = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${h < 12 ? ' AM' : ' PM'}`; };
  const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  const AVATAR = {
    drum: ['🥁', '#ff16c7'], trumpet: ['🎺', '#ffd400'], sax: ['🎷', '#ff7a00'], flute: ['🪈', '#00eaff'], violin: ['🎻', '#8b00ff'],
    guitar: ['🎸', '#ff16c7'], notes: ['🎶', '#00eaff'], headphones: ['🎧', '#1478ff'], flag: ['🚩', '#ff16c7'], star: ['⭐', '#ffd400'],
    fox: ['🦊', '#ff7a00'], cat: ['😺', '#ff16c7'], frog: ['🐸', '#19f58a'], panda: ['🐼', '#00eaff'], fire: ['🔥', '#ff7a00'],
    bolt: ['⚡', '#ffd400'], crown: ['👑', '#ffd400'], rocket: ['🚀', '#ff16c7'], rainbow: ['🌈', '#ff16c7'], alien: ['👽', '#19f58a'],
  };
  const ava = (key, cls = '') => { const [e, c] = AVATAR[key] || AVATAR.star; return `<span class="ava ${cls}" style="--c:${c}" aria-hidden="true">${e}</span>`; };
  const SECTION = {
    all: ['All Band', '🎺'], percussion: ['Percussion', '🥁'], brass: ['Brass', '🎺'], woodwinds: ['Woodwinds', '🎷'],
    guard: ['Color Guard', '🚩'], front: ['Front Ensemble', '🎹'], leadership: ['Leadership', '🧑‍✈️'], parents: ['Parents', '👪'],
  };
  const secName = (k) => SECTION[k]?.[0] || 'Band';
  const secEm = (k) => SECTION[k]?.[1] || '🎶';

  const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  const I = {
    home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    chat: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"/>'),
    threads: svg('<path d="M4 5h16M4 10h16M4 15h10"/><path d="M15 15l3 4 3-4"/>'),
    tools: svg('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
    profile: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    bell: svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
    car: svg('<path d="M5 17h14M6 17v2M18 17v2M4 13l2-6h12l2 6v4H4z"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/>'),
    cal: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    back: svg('<path d="m15 5-7 7 7 7"/>'),
    send: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 'width="22" height="22"'),
    more: svg('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
    shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
    feed: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>'),
  };

  // ================================================================ state + api
  const S = {
    me: null, band: 'Marching Band', badges: {}, smsLive: false, config: null,
    door: store.get('lhb_door', 'student'), authMode: 'login',
    tab: 'home', view: null,
    channels: null, thread: null, members: null, events: null, school: null, rides: null, offers: null, hangouts: null, spots: null,
    notes: null, admin: null, today: null, feed: null, feedMore: false, post: null, hub: null, hubFeed: null, chatSeg: 'sections', feedAttach: null, replyAttach: null, tool: store.get('lhb_tool', 'metronome'), jokeOffset: 0, attach: null, busy: false,
  };
  const isStudent = () => S.me?.role === 'student';
  const isParent = () => S.me?.role === 'parent';
  const canDrive = () => isParent() || !!S.me?.can_drive;

  class ApiError extends Error { constructor(msg, status, data) { super(msg); this.status = status; this.data = data; } }
  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch('/api' + path, {
      method, credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && S.me) { S.me = null; stopPolling(); render(); }
      throw new ApiError(data.error || 'Something went wrong. Try again.', res.status, data);
    }
    return data;
  }
  /** Photos are re-drawn to a JPEG (max 1600px) before upload — this also strips location data. PDFs go as-is. */
  async function prepareFile(file) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return { blob: file, name: file.name, type: 'application/pdf' };
    if (!file.type.startsWith('image/')) throw new Error('You can upload PDFs (like sheet music) and photos');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("That photo couldn't be opened")); i.src = url; });
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
      return { blob, name: file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', type: 'image/jpeg' };
    } finally { URL.revokeObjectURL(url); }
  }
  async function upload(file) {
    const f = await prepareFile(file);
    if (f.blob.size > 15 * 1024 * 1024) throw new Error('Files can be up to 15 MB');
    const res = await fetch('/api/files', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': f.type, 'x-file-name': encodeURIComponent(f.name) }, body: f.blob });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'Upload failed', res.status, data);
    return data;
  }
  let toastTimer;
  function toast(msg, kind = '') {
    const t = $('#toast');
    t.textContent = msg; t.className = 'show ' + kind;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = kind; }, 3400);
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'confetti';
    const colors = { cardinal: ['#f2c14e', '#c41e3a', '#fbf3e3', '#ffe199'], stadium: ['#e9b93a', '#f2efe6', '#c8102e', '#5aa9ff'], program: ['#a87a12', '#9e1b32', '#14213d', '#e9b93a'] }[theme()];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw'; p.style.background = colors[i % colors.length];
      p.style.setProperty('--x', (Math.random() * 160 - 80) + 'px'); p.style.setProperty('--r', (Math.random() * 1080 - 540) + 'deg');
      p.style.setProperty('--d', (1.4 + Math.random() * 1.4) + 's'); p.style.animationDelay = Math.random() * .3 + 's';
      box.appendChild(p);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 3400);
  }
  /* Styles: cardinal (red + gold, default), stadium (navy + gold), program (light). Old saved values map to cardinal. */
  const THEMES = { cardinal: '#23060b', stadium: '#0a1120', program: '#f3eee2' };
  const normTheme = (t) => (THEMES[t] ? t : 'cardinal');
  const theme = () => normTheme(document.documentElement.dataset.theme);
  function applyTheme(t) {
    const th = normTheme(t);
    document.documentElement.dataset.theme = th;
    store.set('lh_theme', th);
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = THEMES[th];
  }
  function stylePicker() {
    const cur = theme();
    const opt = (k, name, desc, sw) => `<button class="style-opt ${cur === k ? 'on' : ''}" data-act="theme" data-t="${k}" aria-pressed="${cur === k}">
      <span class="sw">${sw.map((c) => `<i style="background:${c}"></i>`).join('')}</span><b>${name}</b><small>${desc}</small></button>`;
    return `<div class="panel stack"><h3>My style</h3><p class="small muted">Only changes how the app looks for you.</p>
      <div class="style-grid">${opt('cardinal', 'Cardinal', 'Red + gold', ['#c41e3a', '#f2c14e', '#23060b'])}${opt('stadium', 'Stadium', 'Navy + gold', ['#0a1120', '#e9b93a', '#f2efe6'])}${opt('program', 'Program', 'Light mode', ['#f3eee2', '#14213d', '#9e1b32'])}</div></div>`;
  }
  // ================================================================ sounds
  // Little synthesized tunes (no audio files). iPhones only allow sound after the first tap,
  // so the audio engine is unlocked on the first touch anywhere in the app.
  const Sound = (() => {
    let ctx = null;
    const on = () => store.get('lh_sound', true) !== false;
    let bus = null, missed = null;
    function build() {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC();
      // Loud: boost everything, then a limiter so it doesn't crackle on phone speakers.
      const boost = ctx.createGain(); boost.gain.value = 2.6;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -10; lim.knee.value = 4; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
      const out = ctx.createGain(); out.gain.value = 1.25;
      boost.connect(lim).connect(out).connect(ctx.destination); bus = boost;
      return ctx;
    }
    // iPhones pause web audio ("suspended" or "interrupted") after a lock, call, Siri, app switch or a quiet spell.
    function engine() {
      if (!ctx || ctx.state === 'closed') build();
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
      return ctx;
    }
    const running = () => !!ctx && ctx.state === 'running';
    // Every tap: if the audio is stuck, throw it away and build a fresh one (iOS only allows this inside a tap).
    function unlock() {
      if (ctx && ctx.state !== 'running') {
        const old = ctx; ctx = null; bus = null;
        try { old.close(); } catch { /* already gone */ }
      }
      const c = engine(); if (!c) return;
      const b = c.createBuffer(1, 1, 22050), src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); src.start(0);
      // An alert that arrived while the sound was stuck plays now (if it was in the last 2 minutes).
      if (missed && Date.now() - missed.at < 120e3) { const k = missed.kind; missed = null; setTimeout(() => api.play(k, true), 60); }
      $('#alert-pop .ap-mute')?.remove();
    }
    ['touchend', 'pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, unlock, { passive: true }));
    // Coming back to the app: try to wake the audio (works on some phones; the next tap fixes the rest).
    const wake = () => { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    window.addEventListener('pageshow', wake); window.addEventListener('focus', wake);
    // note: [frequency Hz, start s, length s, voice, volume, slide-to Hz]
    // voices: any oscillator wave, plus 'pluck' (guitar-ish) and 'bell' (glassy, with an overtone)
    function osc(c, type, f, t, len, vol, toF) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (toF) o.frequency.exponentialRampToValueAtTime(toF, t + len);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(bus || c.destination); o.start(t); o.stop(t + len + 0.05);
    }
    function tune(notes, times = 1) {
      const c = engine(); if (!c) return;
      const dur = Math.max(...notes.map((n) => n[1] + n[2]));
      for (let r = 0; r < times; r++) for (const [f, at, len, voice = 'sine', vol = 0.25, toF] of notes) {
        const t = c.currentTime + 0.02 + r * (dur + 0.35) + at;
        if (voice === 'pluck') { osc(c, 'triangle', f, t, len, vol); osc(c, 'sine', f * 2, t, len * 0.6, vol * 0.35); }
        else if (voice === 'bell') { osc(c, 'sine', f, t, len, vol); osc(c, 'sine', f * 2.76, t, len * 0.5, vol * 0.18); osc(c, 'sine', f * 5.4, t, len * 0.25, vol * 0.06); }
        else osc(c, voice, f, t, len, vol, toF);
      }
    }
    const sparkle = (at) => [[2637, at, 0.25, 'bell', 0.08], [3136, at + 0.06, 0.3, 'bell', 0.07], [3951, at + 0.12, 0.35, 'bell', 0.05]];
    // a brassy note = quiet sawtooth + triangle an octave down
    const horn = (f, at, len) => [[f, at, len, 'sawtooth', 0.11], [f / 2, at, len, 'triangle', 0.2]];
    const TUNES = {
      // FIELD — brass fanfares + snare-ish hits (Cardinal + Stadium)
      field: {
        message: [...horn(784, 0, 0.09), ...horn(1047, 0.1, 0.16)],                                            // ta-daa
        ready:   [...horn(523, 0, 0.1), ...horn(523, 0.12, 0.1), ...horn(523, 0.24, 0.1), ...horn(784, 0.36, 0.45)], // charge!
        pickup:  [...horn(880, 0, 0.12), ...horn(880, 0.18, 0.12), ...horn(1175, 0.36, 0.35)],
        checkin: [...horn(587, 0, 0.1), ...horn(880, 0.11, 0.22)],
        approve: [...horn(523, 0, 0.12), ...horn(659, 0.13, 0.12), ...horn(784, 0.26, 0.12), ...horn(1047, 0.39, 0.5)], // fanfare
        safety:  [[330, 0, 0.18, 'sawtooth', 0.2], [247, 0.2, 0.18, 'sawtooth', 0.2], [330, 0.4, 0.18, 'sawtooth', 0.2], [247, 0.6, 0.3, 'sawtooth', 0.2]],
        chime:   [...horn(1047, 0, 0.08), ...horn(1319, 0.09, 0.14)],
      },
      // GLOCK — bells-section sparkle (Program)
      glock: {
        message: [[659, 0, 0.35, 'pluck', 0.22], [988, 0.09, 0.5, 'pluck', 0.2], ...sparkle(0.12)],
        ready:   [[523, 0, 1.1, 'pluck', 0.16], [659, 0.05, 1.1, 'pluck', 0.15], [784, 0.1, 1.1, 'pluck', 0.15], [988, 0.15, 1.2, 'pluck', 0.14], [1319, 0.3, 0.9, 'bell', 0.12], ...sparkle(0.35)], // dreamy strum
        pickup:  [[1760, 0, 0.7, 'bell', 0.16], [1760, 0.32, 0.9, 'bell', 0.16], [1319, 0.32, 0.9, 'bell', 0.08]], // ding… ding
        checkin: [[392, 0, 0.6, 'pluck', 0.18], [494, 0.08, 0.6, 'pluck', 0.17], [587, 0.16, 0.6, 'pluck', 0.17], [784, 0.24, 0.8, 'pluck', 0.17], ...sparkle(0.3)],
        approve: [[698, 0, 0.9, 'bell', 0.15], [880, 0.1, 0.9, 'bell', 0.14], [1047, 0.2, 0.9, 'bell', 0.13], [1319, 0.3, 1.1, 'bell', 0.13], ...sparkle(0.4)],
        safety:  [[880, 0, 0.35, 'bell', 0.2], [698, 0.25, 0.45, 'bell', 0.2], [880, 0.6, 0.35, 'bell', 0.2], [698, 0.85, 0.5, 'bell', 0.2]],
        chime:   [[1319, 0, 0.6, 'bell', 0.15], [1976, 0.1, 0.7, 'bell', 0.1], ...sparkle(0.15)],
      },
    };
    // Important alerts play more than once so they're hard to miss.
    const REPEAT = { pickup: 3, ready: 2, safety: 3, approve: 2, checkin: 1, message: 2, chime: 1 };
    const KIND = { dm: 'message', mention: 'message', event: 'chime', hangout: 'approve', message: 'message', parent_message: 'message', ready: 'ready', pickup: 'pickup', checkin: 'checkin', ride: 'pickup', ride_update: 'approve', parent_chat: 'message',
      friend_request: 'approve', friend_approval: 'approve', friend_accepted: 'approve', plan_approval: 'approve', plan_update: 'approve', safety: 'safety' };
    const api = {
      on, running, kindFor: (type) => KIND[type] || 'chime',
      play(kind, force) {
        if (!force && !on()) return;
        const set = theme() === 'program' ? TUNES.glock : TUNES.field;
        engine();
        if (!running()) { // stuck — remember it; if it wakes up by itself, forget it, otherwise it plays on the next tap
          missed = { kind, at: Date.now() };
          setTimeout(() => { if (running()) missed = null; }, 400);
        }
        try { tune(set[kind] || set.chime, REPEAT[kind] || 1); } catch { /* audio blocked */ }
        try { navigator.vibrate?.(kind === 'message' ? 120 : [220, 120, 220, 120, 220]); } catch { /* not supported (iPhone) */ }
      },
      set(v) { store.set('lh_sound', !!v); },
    };
    return api;
  })();
  // Compare fresh badge counts with what we've already heard; play one sound for anything new.
  let heard = null;
  function soundCheck(b) {
    if (!b) return;
    const now = { id: b.latest_id || 0, msgs: b.dms || 0 };
    if (heard && S.me) {
      if (now.id > heard.id) { Sound.play(Sound.kindFor(b.latest_type)); alertPop(b.latest_type, b.latest_title, b.latest_body, b.latest_link); }
      else if (now.msgs > heard.msgs && S.view?.name !== 'thread') { Sound.play('message'); alertPop('dm', 'New message 💬', 'Tap to read', 'tab:dms'); }
    }
    heard = now;
  }
  // Big drop-down card for new alerts — impossible to miss, even with the ringer off.
  const POP_EM = { dm: '💬', mention: '📣', event: '📅', hangout: '🍕', message: '💬', parent_chat: '💬', parent_message: '💌', ready: '🙋', pickup: '🚗', ride: '🌧️', ride_update: '🚗', checkin: '📍', safety: '🛡️',
    friend_request: '🫶', friend_accepted: '🤝', friend_approval: '✅', plan_approval: '📅', plan_update: '📅' };
  let popTimer = null;
  function alertPop(type, title, body, link) {
    if (!title) return;
    let el = $('#alert-pop');
    if (!el) { el = document.createElement('button'); el.id = 'alert-pop'; el.type = 'button'; document.body.appendChild(el); }
    el.className = `alert-pop t-${type || 'chime'}`;
    el.dataset.link = link || '';
    el.innerHTML = `<span class="ap-em" aria-hidden="true">${POP_EM[type] || '🔔'}</span><span class="ap-txt"><b>${esc(title)}</b>${body ? `<small>${esc(body)}</small>` : ''}${Sound.on() && !Sound.running() ? '<small class="ap-mute">🔇 Tap to turn the sound back on</small>' : ''}</span><span class="ap-x" aria-hidden="true">✕</span>`;
    el.setAttribute('role', 'alert');
    void el.offsetWidth; el.classList.add('show');
    document.body.classList.remove('alert-flash'); void document.body.offsetWidth; document.body.classList.add('alert-flash');
    clearTimeout(popTimer); popTimer = setTimeout(() => el.classList.remove('show'), 9000);
    setTimeout(() => { if (Sound.running()) el.querySelector('.ap-mute')?.remove(); }, 450);
    el.onclick = (e) => {
      el.classList.remove('show');
      if (e.target.closest('.ap-x')) return;
      const l = el.dataset.link;
      if (l === 'tab:dms') go('dms'); else if (!l || !follow(l)) open('notifications');
    };
  }
  function soundPanel() {
    return `<div class="panel stack"><h3>🔊 Sounds</h3>
      <label class="switch-row"><span>Play a sound for new notifications</span><input type="checkbox" role="switch" data-act="sound-toggle" ${Sound.on() ? 'checked' : ''}></label>
      <div class="row wrap">${[['message', '💬'], ['pickup', '🚗'], ['ready', '🙋'], ['approve', '✅']].map(([k, e]) => `<button type="button" class="ghost-button sm" data-act="sound-test" data-k="${k}">${e} Test</button>`).join('')}</div>
      <p class="small muted">${theme() === 'program' ? 'Program = glockenspiel bells 🔔' : 'Cardinal + Stadium = brass fanfares 🎺'} — they switch with your style. Sounds play while Let's Hang is open. Turn your ringer on (the side switch) and turn the volume up — a big pop-up shows too, even on silent.</p></div>`;
  }

  // ================================================================ navigation
  let toolCleanup = null;
  function teardownTool() { if (toolCleanup) { try { toolCleanup(); } catch { /* */ } toolCleanup = null; } }
  function go(tab) { teardownTool(); S.tab = tab; S.view = null; render(); scrollTo(0, 0); loadForScreen(); return true; }
  function open(name, id) { teardownTool(); S.view = { name, id }; render(); scrollTo(0, 0); loadForScreen(); return true; }
  function back() { teardownTool(); S.view = null; S.attach = null; render(); loadForScreen(); }
  function follow(link) {
    if (!link) return false;
    const [k, id] = link.split(':');
    if (k === 'thread') return open('thread', Number(id));
    if (k === 'post') return isStudent() ? (S.tab = 'feed', open('post', Number(id))) : false;
    if (k === 'hub') return open('hub', Number(id));
    if (k === 'feed') return isStudent() ? go('feed') : (open('hub', null), false);
    if (k === 'rides') return isStudent() || isParent() ? (S.tab = 'home', open('rides')) : false;
    if (k === 'hangouts') return isStudent() ? (S.tab = 'home', open('hangouts')) : false;
    if (k === 'calendar') return go('calendar');
    if (k === 'admin') return S.me?.is_admin ? (S.tab = 'me', open('admin')) : false;
    return false;
  }

  async function loadForScreen() {
    const v = S.view?.name;
    try {
      if (v === 'thread') await loadThread(true);
      else if (v === 'notifications') S.notes = (await api('/notifications')).notifications;
      else if (v === 'members') S.members = (await api('/members')).members;
      else if (v === 'rides') [S.rides, S.offers, S.today] = await Promise.all([api('/rides').then((d) => d.rides), api('/ride-offers').then((d) => d.offers), S.today || api('/today')]);
      else if (v === 'hangouts') [S.hangouts, S.spots] = await Promise.all([api('/hangouts').then((d) => d.hangouts), api('/spots').then((d) => d.spots)]);
      else if (v === 'admin') S.admin = await api('/admin');
      else if (v === 'post') S.post = await api(`/feed/${S.view.id}/replies`);
      else if (v === 'hub') { [S.hub, S.hubFeed] = await Promise.all([api(`/events/${S.view.id}/hub`), api(`/feed?event_id=${S.view.id}`).then((d) => d.posts)]); }
      else if (v === 'calendar') [S.events, S.school] = await Promise.all([api('/events').then((d) => d.events), S.school || api('/school-calendar').then((d) => d.days)]);
      else if (!v) {
        if (S.tab === 'home') {
          const jobs = [api('/events').then((d) => d.events), api('/today'), api('/rides').then((d) => d.rides), api('/ride-offers').then((d) => d.offers)];
          if (isStudent()) jobs.push(api('/hangouts').then((d) => d.hangouts));
          [S.events, S.today, S.rides, S.offers, S.hangouts] = await Promise.all(jobs);
        }
        if (S.tab === 'threads' || S.tab === 'dms' || S.tab === 'chat') S.channels = await api('/channels');
        if (S.tab === 'feed') { const d = await api('/feed'); S.feed = d.posts; S.feedMore = d.posts.length === 25; }
        if (S.tab === 'calendar') [S.events, S.school] = await Promise.all([api('/events').then((d) => d.events), S.school || api('/school-calendar').then((d) => d.days)]);
      }
    } catch (e) { toast(e.message, 'warn'); }
    paint();
    if (v === 'thread') scrollChat(true);
  }

  // ================================================================ polling
  let pollTimer, threadTimer;
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      if (document.hidden || !S.me) return;
      try {
        const b = await api('/badges');
        soundCheck(b);
        const changed = JSON.stringify(b) !== JSON.stringify(S.badges);
        S.badges = b; paintBadges();
        if (changed && !S.view && ['home', 'threads', 'dms', 'chat'].includes(S.tab) && !document.activeElement?.matches('input, textarea, select') && !$('#modal-root').innerHTML) loadForScreen();
      } catch { /* offline blip */ }
    }, 8000);
    threadTimer = setInterval(() => { if (!document.hidden && S.view?.name === 'thread') loadThread(false); }, 4000);
  }
  function stopPolling() { clearInterval(pollTimer); clearInterval(threadTimer); }
  setInterval(() => { if (!document.hidden) tickCountdowns(); }, 1000);

  // ================================================================ shell
  function render() {
    const app = $('#app');
    if (!S.me) { app.innerHTML = renderAuth(); return; }
    app.innerHTML = `
      <header class="topbar">
        <button class="profile-chip" data-act="tab" data-tab="me" aria-label="Your profile">
          ${ava(S.me.avatar, 'profile-avatar')}
          <span class="greeting">${hiWord()},<strong>${esc(first(S.me.display_name))}</strong></span>
        </button>
        <div class="topbar-actions" id="top-actions">${renderTopActions()}</div>
      </header>
      <main class="view" id="view"></main>
      ${renderNav()}`;
    paint();
  }
  function paint() {
    const v = $('#view'); if (!v) return;
    teardownTool();
    v.innerHTML = screenHTML();
    paintBadges();
    mountTool();
  }
  function paintBadges() {
    const nav = $('#nav'); if (nav) nav.outerHTML = renderNav();
    const ta = $('#top-actions'); if (ta) ta.innerHTML = renderTopActions();
  }
  const hiWord = () => { const h = new Date().getHours(); return h < 12 ? 'Morning' : h < 17 ? 'Hey' : 'Evening'; };
  const badge = (n) => n ? `<span class="notification-badge" aria-label="${n} new">${n > 9 ? '9+' : n}</span>` : '';
  function renderTopActions() {
    const n = S.badges.notifications || 0;
    return `${S.me.is_admin ? `<button class="icon-button" data-act="open" data-view="admin" aria-label="Admin${S.badges.reports ? `, ${S.badges.reports} reports` : ''}">${I.shield}${badge(S.badges.reports)}</button>` : ''}
      <button class="icon-button" data-act="open" data-view="notifications" aria-label="Notifications${n ? `, ${n} new` : ''}">${I.bell}${badge(n)}</button>`;
  }
  function renderNav() {
    const b = S.badges;
    const tabs = isStudent()
      ? [['home', 'Home', I.home, b.rides], ['feed', 'Feed', I.feed, 0], ['chat', 'Chat', I.chat, (b.threads || 0) + (b.dms || 0)], ['tools', 'Tools', I.tools, 0], ['me', 'Me', I.profile, 0]]
      : [['home', 'Home', I.home, b.rides], ['threads', 'Parents', I.threads, b.threads], ['dms', 'Messages', I.chat, b.dms], ['calendar', 'Calendar', I.cal, 0], ['me', 'Me', I.profile, 0]];
    const cur = S.view?.name === 'thread' ? (isStudent() ? 'chat' : S.thread?.channel?.kind === 'dm' ? 'dms' : 'threads') : S.view?.name === 'post' ? 'feed' : S.tab;
    return `<nav class="bottom-nav" id="nav" aria-label="Main">${tabs.map(([k, l, ic, n]) => `
      <button class="nav-item ${cur === k ? 'active' : ''}" data-act="tab" data-tab="${k}" ${cur === k ? 'aria-current="page"' : ''}>
        <span class="nav-icon">${ic}</span><span>${l}</span>${badge(n)}
      </button>`).join('')}</nav>`;
  }
  function screenHTML() {
    const v = S.view?.name;
    if (v === 'thread') return viewThread();
    if (v === 'notifications') return viewNotifications();
    if (v === 'members') return viewMembers();
    if (v === 'rides') return viewRides();
    if (v === 'hangouts') return viewHangouts();
    if (v === 'admin') return viewAdmin();
    if (v === 'calendar') return viewCalendar();
    if (v === 'post') return viewPost();
    if (v === 'hub') return viewHub();
    return ({ home: viewHome, feed: viewFeed, chat: viewChat, threads: viewThreads, dms: viewDms, tools: viewTools, calendar: viewCalendar, me: viewMe })[S.tab]?.() || viewHome();
  }
  const subHeader = (title, extra = '') => `<div class="subhead"><button class="icon-button" data-act="back" aria-label="Back">${I.back}</button><h2>${title}</h2>${extra}</div>`;
  const sectionTitle = (t, extra = '') => `<div class="section-title"><h2>${t}</h2>${extra}</div>`;
  const card = (cls, act, icon, label, extra = '', n = 0) => `<button class="action-card ${cls}" data-act="${act}" ${extra}>
      ${n ? `<span class="notification-badge card-badge">${n > 9 ? '9+' : n}</span>` : ''}
      <span class="action-icon" aria-hidden="true">${icon}</span>
      <span class="action-label">${label}<span class="action-arrow" aria-hidden="true">→</span></span></button>`;
  const empty = (e, text, btn = '') => `<div class="panel empty"><div class="e" aria-hidden="true">${e}</div><p>${text}</p>${btn}</div>`;
  const heroHTML = (tag) => `<section class="hero"><h1 class="hero-logo"><span class="lets">Let's</span><span class="hang">Hang</span></h1>
    <p class="hero-tagline">${tag}</p><span class="hero-band">High School · ${esc(S.band || S.config?.band || 'Band')}</span></section>`;

  // ================================================================ sign in / sign up
  function renderAuth() {
    const firstRun = S.config?.first_run;
    const parent = S.door === 'parent';
    let form;
    if (firstRun) form = renderSignup(true);
    else if (S.authMode === 'signup') form = renderSignup(false);
    else if (S.authMode === 'recover') form = `<form class="panel stack" data-form="recover"><h2>Reset your password</h2>
        <p class="small muted">Use the recovery code you saved when you signed up.</p>
        <label class="fld"><span>Username</span><input class="field" name="username" autocapitalize="none" required></label>
        <label class="fld"><span>Recovery code</span><input class="field" name="recovery_code" autocapitalize="characters" required placeholder="XXXX-XXXX-XXXX"></label>
        <label class="fld"><span>New password (8+)</span><input class="field" name="new_password" type="password" minlength="8" required autocomplete="new-password"></label>
        <p class="form-error" data-err role="alert"></p>
        <button class="primary-button block big" type="submit">Reset password</button>
        <p class="center small"><button type="button" class="linkish" data-act="auth-mode" data-mode="login">Back to sign in</button></p></form>`;
    else form = `<form class="panel stack" data-form="login" autocomplete="on">
        <h2>${parent ? 'Parent sign in' : 'Sign in'}</h2>
        <label class="fld"><span>Username</span><input class="field" name="username" autocomplete="username" autocapitalize="none" required></label>
        <label class="fld"><span>Password</span><input class="field" name="password" type="password" autocomplete="current-password" required></label>
        <p class="form-error" data-err role="alert"></p>
        <button class="primary-button block big" type="submit">Let's go!</button>
        <p class="center small muted">New here? <button type="button" class="linkish" data-act="auth-mode" data-mode="signup">Create an account</button>
          <br><button type="button" class="linkish" data-act="auth-mode" data-mode="recover">Forgot password?</button></p></form>`;
    return `<div class="auth">
      ${heroHTML('Band life. Real friends. Good vibes.')}
      ${firstRun ? '' : `<div class="dashboard-grid doors" role="group" aria-label="Who's signing in?">
        <button class="action-card chat door" data-act="door" data-door="student" aria-pressed="${!parent}">
          <span class="action-icon" aria-hidden="true">🥁</span><span class="action-label">I'm a student<span class="action-arrow" aria-hidden="true">→</span></span></button>
        <button class="action-card friends door" data-act="door" data-door="parent" aria-pressed="${parent}">
          <span class="action-icon" aria-hidden="true">👪</span><span class="action-label">I'm a parent<span class="action-arrow" aria-hidden="true">→</span></span></button>
      </div>`}
      ${form}
      <div class="auth-style">${stylePicker()}</div>
    </div>`;
  }
  function renderSignup(firstRun) {
    const student = !firstRun && S.door !== 'parent';
    return `<form class="panel stack" data-form="signup" autocomplete="on">
      <h2>${firstRun ? 'Set up your band' : student ? 'Join the band' : 'Parent sign up'}</h2>
      ${firstRun ? `<p class="small muted">You're the first one here, so this account becomes the <b>admin</b>. After signing up you'll get the band code (for students) and the parent code to hand out.</p>`
        : `<label class="fld"><span>${student ? 'Band code' : 'Parent code'}</span><input class="field" name="join_code" autocapitalize="characters" required placeholder="${student ? 'BAND-XXXX' : 'FAM-XXXX'}"></label>
           <p class="small muted">${student ? 'Get it from your band director or section leader.' : 'Get it from the band director or a booster parent.'}</p>`}
      <input type="hidden" name="role" value="${firstRun ? 'parent' : student ? 'student' : 'parent'}">
      <label class="fld"><span>${firstRun ? 'Your name' : student ? 'Your name (first name is fine)' : 'Your name'}</span><input class="field" name="display_name" maxlength="40" required autocomplete="name"></label>
      <label class="fld"><span>Username</span><input class="field" name="username" autocapitalize="none" required autocomplete="username"></label>
      <label class="fld"><span>Password (8+ characters)</span><input class="field" name="password" type="password" minlength="8" required autocomplete="new-password"></label>
      ${student ? `<label class="fld"><span>Section</span><select class="field" name="section" required><option value="">Pick one…</option>${(S.config?.sections || []).map((k) => `<option value="${k}">${secEm(k)} ${secName(k)}</option>`).join('')}</select></label>
        <div class="row"><label class="fld grow"><span>Instrument</span><input class="field" name="instrument" maxlength="30" placeholder="Snare, Mello, Flag…"></label>
          <label class="fld"><span>Grade</span><select class="field" name="grade"><option value="">–</option>${[9, 10, 11, 12].map((g) => `<option>${g}</option>`).join('')}</select></label></div>
        <label class="check"><input type="checkbox" name="can_drive"><span>I have my license and can give rides</span></label>`
        : `<label class="fld"><span>Mobile number (optional, for ride + safety texts)</span><input class="field" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(605) 555-0123"></label>
           <label class="check"><input type="checkbox" name="sms_opt_in"><span>Text me ride requests and important alerts. Reply STOP to opt out.</span></label>`}
      <p class="small muted">Be kind: messages are checked for bullying, slurs, threats and explicit stuff, and anyone can report a message.</p>
      <p class="form-error" data-err role="alert"></p>
      <button class="primary-button block big" type="submit">${firstRun ? 'Create admin account' : 'Create account'}</button>
      ${firstRun ? '' : '<p class="center small"><button type="button" class="linkish" data-act="auth-mode" data-mode="login">I already have an account</button></p>'}
    </form>`;
  }

  // ================================================================ home
  function jokeCard() {
    if (!window.jokeOfDay) return '';
    const sec = isStudent() ? (S.me.section || 'all') : 'all';
    const lists = [sec, 'all'];
    const which = lists[Math.abs(S.jokeOffset) % 2];
    return `<div class="joke"><span class="jk-em" aria-hidden="true">${S.jokeOffset ? '😂' : '🤣'}</span>
      <span class="jk-label">${S.jokeOffset ? 'Another one' : 'Joke of the day'} · ${secName(which)}</span>
      <p>${esc(window.jokeOfDay(which, Math.floor(S.jokeOffset / 2)))}</p>
      <button class="linkish" data-act="joke-next">Another one →</button></div>`;
  }
  const EV_EM = { rehearsal: '🎼', game: '🏈', competition: '🏆', concert: '🎻', sectional: '🥁', other: '📌' };
  function eventCard(e) {
    return `<div class="ev k-${e.kind} ${e.cancelled ? 'cancelled' : ''}"><span class="ev-em" aria-hidden="true">${EV_EM[e.kind] || '📌'}</span><div>
      <h3><button class="linkish ev-link" data-act="open" data-view="hub" data-id="${e.id}">${esc(e.title)}</button></h3>
      <p class="small">${evWhen(e)}${e.call_time ? ` · <b>Call ${hm(e.call_time)}</b>` : ''}${e.section ? ` · ${secEm(e.section)} ${secName(e.section)}` : ''}</p>
      ${e.location ? `<p class="small muted">📍 ${esc(e.location)}</p>` : ''}${e.details ? `<p class="small muted">${esc(e.details)}</p>` : ''}
      ${e.cancelled ? '<span class="pill st-declined">Cancelled</span>' : `<p class="small">${e.going ? `🙋 ${e.going} going` : ''}${e.my_rsvp === 'going' ? ' · <b>you\'re in</b>' : ''} <button class="linkish small" data-act="open" data-view="hub" data-id="${e.id}">${['competition', 'game', 'concert'].includes(e.kind) ? 'Open hub →' : 'Details →'}</button></p>`}
      ${S.me.is_admin && !e.cancelled ? `<div class="row wrap small-gap" style="margin-top:6px"><button class="linkish small" data-act="event-cancel" data-id="${e.id}">Cancel event</button></div>` : ''}</div></div>`;
  }
  function viewHome() {
    const b = S.badges;
    const next = (S.events || []).filter((e) => !e.cancelled).slice(0, 2);
    const myRides = (S.rides || []).filter((r) => r.mine || r.driving);
    const openRides = canDrive() ? (S.rides || []).filter((r) => r.status === 'open' && !r.mine) : [];
    const mySeats = (S.offers || []).filter((o) => o.joined || o.mine);
    const hint = rideHint();
    return `${heroHTML(isStudent() ? `${secEm(S.me.section)} ${secName(S.me.section)}${S.me.instrument ? ' · ' + esc(S.me.instrument) : ''}` : 'Parents + boosters')}
      ${openRides.length ? `<button class="motivation-banner tone-yellow" data-act="open" data-view="rides"><p class="motivation-copy">${openRides.length} ride request${openRides.length > 1 ? 's' : ''}<span class="mb-sub">Can you drive? Tap to see</span></p><span class="mb-emoji" aria-hidden="true">🚗</span></button>` : ''}
      ${myRides.map((r) => `<button class="motivation-banner ${r.status === 'claimed' ? 'tone-green' : 'tone-pink'}" data-act="open" data-view="rides"><p class="motivation-copy">${r.driving ? `You're driving ${esc(first(r.requested_by.display_name))}` : r.status === 'claimed' ? `${esc(first(r.claimed_by.display_name))} is driving!` : 'Looking for a driver…'}<span class="mb-sub">${whenText(r.starts_at)} · ${esc(r.from_place)} → ${esc(r.to_place)}</span></p><span class="mb-emoji" aria-hidden="true">${r.status === 'claimed' ? '🚗' : '⏳'}</span></button>`).join('')}
      ${mySeats.map((o) => `<button class="motivation-banner tone-green" data-act="open" data-view="rides"><p class="motivation-copy">${o.mine ? `You're driving · ${o.taken}/${o.seats} seats` : `Riding with ${esc(first(o.driver.display_name))}`}<span class="mb-sub">${whenText(o.starts_at)} · ${esc(o.from_place)} → ${esc(o.to_place)}</span></p><span class="mb-emoji" aria-hidden="true">🚙</span></button>`).join('')}
      ${hint && isStudent() && !myRides.length ? `<button class="motivation-banner tone-blue" data-act="ride-sheet" data-reason="${hint.reason}"><p class="motivation-copy">${hint.word} after school<span class="mb-sub">${hint.w.temp}° · ${esc(hint.w.text)} · Tap to ask for a ride</span></p><span class="mb-emoji" aria-hidden="true">${hint.em}</span></button>` : ''}
      ${countdownCard()}
      ${jokeCard()}
      <div class="dashboard-grid">
        ${isStudent() ? `${card('chat', 'tab', '📸', 'Band Feed', 'data-tab="feed"')}
          ${card('friends', 'tab', '💬', 'Chat', 'data-tab="chat"', (b.threads || 0) + (b.dms || 0))}
          ${card('games', 'tab', '⏱️', 'Metronome', 'data-tab="tools"')}
          ${card('plan', 'open', '🍕', 'Hangouts', 'data-view="hangouts"')}
          ${card('profile', 'open', '🚗', 'Rides', 'data-view="rides"', b.rides)}
          ${card('settings', 'open', '📅', 'Calendar', 'data-view="calendar"')}`
        : `${card('chat', 'tab', '👪', 'Parents', 'data-tab="threads"', b.threads)}
          ${card('friends', 'tab', '💬', 'Messages', 'data-tab="dms"', b.dms)}
          ${card('profile', 'open', '🚗', 'Rides', 'data-view="rides"', b.rides)}
          ${card('plan', 'tab', '📅', 'Calendar', 'data-tab="calendar"')}`}
      </div>
      ${sectionTitle('Coming up', S.me.is_admin ? '<button class="warm-button sm" data-act="event-new">+ Event</button>' : '')}
      ${!S.events ? empty('⏳', 'Loading…') : next.length ? next.map(eventCard).join('') + `<p class="center"><button class="linkish" data-act="${isStudent() ? 'open' : 'tab'}" data-view="calendar" data-tab="calendar">Full calendar →</button></p>` : empty('📅', 'No band events yet.')}
      ${isStudent() && S.hangouts?.length ? sectionTitle('Hangouts') + S.hangouts.slice(0, 2).map(hangoutCard).join('') : ''}`;
  }
  function rideHint() {
    const w = S.today?.weather?.afternoon;
    if (!w?.ride || !S.today?.day || S.today.day.label !== 'Today') return null;
    const em = { rain: '🌧️', snow: '🌨️', storm: '⛈️', cold: '🥶' }[w.ride] || '🚗';
    return { reason: w.ride, w, em, word: { rain: 'Rain', snow: 'Snow', storm: 'Storms', cold: 'Freezing' }[w.ride] || 'Weather' };
  }

  // ================================================================ sections (threads)
  function threadRow(t, main) {
    return `<button class="row-btn thread-row ${main ? 'main' : ''}" data-act="open" data-view="thread" data-id="${t.id}">
      <span class="t-icon" aria-hidden="true">${main ? secEm(t.section) : t.locked ? '📌' : '#'}</span>
      <span class="grow"><b>${esc(t.name)}</b><span class="sub">${t.last_body ? `${t.last_name ? esc(first(t.last_name)) + ': ' : ''}${esc(t.last_body)}` : esc(t.about || 'No messages yet')}</span></span>
      <span class="meta">${t.last_at ? `<span class="tiny">${ago(t.last_at)}</span>` : ''}${t.unread ? `<span class="unread" aria-label="${t.unread} unread">${t.unread > 99 ? '99+' : t.unread}</span>` : ''}</span></button>`;
  }
  function viewThreads() {
    const c = S.channels;
    const title = isStudent() ? 'Sections' : 'Parents';
    if (!c) return sectionTitle(title) + empty('⏳', 'Loading…');
    return `${sectionTitle(title)}
      <p class="note">${isStudent() ? '🔒 Students only — parents can\'t see these. Be kind: messages are checked, and anyone can report.' : '👪 Parents + boosters only. Students can\'t see these threads.'}</p>
      ${c.sections.map((s) => {
        const canStart = !isStudent() || S.me.is_admin || s.section === 'all' || s.section === S.me.section;
        return `<div class="sec-block"><div class="sec-head"><span class="sec-em" aria-hidden="true">${secEm(s.section)}</span><h3>${esc(s.name)}</h3>${s.section === S.me.section ? '<span class="mine-tag">Your section</span>' : ''}
          ${canStart ? `<button class="ghost-button sm" data-act="thread-new" data-section="${s.section}">+ Thread</button>` : ''}</div>
          <div class="panel list">${threadRow(s, true)}${s.topics.map((t) => threadRow(t)).join('')}</div></div>`;
      }).join('')}`;
  }
  function viewDms() {
    const c = S.channels;
    if (!c) return sectionTitle('Messages') + empty('⏳', 'Loading…');
    const head = S.tab === 'chat' ? '' : sectionTitle('Messages', '<button class="warm-button sm" data-act="open" data-view="members">+ New</button>');
    return `${head}${S.tab === 'chat' ? '<div class="row wrap" style="margin-bottom:10px"><button class="warm-button sm" data-act="open" data-view="members">+ New message</button><button class="primary-button sm" data-act="group-sheet">+ New group</button></div>' : ''}
      ${c.groups?.length ? `<h3 class="sub-h">Groups</h3><div class="panel list">${c.groups.map((g) => `<button class="row-btn" data-act="open" data-view="thread" data-id="${g.id}"><span class="t-icon" aria-hidden="true">${g.expires_at ? '⏳' : '👥'}</span>
          <span class="grow"><b>${esc(g.name)}</b><span class="sub">${g.members.length + 1} people${g.expires_at ? ` · ends ${dayLabel(new Date(g.expires_at))}` : ''}${g.last_body ? ' · ' + esc(g.last_body) : ''}</span></span>
          <span class="meta">${g.last_at ? `<span class="tiny">${ago(g.last_at)}</span>` : ''}${g.unread ? `<span class="unread">${g.unread}</span>` : ''}</span></button>`).join('')}</div><h3 class="sub-h">Direct messages</h3>` : ''}
      <p class="note">${isStudent() ? '🔒 Private between students. Guardrails still block bullying, slurs, threats and explicit stuff.' : 'Private messages between parents.'}</p>
      ${c.dms.length ? `<div class="panel list">${c.dms.map((d) => `<button class="row-btn" data-act="open" data-view="thread" data-id="${d.id}">${ava(d.with.avatar)}
          <span class="grow"><b>${esc(d.with.display_name)}</b><span class="sub">${d.with.section ? secEm(d.with.section) + ' ' : ''}${esc(d.last_body || 'Say hi 👋')}</span></span>
          <span class="meta">${d.last_at ? `<span class="tiny">${ago(d.last_at)}</span>` : ''}${d.unread ? `<span class="unread">${d.unread}</span>` : ''}</span></button>`).join('')}</div>`
        : empty('💬', isStudent() ? 'No messages yet. Start one with someone in the band!' : 'No messages yet.', '<button class="primary-button" data-act="open" data-view="members" style="margin-top:12px">Find someone</button>')}`;
  }
  function viewMembers() {
    const list = S.members;
    const q = (S.memberQ || '').toLowerCase();
    const shown = (list || []).filter((m) => m.id !== S.me.id && (!q || m.display_name.toLowerCase().includes(q) || m.username.includes(q) || (m.instrument || '').toLowerCase().includes(q)));
    return `${subHeader(isStudent() ? 'Band members' : 'Parents')}
      <input class="field member-search" id="member-q" type="search" placeholder="Search by name or instrument" value="${esc(S.memberQ || '')}" aria-label="Search">
      ${!list ? empty('⏳', 'Loading…') : `<div class="panel list">${shown.map((m) => `<div class="row-btn static">${ava(m.avatar)}
        <span class="grow"><b>${esc(m.display_name)}</b>${m.is_admin ? ' <span class="pill">Admin</span>' : ''}<span class="sub">@${esc(m.username)}${m.section ? ` · ${secEm(m.section)} ${secName(m.section)}` : ''}${m.instrument ? ` · ${esc(m.instrument)}` : ''}${m.grade ? ` · ${m.grade}th` : ''}${m.can_drive ? ' · 🚗 driver' : ''}</span></span>
        <span class="row-actions">${m.blocked ? `<button class="ghost-button sm" data-act="unblock" data-id="${m.id}">Unblock</button>` : `<button class="primary-button sm" data-act="dm" data-id="${m.id}">Message</button>`}</span></div>`).join('') || '<p class="small muted pad">No one found.</p>'}</div>`}`;
  }

  // ---- one thread (section, topic or DM)
  async function loadThread(full) {
    const v = S.view; if (!v) return;
    const cur = S.thread?.channel?.id === v.id ? S.thread : null;
    const last = !full && cur?.posts.length ? cur.posts[cur.posts.length - 1].id : 0;
    const d = await api(`/channels/${v.id}/posts${last ? `?after=${last}` : ''}`).catch((e) => { toast(e.message, 'warn'); return null; });
    if (!d) return;
    if (last) {
      if (!d.posts.length) return;
      if (d.posts.some((p) => p.author?.id !== S.me.id)) Sound.play('message');
      cur.posts = cur.posts.concat(d.posts);
      const m = $('#msgs'); if (m) { m.innerHTML = postsHTML(); scrollChat(); }
    } else S.thread = d;
  }
  function linkify(s) { return esc(s).replace(/@([a-z0-9._-]{3,30})/gi, '<span class="mention">@$1</span>').replace(/\bhttps?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer nofollow">${u}</a>`); }
  function fileHTML(f) {
    if (!f) return '';
    if (f.kind === 'image') return `<a href="/api/files/${f.id}" target="_blank" rel="noopener"><img class="photo" src="/api/files/${f.id}" alt="Photo: ${esc(f.name)}" loading="lazy"></a>`;
    return `<a class="file-card" href="/api/files/${f.id}" target="_blank" rel="noopener"><span class="f-em" aria-hidden="true">🎼</span><span><b>${esc(f.name)}</b><small>PDF · ${fmtSize(f.size)} · tap to open</small></span></a>`;
  }
  function postsHTML() {
    const t = S.thread;
    if (!t.posts.length) return `<div class="empty"><div class="e">👋</div><p>${t.channel.kind === 'dm' ? `Say hi to ${esc(first(t.peer?.display_name))}!` : 'No messages yet — start the thread!'}</p></div>`;
    let prev = null, prevDay = null;
    return t.posts.map((p) => {
      const d = new Date(p.created_at);
      const dayHdr = !prevDay || !sameDay(prevDay, d) ? `<div class="day-sep"><span>${dayLabel(d)}</span></div>` : '';
      const cont = prev && prev.author?.id === p.author?.id && (d - new Date(prev.created_at)) < 5 * 60e3 && !dayHdr;
      prev = p; prevDay = d;
      const mine = p.author?.id === S.me.id;
      return `${dayHdr}<div class="post ${mine ? 'mine' : ''} ${cont ? 'cont' : ''} ${p.deleted ? 'deleted' : ''}">
        ${ava(p.author?.avatar)}
        <div><div class="p-head"><span class="p-name">${esc(p.author?.display_name || 'Former member')}</span>${p.author?.admin ? '<span class="p-tag admin">Admin</span>' : ''}${p.author?.section && t.channel.kind !== 'dm' ? `<span class="p-tag">${secEm(p.author.section)} ${secName(p.author.section)}</span>` : ''}<span class="p-time">${time(p.created_at)}</span></div>
          <div class="p-body">${p.deleted ? 'Message removed' : linkify(p.body)}</div>${p.deleted ? '' : fileHTML(p.file)}</div>
        ${p.deleted ? '<span></span>' : `<button class="p-more" data-act="post-menu" data-id="${p.id}" aria-label="More options">${I.more}</button>`}</div>`;
    }).join('');
  }
  function viewThread() {
    const t = S.thread && S.thread.channel.id === S.view.id ? S.thread : null;
    if (!t) return subHeader('…') + empty('⏳', 'Loading…');
    const c = t.channel;
    const title = c.is_group ? `<span>👥 ${esc(c.name)}</span>` : c.kind === 'dm' ? `${ava(t.peer?.avatar, 'sm')}<span>${esc(t.peer?.display_name || 'Message')}</span>` : `<span>${c.kind === 'section' ? secEm(c.section) + ' ' : '# '}${esc(c.name)}</span>`;
    const canPost = !c.locked || S.me.is_admin;
    return `${subHeader(title, c.is_group ? `<button class="icon-button" data-act="group-menu" aria-label="Group options">${I.more}</button>` : c.kind !== 'dm' && (c.mine || S.me.is_admin) && c.kind === 'topic' ? `<button class="icon-button" data-act="thread-menu" aria-label="Thread options">${I.more}</button>` : '')}
      ${c.is_group ? `<p class="note small">👥 ${t.members.map((m) => esc(first(m.display_name))).join(', ')}${c.expires_at ? ` · ⏳ ends ${whenText(c.expires_at)}` : ''}</p>` : ''}
      ${c.about ? `<p class="note small">${esc(c.about)}</p>` : ''}
      <div class="posts" id="msgs" aria-live="polite">${postsHTML()}</div>
      <div class="chat-pad"></div>
      ${canPost ? `<form class="composer" data-form="post">
        ${S.attach ? `<div class="attach-preview">📎 ${esc(S.attach.name)} <small>(${S.attach.kind === 'pdf' ? 'PDF' : 'photo'})</small><button type="button" class="linkish" data-act="attach-clear">Remove</button></div>` : ''}
        <input type="file" id="file-in" accept="application/pdf,image/*" hidden>
        <button type="button" class="attach" data-act="attach" aria-label="Attach sheet music or a photo">📎</button>
        <label class="sr" for="msg-input">Message</label>
        <textarea id="msg-input" class="field" name="body" rows="1" maxlength="2000" placeholder="${c.kind === 'dm' && !c.is_group ? `Message ${esc(first(t.peer?.display_name))}…` : `Message ${esc(c.name)}…`}" enterkeyhint="send"></textarea>
        <button class="primary-button" type="submit" aria-label="Send">${I.send}</button>
      </form>` : '<p class="guard-note">📌 Only admins can post in this thread.</p>'}`;
  }
  function scrollChat(force) {
    if (!$('#msgs')) return;
    const near = innerHeight + scrollY > document.body.scrollHeight - 260;
    if (force || near) requestAnimationFrame(() => scrollTo(0, document.body.scrollHeight));
  }

  // ================================================================ Band Room Feed
  const REACT = { fire: ['🔥', 'Fire'], lol: ['😂', 'LOL'], dead: ['💀', 'Dead'], drum: ['🥁', 'Ba-dum-tss'], toot: ['🎺', 'Toot'], clap: ['👏', 'Clap'], salute: ['🫡', 'Mark time'], trophy: ['🏆', 'Trophy'], heart: ['💜', 'Love'], encore: ['📯', 'Encore'] };
  function reactBar(p) {
    const keys = Object.keys(REACT);
    const used = keys.filter((k) => p.reactions[k]);
    return `<div class="react-bar">${used.map((k) => `<button class="react ${p.reactions[k].mine ? 'on' : ''}" data-act="react" data-id="${p.id}" data-e="${k}" aria-pressed="${p.reactions[k].mine}" aria-label="${REACT[k][1]}: ${p.reactions[k].n}"><span aria-hidden="true">${REACT[k][0]}</span>${p.reactions[k].n}</button>`).join('')}
      ${isStudent() ? `<button class="react add" data-act="react-pick" data-id="${p.id}" aria-label="Add a reaction">＋${used.length ? '' : ' React'}</button>` : ''}</div>`;
  }
  function pollHTML(p) {
    const pl = p.poll; if (!pl) return '';
    const voted = !!pl.my_vote;
    return `<div class="poll ${p.kind}">${pl.options.map((o) => {
      const pct = pl.total ? Math.round(o.n * 100 / pl.total) : 0;
      return `<button class="poll-opt ${pl.my_vote === o.id ? 'mine' : ''}" data-act="vote" data-id="${p.id}" data-o="${o.id}" ${!isStudent() ? 'disabled' : ''}>
        <span class="bar" style="width:${voted || p.kind === 'ask' ? pct : 0}%"></span><span class="lbl">${esc(o.label)}</span>${voted || p.kind === 'ask' ? `<span class="pct">${p.kind === 'ask' ? o.n : pct + '%'}</span>` : ''}
        ${o.voters?.length ? `<span class="voters">${o.voters.slice(0, 8).map((v) => ava(v.avatar)).join('')}</span>` : ''}</button>`;
    }).join('')}<p class="tiny muted">${p.kind === 'ask' ? 'Tap to answer' : `${pl.total} vote${pl.total === 1 ? '' : 's'}${voted ? ' · tap to change' : ' · tap to vote'}`}</p></div>`;
  }
  function feedCard(p, { full = false } = {}) {
    if (p.deleted) return '';
    return `<article class="fpost ${p.official ? 'official' : ''}">
      <header>${ava(p.author?.avatar)}<div class="grow"><b>${esc(p.author?.display_name || 'Former member')}</b>${p.official ? ' <span class="p-tag admin">📣 Official</span>' : ''}
        <span class="tiny muted">${p.author?.section ? secEm(p.author.section) + ' ' + secName(p.author.section) + ' · ' : ''}${ago(p.created_at)}</span></div>
        <button class="p-more" data-act="feed-menu" data-id="${p.id}" aria-label="More options">${I.more}</button></header>
      ${p.kind === 'ask' ? '<span class="ask-tag">🙋 Who\'s in?</span>' : p.kind === 'poll' ? '<span class="ask-tag">📊 Poll</span>' : ''}
      ${p.body ? `<p class="f-body">${linkify(p.body)}</p>` : ''}
      ${p.file ? (p.file.kind === 'image' ? `<img class="f-photo" src="/api/files/${p.file.id}" alt="Photo posted by ${esc(first(p.author?.display_name))}" loading="lazy">` : fileHTML(p.file)) : ''}
      ${pollHTML(p)}
      ${reactBar(p)}
      ${!full && isStudent() ? `<button class="linkish small replies-link" data-act="open" data-view="post" data-id="${p.id}">💬 ${p.replies ? `${p.replies} repl${p.replies === 1 ? 'y' : 'ies'}` : 'Reply'}</button>` : ''}
    </article>`;
  }
  function feedComposer(eventId) {
    return `<form class="panel stack f-compose" data-form="feed-post">${eventId ? `<input type="hidden" name="event_id" value="${eventId}">` : ''}
      <input type="hidden" name="kind" value="post">
      <textarea class="field" name="body" rows="2" maxlength="1500" placeholder="${eventId ? 'Live from the event… 🎺' : 'What happened at rehearsal? 📸'}"></textarea>
      <div class="poll-fields" hidden><input class="field" name="o1" placeholder="Choice 1" maxlength="60"><input class="field" name="o2" placeholder="Choice 2" maxlength="60"><input class="field" name="o3" placeholder="Choice 3 (optional)" maxlength="60"><input class="field" name="o4" placeholder="Choice 4 (optional)" maxlength="60"></div>
      ${S.feedAttach ? `<div class="attach-preview">📷 ${esc(S.feedAttach.name)}<button type="button" class="linkish" data-act="feed-attach-clear">Remove</button></div>` : ''}
      <input type="file" id="feed-file" accept="image/*" hidden>
      <div class="row wrap small-gap">
        <button type="button" class="chip" data-act="feed-photo">📷 Photo</button>
        <button type="button" class="chip" data-act="feed-kind" data-k="poll" aria-pressed="false">📊 Poll</button>
        <button type="button" class="chip" data-act="feed-kind" data-k="ask" aria-pressed="false">🙋 Who's in?</button>
        ${S.me.is_admin ? '<label class="check small"><input type="checkbox" name="official"><span>📣 Official (parents see it too)</span></label>' : ''}
        <span class="grow"></span><button class="primary-button sm" type="submit">Post</button></div>
      ${errP}</form>`;
  }
  function viewFeed() {
    const f = S.feed;
    return `${sectionTitle('Band Room 📸')}
      <p class="note">Students only — post the funny moments, memes and backstage pics. Be kind: posts are checked and anyone can report.</p>
      ${feedComposer()}
      ${!f ? empty('⏳', 'Loading…') : f.length ? f.map((p) => feedCard(p)).join('') + (S.feedMore ? '<button class="ghost-button block" data-act="feed-more">Load more</button>' : '<p class="center tiny muted">You\'re all caught up 🎉</p>') : empty('📸', 'Nothing posted yet. Be the first!')}`;
  }
  function viewPost() {
    const d = S.post && S.post.post?.id === S.view.id ? S.post : null;
    if (!d) return subHeader('Post') + empty('⏳', 'Loading…');
    return `${subHeader('Post')}${feedCard(d.post, { full: true })}
      <div class="replies">${d.replies.filter((r) => !r.deleted).map((r) => `<div class="post ${r.mine ? 'mine' : ''}">${ava(r.author?.avatar)}<div>
        <div class="p-head"><span class="p-name">${esc(r.author?.display_name || 'Former member')}</span><span class="p-time">${ago(r.created_at)}</span></div>
        ${r.body ? `<div class="p-body">${linkify(r.body)}</div>` : ''}${r.file ? `<img class="photo" src="/api/files/${r.file.id}" alt="Photo reply" loading="lazy">` : ''}</div>
        <button class="p-more" data-act="reply-menu" data-id="${r.id}" aria-label="More options">${I.more}</button></div>`).join('') || '<p class="small muted center">No replies yet.</p>'}</div>
      <div class="chat-pad"></div>
      <form class="composer" data-form="reply">
        ${S.replyAttach ? `<div class="attach-preview">📷 ${esc(S.replyAttach.name)}<button type="button" class="linkish" data-act="reply-attach-clear">Remove</button></div>` : ''}
        <input type="file" id="reply-file" accept="image/*" hidden>
        <button type="button" class="attach" data-act="reply-photo" aria-label="Reply with a photo">📷</button>
        <label class="sr" for="msg-input">Reply</label>
        <textarea id="msg-input" class="field" name="body" rows="1" maxlength="1000" placeholder="Reply…" enterkeyhint="send"></textarea>
        <button class="primary-button" type="submit" aria-label="Send">${I.send}</button></form>`;
  }
  function sheetReactPick(id) {
    openSheet(`<div class="stack"><h2>React</h2><div class="react-grid">${Object.entries(REACT).map(([k, [e, l]]) => `<button class="react-big" data-act="react" data-id="${id}" data-e="${k}"><span>${e}</span>${l}</button>`).join('')}</div>${cancelBtn}</div>`);
  }

  // ================================================================ Chat tab (students): sections + messages
  function viewChat() {
    const seg = S.chatSeg;
    const b = S.badges;
    return `${sectionTitle('Chat')}
      <div class="chips seg chat-seg" role="tablist"><button class="chip" data-act="chat-seg" data-s="sections" aria-pressed="${seg === 'sections'}">🥁 Sections${b.threads ? ` (${b.threads})` : ''}</button>
        <button class="chip" data-act="chat-seg" data-s="messages" aria-pressed="${seg === 'messages'}">💬 Messages + groups${b.dms ? ` (${b.dms})` : ''}</button></div>
      ${seg === 'sections' ? viewThreads().replace(/^<div class="section-title">.*?<\/div>/s, '') : viewDms()}`;
  }
  function sheetGroup() {
    const ms = (S.members || []).filter((m) => m.id !== S.me.id && !m.blocked);
    const evs = (S.events || []).filter((e) => !e.cancelled);
    openSheet(`<form data-form="group" class="stack"><h2>New group 👥</h2>
      <label class="fld"><span>Group name</span><input class="field" name="name" maxlength="50" required placeholder="Bus 2 crew, Saturday carpool, Low brass besties"></label>
      <fieldset class="stack-sm"><span>Who's in?</span><div class="chips group-pick" role="group">${ms.map((m) => `<button type="button" class="chip" data-act="toggle-chip" data-v="${m.id}" aria-pressed="false">${AVATAR[m.avatar]?.[0] || ''} ${esc(m.display_name)}</button>`).join('') || '<p class="small muted">Loading people…</p>'}</div></fieldset>
      <label class="check"><input type="checkbox" name="temp" data-act="noop"><span>⏳ Temporary — disappears after a date (great for trips + carpools)</span></label>
      <label class="fld"><span>Ends on (if temporary)</span><input class="field" type="date" name="ends" min="${localDate()}" value="${localDate(new Date(Date.now() + 3 * 864e5))}"></label>
      ${evs.length ? `<label class="fld"><span>For an event? (optional)</span><select class="field" name="event_id"><option value="">No</option>${evs.map((e) => `<option value="${e.id}">${esc(e.title)} · ${dayLabel(new Date(e.starts_at))}</option>`).join('')}</select></label>` : ''}
      ${errP}<button class="primary-button block big" type="submit">Create group</button>${cancelBtn}</form>`);
  }

  // ================================================================ Competition Day Hub
  let countdownTimer = null;
  function countdownText(iso) {
    const ms = new Date(iso) - Date.now();
    if (ms <= 0) return 'Happening now! 🎺';
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 3600e3) % 24, m = Math.floor(ms / 60e3) % 60, s = Math.floor(ms / 1000) % 60;
    return d ? `${d}d ${h}h ${m}m` : `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }
  function tickCountdowns() { $$('[data-countdown]').forEach((el) => { el.textContent = countdownText(el.dataset.countdown); }); }
  function countdownCard() {
    const next = (S.events || []).find((e) => !e.cancelled && ['competition', 'game', 'concert'].includes(e.kind));
    if (!next) return '';
    return `<button class="countdown-card" data-act="open" data-view="hub" data-id="${next.id}">
      <span class="cd-label">${EV_EM[next.kind]} Next ${next.kind}</span><b class="cd-title">${esc(next.title)}</b>
      <span class="cd-time" data-countdown="${next.starts_at}">${countdownText(next.starts_at)}</span>
      <span class="cd-sub">${evWhen(next)}${next.call_time ? ` · call ${hm(next.call_time)}` : ''} · Open the hub →</span></button>`;
  }
  function viewHub() {
    const h = S.hub;
    if (!h || h.event.id !== S.view.id) return subHeader('Event') + empty('⏳', 'Loading…');
    const e = h.event, isBig = ['competition', 'game', 'concert'].includes(e.kind);
    const myBus = h.buses.find((b) => b.id === h.my_bus);
    const preds = (S.hubFeed || []).filter((p) => p.kind === 'poll');
    const updates = (S.hubFeed || []).filter((p) => p.kind !== 'poll');
    return `${subHeader(`${EV_EM[e.kind] || '📌'} ${isBig ? 'Hub' : 'Event'}`, S.me.is_admin ? '<button class="warm-button sm" data-act="hub-edit">Edit</button>' : '')}
      <div class="hub-hero ${e.cancelled ? 'cancelled' : ''}">
        <h2>${esc(e.title)}</h2>
        <p>${evWhen(e)}${e.location ? ` · 📍 ${esc(e.location)}` : ''}</p>
        ${e.cancelled ? '<span class="pill st-declined">Cancelled</span>' : `<div class="cd-big" data-countdown="${e.starts_at}">${countdownText(e.starts_at)}</div>`}
        ${e.call_time ? `<div class="call-time">Call time <b>${hm(e.call_time)}</b></div>` : ''}
        ${myBus ? `<div class="my-bus">🚌 You're on <b>${esc(myBus.name)}</b>${myBus.notes ? ` · ${esc(myBus.notes)}` : ''}</div>` : ''}
        ${e.details ? `<p class="small">${esc(e.details)}</p>` : ''}
      </div>
      <div class="panel stack"><h3>🙋 Who's going?</h3>
        <div class="row wrap small-gap">${['going', 'maybe', 'no'].map((st) => `<button class="chip" data-act="ev-rsvp" data-id="${e.id}" data-s="${st}" aria-pressed="${h.my_rsvp === st}">${{ going: "✅ I'm going", maybe: '🤔 Maybe', no: "❌ Can't" }[st]}</button>`).join('')}</div>
        ${h.going.length ? `<div class="going-row">${h.going.slice(0, 24).map((g) => ava(g.avatar)).join('')}<span class="small">${h.going.map((g) => esc(first(g.display_name))).slice(0, 8).join(', ')}${h.going.length > 8 ? ` +${h.going.length - 8}` : ''}</span></div>` : `<p class="small muted">${h.counts.going} going${h.counts.maybe ? ` · ${h.counts.maybe} maybe` : ''}</p>`}
        ${isStudent() ? `<button class="ghost-button sm" data-act="group-for-event" data-id="${e.id}">👥 Start a group chat for this trip</button>` : ''}</div>
      ${h.schedule.length ? `<div class="panel stack"><h3>🕒 Schedule</h3><ol class="timeline">${h.schedule.map((s) => `<li><b>${hm(s.at_time)}</b><span>${esc(s.label)}</span></li>`).join('')}</ol></div>` : ''}
      ${h.order.length ? `<div class="panel stack"><h3>🎺 Performance order</h3><ol class="perf-order">${h.order.map((o) => `<li class="${o.is_us ? 'us' : ''}"><span class="pos">${o.position}</span><span class="grow">${esc(o.band_name)}${o.is_us ? ' ⭐' : ''}</span>${o.perform_at ? `<b>${hm(o.perform_at)}</b>` : ''}</li>`).join('')}</ol></div>` : ''}
      ${h.buses.length ? `<div class="panel stack"><h3>🚌 Buses</h3>${h.buses.map((b) => `<details class="bus ${b.id === h.my_bus ? 'mine' : ''}" ${b.id === h.my_bus ? 'open' : ''}><summary><b>${esc(b.name)}</b> · ${b.riders.length} people${b.notes ? ` · ${esc(b.notes)}` : ''}${b.id === h.my_bus ? ' · <b>you</b>' : ''}</summary>
        <p class="small">${b.riders.map((r) => esc(r.display_name)).join(', ') || 'No one yet'}</p></details>`).join('')}</div>` : ''}
      ${isStudent() || preds.length ? `${sectionTitle('🔮 Predictions', isStudent() ? `<button class="ghost-button sm" data-act="predict" data-id="${e.id}">+ Prediction</button>` : '')}${preds.length ? preds.map((p) => feedCard(p)).join('') : '<p class="small muted">Who takes 1st? Rival matchups? Make the first prediction.</p>'}` : ''}
      ${sectionTitle('📡 Live updates')}
      ${isStudent() ? feedComposer(e.id) : ''}
      ${updates.length ? updates.map((p) => feedCard(p)).join('') : empty('📡', isStudent() ? 'Post updates and pics from the event here.' : 'Official updates from the band will show here.')}`;
  }
  function sheetHubEdit() {
    const h = S.hub;
    const schedTxt = h.schedule.map((s) => `${s.at_time} ${s.label}`).join('\n');
    const orderTxt = h.order.map((o) => `${o.perform_at || ''} ${o.band_name}${o.is_us ? ' *' : ''}`.trim()).join('\n');
    const busTxt = h.buses.map((b) => `${b.name}: ${b.riders.map((r) => r.display_name).join(', ')}`).join('\n');
    openSheet(`<form data-form="hub-edit" class="stack"><h2>Edit hub</h2>
      <label class="fld"><span>Schedule — one per line: <code>14:30 Warm-up</code></span><textarea class="field mono" name="schedule" rows="6" placeholder="06:45 Call time — band room\n07:15 Buses leave\n13:40 Warm-up\n14:15 We perform!">${esc(schedTxt)}</textarea></label>
      <label class="fld"><span>Performance order — one band per line, time first, <code>*</code> = us</span><textarea class="field mono" name="order" rows="6" placeholder="14:00 Harrisburg\n14:15 Our band *\n14:30 Brandon Valley">${esc(orderTxt)}</textarea></label>
      <label class="fld"><span>Buses — <code>Bus 1: percussion, guard, Ava</code> (sections or names)</span><textarea class="field mono" name="buses" rows="4" placeholder="Bus 1: percussion, guard\nBus 2: brass, woodwinds, front">${esc(busTxt)}</textarea></label>
      ${errP}<button class="primary-button block big" type="submit">Save hub</button>${cancelBtn}</form>`);
  }

  // ================================================================ tools
  const TOOLS = [['metronome', '⏱️', 'Metronome'], ['rudiments', '🥁', 'Rudiments'], ['tuner', '🎯', 'Tuner'], ['jokes', '😂', 'Jokes']];
  function viewTools() {
    return `${sectionTitle('Tools')}
      <div class="tool-tabs" role="tablist">${TOOLS.map(([k, e, l]) => `<button role="tab" data-act="tool" data-k="${k}" aria-pressed="${S.tool === k}" aria-selected="${S.tool === k}"><span aria-hidden="true">${e}</span>${l}</button>`).join('')}</div>
      ${S.tool === 'jokes' ? `<div class="stack">${['all', 'percussion', 'brass', 'woodwinds', 'guard', 'front', 'leadership'].map((k) => `<div class="joke"><span class="jk-em" aria-hidden="true">${secEm(k)}</span><span class="jk-label">${secName(k)}</span><p>${esc(window.jokeOfDay(k))}</p></div>`).join('')}<p class="small muted center">New jokes every day 🎉</p></div>`
        : '<div id="tool-mount"></div>'}`;
  }
  function mountTool() {
    const el = $('#tool-mount');
    if (!el || !window.BandTools) return;
    const fn = window.BandTools[S.tool];
    if (fn) toolCleanup = fn(el);
  }

  // ================================================================ calendar
  function viewCalendar() {
    const ev = S.events, sc = S.school;
    const head = S.view ? subHeader('Calendar', S.me.is_admin ? '<button class="warm-button sm" data-act="event-new">+ Event</button>' : '') : sectionTitle('Calendar', S.me.is_admin ? '<button class="warm-button sm" data-act="event-new">+ Event</button>' : '');
    if (!ev) return head + empty('⏳', 'Loading…');
    const today = localDate();
    const items = [
      ...ev.map((e) => ({ date: localDate(new Date(e.starts_at)), sort: e.starts_at, html: eventCard(e) })),
      ...(sc || []).filter((c) => c.end_date >= today).slice(0, 30).map((c) => ({ date: c.start_date, sort: c.start_date + 'T00', html: `<div class="ev school"><span class="ev-em" aria-hidden="true">${{ no_school: '🏖️', first_day: '🎒', last_day: '🎉', resume: '📚', quarter_end: '⭐', event: '🏫' }[c.kind]}</span><div><h3>${esc(c.title)}</h3><p class="small">${c.start_date === c.end_date ? fmtDay(c.start_date) : `${fmtDay(c.start_date)} – ${fmtDay(c.end_date)}`}${c.kind === 'no_school' ? ' · No school' : ''}</p></div></div>` })),
    ].sort((a, b) => a.sort.localeCompare(b.sort));
    let lastMonth = '';
    return `${head}<p class="note">Band events + the Sioux Falls high school calendar.</p>
      ${items.length ? items.map((it) => { const m = new Date(it.date + 'T12:00').toLocaleDateString([], { month: 'long', year: 'numeric' }); const hdr = m !== lastMonth ? `<div class="agenda-day">${m}</div>` : ''; lastMonth = m; return hdr + it.html; }).join('') : empty('📅', 'Nothing coming up.')}`;
  }
  const fmtDay = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  // ================================================================ rides
  const RIDE_EM = { rain: '🌧️', snow: '🌨️', storm: '⛈️', cold: '🥶', late: '🌙', gear: '🥁', other: '🚗' };
  function rideCard(r) {
    return `<div class="panel ride-card stack-sm ${r.status === 'open' ? 'tone-yellow' : ''}">
      <div class="row"><span class="ride-em" aria-hidden="true">${RIDE_EM[r.reason] || '🚗'}</span><div class="grow">
        <h3>${esc(first(r.requested_by.display_name))} needs a ${r.kind === 'dropoff' ? 'drop-off' : r.kind === 'pickup' ? 'pickup' : 'ride'}</h3>
        <p class="small">${whenText(r.starts_at)} · ${esc(r.from_place)} → ${esc(r.to_place)}${r.seats > 1 ? ` · ${r.seats} people` : ''}</p></div></div>
      ${r.note ? `<p class="small muted">“${esc(r.note)}”</p>` : ''}
      <div class="row wrap small-gap">${r.status === 'claimed' ? `<span class="pill st-approved">🚗 ${r.driving ? "You're driving" : `${esc(first(r.claimed_by.display_name))}${r.claimed_by.teen ? ' (student driver)' : ''} is driving`}</span>` : '<span class="pill st-waiting">⏳ Needs a driver</span>'}</div>
      ${r.claimed_by?.phone && r.mine ? `<p class="small">📱 ${esc(r.claimed_by.phone)}</p>` : ''}
      <div class="row wrap">
        ${canDrive() && r.status === 'open' && !r.mine ? `<button class="warm-button" data-act="ride-claim" data-id="${r.id}">🚗 I've got it!</button>` : ''}
        ${r.driving ? `<button class="ghost-button sm" data-act="ride-unclaim" data-id="${r.id}">Can't make it</button>` : ''}
        ${r.mine ? `<button class="ghost-button sm" data-act="ride-cancel" data-id="${r.id}">Cancel</button>` : ''}</div></div>`;
  }
  function offerCard(o) {
    return `<div class="panel stack-sm">
      <div class="row">${ava(o.driver.avatar)}<div class="grow"><h3>${o.mine ? 'You' : esc(o.driver.display_name)}${o.driver.teen ? ' <span class="pill">Student driver</span>' : ''}</h3>
        <p class="small">${whenText(o.starts_at)} · ${esc(o.from_place)} → ${esc(o.to_place)}</p></div></div>
      ${o.note ? `<p class="small muted">“${esc(o.note)}”</p>` : ''}
      <div class="seatbar" aria-label="${o.taken} of ${o.seats} seats taken">${Array.from({ length: o.seats }, (_, i) => `<i class="${i < o.taken ? 'taken' : ''}"></i>`).join('')}</div>
      <p class="small">${o.open ? `${o.open} seat${o.open > 1 ? 's' : ''} open` : 'Full'}${o.riders.length ? ` · ${o.riders.map((x) => esc(first(x.display_name))).join(', ')}` : ''}</p>
      <div class="row wrap">
        ${isStudent() && !o.mine && !o.joined && o.open ? `<button class="warm-button" data-act="seat" data-id="${o.id}">🙋 Grab a seat</button>` : ''}
        ${o.joined ? `<button class="ghost-button sm" data-act="seat-leave" data-id="${o.id}">Give up my seat</button>` : ''}
        ${o.mine ? `<button class="ghost-button sm" data-act="offer-cancel" data-id="${o.id}">Cancel ride</button>` : ''}</div></div>`;
  }
  function viewRides() {
    const rides = S.rides, offers = S.offers;
    return `${subHeader('Rides 🚗')}
      <div class="row wrap">${isStudent() ? '<button class="warm-button" data-act="ride-sheet">🙋 Ask for a ride</button>' : ''}${canDrive() ? '<button class="primary-button" data-act="offer-sheet">🚙 Offer a ride</button>' : ''}</div>
      <p class="note">${canDrive() ? 'Drivers (parents and licensed students) see every ride request — the first to tap "I\'ve got it" drives.' : 'Ask for a ride and every band parent + student driver gets it. Turn on “I can drive” in Me if you have your license.'}</p>
      ${sectionTitle('Ride offers')}${!offers ? empty('⏳', 'Loading…') : offers.length ? offers.map(offerCard).join('') : empty('🚙', 'No one is offering rides right now.')}
      ${sectionTitle(canDrive() ? 'Ride requests' : 'My ride requests')}${!rides ? empty('⏳', 'Loading…') : rides.length ? rides.map(rideCard).join('') : empty('🚗', 'No ride requests.')}`;
  }

  // ================================================================ hangouts + spots
  const SPOT_EM = { house: '🏠', park: '🌳', school: '🏫', food: '🍕', music: '🎸', other: '📍' };
  function hangoutCard(h) {
    return `<div class="panel stack-sm">
      <div class="row"><span class="ride-em" aria-hidden="true">${SPOT_EM[h.spot_kind] || '🍕'}</span><div class="grow"><h3>${esc(h.title)}</h3>
        <p class="small">${whenText(h.starts_at)} · ${esc(h.place || '')}</p><p class="tiny muted">by ${esc(first(h.by.display_name))}</p></div></div>
      ${h.details ? `<p class="small muted">${esc(h.details)}</p>` : ''}
      <div class="going-row">${h.going.map((g) => ava(g.avatar)).join('')}<span class="small">${h.going.length} going${h.maybe ? ` · ${h.maybe} maybe` : ''}</span></div>
      <div class="row wrap small-gap">${['going', 'maybe', 'no'].map((s) => `<button class="chip" data-act="rsvp" data-id="${h.id}" data-s="${s}" aria-pressed="${h.my_rsvp === s}">${{ going: "✅ I'm in", maybe: '🤔 Maybe', no: "❌ Can't" }[s]}</button>`).join('')}
        ${h.mine ? `<button class="linkish small" data-act="hangout-cancel" data-id="${h.id}">Cancel</button>` : ''}</div></div>`;
  }
  function viewHangouts() {
    return `${subHeader('Hangouts 🍕', '<button class="warm-button sm" data-act="hangout-sheet">+ New</button>')}
      <p class="note">Make a plan, pick a spot, see who's in. Students only.</p>
      ${!S.hangouts ? empty('⏳', 'Loading…') : S.hangouts.length ? S.hangouts.map(hangoutCard).join('') : empty('🍕', 'No hangouts planned yet.', '<button class="primary-button" data-act="hangout-sheet" style="margin-top:12px">Plan one</button>')}
      ${sectionTitle('Hangout spots', '<button class="ghost-button sm" data-act="spot-sheet">+ Spot</button>')}
      <div class="panel list">${(S.spots || []).map((s) => `<div class="row-btn static"><span class="t-icon" aria-hidden="true">${SPOT_EM[s.kind] || '📍'}</span>
        <span class="grow"><b>${esc(s.name)}</b><span class="sub">${esc(s.address || s.notes || ({ house: 'Someone\'s house', park: 'Park', school: 'School', food: 'Food', music: 'Music spot', other: 'Spot' }[s.kind]))}</span></span>
        ${s.created_by === S.me.id || S.me.is_admin ? `<button class="ghost-button sm" data-act="spot-remove" data-id="${s.id}">Remove</button>` : ''}</div>`).join('') || '<p class="small muted pad">Add your favorite places: a park, the band room, a pizza place, someone\'s house.</p>'}</div>`;
  }

  // ================================================================ me + settings
  function viewMe() {
    const p = S.me.notify_prefs || {};
    const tog = (k, label) => `<label class="switch-row"><span>${label}</span><input type="checkbox" role="switch" data-act="pref" data-k="${k}" ${p[k] !== false ? 'checked' : ''}></label>`;
    return `${sectionTitle('Me')}
      <div class="panel stack center-text">
        <div class="ava-xl-wrap">${ava(S.me.avatar, 'xl')}</div>
        <h2>${esc(S.me.display_name)}</h2>
        <p class="small muted">@${esc(S.me.username)}${isStudent() ? ` · ${secEm(S.me.section)} ${secName(S.me.section)}${S.me.instrument ? ' · ' + esc(S.me.instrument) : ''}${S.me.grade ? ` · ${S.me.grade}th grade` : ''}` : ' · Parent'}${S.me.is_admin ? ' · Admin' : ''}</p>
        <div class="row center-row"><button class="ghost-button sm" data-act="profile-edit">✏️ Edit profile</button>${S.me.is_admin ? '<button class="warm-button sm" data-act="open" data-view="admin">🛡️ Admin</button>' : ''}</div>
      </div>
      ${isStudent() ? `<div class="panel stack"><h3>🚗 Driving</h3><label class="switch-row"><span>I have my license and can give rides</span><input type="checkbox" role="switch" data-act="can-drive" ${S.me.can_drive ? 'checked' : ''}></label>
        <p class="small muted">Drivers see ride requests and can offer rides. Only drive if you're allowed to carry passengers.</p></div>` : ''}
      ${stylePicker()}
      ${soundPanel()}
      <div class="panel stack"><h3>Notifications</h3>${tog('messages', 'Messages + mentions')}${tog('rides', 'Rides')}${tog('events', 'Band events')}${isStudent() ? tog('hangouts', 'Hangouts') : ''}</div>
      <form class="panel stack" data-form="phone"><h3>📱 Text alerts</h3>
        <label class="fld"><span>Mobile number</span><input class="field" name="phone" type="tel" inputmode="tel" value="${esc(S.me.phone || '')}" placeholder="(605) 555-0123"></label>
        <label class="check"><input type="checkbox" name="sms_opt_in" ${S.me.sms_opt_in ? 'checked' : ''}><span>Text me ride updates and important alerts. Reply STOP to opt out.</span></label>
        <p class="small muted">${S.smsLive ? 'Texting is live.' : 'Texting turns on once the admin connects Twilio — alerts still show in the app.'}</p>
        <p class="form-error" data-err role="alert"></p><button class="primary-button sm" type="submit">Save</button></form>
      <form class="panel stack" data-form="password"><h3>Change password</h3>
        <label class="fld"><span>Current password</span><input class="field" name="current_password" type="password" required autocomplete="current-password"></label>
        <label class="fld"><span>New password (8+)</span><input class="field" name="new_password" type="password" minlength="8" required autocomplete="new-password"></label>
        <p class="form-error" data-err role="alert"></p><button class="primary-button sm" type="submit">Update password</button></form>
      <div class="panel stack"><h3>Help + safety</h3>
        <p class="small">See something mean or unsafe? Tap <b>⋯</b> on the message → <b>Report</b>. You can also block anyone from the member list.</p>
        <p class="small">Going through something hard? Call or text <b>988</b> any time, or talk to a teacher, counselor or the band director.</p></div>
      <button class="ghost-button block" data-act="logout">Log out</button>
      <p class="center"><button class="linkish small danger-link" data-act="delete-me">Delete my account</button></p>`;
  }

  // ================================================================ admin
  function viewAdmin() {
    const a = S.admin;
    if (!a) return subHeader('Admin') + empty('⏳', 'Loading…');
    const g = a.guard_week || {};
    const open = a.reports.filter((r) => r.status === 'open');
    return `${subHeader('Admin 🛡️')}
      <div class="panel stack"><h3>Join codes</h3>
        <div class="row spread wrap"><div><p class="small muted">Students</p><div class="code-big">${esc(a.codes.student)}</div></div><button class="ghost-button sm" data-act="code-reset" data-w="student">New code</button></div>
        <div class="row spread wrap"><div><p class="small muted">Parents</p><div class="code-big">${esc(a.codes.parent)}</div></div><button class="ghost-button sm" data-act="code-reset" data-w="parent">New code</button></div>
        <p class="small muted">Share these only with your band. Getting a new code stops the old one working (accounts already made keep working).</p></div>
      ${sectionTitle(`Reports${open.length ? ` (${open.length})` : ''}`)}
      ${a.reports.length ? a.reports.map((r) => `<div class="panel stack-sm ${r.status === 'open' ? 'tone-yellow' : ''}">
          <p><b>${esc(r.reporter_name || 'Someone')}</b> reported <b>${esc(r.reported_name || 'a member')}</b> · ${esc(r.reason)} · <span class="tiny">${ago(r.created_at)}</span></p>
          ${r.channel_name ? `<p class="tiny muted">in ${esc(r.channel_name)}</p>` : ''}
          ${r.post_id ? `<div class="report-quote">${r.post_deleted ? '<i>(removed)</i>' : esc(r.post_body || '')}${r.file_id ? `<br><a href="/api/files/${r.file_id}" target="_blank" rel="noopener">📎 ${esc(r.file_name)}</a>` : ''}</div>` : ''}
          ${r.details ? `<p class="small muted">“${esc(r.details)}”</p>` : ''}
          ${r.status === 'open' ? `<div class="row wrap">${r.post_id && !r.post_deleted ? `<button class="danger-button sm" data-act="report-resolve" data-id="${r.id}" data-remove="1">Remove message</button>` : ''}
            <button class="ghost-button sm" data-act="report-resolve" data-id="${r.id}">Looks OK</button>
            ${r.reported_id ? `<button class="ghost-button sm" data-act="member-pause" data-id="${r.reported_id}">Pause ${esc(first(r.reported_name))}</button>` : ''}</div>` : '<span class="pill st-approved">Resolved</span>'}
        </div>`).join('') : empty('✅', 'No reports. 👍')}
      <div class="panel stack"><h3>Guardrails this week</h3><p class="small muted">How many messages or photos were stopped. Private messages are never shown here.</p>
        <div class="guard-grid">${[['language', 'Language'], ['hate', 'Slurs / hate'], ['threat', 'Threats'], ['violence', 'Violence'], ['sexual', 'Sexual'], ['photo', 'Photos blocked'], ['selfharm', 'Support alerts']].map(([k, l]) => `<div><b>${g[k] || 0}</b><span class="tiny">${l}</span></div>`).join('')}</div></div>
      ${sectionTitle('Members')}
      <div class="panel list">${a.members.map((m) => `<div class="row-btn static">${ava(m.avatar)}<span class="grow"><b>${esc(m.display_name)}</b>${m.is_admin ? ' <span class="pill">Admin</span>' : ''}${m.status !== 'active' ? ' <span class="pill st-declined">Paused</span>' : ''}
          <span class="sub">${m.role === 'parent' ? 'Parent' : `${secEm(m.section)} ${secName(m.section)}${m.grade ? ` · ${m.grade}th` : ''}`} · @${esc(m.username)}</span></span>
          ${m.id === S.me.id ? '' : `<span class="row-actions"><button class="ghost-button sm" data-act="member-admin" data-id="${m.id}" data-v="${m.is_admin ? 0 : 1}">${m.is_admin ? 'Remove admin' : 'Make admin'}</button>
          <button class="ghost-button sm" data-act="${m.status === 'active' ? 'member-pause' : 'member-unpause'}" data-id="${m.id}">${m.status === 'active' ? 'Pause' : 'Unpause'}</button></span>`}</div>`).join('')}</div>
      <form class="panel stack" data-form="band-settings"><h3>Band + school day</h3>
        <label class="fld"><span>Band name</span><input class="field" name="band_name" value="${esc(a.settings.band_name || '')}" maxlength="60"></label>
        <label class="fld"><span>School</span><input class="field" name="school_name" value="${esc(a.settings.school_name || '')}" maxlength="60" placeholder="e.g. Lincoln High School"></label>
        <div class="row"><label class="fld grow"><span>Be there</span><input class="field" type="time" name="school_arrive" value="${esc(a.settings.school_arrive || '07:50')}"></label>
          <label class="fld grow"><span>First bell</span><input class="field" type="time" name="school_start" value="${esc(a.settings.school_start || '08:00')}"></label>
          <label class="fld grow"><span>Out</span><input class="field" type="time" name="school_end" value="${esc(a.settings.school_end || '15:20')}"></label></div>
        <p class="form-error" data-err role="alert"></p><button class="primary-button sm" type="submit">Save</button></form>`;
  }

  // ================================================================ notifications
  function viewNotifications() {
    const list = S.notes;
    const icon = { dm: '💬', mention: '💬', ride: '🚗', ride_update: '🚗', event: '📅', hangout: '🍕', safety: '🛡️' };
    return `${subHeader('Notifications', '<button class="linkish small" data-act="read-all">Mark all read</button>')}
      ${!list ? empty('⏳', 'Loading…') : !list.length ? empty('🔔', 'Nothing yet.') : `<div class="panel list">${list.map((n) => `<button class="row-btn ${n.read_at ? '' : 'unread-row'}" data-act="note" data-id="${n.id}" data-link="${esc(n.link || '')}">
        <span class="feed-icon" aria-hidden="true">${icon[n.type] || '🔔'}</span><span class="grow"><b>${esc(n.title)}</b>${n.body ? `<span class="sub">${esc(n.body)}</span>` : ''}<span class="tiny">${ago(n.created_at)}</span></span></button>`).join('')}</div>`}`;
  }

  // ================================================================ sheets
  function openSheet(html) {
    $('#modal-root').innerHTML = `<div class="sheet-backdrop" data-act="close-sheet-bg"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() { $('#modal-root').innerHTML = ''; document.body.style.overflow = ''; }
  const nowPlus = (min) => { const d = new Date(Date.now() + min * 60e3); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); return d; };
  const dtFields = (d) => `<div class="row"><label class="fld grow"><span>Day</span><input class="field" type="date" name="date" min="${localDate()}" value="${localDate(d)}" required></label>
      <label class="fld grow"><span>Time</span><input class="field" type="time" name="time" value="${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}" required></label></div>`;
  // all-day events show the day(s), not a clock time
  const evWhen = (e) => {
    if (!e.all_day) return whenText(e.starts_at);
    const a = dayLabel(new Date(e.starts_at)), b = e.ends_at ? dayLabel(new Date(e.ends_at)) : a;
    return `${a === b ? a : `${a} – ${b}`} · All day`;
  };
  const isoFrom = (fd) => new Date(`${fd.get('date')}T${fd.get('time')}`).toISOString();
  const cancelBtn = '<button type="button" class="ghost-button block" data-act="close-sheet">Cancel</button>';
  const errP = '<p class="form-error" data-err role="alert"></p>';

  function sheetThreadNew(section) {
    openSheet(`<form data-form="thread-new" class="stack"><input type="hidden" name="section" value="${esc(section)}">
      <h2>New thread in ${secEm(section)} ${secName(section)}</h2>
      <label class="fld"><span>Thread name</span><input class="field" name="name" maxlength="50" required placeholder="${isStudent() ? 'Movement 2 — drill set 14' : 'Competition day food'}"></label>
      <label class="fld"><span>What's it for? (optional)</span><input class="field" name="about" maxlength="120" placeholder="Snare + tenor parts, questions"></label>
      ${errP}<button class="primary-button block big" type="submit">Start thread</button>${cancelBtn}</form>`);
  }
  function sheetRide(reason) {
    const s = S.today?.schedule; const d = nowPlus(60);
    if (s?.end) { const [h, m] = s.end.split(':').map(Number); const e = new Date(); e.setHours(h, m, 0, 0); if (e > new Date()) d.setTime(e.getTime()); }
    openSheet(`<form data-form="ride" class="stack"><input type="hidden" name="reason" value="${esc(reason || 'other')}">
      <h2>Ask for a ride ${RIDE_EM[reason] || '🚗'}</h2>
      <div class="chips seg" role="radiogroup">${[['pickup', 'Pickup'], ['dropoff', 'Drop-off'], ['ride', 'Ride somewhere']].map(([k, l], i) => `<button type="button" class="chip" data-act="pick" data-name="kind" data-v="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>
      <input type="hidden" name="kind" value="pickup">
      ${dtFields(d)}
      <label class="fld"><span>From</span><input class="field" name="from_place" maxlength="80" required value="${isStudent() ? 'Band room' : ''}"></label>
      <label class="fld"><span>To</span><input class="field" name="to_place" maxlength="80" required placeholder="Home, Eastside, McKennan Park…"></label>
      <label class="fld"><span>How many people?</span><select class="field" name="seats">${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join('')}</select></label>
      <div class="chips" role="group" aria-label="Why">${[['late', '🌙 Late rehearsal'], ['gear', '🥁 Carrying gear'], ['rain', '🌧️ Rain'], ['snow', '🌨️ Snow'], ['cold', '🥶 Cold']].map(([k, l]) => `<button type="button" class="chip" data-act="pick" data-name="reason" data-v="${k}" aria-pressed="${reason === k}">${l}</button>`).join('')}</div>
      <label class="fld"><span>Note (optional)</span><input class="field" name="note" maxlength="160" placeholder="I'll wait by the band room doors"></label>
      <p class="small muted">Every band parent and student driver gets it. The first to say yes drives.</p>
      ${errP}<button class="warm-button block big" type="submit">Ask for a ride</button>${cancelBtn}</form>`);
  }
  function sheetOffer() {
    openSheet(`<form data-form="offer" class="stack"><h2>Offer a ride 🚙</h2>
      ${dtFields(nowPlus(60))}
      <label class="fld"><span>From</span><input class="field" name="from_place" maxlength="80" required value="Band room"></label>
      <label class="fld"><span>To</span><input class="field" name="to_place" maxlength="80" required placeholder="Eastside, Harrisburg, the game…"></label>
      <label class="fld"><span>Open seats</span><select class="field" name="seats">${[1, 2, 3, 4, 5, 6].map((n) => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="fld"><span>Note (optional)</span><input class="field" name="note" maxlength="160" placeholder="Room for one snare case"></label>
      ${errP}<button class="primary-button block big" type="submit">Post ride</button>${cancelBtn}</form>`);
  }
  async function sheetHangout() {
    if (!S.spots) S.spots = (await api('/spots')).spots;
    if (!S.members) S.members = (await api('/members').catch(() => ({ members: [] }))).members;
    openSheet(`<form data-form="hangout" class="stack"><h2>Plan a hangout 🍕</h2>
      <label class="fld"><span>What?</span><input class="field" name="title" maxlength="60" placeholder="Pizza after practice"></label>
      ${dtFields(nowPlus(120))}
      <label class="fld"><span>Where?</span><select class="field" name="spot_id"><option value="">Type a place below…</option>${S.spots.map((s) => `<option value="${s.id}">${SPOT_EM[s.kind] || '📍'} ${esc(s.name)}</option>`).join('')}</select></label>
      <label class="fld"><span>…or somewhere else</span><input class="field" name="place" maxlength="80" placeholder="Jake's house, the mall…"></label>
      <fieldset class="stack-sm"><span>Invite (optional)</span><div class="chips" role="group">${S.members.filter((m) => m.id !== S.me.id && !m.blocked).map((m) => `<button type="button" class="chip" data-act="toggle-chip" data-v="${m.id}" aria-pressed="false">${AVATAR[m.avatar]?.[0] || ''} ${esc(first(m.display_name))}</button>`).join('')}</div></fieldset>
      <label class="fld"><span>Details (optional)</span><input class="field" name="details" maxlength="300"></label>
      ${errP}<button class="warm-button block big" type="submit">Post hangout</button>${cancelBtn}</form>`);
  }
  function sheetSpot() {
    openSheet(`<form data-form="spot" class="stack"><h2>Add a hangout spot</h2>
      <label class="fld"><span>Name</span><input class="field" name="name" maxlength="60" required placeholder="McKennan Park, Band room, Jake's house"></label>
      <div class="chips" role="group">${Object.entries(SPOT_EM).map(([k, e], i) => `<button type="button" class="chip" data-act="pick" data-name="kind" data-v="${k}" aria-pressed="${i === 1}">${e} ${{ house: 'House', park: 'Park', school: 'School', food: 'Food', music: 'Music', other: 'Other' }[k]}</button>`).join('')}</div>
      <input type="hidden" name="kind" value="park">
      <label class="fld"><span>Address or directions (optional)</span><input class="field" name="address" maxlength="120"></label>
      <label class="fld"><span>Notes (optional)</span><input class="field" name="notes" maxlength="200" placeholder="Meet by the shelter"></label>
      <p class="small muted">Everyone in the band can see spots — only add someone's house if they're OK with it.</p>
      ${errP}<button class="primary-button block big" type="submit">Add spot</button>${cancelBtn}</form>`);
  }
  function sheetEvent() {
    openSheet(`<form data-form="event" class="stack"><h2>New band event</h2>
      <label class="fld"><span>Title</span><input class="field" name="title" maxlength="80" required placeholder="Friday Game vs. Washington"></label>
      <div class="chips" role="group">${Object.entries(EV_EM).map(([k, e], i) => `<button type="button" class="chip" data-act="pick" data-name="kind" data-v="${k}" aria-pressed="${i === 0}">${e} ${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
      <input type="hidden" name="kind" value="rehearsal">
      ${dtFields(nowPlus(24 * 60))}
      <label class="check"><input type="checkbox" name="all_day"> All day (contests, festivals, trips)</label>
      <label class="fld"><span>Call time (optional)</span><input class="field" type="time" name="call_time"></label>
      <label class="fld"><span>Who</span><select class="field" name="section"><option value="">Whole band</option>${(S.config?.sections || []).map((k) => `<option value="${k}">${secName(k)}</option>`).join('')}</select></label>
      <label class="fld"><span>Where</span><input class="field" name="location" maxlength="100" placeholder="Band room, Howard Wood Field…"></label>
      <label class="fld"><span>Details</span><input class="field" name="details" maxlength="500" placeholder="Full uniform, bring water"></label>
      <p class="small muted">Everyone it's for gets a notification.</p>
      ${errP}<button class="primary-button block big" type="submit">Add event</button>${cancelBtn}</form>`);
  }
  function sheetProfile() {
    const m = S.me;
    openSheet(`<form data-form="profile" class="stack"><h2>Edit profile</h2>
      <div class="ava-grid" role="radiogroup" aria-label="Avatar">${Object.keys(AVATAR).map((k) => `<button type="button" class="ava-pick" role="radio" data-act="ava" data-k="${k}" aria-checked="${m.avatar === k}" aria-label="${k}">${ava(k)}</button>`).join('')}</div>
      <input type="hidden" name="avatar" value="${esc(m.avatar)}">
      <label class="fld"><span>Name</span><input class="field" name="display_name" maxlength="40" value="${esc(m.display_name)}" required></label>
      ${isStudent() ? `<label class="fld"><span>Section</span><select class="field" name="section">${(S.config?.sections || []).map((k) => `<option value="${k}" ${m.section === k ? 'selected' : ''}>${secName(k)}</option>`).join('')}</select></label>
        <div class="row"><label class="fld grow"><span>Instrument</span><input class="field" name="instrument" maxlength="30" value="${esc(m.instrument || '')}"></label>
        <label class="fld"><span>Grade</span><select class="field" name="grade"><option value="">–</option>${[9, 10, 11, 12].map((g) => `<option ${m.grade === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label></div>` : ''}
      ${errP}<button class="primary-button block big" type="submit">Save</button>${cancelBtn}</form>`);
  }
  function sheetPostMenu(id) {
    const p = S.thread?.posts.find((x) => x.id === id); if (!p) return;
    const mine = p.author?.id === S.me.id;
    openSheet(`<div class="stack"><h2>Message</h2>
      ${!mine ? `<button class="danger-button block" data-act="report-sheet" data-id="${id}">🚩 Report</button>` : ''}
      ${mine || S.me.is_admin ? `<button class="ghost-button block" data-act="post-delete" data-id="${id}">🗑️ Delete${mine ? '' : ' (admin)'}</button>` : ''}
      ${!mine && p.author && S.thread.channel.kind !== 'dm' && p.author.id ? `<button class="ghost-button block" data-act="dm" data-id="${p.author.id}">💬 Message ${esc(first(p.author.display_name))}</button>` : ''}
      ${!mine && p.author?.id ? `<button class="ghost-button block" data-act="block" data-id="${p.author.id}">🚫 Block ${esc(first(p.author.display_name))}</button>` : ''}
      ${cancelBtn}</div>`);
  }
  function sheetReport(id) {
    openSheet(`<form data-form="report" class="stack"><input type="hidden" name="post_id" value="${id}"><h2>Report this message</h2>
      <p class="small muted">An admin will look at it. The person won't know who reported it.</p>
      <div class="chips" role="group">${[['mean', 'Mean'], ['bullying', 'Bullying'], ['inappropriate', 'Inappropriate'], ['photo', 'Bad photo'], ['threat', 'Threat'], ['spam', 'Spam'], ['other', 'Other']].map(([k, l]) => `<button type="button" class="chip" data-act="pick" data-name="reason" data-v="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
      <input type="hidden" name="reason" value="">
      <label class="fld"><span>Anything else? (optional)</span><input class="field" name="details" maxlength="500"></label>
      <label class="check"><input type="checkbox" name="also_block"><span>Also block them</span></label>
      ${errP}<button class="danger-button block big" type="submit">Send report</button>${cancelBtn}</form>`);
  }
  function sheetNudge(message, body) {
    openSheet(`<div class="stack"><h2>${esc(message.split(' ').slice(0, 2).join(' '))}</h2><p>${esc(message)}</p>
      <div class="report-quote">${esc(body)}</div>
      <button class="primary-button block" data-act="close-sheet">✏️ Edit my message</button>
      <button class="ghost-button block" data-act="nudge-send">Send anyway</button></div>`);
  }
  function sheetSupport(text) {
    openSheet(`<div class="stack"><h2>💛 We're here for you</h2><div class="support-box"><p>${esc(text)}</p></div>
      <p class="small muted">Your message was sent. An adult admin was quietly asked to check in — you're not in trouble.</p>
      <button class="primary-button block" data-act="close-sheet">OK</button></div>`);
  }
  function sheetRecovery(code) {
    openSheet(`<div class="stack"><h2>Save your recovery code</h2>
      <p>If you ever forget your password, this code lets you reset it. <b>Screenshot it or write it down now</b> — it won't be shown again.</p>
      <div class="code-box">${esc(code)}</div><button class="primary-button block big" data-act="close-sheet">I saved it</button></div>`);
  }

  // ================================================================ actions
  async function withBusy(el, fn) {
    if (S.busy) return;
    S.busy = true; el?.setAttribute('aria-busy', 'true'); el?.classList.add('is-loading');
    try { await fn(); } catch (e) { toast(e.message, 'warn'); }
    finally { S.busy = false; if (el?.isConnected) { el.removeAttribute('aria-busy'); el.classList.remove('is-loading'); } }
  }
  const setPressed = (el, sel) => $$(sel, el.closest('form') || el.closest('.row, .chips') || document).forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
  let pendingPost = null;
  let pendingFeed = null;
  const findFeed = (id) => (S.feed || []).find((p) => p.id === id) || (S.hubFeed || []).find((p) => p.id === id) || (S.post?.post?.id === id ? S.post.post : null);
  async function refreshFeedItem(id) {
    if (S.view?.name === 'post') { S.post = await api(`/feed/${S.view.id}/replies`); paint(); return; }
    if (S.view?.name === 'hub') { S.hubFeed = (await api(`/feed?event_id=${S.view.id}`)).posts; paint(); return; }
    const d = await api(`/feed/${id}/replies`).catch(() => null);
    if (d && S.feed) { S.feed = S.feed.map((p) => (p.id === id ? d.post : p)); paint(); }
  }
  /** Names or section keys → member ids, for bus lists like "Bus 1: percussion, guard, Ava". */
  function resolvePeople(list) {
    const ids = new Set(), unknown = [];
    for (const raw of list.split(',').map((x) => x.trim()).filter(Boolean)) {
      const k = raw.toLowerCase();
      const sec = Object.keys(SECTION).find((s) => s === k || secName(s).toLowerCase() === k);
      const roster = S.roster || S.members || [];
      if (sec && sec !== 'all' && sec !== 'parents') { roster.filter((m) => m.section === sec).forEach((m) => ids.add(m.id)); continue; }
      const m = roster.find((x) => x.display_name.toLowerCase() === k || x.username.toLowerCase() === k.replace(/^@/, '') || first(x.display_name).toLowerCase() === k);
      if (m) ids.add(m.id); else unknown.push(raw);
    }
    return { ids: [...ids], unknown };
  }
  async function refreshMe() { const d = await api('/me'); S.me = d.user; S.band = d.band; S.badges = d.badges; S.smsLive = d.sms_live; soundCheck(d.badges); if (THEMES[S.me.theme] && S.me.theme !== theme()) applyTheme(S.me.theme); }

  const A = {
    tab: (el) => go(el.dataset.tab),
    open: (el) => open(el.dataset.view, el.dataset.id ? Number(el.dataset.id) : undefined),
    back: () => back(),
    door: (el) => { S.door = el.dataset.door; S.authMode = 'login'; store.set('lhb_door', S.door); render(); },
    'auth-mode': (el) => { S.authMode = el.dataset.mode; render(); },
    theme: (el) => { applyTheme(el.dataset.t); if (S.me) { S.me.theme = el.dataset.t; api('/me', { method: 'PATCH', body: { theme: el.dataset.t } }).catch(() => {}); } if (S.me) paint(); else render(); toast({ cardinal: '🔴 Cardinal on', stadium: '🏟️ Stadium on', program: '📜 Program on' }[theme()]); },
    'close-sheet': () => closeSheet(),
    'close-sheet-bg': (el, e) => { if (e.target === el) closeSheet(); },
    'joke-next': () => { S.jokeOffset++; paint(); },
    'chat-seg': (el) => { S.chatSeg = el.dataset.s; paint(); },
    'feed-more': (el) => withBusy(el, async () => { const last = S.feed[S.feed.length - 1]; const d = await api(`/feed?before=${last.id}`); S.feed = S.feed.concat(d.posts); S.feedMore = d.posts.length === 25; paint(); }),
    'feed-photo': () => $('#feed-file')?.click(),
    'feed-attach-clear': () => { S.feedAttach = null; paint(); },
    'reply-photo': () => $('#reply-file')?.click(),
    'reply-attach-clear': () => { S.replyAttach = null; paint(); scrollChat(true); },
    'feed-kind': (el) => {
      const f = el.closest('form'); const on = el.getAttribute('aria-pressed') !== 'true';
      $$('[data-act=feed-kind]', f).forEach((b) => b.setAttribute('aria-pressed', String(b === el && on)));
      f.kind.value = on ? el.dataset.k : 'post';
      f.querySelector('.poll-fields').hidden = f.kind.value !== 'poll';
      f.body.placeholder = f.kind.value === 'poll' ? 'Ask a question… (e.g. Which section is surviving competition season?)' : f.kind.value === 'ask' ? "Who's in? (e.g. Anyone staying after rehearsal to practice?)" : (f.event_id ? 'Live from the event… 🎺' : 'What happened at rehearsal? 📸');
    },
    react: (el) => withBusy(el, async () => { await api(`/feed/${el.dataset.id}/react`, { method: 'POST', body: { emoji: el.dataset.e } }); closeSheet(); await refreshFeedItem(Number(el.dataset.id)); }),
    'react-pick': (el) => sheetReactPick(Number(el.dataset.id)),
    vote: (el) => withBusy(el, async () => { await api(`/feed/${el.dataset.id}/vote`, { method: 'POST', body: { option_id: Number(el.dataset.o) } }); await refreshFeedItem(Number(el.dataset.id)); }),
    'feed-menu': (el) => {
      const id = Number(el.dataset.id); const p = findFeed(id); if (!p) return;
      openSheet(`<div class="stack"><h2>Post</h2>
        ${!p.mine ? `<button class="danger-button block" data-act="feed-report" data-id="${id}">🚩 Report</button>` : ''}
        ${p.mine || S.me.is_admin ? `<button class="ghost-button block" data-act="feed-delete" data-id="${id}">🗑️ Delete${p.mine ? '' : ' (admin)'}</button>` : ''}
        ${!p.mine && p.author && isStudent() ? `<button class="ghost-button block" data-act="block" data-id="${p.author.id}">🚫 Block ${esc(first(p.author.display_name))}</button>` : ''}${cancelBtn}</div>`);
    },
    'feed-delete': (el) => withBusy(el, async () => { await api(`/feed/${el.dataset.id}`, { method: 'DELETE' }); closeSheet(); toast('Post deleted'); if (S.view?.name === 'post') back(); else loadForScreen(); }),
    'feed-report': (el) => openSheet(`<form data-form="feed-report" class="stack"><input type="hidden" name="feed_post_id" value="${el.dataset.id}"><h2>Report this post</h2>
      <div class="chips" role="group">${[['mean', 'Mean'], ['bullying', 'Bullying'], ['inappropriate', 'Inappropriate'], ['photo', 'Bad photo'], ['other', 'Other']].map(([k, l]) => `<button type="button" class="chip" data-act="pick" data-name="reason" data-v="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
      <input type="hidden" name="reason" value=""><label class="fld"><span>Anything else? (optional)</span><input class="field" name="details" maxlength="500"></label>${errP}<button class="danger-button block big" type="submit">Send report</button>${cancelBtn}</form>`),
    'reply-menu': (el) => {
      const r = S.post?.replies.find((x) => x.id === Number(el.dataset.id)); if (!r) return;
      openSheet(`<div class="stack"><h2>Reply</h2>${!r.mine ? `<button class="danger-button block" data-act="reply-report" data-id="${r.id}">🚩 Report</button>` : ''}
        ${r.mine || S.me.is_admin ? `<button class="ghost-button block" data-act="reply-delete" data-id="${r.id}">🗑️ Delete</button>` : ''}${cancelBtn}</div>`);
    },
    'reply-delete': (el) => withBusy(el, async () => { await api(`/replies/${el.dataset.id}`, { method: 'DELETE' }); closeSheet(); loadForScreen(); }),
    'reply-report': (el) => withBusy(el, async () => { await api('/reports', { method: 'POST', body: { reply_id: Number(el.dataset.id), reason: 'mean' } }); closeSheet(); toast('🛡️ Report sent to the admins'); }),
    'group-sheet': async () => { if (!S.members) S.members = (await api('/members')).members; if (!S.events) S.events = (await api('/events')).events; sheetGroup(); },
    'group-for-event': async (el) => { if (!S.members) S.members = (await api('/members')).members; if (!S.events) S.events = (await api('/events')).events; sheetGroup(); const f = $('form[data-form=group]'); if (f?.event_id) f.event_id.value = el.dataset.id; if (f) { f.temp.checked = true; f.name.value = `${S.hub?.event?.title || 'Trip'} crew`; } },
    'group-menu': () => {
      const c = S.thread.channel;
      openSheet(`<div class="stack"><h2>👥 ${esc(c.name)}</h2><p class="small muted">${S.thread.members.map((m) => esc(m.display_name)).join(', ')}</p>
        ${c.mine || S.me.is_admin ? '<button class="ghost-button block" data-act="group-add">➕ Add people</button>' : ''}
        <button class="danger-button block" data-act="group-leave">🚪 Leave group</button>${cancelBtn}</div>`);
    },
    'group-add': async () => {
      if (!S.members) S.members = (await api('/members')).members;
      const inIds = new Set(S.thread.members.map((m) => m.id));
      openSheet(`<form data-form="group-add" class="stack"><h2>Add people</h2><div class="chips" role="group">${S.members.filter((m) => !inIds.has(m.id) && !m.blocked).map((m) => `<button type="button" class="chip" data-act="toggle-chip" data-v="${m.id}" aria-pressed="false">${esc(m.display_name)}</button>`).join('') || '<p class="small muted">Everyone is already in!</p>'}</div>${errP}<button class="primary-button block big" type="submit">Add</button>${cancelBtn}</form>`);
    },
    'group-leave': (el) => withBusy(el, async () => { await api(`/groups/${S.view.id}`, { method: 'PATCH', body: { leave: true } }); closeSheet(); toast('You left the group'); go('chat'); }),
    'ev-rsvp': (el) => withBusy(el, async () => { await api(`/events/${el.dataset.id}/rsvp`, { method: 'POST', body: { status: el.dataset.s } }); if (el.dataset.s === 'going') confetti(); loadForScreen(); }),
    'hub-edit': () => sheetHubEdit(),
    predict: (el) => openSheet(`<form data-form="feed-post" class="stack"><input type="hidden" name="event_id" value="${el.dataset.id}"><input type="hidden" name="kind" value="poll"><h2>🔮 New prediction</h2>
      <textarea class="field" name="body" rows="2" maxlength="300" placeholder="Where do we place? Do we beat Brandon Valley's drumline?" required></textarea>
      <div class="poll-fields"><input class="field" name="o1" placeholder="Choice 1" required><input class="field" name="o2" placeholder="Choice 2" required><input class="field" name="o3" placeholder="Choice 3 (optional)"><input class="field" name="o4" placeholder="Choice 4 (optional)"></div>
      ${errP}<button class="primary-button block big" type="submit">Post prediction</button>${cancelBtn}</form>`),
    tool: (el) => { S.tool = el.dataset.k; store.set('lhb_tool', S.tool); paint(); },
    'thread-new': (el) => sheetThreadNew(el.dataset.section),
    'thread-menu': () => {
      const c = S.thread.channel;
      openSheet(`<div class="stack"><h2>${esc(c.name)}</h2>
        ${S.me.is_admin ? `<button class="ghost-button block" data-act="thread-lock" data-v="${c.locked ? 0 : 1}">${c.locked ? '🔓 Let everyone post' : '📌 Only admins can post'}</button>` : ''}
        <button class="danger-button block" data-act="thread-archive">🗑️ Close thread</button>${cancelBtn}</div>`);
    },
    'thread-lock': (el) => withBusy(el, async () => { await api(`/channels/${S.view.id}`, { method: 'PATCH', body: { locked: el.dataset.v === '1' } }); closeSheet(); await loadThread(true); paint(); }),
    'thread-archive': (el) => withBusy(el, async () => { await api(`/channels/${S.view.id}`, { method: 'PATCH', body: { archived: true } }); closeSheet(); toast('Thread closed'); go('threads'); }),
    dm: (el) => withBusy(el, async () => { const r = await api('/dms', { method: 'POST', body: { user_id: Number(el.dataset.id) } }); closeSheet(); S.tab = 'dms'; open('thread', r.id); }),
    block: (el) => withBusy(el, async () => { await api('/blocks', { method: 'POST', body: { user_id: Number(el.dataset.id) } }); closeSheet(); toast('Blocked — you won\'t see their messages'); loadForScreen(); }),
    unblock: (el) => withBusy(el, async () => { await api(`/blocks/${el.dataset.id}`, { method: 'DELETE' }); toast('Unblocked'); loadForScreen(); }),
    attach: () => $('#file-in')?.click(),
    'attach-clear': () => { S.attach = null; paint(); scrollChat(true); },
    'post-menu': (el) => sheetPostMenu(Number(el.dataset.id)),
    'post-delete': (el) => withBusy(el, async () => { await api(`/posts/${el.dataset.id}`, { method: 'DELETE' }); closeSheet(); await loadThread(true); paint(); }),
    'report-sheet': (el) => sheetReport(Number(el.dataset.id)),
    'nudge-send': (el) => withBusy(el, async () => {
      if (!pendingPost) return closeSheet();
      if (pendingPost.reply) { await api(`/feed/${S.view.id}/replies`, { method: 'POST', body: { body: pendingPost.body, file_id: pendingPost.file_id, confirm: true } }); pendingPost = null; S.replyAttach = null; closeSheet(); S.post = await api(`/feed/${S.view.id}/replies`); paint(); scrollChat(true); return; }
      await sendPost(pendingPost.body, true); closeSheet();
    }),
    pick: (el) => { setPressed(el, `[data-act=pick][data-name="${el.dataset.name}"]`); const f = el.closest('form'); if (f?.[el.dataset.name]) f[el.dataset.name].value = el.dataset.v; },
    'toggle-chip': (el) => el.setAttribute('aria-pressed', String(el.getAttribute('aria-pressed') !== 'true')),
    ava: (el) => { $$('[data-act=ava]').forEach((b) => b.setAttribute('aria-checked', String(b === el))); el.closest('form').avatar.value = el.dataset.k; },
    'ride-sheet': (el) => sheetRide(el.dataset.reason),
    'offer-sheet': () => sheetOffer(),
    'ride-claim': (el) => withBusy(el, async () => { try { await api(`/rides/${el.dataset.id}/claim`, { method: 'POST' }); confetti(); toast("🚗 You're driving — they've been told"); } finally { loadForScreen(); } }),
    'ride-unclaim': (el) => withBusy(el, async () => { await api(`/rides/${el.dataset.id}/unclaim`, { method: 'POST' }); toast('Others can pick it up now'); loadForScreen(); }),
    'ride-cancel': (el) => withBusy(el, async () => { await api(`/rides/${el.dataset.id}/cancel`, { method: 'POST' }); toast('Ride request cancelled'); loadForScreen(); }),
    seat: (el) => withBusy(el, async () => { try { await api(`/ride-offers/${el.dataset.id}/join`, { method: 'POST', body: {} }); toast('🙋 Seat saved!'); } finally { loadForScreen(); } }),
    'seat-leave': (el) => withBusy(el, async () => { await api(`/ride-offers/${el.dataset.id}/join`, { method: 'POST', body: { leave: true } }); toast('Seat given up'); loadForScreen(); }),
    'offer-cancel': (el) => withBusy(el, async () => { await api(`/ride-offers/${el.dataset.id}/cancel`, { method: 'POST' }); toast('Ride cancelled — riders told'); loadForScreen(); }),
    'hangout-sheet': () => sheetHangout().catch((e) => toast(e.message, 'warn')),
    'spot-sheet': () => sheetSpot(),
    'spot-remove': (el) => withBusy(el, async () => { await api(`/spots/${el.dataset.id}`, { method: 'DELETE' }); loadForScreen(); }),
    rsvp: (el) => withBusy(el, async () => { await api(`/hangouts/${el.dataset.id}/rsvp`, { method: 'POST', body: { status: el.dataset.s } }); if (el.dataset.s === 'going') confetti(); loadForScreen(); }),
    'hangout-cancel': (el) => withBusy(el, async () => { await api(`/hangouts/${el.dataset.id}/cancel`, { method: 'POST' }); toast('Hangout cancelled'); loadForScreen(); }),
    'event-new': () => sheetEvent(),
    'event-cancel': (el) => withBusy(el, async () => { await api(`/events/${el.dataset.id}`, { method: 'PATCH', body: { cancelled: true } }); toast('Event cancelled — everyone told'); loadForScreen(); }),
    'profile-edit': () => sheetProfile(),
    'can-drive': async (el) => { await api('/me', { method: 'PATCH', body: { can_drive: el.checked } }).catch((e) => toast(e.message, 'warn')); S.me.can_drive = el.checked ? 1 : 0; toast(el.checked ? '🚗 You can now see ride requests' : 'Driving off'); },
    pref: async (el) => { const p = { ...(S.me.notify_prefs || {}), [el.dataset.k]: el.checked }; S.me.notify_prefs = p; await api('/me', { method: 'PATCH', body: { notify_prefs: p } }).catch((e) => toast(e.message, 'warn')); toast('Saved'); },
    'sound-test': (el) => { Sound.play(el.dataset.k, true); alertPop(el.dataset.k === 'message' ? 'dm' : el.dataset.k, 'Test alert 🔊', 'This is what a new alert looks like'); },
    'sound-toggle': (el) => { Sound.set(el.checked); if (el.checked) Sound.play('chime', true); toast(el.checked ? '🔊 Sounds on' : '🔇 Sounds off'); },
    logout: async () => { await api('/logout', { method: 'POST' }).catch(() => {}); stopPolling(); heard = null; S.me = null; S.tab = 'home'; S.view = null; render(); },
    'delete-me': () => openSheet(`<form data-form="delete-me" class="stack"><h2>Delete your account?</h2><p class="small">Your messages are removed and you're signed out. This can't be undone.</p>
      <label class="fld"><span>Password</span><input class="field" name="password" type="password" required></label>${errP}<button class="danger-button block big" type="submit">Delete my account</button>${cancelBtn}</form>`),
    'read-all': async () => { await api('/notifications/read', { method: 'POST', body: { all: true } }); S.badges.notifications = 0; loadForScreen(); },
    note: (el) => { api('/notifications/read', { method: 'POST', body: { id: Number(el.dataset.id) } }).catch(() => {}); if (!follow(el.dataset.link)) loadForScreen(); },
    'code-reset': (el) => withBusy(el, async () => { await api('/admin/codes', { method: 'POST', body: { which: el.dataset.w } }); toast('New code made — the old one stopped working'); loadForScreen(); }),
    'report-resolve': (el) => withBusy(el, async () => { await api(`/admin/reports/${el.dataset.id}/resolve`, { method: 'POST', body: { remove_post: el.dataset.remove === '1' } }); toast(el.dataset.remove ? 'Message removed' : 'Marked OK'); loadForScreen(); }),
    'member-admin': (el) => withBusy(el, async () => { await api(`/admin/users/${el.dataset.id}`, { method: 'PATCH', body: { is_admin: el.dataset.v === '1' } }); loadForScreen(); }),
    'member-pause': (el) => withBusy(el, async () => { await api(`/admin/users/${el.dataset.id}`, { method: 'PATCH', body: { status: 'suspended' } }); toast('Paused — they\'re signed out'); loadForScreen(); }),
    'member-unpause': (el) => withBusy(el, async () => { await api(`/admin/users/${el.dataset.id}`, { method: 'PATCH', body: { status: 'active' } }); loadForScreen(); }),
  };

  async function sendPost(body, confirm) {
    const v = S.view;
    let file_id;
    if (S.attach) { const up = await upload(S.attach.file); file_id = up.id; }
    try {
      const r = await api(`/channels/${v.id}/posts`, { method: 'POST', body: { body, file_id, confirm } });
      S.attach = null; pendingPost = null;
      const t = $('#msg-input'); if (t) t.value = '';
      await loadThread(true); paint(); scrollChat(true);
      $('#msg-input')?.focus({ preventScroll: true });
      if (r.support) sheetSupport(r.support);
    } catch (e) {
      if (e.data?.nudge) { pendingPost = { body }; sheetNudge(e.message, body); return; }
      throw e;
    }
  }

  // ================================================================ forms
  const F = {
    login: async (f, d) => { await api('/login', { method: 'POST', body: { username: d.get('username'), password: d.get('password') } }); await boot(); },
    signup: async (f, d) => {
      const body = Object.fromEntries(d); body.can_drive = d.get('can_drive') === 'on'; body.sms_opt_in = d.get('sms_opt_in') === 'on';
      const r = await api('/signup', { method: 'POST', body });
      await boot(); sheetRecovery(r.recovery_code);
      if (r.admin) { toast('🛡️ You\'re the admin — your join codes are in Admin'); }
    },
    recover: async (f, d) => { const r = await api('/recover', { method: 'POST', body: Object.fromEntries(d) }); await boot(); sheetRecovery(r.recovery_code); },
    post: async (f, d) => {
      const body = String(d.get('body') || '').trim();
      if (!body && !S.attach) return;
      try { await sendPost(body, false); } catch (e) { if (e.data?.blocked) toast('🚫 ' + e.message, 'warn'); else throw e; }
    },
    'feed-post': async (f, d) => {
      const kind = d.get('kind') || 'post';
      const body = { kind, body: String(d.get('body') || '').trim(), event_id: Number(d.get('event_id')) || null, official: d.get('official') === 'on' };
      if (kind === 'poll') body.options = ['o1', 'o2', 'o3', 'o4'].map((k) => String(d.get(k) || '').trim()).filter(Boolean);
      if (S.feedAttach && f.closest('.sheet') === null) { const up = await upload(S.feedAttach.file); body.file_id = up.id; }
      try {
        const r = await api('/feed', { method: 'POST', body: pendingFeed ? { ...body, confirm: true } : body });
        pendingFeed = null; S.feedAttach = null; closeSheet();
        toast(kind === 'poll' ? '📊 Poll posted' : kind === 'ask' ? "🙋 Posted — let's see who's in" : '📸 Posted!');
        if (r.support) sheetSupport(r.support);
        loadForScreen();
      } catch (e) {
        if (e.data?.nudge && !pendingFeed) { pendingFeed = body; if (confirm(e.message)) return F['feed-post'](f, d); pendingFeed = null; return; }
        pendingFeed = null; throw e;
      }
    },
    reply: async (f, d) => {
      const body = { body: String(d.get('body') || '').trim() };
      if (!body.body && !S.replyAttach) return;
      if (S.replyAttach) { const up = await upload(S.replyAttach.file); body.file_id = up.id; }
      try {
        const r = await api(`/feed/${S.view.id}/replies`, { method: 'POST', body });
        S.replyAttach = null; S.post = await api(`/feed/${S.view.id}/replies`); paint(); scrollChat(true);
        if (r.support) sheetSupport(r.support);
      } catch (e) {
        if (e.data?.nudge) { pendingPost = { body: body.body, reply: true, file_id: body.file_id }; sheetNudge(e.message, body.body); return; }
        if (e.data?.blocked) { toast('🚫 ' + e.message, 'warn'); return; }
        throw e;
      }
    },
    'feed-report': async (f, d) => { if (!d.get('reason')) throw new Error('Pick a reason'); await api('/reports', { method: 'POST', body: { feed_post_id: Number(d.get('feed_post_id')), reason: d.get('reason'), details: d.get('details') } }); closeSheet(); toast('🛡️ Report sent to the admins'); },
    group: async (f, d) => {
      const member_ids = $$('[data-act=toggle-chip][aria-pressed=true]', f).map((b) => Number(b.dataset.v));
      if (!member_ids.length) throw new Error('Tap at least one person');
      const expires_at = d.get('temp') === 'on' ? new Date(`${d.get('ends')}T23:59`).toISOString() : null;
      const r = await api('/groups', { method: 'POST', body: { name: d.get('name'), member_ids, expires_at, event_id: Number(d.get('event_id')) || null } });
      closeSheet(); toast('👥 Group created'); S.tab = 'chat'; open('thread', r.id);
    },
    'group-add': async (f) => { const add = $$('[data-act=toggle-chip][aria-pressed=true]', f).map((b) => Number(b.dataset.v)); if (!add.length) throw new Error('Tap someone to add'); await api(`/groups/${S.view.id}`, { method: 'PATCH', body: { add } }); closeSheet(); await loadThread(true); paint(); toast('Added!'); },
    'hub-edit': async (f, d) => {
      S.roster = S.roster || (await api('/members?role=student')).members;
      const lines = (k) => String(d.get(k) || '').split('\n').map((x) => x.trim()).filter(Boolean);
      const toTime = (t) => { const m = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(t); if (!m) return null; let h = Number(m[1]); if (m[3]) { if (/pm/i.test(m[3]) && h < 12) h += 12; if (/am/i.test(m[3]) && h === 12) h = 0; } return `${String(h).padStart(2, '0')}:${m[2]}`; };
      const schedule = lines('schedule').map((l, i) => { const [t, ...rest] = l.split(/\s+/); const at = toTime(t); if (!at) throw new Error(`Schedule line ${i + 1} should start with a time like 14:30`); return { at_time: at, label: rest.join(' ') }; });
      const order = lines('order').map((l) => { const us = /\*\s*$/.test(l); l = l.replace(/\*\s*$/, '').trim(); const [t, ...rest] = l.split(/\s+/); const at = toTime(t); return { perform_at: at, band_name: at ? rest.join(' ') : l, is_us: us }; });
      const unknown = [];
      const buses = lines('buses').map((l) => { const [name, people = ''] = l.split(':'); const r = resolvePeople(people); unknown.push(...r.unknown); return { name: name.trim(), member_ids: r.ids }; });
      await api(`/events/${S.view.id}/hub`, { method: 'PUT', body: { schedule, order, buses } });
      closeSheet(); toast(unknown.length ? `Saved — couldn't find: ${unknown.join(', ')}` : 'Hub saved ✅', unknown.length ? 'warn' : ''); loadForScreen();
    },
    'thread-new': async (f, d) => { const r = await api('/channels', { method: 'POST', body: Object.fromEntries(d) }); closeSheet(); open('thread', r.id); },
    ride: async (f, d) => {
      const r = await api('/rides', { method: 'POST', body: { kind: d.get('kind'), reason: d.get('reason'), starts_at: isoFrom(d), from_place: d.get('from_place'), to_place: d.get('to_place'), seats: Number(d.get('seats')), note: d.get('note') } });
      closeSheet(); toast(`🚗 Asked ${r.drivers_asked} driver${r.drivers_asked === 1 ? '' : 's'} — you'll hear when someone says yes`);
      if (S.view?.name !== 'rides') open('rides'); else loadForScreen();
    },
    offer: async (f, d) => { await api('/ride-offers', { method: 'POST', body: { starts_at: isoFrom(d), from_place: d.get('from_place'), to_place: d.get('to_place'), seats: Number(d.get('seats')), note: d.get('note') } }); closeSheet(); toast('🚙 Ride posted'); loadForScreen(); },
    hangout: async (f, d) => {
      const invite = $$('[data-act=toggle-chip][aria-pressed=true]', f).map((b) => Number(b.dataset.v));
      await api('/hangouts', { method: 'POST', body: { title: d.get('title'), starts_at: isoFrom(d), spot_id: Number(d.get('spot_id')) || null, place: d.get('place'), details: d.get('details'), invite } });
      closeSheet(); confetti(); toast('🍕 Hangout posted'); if (S.view?.name !== 'hangouts') open('hangouts'); else loadForScreen();
    },
    spot: async (f, d) => { await api('/spots', { method: 'POST', body: Object.fromEntries(d) }); closeSheet(); toast('📍 Spot added'); S.spots = null; loadForScreen(); },
    event: async (f, d) => { await api('/events', { method: 'POST', body: { title: d.get('title'), kind: d.get('kind'), starts_at: d.get('all_day') ? new Date(`${d.get('date')}T08:00`).toISOString() : isoFrom(d), all_day: !!d.get('all_day'), call_time: d.get('call_time') || null, section: d.get('section') || null, location: d.get('location'), details: d.get('details') } }); closeSheet(); toast('📅 Event added — everyone notified'); loadForScreen(); },
    profile: async (f, d) => { const body = Object.fromEntries(d); if (body.grade === '') body.grade = null; await api('/me', { method: 'PATCH', body }); await refreshMe(); closeSheet(); render(); toast('Saved ✨'); },
    phone: async (f, d) => { await api('/me', { method: 'PATCH', body: { phone: d.get('phone'), sms_opt_in: d.get('sms_opt_in') === 'on' } }); await refreshMe(); toast('Saved'); },
    password: async (f, d) => { await api('/me', { method: 'PATCH', body: Object.fromEntries(d) }); f.reset(); toast('Password updated'); },
    report: async (f, d) => {
      if (!d.get('reason')) throw new Error('Pick a reason');
      const post = S.thread?.posts.find((p) => p.id === Number(d.get('post_id')));
      await api('/reports', { method: 'POST', body: { post_id: Number(d.get('post_id')), reason: d.get('reason'), details: d.get('details') } });
      if (d.get('also_block') === 'on' && post?.author?.id) await api('/blocks', { method: 'POST', body: { user_id: post.author.id } });
      closeSheet(); toast('🛡️ Report sent to the admins'); loadThread(true).then(paint);
    },
    'delete-me': async (f, d) => { await api('/me', { method: 'DELETE', body: { password: d.get('password') } }); closeSheet(); S.me = null; stopPolling(); render(); toast('Account deleted'); },
    'band-settings': async (f, d) => { await api('/admin/settings', { method: 'PATCH', body: Object.fromEntries(d) }); await refreshMe(); toast('Saved'); loadForScreen(); },
  };

  // ================================================================ events
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    if (el.dataset.act === 'close-sheet-bg' && e.target !== el) return;
    const fn = A[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.tagName === 'INPUT' && el.type === 'checkbox' && el.dataset.act && A[el.dataset.act]) A[el.dataset.act](el, e);
    if ((el.id === 'feed-file' || el.id === 'reply-file') && el.files?.[0]) {
      const file = el.files[0];
      if (!file.type.startsWith('image/')) { toast('Pick a photo', 'warn'); return; }
      const keep = el.closest('form')?.body?.value || '';
      if (el.id === 'feed-file') S.feedAttach = { file, name: file.name }; else S.replyAttach = { file, name: file.name };
      paint(); const b = el.id === 'feed-file' ? $('form[data-form=feed-post] textarea') : $('#msg-input'); if (b) { b.value = keep; b.focus(); }
      if (el.id === 'reply-file') scrollChat(true);
      return;
    }
    if (el.id === 'file-in' && el.files?.[0]) {
      const file = el.files[0];
      const kind = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'pdf' : file.type.startsWith('image/') ? 'image' : null;
      if (!kind) { toast('You can attach PDFs (sheet music) and photos', 'warn'); return; }
      if (file.size > 25 * 1024 * 1024) { toast('That file is too big (15 MB max)', 'warn'); return; }
      S.attach = { file, name: file.name, kind }; paint(); scrollChat(true); $('#msg-input')?.focus();
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'member-q') { S.memberQ = e.target.value; const pos = e.target.selectionStart; paint(); const q = $('#member-q'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target, fn = F[f.dataset.form];
    if (!fn) return;
    e.preventDefault();
    const btn = f.querySelector('[type=submit]'), err = f.querySelector('[data-err]');
    if (err) err.textContent = '';
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.classList.add('is-loading'); }
    try { await fn(f, new FormData(f)); }
    catch (ex) { if (err) err.textContent = ex.message; else toast(ex.message, 'warn'); }
    finally { if (btn?.isConnected) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.classList.remove('is-loading'); } }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.id === 'msg-input' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.form.requestSubmit(); }
    if (e.key === 'Escape' && $('#modal-root').innerHTML) closeSheet();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.me && S.tab !== 'tools') loadForScreen(); });

  // ================================================================ boot
  applyTheme(store.get('lh_theme', 'cardinal'));
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('signup')) { S.door = q.get('signup') === 'parent' ? 'parent' : 'student'; S.authMode = 'signup'; history.replaceState(null, '', '/'); }
    if (q.has('parent')) { S.door = 'parent'; history.replaceState(null, '', '/'); }
  } catch { /* old browser */ }
  async function boot() {
    try { S.config = await api('/config'); S.band = S.config.band; } catch { /* offline */ }
    try { await refreshMe(); } catch { S.me = null; render(); return; }
    S.tab = 'home'; S.view = null;
    render(); loadForScreen(); startPolling();
  }
  boot();
})();
