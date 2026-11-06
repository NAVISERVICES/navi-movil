// NAVI Mando · datos compartidos entre la consola central y la app del operador.
// Demo: todo vive en localStorage del navegador (clave navi.mando). Si abres la consola y la app
// en el mismo navegador se sincronizan al instante. En producción esto es un servidor en tiempo real.
//
// Sitios: la operación puede ser en la ciudad (mapa real, coordenadas GPS) o dentro de un espacio
// cerrado como un almacén (plano en metros). Cada sitio tiene su propia escala.
(function () {
  const KEY = 'navi.mando';
  const V = 5;
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
  const ORDER_ST = { nueva: 'Por asignar', asignada: 'Asignada', aceptada: 'Aceptada', encamino: 'En camino', ensitio: 'En sitio', completada: 'Completada', cancelada: 'Cancelada' };
  const ALERT_T = {
    sos:      { t: 'SOS', i: '🆘', c: '#FF4D6D' },
    hombre:   { t: 'Trabajador sin respuesta', i: '🧍', c: '#FF7A45' },
    geocerca: { t: 'Geocerca', i: '📍', c: '#FFC22E' },
    acceso:   { t: 'Acceso no autorizado', i: '⛔', c: '#FF7A45' },
    bateria:  { t: 'Batería baja', i: '🔋', c: '#FFC22E' },
    sla:      { t: 'Orden vencida', i: '⏱️', c: '#FF7A45' },
    rondin:   { t: 'Rondín incompleto', i: '🛡️', c: '#FFC22E' }
  };

  // SOS empresarial: tipo de emergencia con su protocolo para la mesa de control
  const SOS_KINDS = {
    accidente: { t: 'Accidente o lesión', i: '🤕', steps: ['Llamar al operador', 'Enviar al compañero más cercano', 'Pedir ambulancia (911) si hay lesión', 'Avisar al supervisor', 'Registrar el incidente'] },
    incendio:  { t: 'Incendio o humo', i: '🔥', steps: ['Activar alarma y evacuar el sitio', 'Llamar a bomberos (911)', 'Avisar al supervisor del sitio', 'Hacer pase de lista', 'Registrar el incidente'] },
    robo:      { t: 'Asalto o robo', i: '🚨', silent: true, steps: ['No llamar al operador (alerta silenciosa)', 'Llamar al 911 con la ubicación', 'Avisar a Seguridad', 'Seguir la ubicación en vivo', 'Registrar el incidente'] },
    medica:    { t: 'Emergencia médica', i: '🚑', steps: ['Llamar al operador', 'Pedir ambulancia (911)', 'Enviar al compañero más cercano', 'Avisar al supervisor', 'Registrar el incidente'] },
    falla:     { t: 'Falla de equipo o derrame', i: '⚠️', steps: ['Aislar la zona', 'Enviar a Mantenimiento', 'Avisar al supervisor', 'Registrar el incidente'] },
    otro:      { t: 'Emergencia', i: '🆘', steps: ['Llamar al operador', 'Evaluar y enviar apoyo', 'Registrar el incidente'] }
  };

  // ciudad: cuadrícula 0-100 sobre la CDMX que se convierte a latitud/longitud reales
  const BOX = { w: -99.30, e: -99.00, n: 19.56, s: 19.28 };
  const toLL = (x, y) => [BOX.n - y / 100 * (BOX.n - BOX.s), BOX.w + x / 100 * (BOX.e - BOX.w)];
  const fromLL = (lat, lng) => ({ x: +((lng - BOX.w) / (BOX.e - BOX.w) * 100).toFixed(3), y: +((BOX.n - lat) / (BOX.n - BOX.s) * 100).toFixed(3) });
  const PLACES = [
    ['Polanco · Av. Presidente Masaryk 120', 19.4319, -99.1956],
    ['Roma Norte · Álvaro Obregón 85', 19.4195, -99.1619],
    ['Coyoacán · Francisco Sosa 40', 19.3480, -99.1680],
    ['Santa Fe · Vasco de Quiroga 3800', 19.3610, -99.2760],
    ['Del Valle · Insurgentes Sur 1200', 19.3780, -99.1780],
    ['Lindavista · Montevideo 300', 19.4900, -99.1350],
    ['Iztapalapa · Ermita Iztapalapa 2100', 19.3580, -99.0700],
    ['Centro · 5 de Mayo 20', 19.4340, -99.1390],
    ['Azcapotzalco · Av. Azcapotzalco 600', 19.4870, -99.1860],
    ['Narvarte · Eje Central 750', 19.3940, -99.1500],
    ['Aeropuerto · Terminal 1', 19.4340, -99.0870],
    ['Tlalpan · Periférico Sur 4100', 19.3020, -99.1900]
  ].map(([n, la, lo]) => Object.assign({ n }, fromLL(la, lo)));

  // escala de cada tipo de sitio: km por unidad, paso de simulación, distancia de "llegó", movimiento en reposo
  const SCALE = {
    outdoor: { km: 0.31, step: 1.1, arrive: 1, jitter: .25 },
    indoor:  { km: 0.001, step: 2.2, arrive: 1.5, jitter: .8 }
  };

  function seed() {
    const t = now();
    const sites = [
      { id: 'city', name: 'Ciudad de México', kind: 'outdoor', icon: '🏙️' },
      { id: 'alm', name: 'Almacén Central · Vallejo', kind: 'indoor', icon: '🏭', w: 120, h: 70,
        areas: [
          { id: 'a1', name: 'Recepción', x: 2, y: 2, w: 22, h: 18, c: '#7EE0FF' },
          { id: 'a2', name: 'Oficinas', x: 2, y: 24, w: 22, h: 20, c: '#9B80FF' },
          { id: 'a3', name: 'Rack A', x: 32, y: 6, w: 8, h: 36, c: '#B4E32F' },
          { id: 'a4', name: 'Rack B', x: 46, y: 6, w: 8, h: 36, c: '#B4E32F' },
          { id: 'a5', name: 'Rack C', x: 60, y: 6, w: 8, h: 36, c: '#B4E32F' },
          { id: 'a6', name: 'Rack D', x: 74, y: 6, w: 8, h: 36, c: '#B4E32F' },
          { id: 'a7', name: 'Empaque', x: 90, y: 6, w: 28, h: 24, c: '#FFC22E' },
          { id: 'a8', name: 'Andenes de carga', x: 2, y: 50, w: 38, h: 18, c: '#FF6FB1' },
          { id: 'a9', name: 'Zona de montacargas', x: 46, y: 50, w: 46, h: 18, c: '#FF7A45' },
          { id: 'a10', name: 'Cuarto de máquinas', x: 98, y: 48, w: 20, h: 20, c: '#FF4D6D' }
        ] }
    ];
    const ctr = (id) => { const a = sites[1].areas.find(z => z.id === id); return { x: a.x + a.w / 2, y: a.y + a.h / 2 }; };
    // departamentos: también son canales de radio y grupos de chat
    const groups = [
      { id: 'g1', name: 'Reparto', color: '#B4E32F' },
      { id: 'g2', name: 'Técnicos de campo', color: '#7EE0FF' },
      { id: 'g3', name: 'Mantenimiento', color: '#FF7A45' },
      { id: 'g4', name: 'Almacén', color: '#FFC22E' },
      { id: 'g5', name: 'Seguridad', color: '#FF6FB1' }
    ];
    const op = (id, name, group, site, x, y, status, bat, gb, phone, role) => ({
      id, name, ini: name.split(' ').map(w => w[0]).slice(0, 2).join(''), group, site, role,
      phone, status, x, y, bat, sig: 3 + Math.round(Math.random()), gb, gbMax: /Supervis/.test(role) ? 30 : 20,
      shift: status === 'fuera' ? null : { at: t - (2 + Math.random() * 4) * 60 * MIN },
      seen: t, trail: [[x, y]], km: site === 'city' ? +(Math.random() * 30 + 6).toFixed(1) : +(Math.random() * 3 + 1).toFixed(2), solo: false, soloAsk: null
    });
    const ops = [
      op('p1', 'Arturo Ramírez', 'g1', 'city', 37.5, 43, 'disponible', 82, 6.4, '5512345601', 'Repartidor'),
      op('p2', 'José Sánchez', 'g1', 'city', 50, 20, 'encamino', 64, 9.1, '5512345602', 'Repartidor'),
      op('p3', 'Lucía Hernández', 'g2', 'city', 46, 50, 'ensitio', 47, 4.2, '5512345603', 'Técnica'),
      op('p4', 'Miguel Torres', 'g2', 'city', 20, 54, 'encamino', 91, 12.8, '5512345604', 'Técnico'),
      op('p8', 'Raúl Castillo', 'g1', 'city', 70, 30, 'fuera', 100, 2.1, '5512345608', 'Repartidor'),
      op('p5', 'Karla Méndez', 'g5', 'alm', 12, 10, 'disponible', 73, 3.3, '5512345605', 'Guardia'),
      op('p6', 'Diego Ruiz', 'g5', 'alm', 14, 34, 'pausa', 18, 7.7, '5512345606', 'Guardia'),
      op('p7', 'Ana López', 'g4', 'alm', 104, 18, 'disponible', 55, 5.0, '5512345607', 'Supervisora de almacén'),
      op('p9', 'Sofía Vargas', 'g4', 'alm', 64, 30, 'ensitio', 66, 2.7, '5512345609', 'Montacarguista'),
      op('p10', 'Pedro Gómez', 'g3', 'alm', 70, 58, 'disponible', 88, 1.9, '5512345610', 'Técnico de mantenimiento')
    ];
    const templates = [
      { id: 't1', name: 'Entrega de paquete', site: 'outdoor', sla: 60, needPhoto: true, needSign: true, checklist: ['Verificar identidad del receptor', 'Paquete sin daños', 'Entregar comprobante'] },
      { id: 't2', name: 'Instalación de módem', site: 'outdoor', sla: 120, needPhoto: true, needSign: true, checklist: ['Medir señal en sitio', 'Instalar y encender equipo', 'Prueba de velocidad', 'Explicar uso al cliente'] },
      { id: 't3', name: 'Visita de mantenimiento', site: 'any', sla: 90, needPhoto: true, needSign: false, checklist: ['Revisión visual', 'Limpieza', 'Reporte de piezas'] },
      { id: 't4', name: 'Surtido de pedido', site: 'indoor', sla: 30, needPhoto: true, needSign: false, checklist: ['Tomar lista de surtido', 'Surtir piezas', 'Verificar cantidades', 'Llevar a empaque'] },
      { id: 't5', name: 'Revisión de montacargas', site: 'indoor', sla: 45, needPhoto: true, needSign: false, checklist: ['Nivel de batería / gas', 'Frenos y claxon', 'Horquillas y cadenas', 'Registrar horómetro'] },
      { id: 't6', name: 'Ronda de seguridad', site: 'any', sla: 45, needPhoto: true, needSign: false, checklist: ['Revisar accesos', 'Revisar iluminación', 'Reportar incidencias'] }
    ];
    const mk = (folio, tpl, site, loc, client, prio, status, opId, ago) => {
      const T = templates.find(x => x.id === tpl);
      const P = site === 'city' ? PLACES[loc] : Object.assign({ n: sites[1].areas.find(a => a.id === loc).name }, ctr(loc));
      const o = {
        id: uid('o'), folio, tpl, site, title: T.name, client, addr: P.n, x: P.x, y: P.y, prio, sla: T.sla,
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
      mk('OT-1041', 't1', 'city', 5, 'Farmacias del Norte', 'alta', 'encamino', 'p2', 25),
      mk('OT-1042', 't2', 'city', 1, 'Café La Esquina', 'media', 'ensitio', 'p3', 70),
      mk('OT-1043', 't3', 'city', 3, 'Corporativo Santa Fe', 'media', 'encamino', 'p4', 40),
      mk('OT-1044', 't1', 'city', 0, 'Boutique Masaryk', 'baja', 'asignada', 'p1', 8),
      mk('OT-1045', 't2', 'city', 6, 'Abarrotes Ermita', 'alta', 'nueva', null, 12),
      mk('OT-1046', 't4', 'alm', 'a5', 'Pedido #58231 · Farmacias del Norte', 'alta', 'ensitio', 'p9', 14),
      mk('OT-1047', 't5', 'alm', 'a9', 'Montacargas M-03', 'media', 'nueva', null, 6),
      mk('OT-1038', 't1', 'city', 7, 'Papelería Centro', 'media', 'completada', 'p1', 180),
      mk('OT-1039', 't2', 'city', 4, 'Oficinas Del Valle', 'alta', 'completada', 'p3', 240),
      mk('OT-1040', 't4', 'alm', 'a4', 'Pedido #58190 · Clínica Narvarte', 'media', 'completada', 'p9', 150)
    ];
    ops[1].target = { x: orders[0].x, y: orders[0].y }; ops[1].order = orders[0].id;
    ops[3].target = { x: orders[2].x, y: orders[2].y }; ops[3].order = orders[2].id;
    ops[2].order = orders[1].id; ops[2].x = orders[1].x + .5; ops[2].y = orders[1].y + .5;
    ops[0].order = orders[3].id;
    ops[8].order = orders[5].id; Object.assign(ops[8], { x: orders[5].x + 1, y: orders[5].y });
    // geocercas: en la ciudad el radio va en unidades de mapa (≈310 m), en el almacén en metros
    const zones = [
      Object.assign({ id: 'z1', site: 'city', name: 'Almacén Central', r: 2.2, type: 'base', enter: true, exit: true }, fromLL(19.4405, -99.1830)),
      Object.assign({ id: 'z2', site: 'city', name: 'Zona de clientes Polanco', r: 6, type: 'permitida', enter: false, exit: true }, fromLL(19.4319, -99.1956)),
      Object.assign({ id: 'z3', site: 'city', name: 'Zona restringida Aeropuerto', r: 5, type: 'restringida', enter: true, exit: false }, fromLL(19.4363, -99.0721)),
      Object.assign({ id: 'z4', site: 'alm', name: 'Cuarto de máquinas', r: 9, type: 'restringida', enter: true, exit: false, allow: ['g3'] }, ctr('a10')),
      Object.assign({ id: 'z5', site: 'alm', name: 'Paso de montacargas', r: 7, type: 'restringida', enter: true, exit: false, allow: ['g4', 'g3'] }, { x: 69, y: 59 })
    ];
    const points = [
      { id: 'cp1', site: 'alm', code: 'P-01', name: 'Acceso principal', x: 13, y: 3, method: 'QR' },
      { id: 'cp2', site: 'alm', code: 'P-02', name: 'Andén 3', x: 26, y: 66, method: 'NFC' },
      { id: 'cp3', site: 'alm', code: 'P-03', name: 'Rack D', x: 78, y: 44, method: 'QR' },
      { id: 'cp4', site: 'alm', code: 'P-04', name: 'Cuarto de máquinas', x: 100, y: 50, method: 'NFC' },
      { id: 'cp5', site: 'alm', code: 'P-05', name: 'Empaque', x: 116, y: 18, method: 'QR' }
    ];
    const routes = [{ id: 'r1', site: 'alm', name: 'Rondín nocturno · Almacén Central', points: ['cp1', 'cp2', 'cp3', 'cp4', 'cp5'], opId: 'p5', every: 120 }];
    const rounds = [
      { id: uid('rd'), route: 'r1', opId: 'p5', start: t - 50 * MIN, hits: [{ p: 'cp1', at: t - 48 * MIN }, { p: 'cp2', at: t - 41 * MIN }] },
      { id: uid('rd'), route: 'r1', opId: 'p5', start: t - 170 * MIN, end: t - 136 * MIN, hits: ['cp1', 'cp2', 'cp3', 'cp4', 'cp5'].map((p, i) => ({ p, at: t - (168 - i * 8) * MIN })) }
    ];
    // grupos de chat por departamento o por tema (los departamentos ya tienen su chat automático)
    const chats = [
      { id: 'c1', name: 'Supervisores', dept: 'Operaciones', members: ['p7', 'p3', 'p1'], color: '#9B80FF' },
      { id: 'c2', name: 'Turno noche · Almacén', dept: 'Almacén', members: ['p5', 'p6', 'p9', 'p10', 'p7'], color: '#FFC22E' },
      { id: 'c3', name: 'Coordinación de entregas', dept: 'Logística', members: ['p1', 'p2', 'p8', 'p7', 'p9'], color: '#B4E32F' }
    ];
    const msgs = [
      { id: uid('m'), from: 'consola', to: 'all', kind: 'difusion', txt: 'Buen día equipo. Hoy hay lluvia en la tarde: manejen con precaución.', at: t - 200 * MIN, reads: ['p1', 'p2', 'p3', 'p4', 'p5', 'p7', 'p9'] },
      { id: uid('m'), from: 'p2', to: 'g1', kind: 'text', txt: 'Voy saliendo hacia Lindavista', at: t - 24 * MIN, reads: ['consola'] },
      { id: uid('m'), from: 'p9', to: 'c3', kind: 'text', txt: 'Pedido #58231 casi listo, en 10 min pasa a empaque', at: t - 9 * MIN, reads: ['consola', 'p7'] },
      { id: uid('m'), from: 'p7', to: 'c3', kind: 'text', txt: 'Arturo, al terminar Masaryk pasa por él al andén 2', at: t - 7 * MIN, reads: ['consola', 'p9'] },
      { id: uid('m'), from: 'p10', to: 'g3', kind: 'text', txt: 'Montacargas M-03 con falla en frenos, lo saco de operación', at: t - 6 * MIN, reads: [] },
      { id: uid('m'), from: 'consola', to: 'p3', kind: 'text', txt: 'Lucía, el cliente pide que le expliques el wifi', at: t - 30 * MIN, reads: ['p3'] },
      { id: uid('m'), from: 'p3', to: 'consola', kind: 'text', txt: 'Enterada 👍', at: t - 29 * MIN, reads: ['consola'] }
    ];
    const alerts = [{ id: uid('a'), type: 'bateria', opId: 'p6', at: t - 6 * MIN, status: 'abierta', txt: 'Batería al 18%' }];
    const events = [
      { at: t - 25 * MIN, opId: 'p2', txt: 'Salió de Almacén Central', type: 'geocerca' },
      { at: t - 14 * MIN, opId: 'p9', txt: 'Llegó a Rack C · OT-1046', type: 'orden' },
      { at: t - 40 * MIN, opId: 'p4', txt: 'Aceptó OT-1043', type: 'orden' },
      { at: t - 70 * MIN, opId: 'p3', txt: 'Llegó a Café La Esquina', type: 'orden' }
    ];
    return { v: V, empresa: 'Logística Demo, S.A. de C.V.', code: 'NAVI-4821', sites, groups, chats, ops, templates, orders, zones, points, routes, rounds, msgs, alerts, events, folio: 1048 };
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && s.v === V) return s;
    } catch (e) {}
    const s = seed(); save(s); return s;
  }
  function save(s, silent) {
    // los audios de PTT pesan: solo se guardan los últimos 12
    let voz = 0;
    for (let i = s.msgs.length - 1; i >= 0; i--) if (s.msgs[i].audio && ++voz > 12) s.msgs[i].audio = null;
    if (s.msgs.length > 300) s.msgs = s.msgs.slice(-300);
    if (s.events.length > 300) s.events = s.events.slice(-300);
    try { localStorage.setItem(KEY, JSON.stringify(s)); }
    catch (e) { s.msgs.forEach(m => m.audio = null); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e2) {} }
    if (!silent) subs.forEach(f => f(s, true));
  }
  // leer, cambiar y guardar en un solo paso (la consola y la app escriben a la vez)
  function update(fn, silent) { const s = load(); const r = fn(s); save(s, silent); return r; }
  const subs = [];
  function on(fn) { subs.push(fn); }
  window.addEventListener('storage', e => { if (e.key === KEY) { const s = load(); subs.forEach(f => f(s, false)); } });

  const site = (s, id) => s.sites.find(x => x.id === id) || s.sites[0];
  const scale = (s, id) => SCALE[site(s, id).kind];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // distancias según el sitio: km en la ciudad, metros en el almacén
  const km = (d, s, sid) => d * (s ? scale(s, sid).km : SCALE.outdoor.km);
  const fmtD = (d, s, sid) => { const k = km(d, s, sid); return k < 1 ? Math.round(k * 1000) + ' m' : k.toFixed(1) + ' km'; };
  const eta = (d, s, sid) => { const k = km(d, s, sid); return site(s, sid).kind === 'indoor' ? Math.max(1, Math.round(k * 1000 / 70)) : Math.max(3, Math.round(k / 25 * 60 + 2)); };
  function nearest(s, sid, x, y, filter) {
    const k = site(s, sid).kind === 'indoor' ? 40 : 16;
    return s.ops.filter(p => p.site === sid && p.status !== 'fuera' && p.status !== 'sos' && (!filter || filter(p)))
      .map(p => ({ p, d: dist(p, { x, y }), busy: s.orders.some(o => o.opId === p.id && ['asignada', 'aceptada', 'encamino', 'ensitio'].includes(o.status)) }))
      // puntaje: distancia + castigo si ya trae una orden o está en pausa
      .map(r => Object.assign(r, { score: r.d + (r.busy ? k : 0) + (r.p.status === 'pausa' ? k * 2 : 0) }))
      .sort((a, b) => a.score - b.score);
  }
  function areaAt(s, sid, x, y) { const st = site(s, sid); return (st.areas || []).find(a => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h); }
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
      if (st === 'ensitio') { p.status = 'ensitio'; p.target = null; if (!(p.gps && now() - p.gps < 120000)) { p.x = o.x + (o.site === 'city' ? .4 : 1); p.y = o.y + (o.site === 'city' ? .4 : 0); } }
      if (st === 'aceptada') p.order = o.id;
      if (st === 'completada' || st === 'cancelada') { o.done = now(); if (p.status !== 'sos') p.status = 'disponible'; p.order = null; p.target = null; }
      event(s, p.id, (map[st] || st) + ' ' + o.folio, 'orden');
    }
  }

  // simulación de movimiento: la ejecuta la consola (o la app si la consola está cerrada)
  function tick() {
    update(s => {
      const t = now();
      s.ops.forEach(p => {
        if (p.status === 'fuera') return;
        const st = site(s, p.site), sc = SCALE[st.kind], prev = { x: p.x, y: p.y };
        // con GPS real (señal de los últimos 2 min) no se simula: solo se revisa si ya llegó
        const gps = p.gps && t - p.gps < 120000;
        const o = p.order && s.orders.find(x => x.id === p.order);
        if (gps) {
          if (o && o.status === 'encamino' && dist(p, o) < (st.kind === 'indoor' ? 3 : .6)) advance(s, o.id, 'ensitio', 'detectado por GPS');
        } else if (p.target) {
          const d = dist(p, p.target), step = Math.min(d, sc.step * (.8 + Math.random() * .4));
          if (d > .3) { p.x += (p.target.x - p.x) / d * step; p.y += (p.target.y - p.y) / d * step; }
          if (dist(p, p.target) < sc.arrive) {
            if (o && o.status === 'encamino') advance(s, o.id, 'ensitio', st.kind === 'indoor' ? 'detectado en el área' : 'detectado por GPS');
            p.target = null;
          }
        } else if (p.status === 'disponible' || p.status === 'ensitio') {
          // en el almacén los disponibles caminan entre áreas de trabajo
          if (st.kind === 'indoor' && p.status === 'disponible' && Math.random() < .06 && !p.locAt) {
            const work = st.areas.filter(a => !/máquinas|montacargas/i.test(a.name) || p.group === 'g3');
            const a = work[Math.floor(Math.random() * work.length)];
            p.target = { x: a.x + a.w * (.2 + Math.random() * .6), y: a.y + a.h * (.2 + Math.random() * .6) };
          }
          p.x += (Math.random() - .5) * sc.jitter; p.y += (Math.random() - .5) * sc.jitter;
        }
        if (!gps) {
          if (st.kind === 'indoor') { p.x = Math.max(1, Math.min(st.w - 1, p.x)); p.y = Math.max(1, Math.min(st.h - 1, p.y)); }
          else { p.x = Math.max(2, Math.min(98, p.x)); p.y = Math.max(3, Math.min(97, p.y)); }
          p.seen = t;
        }
        if (p.locAt && t - p.locAt > 90000) p.locAt = null;
        const moved = gps ? 0 : dist(prev, p);
        p.km = +(p.km + moved * sc.km).toFixed(3);
        if (moved > (st.kind === 'indoor' ? .8 : .2)) { p.trail.push([+p.x.toFixed(2), +p.y.toFixed(2)]); if (p.trail.length > 40) p.trail.shift(); }
        p.gb = +(p.gb + Math.random() * .004).toFixed(3);
        if (Math.random() < .03) p.bat = Math.max(1, p.bat - 1);
        // geocercas del mismo sitio; algunas zonas solo permiten ciertos departamentos
        p.inZ = p.inZ || {};
        s.zones.filter(z => z.site === p.site).forEach(z => {
          const inside = dist(p, z) <= z.r, was = !!p.inZ[z.id];
          if (inside === was) return;
          p.inZ[z.id] = inside;
          const ok = !z.allow || z.allow.includes(p.group);
          if (inside && z.enter) {
            event(s, p.id, 'Entró a ' + z.name, 'geocerca');
            if (z.type === 'restringida' && !ok) alert(s, 'acceso', p.id, 'Entró a ' + z.name + ' sin autorización de su departamento', { ref: z.id });
            else if (z.type === 'restringida' && !z.allow) alert(s, 'geocerca', p.id, 'Entró a ' + z.name, { ref: z.id });
          }
          if (!inside && z.exit) { event(s, p.id, 'Salió de ' + z.name, 'geocerca'); if (z.type === 'permitida') alert(s, 'geocerca', p.id, 'Salió de ' + z.name, { ref: z.id }); }
        });
        if (p.bat <= 15) alert(s, 'bateria', p.id, 'Batería al ' + p.bat + '%');
        // modo trabajo solo: si no confirma a tiempo, alerta
        if (p.solo && p.soloAsk && t - p.soloAsk > 45000) { alert(s, 'hombre', p.id, 'No respondió la verificación de "trabajo solo"'); p.soloAsk = null; }
        else if (p.solo && !p.soloAsk && t - (p.soloOk || 0) > 60000) p.soloAsk = t;
      });
      s.orders.forEach(o => {
        if (['completada', 'cancelada'].includes(o.status) || t < o.due) return;
        if (!o.late) { o.late = true; alert(s, 'sla', o.opId, o.folio + ' venció su tiempo (' + o.sla + ' min)', { ref: o.id }); }
      });
    });
  }

  // ¿a quién le llega un mensaje? (todos, departamento, grupo de chat o persona)
  function members(s, to) {
    if (to === 'all') return s.ops.filter(p => p.status !== 'fuera').map(p => p.id);
    if (to.startsWith('g')) return s.ops.filter(p => p.group === to).map(p => p.id);
    if (to.startsWith('c')) return ((s.chats.find(c => c.id === to) || {}).members || []).slice();
    return [to];
  }
  const forMe = (s, m, me) => m.from !== me && (m.to === me || m.to === 'all' || members(s, m.to).includes(me));

  const fmtT = ts => new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const ago = ts => { const m = Math.round((now() - ts) / MIN); return m < 1 ? 'ahora' : m < 60 ? 'hace ' + m + ' min' : 'hace ' + Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // plano del almacén como imagen (SVG): áreas, racks y cuadrícula de 10 m
  function planSVG(st) {
    const a = st.areas.map(z => `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="1.2" fill="${z.c}22" stroke="${z.c}" stroke-width=".35"/>` +
      (/^Rack/.test(z.name) ? Array.from({ length: Math.floor(z.h / 4) }, (_, i) => `<line x1="${z.x}" y1="${z.y + (i + 1) * 4}" x2="${z.x + z.w}" y2="${z.y + (i + 1) * 4}" stroke="${z.c}66" stroke-width=".2"/>`).join('') : '') +
      `<text x="${z.x + z.w / 2}" y="${z.y + (/^Rack/.test(z.name) ? -1.2 : z.h / 2 + 1.1)}" font-size="${/^Rack/.test(z.name) ? 2.4 : 2.8}" font-family="DM Sans,sans-serif" font-weight="700" fill="#E9E5FF" text-anchor="middle">${esc(z.name)}</text>`).join('');
    const grid = Array.from({ length: Math.floor(st.w / 10) + 1 }, (_, i) => `<line x1="${i * 10}" y1="0" x2="${i * 10}" y2="${st.h}" stroke="#ffffff10" stroke-width=".2"/>`).join('') +
      Array.from({ length: Math.floor(st.h / 10) + 1 }, (_, i) => `<line x1="0" y1="${i * 10}" x2="${st.w}" y2="${i * 10}" stroke="#ffffff10" stroke-width=".2"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${st.w} ${st.h}" width="${st.w * 10}" height="${st.h * 10}"><rect width="${st.w}" height="${st.h}" fill="#0E0E55"/>${grid}<rect x=".3" y=".3" width="${st.w - .6}" height="${st.h - .6}" fill="none" stroke="#B9B7E6" stroke-width=".6"/><rect x="9" y="0" width="8" height="1" fill="#B4E32F"/><text x="13" y="3.4" font-size="1.8" fill="#B4E32F" text-anchor="middle" font-family="DM Sans,sans-serif">Entrada</text>${a}</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

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

  // SOS desde la app: tipo, ubicación (área del almacén o calle) y aviso automático a su departamento
  function sos(s, opId, kind) {
    const p = s.ops.find(x => x.id === opId), K = SOS_KINDS[kind] || SOS_KINDS.otro;
    p.status = 'sos'; if (!p.shift) p.shift = { at: now() };
    const ar = areaAt(s, p.site, p.x, p.y);
    const where = site(s, p.site).name + (ar ? ' · ' + ar.name : '');
    const a = alert(s, 'sos', opId, K.t + ' · ' + where, { kind, where, silent: !!K.silent, steps: [] });
    if (a && !K.silent) s.msgs.push({ id: uid('m'), from: 'consola', to: p.group, kind: 'text', txt: '🆘 ' + p.name + ' reportó: ' + K.t + ' en ' + where + '. La central ya está atendiendo.', at: now(), reads: ['consola'] });
    event(s, opId, 'Envió SOS: ' + K.t, 'alerta');
    return a;
  }

  window.Mando = { SOS_KINDS, sos, KEY, STATUS, ORDER_ST, ALERT_T, PLACES, SCALE, BOX, toLL, fromLL, load, save, update, on, tick, nearest, advance, event, alert, orderHist, uid, dist, km, fmtD, eta, site, scale, areaAt, members, forMe, planSVG, fmtT, ago, esc, Ptt, beep, MIN,
    reset() { localStorage.removeItem(KEY); return load(); } };
})();
