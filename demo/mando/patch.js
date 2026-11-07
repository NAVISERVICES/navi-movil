// NAVI Mando · cambios entre equipos.
// En vez de mandar todos los datos de la empresa en cada cambio, se manda solo lo que cambió:
// por persona, alerta o mensaje (por su id) y por campo. Así la consola y la app pueden escribir
// a la vez sin pisarse: si cada una cambia campos distintos, ambos cambios se conservan.
// Lo usan el navegador (window.NaviPatch) y el servidor (globalThis.NaviPatch).
(function (root) {
  const J = v => JSON.stringify(v);
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const hasId = v => isObj(v) && (typeof v.id === 'string' || typeof v.id === 'number');
  // arreglo de cosas con id (personas, alertas, mensajes, grupos…)
  const idArray = (a, b) => Array.isArray(a) && Array.isArray(b) && (a.length || b.length) && a.every(hasId) && b.every(hasId);

  // ¿b es a con elementos agregados al final (y quizá recortado al inicio)? → los nuevos y el largo final
  function appended(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) return null;
    const last = J(a[a.length - 1]);
    let j = -1;
    for (let i = b.length - 1; i >= 0; i--) if (J(b[i]) === last) { j = i; break; }
    if (j < 0) return null;
    const start = a.length - (j + 1);
    if (start < 0 || J(b[0]) !== J(a[start])) return null;
    return { items: b.slice(j + 1), len: b.length };
  }

  // cambios de campo dentro de un objeto (un nivel): set / unset / append
  function fields(a, b) {
    const set = {}, unset = [], add = {};
    let n = 0;
    for (const k of Object.keys(b)) {
      if (J(a[k]) === J(b[k])) continue;
      const ap = appended(a[k], b[k]);
      if (ap && ap.items.length) { add[k] = ap; n++; } else { set[k] = b[k]; n++; }
    }
    for (const k of Object.keys(a)) if (!(k in b)) { unset.push(k); n++; }
    return n ? { set, unset, add } : null;
  }

  // diferencias entre el estado anterior (a) y el nuevo (b)
  function diff(a, b) {
    const ops = [];
    a = a || {}; b = b || {};
    for (const k of Object.keys(b)) {
      const va = a[k], vb = b[k];
      if (J(va) === J(vb)) continue;
      if (idArray(va || [], vb)) {
        const am = new Map((va || []).map(x => [String(x.id), x]));
        const bm = new Map(vb.map(x => [String(x.id), x]));
        for (const x of vb) {
          const old = am.get(String(x.id));
          if (!old) ops.push({ op: 'add', k, item: x });
          else { const f = fields(old, x); if (f) ops.push({ op: 'patch', k, id: x.id, ...f }); }
        }
        for (const [id] of am) if (!bm.has(id)) ops.push({ op: 'remove', k, id: am.get(id).id });
        continue;
      }
      if (isObj(va) && isObj(vb)) { const f = fields(va, vb); if (f) ops.push({ op: 'obj', k, ...f }); continue; }
      const ap = appended(va, vb);
      if (ap && ap.items.length) { ops.push({ op: 'append', k, items: ap.items, len: ap.len }); continue; }
      ops.push({ op: 'set', k, value: vb });
    }
    for (const k of Object.keys(a)) if (!(k in b)) ops.push({ op: 'unset', k });
    return ops;
  }

  const BAD = new Set(['__proto__', 'constructor', 'prototype']);
  function applyFields(t, o) {
    for (const f of Object.keys(o.set || {})) if (!BAD.has(f)) t[f] = o.set[f];
    (o.unset || []).forEach(f => { if (!BAD.has(f)) delete t[f]; });
    for (const f of Object.keys(o.add || {})) {
      if (BAD.has(f)) continue;
      const ad = o.add[f];
      t[f] = (Array.isArray(t[f]) ? t[f] : []).concat(ad.items).slice(-ad.len);
    }
  }

  // aplica los cambios sobre el estado (lo modifica y lo regresa)
  function apply(doc, ops) {
    for (const o of ops || []) {
      if (!o || typeof o.k !== 'string' || o.k === '__proto__' || o.k === 'constructor' || o.k === 'prototype') continue;
      const k = o.k;
      if (o.op === 'set') doc[k] = o.value;
      else if (o.op === 'unset') delete doc[k];
      else if (o.op === 'append') doc[k] = (Array.isArray(doc[k]) ? doc[k] : []).concat(o.items || []).slice(-o.len);
      else if (o.op === 'obj') { if (!isObj(doc[k])) doc[k] = {}; applyFields(doc[k], o); }
      else if (o.op === 'add') {
        if (!Array.isArray(doc[k])) doc[k] = [];
        const i = doc[k].findIndex(x => x && String(x.id) === String(o.item.id));
        if (i >= 0) doc[k][i] = o.item; else doc[k].push(o.item);
      } else if (o.op === 'remove') { if (Array.isArray(doc[k])) doc[k] = doc[k].filter(x => !x || String(x.id) !== String(o.id)); }
      else if (o.op === 'patch') {
        const t = Array.isArray(doc[k]) && doc[k].find(x => x && String(x.id) === String(o.id));
        if (t) applyFields(t, o);
      }
    }
    return doc;
  }

  root.NaviPatch = { diff, apply };
})(typeof window !== 'undefined' ? window : globalThis);
