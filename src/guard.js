// Guardrails for a student community with no parent oversight of chats.
//
// Text: 1) fast word lists (profanity, slurs, sexual, threats), 2) Workers AI safety model (Llama Guard),
//       3) Workers AI sentiment — a very harsh message aimed at someone gets a "kindness check" the sender
//       has to confirm. Self-harm language is never blocked; the sender sees support info and admins get a
//       quiet heads-up.
// Photos: every image is checked by a Workers AI vision model before anyone can see it. If the check
//       can't run, the photo is NOT posted (fail closed).
//
// env.AI_MOCK=1 (local tests only) replaces the AI calls with simple markers.

const LEET = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't' };
export function normalize(text) {
  return String(text || '').toLowerCase()
    .replace(/[01!34@5$7+]/g, (c) => LEET[c])
    .replace(/(.)\1{2,}/g, '$1$1')             // fuuuuck -> fuuck
    .replace(/\b(\w)[\s.*_-](?=\w\b)/g, '$1');  // f.u.c.k / f u c k -> fuck (single letters)
}

const RULES = [
  // [kind, regex, message]
  ['hate', /\b(n[i1]gg?(a|er|uh|az?)s?|f[a@]gg?(ot|it|y)?s?|retard(ed|s)?|tr[a@]nn(y|ies)|k[i1]kes?|ch[i1]nks?|sp[i1]cs?|wetbacks?|dykes?)\b/,
    "That word isn't allowed here. Slurs aren't OK, even as a joke."],
  ['threat', /\b(kys|kill (yo)?urself|go die|i('?ll| will) (kill|shoot|stab|hurt) (you|u|him|her|them)|shoot up (the|our) school|bring a gun)\b/,
    "Threats aren't allowed. If someone's in danger, tell an adult or call 911."],
  ['sexual', /\b(nudes?|send (me )?(pics|nudes)|dick ?pics?|tits|boobs|porn\w*|horny|sexting|blowjob|handjob|cum(ming)?|p[uo]ssy|c[o0]ck|dick(s|head)?|penis|vagina|anal|onlyfans|thot)\b/,
    "Keep it clean — sexual stuff isn't allowed here."],
  ['language', /\b(fuck\w*|f+u+c+k+\w*|fck\w*|fk|motherf\w*|shit\w*|sh1t|bullshit|bitch\w*|b1tch|cunt\w*|asshole\w*|bastard\w*|whore\w*|slut\w*|wtf|stfu|dumbass|jackass)\b/,
    "Let's keep the language clean — try saying that another way."],
];
const SELF_HARM = /\b(kill myself|kms|want to die|wanna die|end it all|suicid\w*|hurt myself|cut myself|self[- ]harm|don'?t want to (be here|live))\b/;
const INSULT = /\b(stupid|idiot|loser|ugly|fat|dumb|worthless|pathetic|trash|nobody likes (you|u)|shut up|hate (you|u)|cringe|annoying|suck)\b/;
const AT_SOMEONE = /\b(you|u|ur|your|you'?re|youre|he|she|him|her|they|them)\b|@\w/;

export const SUPPORT = 'If you\'re going through something hard, you\'re not alone. You can call or text 988 (Suicide & Crisis Lifeline) any time, or talk to a teacher, counselor or the band director.';

/**
 * Check a message. Returns one of:
 *   { ok: true, selfHarm?: true }
 *   { ok: false, kind, message }              — blocked
 *   { ok: false, nudge: true, message }       — very harsh; sender can confirm and send anyway
 */
export async function checkText(env, text, { confirmed = false } = {}) {
  const raw = String(text || '');
  if (!raw.trim()) return { ok: true };
  const t = normalize(raw);
  for (const [kind, re, message] of RULES) if (re.test(t) || re.test(raw.toLowerCase())) return { ok: false, kind, message };
  const selfHarm = SELF_HARM.test(t);

  // AI safety model
  const ai = await safetyModel(env, raw);
  if (ai.unsafe) {
    if (ai.category === 'selfharm') return { ok: true, selfHarm: true };
    const msg = { hate: "That message looks hateful, so it wasn't sent.", sexual: "Keep it clean — that message wasn't sent.",
      violence: "That message sounds threatening, so it wasn't sent. If someone's in danger, tell an adult." }[ai.category];
    if (msg) return { ok: false, kind: ai.category, message: msg };
  }

  // Kindness check: very negative + aimed at someone (or uses an insult) → ask before sending
  if (!confirmed && (INSULT.test(t) || AT_SOMEONE.test(t))) {
    const neg = await negativity(env, raw);
    if ((INSULT.test(t) && AT_SOMEONE.test(t)) || (neg >= 0.985 && AT_SOMEONE.test(t))) {
      return { ok: false, nudge: true, message: 'Kindness check 💛 That might come across as harsh. Send it anyway?' };
    }
  }
  return { ok: true, selfHarm: selfHarm || undefined };
}

async function safetyModel(env, text) {
  if (env.AI_MOCK) {
    if (/MOCK_UNSAFE_HATE/.test(text)) return { unsafe: true, category: 'hate' };
    if (/MOCK_UNSAFE_VIOLENCE/.test(text)) return { unsafe: true, category: 'violence' };
    return { unsafe: false };
  }
  if (!env.AI) return { unsafe: false };
  try {
    const r = await env.AI.run('@cf/meta/llama-guard-3-8b', { messages: [{ role: 'user', content: text.slice(0, 2000) }] });
    const resp = r?.response ?? r;
    let safe = true, cats = [];
    if (typeof resp === 'string') { safe = !/^\s*unsafe/i.test(resp); cats = resp.match(/S\d+/g) || []; }
    else if (resp && typeof resp === 'object') { safe = resp.safe !== false; cats = resp.categories || []; }
    if (safe) return { unsafe: false };
    const c = cats.map(String).join(' ');
    const category = /S11/.test(c) ? 'selfharm' : /S3|S4|S12/.test(c) ? 'sexual' : /S10/.test(c) ? 'hate' : /S1\b|S9/.test(c) ? 'violence' : 'other';
    return { unsafe: true, category };
  } catch (e) { console.error('safety model failed', e); return { unsafe: false }; }
}

async function negativity(env, text) {
  if (env.AI_MOCK) return /MOCK_NEGATIVE/.test(text) ? 0.99 : 0.1;
  if (!env.AI) return 0;
  try {
    const r = await env.AI.run('@cf/huggingface/distilbert-sst-2-int8', { text: text.slice(0, 500) });
    const arr = Array.isArray(r) ? r : r?.result || [];
    return arr.find((x) => x.label === 'NEGATIVE')?.score || 0;
  } catch (e) { console.error('sentiment failed', e); return 0; }
}

const b64 = (bytes) => {
  let s = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
};

const IMAGE_PROMPT = 'You are a strict safety filter for a high school students\' app. Look at the image. '
  + 'Answer ONLY with JSON like {"nudity":false,"sexual":false,"violence":false,"drugs":false,"weapons":false}. '
  + 'nudity = any exposed private parts, underwear/lingerie focus, or partial nudity. sexual = sexual or suggestive content. '
  + 'violence = gore, blood or injury. drugs = drugs, vaping or alcohol use. weapons = guns or knives shown threateningly.';

/** Check an uploaded image (JPEG/PNG/WebP bytes). Returns { ok: true } or { ok: false, message }. Fails closed. */
export async function checkImage(env, bytes, mime) {
  if (env.AI_MOCK) {
    const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
    return /UNSAFE_TEST/.test(head) ? { ok: false, message: "That photo can't be posted here." } : { ok: true };
  }
  if (!env.AI) return { ok: false, message: "Photo checks aren't set up yet, so photos can't be posted. Ask an admin." };
  let answer = null;
  try {
    const r = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [{ role: 'user', content: [{ type: 'text', text: IMAGE_PROMPT }, { type: 'image_url', image_url: { url: `data:${mime};base64,${b64(bytes)}` } }] }],
      max_tokens: 80, temperature: 0,
    });
    answer = typeof r?.response === 'string' ? r.response : JSON.stringify(r?.response ?? r);
  } catch (e) { console.error('image check failed', e); }
  const m = answer && answer.match(/\{[\s\S]*?\}/);
  if (!m) return { ok: false, message: "We couldn't check that photo right now, so it wasn't posted. Try again in a minute." };
  let v; try { v = JSON.parse(m[0]); } catch { return { ok: false, message: "We couldn't check that photo, so it wasn't posted." }; }
  if (v.nudity || v.sexual) return { ok: false, kind: 'photo', message: "That photo can't be posted here." };
  if (v.violence || v.weapons || v.drugs) return { ok: false, kind: 'photo', message: "That photo isn't OK for the band app." };
  return { ok: true };
}
