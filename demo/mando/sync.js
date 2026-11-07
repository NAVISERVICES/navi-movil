// NAVI Mando · conexión con el servidor de Navi.
// Si la página viene del servidor (config.js define NAVI_API), el acceso y los datos pasan por la API:
// códigos reales por correo/SMS, sesiones del servidor y cambios en vivo entre todos los equipos.
// En GitHub Pages (sin servidor) este archivo no hace nada y la demo sigue igual que antes.
(function () {
  const API = window.NAVI_API;
  if (!API || !window.Mando || !window.NaviPatch) return;
  const M = window.Mando, P = window.NaviPatch, A = M.Auth;
  M._sync.useSession();

  // ---------- sesión y token ----------
  const isApp = /\/app(\/|$)/.test(location.pathname);
  const SKEY = 'navi.mando.sesion', OKEY = 'navi.mando.app.sesion';
  const TK = kind => 'navi.api.token:' + kind;
  const rd = k => { try { return JSON.parse(sessionStorage.getItem(k) || localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const wr = (k, v, keep) => { try { sessionStorage.removeItem(k); localStorage.removeItem(k); if (v != null) (keep ? localStorage : sessionStorage).setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} };
  const token = kind => { try { return sessionStorage.getItem(TK(kind)) || localStorage.getItem(TK(kind)); } catch (e) { return null; } };
  const kindHere = () => (isApp ? (token('operador') ? 'operador' : null) : (token('consola') ? 'consola' : null));

  async function call(path, body, kind) {
    const t = token(kind || kindHere() || 'consola');
    let r;
    try {
      r = await fetch(API + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { return { ok: false, s: 0, j: { err: 'Sin conexión con el servidor. Revisa tu señal e intenta de nuevo.' } }; }
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && path.startsWith('/mando')) expired();
    return { ok: r.ok, s: r.status, j };
  }
  function expired() {
    const k = kindHere(); if (!k) return;
    wr(TK(k), null); wr(k === 'operador' ? OKEY : SKEY, null);
    if (k === 'consola') location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.hash));
    else location.reload();
  }

  // ---------- acceso: las mismas funciones que usa la demo, ahora contra el servidor ----------
  A.find = id => call('/auth/lookup', { id }).then(r => r.ok ? { user: r.j.user, name: r.j.name, channels: r.j.channels } : null);
  A.demoUsers = () => call('/auth/demo-users').then(r => r.ok ? r.j : []);
  A.sendCode = (id, via) => call('/auth/code', { id, via }).then(r => r.ok ? r.j : { err: r.j.err || 'No pudimos enviar el código.' });
  A.verify = (id, code, keep) => call('/auth/verify', { id, code, keep }).then(r => {
    if (!r.ok) return { err: r.j.err || 'Ese código no coincide.' };
    wr(TK('consola'), r.j.token, keep); wr(SKEY, r.j.session, keep);
    return { ok: r.j.session };
  });
  A.current = () => (token('consola') ? rd(SKEY) : null);
  A.logout = () => { const t = token('consola'); if (t) fetch(API + '/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }).catch(() => {}); wr(TK('consola'), null); wr(SKEY, null); };
  A.loginOp = (code, phone, pin) => call('/auth/operator', { code, phone, pin }, 'operador').then(r => {
    if (!r.ok) return { err: r.j.err || 'No pudimos entrar.' };
    wr(TK('operador'), r.j.token, true); wr(OKEY, r.j.session, true);
    start();
    return { ok: r.j.session };
  });
  A.currentOp = () => (token('operador') ? rd(OKEY) : null);
  A.logoutOp = () => { const t = token('operador'); if (t) fetch(API + '/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }).catch(() => {}); wr(TK('operador'), null); wr(OKEY, null); stop(); };

  // ---------- datos en vivo ----------
  let base = null, lastV = 0, me = null, leader = false, ready = false, applying = false, es = null, cid = null;
  const queue = [];
  let timer = null, retry = 0;
  const clone = o => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

  // cada cambio local se compara con lo último sincronizado y se manda solo la diferencia
  M._sync.onSave(s => {
    if (!ready || applying) return;
    const ops = P.diff(base, s);
    if (!ops.length) return;
    queue.push(...ops); base = clone(s);
    if (!timer) timer = setTimeout(flush, 200);
  });
  async function flush() {
    timer = null;
    if (!queue.length) return;
    const ops = queue.splice(0);
    const r = await call('/mando/patch', { from: me, ops });
    if (!r.ok && r.s !== 401) { queue.unshift(...ops); retry = Math.min(30000, (retry || 1000) * 2); timer = setTimeout(flush, retry); return; }
    retry = 0;
  }
  function useDoc(v, doc) {
    applying = true;
    M._sync.write(doc); base = clone(doc); lastV = v; ready = true;
    applying = false;
    M._sync.emit(doc);
  }
  async function refetch() {
    if (queue.length) await flush();
    const r = await call('/mando/state');
    if (r.ok) useDoc(r.j.v, r.j.doc);
  }
  function onPatch(d) {
    if (d.from && d.from === me) { lastV = Math.max(lastV, d.v); return; }
    if (d.v <= lastV) return;
    if (d.v !== lastV + 1) return refetch();   // se perdió algo: se baja todo de nuevo
    const cur = M._sync.read() || clone(base);
    P.apply(cur, d.ops); P.apply(base, d.ops); lastV = d.v;
    applying = true; M._sync.write(cur); applying = false;
    M._sync.emit(cur);
  }
  // solo un equipo por empresa corre la simulación y las revisiones automáticas (lo decide el servidor)
  const tick = M.tick;
  M.tick = function () { if (ready && leader) return tick.apply(this, arguments); };

  async function start() {
    const k = kindHere(); if (!k) return;
    const ses = k === 'operador' ? rd(OKEY) : rd(SKEY);
    if (!ses) return;
    if (es && cid === ses.client) return;
    stop();
    cid = M.useClient(ses.client);
    const me2 = await call('/auth/me');
    if (me2.ok) wr(k === 'operador' ? OKEY : SKEY, Object.assign(ses, me2.j.session), !!localStorage.getItem(TK(k)));
    await refetch();
    es = new EventSource(API + '/mando/stream?t=' + encodeURIComponent(token(k)));
    es.addEventListener('hello', e => { const d = JSON.parse(e.data); me = d.id; if (d.v !== lastV) refetch(); });
    es.addEventListener('leader', e => { leader = !!JSON.parse(e.data).leader; });
    es.addEventListener('patch', e => onPatch(JSON.parse(e.data)));
    es.addEventListener('reload', () => refetch());
  }
  function stop() { if (es) es.close(); es = null; ready = false; leader = false; base = null; queue.length = 0; }

  // reiniciar la demo: lo hace el servidor para todos los equipos de la empresa
  M.reset = function () { call('/mando/reset', {}).then(r => { if (!r.ok) alert(r.j.err || 'No se pudo reiniciar.'); }); return M.load(); };
  M.serverMode = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
