// Text messaging via Twilio's REST API (plain fetch — no SDK needed on Workers).
// If Twilio secrets aren't set, texts are "simulated": logged to sms_log only,
// so the whole app still works while you get a Twilio number approved.

const enc = new TextEncoder();

export function smsConfigured(env) {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN &&
    (env.TWILIO_FROM || env.TWILIO_MESSAGING_SERVICE_SID));
}

/** Normalize a US-style number to E.164 (+1XXXXXXXXXX). Returns null if invalid. */
export function normalizePhone(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (s.startsWith('+')) {
    const d = '+' + s.slice(1).replace(/\D/g, '');
    return /^\+\d{10,15}$/.test(d) ? d : null;
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return null;
}

export async function sendSms(env, to, text) {
  const body = `${env.APP_NAME || "Let's Hang"}: ${text}`.slice(0, 600);
  let status = 'simulated', sid = null, error = null;

  if (smsConfigured(env)) {
    const params = new URLSearchParams({ To: to, Body: body });
    if (env.TWILIO_MESSAGING_SERVICE_SID) params.set('MessagingServiceSid', env.TWILIO_MESSAGING_SERVICE_SID);
    else params.set('From', env.TWILIO_FROM);
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: params,
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) { status = data.status || 'queued'; sid = data.sid || null; }
      else { status = 'failed'; error = data.message || `HTTP ${res.status}`; }
    } catch (e) {
      status = 'failed'; error = String(e && e.message || e);
    }
  }

  await env.DB.prepare('INSERT INTO sms_log (to_phone, body, status, provider_sid, error) VALUES (?, ?, ?, ?, ?)')
    .bind(to, body, status, sid, error).run();
  if (error) console.error('SMS failed', to, error);
  return { status, sid, error };
}

/** Validate X-Twilio-Signature on inbound webhooks. */
export async function verifyTwilioSignature(authToken, url, params, signature) {
  if (!authToken || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const key = await crypto.subtle.importKey('raw', enc.encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  if (expected.length !== signature.length) return false;
  let r = 0;
  for (let i = 0; i < expected.length; i++) r |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return r === 0;
}
