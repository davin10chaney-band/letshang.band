// Password hashing + cookie sessions using only WebCrypto (works on Workers).

const enc = new TextEncoder();
const COOKIE = 'lh_session';
const SESSION_DAYS = 30;

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function hashPassword(password, saltB64) {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  // 100k is the PBKDF2 iteration ceiling on Cloudflare Workers.
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return { hash: toB64(bits), salt: toB64(salt) };
}

export async function verifyPassword(password, hash, salt) {
  const r = await hashPassword(password, salt);
  return safeEqual(r.hash, hash);
}

async function sha256Hex(s) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

function getToken(request) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(/(?:^|;\s*)lh_session=([a-f0-9]{64})/);
  return m ? m[1] : null;
}

function cookieAttrs(request) {
  // Secure everywhere except plain-http local dev on 127.0.0.1 etc.
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export async function createSession(env, request, userId) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256Hex(token), userId, expires).run();
  return `${COOKIE}=${token}; ${cookieAttrs(request)}; Max-Age=${SESSION_DAYS * 86400}`;
}

export async function readSession(env, request) {
  const token = getToken(request);
  if (!token) return null;
  return env.DB.prepare(
    `SELECT u.id, u.role, u.is_admin, u.status, u.display_name, u.username, u.avatar, u.section, u.instrument, u.grade,
            u.can_drive, u.phone, u.sms_opt_in, u.notify_prefs, u.theme
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'`
  ).bind(await sha256Hex(token), new Date().toISOString()).first();
}

export async function destroySession(env, request) {
  const token = getToken(request);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return `${COOKIE}=; ${cookieAttrs(request)}; Max-Age=0`;
}
