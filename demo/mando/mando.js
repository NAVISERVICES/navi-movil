// NAVI Mando · datos compartidos entre la consola central y la app del operador.
// Demo: todo vive en localStorage del navegador (clave navi.mando). Si abres la consola y la app
// en el mismo navegador se sincronizan al instante. En producción esto es un servidor en tiempo real.
(function () {
  const KEY = 'navi.mando';
  const V = 3;
  const now = () => Date.now();
  const MIN = 60000;
  const uid = p => (p || 'x') + Math.random().toString(36).slice(2, 8);

  const STATUS = {
    disponible: { t: 'Disponible', c: '#B4E32F' },
    encamino:   { t: 'En camino',  c: '#7EE0FF' },
    ensitio:    { t: 'En sitio',   c: '#FFC22E' },
    pausa:      { t: 'En pausa',   c: '#B9B7E6' },
    sos:        { t: 'SOS',        c: '#FF4D6D' },
    fuera:      { t: 'Fuera de turno', c: '#5E5C8F' }
  };
  const ORDER_ST = {
    nueva:      'Por asignar',
    asignada:   'Asignada',
    aceptada:   'Aceptada',
    encamino:   'En camino',
    ensitio:    'En sitio',
    completada: 'Completada',
    cancelada:  'Cancelada'
  };
  const ALERT_T = {
    sos:      { t: 'SOS', i: '🆘', c: '#FF4D6D' },
    hombre:   { t: 'Trabajador sin respuesta', i: '🧍', c: '#FF7A45' },
    geocerca: { t: 'Geocerca', i: '📍', c: '#FFC22E' },
    bateria:  { t: 'Batería baja', i: '🔋', c: '#FFC22E' },
    sla:      { t: 'Orden vencida', i: '⏱️', c: '#FF7A45' },
    rondin:   { t: 'Rondín incompleto', i: '🛡️', c: '#FFC22E' }
  };
  // lugares de la ciudad (posición en % sobre el mapa de la demo)
  const PLACES = [
    { n: 'Polanco · Av. Masaryk 120', x: 30, y: 30 },
    { n: 'Roma Norte · Álvaro Obregón 85', x: 44, y: 52 },
    { n: 'Coyoacán · Francisco Sosa 40', x: 52, y: 80 },
    { n: 'Santa Fe · Vasco de Quiroga 3800', x: 10, y: 58 },
    { n: 'Del Valle · Insurgentes Sur 1200', x: 40, y: 66 },
    { n: 'Lindavista · Montevideo 300', x: 52, y: 12 },
    { n: 'Iztapalapa · Ermita 2100', x: 78, y: 72 },
    { n: 'Centro · 5 de Mayo 20', x: 56, y: 40 },
    { n: 'Azcapotzalco · Parque Vía 90', x: 30, y: 12 },
    { n: 'Narvarte · Eje Central 750', x: 52, y: 60 },
    { n: 'Aeropuerto · Terminal 1', x: 82, y: 38 },
    { n: 'Tlalpan · Periférico Sur 4100', x: 40, y: 90 }
  ];

  function seed() {
    const t = now();
    const groups = [
      { id: 'g1', name: 'Reparto Norte', color: '#B4E32F' },
      { id: 'g2', name: 'Técnicos de campo', color: '#7EE0FF' },
      { id: 'g3', name: 'Seguridad', color: '#FF6FB1' }
    ];
    const op = (id, name, group, x, y, status, bat, gb, phone, role) => ({
      id, name, ini: name.split(' ').map(w => w[0]).slice(0, 2).join(''), group, role,
      phone, status, x, y, bat, sig: 3 + Math.round(Math.random()), gb, gbMax: role === 'Supervisor' ? 30 : 20,
      shift: status === 'fuera' ? null : { at: t - (2 + Math.random() * 4) * 60 * MIN },
      seen: t, trail: [[x, y]], km: +(Math.random() * 30 + 6).toFixed(1), solo: false, soloAsk: null
    });
    const ops = [
      op('p1', 'Arturo Ramírez', 'g1', 34, 36, 'disponible', 82, 6.4, '5512345601', 'Repartidor'),
      op('p2', 'José Sánchez', 'g1', 50, 20, 'encamino', 64, 9.1, '5512345602', 'Repartidor'),
      op('p3', 'Lucía Hernández', 'g2', 46, 62, 'ensitio', 47, 4.2, '5512345603', 'Técnica'),
      op('p4', 'Miguel Torres', 'g2', 20, 54, 'encamino', 91, 12.8, '5512345604', 'Técnico'),
      op('p5', 'Karla Méndez', 'g3', 60, 44, 'disponible', 73, 3.3, '5512345605', 'Guardia'),
      op('p6', 'Diego Ruiz', 'g3', 74, 66, 'pausa', 18, 7.7, '5512345606', 'Guardia'),
      op('p7', 'Ana López', 'g2', 58, 76, 'disponible', 55, 5.0, '5512345607', 'Supervisor'),
      op('p8', 'Raúl Castillo', 'g1', 80, 34, 'fuera', 100, 2.1, '5512345608', 'Repartidor')
    ];
    const templates = [
      { id: 't1', name: 'Entrega de paquete', sla: 60, needPhoto: true, needSign: true, checklist: ['Verificar identidad del receptor', 'Paquete sin daños', 'Entregar comprobante'] },
      { id: 't2', name: 'Instalación de módem', sla: 120, needPhoto: true, needSign: true, checklist: ['Medir señal en sitio', 'Instalar y encender equipo', 'Prueba de velocidad', 'Explicar uso al cliente'] },
      { id: 't3', name: 'Visita de mantenimiento', sla: 90, needPhoto: true, needSign: false, checklist: ['Revisión visual', 'Limpieza', 'Reporte de piezas'] },
      { id: 't4', name: 'Ronda de seguridad', sla: 45, needPhoto: true, needSign: false, checklist: ['Revisar accesos', 'Revisar iluminación', 'Reportar incidencias'] }
    ];
    const mk = (folio, tpl, place, client, prio, status, opId, ago) => {
      const T = templates.find(x => x.id === tpl), P = PLACES[place];
      const o = {
        id: uid('o'), folio, tpl, title: T.name, client, addr: P.n, x: P.x, y: P.y, prio, sla: T.sla,
        status, opId, created: t - ago * MIN, due: t - ago * MIN + T.sla * MIN,
        checklist: T.checklist.map(c => ({ t: c, done: status === 'completada' })),
        needPhoto: T.needPhoto, needSign: T.needSign, photo: null, sign: null, notes: '', rating: null,
        hist: [{ at: t - ago * MIN, txt: 'Orden creada por Mesa de control' }]
      };
      if (opId) o.hist.push({ at: t - (ago - 3) * MIN, txt: 'Asignada a ' + ops.find(p => p.id === opId).name });
      if (status === 'completada') { o.done = t - (ago - T.sla * .6) * MIN; o.hist.push({ at: o.done, txt: 'Completada con evidencia' }); }
      return o;
    };
    const orders = [
      mk('OT-1041', 't1', 5, 'Farmacias del Norte', 'alta', 'encamino', 'p2', 25),
      mk('OT-1042', 't2', 1, 'Café La Esquina', 'media', 'ensitio', 'p3', 70),
      mk('OT-1043', 't3', 3, 'Corporativo Santa Fe', 'media', 'encamino', 'p4', 40),
      mk('OT-1044', 't1', 0, 'Boutique Masaryk', 'baja', 'asignada', 'p1', 8),
      mk('OT-1045', 't2', 6, 'Abarrotes Ermita', 'alta', 'nueva', null, 12),
      mk('OT-1046', 't3', 9, 'Clínica Narvarte', 'media', 'nueva', null, 4),
      mk('OT-1038', 't1', 7, 'Papelería Centro', 'media', 'completada', 'p1', 180),
      mk('OT-1039', 't2', 4, 'Oficinas Del Valle', 'alta', 'completada', 'p3', 240),
      mk('OT-1040', 't4', 2, 'Plaza Coyoacán', 'media', 'completada', 'p7', 150)
    ];
    // José ya va hacia su orden; Miguel también
    ops[1].target = { x: orders[0].x, y: orders[0].y }; ops[1].order = orders[0].id;
    ops[3].target = { x: orders[2].x, y: orders[2].y }; ops[3].order = orders[2].id;
    ops[2].order = orders[1].id; ops[2].x = orders[1].x + 1; ops[2].y = orders[1].y + 1;
    ops[0].order = orders[3].id;
    const zones = [
      { id: 'z1', name: 'Almacén Central', x: 34, y: 36, r: 6, type: 'base', enter: true, exit: true },
      { id: 'z2', name: 'Zona de clientes Polanco', x: 28, y: 28, r: 8, type: 'permitida', enter: false, exit: true },
      { id: 'z3', name: 'Zona restringida Aeropuerto', x: 84, y: 40, r: 7, type: 'restringida', enter: true, exit: false }
    ];
    const points = [
      { id: 'cp1', code: 'P-01', name: 'Acceso principal', x: 58, y: 42, method: 'QR' },
      { id: 'cp2', code: 'P-02', name: 'Estacionamiento', x: 63, y: 46, method: 'NFC' },
      { id: 'cp3', code: 'P-03', name: 'Bodega de carga', x: 60, y: 50, method: 'QR' },
      { id: 'cp4', code: 'P-04', name: 'Cuarto de máquinas', x: 55, y: 47, method: 'NFC' }
    ];
    const routes = [
      { id: 'r1', name: 'Rondín nocturno Plaza Centro', points: ['cp1', 'cp2', 'cp3', 'cp4'], opId: 'p5', every: 120 }
    ];
    const rounds = [
      { id: uid('rd'), route: 'r1', opId: 'p5', start: t - 50 * MIN, hits: [{ p: 'cp1', at: t - 48 * MIN }, { p: 'cp2', at: t - 41 * MIN }] },
      { id: uid('rd'), route: 'r1', opId: 'p5', start: t - 170 * MIN, end: t - 140 * MIN, hits: ['cp1', 'cp2', 'cp3', 'cp4'].map((p, i) => ({ p, at: t - (168 - i * 8) * MIN })) }
    ];
    const msgs = [
      { id: uid('m'), from: 'consola', to: 'all', kind: 'difusion', txt: 'Buen día equipo. Hoy hay lluvia en la tarde: manejen con precaución.', at: t - 200 * MIN, reads: ['p1', 'p2', 'p3', 'p4', 'p5', 'p7'] },
      { id: uid('m'), from: 'p2', to: 'g1', kind: 'text', txt: 'Voy saliendo hacia Lindavista', at: t - 24 * MIN, reads: ['consola'] },
      { id: uid('m'), from: 'consola', to: 'p3', kind: 'text', txt: 'Lucía, el cliente pide que le expliques el wifi', at: t - 30 * MIN, reads: ['p3'] },
      { id: uid('m'), from: 'p3', to: 'consola', kind: 'text', txt: 'Enterada 👍', at: t - 29 * MIN, reads: ['consola'] }
    ];
    const alerts = [
      { id: uid('a'), type: 'bateria', opId: 'p6', at: t - 6 * MIN, status: 'abierta', txt: 'Batería al 18%' }
    ];
    const events = [
      { at: t - 25 * MIN, opId: 'p2', txt: 'Salió de Almacén Central', type: 'geocerca' },
      { at: t - 40 * MIN, opId: 'p4', txt: 'Aceptó OT-1043', type: 'orden' },
      { at: t - 70 * MIN, opId: 'p3', txt: 'Llegó a Café La Esquina', type: 'orden' }
    ];
    return { v: V, empresa: 'Logística Demo, S.A. de C.V.', code: 'NAVI-4821', groups, ops, templates, orders, zones, points, routes, rounds, msgs, alerts, events, folio: 1047, ptt: null };
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && s.v === V) return s;
    } catch (e) {}
    const s = seed(); save(s); return s;
  }
  function save(s) {
    // los audios de PTT pesan: solo se guardan los últimos 12
    let voz = 0;
    for (let i = s.msgs.length - 1; i >= 0; i--) if (s.msgs[i].audio && ++voz > 12) s.msgs[i].audio = null;
    if (s.msgs.length > 300) s.msgs = s.msgs.slice(-300);
    if (s.events.length > 300) s.events = s.events.slice(-300);
    try { localStorage.setItem(KEY, JSON.stringify(s)); }
    catch (e) { s.msgs.forEach(m => m.audio = null); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e2) {} }
    subs.forEach(f => f(s, true));
  }
  // leer, cambiar y guardar en un solo paso (la consola y la app escriben a la vez)
  function update(fn) { const s = load(); const r = fn(s); save(s); return r; }
  const subs = [];
  function on(fn) { subs.push(fn); }
  window.addEventListener('storage', e => { if (e.key === KEY) { const s = load(); subs.forEach(f => f(s, false)); } });

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // 1% del mapa ≈ 0.25 km en la demo
  const km = d => d * 0.25;
  function nearest(s, x, y, filter) {
    return s.ops.filter(p => p.status !== 'fuera' && p.status !== 'sos' && (!filter || filter(p)))
      .map(p => ({ p, d: dist(p, { x, y }), busy: s.orders.some(o => o.opId === p.id && ['asignada', 'aceptada', 'encamino', 'ensitio'].includes(o.status)) }))
      // puntaje: distancia + castigo si ya trae una orden (≈4 km) o está en pausa (≈8 km)
      .map(r => Object.assign(r, { score: r.d + (r.busy ? 16 : 0) + (r.p.status === 'pausa' ? 32 : 0) }))
      .sort((a, b) => a.score - b.score);
  }
  function event(s, opId, txt, type) { s.events.push({ at: now(), opId, txt, type }); }
  function alert(s, type, opId, txt, extra) {
    if (s.alerts.some(a => a.type === type && a.opId === opId && a.status !== 'cerrada' && (!extra || a.ref === extra.ref))) return null;
    const a = Object.assign({ id: uid('a'), type, opId, at: now(), status: 'abierta', txt }, extra || {});
    s.alerts.push(a); return a;
  }
  function orderHist(o, txt) { o.hist.push({ at: now(), txt }); }

  // cambios de estado de una orden (los usa tanto la consola como la app)
  function advance(s, oid, st, who) {
    const o = s.orders.find(x => x.id === oid); if (!o) return;
    const p = s.ops.find(x => x.id === o.opId);
    o.status = st;
    const map = { aceptada: 'Aceptada', encamino: 'En camino al sitio', ensitio: 'Llegó al sitio', completada: 'Completada con evidencia', cancelada: 'Cancelada' };
    orderHist(o, (map[st] || st) + (who ? ' · ' + who : ''));
    if (p) {
      if (st === 'encamino') { p.status = 'encamino'; p.target = { x: o.x, y: o.y }; p.order = o.id; }
      if (st === 'ensitio') { p.status = 'ensitio'; p.target = null; p.x = o.x + .8; p.y = o.y + .8; }
      if (st === 'aceptada') p.order = o.id;
      if (st === 'completada' || st === 'cancelada') { o.done = now(); if (p.status !== 'sos') p.status = 'disponible'; p.order = null; p.target = null; }
      event(s, p.id, (map[st] || st) + ' ' + o.folio, 'orden');
    }
  }

  // simulación de movimiento: la ejecuta solo la consola (cada 2 s)
  function tick() {
    update(s => {
      const t = now();
      s.ops.forEach(p => {
        if (p.status === 'fuera') return;
        const prev = { x: p.x, y: p.y };
        if (p.target) {
          const d = dist(p, p.target), step = Math.min(d, .9 + Math.random() * .5);
          if (d > .3) { p.x += (p.target.x - p.x) / d * step; p.y += (p.target.y - p.y) / d * step; }
          // llegó: si iba a una orden, queda en sitio
          if (dist(p, p.target) < 1 && p.order) {
            const o = s.orders.find(x => x.id === p.order);
            if (o && o.status === 'encamino') advance(s, o.id, 'ensitio', 'detectado por GPS');
            p.target = null;
          }
        } else if (p.status === 'disponible' || p.status === 'ensitio') {
          p.x += (Math.random() - .5) * .25; p.y += (Math.random() - .5) * .25;
        }
        p.x = Math.max(2, Math.min(98, p.x)); p.y = Math.max(3, Math.min(97, p.y));
        const moved = dist(prev, p);
        p.km = +(p.km + km(moved)).toFixed(2);
        if (moved > .2) { p.trail.push([+p.x.toFixed(2), +p.y.toFixed(2)]); if (p.trail.length > 40) p.trail.shift(); }
        p.gb = +(p.gb + Math.random() * .004).toFixed(3);
        if (Math.random() < .03) p.bat = Math.max(1, p.bat - 1);
        p.seen = t;
        // geocercas
        p.inZ = p.inZ || {};
        s.zones.forEach(z => {
          const inside = dist(p, z) <= z.r, was = !!p.inZ[z.id];
          if (inside === was) return;
          p.inZ[z.id] = inside;
          if (inside && z.enter) { event(s, p.id, 'Entró a ' + z.name, 'geocerca'); if (z.type === 'restringida') alert(s, 'geocerca', p.id, 'Entró a ' + z.name, { ref: z.id }); }
          if (!inside && z.exit) { event(s, p.id, 'Salió de ' + z.name, 'geocerca'); if (z.type === 'permitida') alert(s, 'geocerca', p.id, 'Salió de ' + z.name, { ref: z.id }); }
        });
        if (p.bat <= 15) alert(s, 'bateria', p.id, 'Batería al ' + p.bat + '%');
        // modo trabajo solo: si no confirma a tiempo, alerta
        if (p.solo && p.soloAsk && t - p.soloAsk > 45000) { alert(s, 'hombre', p.id, 'No respondió la verificación de "trabajo solo"'); p.soloAsk = null; }
        else if (p.solo && !p.soloAsk && t - (p.soloOk || 0) > 60000) p.soloAsk = t;
      });
      // órdenes vencidas
      s.orders.forEach(o => {
        if (['completada', 'cancelada'].includes(o.status) || t < o.due) return;
        if (!o.late) { o.late = true; alert(s, 'sla', o.opId, o.folio + ' venció su tiempo (' + o.sla + ' min)', { ref: o.id }); }
      });
    });
  }

  const fmtT = ts => new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const ago = ts => { const m = Math.round((now() - ts) / MIN); return m < 1 ? 'ahora' : m < 60 ? 'hace ' + m + ' min' : 'hace ' + Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // grabación de voz para el PTT (si no hay micrófono, se manda un aviso simulado)
  const Ptt = {
    rec: null, chunks: [], t0: 0,
    async start() {
      this.t0 = now(); this.chunks = [];
      try {
        const st = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
        this.rec = new MediaRecorder(st, mime ? { mimeType: mime, audioBitsPerSecond: 16000 } : undefined);
        this.rec.ondataavailable = e => e.data.size && this.chunks.push(e.data);
        this.rec.start();
        return true;
      } catch (e) { this.rec = null; return false; }
    },
    stop() {
      return new Promise(res => {
        const secs = Math.max(1, Math.round((now() - this.t0) / 1000));
        if (!this.rec) return res({ secs, audio: null });
        const r = this.rec;
        r.onstop = () => {
          r.stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(this.chunks, { type: r.mimeType || 'audio/webm' });
          if (blob.size > 400000) return res({ secs, audio: null });
          const fr = new FileReader(); fr.onload = () => res({ secs, audio: fr.result }); fr.readAsDataURL(blob);
        };
        r.stop(); this.rec = null;
      });
    }
  };
  // tono corto para alertas
  function beep(urgent) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [0, .22, .44].slice(0, urgent ? 3 : 1).forEach(d => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = urgent ? 880 : 660; o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(.18, ac.currentTime + d); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + d + .18);
        o.start(ac.currentTime + d); o.stop(ac.currentTime + d + .2);
      });
    } catch (e) {}
  }

  window.Mando = { KEY, STATUS, ORDER_ST, ALERT_T, PLACES, load, save, update, on, tick, nearest, advance, event, alert, orderHist, uid, dist, km, fmtT, ago, esc, Ptt, beep, MIN,
    reset() { localStorage.removeItem(KEY); return load(); } };
})();
