// Let's Hang High School (letshang.band) — Cloudflare Worker API.
// Students and parents sign themselves up with the band's join codes (one for students, one for parents).
// Student chats are private from parents; guardrails (src/guard.js) keep them clean instead.
// Every permission check happens here on the server.

import { hashPassword, verifyPassword, createSession, readSession, destroySession } from './auth.js';
import { sendSms, normalizePhone, verifyTwilioSignature, smsConfigured } from './sms.js';
import { TIME_RE, toMin, pickSchoolDay, schedule, walkWeather, schoolNews } from './today.js';
import { checkText, checkImage, SUPPORT } from './guard.js';
import { MIGRATIONS } from './schema.js';

// ================================================================ helpers
class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; } }
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };
const json = (data, init = {}) => new Response(JSON.stringify(data), {
  status: init.status || 200,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', ...(init.headers || {}) },
});
const nowIso = () => new Date().toISOString();
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const toInt = (v) => { const n = Number(v); return Number.isInteger(n) ? n : null; };
const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' || v === 'on') ? 1 : 0;
const all = async (env, sql, ...b) => (await env.DB.prepare(sql).bind(...b).all()).results || [];
const first = (env, sql, ...b) => env.DB.prepare(sql).bind(...b).first();
const run = (env, sql, ...b) => env.DB.prepare(sql).bind(...b).run();
const firstName = (n) => String(n || '').split(' ')[0];
const APP = (env) => env.APP_NAME || "Let's Hang";
const TZ = (env) => env.TIMEZONE || 'America/Chicago';
const when = (env, iso) => new Intl.DateTimeFormat('en-US', { timeZone: TZ(env), weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const SECTIONS = ['percussion', 'brass', 'woodwinds', 'guard', 'front', 'leadership'];
const AVATARS = ['drum', 'trumpet', 'sax', 'flute', 'violin', 'guitar', 'notes', 'headphones', 'flag', 'star', 'fox', 'cat', 'frog', 'panda', 'fire', 'bolt', 'crown', 'rocket', 'rainbow', 'alien'];
const THEMES = ['neon', 'pastel'];
const MAX_FILE = 15 * 1024 * 1024;

async function rateLimit(env, key, limit, windowMs, message) {
  const r = await first(env, 'SELECT COUNT(*) AS n FROM rate_events WHERE key = ? AND at > ?', key, ago(windowMs));
  if (r.n >= limit) fail(429, message || 'Slow down a little and try again soon.');
  await run(env, 'INSERT INTO rate_events (key) VALUES (?)', key);
}
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randCode = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => CODE_ALPHA[x % 32]).join('');
function randomRecoveryCode() { const s = randCode(12); return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`; }

async function settings(env) {
  const rows = await all(env, 'SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
const setSetting = (env, key, value) => run(env, 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value));

/** Join codes: BAND-XXXX for students, FAM-XXXX for parents. Created on first use. */
async function joinCodes(env) {
  const s = await settings(env);
  let student = s.join_student, parent = s.join_parent;
  if (!student) { student = 'BAND-' + randCode(4); await setSetting(env, 'join_student', student); }
  if (!parent) { parent = 'FAM-' + randCode(4); await setSetting(env, 'join_parent', parent); }
  return { student, parent };
}
const sameCode = (a, b) => String(a || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === String(b || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ---- notifications
const PREF_FOR = { dm: 'messages', mention: 'messages', ride: 'rides', ride_update: 'rides', event: 'events', hangout: 'hangouts' };
async function notify(env, ctx, users, n, { sms = false } = {}) {
  const stmts = [], texts = [];
  for (const u of users) {
    if (!u) continue;
    let prefs = {};
    try { prefs = JSON.parse(u.notify_prefs || '{}'); } catch { /* default */ }
    const cat = PREF_FOR[n.type];
    if (cat && prefs[cat] === false && n.type !== 'safety') continue;
    if (n.dedupe) {
      const dup = await first(env, 'SELECT id FROM notifications WHERE user_id = ? AND dedupe_key = ? AND read_at IS NULL', u.id, n.dedupe);
      if (dup) continue;
    }
    stmts.push(env.DB.prepare('INSERT INTO notifications (user_id, type, title, body, link, dedupe_key) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(u.id, n.type, n.title, n.body || null, n.link || null, n.dedupe || null));
    if (sms && u.sms_opt_in && u.phone) texts.push(u.phone);
  }
  if (stmts.length) await env.DB.batch(stmts);
  for (const phone of new Set(texts)) ctx.waitUntil(sendSms(env, phone, `${n.title}${n.body ? ' — ' + n.body : ''}`).catch(console.error));
}
const userCols = 'id, role, is_admin, display_name, avatar, section, phone, sms_opt_in, notify_prefs, can_drive';
const usersWhere = (env, where, ...b) => all(env, `SELECT ${userCols} FROM users WHERE status = 'active' AND ${where}`, ...b);
const adultAdmins = async (env) => {
  const a = await usersWhere(env, "is_admin = 1 AND role = 'parent'");
  return a.length ? a : usersWhere(env, 'is_admin = 1');
};

async function logGuard(env, ctx, user, result) {
  if (result.kind) await run(env, 'INSERT INTO guard_events (user_id, kind) VALUES (?, ?)', user.id, result.kind);
  // Repeated serious hits → quiet heads-up to adult admins (no message text).
  if (['hate', 'threat', 'sexual', 'violence', 'photo'].includes(result.kind)) {
    const n = await first(env, `SELECT COUNT(*) AS n FROM guard_events WHERE user_id = ? AND kind IN ('hate','threat','sexual','violence','photo') AND created_at > ?`, user.id, ago(864e5));
    if (n.n === 3) await notify(env, ctx, await adultAdmins(env), { type: 'safety', title: `Guardrails blocked ${firstName(user.display_name)} 3 times today`, body: 'Hate, threats or sexual content. You may want to check in.', link: 'admin', dedupe: `guard:${user.id}:${new Date().toISOString().slice(0, 10)}` });
  }
}
/** Run text guardrails; throws a friendly error when blocked. */
async function guardText(env, ctx, user, text, confirmed) {
  const r = await checkText(env, text, { confirmed: !!confirmed });
  if (!r.ok) {
    if (r.nudge) fail(409, r.message, { nudge: true });
    await logGuard(env, ctx, user, r);
    fail(422, r.message, { blocked: r.kind });
  }
  if (r.selfHarm) {
    await run(env, 'INSERT INTO guard_events (user_id, kind) VALUES (?, ?)', user.id, 'selfharm');
    await notify(env, ctx, await adultAdmins(env), {
      type: 'safety', title: `${user.display_name} may need support`,
      body: `Something they wrote suggests they might be struggling. Please check in with them privately (or ask the band director / counselor).`,
      link: 'admin', dedupe: `selfharm:${user.id}:${new Date().toISOString().slice(0, 10)}`,
    }, { sms: true });
  }
  return r;
}

// ================================================================ routing + self-setup
const routes = [];
function add(method, path, handler, opts = {}) {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, auth: opts.auth !== false, role: opts.role, admin: !!opts.admin, raw: !!opts.raw });
}
let schemaReady = null;
async function applyMigrations(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  const done = new Set((await all(env, 'SELECT name FROM d1_migrations')).map((r) => r.name));
  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    await env.DB.batch([...m.statements.map((s) => env.DB.prepare(s)), env.DB.prepare('INSERT INTO d1_migrations (name) VALUES (?)').bind(m.name)]);
  }
}
function ensureSchema(env) {
  if (!schemaReady) schemaReady = applyMigrations(env).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && url.pathname !== '/api/sms/inbound') {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) return json({ error: 'Bad origin' }, { status: 403 });
    }
    try { await ensureSchema(env); } catch (e) {
      console.error('Database setup failed', e);
      return json({ error: 'Database setup failed: ' + String(e.message || e).slice(0, 200) }, { status: 500 });
    }
    for (const r of routes) {
      if (r.method !== request.method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      try {
        let user = null;
        if (r.auth) {
          user = await readSession(env, request);
          if (!user) fail(401, 'Please sign in');
          if (r.role && user.role !== r.role) fail(403, r.role === 'parent' ? 'That part is for parents' : 'That part is for students');
          if (r.admin && !user.is_admin) fail(403, 'Admins only');
        }
        let body = {};
        if (!r.raw && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) body = (await request.json().catch(() => ({}))) || {};
        return await r.handler({ request, env, ctx, url, params, user, body });
      } catch (e) {
        if (e instanceof HttpError) return json({ error: e.message, ...(e.extra || {}) }, { status: e.status });
        console.error(e);
        return json({ error: 'Something went wrong on our end. Try again.' }, { status: 500 });
      }
    }
    return json({ error: 'Not found' }, { status: 404 });
  },
  async scheduled(event, env) {
    await ensureSchema(env);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowIso()),
      env.DB.prepare('DELETE FROM rate_events WHERE at < ?').bind(ago(2 * 864e5)),
      env.DB.prepare('DELETE FROM notifications WHERE created_at < ?').bind(ago(60 * 864e5)),
      env.DB.prepare('DELETE FROM guard_events WHERE created_at < ?').bind(ago(90 * 864e5)),
      env.DB.prepare('DELETE FROM sms_log WHERE created_at < ?').bind(ago(90 * 864e5)),
      env.DB.prepare('DELETE FROM rides WHERE starts_at < ?').bind(ago(90 * 864e5)),
    ]);
  },
};

// ================================================================ public
add('GET', '/api/health', async ({ env }) => {
  const t = await all(env, "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users','channels','posts','files','rides','events')");
  const mig = await all(env, 'SELECT name FROM d1_migrations ORDER BY id');
  return json({ ok: t.length === 6, tables: t.map((x) => x.name).sort(), migrations: mig.map((x) => x.name), files: !!env.FILES, ai: !!env.AI || !!env.AI_MOCK });
}, { auth: false });

add('GET', '/api/config', async ({ env }) => {
  const s = await settings(env);
  const n = await first(env, 'SELECT COUNT(*) AS n FROM users');
  return json({ app: APP(env), band: s.band_name || 'Marching Band', school: s.school_name || null, first_run: n.n === 0, sections: SECTIONS, avatars: AVATARS });
}, { auth: false });

// ================================================================ accounts
add('POST', '/api/signup', async ({ env, request, body }) => {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  await rateLimit(env, 'signup:' + ip, 60, 3600e3, 'Too many sign-ups from here. Try again in a little while.');
  const role = body.role === 'parent' ? 'parent' : 'student';
  const count = (await first(env, 'SELECT COUNT(*) AS n FROM users')).n;
  const firstUser = count === 0;
  if (!firstUser) {
    const codes = await joinCodes(env);
    if (!sameCode(body.join_code, role === 'parent' ? codes.parent : codes.student)) {
      fail(403, role === 'parent' ? "That parent code isn't right. Ask the band director or a booster for the parent code." : "That band code isn't right. Ask your band director or section leader for it.");
    }
  }
  const name = str(body.display_name, 40);
  const username = str(body.username, 30).toLowerCase();
  const password = String(body.password || '');
  if (!name) fail(400, 'Enter your name');
  const nameCheck = await checkText(env, name);
  if (!nameCheck.ok) fail(400, 'Pick a different name');
  if (!USERNAME_RE.test(username)) fail(400, 'Username: 3–30 letters, numbers, dots or dashes');
  if (password.length < 8) fail(400, 'Password needs at least 8 characters');
  if (await first(env, 'SELECT id FROM users WHERE username = ?', username)) fail(409, 'That username is taken');
  const section = role === 'student' ? (SECTIONS.includes(body.section) ? body.section : null) : null;
  if (role === 'student' && !section) fail(400, 'Pick your section');
  const grade = role === 'student' ? toInt(body.grade) : null;
  if (role === 'student' && grade !== null && (grade < 9 || grade > 12)) fail(400, 'Grade is 9–12');
  const phone = body.phone ? normalizePhone(body.phone) : null;
  if (body.phone && !phone) fail(400, "That phone number doesn't look right");
  const avatar = AVATARS.includes(body.avatar) ? body.avatar : (role === 'parent' ? 'star' : 'notes');
  const { hash, salt } = await hashPassword(password);
  const recovery = randomRecoveryCode();
  const rec = await hashPassword(recovery);
  const row = await first(env,
    `INSERT INTO users (role, is_admin, display_name, username, pass_hash, pass_salt, avatar, section, instrument, grade, can_drive, phone, sms_opt_in, recovery_hash, recovery_salt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    role, firstUser ? 1 : 0, name, username, hash, salt, avatar, section, str(body.instrument, 30) || null, grade,
    role === 'student' ? bool(body.can_drive) : 0, phone, phone ? bool(body.sms_opt_in) : 0, rec.hash, rec.salt);
  if (firstUser) await joinCodes(env);
  const cookie = await createSession(env, request, row.id);
  return json({ ok: true, recovery_code: recovery, admin: firstUser }, { headers: { 'set-cookie': cookie } });
}, { auth: false });

add('POST', '/api/login', async ({ env, request, body }) => {
  const username = str(body.username, 30).toLowerCase();
  const key = 'login:' + username;
  const r = await first(env, 'SELECT COUNT(*) AS n FROM rate_events WHERE key = ? AND at > ?', key, ago(15 * 60e3));
  if (r.n >= 8) fail(429, 'Too many tries. Wait 15 minutes and try again.');
  const u = await first(env, 'SELECT id, role, status, pass_hash, pass_salt FROM users WHERE username = ?', username);
  if (!u || !(await verifyPassword(String(body.password || ''), u.pass_hash, u.pass_salt))) {
    await run(env, 'INSERT INTO rate_events (key) VALUES (?)', key);
    fail(401, "That username or password isn't right");
  }
  if (u.status !== 'active') fail(403, 'This account is paused. Talk to the band director.');
  await run(env, 'DELETE FROM rate_events WHERE key = ?', key);
  return json({ ok: true, role: u.role }, { headers: { 'set-cookie': await createSession(env, request, u.id) } });
}, { auth: false });

add('POST', '/api/logout', async ({ env, request }) => json({ ok: true }, { headers: { 'set-cookie': await destroySession(env, request) } }), { auth: false });

add('POST', '/api/recover', async ({ env, request, body }) => {
  const username = str(body.username, 30).toLowerCase();
  await rateLimit(env, 'recover:' + username, 5, 3600e3, 'Too many tries. Wait an hour.');
  const u = await first(env, `SELECT id, recovery_hash, recovery_salt FROM users WHERE username = ?`, username);
  const code = str(body.recovery_code, 20).toUpperCase();
  if (!u || !u.recovery_hash || !(await verifyPassword(code, u.recovery_hash, u.recovery_salt))) fail(401, "That recovery code doesn't match");
  const pw = String(body.new_password || '');
  if (pw.length < 8) fail(400, 'New password needs at least 8 characters');
  const { hash, salt } = await hashPassword(pw);
  const recovery = randomRecoveryCode();
  const rec = await hashPassword(recovery);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, recovery_hash = ?, recovery_salt = ? WHERE id = ?').bind(hash, salt, rec.hash, rec.salt, u.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id),
  ]);
  return json({ ok: true, recovery_code: recovery }, { headers: { 'set-cookie': await createSession(env, request, u.id) } });
}, { auth: false });

async function badgeCounts(env, user) {
  const n = await first(env, 'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', user.id);
  const chans = await visibleChannels(env, user);
  const ids = chans.map((c) => c.id);
  let threads = 0, dms = 0;
  if (ids.length) {
    const rows = await all(env,
      `SELECT c.id, c.kind, (SELECT COUNT(*) FROM posts p WHERE p.channel_id = c.id AND p.deleted_by IS NULL AND (p.user_id IS NULL OR p.user_id != ?1)
                AND p.id > COALESCE((SELECT last_read_id FROM channel_reads r WHERE r.channel_id = c.id AND r.user_id = ?1), 0)
                AND (p.user_id IS NULL OR p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?1))) AS unread
         FROM channels c WHERE c.id IN (${ids.map((_, i) => `?${i + 2}`).join(',')})`, user.id, ...ids);
    for (const r of rows) { if (r.kind === 'dm') dms += r.unread; else threads += r.unread; }
  }
  const rides = (user.role === 'parent' || user.can_drive)
    ? (await first(env, `SELECT COUNT(*) AS n FROM rides WHERE status = 'open' AND starts_at > ? AND requested_by != ?`, ago(15 * 60e3), user.id)).n : 0;
  const reports = user.is_admin ? (await first(env, `SELECT COUNT(*) AS n FROM reports WHERE status = 'open'`)).n : 0;
  const latest = await first(env, 'SELECT id, type, title, body, link FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1', user.id);
  return { notifications: n.n, threads, dms, rides, reports,
    latest_id: latest?.id || 0, latest_type: latest?.type || null, latest_title: latest?.title || null, latest_body: latest?.body || null, latest_link: latest?.link || null };
}

add('GET', '/api/me', async ({ env, user }) => {
  let prefs = {};
  try { prefs = JSON.parse(user.notify_prefs || '{}'); } catch { /* */ }
  const s = await settings(env);
  return json({ user: { ...user, notify_prefs: prefs }, band: s.band_name || 'Marching Band', badges: await badgeCounts(env, user), sms_live: smsConfigured(env) });
});
add('GET', '/api/badges', async ({ env, user }) => json(await badgeCounts(env, user)));

add('PATCH', '/api/me', async ({ env, user, body }) => {
  const sets = [], vals = [];
  if (body.display_name !== undefined) {
    const n = str(body.display_name, 40);
    if (!n || !(await checkText(env, n)).ok) fail(400, 'Pick a different name');
    sets.push('display_name = ?'); vals.push(n);
  }
  if (body.avatar !== undefined) { if (!AVATARS.includes(body.avatar)) fail(400, 'Pick an avatar from the list'); sets.push('avatar = ?'); vals.push(body.avatar); }
  if (body.theme !== undefined) { if (!THEMES.includes(body.theme)) fail(400, 'Pick a style from the list'); sets.push('theme = ?'); vals.push(body.theme); }
  if (body.notify_prefs !== undefined && typeof body.notify_prefs === 'object') { sets.push('notify_prefs = ?'); vals.push(JSON.stringify(body.notify_prefs).slice(0, 500)); }
  if (user.role === 'student') {
    if (body.section !== undefined) { if (!SECTIONS.includes(body.section)) fail(400, 'Pick a section'); sets.push('section = ?'); vals.push(body.section); }
    if (body.instrument !== undefined) { sets.push('instrument = ?'); vals.push(str(body.instrument, 30) || null); }
    if (body.grade !== undefined) { const g = toInt(body.grade); if (g !== null && (g < 9 || g > 12)) fail(400, 'Grade is 9–12'); sets.push('grade = ?'); vals.push(g); }
    if (body.can_drive !== undefined) { sets.push('can_drive = ?'); vals.push(bool(body.can_drive)); }
  }
  if (body.phone !== undefined) {
    const p = body.phone ? normalizePhone(body.phone) : null;
    if (body.phone && !p) fail(400, "That phone number doesn't look right");
    sets.push('phone = ?'); vals.push(p);
    if (!p) sets.push('sms_opt_in = 0');
  }
  if (body.sms_opt_in !== undefined) { sets.push('sms_opt_in = ?'); vals.push(bool(body.sms_opt_in)); }
  if (body.new_password !== undefined) {
    const me = await first(env, 'SELECT pass_hash, pass_salt FROM users WHERE id = ?', user.id);
    if (!(await verifyPassword(String(body.current_password || ''), me.pass_hash, me.pass_salt))) fail(400, 'Current password is wrong');
    if (String(body.new_password).length < 8) fail(400, 'New password needs at least 8 characters');
    const { hash, salt } = await hashPassword(String(body.new_password));
    sets.push('pass_hash = ?', 'pass_salt = ?'); vals.push(hash, salt);
  }
  if (sets.length) await run(env, `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...vals, user.id);
  return json({ ok: true });
});

add('DELETE', '/api/me', async ({ env, request, user, body }) => {
  const me = await first(env, 'SELECT pass_hash, pass_salt FROM users WHERE id = ?', user.id);
  if (!(await verifyPassword(String(body.password || ''), me.pass_hash, me.pass_salt))) fail(400, 'Password is wrong');
  if (user.is_admin && (await first(env, 'SELECT COUNT(*) AS n FROM users WHERE is_admin = 1 AND id != ?', user.id)).n === 0) fail(400, "You're the only admin — make someone else an admin first.");
  await env.DB.batch([
    env.DB.prepare('UPDATE posts SET body = ?, file_id = NULL, deleted_by = ? WHERE user_id = ?').bind('', user.id, user.id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);
  return json({ ok: true }, { headers: { 'set-cookie': await destroySession(env, request) } });
});

// ================================================================ members + blocks
add('GET', '/api/members', async ({ env, user }) => {
  // Students see students, parents see parents. No cross-role directory.
  const rows = await all(env,
    `SELECT id, display_name, username, avatar, section, instrument, grade, is_admin, can_drive FROM users
      WHERE role = ? AND status = 'active' ORDER BY section, display_name`, user.role);
  const blocked = new Set((await all(env, 'SELECT blocked_id FROM blocks WHERE blocker_id = ?', user.id)).map((b) => b.blocked_id));
  return json({ members: rows.map((m) => ({ ...m, blocked: blocked.has(m.id) })) });
});
add('POST', '/api/blocks', async ({ env, user, body }) => {
  const other = await first(env, 'SELECT id FROM users WHERE id = ?', toInt(body.user_id));
  if (!other || other.id === user.id) fail(404, 'Not found');
  await run(env, 'INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)', user.id, other.id);
  return json({ ok: true });
});
add('DELETE', '/api/blocks/:id', async ({ env, user, params }) => {
  await run(env, 'DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', user.id, toInt(params.id));
  return json({ ok: true });
});
const isBlocked = async (env, a, b) => !!(await first(env, 'SELECT 1 AS x FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)', a, b, b, a));

// ================================================================ channels (sections, topic threads, DMs)
const AUD = (user) => (user.role === 'parent' ? 'parents' : 'students');
async function visibleChannels(env, user) {
  return all(env,
    `SELECT c.* FROM channels c
      WHERE c.archived = 0 AND c.audience = ?1
        AND (c.kind != 'dm' OR EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = c.id AND m.user_id = ?2))`, AUD(user), user.id);
}
async function channelFor(env, user, id) {
  const c = await first(env, 'SELECT * FROM channels WHERE id = ?', toInt(id));
  if (!c || c.audience !== AUD(user)) fail(404, 'Thread not found');
  if (c.kind === 'dm' && !(await first(env, 'SELECT 1 AS x FROM channel_members WHERE channel_id = ? AND user_id = ?', c.id, user.id))) fail(404, 'Thread not found');
  return c;
}

add('GET', '/api/channels', async ({ env, user }) => {
  const chans = await visibleChannels(env, user);
  if (!chans.length) return json({ sections: [], dms: [] });
  const ids = chans.map((c) => c.id);
  const ph = ids.map((_, i) => `?${i + 2}`).join(',');
  const stats = await all(env,
    `SELECT c.id,
        (SELECT COUNT(*) FROM posts p WHERE p.channel_id = c.id AND p.deleted_by IS NULL AND (p.user_id IS NULL OR p.user_id != ?1)
           AND p.id > COALESCE((SELECT last_read_id FROM channel_reads r WHERE r.channel_id = c.id AND r.user_id = ?1), 0)
           AND (p.user_id IS NULL OR p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?1))) AS unread,
        (SELECT p.body FROM posts p WHERE p.channel_id = c.id AND p.deleted_by IS NULL ORDER BY p.id DESC LIMIT 1) AS last_body,
        (SELECT p.file_id FROM posts p WHERE p.channel_id = c.id AND p.deleted_by IS NULL ORDER BY p.id DESC LIMIT 1) AS last_file,
        (SELECT u.display_name FROM posts p JOIN users u ON u.id = p.user_id WHERE p.channel_id = c.id AND p.deleted_by IS NULL ORDER BY p.id DESC LIMIT 1) AS last_name
       FROM channels c WHERE c.id IN (${ph})`, user.id, ...ids);
  const by = Object.fromEntries(stats.map((s) => [s.id, s]));
  const others = await all(env,
    `SELECT m.channel_id, u.id, u.display_name, u.avatar, u.section FROM channel_members m JOIN users u ON u.id = m.user_id
      WHERE m.channel_id IN (${ids.map(() => '?').join(',')}) AND m.user_id != ?`, ...ids, user.id);
  const blocked = new Set((await all(env, 'SELECT blocked_id FROM blocks WHERE blocker_id = ?', user.id)).map((b) => b.blocked_id));
  const pack = (c) => ({ id: c.id, kind: c.kind, section: c.section, name: c.name, about: c.about, locked: !!c.locked, last_at: c.last_at,
    unread: by[c.id]?.unread || 0, last_body: by[c.id]?.last_body || (by[c.id]?.last_file ? '📎 File' : null), last_name: by[c.id]?.last_name || null });
  const sections = chans.filter((c) => c.kind === 'section').map((s) => ({ ...pack(s),
    topics: chans.filter((t) => t.kind === 'topic' && t.section === s.section).map(pack).sort((a, b) => (b.last_at || '').localeCompare(a.last_at || '')) }));
  const order = ['all', ...SECTIONS, 'parents'];
  sections.sort((a, b) => (a.section === user.section ? -1 : b.section === user.section ? 1 : order.indexOf(a.section) - order.indexOf(b.section)));
  const dms = chans.filter((c) => c.kind === 'dm').map((c) => {
    const o = others.find((x) => x.channel_id === c.id);
    return { ...pack(c), with: o ? { id: o.id, display_name: o.display_name, avatar: o.avatar, section: o.section } : null };
  }).filter((d) => d.with && !blocked.has(d.with.id)).sort((a, b) => (b.last_at || '').localeCompare(a.last_at || ''));
  return json({ sections, dms });
});

// New topic thread (e.g. "Movement 2 — drill set 14"). Students: in All Band or their own section.
add('POST', '/api/channels', async ({ env, ctx, user, body }) => {
  const section = user.role === 'parent' ? 'parents' : String(body.section || '');
  if (user.role === 'student' && !user.is_admin && !['all', user.section].includes(section)) fail(403, 'You can start threads in All Band or your own section');
  if (user.role === 'student' && !['all', ...SECTIONS].includes(section)) fail(400, 'Pick a section');
  const name = str(body.name, 50);
  if (!name) fail(400, 'Name the thread');
  await guardText(env, ctx, user, name + ' ' + str(body.about, 120), true);
  await rateLimit(env, 'thread:' + user.id, 15, 864e5, "That's a lot of new threads today!");
  const row = await first(env, `INSERT INTO channels (kind, audience, section, name, about, created_by, last_at) VALUES ('topic', ?, ?, ?, ?, ?, ?) RETURNING id`,
    AUD(user), section, name, str(body.about, 120) || null, user.id, nowIso());
  return json({ ok: true, id: row.id });
});
add('PATCH', '/api/channels/:id', async ({ env, user, params, body }) => {
  const c = await channelFor(env, user, params.id);
  if (c.kind === 'dm') fail(400, 'Not for direct messages');
  if (!user.is_admin && c.created_by !== user.id) fail(403, 'Only the person who started it (or an admin) can change it');
  if (c.kind === 'section' && !user.is_admin) fail(403, 'Admins only');
  const sets = [], vals = [];
  if (body.name !== undefined) { const n = str(body.name, 50); if (!n) fail(400, 'Name the thread'); sets.push('name = ?'); vals.push(n); }
  if (body.about !== undefined) { sets.push('about = ?'); vals.push(str(body.about, 120) || null); }
  if (body.locked !== undefined && user.is_admin) { sets.push('locked = ?'); vals.push(bool(body.locked)); }
  if (body.archived !== undefined && c.kind === 'topic') { sets.push('archived = ?'); vals.push(bool(body.archived)); }
  if (sets.length) await run(env, `UPDATE channels SET ${sets.join(', ')} WHERE id = ?`, ...vals, c.id);
  return json({ ok: true });
});

// Start (or reopen) a direct message — students with students, parents with parents only.
add('POST', '/api/dms', async ({ env, user, body }) => {
  const other = await first(env, `SELECT id, role, status FROM users WHERE id = ?`, toInt(body.user_id));
  if (!other || other.status !== 'active' || other.id === user.id) fail(404, 'Person not found');
  if (other.role !== user.role) fail(403, user.role === 'student' ? 'You can message other students' : 'You can message other parents');
  if (await isBlocked(env, user.id, other.id)) fail(403, "You can't message this person");
  const existing = await first(env,
    `SELECT c.id FROM channels c JOIN channel_members a ON a.channel_id = c.id AND a.user_id = ? JOIN channel_members b ON b.channel_id = c.id AND b.user_id = ?
      WHERE c.kind = 'dm'`, user.id, other.id);
  if (existing) return json({ ok: true, id: existing.id });
  const row = await first(env, `INSERT INTO channels (kind, audience, name, created_by) VALUES ('dm', ?, 'DM', ?) RETURNING id`, AUD(user), user.id);
  await env.DB.batch([user.id, other.id].map((u) => env.DB.prepare('INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)').bind(row.id, u)));
  return json({ ok: true, id: row.id });
});

const postCols = `p.id, p.body, p.created_at, p.user_id, p.deleted_by, u.display_name, u.avatar, u.section, u.is_admin,
                  f.id AS file_id, f.name AS file_name, f.kind AS file_kind, f.mime AS file_mime, f.size AS file_size, f.deleted AS file_deleted`;
add('GET', '/api/channels/:id/posts', async ({ env, user, params, url }) => {
  const c = await channelFor(env, user, params.id);
  const after = toInt(url.searchParams.get('after')) || 0;
  let rows = after
    ? await all(env, `SELECT ${postCols} FROM posts p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN files f ON f.id = p.file_id WHERE p.channel_id = ? AND p.id > ? ORDER BY p.id LIMIT 200`, c.id, after)
    : (await all(env, `SELECT ${postCols} FROM posts p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN files f ON f.id = p.file_id WHERE p.channel_id = ? ORDER BY p.id DESC LIMIT 150`, c.id)).reverse();
  const blocked = new Set((await all(env, 'SELECT blocked_id FROM blocks WHERE blocker_id = ?', user.id)).map((b) => b.blocked_id));
  rows = rows.filter((r) => !blocked.has(r.user_id)).map((r) => ({
    id: r.id, created_at: r.created_at, deleted: !!r.deleted_by, body: r.deleted_by ? '' : r.body,
    author: r.user_id ? { id: r.user_id, display_name: r.display_name || 'Former member', avatar: r.avatar || 'star', section: r.section, admin: !!r.is_admin } : null,
    file: r.file_id && !r.deleted_by && !r.file_deleted ? { id: r.file_id, name: r.file_name, kind: r.file_kind, mime: r.file_mime, size: r.file_size } : null,
  }));
  if (rows.length) {
    await run(env, `INSERT INTO channel_reads (channel_id, user_id, last_read_id) VALUES (?, ?, ?)
      ON CONFLICT(channel_id, user_id) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)`, c.id, user.id, rows[rows.length - 1].id);
    await run(env, `UPDATE notifications SET read_at = ? WHERE user_id = ? AND link = ? AND read_at IS NULL`, nowIso(), user.id, `thread:${c.id}`);
  }
  let peer = null;
  if (c.kind === 'dm') peer = await first(env, `SELECT u.id, u.display_name, u.avatar, u.section FROM channel_members m JOIN users u ON u.id = m.user_id WHERE m.channel_id = ? AND m.user_id != ?`, c.id, user.id);
  return json({ channel: { id: c.id, kind: c.kind, section: c.section, name: c.name, about: c.about, locked: !!c.locked, mine: c.created_by === user.id }, peer, posts: rows });
});

add('POST', '/api/channels/:id/posts', async ({ env, ctx, user, params, body }) => {
  const c = await channelFor(env, user, params.id);
  if (c.locked && !user.is_admin) fail(403, 'Only admins can post in this thread');
  const text = str(body.body, 2000);
  const fileId = toInt(body.file_id);
  if (!text && !fileId) fail(400, 'Type a message or attach a file');
  let peer = null;
  if (c.kind === 'dm') {
    peer = await first(env, `SELECT u.* FROM channel_members m JOIN users u ON u.id = m.user_id WHERE m.channel_id = ? AND m.user_id != ?`, c.id, user.id);
    if (!peer || peer.status !== 'active' || await isBlocked(env, user.id, peer.id)) fail(403, "You can't message this person");
  }
  if (fileId) {
    const f = await first(env, 'SELECT id, owner_id, deleted FROM files WHERE id = ?', fileId);
    if (!f || f.owner_id !== user.id || f.deleted) fail(400, 'That file is missing — upload it again');
  }
  await rateLimit(env, 'post:' + user.id, 40, 60e3, "You're sending messages really fast — take a breath.");
  const g = text ? await guardText(env, ctx, user, text, body.confirm) : { ok: true };
  const row = await first(env, 'INSERT INTO posts (channel_id, user_id, body, file_id) VALUES (?, ?, ?, ?) RETURNING id, created_at', c.id, user.id, text, fileId || null);
  await run(env, 'UPDATE channels SET last_at = ? WHERE id = ?', row.created_at, c.id);
  const preview = text ? (text.length > 100 ? text.slice(0, 97) + '…' : text) : '📎 Sent a file';
  if (peer) {
    await notify(env, ctx, [peer], { type: 'dm', title: `Message from ${user.display_name}`, body: preview, link: `thread:${c.id}`, dedupe: `dm:${c.id}` });
  } else {
    // @mentions in threads → notify those people (same audience only)
    const names = [...new Set((text.match(/@([a-z0-9._-]{3,30})/gi) || []).map((m) => m.slice(1).toLowerCase()))].slice(0, 10);
    if (names.length) {
      const people = await usersWhere(env, `role = ? AND id != ? AND lower(username) IN (${names.map(() => '?').join(',')})`, user.role, user.id, ...names);
      const ok = [];
      for (const p of people) if (!(await isBlocked(env, user.id, p.id))) ok.push(p);
      await notify(env, ctx, ok, { type: 'mention', title: `${user.display_name} mentioned you in ${c.name}`, body: preview, link: `thread:${c.id}` });
    }
  }
  return json({ ok: true, id: row.id, support: g.selfHarm ? SUPPORT : undefined });
});

add('DELETE', '/api/posts/:id', async ({ env, user, params }) => {
  const p = await first(env, 'SELECT p.id, p.user_id, p.file_id, c.audience FROM posts p JOIN channels c ON c.id = p.channel_id WHERE p.id = ?', toInt(params.id));
  if (!p) fail(404, 'Not found');
  if (p.user_id !== user.id && !user.is_admin) fail(403, 'You can only delete your own messages');
  await run(env, 'UPDATE posts SET body = ?, deleted_by = ? WHERE id = ?', '', user.id, p.id);
  if (p.file_id) await run(env, 'UPDATE files SET deleted = 1 WHERE id = ?', p.file_id);
  return json({ ok: true });
});

// ================================================================ files (sheet music, photos) → R2
function sniff(bytes) {
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { kind: 'pdf', mime: 'application/pdf' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'image', mime: 'image/jpeg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { kind: 'image', mime: 'image/png' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { kind: 'image', mime: 'image/webp' };
  return null;
}
add('POST', '/api/files', async ({ env, ctx, request, user }) => {
  if (!env.FILES) fail(503, "File uploads aren't set up yet (the admin needs to turn on R2 storage).");
  await rateLimit(env, 'upload:' + user.id, 30, 3600e3, 'Too many uploads this hour.');
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_FILE) fail(413, 'Files can be up to 15 MB');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) fail(400, 'That file is empty');
  if (bytes.length > MAX_FILE) fail(413, 'Files can be up to 15 MB');
  const type = sniff(bytes);
  if (!type) fail(415, 'You can upload PDFs (like sheet music) and photos (JPG, PNG, WebP)');
  let name = str(decodeURIComponent(request.headers.get('x-file-name') || ''), 100).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || (type.kind === 'pdf' ? 'sheet-music.pdf' : 'photo.jpg');
  const nameCheck = await checkText(env, name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '));
  if (!nameCheck.ok && !nameCheck.nudge) fail(422, 'Rename the file and try again');
  if (type.kind === 'image') {
    const verdict = await checkImage(env, bytes, type.mime);
    if (!verdict.ok) { await logGuard(env, ctx, user, { kind: verdict.kind || 'photo' }); fail(422, verdict.message, { blocked: 'photo' }); }
  }
  const key = `${type.kind}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: type.mime } });
  const row = await first(env, 'INSERT INTO files (r2_key, owner_id, name, mime, size, kind) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    key, user.id, name, type.mime, bytes.length, type.kind);
  return json({ ok: true, id: row.id, name, kind: type.kind, mime: type.mime, size: bytes.length });
}, { raw: true });

add('GET', '/api/files/:id', async ({ env, user, params, url }) => {
  const f = await first(env, 'SELECT * FROM files WHERE id = ?', toInt(params.id));
  if (!f || f.deleted) fail(404, 'File not found');
  if (f.owner_id !== user.id) {
    // Must be attached to a post in a thread this person can see
    const p = await first(env, `SELECT c.id FROM posts p JOIN channels c ON c.id = p.channel_id WHERE p.file_id = ? AND p.deleted_by IS NULL LIMIT 1`, f.id);
    // Admins can open a file that was reported, so they can review it.
    const reported = user.is_admin && await first(env, 'SELECT r.id FROM reports r JOIN posts p ON p.id = r.post_id WHERE p.file_id = ? LIMIT 1', f.id);
    if (!reported) {
      if (!p) fail(404, 'File not found');
      await channelFor(env, user, p.id);
    }
  }
  if (!env.FILES) fail(503, 'File storage is not set up');
  const obj = await env.FILES.get(f.r2_key);
  if (!obj) fail(404, 'File not found');
  const dl = url.searchParams.has('download');
  return new Response(obj.body, { headers: {
    'content-type': f.mime, 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex',
    'content-disposition': `${dl ? 'attachment' : 'inline'}; filename="${f.name.replace(/"/g, '')}"`,
  } });
});

// ================================================================ reports
add('POST', '/api/reports', async ({ env, ctx, user, body }) => {
  const reasons = ['mean', 'bullying', 'inappropriate', 'photo', 'threat', 'spam', 'other'];
  const reason = reasons.includes(body.reason) ? body.reason : fail(400, 'Pick a reason');
  let postId = toInt(body.post_id), userId = toInt(body.user_id);
  if (postId) {
    const p = await first(env, 'SELECT id, channel_id, user_id FROM posts WHERE id = ?', postId);
    if (!p) fail(404, 'Message not found');
    await channelFor(env, user, p.channel_id);
    userId = p.user_id;
  }
  if (!userId) fail(400, 'Who are you reporting?');
  await rateLimit(env, 'report:' + user.id, 20, 864e5);
  await run(env, 'INSERT INTO reports (reporter_id, user_id, post_id, reason, details) VALUES (?, ?, ?, ?, ?)', user.id, userId, postId || null, reason, str(body.details, 500) || null);
  await notify(env, ctx, await usersWhere(env, 'is_admin = 1'), { type: 'safety', title: 'New report to review', body: `Reason: ${reason}`, link: 'admin', dedupe: 'reports-open' });
  return json({ ok: true });
});

// ================================================================ schedule + school calendar + weather
const schoolCal = (env) => all(env, 'SELECT start_date, end_date, kind, title FROM school_calendar ORDER BY start_date, id');
async function famLike(env) {
  const s = await settings(env);
  return { school_arrive: s.school_arrive || '07:50', school_start: s.school_start || '08:00', school_end: s.school_end || '15:20',
    walk_minutes: Number(s.walk_minutes || 20), walk_miles: Number(s.walk_miles || 1), location_name: s.location_name || 'Sioux Falls, SD',
    lat: Number(s.lat || 43.5446), lon: Number(s.lon || -96.7311), school_name: s.school_name || null };
}
add('GET', '/api/today', async ({ env, ctx }) => {
  const [fam, cal] = await Promise.all([famLike(env), schoolCal(env)]);
  const day = pickSchoolDay(fam, TZ(env), cal);
  const sched = schedule(fam);
  return json({ day, schedule: sched, weather: await walkWeather(env, ctx, fam, day, sched), location: fam.location_name, school_name: fam.school_name, school: schoolNews(TZ(env), cal) });
});
add('GET', '/api/school-calendar', async ({ env }) => json({ days: await schoolCal(env) }));

// ================================================================ band events (rehearsals, games, competitions)
add('GET', '/api/events', async ({ env, user }) => {
  const rows = await all(env, `SELECT e.*, u.display_name AS by_name FROM events e LEFT JOIN users u ON u.id = e.created_by
     WHERE e.starts_at > ? ORDER BY e.starts_at LIMIT 100`, ago(6 * 3600e3));
  return json({ events: rows.filter((e) => user.role === 'parent' || !e.section || e.section === user.section || user.is_admin) });
});
function eventFields(body) {
  const kinds = ['rehearsal', 'game', 'competition', 'concert', 'sectional', 'other'];
  const starts = new Date(body.starts_at || '');
  if (isNaN(starts)) fail(400, 'Pick a date and time');
  const title = str(body.title, 80); if (!title) fail(400, 'Give it a title');
  const ends = body.ends_at ? new Date(body.ends_at) : null;
  if (body.call_time && !TIME_RE.test(body.call_time)) fail(400, 'Call time looks like 17:30');
  return { title, kind: kinds.includes(body.kind) ? body.kind : 'other', section: SECTIONS.includes(body.section) ? body.section : null,
    starts_at: starts.toISOString(), ends_at: ends && !isNaN(ends) && ends > starts ? ends.toISOString() : null,
    location: str(body.location, 100) || null, details: str(body.details, 500) || null, call_time: body.call_time || null };
}
add('POST', '/api/events', async ({ env, ctx, user, body }) => {
  const e = eventFields(body);
  const row = await first(env, `INSERT INTO events (title, kind, section, starts_at, ends_at, location, details, call_time, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    e.title, e.kind, e.section, e.starts_at, e.ends_at, e.location, e.details, e.call_time, user.id);
  const who = e.section ? await usersWhere(env, `(role = 'parent') OR (role = 'student' AND section = ?)`, e.section) : await usersWhere(env, '1 = 1');
  await notify(env, ctx, who.filter((u) => u.id !== user.id), { type: 'event', title: `📅 ${e.title}`, body: `${when(env, e.starts_at)}${e.call_time ? ` · call ${e.call_time}` : ''}${e.location ? ` · ${e.location}` : ''}`, link: 'calendar' });
  return json({ ok: true, id: row.id });
}, { admin: true });
add('PATCH', '/api/events/:id', async ({ env, ctx, user, params, body }) => {
  const ev = await first(env, 'SELECT * FROM events WHERE id = ?', toInt(params.id));
  if (!ev) fail(404, 'Event not found');
  if (body.cancelled !== undefined) {
    await run(env, 'UPDATE events SET cancelled = ? WHERE id = ?', bool(body.cancelled), ev.id);
    if (bool(body.cancelled)) await notify(env, ctx, (await usersWhere(env, '1 = 1')).filter((u) => u.id !== user.id), { type: 'event', title: `Cancelled: ${ev.title}`, body: when(env, ev.starts_at), link: 'calendar' });
    return json({ ok: true });
  }
  const e = eventFields({ ...ev, ...body });
  await run(env, 'UPDATE events SET title = ?, kind = ?, section = ?, starts_at = ?, ends_at = ?, location = ?, details = ?, call_time = ? WHERE id = ?',
    e.title, e.kind, e.section, e.starts_at, e.ends_at, e.location, e.details, e.call_time, ev.id);
  return json({ ok: true });
}, { admin: true });

// ================================================================ hangout spots + hangouts (students)
const SPOT_KINDS = ['house', 'park', 'school', 'food', 'music', 'other'];
add('GET', '/api/spots', async ({ env }) => json({ spots: await all(env, `SELECT s.id, s.name, s.kind, s.address, s.notes, s.created_by, u.display_name AS by_name FROM spots s LEFT JOIN users u ON u.id = s.created_by WHERE s.archived = 0 ORDER BY s.name`) }));
add('POST', '/api/spots', async ({ env, ctx, user, body }) => {
  const name = str(body.name, 60); if (!name) fail(400, 'Name the spot');
  await guardText(env, ctx, user, `${name} ${str(body.notes, 200)}`, true);
  await rateLimit(env, 'spot:' + user.id, 20, 864e5);
  const row = await first(env, 'INSERT INTO spots (name, kind, address, notes, created_by) VALUES (?, ?, ?, ?, ?) RETURNING id',
    name, SPOT_KINDS.includes(body.kind) ? body.kind : 'other', str(body.address, 120) || null, str(body.notes, 200) || null, user.id);
  return json({ ok: true, id: row.id });
}, { role: 'student' });
add('DELETE', '/api/spots/:id', async ({ env, user, params }) => {
  const s = await first(env, 'SELECT id, created_by FROM spots WHERE id = ?', toInt(params.id));
  if (!s) fail(404, 'Not found');
  if (s.created_by !== user.id && !user.is_admin) fail(403, 'Only the person who added it (or an admin) can remove it');
  await run(env, 'UPDATE spots SET archived = 1 WHERE id = ?', s.id);
  return json({ ok: true });
});

add('GET', '/api/hangouts', async ({ env, user }) => {
  const rows = await all(env,
    `SELECT h.*, u.display_name AS by_name, u.avatar AS by_avatar, s.name AS spot_name, s.kind AS spot_kind, s.address AS spot_address
       FROM hangouts h JOIN users u ON u.id = h.created_by LEFT JOIN spots s ON s.id = h.spot_id
      WHERE h.cancelled = 0 AND h.starts_at > ? ORDER BY h.starts_at LIMIT 60`, ago(3 * 3600e3));
  if (!rows.length) return json({ hangouts: [] });
  const rs = await all(env, `SELECT r.hangout_id, r.status, u.id, u.display_name, u.avatar FROM hangout_rsvps r JOIN users u ON u.id = r.user_id
    WHERE r.hangout_id IN (${rows.map(() => '?').join(',')})`, ...rows.map((h) => h.id));
  const blocked = new Set((await all(env, 'SELECT blocked_id FROM blocks WHERE blocker_id = ?', user.id)).map((b) => b.blocked_id));
  return json({ hangouts: rows.filter((h) => !blocked.has(h.created_by)).map((h) => {
    const mine = rs.filter((r) => r.hangout_id === h.id);
    return { id: h.id, title: h.title, starts_at: h.starts_at, details: h.details, place: h.spot_name || h.place, spot_kind: h.spot_kind, spot_address: h.spot_address,
      by: { id: h.created_by, display_name: h.by_name, avatar: h.by_avatar }, mine: h.created_by === user.id,
      my_rsvp: mine.find((r) => r.id === user.id)?.status || null,
      going: mine.filter((r) => r.status === 'going').map(({ id, display_name, avatar }) => ({ id, display_name, avatar })),
      maybe: mine.filter((r) => r.status === 'maybe').length };
  }) });
}, { role: 'student' });
add('POST', '/api/hangouts', async ({ env, ctx, user, body }) => {
  const title = str(body.title, 60) || 'Hang out';
  const starts = new Date(body.starts_at || '');
  if (isNaN(starts)) fail(400, 'Pick a day and time');
  if (starts < new Date(Date.now() - 15 * 60e3)) fail(400, "That time already passed — pick a time that's coming up");
  const spot = toInt(body.spot_id) ? await first(env, 'SELECT id FROM spots WHERE id = ? AND archived = 0', toInt(body.spot_id)) : null;
  const place = str(body.place, 80) || null;
  if (!spot && !place) fail(400, 'Pick a spot or type where');
  await guardText(env, ctx, user, `${title} ${place || ''} ${str(body.details, 300)}`, true);
  await rateLimit(env, 'hangout:' + user.id, 10, 864e5, "That's a lot of hangouts for one day!");
  const row = await first(env, 'INSERT INTO hangouts (title, spot_id, place, starts_at, details, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    title, spot?.id || null, spot ? null : place, starts.toISOString(), str(body.details, 300) || null, user.id);
  await run(env, `INSERT INTO hangout_rsvps (hangout_id, user_id, status) VALUES (?, ?, 'going')`, row.id, user.id);
  // Invite specific people (optional)
  const invite = [...new Set((Array.isArray(body.invite) ? body.invite : []).map(toInt).filter(Boolean))].slice(0, 30);
  if (invite.length) {
    const people = await usersWhere(env, `role = 'student' AND id IN (${invite.map(() => '?').join(',')})`, ...invite);
    const ok = []; for (const p of people) if (p.id !== user.id && !(await isBlocked(env, user.id, p.id))) ok.push(p);
    await notify(env, ctx, ok, { type: 'hangout', title: `${firstName(user.display_name)} invited you: ${title}`, body: `${when(env, starts.toISOString())}`, link: 'hangouts' });
  }
  return json({ ok: true, id: row.id });
}, { role: 'student' });
add('POST', '/api/hangouts/:id/rsvp', async ({ env, ctx, user, params, body }) => {
  const h = await first(env, 'SELECT id, title, created_by, starts_at FROM hangouts WHERE id = ? AND cancelled = 0', toInt(params.id));
  if (!h) fail(404, 'Hangout not found');
  const status = ['going', 'maybe', 'no'].includes(body.status) ? body.status : fail(400, 'Going, maybe or no?');
  await run(env, `INSERT INTO hangout_rsvps (hangout_id, user_id, status) VALUES (?, ?, ?) ON CONFLICT(hangout_id, user_id) DO UPDATE SET status = excluded.status`, h.id, user.id, status);
  if (status === 'going' && h.created_by !== user.id) {
    const [host] = await usersWhere(env, 'id = ?', h.created_by);
    await notify(env, ctx, [host], { type: 'hangout', title: `${firstName(user.display_name)} is coming to ${h.title}`, link: 'hangouts', dedupe: `hg:${h.id}` });
  }
  return json({ ok: true });
}, { role: 'student' });
add('POST', '/api/hangouts/:id/cancel', async ({ env, ctx, user, params }) => {
  const h = await first(env, 'SELECT id, title, created_by, starts_at FROM hangouts WHERE id = ?', toInt(params.id));
  if (!h) fail(404, 'Hangout not found');
  if (h.created_by !== user.id && !user.is_admin) fail(403, 'Only the person who made it can cancel it');
  await run(env, 'UPDATE hangouts SET cancelled = 1 WHERE id = ?', h.id);
  const going = await all(env, `SELECT u.${userCols.split(', ').join(', u.')} FROM hangout_rsvps r JOIN users u ON u.id = r.user_id WHERE r.hangout_id = ? AND r.status != 'no' AND u.id != ?`, h.id, user.id);
  await notify(env, ctx, going, { type: 'hangout', title: `Cancelled: ${h.title}`, body: when(env, h.starts_at), link: 'hangouts' });
  return json({ ok: true });
});

// ================================================================ rides
// Students ask; band parents and licensed student drivers can say "I've got it". First one wins.
const RIDE_REASONS = { rain: '🌧️ Rain', snow: '🌨️ Snow', storm: '⛈️ Storms', cold: '🥶 Freezing', late: '🌙 Late rehearsal', gear: '🥁 Carrying gear', other: '🚗' };
const rideKind = (k) => ({ dropoff: 'drop-off', pickup: 'pickup', ride: 'ride' }[k] || 'ride');
const canDrive = (user) => user.role === 'parent' || !!user.can_drive;
async function rideList(env, user, id = null) {
  const rows = await all(env,
    `SELECT r.*, q.display_name AS requested_by_name, q.avatar AS requested_by_avatar, q.section AS requested_by_section,
            c.display_name AS claimed_by_name, c.role AS claimed_by_role, c.phone AS claimed_by_phone
       FROM rides r JOIN users q ON q.id = r.requested_by LEFT JOIN users c ON c.id = r.claimed_by
      WHERE ${id ? 'r.id = ?' : "r.status != 'cancelled' AND r.starts_at > ?"} ORDER BY r.starts_at LIMIT 60`, id || ago(3 * 3600e3));
  return rows.filter((r) => canDrive(user) || r.requested_by === user.id || r.claimed_by === user.id).map((r) => ({
    id: r.id, kind: r.kind, reason: r.reason, starts_at: r.starts_at, from_place: r.from_place, to_place: r.to_place, seats: r.seats, note: r.note, status: r.status,
    requested_by: { id: r.requested_by, display_name: r.requested_by_name, avatar: r.requested_by_avatar, section: r.requested_by_section },
    claimed_by: r.claimed_by ? { id: r.claimed_by, display_name: r.claimed_by_name, teen: r.claimed_by_role === 'student',
      phone: r.requested_by === user.id || r.claimed_by === user.id ? r.claimed_by_phone : null } : null,
    mine: r.requested_by === user.id, driving: r.claimed_by === user.id,
  }));
}
add('GET', '/api/rides', async ({ env, user }) => json({ rides: await rideList(env, user), can_drive: canDrive(user) }));
add('POST', '/api/rides', async ({ env, ctx, user, body }) => {
  const kind = ['pickup', 'dropoff', 'ride'].includes(body.kind) ? body.kind : 'ride';
  const reason = Object.hasOwn(RIDE_REASONS, body.reason) ? body.reason : 'other';
  const starts = new Date(body.starts_at || '');
  if (isNaN(starts)) fail(400, 'Pick a time');
  if (starts < new Date(Date.now() - 15 * 60e3)) fail(400, "That time already passed — pick a time that's coming up");
  if (starts > new Date(Date.now() + 14 * 864e5)) fail(400, 'Rides can be asked for up to two weeks ahead');
  const from = str(body.from_place, 80), to = str(body.to_place, 80), note = str(body.note, 160) || null;
  if (!from || !to) fail(400, 'Say where from and where to');
  await guardText(env, ctx, user, `${from} ${to} ${note || ''}`, true);
  const seats = Math.min(8, Math.max(1, toInt(body.seats) || 1));
  await rateLimit(env, 'ride:' + user.id, 10, 864e5, "That's a lot of ride requests today.");
  const row = await first(env, 'INSERT INTO rides (requested_by, kind, reason, starts_at, from_place, to_place, seats, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
    user.id, kind, reason, starts.toISOString(), from, to, seats, note);
  const drivers = await usersWhere(env, `id != ? AND (role = 'parent' OR (role = 'student' AND can_drive = 1))`, user.id);
  const notBlocked = []; for (const d of drivers) if (!(await isBlocked(env, user.id, d.id))) notBlocked.push(d);
  await notify(env, ctx, notBlocked.filter((d) => d.role === 'parent'), {
    type: 'ride', title: `${RIDE_REASONS[reason]} — ${firstName(user.display_name)} needs a ${rideKind(kind)}`,
    body: `${from} → ${to} · ${when(env, starts.toISOString())}${seats > 1 ? ` · ${seats} people` : ''}. Open ${APP(env)} and tap "I've got it" if you can drive.`, link: 'rides',
  }, { sms: true });
  await notify(env, ctx, notBlocked.filter((d) => d.role === 'student'), { type: 'ride', title: `${firstName(user.display_name)} needs a ${rideKind(kind)}`, body: `${from} → ${to} · ${when(env, starts.toISOString())}`, link: 'rides' });
  return json({ ok: true, id: row.id, drivers_asked: notBlocked.length });
}, { role: 'student' });
add('POST', '/api/rides/:id/claim', async ({ env, ctx, user, params }) => {
  if (!canDrive(user)) fail(403, 'Parents and licensed student drivers can give rides');
  const [ride] = await rideList(env, user, toInt(params.id));
  if (!ride) fail(404, 'Ride not found');
  if (ride.mine) fail(400, "You can't drive your own ride request");
  if (ride.status === 'cancelled') fail(400, 'This ride was cancelled');
  const r = await run(env, `UPDATE rides SET status = 'claimed', claimed_by = ?, claimed_at = ? WHERE id = ? AND status = 'open'`, user.id, nowIso(), ride.id);
  if (!r.meta.changes) fail(409, `${ride.claimed_by ? firstName(ride.claimed_by.display_name) : 'Someone'} already has this one 👍`);
  const [rider] = await usersWhere(env, 'id = ?', ride.requested_by.id);
  await notify(env, ctx, [rider], { type: 'ride_update', title: `🚗 ${user.display_name}${user.role === 'student' ? ' (student driver)' : ''} is driving you!`, body: `${ride.from_place} → ${ride.to_place} · ${when(env, ride.starts_at)}`, link: 'rides' }, { sms: true });
  return json({ ok: true });
});
add('POST', '/api/rides/:id/unclaim', async ({ env, ctx, user, params }) => {
  const [ride] = await rideList(env, user, toInt(params.id));
  if (!ride || !ride.driving || ride.status !== 'claimed') fail(403, "You're not the driver for this ride");
  await run(env, `UPDATE rides SET status = 'open', claimed_by = NULL, claimed_at = NULL WHERE id = ?`, ride.id);
  const [rider] = await usersWhere(env, 'id = ?', ride.requested_by.id);
  await notify(env, ctx, [rider], { type: 'ride_update', title: 'Your ride needs a new driver', body: `${firstName(user.display_name)} can't make it — others can still pick it up.`, link: 'rides' }, { sms: true });
  return json({ ok: true });
});
add('POST', '/api/rides/:id/cancel', async ({ env, ctx, user, params }) => {
  const [ride] = await rideList(env, user, toInt(params.id));
  if (!ride || (!ride.mine && !user.is_admin)) fail(403, 'Only the person who asked can cancel');
  await run(env, `UPDATE rides SET status = 'cancelled' WHERE id = ?`, ride.id);
  if (ride.claimed_by) {
    const [d] = await usersWhere(env, 'id = ?', ride.claimed_by.id);
    await notify(env, ctx, [d], { type: 'ride_update', title: 'Ride cancelled', body: `${firstName(ride.requested_by.display_name)} doesn't need the ${rideKind(ride.kind)} anymore`, link: 'rides' }, { sms: true });
  }
  return json({ ok: true });
});

// ---- ride offers: "I'm driving from the band room to Eastside at 8:15 — 3 seats"
async function offerList(env, user, id = null) {
  const rows = await all(env,
    `SELECT o.*, u.display_name AS driver_name, u.avatar AS driver_avatar, u.role AS driver_role, u.section AS driver_section
       FROM ride_offers o JOIN users u ON u.id = o.driver_id
      WHERE ${id ? 'o.id = ?' : 'o.cancelled = 0 AND o.starts_at > ?'} ORDER BY o.starts_at LIMIT 60`, id || ago(2 * 3600e3));
  if (!rows.length) return [];
  const seats = await all(env, `SELECT s.offer_id, u.id, u.display_name, u.avatar FROM ride_seats s JOIN users u ON u.id = s.user_id
    WHERE s.offer_id IN (${rows.map(() => '?').join(',')}) ORDER BY s.created_at`, ...rows.map((r) => r.id));
  const blocked = new Set((await all(env, 'SELECT blocked_id FROM blocks WHERE blocker_id = ? UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?', user.id, user.id)).map((b) => b.blocked_id));
  return rows.filter((o) => !blocked.has(o.driver_id)).map((o) => {
    const riders = seats.filter((s) => s.offer_id === o.id);
    const mine = o.driver_id === user.id;
    return { id: o.id, starts_at: o.starts_at, from_place: o.from_place, to_place: o.to_place, seats: o.seats, note: o.note, cancelled: !!o.cancelled,
      driver: { id: o.driver_id, display_name: o.driver_name, avatar: o.driver_avatar, teen: o.driver_role === 'student', section: o.driver_section },
      // riders' names are visible to the driver and to the riders themselves
      riders: mine || riders.some((r) => r.id === user.id) ? riders.map(({ id, display_name, avatar }) => ({ id, display_name, avatar })) : [],
      taken: riders.length, open: Math.max(0, o.seats - riders.length), mine, joined: riders.some((r) => r.id === user.id) };
  });
}
add('GET', '/api/ride-offers', async ({ env, user }) => json({ offers: await offerList(env, user) }));
add('POST', '/api/ride-offers', async ({ env, ctx, user, body }) => {
  if (!canDrive(user)) fail(403, 'Turn on "I can drive" in your profile first');
  const starts = new Date(body.starts_at || '');
  if (isNaN(starts)) fail(400, 'Pick a time');
  if (starts < new Date(Date.now() - 15 * 60e3)) fail(400, "That time already passed — pick a time that's coming up");
  const from = str(body.from_place, 80), to = str(body.to_place, 80), note = str(body.note, 160) || null;
  if (!from || !to) fail(400, 'Say where from and where to');
  await guardText(env, ctx, user, `${from} ${to} ${note || ''}`, true);
  const seats = Math.min(8, Math.max(1, toInt(body.seats) || 3));
  await rateLimit(env, 'offer:' + user.id, 10, 864e5);
  const row = await first(env, 'INSERT INTO ride_offers (driver_id, starts_at, from_place, to_place, seats, note) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    user.id, starts.toISOString(), from, to, seats, note);
  return json({ ok: true, id: row.id });
});
add('POST', '/api/ride-offers/:id/join', async ({ env, ctx, user, params, body }) => {
  const [o] = await offerList(env, user, toInt(params.id));
  if (!o || o.cancelled) fail(404, 'Ride not found');
  if (o.mine) fail(400, "That's your own ride");
  if (body.leave) {
    await run(env, 'DELETE FROM ride_seats WHERE offer_id = ? AND user_id = ?', o.id, user.id);
    const [d] = await usersWhere(env, 'id = ?', o.driver.id);
    await notify(env, ctx, [d], { type: 'ride_update', title: `${firstName(user.display_name)} doesn't need the seat anymore`, body: `${o.from_place} → ${o.to_place} · ${when(env, o.starts_at)}`, link: 'rides' });
    return json({ ok: true });
  }
  if (user.role !== 'student') fail(403, 'Seats are for students');
  if (o.joined) return json({ ok: true });
  // Atomic seat grab: only insert while seats remain
  const r = await run(env, `INSERT INTO ride_seats (offer_id, user_id) SELECT ?, ? WHERE (SELECT COUNT(*) FROM ride_seats WHERE offer_id = ?) < ?`, o.id, user.id, o.id, o.seats);
  if (!r.meta.changes) fail(409, 'That ride is full');
  const [d] = await usersWhere(env, 'id = ?', o.driver.id);
  await notify(env, ctx, [d], { type: 'ride_update', title: `🚗 ${firstName(user.display_name)} grabbed a seat`, body: `${o.from_place} → ${o.to_place} · ${when(env, o.starts_at)}`, link: 'rides' });
  return json({ ok: true });
});
add('POST', '/api/ride-offers/:id/cancel', async ({ env, ctx, user, params }) => {
  const [o] = await offerList(env, user, toInt(params.id));
  if (!o || (!o.mine && !user.is_admin)) fail(403, 'Only the driver can cancel');
  await run(env, 'UPDATE ride_offers SET cancelled = 1 WHERE id = ?', o.id);
  const riders = o.riders.length ? await usersWhere(env, `id IN (${o.riders.map(() => '?').join(',')})`, ...o.riders.map((r) => r.id)) : [];
  await notify(env, ctx, riders, { type: 'ride_update', title: `Ride cancelled by ${firstName(o.driver.display_name)}`, body: `${o.from_place} → ${o.to_place} · ${when(env, o.starts_at)}`, link: 'rides' }, { sms: true });
  return json({ ok: true });
});

// ================================================================ notifications
add('GET', '/api/notifications', async ({ env, user }) => json({ notifications: await all(env, 'SELECT id, type, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100', user.id) }));
add('POST', '/api/notifications/read', async ({ env, user, body }) => {
  if (body.all) await run(env, 'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', nowIso(), user.id);
  else if (toInt(body.id)) await run(env, 'UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?', nowIso(), toInt(body.id), user.id);
  return json({ ok: true });
});

// ================================================================ admin
add('GET', '/api/admin', async ({ env }) => {
  const codes = await joinCodes(env);
  const s = await settings(env);
  const members = await all(env, `SELECT id, role, is_admin, status, display_name, username, avatar, section, instrument, grade, can_drive, created_at FROM users ORDER BY role DESC, section, display_name`);
  const reports = await all(env,
    `SELECT r.id, r.reason, r.details, r.status, r.created_at, r.post_id, a.display_name AS reporter_name, b.display_name AS reported_name, b.id AS reported_id,
            p.body AS post_body, p.deleted_by AS post_deleted, c.name AS channel_name, f.name AS file_name, f.id AS file_id
       FROM reports r LEFT JOIN users a ON a.id = r.reporter_id LEFT JOIN users b ON b.id = r.user_id
       LEFT JOIN posts p ON p.id = r.post_id LEFT JOIN channels c ON c.id = p.channel_id LEFT JOIN files f ON f.id = p.file_id
      ORDER BY (r.status = 'open') DESC, r.id DESC LIMIT 60`);
  const guard = await all(env, `SELECT kind, COUNT(*) AS n FROM guard_events WHERE created_at > ? GROUP BY kind`, ago(7 * 864e5));
  return json({ codes, settings: s, members, reports, guard_week: Object.fromEntries(guard.map((g) => [g.kind, g.n])) });
}, { admin: true });
add('POST', '/api/admin/codes', async ({ env, body }) => {
  if (body.which === 'student' || body.which === 'both') await setSetting(env, 'join_student', 'BAND-' + randCode(4));
  if (body.which === 'parent' || body.which === 'both') await setSetting(env, 'join_parent', 'FAM-' + randCode(4));
  return json({ ok: true, codes: await joinCodes(env) });
}, { admin: true });
add('PATCH', '/api/admin/users/:id', async ({ env, user, params, body }) => {
  const u = await first(env, 'SELECT id, is_admin FROM users WHERE id = ?', toInt(params.id));
  if (!u) fail(404, 'Not found');
  if (u.id === user.id && (body.is_admin === false || body.status === 'suspended')) fail(400, "You can't remove your own admin or pause yourself");
  const sets = [], vals = [];
  if (body.is_admin !== undefined) { sets.push('is_admin = ?'); vals.push(bool(body.is_admin)); }
  if (body.status !== undefined) { if (!['active', 'suspended'].includes(body.status)) fail(400, 'Bad status'); sets.push('status = ?'); vals.push(body.status); }
  if (sets.length) await run(env, `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...vals, u.id);
  if (body.status === 'suspended') await run(env, 'DELETE FROM sessions WHERE user_id = ?', u.id);
  return json({ ok: true });
}, { admin: true });
add('POST', '/api/admin/reports/:id/resolve', async ({ env, user, params, body }) => {
  const r = await first(env, 'SELECT id, post_id FROM reports WHERE id = ?', toInt(params.id));
  if (!r) fail(404, 'Not found');
  if (body.remove_post && r.post_id) await run(env, 'UPDATE posts SET body = ?, deleted_by = ? WHERE id = ?', '', user.id, r.post_id);
  await run(env, `UPDATE reports SET status = 'resolved', resolved_by = ? WHERE id = ?`, user.id, r.id);
  return json({ ok: true });
}, { admin: true });
add('PATCH', '/api/admin/settings', async ({ env, body }) => {
  for (const k of ['school_arrive', 'school_start', 'school_end']) if (body[k] !== undefined && !TIME_RE.test(body[k])) fail(400, 'Times look like 08:00');
  if (body.school_arrive && body.school_start && toMin(body.school_arrive) > toMin(body.school_start)) fail(400, 'Arrive time should be before the first bell');
  for (const k of ['band_name', 'school_name', 'school_arrive', 'school_start', 'school_end']) if (body[k] !== undefined) await setSetting(env, k, str(String(body[k]), 60));
  if (body.walk_minutes !== undefined) { const w = toInt(body.walk_minutes); if (w === null || w < 0 || w > 120) fail(400, 'Walk time: 0–120 minutes'); await setSetting(env, 'walk_minutes', w); }
  return json({ ok: true });
}, { admin: true });

// ================================================================ texting
add('POST', '/api/sms/test', async ({ env, user }) => {
  const me = await first(env, 'SELECT phone, sms_opt_in FROM users WHERE id = ?', user.id);
  if (!me.phone) fail(400, 'Add your phone number first');
  if (!me.sms_opt_in) fail(400, 'Turn on texts first');
  const r = await sendSms(env, me.phone, `Test text — ${APP(env)} alerts are working. Reply STOP to opt out.`);
  if (r.status === 'failed') fail(502, `Twilio said: ${r.error}`);
  return json({ ok: true, status: r.status });
});
add('POST', '/api/sms/inbound', async ({ env, request, url }) => {
  const twiml = (text) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${text ? `<Message>${text.replace(/[<&>]/g, '')}</Message>` : ''}</Response>`, { headers: { 'content-type': 'text/xml' } });
  const form = Object.fromEntries(await request.formData());
  const publicUrl = env.APP_URL ? env.APP_URL.replace(/\/$/, '') + url.pathname : url.toString();
  if (!(await verifyTwilioSignature(env.TWILIO_AUTH_TOKEN, publicUrl, form, request.headers.get('x-twilio-signature')))) return new Response('Invalid signature', { status: 403 });
  const from = normalizePhone(form.From);
  if (/^(stop|stopall|unsubscribe|cancel|end|quit)$/i.test(String(form.Body || '').trim())) {
    if (from) await run(env, 'UPDATE users SET sms_opt_in = 0 WHERE phone = ?', from);
    return twiml('');
  }
  return twiml(`Open ${APP(env)} to see your alerts.`);
}, { auth: false, raw: true });
