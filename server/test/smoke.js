// Prueba de punta a punta: arranca el servidor con datos temporales y revisa acceso, datos y canal en vivo.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const data = mkdtempSync(join(tmpdir(), 'navi-test-'));
const port = 18000 + Math.floor(Math.random() * 1000);
const srv = spawn(process.execPath, [join(here, '..', 'src', 'server.js')], { env: { ...process.env, PORT: String(port), DATA_DIR: data, DEMO: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
const base = `http://localhost:${port}`;
const call = async (path, opts = {}) => { const r = await fetch(base + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {} return { s: r.status, j, t }; };
const post = (path, b, tok) => call(path, { method: 'POST', body: JSON.stringify(b), headers: tok ? { Authorization: 'Bearer ' + tok } : {} });
const ok = (name) => console.log('  ✓ ' + name);

try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 100)); }
  const h = await call('/api/health'); assert.equal(h.s, 200); assert.equal(h.j.demo, true); ok('servidor arriba, versión de datos ' + h.j.version);

  const pg = await call('/demo/index.html'); assert.equal(pg.s, 200); assert.match(pg.t, /<html/i); ok('sirve el sitio (/demo/index.html)');
  assert.equal((await call('/server/src/auth.js')).s, 404); assert.equal((await call('/.claude/launch.json')).s, 404); assert.equal((await call('/demo/../server/package.json')).s, 404); ok('no expone código del servidor ni archivos ocultos');
  const cfg = await call('/demo/mando/config.js'); assert.match(cfg.t, /NAVI_API = '\/api'/); ok('config.js conecta la demo a la API');

  assert.equal((await call('/api/mando/state')).s, 401); ok('sin sesión no hay datos (401)');
  const lk = await post('/api/auth/lookup', { id: 'dhl.transporte' }); assert.equal(lk.s, 200); assert.match(lk.j.channels.email, /•/); ok('busca usuario y enmascara su correo: ' + lk.j.channels.email);
  assert.equal((await post('/api/auth/lookup', { id: 'nadie' })).s, 404); ok('usuario inexistente → 404');
  const sc = await post('/api/auth/code', { id: 'dhl.transporte', via: 'sms' }); assert.equal(sc.s, 200); assert.match(sc.j.code, /^\d{6}$/); ok('manda código por SMS (demo lo regresa: ' + sc.j.code + ')');
  const bad = await post('/api/auth/verify', { id: 'dhl.transporte', code: '000000' }); assert.equal(bad.s, 400); ok('código equivocado → rechazado');
  const vf = await post('/api/auth/verify', { id: 'dhl.transporte', code: sc.j.code, keep: false }); assert.equal(vf.s, 200); assert.ok(vf.j.token); assert.equal(vf.j.session.client, 'transporte'); assert.equal(vf.j.session.admin, true); ok('código correcto → sesión de ' + vf.j.session.name);
  assert.equal((await post('/api/auth/verify', { id: 'dhl.transporte', code: sc.j.code })).s, 400); ok('el código no sirve dos veces');
  const T = vf.j.token;

  const st = await call('/api/mando/state', { headers: { Authorization: 'Bearer ' + T } }); assert.equal(st.s, 200); assert.equal(st.j.doc.client, 'transporte'); ok(`datos de DHL: ${st.j.doc.ops.length} personas, ${st.j.doc.trips.length} recorridos, versión ${st.j.v}`);

  const op = await post('/api/auth/operator', { code: 'NAVI-2200', phone: st.j.doc.ops[0].phone, pin: '1234' }); assert.equal(op.s, 200); ok('operador entra a la app: ' + op.j.session.name);
  assert.equal((await post('/api/auth/operator', { code: 'NAVI-2200', phone: st.j.doc.ops[0].phone, pin: '9999' })).s, 400); ok('PIN equivocado → rechazado');
  const OT = op.j.token;

  // canal en vivo: la consola escucha; la app manda un cambio; la consola lo recibe
  const ctrl = new AbortController();
  const events = [];
  const stream = await fetch(base + '/api/mando/stream?t=' + encodeURIComponent(T), { signal: ctrl.signal });
  const reader = stream.body.getReader(); let buf = '';
  (async () => { try { for (;;) { const { value, done } = await reader.read(); if (done) break; buf += new TextDecoder().decode(value); let i; while ((i = buf.indexOf('\n\n')) >= 0) { const blk = buf.slice(0, i); buf = buf.slice(i + 2); const ev = /event: (.+)/.exec(blk), dt = /data: (.+)/.exec(blk); if (ev && dt) events.push({ e: ev[1], d: JSON.parse(dt[1]) }); } } } catch (e) {} })();
  await new Promise(r => setTimeout(r, 300));
  assert.ok(events.find(x => x.e === 'hello')); assert.ok(events.find(x => x.e === 'leader' && x.d.leader === true)); ok('consola conectada en vivo y es quien corre las revisiones automáticas');
  const pid = op.j.session.opId;
  const pr = await post('/api/mando/patch', { from: 'app-1', ops: [{ op: 'patch', k: 'ops', id: pid, set: { status: 'receso' } }, { op: 'add', k: 'msgs', item: { id: 'mtest', from: pid, to: 'consola', kind: 'text', txt: 'hola desde la app', at: Date.now(), reads: [] } }] }, OT);
  assert.equal(pr.s, 200); assert.equal(pr.j.v, st.j.v + 1);
  await new Promise(r => setTimeout(r, 300));
  const got = events.find(x => x.e === 'patch'); assert.ok(got); assert.equal(got.d.from, 'app-1'); ok('la app manda un cambio y la consola lo recibe al instante (v' + got.d.v + ')');
  const st2 = await call('/api/mando/state', { headers: { Authorization: 'Bearer ' + T } });
  assert.equal(st2.j.doc.ops.find(p => p.id === pid).status, 'receso'); assert.ok(st2.j.doc.msgs.find(m => m.id === 'mtest')); ok('el cambio quedó guardado en la base');
  ctrl.abort();

  const other = await post('/api/auth/code', { id: 'amazon.almacen', via: 'email' });
  const v2 = await post('/api/auth/verify', { id: 'amazon.almacen', code: other.j.code });
  const st3 = await call('/api/mando/state', { headers: { Authorization: 'Bearer ' + v2.j.token } });
  assert.equal(st3.j.doc.client, 'operativa'); assert.ok(!st3.j.doc.msgs.find(m => m.id === 'mtest')); ok('cada empresa ve solo sus datos');

  console.log('\nTodo bien ✔');
} catch (e) {
  console.error('\nFALLÓ:', e.message, '\n--- bitácora del servidor ---\n' + log);
  process.exitCode = 1;
} finally {
  srv.kill();
  await new Promise(r => setTimeout(r, 300));
  try { rmSync(data, { recursive: true, force: true }); } catch (e) {}
}
