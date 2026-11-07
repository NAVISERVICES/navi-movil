// Acceso: consola con código por correo o SMS; app del operador con código de empresa + celular + PIN.
import { randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';
import { CONFIG } from './config.js';
import { q, audit } from './db.js';
import { sendSms, sendEmail } from './notify.js';

const MIN = 60000, CODE_TTL = 10 * MIN, MAX_TRIES = 5;
const sha = s => createHash('sha256').update(String(s)).digest('hex');
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const maskMail = e => String(e || '').replace(/^(.{2})[^@]*(@.*)$/, '$1•••••$2');
const maskPhone = p => '+52 •• •••• ' + String(p || '').slice(-4);
const digits = s => String(s || '').replace(/\D/g, '').slice(-10);

// límites para frenar abusos: por usuario y por IP
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some(t => now - t < 3600000)) hits.delete(k); }, 600000).unref();

export function findUser(id) {
  const s = String(id || '').trim().toLowerCase(), d = digits(s);
  return q('SELECT * FROM users WHERE active = 1 AND (user = ? OR lower(email) = ? OR (? <> \'\' AND length(?) = 10 AND phone = ?))').get(s, s, d, d, d) || null;
}

// paso 1: ¿existe? → nombre y a dónde puede llegar su código (enmascarado)
export function lookup(id) {
  const u = findUser(id);
  if (!u) return null;
  return { user: u.user, name: u.name, channels: { email: u.email ? maskMail(u.email) : null, sms: u.phone ? maskPhone(u.phone) : null } };
}

// paso 2: genera y envía el código por el medio que eligió
export async function sendCode(id, via, ip) {
  const u = findUser(id);
  if (!u || !['email', 'sms'].includes(via)) return { err: 'No encontramos ese usuario.' };
  if ((via === 'email' && !u.email) || (via === 'sms' && !u.phone)) return { err: 'Ese medio no está disponible para tu usuario.' };
  if (limited('code:' + u.user, 1, 25000)) return { err: 'Espera unos segundos antes de pedir otro código.' };
  if (limited('code-ip:' + ip, 10, 3600000)) return { err: 'Demasiados intentos. Intenta más tarde.' };
  const code = String(randomInt(100000, 1000000));
  q('DELETE FROM login_codes WHERE user = ?').run(u.user);
  q('INSERT INTO login_codes (user, hash, via, at) VALUES (?, ?, ?, ?)').run(u.user, sha(u.user + ':' + code), via, Date.now());
  const text = `Tu código de NAVI Mando es ${code}. Vence en 10 minutos. No lo compartas.`;
  try {
    if (via === 'sms') await sendSms(u.phone, text); else await sendEmail(u.email, 'Tu código de NAVI Mando', text);
  } catch (e) { console.error('envío fallido', e.message); return { err: 'No pudimos enviar el código. Intenta con el otro medio.' }; }
  audit(u.company, u.user, 'codigo-enviado', via);
  const to = via === 'email' ? maskMail(u.email) : maskPhone(u.phone);
  // en la demo el código también regresa para mostrarlo en pantalla como si fuera el correo o el SMS
  return CONFIG.demo ? { to, via, code } : { to, via };
}

function newSession(kind, company, subject, data, keep) {
  const token = randomBytes(32).toString('base64url');
  const expires = Date.now() + (keep ? CONFIG.keepDays * 24 * 60 * MIN : CONFIG.sessionHours * 60 * MIN);
  q('INSERT INTO sessions (hash, kind, company, subject, data, expires) VALUES (?, ?, ?, ?, ?, ?)').run(sha(token), kind, company, subject, JSON.stringify(data), expires);
  return token;
}

// paso 3: revisa el código y abre la sesión
export function verify(id, code, keep, ip) {
  const u = findUser(id);
  if (!u) return { err: 'Pide un código nuevo.' };
  if (limited('verify-ip:' + ip, 30, 3600000)) return { err: 'Demasiados intentos. Intenta más tarde.' };
  const row = q('SELECT * FROM login_codes WHERE user = ?').get(u.user);
  if (!row) return { err: 'Pide un código nuevo.' };
  if (Date.now() - row.at > CODE_TTL) { q('DELETE FROM login_codes WHERE user = ?').run(u.user); return { err: 'El código venció (dura 10 minutos). Pide uno nuevo.' }; }
  if (row.tries >= MAX_TRIES) { q('DELETE FROM login_codes WHERE user = ?').run(u.user); return { err: 'Demasiados intentos con ese código. Pide uno nuevo.' }; }
  if (!same(sha(u.user + ':' + String(code || '').trim()), row.hash)) {
    q('UPDATE login_codes SET tries = tries + 1 WHERE user = ?').run(u.user);
    return { err: 'Ese código no coincide. Revisa tu ' + (row.via === 'email' ? 'correo' : 'SMS') + '.' };
  }
  q('DELETE FROM login_codes WHERE user = ?').run(u.user);
  const ses = { kind: 'consola', user: u.user, name: u.name, role: u.role, client: u.company, admin: !!u.admin, at: Date.now() };
  const token = newSession('consola', u.company, u.user, ses, keep);
  audit(u.company, u.user, 'entro-consola', keep ? 'sesión recordada' : '');
  return { token, session: ses };
}

// app del operador: código de empresa + celular + PIN (en la demo, el PIN de demostración)
export function loginOperator(code, phone, pin, ip, getDoc) {
  if (limited('op-ip:' + ip, 20, 3600000)) return { err: 'Demasiados intentos. Intenta más tarde.' };
  const c = q('SELECT * FROM companies WHERE code = ?').get(String(code || '').trim().toUpperCase());
  if (!c) return { err: 'Ese código no corresponde a ninguna empresa cliente de Navi.' };
  const doc = getDoc(c.id), num = digits(phone);
  const p = doc && doc.ops.find(x => x.phone === num);
  if (!p) return { err: 'Ese celular no está registrado en ' + c.name.split(',')[0] + '.' };
  // producción: PIN propio de cada operador (pendiente: alta de PIN desde Equipo). Demo: PIN de demostración
  if (!CONFIG.demo || String(pin || '') !== CONFIG.demoPin) return { err: 'PIN incorrecto.' };
  const ses = { kind: 'operador', client: c.id, opId: p.id, name: p.name, at: Date.now() };
  const token = newSession('operador', c.id, p.id, ses, true);
  audit(c.id, p.id, 'entro-app', '');
  return { token, session: ses };
}

// sesión a partir del token (encabezado Authorization: Bearer … o ?t= en el canal en vivo)
export function sessionOf(token) {
  if (!token) return null;
  const row = q('SELECT * FROM sessions WHERE hash = ?').get(sha(token));
  if (!row || row.expires < Date.now()) return null;
  const data = JSON.parse(row.data);
  if (row.kind === 'consola') {
    // el permiso de administrador se lee siempre de la tabla de usuarios
    const u = q('SELECT admin, active, role FROM users WHERE user = ?').get(row.subject);
    if (!u || !u.active) return null;
    data.admin = !!u.admin; data.role = u.role;
  }
  return { kind: row.kind, company: row.company, subject: row.subject, data };
}

export function logout(token) { if (token) q('DELETE FROM sessions WHERE hash = ?').run(sha(token)); }
setInterval(() => { q('DELETE FROM sessions WHERE expires < ?').run(Date.now()); q('DELETE FROM login_codes WHERE at < ?').run(Date.now() - CODE_TTL); }, 3600000).unref();
