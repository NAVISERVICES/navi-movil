// Avisos automáticos (webhooks) del operador (Custome Mobile / Conec-Rural):
// recarga, activación, cambio de IMEI, suspensión, baja y portabilidad.
// Dirección pública: https://api.navimovil.com/webhooks/operador
//
// Cada aviso se guarda completo en la tabla operator_events y se responde 200 de inmediato
// (el operador reintenta si no contestamos). Procesarlos (actualizar líneas, avisar al cliente)
// es un paso posterior que lee de esa tabla.
//
// Seguridad (variables de .env; mientras el operador no nos dé su formato de firma, se aceptan y se marcan "sin verificar"):
//   WEBHOOK_IPS     IPs del operador separadas por coma. Si se llena, se rechaza cualquier otra IP (403).
//   WEBHOOK_TOKEN   llave compartida. Si se llena, el aviso debe traer "Authorization: Bearer <llave>"
//                   o el encabezado X-Webhook-Token con ese valor (401 si no).
//   WEBHOOK_SECRET  secreto para la firma HMAC-SHA256 del cuerpo. Si se llena y el aviso trae la firma
//                   (encabezado WEBHOOK_SIG_HEADER, por omisión X-Signature; acepta "sha256=<hex>" o hex/base64),
//                   se valida; firma inválida → 401. Si cuadra, el aviso queda verified = 1.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db, q } from './db.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS operator_events (   -- avisos recibidos del operador, tal cual llegaron
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    ip TEXT,
    type TEXT,                                   -- tipo de aviso si viene en el cuerpo (recarga, activacion…)
    event_id TEXT,                               -- id del aviso del operador (para no procesarlo dos veces)
    verified INTEGER NOT NULL DEFAULT 0,         -- 1 = firma o llave validada
    headers TEXT,
    body TEXT NOT NULL,
    processed INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS operator_events_at ON operator_events(at);
  CREATE UNIQUE INDEX IF NOT EXISTS operator_events_eid ON operator_events(event_id) WHERE event_id IS NOT NULL;
`);

const env = process.env;
const list = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
const cfg = () => ({
  ips: list(env.WEBHOOK_IPS),
  token: env.WEBHOOK_TOKEN || '',
  secret: env.WEBHOOK_SECRET || '',
  sigHeader: (env.WEBHOOK_SIG_HEADER || 'x-signature').toLowerCase()
});

const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const cleanIp = ip => String(ip || '').replace(/^::ffff:/, '');

function rawBody(req, max = 256_000) {
  return new Promise((ok, bad) => {
    let n = 0; const parts = [];
    req.on('data', c => { n += c.length; if (n > max) { bad(Object.assign(new Error('muy grande'), { code: 413 })); req.destroy(); } else parts.push(c); });
    req.on('end', () => ok(Buffer.concat(parts)));
    req.on('error', bad);
  });
}

// encabezados que guardamos (nunca la llave ni cookies)
const KEEP = /^(content-type|user-agent|x-[a-z0-9-]+|webhook-[a-z0-9-]+)$/;
function safeHeaders(h, c) {
  const out = {};
  for (const k of Object.keys(h)) if (KEEP.test(k) && k !== 'x-webhook-token' && k !== 'x-forwarded-for') out[k] = String(h[k]).slice(0, 300);
  if (c.sigHeader in out) out[c.sigHeader] = '(firma recibida)';
  return out;
}

const pick = (o, keys) => { for (const k of keys) if (o && o[k] != null && o[k] !== '') return String(o[k]).slice(0, 120); return null; };

// Devuelve true si atendió la ruta.
export async function handleWebhook(req, res, url, ip, json) {
  if (url.pathname !== '/webhooks/operador' && url.pathname !== '/webhooks/operador/') return false;
  const c = cfg(); const from = cleanIp(ip);
  if (c.ips.length && !c.ips.includes(from)) { json(res, 403, { ok: false, err: 'origen no autorizado' }); return true; }
  // prueba de conexión del operador
  if (req.method === 'GET' || req.method === 'HEAD') { json(res, 200, { ok: true, servicio: 'avisos del operador de Navi' }); return true; }
  if (req.method !== 'POST') { json(res, 405, { ok: false, err: 'método no permitido' }); return true; }

  if (c.token) {
    const got = (String(req.headers.authorization || '').match(/^Bearer (.+)$/) || [])[1] || req.headers['x-webhook-token'] || '';
    if (!same(got, c.token)) { json(res, 401, { ok: false, err: 'llave inválida' }); return true; }
  }
  const raw = await rawBody(req);
  let verified = c.token ? 1 : 0;
  const sig = req.headers[c.sigHeader];
  if (c.secret && sig) {
    const mac = createHmac('sha256', c.secret).update(raw);
    const hex = mac.digest('hex'), b64 = Buffer.from(hex, 'hex').toString('base64');
    const s = String(sig).replace(/^sha256=/i, '').trim();
    if (!same(s.toLowerCase(), hex) && !same(s, b64)) { json(res, 401, { ok: false, err: 'firma inválida' }); return true; }
    verified = 1;
  }

  const text = raw.toString('utf8');
  let obj = null; try { obj = JSON.parse(text); } catch (e) {}
  const data = obj && typeof obj === 'object' ? (obj.data && typeof obj.data === 'object' ? { ...obj.data, ...obj } : obj) : null;
  const type = pick(data, ['type', 'event', 'evento', 'tipo', 'event_type']);
  const eventId = pick(data, ['event_id', 'eventId', 'id_evento', 'webhook_id', 'id']);

  if (eventId && q('SELECT 1 FROM operator_events WHERE event_id = ?').get(eventId)) {
    json(res, 200, { ok: true, duplicado: true }); return true;   // reintento de un aviso que ya teníamos
  }
  const r = q('INSERT INTO operator_events (at, ip, type, event_id, verified, headers, body) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(Date.now(), from, type, eventId, verified, JSON.stringify(safeHeaders(req.headers, c)), text.slice(0, 256_000));
  console.log(`aviso del operador #${r.lastInsertRowid} tipo=${type || '?'} ip=${from} verificado=${verified}`);
  json(res, 200, { ok: true, recibido: Number(r.lastInsertRowid) });
  return true;
}
