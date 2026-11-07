// Servidor de Navi: sitios (Navi Móvil y Navi Empresas) + API de NAVI Órbita con datos en vivo.
// Sin dependencias externas: Node 24+ (http, sqlite y crypto incluidos).
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CONFIG } from './config.js';
import { q, audit, backup } from './db.js';
import { seedDemo, Patch, Mando } from './seed.js';
import * as Auth from './auth.js';

seedDemo();

// ---------- datos de cada empresa ----------
const cache = new Map();   // company → { v, doc } en memoria (se escribe a la base en cada cambio)
function getState(company) {
  if (cache.has(company)) return cache.get(company);
  const row = q('SELECT v, doc FROM state WHERE company = ?').get(company);
  if (!row) return null;
  const st = { v: row.v, doc: JSON.parse(row.doc) };
  cache.set(company, st); return st;
}
function saveState(company, st) {
  q('UPDATE state SET v = ?, doc = ?, updated = ? WHERE company = ?').run(st.v, JSON.stringify(st.doc), Date.now(), company);
}
// mismos límites que la demo: últimos 300 mensajes y eventos, audios de radio solo los últimos 12
function trim(doc) {
  if (Array.isArray(doc.msgs)) {
    let voz = 0;
    for (let i = doc.msgs.length - 1; i >= 0; i--) if (doc.msgs[i] && doc.msgs[i].audio && ++voz > 12) doc.msgs[i].audio = null;
    if (doc.msgs.length > 300) doc.msgs = doc.msgs.slice(-300);
  }
  if (Array.isArray(doc.events) && doc.events.length > 300) doc.events = doc.events.slice(-300);
}

// ---------- canal en vivo (Server-Sent Events) ----------
// Cada equipo conectado recibe los cambios de su empresa. Uno solo por empresa corre la simulación
// y las revisiones automáticas (geocercas, desvíos, recesos): de preferencia una consola.
const conns = new Map();   // company → Set<{ id, res, kind }>
function leaderOf(company) {
  const set = [...(conns.get(company) || [])];
  return (set.find(c => c.kind === 'consola') || set[0] || {}).id || null;
}
function send(res, event, data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcast(company, event, data) { for (const c of conns.get(company) || []) send(c.res, event, data); }
function announceLeader(company) { const l = leaderOf(company); for (const c of conns.get(company) || []) send(c.res, 'leader', { leader: c.id === l }); }
setInterval(() => { for (const set of conns.values()) for (const c of set) c.res.write(': ping\n\n'); }, 25000).unref();

// ---------- utilidades HTTP ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const HIDDEN = /(^|\/)(\.|server(\/|$)|node_modules(\/|$)|data(\/|$))/;   // nunca se sirven por la web
function headers(res, extra) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
  for (const k in extra || {}) res.setHeader(k, extra[k]);
}
function json(res, code, data) { headers(res, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.statusCode = code; res.end(JSON.stringify(data)); }
function body(req, max = 2_000_000) {
  return new Promise((ok, bad) => {
    let n = 0; const parts = [];
    req.on('data', c => { n += c.length; if (n > max) { bad(Object.assign(new Error('muy grande'), { code: 413 })); req.destroy(); } else parts.push(c); });
    req.on('end', () => { try { ok(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {}); } catch (e) { bad(Object.assign(e, { code: 400 })); } });
    req.on('error', bad);
  });
}
const ipOf = req => (CONFIG.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '';
const tokenOf = (req, url) => (String(req.headers.authorization || '').match(/^Bearer (.+)$/) || [])[1] || url.searchParams.get('t');

function serveStatic(req, res, url) {
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const rel = normalize(path).replace(/^([/\\])+/, '');
  if (rel.split(sep).includes('..') || HIDDEN.test(rel.split(sep).join('/'))) return json(res, 404, { err: 'no existe' });
  const file = join(CONFIG.staticRoot, rel);
  let st; try { st = statSync(file); } catch (e) { headers(res); res.statusCode = 404; return res.end('No encontrado'); }
  if (st.isDirectory()) { res.statusCode = 301; res.setHeader('Location', url.pathname + '/'); return res.end(); }
  const ext = extname(file).toLowerCase();
  // páginas y código: siempre la versión más nueva; imágenes y videos: una semana en caché
  headers(res, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': /\.(html|js|css|json|webmanifest)$/.test(ext) ? 'no-cache' : 'public, max-age=604800', 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

// ---------- API ----------
async function api(req, res, url) {
  const p = url.pathname, m = req.method, ip = ipOf(req);
  if (p === '/api/health') return json(res, 200, { ok: true, demo: CONFIG.demo, version: Mando.V });

  // acceso a la consola
  if (p === '/api/auth/lookup' && m === 'POST') { const b = await body(req); const r = Auth.lookup(b.id); return r ? json(res, 200, r) : json(res, 404, { err: 'No encontramos ese usuario. Si eres cliente y no tienes acceso, pídelo a tu ejecutivo Navi.' }); }
  if (p === '/api/auth/code' && m === 'POST') { const b = await body(req); const r = await Auth.sendCode(b.id, b.via, ip); return json(res, r.err ? 400 : 200, r); }
  if (p === '/api/auth/verify' && m === 'POST') { const b = await body(req); const r = Auth.verify(b.id, b.code, !!b.keep, ip); return json(res, r.err ? 400 : 200, r); }
  if (p === '/api/auth/operator' && m === 'POST') { const b = await body(req); const r = Auth.loginOperator(b.code, b.phone, b.pin, ip, c => getState(c)?.doc); return json(res, r.err ? 400 : 200, r); }
  if (p === '/api/auth/logout' && m === 'POST') { Auth.logout(tokenOf(req, url)); return json(res, 200, { ok: true }); }
  // usuarios de demostración para la pantalla de acceso (solo en modo demo)
  if (p === '/api/auth/demo-users' && m === 'GET') {
    if (!CONFIG.demo) return json(res, 404, { err: 'no disponible' });
    return json(res, 200, q('SELECT u.user, u.name, u.email, u.admin, u.company AS client FROM users u JOIN companies c ON c.id = u.company WHERE c.demo = 1 AND u.active = 1').all());
  }

  // de aquí en adelante, con sesión
  const ses = Auth.sessionOf(tokenOf(req, url));
  if (!ses) return json(res, 401, { err: 'Tu sesión terminó. Vuelve a entrar.' });
  const company = ses.company;
  if (p === '/api/auth/me') return json(res, 200, { session: ses.data });

  if (p === '/api/mando/state' && m === 'GET') {
    const st = getState(company); if (!st) return json(res, 404, { err: 'sin datos' });
    return json(res, 200, { v: st.v, doc: st.doc });
  }
  if (p === '/api/mando/patch' && m === 'POST') {
    const b = await body(req);
    if (!Array.isArray(b.ops) || b.ops.length > 2000) return json(res, 400, { err: 'cambios inválidos' });
    const st = getState(company); if (!st) return json(res, 404, { err: 'sin datos' });
    // pendiente para producción: limitar qué partes puede cambiar un operador (hoy cualquiera de su empresa)
    Patch.apply(st.doc, b.ops); trim(st.doc); st.v++; saveState(company, st);
    broadcast(company, 'patch', { v: st.v, ops: b.ops, from: String(b.from || '') });
    return json(res, 200, { v: st.v });
  }
  if (p === '/api/mando/stream' && m === 'GET') {
    headers(res, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
    res.statusCode = 200; res.flushHeaders?.();
    const c = { id: randomUUID(), res, kind: ses.kind };
    if (!conns.has(company)) conns.set(company, new Set());
    conns.get(company).add(c);
    const st = getState(company);
    send(res, 'hello', { id: c.id, v: st ? st.v : 0 });
    announceLeader(company);
    req.on('close', () => { conns.get(company)?.delete(c); announceLeader(company); });
    return;
  }
  if (p === '/api/mando/reset' && m === 'POST') {
    // reiniciar la demo (solo empresas de demostración y solo un administrador de la consola)
    const co = q('SELECT demo FROM companies WHERE id = ?').get(company);
    if (!co?.demo || ses.kind !== 'consola' || !ses.data.admin) return json(res, 403, { err: 'Solo un administrador puede reiniciar la demo.' });
    const st = getState(company); st.doc = Mando._seed(company); st.v++; saveState(company, st);
    audit(company, ses.subject, 'demo-reiniciada', '');
    broadcast(company, 'reload', { v: st.v });
    return json(res, 200, { v: st.v });
  }
  return json(res, 404, { err: 'no existe' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  try {
    // config del sitio: aquí sí hay servidor, así que la demo se conecta a la API
    if (url.pathname === '/demo/mando/config.js') {
      headers(res, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(`window.NAVI_API = '/api'; window.NAVI_DEMO = ${CONFIG.demo};\n`);
    }
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { err: 'método no permitido' });
    return serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) json(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { err: e.code === 413 ? 'Demasiado grande' : e.code === 400 ? 'Solicitud inválida' : 'Error del servidor' });
    if (!e.code) console.error(e);
  }
});
server.listen(CONFIG.port, () => console.log(`Navi en http://localhost:${CONFIG.port}  ·  demo=${CONFIG.demo}  ·  datos en ${CONFIG.dataDir}`));

// respaldo al arrancar y cada 24 horas
try { backup(); } catch (e) { console.error('respaldo', e.message); }
setInterval(() => { try { backup(); } catch (e) { console.error('respaldo', e.message); } }, 24 * 3600000).unref();
