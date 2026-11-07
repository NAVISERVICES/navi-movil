// NAVI Mando · datos compartidos entre la consola central y la app del operador.
// Demo: todo vive en localStorage del navegador (clave navi.mando). Si abres la consola y la app
// en el mismo navegador se sincronizan al instante. En producción esto es un servidor en tiempo real.
//
// Sitios: la operación puede ser en la ciudad (mapa real, coordenadas GPS) o dentro de un espacio
// cerrado como un almacén (plano en metros). Cada sitio tiene su propia escala.
(function () {
  const KEY = 'navi.mando';
  const V = 14;
  const now = () => Date.now();
  const MIN = 60000;
  const uid = p => (p || 'x') + Math.random().toString(36).slice(2, 8);

  const STATUS = {
    disponible: { t: 'Disponible', c: '#B4E32F' },
    encamino:   { t: 'En camino',  c: '#7EE0FF' },
    ensitio:    { t: 'En sitio',   c: '#FFC22E' },
    receso:     { t: 'En receso',  c: '#E58BFF' },
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
    receso:   { t: 'Receso excedido', i: '🍽️', c: '#E58BFF' },
    sla:      { t: 'Orden vencida', i: '⏱️', c: '#FF7A45' },
    rondin:   { t: 'Rondín incompleto', i: '🛡️', c: '#FFC22E' },
    desvio:   { t: 'Fuera de ruta', i: '🛣️', c: '#FF7A45' },
    cambio:   { t: 'Pide cambio de ruta', i: '🔀', c: '#9D5CFF' }
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
          { id: 'a1', type: 'recepcion', name: 'Recepción', x: 2, y: 2, w: 22, h: 18, c: '#7EE0FF' },
          { id: 'a2', type: 'oficinas', name: 'Oficinas', x: 2, y: 24, w: 22, h: 20, c: '#9B80FF' },
          { id: 'a3', type: 'rack', name: 'Rack A', x: 32, y: 6, w: 8, h: 36, c: '#B4E32F' },
          { id: 'a4', type: 'rack', name: 'Rack B', x: 46, y: 6, w: 8, h: 36, c: '#B4E32F' },
          { id: 'a5', type: 'rack', name: 'Rack C', x: 60, y: 6, w: 8, h: 36, c: '#B4E32F' },
          { id: 'a6', type: 'rack', name: 'Rack D', x: 74, y: 6, w: 8, h: 36, c: '#B4E32F' },
          { id: 'a7', type: 'empaque', name: 'Empaque', x: 90, y: 6, w: 28, h: 24, c: '#FFC22E' },
          { id: 'a8', type: 'andenes', name: 'Andenes de carga', x: 2, y: 50, w: 38, h: 18, c: '#FF6FB1' },
          { id: 'a9', type: 'montacargas', name: 'Zona de montacargas', x: 46, y: 50, w: 46, h: 18, c: '#FF7A45' },
          { id: 'a10', type: 'maquinas', name: 'Cuarto de máquinas', x: 98, y: 48, w: 20, h: 20, c: '#FF4D6D' },
          { id: 'a11', type: 'comedor', name: 'Comedor', x: 92, y: 31, w: 26, h: 11, c: '#E58BFF' },
          { id: 'a12', type: 'pasillo', name: 'Pasillo principal', x: 25, y: 43, w: 95, h: 6, c: '#FFC22E' },
          { id: 'a13', type: 'andador', name: 'Andador peatonal', x: 26.8, y: 1, w: 1.6, h: 42, c: '#3DDC84' },
          { id: 'a14', type: 'entrada', name: 'Entrada', x: 15, y: 0, w: 6, h: 1, c: '#B4E32F' },
          { id: 'a15', type: 'salida', name: 'Salida', x: 0, y: 45, w: 1, h: 3.4, c: '#3DDC84' },
          { id: 'a16', type: 'salida', name: 'Salida', x: 119, y: 44.3, w: 1, h: 3.4, c: '#3DDC84' },
          { id: 'a17', type: 'salida', name: 'Salida', x: 85, y: 0, w: 3.4, h: 1, c: '#3DDC84' }
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
      op('p6', 'Diego Ruiz', 'g5', 'alm', 100, 37, 'receso', 18, 7.7, '5512345606', 'Guardia'),
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
    // Diego está comiendo y ya se pasó de su tiempo de receso
    Object.assign(ops[6], { recesoAt: t - 50 * MIN, recesoAuto: true, breakLen: 52 * MIN });
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
    return { v: V, empresa: 'Logística Demo, S.A. de C.V.', code: 'NAVI-4821', breakMin: 45, sites, groups, chats, ops, templates, orders, zones, points, routes, rounds, msgs, alerts, events, folio: 1048 };
  }

  // ---------- clientes de demo: un perfil por giro de negocio ----------
  // seguridad (guardias, patrullaje y custodia) · transporte (choferes en la calle)
  // operativa (CEDIS / almacén) · mixta (calle + almacén)
  const CLIENTS = {
    // nombre = cliente potencial + la capacidad que se le demuestra
    seguridad:  { name: 'Prosegur Seguridad', code: 'NAVI-5500', tipo: 'Seguridad privada', icon: '🛡️', desc: 'Guardias intramuros, patrullaje y custodia de traslados' },
    transporte: { name: 'DHL Transporte', code: 'NAVI-2200', tipo: 'Transporte y reparto', icon: '🚚', desc: 'Choferes de reparto, supervisión de ruta y custodia de carga' },
    operativa:  { name: 'Amazon Almacén', code: 'NAVI-1100', tipo: 'Almacén / CEDIS', icon: '🏭', desc: 'Centro de distribución: surtido, montacargas, mantenimiento y seguridad' },
    mixta:      { name: 'Mercado Libre Logística', code: 'NAVI-4821', tipo: 'Logística mixta', icon: '🔀', desc: 'Reparto en la ciudad + almacén central en una sola consola' }
  };
  let CID = 'mixta';
  const keyOf = () => KEY + ':' + CID;
  // sin órdenes de trabajo: NAVI Mando da visibilidad del personal y los activos por departamento,
  // no administra ni mide la operación del cliente con sus propios clientes
  function noOrders(s) {
    s.orders = []; s.templates = [];
    const enViaje = id => (s.trips || []).some(tr => tr.opId === id && tr.status === 'enruta');
    s.ops.forEach(p => { p.order = null; if (['encamino', 'ensitio'].includes(p.status) && !enViaje(p.id)) { p.status = 'disponible'; p.target = null; } });
    s.alerts = s.alerts.filter(a => !['sla', 'cambio'].includes(a.type));
    s.events = s.events.filter(e => e.type !== 'orden' && !/\bOT-\d/.test(e.txt || ''));
    s.msgs = s.msgs.filter(m => !/\bOT-\d|pedido|orden/i.test(m.txt || ''));
    return s;
  }
  function seedFor(cid) {
    const s = seed(), t = now(), C = CLIENTS[cid] || CLIENTS.mixta;
    s.client = cid; s.empresa = C.name; s.code = C.code;
    if (cid === 'mixta') return noOrders(s);
    const keepGroups = ids => { s.groups = s.groups.filter(g => ids.includes(g.id)); };
    const nameGroups = m => s.groups.forEach(g => { if (m[g.id]) g.name = m[g.id]; });
    const cleanMsgs = () => { const ok = to => to === 'all' || to === 'consola' || s.groups.some(g => g.id === to) || s.chats.some(c => c.id === to) || s.ops.some(p => p.id === to); s.msgs = s.msgs.filter(m => ok(m.to) && (m.from === 'consola' || s.ops.some(p => p.id === m.from))); };
    const mkOrder = (folio, tpl, site, P, client, prio, status, opId, ago) => {
      const T = s.templates.find(x => x.id === tpl), done = status === 'completada';
      const o = { id: uid('o'), folio, tpl, site, title: T.name, client, addr: P.n, x: P.x, y: P.y, prio, sla: T.sla, status, opId, created: t - ago * MIN, due: t - ago * MIN + T.sla * MIN,
        checklist: T.checklist.map(c => ({ t: c, done })), needPhoto: T.needPhoto, needSign: T.needSign, photo: null, sign: null, notes: '', rating: null, hist: [{ at: t - ago * MIN, txt: 'Orden creada por Mesa de control' }] };
      if (opId) o.hist.push({ at: t - (ago - 2) * MIN, txt: 'Asignada a ' + s.ops.find(p => p.id === opId).name });
      if (done) { o.done = t - (ago - T.sla * .6) * MIN; o.hist.push({ at: o.done, txt: 'Completada con evidencia' }); }
      s.orders.push(o); return o;
    };
    // cambia el tipo de trabajo de una orden ya creada
    const retpl = (o, tpl, client) => {
      const T = s.templates.find(x => x.id === tpl), done = o.status === 'completada';
      Object.assign(o, { tpl, title: T.name, sla: T.sla, due: o.created + T.sla * MIN, needPhoto: T.needPhoto, needSign: T.needSign, checklist: T.checklist.map(c => ({ t: c, done })) });
      if (client) o.client = client;
    };
    // deja al operador trabajando en su orden (en camino o en sitio)
    const link = o => {
      const p = s.ops.find(x => x.id === o.opId); if (!p || ['completada', 'cancelada'].includes(o.status)) return;
      p.order = o.id;
      if (o.status === 'encamino') { p.status = 'encamino'; p.target = { x: o.x, y: o.y }; }
      if (o.status === 'ensitio') { p.status = 'ensitio'; p.target = null; p.x = o.x + .5; p.y = o.y + .5; p.trail = [[p.x, p.y]]; }
    };
    if (cid === 'seguridad') {
      // guardias en el CEDIS de un cliente + patrullaje y custodia de traslados en la ciudad
      const st = s.sites.find(x => x.id === 'alm'); st.name = 'CEDIS cliente · Vallejo';
      const ctr = id => { const a = st.areas.find(z => z.id === id); return { n: a.name, x: a.x + a.w / 2, y: a.y + a.h / 2 }; };
      const conv = { p1: ['g1', 'Custodio'], p2: ['g1', 'Custodio'], p8: ['g1', 'Custodio'], p3: ['g2', 'Patrullera'], p4: ['g2', 'Patrullero'], p5: ['g5', 'Guardia'], p6: ['g5', 'Guardia'], p7: ['g4', 'Supervisora de turno'], p9: ['g5', 'Guardia de acceso'], p10: ['g5', 'Guardia'] };
      s.ops.forEach(p => { const c = conv[p.id]; Object.assign(p, { group: c[0], role: c[1], order: null, target: null }); if (['encamino', 'ensitio'].includes(p.status)) p.status = 'disponible'; });
      keepGroups(['g1', 'g2', 'g4', 'g5']);
      nameGroups({ g1: 'Custodia de traslados', g2: 'Patrullaje', g4: 'Supervisión', g5: 'Guardias intramuros' });
      s.templates = s.templates.filter(x => x.id === 't6').concat([
        { id: 't9', name: 'Atención de alarma', site: 'any', sla: 20, needPhoto: true, needSign: false, checklist: ['Confirmar llegada con monitoreo', 'Revisar accesos y perímetro', 'Hablar con el responsable del sitio', 'Reportar novedad'] },
        { id: 't10', name: 'Custodia de traslado', site: 'outdoor', sla: 90, needPhoto: true, needSign: true, checklist: ['Verificar unidad y sellos', 'Confirmar ruta con la central', 'Acompañar hasta el destino', 'Entrega con firma'] },
        { id: 't11', name: 'Control de acceso', site: 'indoor', sla: 15, needPhoto: true, needSign: false, checklist: ['Identificar a la persona', 'Confirmar autorización con el cliente', 'Registrar en bitácora', 'Entregar gafete o negar acceso'] }
      ]);
      s.orders = [];
      [
        mkOrder('OT-1041', 't10', 'city', PLACES[5], 'Farmacias del Norte · traslado de valores', 'alta', 'encamino', 'p2', 25),
        mkOrder('OT-1042', 't9', 'city', PLACES[1], 'Café La Esquina · alarma de intrusión', 'alta', 'ensitio', 'p3', 12),
        mkOrder('OT-1043', 't6', 'city', PLACES[3], 'Corporativo Santa Fe · ronda perimetral', 'media', 'encamino', 'p4', 20),
        mkOrder('OT-1044', 't10', 'city', PLACES[0], 'Boutique Masaryk · traslado de efectivo', 'media', 'asignada', 'p1', 8),
        mkOrder('OT-1045', 't9', 'city', PLACES[6], 'Abarrotes Ermita · botón de pánico', 'alta', 'nueva', null, 3),
        mkOrder('OT-1046', 't6', 'alm', ctr('a5'), 'CEDIS cliente · revisión de racks', 'media', 'ensitio', 'p9', 14),
        mkOrder('OT-1047', 't11', 'alm', ctr('a1'), 'Proveedor sin cita en recepción', 'media', 'nueva', null, 4),
        mkOrder('OT-1038', 't10', 'city', PLACES[7], 'Papelería Centro · traslado', 'media', 'completada', 'p1', 180),
        mkOrder('OT-1039', 't9', 'city', PLACES[4], 'Oficinas Del Valle · alarma', 'alta', 'completada', 'p3', 240),
        mkOrder('OT-1040', 't6', 'alm', ctr('a4'), 'CEDIS cliente · ronda de racks', 'media', 'completada', 'p9', 150)
      ].forEach(link);
      s.zones = s.zones.filter(z => z.id !== 'z5');
      s.zones.find(z => z.id === 'z1').name = 'Base operativa';
      s.zones.find(z => z.id === 'z4').allow = ['g4'];
      s.routes[0].name = 'Rondín nocturno · CEDIS cliente';
      [[7, 'P-06', 'Sucursal Centro'], [9, 'P-07', 'Sucursal Narvarte'], [1, 'P-08', 'Sucursal Roma'], [0, 'P-09', 'Sucursal Polanco']].forEach(([i, code, name], k) => s.points.push({ id: 'cp' + (k + 6), site: 'city', code, name, x: PLACES[i].x, y: PLACES[i].y, method: 'QR' }));
      s.routes.push({ id: 'r2', site: 'city', name: 'Patrullaje de sucursales', points: ['cp6', 'cp7', 'cp8', 'cp9'], opId: 'p4', every: 180 });
      s.rounds.push({ id: uid('rd'), route: 'r2', opId: 'p4', start: t - 90 * MIN, hits: [{ p: 'cp6', at: t - 85 * MIN }, { p: 'cp7', at: t - 62 * MIN }] });
      s.chats = [
        { id: 'c1', name: 'Supervisores', dept: 'Operaciones', members: ['p7', 'p3', 'p1'], color: '#9B80FF' },
        { id: 'c2', name: 'Turno noche · CEDIS cliente', dept: 'Guardias', members: ['p5', 'p6', 'p9', 'p10', 'p7'], color: '#FFC22E' },
        { id: 'c3', name: 'Traslados del día', dept: 'Custodia', members: ['p1', 'p2', 'p8', 'p7'], color: '#FF6FB1' }
      ];
      s.msgs = [
        { id: uid('m'), from: 'consola', to: 'all', kind: 'difusion', txt: 'Buen día equipo. Reporte de novedades cada hora por radio y uniforme completo en todo el turno.', at: t - 200 * MIN, reads: ['p1', 'p2', 'p3', 'p4', 'p5', 'p7', 'p9'] },
        { id: uid('m'), from: 'p2', to: 'g1', kind: 'text', txt: 'Salimos con el traslado hacia Lindavista', at: t - 24 * MIN, reads: ['consola'] },
        { id: uid('m'), from: 'p3', to: 'consola', kind: 'text', txt: 'Llegué a Café La Esquina, reviso la alarma', at: t - 11 * MIN, reads: ['consola'] },
        { id: uid('m'), from: 'consola', to: 'p3', kind: 'text', txt: 'Enterada. Si hay intrusión no entres sola, te mando apoyo.', at: t - 10 * MIN, reads: ['p3'] },
        { id: uid('m'), from: 'p9', to: 'g5', kind: 'text', txt: 'Proveedor sin cita en recepción, lo retengo en caseta', at: t - 4 * MIN, reads: [] },
        { id: uid('m'), from: 'p7', to: 'c2', kind: 'text', txt: 'Diego, ya pasó tu hora de comida, regresa a tu punto', at: t - 3 * MIN, reads: ['consola'] }
      ];
      s.folio = 1048;
    }
    if (cid === 'operativa') {
      const st = s.sites.find(x => x.id === 'alm'); st.name = 'Amazon CEDIS · Vallejo';
      s.sites = [st];
      const ctr = id => { const a = st.areas.find(z => z.id === id); return { n: a.name, x: a.x + a.w / 2, y: a.y + a.h / 2 }; };
      // el personal de calle pasa a ser personal del CEDIS
      const conv = { p1: ['g4', 'Surtidor', 'a3'], p2: ['g4', 'Surtidor', 'a6'], p3: ['g3', 'Técnica de mantenimiento', 'a9'], p4: ['g4', 'Montacarguista', 'a8'], p8: ['g4', 'Surtidor', 'a1'] };
      s.ops.forEach(p => { const c = conv[p.id]; if (!c) return; const P = ctr(c[2]); Object.assign(p, { site: 'alm', group: c[0], role: c[1], x: P.x + 1, y: P.y, trail: [[P.x + 1, P.y]], target: null, order: null, km: +(Math.random() * 3 + 1).toFixed(2), status: p.status === 'fuera' ? 'fuera' : 'disponible' }); });
      s.events = s.events.filter(e => !conv[e.opId]);
      s.orders = s.orders.filter(o => o.site === 'alm');
      s.templates = s.templates.filter(x => x.site !== 'outdoor');
      s.zones = s.zones.filter(z => z.site === 'alm');
      keepGroups(['g3', 'g4', 'g5']);
      const o1 = mkOrder('OT-1048', 't4', 'alm', ctr('a6'), 'Pedido #58240 · Abarrotes Ermita', 'media', 'asignada', 'p1', 4);
      mkOrder('OT-1049', 't4', 'alm', ctr('a3'), 'Pedido #58244 · Café La Esquina', 'alta', 'nueva', null, 2);
      s.ops.find(p => p.id === 'p1').order = o1.id;
      s.chats = [
        { id: 'c1', name: 'Supervisores', dept: 'Operaciones', members: ['p7', 'p10', 'p3'], color: '#9B80FF' },
        { id: 'c2', name: 'Turno noche · CEDIS', dept: 'Almacén', members: ['p5', 'p6', 'p9', 'p10', 'p7'], color: '#FFC22E' },
        { id: 'c3', name: 'Embarques del día', dept: 'Logística', members: ['p7', 'p9', 'p1', 'p2', 'p4'], color: '#B4E32F' }
      ];
      s.msgs.find(m => m.kind === 'difusion').txt = 'Recuerden: chaleco y casco obligatorios en la zona de montacargas.';
      s.msgs.push({ id: uid('m'), from: 'p4', to: 'c3', kind: 'text', txt: 'Andén A2 listo para cargar el camión de las 3', at: t - 5 * MIN, reads: ['consola'] });
      s.folio = 1050;
    }
    if (cid === 'transporte') {
      const st = s.sites.find(x => x.id === 'city'); s.sites = [st];
      // el personal del almacén pasa a ser personal de calle
      const conv = { p5: ['g5', 'Custodio de carga', 7], p6: ['g5', 'Custodio de carga', 9], p7: ['g2', 'Supervisora de ruta', 4], p9: ['g1', 'Chofer', 8], p10: ['g2', 'Mecánico de ruta', 10] };
      s.ops.forEach(p => { const c = conv[p.id]; if (!c) return; const P = PLACES[c[2]]; Object.assign(p, { site: 'city', group: c[0], role: c[1], x: P.x + .6, y: P.y + .4, trail: [[P.x + .6, P.y + .4]], target: null, order: null, km: +(Math.random() * 25 + 5).toFixed(1), status: p.status === 'receso' ? 'receso' : 'disponible', recesoAuto: false, recesoAt: p.status === 'receso' ? t - 20 * MIN : null }); });
      s.events = s.events.filter(e => !conv[e.opId]);
      s.orders = s.orders.filter(o => o.site === 'city');
      // choferes, supervisión de ruta y custodia de carga
      Object.assign(s.ops.find(p => p.id === 'p1'), { role: 'Chofer' });
      Object.assign(s.ops.find(p => p.id === 'p2'), { role: 'Chofer' });
      Object.assign(s.ops.find(p => p.id === 'p8'), { role: 'Chofer' });
      Object.assign(s.ops.find(p => p.id === 'p3'), { role: 'Supervisora de ruta' });
      Object.assign(s.ops.find(p => p.id === 'p4'), { role: 'Mecánico de ruta' });
      s.templates = s.templates.filter(x => ['t1', 't6'].includes(x.id)).concat([
        { id: 't7', name: 'Recolección de carga', site: 'outdoor', sla: 90, needPhoto: true, needSign: true, checklist: ['Confirmar folio con el remitente', 'Contar bultos', 'Fotografiar la carga', 'Firma de quien entrega'] },
        { id: 't8', name: 'Revisión de unidad', site: 'outdoor', sla: 45, needPhoto: true, needSign: false, checklist: ['Llantas y presión', 'Luces y frenos', 'Nivel de combustible', 'Registrar kilometraje'] }
      ]);
      s.orders.forEach(o => { if (o.tpl === 't2') retpl(o, 't7'); if (o.tpl === 't3') retpl(o, 't8', 'Unidad T-14 · ponchadura'); });
      s.zones = s.zones.filter(z => z.site === 'city');
      s.zones.find(z => z.id === 'z1').name = 'Patio de unidades';
      keepGroups(['g1', 'g2', 'g5']);
      nameGroups({ g1: 'Choferes de reparto', g2: 'Supervisión y mecánicos', g5: 'Custodia de carga' });
      const o1 = mkOrder('OT-1048', 't8', 'city', PLACES[11], 'Unidad T-09 · falla de frenos', 'alta', 'asignada', 'p10', 6);
      mkOrder('OT-1049', 't1', 'city', PLACES[2], 'Librería Coyoacán', 'baja', 'nueva', null, 3);
      s.ops.find(p => p.id === 'p10').order = o1.id;
      // ronda de supervisión por las bases en la calle
      s.points = [[7, 'P-01', 'Base Centro'], [9, 'P-02', 'Base Narvarte'], [1, 'P-03', 'Base Roma'], [0, 'P-04', 'Base Polanco']].map(([i, code, name], k) => ({ id: 'cp' + (k + 1), site: 'city', code, name, x: PLACES[i].x, y: PLACES[i].y, method: 'QR' }));
      s.routes = [{ id: 'r1', site: 'city', name: 'Ronda de supervisión de bases', points: ['cp1', 'cp2', 'cp3', 'cp4'], opId: 'p5', every: 180 }];
      s.rounds = [{ id: uid('rd'), route: 'r1', opId: 'p5', start: t - 60 * MIN, hits: [{ p: 'cp1', at: t - 55 * MIN }, { p: 'cp2', at: t - 30 * MIN }] }];
      s.chats = [
        { id: 'c1', name: 'Supervisores', dept: 'Operaciones', members: ['p7', 'p3', 'p1'], color: '#9B80FF' },
        { id: 'c3', name: 'Coordinación de entregas', dept: 'Logística', members: ['p1', 'p2', 'p8', 'p9', 'p7'], color: '#B4E32F' },
        { id: 'c4', name: 'Custodia de carga', dept: 'Custodia', members: ['p5', 'p6', 'p7'], color: '#FF6FB1' }
      ];
      s.msgs = s.msgs.filter(m => !/wifi|Enterada|Pedido|andén/.test(m.txt || ''));
      s.msgs.find(m => m.kind === 'difusion').txt = 'Buen día choferes. Hoy hay lluvia en la tarde: manejen con precaución y respeten los límites.';
      s.msgs.push({ id: uid('m'), from: 'p9', to: 'c3', kind: 'text', txt: 'Ya cargué en el patio, salgo a Aeropuerto', at: t - 8 * MIN, reads: ['consola'] });
      // la zona del aeropuerto es la terminal de carga, destino normal de los viajes
      Object.assign(s.zones.find(z => z.id === 'z3'), { name: 'Terminal de carga Aeropuerto', type: 'base', exit: true });
      // unidades: destino con ruta programada, recorrido real y aviso a la mesa si se separa 1 km. Sin carga
      Object.assign(s.ops.find(p => p.id === 'p8'), { shift: { at: t - 3 * 60 * MIN } });
      s.trips = []; s.tripFolio = 296;
      const short = i => PLACES[i].n.split(' · ')[0];
      const mkT = (opId, a, b, unit, ago) => {
        const p = s.ops.find(x => x.id === opId), path = routeBetween(pt(PLACES[a]), pt(PLACES[b]));
        const tr = { id: uid('vj'), folio: 'VJ-' + (++s.tripFolio), opId, from: short(a), to: short(b), fromAddr: PLACES[a].n, toAddr: PLACES[b].n, unit, path, orig: path, seg: 0, start: t - ago * MIN, status: 'enruta', loop: true };
        const q = path[0], n = path[1];
        Object.assign(p, { site: 'city', x: +(q[0] + (n[0] - q[0]) * .35).toFixed(2), y: +(q[1] + (n[1] - q[1]) * .35).toFixed(2), target: null, order: null, status: 'encamino' });
        p.trail = [[q[0], q[1]], [p.x, p.y]];
        s.trips.push(tr); s.events.push({ at: tr.start, opId, txt: 'Unidad ' + unit + ' salió de ' + tr.from + ' rumbo a ' + tr.to, type: 'ruta' });
        return tr;
      };
      // recorrido de la mañana ya terminado
      const v0 = mkT('p9', 6, 8, 'T-21', 150);
      Object.assign(v0, { status: 'entregado', done: t - 95 * MIN, loop: false });
      s.events.push({ at: v0.done, opId: 'p9', txt: 'Unidad T-21 llegó a ' + v0.to, type: 'ruta' });
      // en movimiento ahora
      mkT('p9', 8, 10, 'T-21', 8);
      mkT('p8', 7, 3, 'T-07', 14);
      const v3 = mkT('p1', 0, 5, 'T-14', 11);
      // Arturo se va a separar de su ruta: en unos segundos la mesa recibe el aviso
      simDesvio(s, v3.id);
      s.events.sort((a, b) => a.at - b.at);
      s.folio = 1050;
    }
    s.alerts = s.alerts.filter(a => s.ops.some(p => p.id === a.opId));
    s.events = s.events.filter(e => s.ops.some(p => p.id === e.opId && (cid !== 'operativa' || e.type !== 'geocerca')));
    cleanMsgs();
    return noOrders(s);
  }

  // dónde vive la copia de los datos en este equipo: localStorage en la demo; con servidor, sessionStorage
  // (una copia por pestaña, que llena el servidor) para que dos pestañas no se mezclen
  let DATA = localStorage;
  function load() {
    try {
      const s = JSON.parse(DATA.getItem(keyOf()) || 'null');
      if (s && s.v === V) return s;
    } catch (e) {}
    const s = seedFor(CID); save(s); return s;
  }
  function save(s, silent) {
    // los audios de PTT pesan: solo se guardan los últimos 12
    let voz = 0;
    for (let i = s.msgs.length - 1; i >= 0; i--) if (s.msgs[i].audio && ++voz > 12) s.msgs[i].audio = null;
    if (s.msgs.length > 300) s.msgs = s.msgs.slice(-300);
    if (s.events.length > 300) s.events = s.events.slice(-300);
    try { DATA.setItem(keyOf(), JSON.stringify(s)); }
    catch (e) { s.msgs.forEach(m => m.audio = null); try { DATA.setItem(keyOf(), JSON.stringify(s)); } catch (e2) {} }
    // con servidor (sync.js) cada cambio local se manda a los demás equipos
    saveHooks.forEach(f => { try { f(s); } catch (e) {} });
    if (!silent) subs.forEach(f => f(s, true));
  }
  const saveHooks = [];
  // leer, cambiar y guardar en un solo paso (la consola y la app escriben a la vez)
  function update(fn, silent) { const s = load(); const r = fn(s); save(s, silent); return r; }
  const subs = [];
  function on(fn) { subs.push(fn); }
  window.addEventListener('storage', e => { if (e.key === keyOf()) { const s = load(); subs.forEach(f => f(s, false)); } });

  const site = (s, id) => s.sites.find(x => x.id === id) || s.sites[0];
  const scale = (s, id) => SCALE[site(s, id).kind];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // distancias según el sitio: km en la ciudad, metros en el almacén
  const km = (d, s, sid) => d * (s ? scale(s, sid).km : SCALE.outdoor.km);
  const fmtD = (d, s, sid) => { const k = km(d, s, sid); return k < 1 ? Math.round(k * 1000) + ' m' : k.toFixed(1) + ' km'; };
  const eta = (d, s, sid) => { const k = km(d, s, sid); return site(s, sid).kind === 'indoor' ? Math.max(1, Math.round(k * 1000 / 70)) : Math.max(3, Math.round(k / 25 * 60 + 2)); };
  function nearest(s, sid, x, y, filter) {
    const k = site(s, sid).kind === 'indoor' ? 40 : 16;
    return s.ops.filter(p => p.site === sid && !['fuera', 'sos', 'receso'].includes(p.status) && (!filter || filter(p)))
      .map(p => ({ p, d: dist(p, { x, y }), busy: s.orders.some(o => o.opId === p.id && ['asignada', 'aceptada', 'encamino', 'ensitio'].includes(o.status)) }))
      // puntaje: distancia + castigo si ya trae una orden o está en pausa
      .map(r => Object.assign(r, { score: r.d + (r.busy ? k : 0) + (r.p.status === 'pausa' ? k * 2 : 0) }))
      .sort((a, b) => a.score - b.score);
  }
  // tipos de área para armar el layout de cualquier almacén
  const AREA_T = {
    rack:        { t: 'Rack / estantería', i: '🗄️', c: '#B4E32F', w: 8, h: 30 },
    recepcion:   { t: 'Recepción', i: '🛎️', c: '#7EE0FF', w: 18, h: 14 },
    oficinas:    { t: 'Oficinas', i: '💼', c: '#9B80FF', w: 20, h: 16 },
    empaque:     { t: 'Empaque', i: '📦', c: '#FFC22E', w: 24, h: 18 },
    andenes:     { t: 'Andenes de carga', i: '🚚', c: '#FF6FB1', w: 34, h: 16 },
    montacargas: { t: 'Zona de montacargas', i: '🏗️', c: '#FF7A45', w: 30, h: 14 },
    maquinas:    { t: 'Cuarto de máquinas', i: '⚡', c: '#FF4D6D', w: 16, h: 16 },
    comedor:     { t: 'Comedor', i: '🍽️', c: '#E58BFF', w: 20, h: 10 },
    almacen:     { t: 'Área de almacenaje', i: '🧱', c: '#D9A066', w: 20, h: 14 },
    pasillo:     { t: 'Pasillo de montacargas', i: '↔️', c: '#FFC22E', w: 40, h: 5 },
    andador:     { t: 'Andador peatonal', i: '🚶', c: '#3DDC84', w: 1.6, h: 24 },
    entrada:     { t: 'Entrada', i: '🚪', c: '#B4E32F', w: 6, h: 1 },
    salida:      { t: 'Salida de emergencia', i: '🟩', c: '#3DDC84', w: 3.4, h: 1 },
    generica:    { t: 'Área libre', i: '⬜', c: '#B0AEE0', w: 14, h: 10 }
  };
  const aType = a => a.type || (/^rack/i.test(a.name) ? 'rack' : /recep/i.test(a.name) ? 'recepcion' : /ofic/i.test(a.name) ? 'oficinas' : /empaque/i.test(a.name) ? 'empaque' : /anden/i.test(a.name) ? 'andenes' : /montacarg/i.test(a.name) ? 'montacargas' : /m[aá]quinas/i.test(a.name) ? 'maquinas' : /comedor/i.test(a.name) ? 'comedor' : 'generica');
  const PASO = ['pasillo', 'andador', 'entrada', 'salida'];
  const isWork = a => !PASO.includes(aType(a));
  // área en un punto: primero las de trabajo, luego pasillos
  function areaAt(s, sid, x, y) {
    const st = site(s, sid), inA = a => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h;
    const L = st.areas || []; return L.find(a => isWork(a) && inA(a)) || L.find(a => ['pasillo', 'andador'].includes(aType(a)) && inA(a));
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
        // viaje con ruta: el simulador sigue la ruta vigente (o el desvío de prueba)
        const tr = p.site === 'city' && activeTrip(s, p.id);
        if (tr && !gps && !p.target) {
          const n = tr.detour && tr.detourPt ? tr.detourPt : tr.path[tr.seg + 1];
          if (n) p.target = { x: n[0], y: n[1] };
        }
        if (gps) {
          if (o && o.status === 'encamino' && dist(p, o) < (st.kind === 'indoor' ? 3 : .6)) advance(s, o.id, 'ensitio', 'detectado por GPS');
        } else if (p.target) {
          const d = dist(p, p.target), step = Math.min(d, sc.step * (.8 + Math.random() * .4) * (tr ? .3 : 1));
          if (d > .3) { p.x += (p.target.x - p.x) / d * step; p.y += (p.target.y - p.y) / d * step; }
          if (dist(p, p.target) < sc.arrive) {
            if (o && o.status === 'encamino') advance(s, o.id, 'ensitio', st.kind === 'indoor' ? 'detectado en el área' : 'detectado por GPS');
            p.target = null;
          }
        } else if (p.status === 'disponible' || p.status === 'ensitio') {
          // en el almacén los disponibles caminan entre áreas de trabajo
          const com = st.kind === 'indoor' && st.areas.find(a => aType(a) === 'comedor');
          if (com && p.status === 'disponible' && !p.order && !p.locAt && Math.random() < .006) {
            // de vez en cuando alguien sale a comer: camina al comedor
            p.target = { x: com.x + com.w * (.15 + Math.random() * .7), y: com.y + com.h * (.25 + Math.random() * .5) };
            p.breakLen = (60 + Math.random() * 90) * 1000;
          } else if (st.kind === 'indoor' && p.status === 'disponible' && Math.random() < .06 && !p.locAt) {
            const work = st.areas.filter(a => isWork(a) && aType(a) !== 'comedor' && (!['maquinas', 'montacargas'].includes(aType(a)) || p.group === 'g3'));
            const a = work[Math.floor(Math.random() * work.length)];
            if (a) p.target = { x: a.x + a.w * (.2 + Math.random() * .6), y: a.y + a.h * (.2 + Math.random() * .6) };
          }
          p.x += (Math.random() - .5) * sc.jitter; p.y += (Math.random() - .5) * sc.jitter;
        } else if (p.status === 'receso' && p.recesoAuto && !p.locAt && p.recesoAt && t - p.recesoAt > (p.breakLen || 30 * MIN) && st.kind === 'indoor') {
          // terminó de comer: regresa a un área de trabajo (al salir del comedor vuelve a disponible)
          const work = st.areas.filter(a => isWork(a) && !['comedor', 'maquinas', 'montacargas'].includes(aType(a)));
          const a = work[Math.floor(Math.random() * work.length)];
          if (a) p.target = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
        }
        if (!gps) {
          if (st.kind === 'indoor') { p.x = Math.max(1, Math.min(st.w - 1, p.x)); p.y = Math.max(1, Math.min(st.h - 1, p.y)); }
          else { p.x = Math.max(2, Math.min(98, p.x)); p.y = Math.max(3, Math.min(97, p.y)); }
          p.seen = t;
        }
        if (p.locAt && t - p.locAt > 90000 && p.status !== 'receso') p.locAt = null;
        // comedor: al entrar queda en receso; al salir vuelve a disponible
        const ar = st.kind === 'indoor' ? areaAt(s, p.site, p.x, p.y) : null, inCom = !!(ar && aType(ar) === 'comedor');
        const tA = p.target && st.kind === 'indoor' ? areaAt(s, p.site, p.target.x, p.target.y) : null;
        const goingCom = !p.target || !!(tA && aType(tA) === 'comedor');
        if (inCom && goingCom && ['disponible', 'pausa'].includes(p.status) && !p.order) {
          p.status = 'receso'; p.recesoAt = t; p.recesoAuto = true; p.target = null; event(s, p.id, 'Entró al comedor · en receso', 'estado');
        } else if (!inCom && p.status === 'receso' && p.recesoAuto && st.kind === 'indoor') {
          event(s, p.id, 'Regresó de receso · ' + Math.max(1, Math.round((t - (p.recesoAt || t)) / MIN)) + ' min', 'estado');
          p.status = 'disponible'; p.recesoAt = null; p.recesoAuto = false;
        }
        if (p.status === 'receso' && p.recesoAt && t - p.recesoAt > (s.breakMin || 45) * MIN) alert(s, 'receso', p.id, 'Lleva ' + Math.round((t - p.recesoAt) / MIN) + ' min en receso (tiempo de comida: ' + (s.breakMin || 45) + ' min)', { ref: p.recesoAt });
        if (tr) tripTick(s, p, tr, t);
        const moved = gps ? 0 : dist(prev, p);
        p.km = +(p.km + moved * sc.km).toFixed(3);
        if (moved > (st.kind === 'indoor' ? .8 : .2)) { p.trail.push([+p.x.toFixed(2), +p.y.toFixed(2)]); if (p.trail.length > (st.kind === 'indoor' ? 40 : 400)) p.trail.shift(); }
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
      // demo: al llegar, la unidad regresa a su base (solo para que se vea moverse en el mapa)
      (s.trips || []).forEach(tr => {
        if (tr.status !== 'entregado' || !tr.loop || tr.next || t - tr.done < 40000) return;
        const p = s.ops.find(x => x.id === tr.opId); if (!p || ['fuera', 'sos', 'receso'].includes(p.status) || activeTrip(s, p.id)) return;
        tr.next = true;
        mkTrip(s, { opId: p.id, from: tr.to, to: tr.from, toAddr: tr.fromAddr, fromAddr: tr.toAddr, unit: tr.unit, path: routeBetween(pt(p), tr.orig[0]), loop: true });
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

  // plano de cualquier almacén como imagen (SVG en metros). Cada área se dibuja según su tipo:
  // racks con tarimas, pasillos señalizados, andador peatonal, oficinas, empaque, comedor, andenes,
  // montacargas, cuarto de máquinas, entradas y salidas de emergencia; muros y extintores automáticos.
  function planSVG(st) {
    const W = st.w, H = st.h, F = 'DM Sans,Segoe UI,sans-serif';
    let sd = 11; const rnd = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    const r = (x, y, w, h, a) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a || ''}/>`;
    const t = (x, y, s, txt, a) => `<text x="${x}" y="${y}" font-size="${s}" font-family="${F}" ${a || ''}>${esc(txt)}</text>`;
    const pill = (x, y, txt, c) => { const w = txt.length * 1.05 + 3.6; return `<g>${r(x, y, w, 3, `rx="1.5" fill="#06062E" fill-opacity=".88" stroke="${c}" stroke-width=".25"`)}<circle cx="${x + 1.5}" cy="${y + 1.5}" r=".6" fill="${c}"/>${t(x + 2.6, y + 2.1, 1.75, txt, 'font-weight="700" fill="#F4F3FF"')}</g>`; };
    const areas = (st.areas || []).slice(), ty = aType;
    let defs = '', g = '', top = '', clipN = 0;
    const clip = a => { const id = 'c' + (clipN++); defs += `<clipPath id="${id}"><rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}"/></clipPath>`; return id; };
    // piso de concreto con cuadrícula de 5 m
    g += r(0, 0, W, H, 'fill="url(#floor)"');
    for (let x = 5; x < W; x += 5) g += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#ffffff" stroke-opacity="${x % 10 ? .025 : .05}" stroke-width=".12"/>`;
    for (let y = 5; y < H; y += 5) g += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#ffffff" stroke-opacity="${y % 10 ? .025 : .05}" stroke-width=".12"/>`;

    // 1) pasillos de montacargas y andadores
    areas.filter(a => ty(a) === 'pasillo').forEach(a => {
      const hz = a.w >= a.h, { x, y, w, h } = a;
      g += r(x, y, w, h, 'fill="#ffffff" fill-opacity=".035"');
      if (hz) {
        g += `<line x1="${x}" y1="${y + .3}" x2="${x + w}" y2="${y + .3}" stroke="#FFC22E" stroke-width=".3"/><line x1="${x}" y1="${y + h - .3}" x2="${x + w}" y2="${y + h - .3}" stroke="#FFC22E" stroke-width=".3"/>`;
        g += `<line x1="${x + 2}" y1="${y + h / 2}" x2="${x + w - 2}" y2="${y + h / 2}" stroke="#ffffff" stroke-opacity=".35" stroke-width=".22" stroke-dasharray="2 1.6"/>`;
        for (let ax = x + 8; ax < x + w - 6; ax += 22) g += `<path d="M${ax} ${y + h * .27} l1.6 .8 -1.6 .8z M${ax + 4} ${y + h * .73} l-1.6-.8 1.6-.8z" fill="#ffffff" fill-opacity=".45"/>`;
      } else {
        g += `<line x1="${x + .3}" y1="${y}" x2="${x + .3}" y2="${y + h}" stroke="#FFC22E" stroke-width=".3"/><line x1="${x + w - .3}" y1="${y}" x2="${x + w - .3}" y2="${y + h}" stroke="#FFC22E" stroke-width=".3"/>`;
        g += `<line x1="${x + w / 2}" y1="${y + 2}" x2="${x + w / 2}" y2="${y + h - 2}" stroke="#ffffff" stroke-opacity=".35" stroke-width=".22" stroke-dasharray="2 1.6"/>`;
        for (let ay = y + 8; ay < y + h - 6; ay += 22) g += `<path d="M${x + w * .27} ${ay} l.8 1.6 .8-1.6z M${x + w * .73} ${ay + 4} l-.8-1.6 -.8 1.6z" fill="#ffffff" fill-opacity=".45"/>`;
      }
    });
    areas.filter(a => ty(a) === 'andador').forEach(a => {
      const vt = a.h >= a.w, cx = a.x + a.w / 2, cy = a.y + a.h / 2;
      g += r(a.x, a.y, a.w, a.h, 'fill="#3DDC84" fill-opacity=".22"');
      g += vt ? `<line x1="${cx}" y1="${a.y}" x2="${cx}" y2="${a.y + a.h}" stroke="#3DDC84" stroke-width=".18" stroke-dasharray="1 .8"/>` : `<line x1="${a.x}" y1="${cy}" x2="${a.x + a.w}" y2="${cy}" stroke="#3DDC84" stroke-width=".18" stroke-dasharray="1 .8"/>`;
      if (Math.max(a.w, a.h) > 14) g += t(cx, cy, 1.25, 'ANDADOR PEATONAL', `fill="#3DDC84" font-weight="700" text-anchor="middle" dominant-baseline="middle" letter-spacing=".1"${vt ? ` transform="rotate(-90 ${cx} ${cy})"` : ''}`);
      // paso de cebra donde cruza un pasillo de montacargas
      areas.filter(p => ty(p) === 'pasillo').forEach(p => {
        const ix = Math.max(a.x - .6, p.x), iy = Math.max(a.y - .6, p.y), ex = Math.min(a.x + a.w + .6, p.x + p.w), ey = Math.min(a.y + a.h + .6, p.y + p.h);
        if (vt) { const yy0 = p.y, yy1 = p.y + p.h; if (a.x + a.w < p.x || a.x > p.x + p.w || a.y > yy1 || a.y + a.h < yy0 - 1) return; for (let y = yy0 + .6; y < yy1 - .3; y += 1) g += r(a.x - .6, y, a.w + 1.2, .5, 'fill="#ffffff" fill-opacity=".55"'); }
        else if (ex > ix && ey > iy) for (let x = ix + .3; x < ex; x += 1) g += r(x, iy, .5, ey - iy, 'fill="#ffffff" fill-opacity=".55"');
      });
    });
    // pasillos entre racks verticales vecinos
    const racks = areas.filter(a => ty(a) === 'rack' && a.h >= a.w).sort((a, b) => a.x - b.x);
    let pn = 0;
    racks.forEach((a, i) => {
      const b = racks[i + 1]; if (!b) return;
      const ax = a.x + a.w, aw = b.x - ax, y0 = Math.max(a.y, b.y), y1 = Math.min(a.y + a.h, b.y + b.h);
      if (aw < 2 || aw > 10 || y1 - y0 < 6) return;
      pn++;
      g += r(ax, y0, aw, y1 - y0, 'fill="#ffffff" fill-opacity=".03"');
      g += `<line x1="${ax + aw / 2}" y1="${y0 + 1}" x2="${ax + aw / 2}" y2="${y1 - 1}" stroke="#FFC22E" stroke-opacity=".5" stroke-width=".18" stroke-dasharray="1.4 1.2"/>`;
      g += t(ax + aw / 2, (y0 + y1) / 2, 1.4, 'PASILLO ' + pn, `fill="#FFC22E" fill-opacity=".7" font-weight="700" text-anchor="middle" dominant-baseline="middle" letter-spacing=".15" transform="rotate(-90 ${ax + aw / 2} ${(y0 + y1) / 2})"`);
    });

    // 2) áreas de trabajo (cada una recortada a su rectángulo)
    areas.filter(a => !PASO.includes(ty(a))).forEach(a => {
      const k = ty(a), { x, y, w, h } = a, c = a.c || (AREA_T[k] || AREA_T.generica).c;
      let d = '';
      if (k === 'rack') {
        const vt = h >= w, L = vt ? h : w, S = vt ? w : h, bays = Math.max(1, Math.floor(L / 2.7)), bl = L / bays;
        const R = (u, v, lu, lv, at) => vt ? r(x + v, y + u, lv, lu, at) : r(x + u, y + v, lu, lv, at);
        const Ln = (u, v0, v1, at) => vt ? `<line x1="${x + v0}" y1="${y + u}" x2="${x + v1}" y2="${y + u}" ${at}/>` : `<line x1="${x + u}" y1="${y + v0}" x2="${x + u}" y2="${y + v1}" ${at}/>`;
        const rows = S >= 4 ? [[.3, S / 2 - .6], [S / 2 + .3, S / 2 - .6]] : [[.2, S - .4]];
        rows.forEach(([v0, rw]) => {
          d += R(0, v0, L, rw, 'fill="#1A1A70" stroke="#3B3BA0" stroke-width=".15"');
          for (let b = 0; b < bays; b++) {
            const kk = rnd();
            if (kk > .14) { const col = kk > .8 ? '#7EE0FF' : kk > .6 ? '#B4E32F' : kk > .35 ? '#D9A066' : '#FFC22E'; d += R(b * bl + .35, v0 + .35, bl - .7, rw - .7, `rx=".25" fill="${col}" fill-opacity=".72"`); }
            d += Ln(b * bl, v0, v0 + rw, 'stroke="#FF7A45" stroke-width=".22"');
          }
          d += Ln(L, v0, v0 + rw, 'stroke="#FF7A45" stroke-width=".22"');
        });
        g += `<g clip-path="url(#${clip(a)})">${d}</g>`;
        top += y >= 4.6 ? pill(x - .4, y - 4.2, a.name, c) : pill(x + .3, y + .3, a.name, c);
        return;
      }
      g += r(x, y, w, h, `rx=".6" fill="${c}" fill-opacity=".07" stroke="${c}" stroke-opacity=".55" stroke-width=".22"`);
      if (k === 'recepcion') {
        d += `<path d="M${x + 3} ${y + 9} h9 v-4 h2 v6 h-11z" fill="#2A2A8A" stroke="${c}" stroke-width=".2"/>`;
        if (h >= 16) [x + 6, x + 9, x + 12].forEach(cx => d += `<circle cx="${cx}" cy="${y + 12.4}" r=".7" fill="#B0AEE0" fill-opacity=".6"/>`);
        for (let i = 0; i < Math.floor((w - 4) / 2.6); i++) d += r(x + 3 + i * 2.6, y + h - 3.2, 1.8, 1.4, 'rx=".4" fill="#3B3BA0"');
        d += `<circle cx="${x + w - 2.2}" cy="${y + 10}" r="1.1" fill="#3DDC84" fill-opacity=".55"/><circle cx="${x + 2.2}" cy="${y + h - 6}" r="1" fill="#3DDC84" fill-opacity=".55"/>`;
        d += t(x + w / 2, y + h - .5, 1.15, 'Control de acceso', 'fill="#B0AEE0" text-anchor="middle"');
      } else if (k === 'oficinas') {
        const mx = x + w * .55, my = y + h / 2;
        d += `<path d="M${mx} ${y} V${my - 2} M${mx} ${my + 2} V${y + h} M${x} ${my} H${mx - 4} M${mx - 1.5} ${my} H${mx}" stroke="#C9C6F5" stroke-width=".35"/>`;
        const desk = (dx, dy) => r(dx, dy, 3.2, 1.6, 'rx=".2" fill="#3B3BA0" stroke="#7B5CFA" stroke-width=".12"') + `<circle cx="${dx + 1.6}" cy="${dy + 2.4}" r=".55" fill="#B0AEE0" fill-opacity=".7"/>` + r(dx + 1.1, dy + .3, 1, .6, 'fill="#7EE0FF" fill-opacity=".7"');
        for (let dx = x + 1.5; dx + 3.2 < mx - .5; dx += 5) { d += desk(dx, y + 4.4); if (y + 8.6 + 2.6 < my) d += desk(dx, y + 8.6); d += desk(dx, my + 2.5); }
        const cx = mx + (x + w - mx) / 2;
        d += `<ellipse cx="${cx}" cy="${y + h * .3}" rx="${Math.min(3.4, (x + w - mx) / 2 - 1)}" ry="1.8" fill="#3B3BA0" stroke="#7B5CFA" stroke-width=".15"/>`;
        d += t(cx, y + h * .3 + 4.4, 1.15, 'Sala de juntas', 'fill="#B0AEE0" text-anchor="middle"');
      } else if (k === 'empaque') {
        d += r(x + 1, y + h - 4, w - 2, 2, 'fill="#2A2A8A" stroke="#FFC22E" stroke-width=".15"');
        for (let i = x + 1.5; i < x + w - 1; i += 1) d += `<line x1="${i}" y1="${y + h - 4}" x2="${i}" y2="${y + h - 2}" stroke="#FFC22E" stroke-opacity=".35" stroke-width=".12"/>`;
        [x + w * .3, x + w * .62].forEach(bx => d += r(bx, y + h - 3.7, 1.5, 1.4, 'rx=".15" fill="#D9A066"'));
        for (let px = x + 2; px + 6 < x + w - 8; px += 8) for (let py = y + 4.4; py + 4.5 < y + h - 4.5; py += 6.6) {
          d += r(px, py, 6, 3, 'rx=".3" fill="#3B3BA0" stroke="#FFC22E" stroke-opacity=".6" stroke-width=".15"');
          d += r(px + .6, py + .6, 1.6, 1.4, 'rx=".15" fill="#D9A066"') + r(px + 2.8, py + .9, 1.2, 1.1, 'rx=".15" fill="#D9A066" fill-opacity=".8"');
          d += `<circle cx="${px + 3}" cy="${py + 4.1}" r=".55" fill="#B0AEE0" fill-opacity=".7"/>`;
        }
        if (w >= 14 && h >= 20) d += `<circle cx="${x + w - 5}" cy="${y + 8}" r="3" fill="none" stroke="#7EE0FF" stroke-width=".3" stroke-dasharray=".8 .5"/><circle cx="${x + w - 5}" cy="${y + 8}" r="1.4" fill="#D9A066"/>` + t(x + w - 5, y + 12.6, 1.15, 'Emplayadora', 'fill="#B0AEE0" text-anchor="middle"');
      } else if (k === 'andenes') {
        const n = Math.max(1, Math.floor((w - 2) / 8.5));
        for (let i = 0; i < n; i++) for (let j = 0; j < Math.max(1, Math.floor((h - 9) / 4.2)); j++) { const px = x + 3 + i * 8.5, py = y + 4 + j * 4.2; d += r(px, py, 6, 3.2, 'fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width=".15" stroke-dasharray=".6 .4"'); if (rnd() > .35) d += r(px + .5, py + .5, 5, 2.2, 'rx=".2" fill="#D9A066" fill-opacity=".75"'); }
        for (let i = 0; i < n; i++) { const dx = x + 3 + i * 8.5; d += r(dx, y + h - 3.6, 6, 3.4, 'fill="url(#haz)"') + t(dx + 3, y + h - 4.3, 1.4, 'A' + (i + 1), 'fill="#FF6FB1" font-weight="800" text-anchor="middle"'); if (y + h >= H - 1.5) top += r(dx, H - 1, 6, 1, 'fill="#06062E"'); }
      } else if (k === 'montacargas') {
        d += r(x + .4, y + .4, w - .8, h - .8, 'fill="none" stroke="url(#haz)" stroke-width=".8"');
        const fork = (fx, fy) => `<g transform="translate(${fx} ${fy})">${r(0, 0, 2.6, 3.6, 'rx=".4" fill="#FF7A45"')}${r(.5, .6, 1.6, 1.4, 'rx=".2" fill="#06062E" fill-opacity=".6"')}<line x1=".6" y1="3.6" x2=".6" y2="5.4" stroke="#C9C6F5" stroke-width=".3"/><line x1="2" y1="3.6" x2="2" y2="5.4" stroke="#C9C6F5" stroke-width=".3"/></g>`;
        const spots = Math.max(1, Math.min(4, Math.floor((w - 8) / 4.6)));
        for (let i = 0; i < spots; i++) { const px = x + w - 2 - (spots - i) * 4.6; d += r(px, y + 4.4, 3.8, 7, 'fill="none" stroke="#FF7A45" stroke-opacity=".7" stroke-width=".18"'); if (i !== 2) d += fork(px + .6, y + 5); }
        if (w > 26) d += r(x + w - 4 - spots * 4.6 - 4, y + 5, 3.4, 4.6, 'rx=".3" fill="#2A2A8A" stroke="#B4E32F" stroke-width=".2"') + `<path d="M${x + w - 4 - spots * 4.6 - 2.1} ${y + 5.8} l-1 1.8 h1 l-.6 1.6 1.6-2.2 h-1 l.6-1.2z" fill="#B4E32F"/>`;
        d += `<path d="M${x + 6} ${y + h / 2 + 2} h5 l-1.2-1.2 M${x + 11} ${y + h / 2 + 2} l-1.2 1.2" stroke="#FF7A45" stroke-width=".3" fill="none"/>`;
      } else if (k === 'maquinas') {
        d += r(x, y, w, h, 'rx=".6" fill="url(#red)"');
        d += r(x + 2, y + 4.6, 6, 4, 'rx=".3" fill="#2A2A8A" stroke="#FF4D6D" stroke-width=".2"') + t(x + 5, y + 7.3, 1.1, 'Transformador', 'fill="#FFB3C1" text-anchor="middle"');
        if (w > 14) [[x + 13, y + 6.6], [x + 16.5, y + 6.6]].forEach(([cx, cy]) => d += `<circle cx="${cx}" cy="${cy}" r="1.5" fill="#2A2A8A" stroke="#FF4D6D" stroke-width=".2"/><circle cx="${cx}" cy="${cy}" r=".5" fill="#FF4D6D"/>`);
        d += r(x + w / 2 - 5.5, y + h / 2 + .6, 11, 2.4, 'rx="1.2" fill="#FF4D6D"') + t(x + w / 2, y + h / 2 + 2.3, 1.2, 'ACCESO RESTRINGIDO', 'fill="#fff" font-weight="800" text-anchor="middle"');
        d += r(x + 2, y + h - 5, 8, 3, 'rx=".3" fill="#2A2A8A" stroke="#FFC22E" stroke-width=".2"') + `<path d="M${x + 6.2} ${y + h - 4.6} l-1 1.3 h1 l-.6 1.2 1.6-1.7 h-1 l.6-.8z" fill="#FFC22E"/>`;
      } else if (k === 'comedor') {
        d += r(x + w - 4.2, y + 1.2, 3, h - 2.4, 'rx=".3" fill="#2A2A8A" stroke="#E58BFF" stroke-opacity=".7" stroke-width=".18"');
        for (let i = 0; i < Math.floor((h - 3) / 2.6); i++) d += r(x + w - 3.6, y + 2.4 + i * 2.6, 1.8, 1.3, 'rx=".2" fill="#C9C6F5" fill-opacity=".55"');
        for (let cy = y + 5.2; cy < y + h - 2; cy += 5) for (let cx = x + 4; cx < x + w - 7; cx += 5.5) {
          if (cy < y + 5.5 && cx < x + 12) continue;
          d += `<circle cx="${cx}" cy="${cy}" r="1.4" fill="#3B3BA0" stroke="#E58BFF" stroke-opacity=".6" stroke-width=".15"/>`;
          [[0, -2], [1.9, 0], [0, 2], [-1.9, 0]].forEach(([dx, dy]) => d += `<circle cx="${cx + dx}" cy="${cy + dy}" r=".45" fill="#B0AEE0" fill-opacity=".65"/>`);
        }
      } else if (k === 'almacen') {
        for (let px = x + 1.5; px + 2.4 < x + w - 1; px += 3.4) for (let py = y + 4.4; py + 2.4 < y + h - 1; py += 3.4) if (rnd() > .25) d += r(px, py, 2.4, 2.4, `rx=".2" fill="${rnd() > .5 ? '#D9A066' : '#C8955A'}" fill-opacity=".8"`);
      }
      g += `<g clip-path="url(#${clip(a)})">${d}</g>`;
      if (w >= 9 && h >= 4) top += pill(x + .6, y + .6, a.name, c); else top += t(x + w / 2, y + h / 2 + .5, 1.3, a.name, 'fill="#F4F3FF" font-weight="700" text-anchor="middle"');
    });

    // 3) muros, entradas y salidas de emergencia
    g += r(.4, .4, W - .8, H - .8, 'fill="none" stroke="#D8D5FF" stroke-width=".8"');
    areas.filter(a => ty(a) === 'entrada' || ty(a) === 'salida').forEach(a => {
      const ex = ty(a) === 'entrada', col = ex ? '#B4E32F' : '#3DDC84', dark = ex ? '#5E7F10' : '#0C7A3A', lbl = ex ? 'ENTRADA' : 'SALIDA';
      top += r(a.x, a.y, a.w, a.h, 'fill="#14146A"') + r(a.x, a.y, a.w, a.h, `fill="${col}" fill-opacity=".85"`);
      const cx = a.x + a.w / 2, cy = a.y + a.h / 2, bw = lbl.length * .95 + 1.6;
      const lx = Math.max(bw / 2 + .5, Math.min(W - bw / 2 - .5, a.x <= 1 ? cx + bw / 2 + .8 : a.x + a.w >= W - 1 ? cx - bw / 2 - .8 : cx));
      const ly = Math.max(1.4, Math.min(H - 1.4, a.y <= 1 ? cy + 1.8 : a.y + a.h >= H - 1 ? cy - 1.8 : cy));
      top += `<g transform="translate(${lx} ${ly})">${r(-bw / 2, -.9, bw, 1.8, `rx=".3" fill="${dark}"`)}${t(0, .45, 1.15, lbl, 'fill="#fff" font-weight="800" text-anchor="middle"')}</g>`;
    });
    // extintores cada ~25 m sobre los muros
    for (let x = 12; x < W - 4; x += 25) top += `<circle cx="${x}" cy="1.3" r=".75" fill="#FF4D6D" stroke="#fff" stroke-width=".18"/><circle cx="${x + 12}" cy="${H - 1.3}" r=".75" fill="#FF4D6D" stroke="#fff" stroke-width=".18"/>`;
    for (let y = 12; y < H - 4; y += 22) top += `<circle cx="1.3" cy="${y}" r=".75" fill="#FF4D6D" stroke="#fff" stroke-width=".18"/><circle cx="${W - 1.3}" cy="${y + 8}" r=".75" fill="#FF4D6D" stroke="#fff" stroke-width=".18"/>`;
    defs = `<defs>
      <pattern id="floor" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#12125E"/><circle cx=".5" cy=".6" r=".07" fill="#ffffff" fill-opacity=".06"/><circle cx="1.5" cy="1.4" r=".05" fill="#ffffff" fill-opacity=".05"/></pattern>
      <pattern id="haz" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.2" height="1.2" fill="#FFC22E"/><rect width=".6" height="1.2" fill="#06062E"/></pattern>
      <pattern id="red" width="1.4" height="1.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.4" height="1.4" fill="#FF4D6D" fill-opacity=".06"/><rect width=".25" height="1.4" fill="#FF4D6D" fill-opacity=".22"/></pattern>${defs}
    </defs>`;
    const px = Math.max(8, Math.min(16, 2000 / Math.max(W, H)));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${Math.round(W * px)}" height="${Math.round(H * px)}">${defs}${g}${top}</svg>`;
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

  // ---------- unidades (transporte): destino, ruta programada y seguimiento ----------
  // La mesa de control asigna un destino y se traza la ruta programada. Si el recorrido real se separa
  // 1 km o más de esa ruta, se avisa a la mesa de control para que le dé seguimiento. No hay carga
  // ni autorizaciones: solo ubicación, trazabilidad y aviso de desvío.
  const DESV_KM = 1, DESV = DESV_KM / SCALE.outdoor.km;   // 1 km en unidades de mapa
  const pt = P => [+(+P.x).toFixed(2), +(+P.y).toFixed(2)];
  function segD(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const k = L2 ? Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / L2)) : 0;
    return Math.hypot(p.x - a[0] - k * dx, p.y - a[1] - k * dy);
  }
  // qué tan lejos va la unidad de su ruta programada (unidades de mapa)
  function offRoute(p, path) { let m = Infinity; for (let i = 1; i < path.length; i++) m = Math.min(m, segD(p, path[i - 1], path[i])); return m; }
  // demo: la unidad se sale de su ruta programada
  function simDesvio(s, tripId) {
    const tr = s.trips.find(x => x.id === tripId), p = tr && s.ops.find(x => x.id === tr.opId); if (!p || tr.status !== 'enruta') return;
    const n = tr.path[tr.seg + 1] || tr.path[tr.path.length - 1], dx = n[0] - p.x, dy = n[1] - p.y, L = Math.hypot(dx, dy) || 1;
    tr.detour = true; tr.detourPt = [+(p.x + dx * .3 + dy / L * DESV * 1.7).toFixed(2), +(p.y + dy * .3 - dx / L * DESV * 1.7).toFixed(2)];
    p.target = { x: tr.detourPt[0], y: tr.detourPt[1] };
  }
  // tramos en "L" entre los puntos de paso, como cuadras de la ciudad
  function streetPath(pts, yFirst) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = out[out.length - 1], b = pts[i];
      if (Math.abs(a[0] - b[0]) > .3 && Math.abs(a[1] - b[1]) > .3) out.push(yFirst ? [a[0], b[1]] : [b[0], a[1]]);
      out.push(b);
    }
    return out;
  }
  function routeBetween(a, b) {
    const j = [+(a[0] + (b[0] - a[0]) * .45).toFixed(2), +(a[1] + (b[1] - a[1]) * .55).toFixed(2)];
    return streetPath([a, j, b]);
  }
  function pathLen(path) { let d = 0; for (let i = 1; i < path.length; i++) d += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); return d; }
  const activeTrip = (s, opId) => (s.trips || []).find(x => x.opId === opId && x.status === 'enruta');
  function mkTrip(s, o) {
    s.trips = s.trips || [];
    const tr = Object.assign({ id: uid('vj'), folio: 'VJ-' + (s.tripFolio = (s.tripFolio || 300) + 1), status: 'enruta', seg: 0, start: now(), loop: false }, o);
    tr.orig = tr.orig || tr.path;
    s.trips.push(tr);
    const p = s.ops.find(x => x.id === tr.opId);
    if (p) { p.status = 'encamino'; p.target = null; }
    event(s, tr.opId, 'Unidad ' + tr.unit + ' salió de ' + tr.from + ' rumbo a ' + tr.to, 'ruta');
    return tr;
  }
  // en cada ciclo: avanzar por el recorrido y registrar la llegada
  function tripTick(s, p, tr, t) {
    const n = tr.path[tr.seg + 1];
    if (tr.detour && tr.detourPt) { if (Math.hypot(p.x - tr.detourPt[0], p.y - tr.detourPt[1]) < 1.05) { tr.detour = false; tr.detourPt = null; p.target = null; } }
    else if (n && Math.hypot(p.x - n[0], p.y - n[1]) < 1.05) { tr.seg++; p.target = null; }
    if (tr.seg >= tr.path.length - 1) {
      tr.status = 'entregado'; tr.done = t; tr.off = false; p.target = null; if (p.status === 'encamino') p.status = 'disponible';
      event(s, p.id, 'Unidad ' + tr.unit + ' llegó a ' + tr.to, 'ruta');
      return;
    }
    // GPS real fuera de la ciudad del demo (p. ej. probando desde otro país): no se evalúa la ruta
    if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) return;
    const d = offRoute(p, tr.path);
    tr.dev = +d.toFixed(2);
    if (d >= DESV && !tr.off) {
      // aviso a la mesa de control para que le dé seguimiento
      tr.off = true; tr.offAt = t; tr.offs = (tr.offs || 0) + 1;
      alert(s, 'desvio', p.id, 'Unidad ' + tr.unit + ' a ' + (d * SCALE.outdoor.km).toFixed(1) + ' km de su ruta programada a ' + tr.to + '. Dar seguimiento.', { ref: tr.id + ':' + t, trip: tr.id });
      event(s, p.id, 'Unidad ' + tr.unit + ' se separó ' + (d * SCALE.outdoor.km).toFixed(1) + ' km de su ruta', 'ruta');
    } else if (tr.off && d < DESV * .7) { tr.off = false; event(s, p.id, 'Unidad ' + tr.unit + ' regresó a su ruta', 'ruta'); }
  }

  // ---------- acceso por usuario con código (sin contraseñas) ----------
  // Solo entran clientes de Navi. Cada usuario pertenece a UNA empresa: al entrar ve sus datos y
  // no puede cambiarse a otra empresa sin salir. Entra con su usuario, correo o celular y recibe un
  // código de 6 dígitos por correo o por SMS, como prefiera. En producción el código lo genera,
  // envía y valida el servidor; aquí se muestra en pantalla para la demo.
  const USERS = [
    // admin: true = administrador de la consola; false = monitorista de la mesa de control
    // correos en example.com (dominio reservado para ejemplos) y celulares ficticios
    { user: 'prosegur.seguridad', email: 'ricardo.salas@example.com',   phone: '5590000101', name: 'Ricardo Salas',  role: 'Gerente de operaciones',   client: 'seguridad',  admin: true },
    { user: 'dhl.transporte',     email: 'laura.benitez@example.com',   phone: '5590000201', name: 'Laura Benítez',  role: 'Jefa de tráfico',          client: 'transporte', admin: true },
    { user: 'dhl.mesa',           email: 'oscar.ruiz@example.com',      phone: '5590000202', name: 'Óscar Ruiz',     role: 'Monitorista · mesa de control', client: 'transporte', admin: false },
    { user: 'amazon.almacen',     email: 'jorge.medina@example.com',    phone: '5590000301', name: 'Jorge Medina',   role: 'Gerente de CEDIS',         client: 'operativa',  admin: true },
    { user: 'mercadolibre.mixta', email: 'patricia.ochoa@example.com',  phone: '5590000401', name: 'Patricia Ochoa', role: 'Directora de operaciones', client: 'mixta',      admin: true }
  ];
  const CKEY = 'navi.mando.codigo', CODE_TTL = 10 * MIN;
  const maskMail = e => e.replace(/^(.{2})[^@]*(@.*)$/, '$1•••••$2');
  const maskPhone = p => '+52 •• •••• ' + p.slice(-4);
  const OP_PIN = '1234';  // demo: todos los operadores entran con este PIN
  const SKEY = 'navi.mando.sesion', OKEY = 'navi.mando.app.sesion';
  const rd = k => { try { return JSON.parse(sessionStorage.getItem(k) || localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const wr = (k, v, keep) => { try { sessionStorage.removeItem(k); localStorage.removeItem(k); if (v) (keep ? localStorage : sessionStorage).setItem(k, JSON.stringify(v)); } catch (e) {} };
  // datos de una empresa sin cambiar la empresa activa ni avisar a la pantalla
  const peek = cid => { let st = null; try { st = JSON.parse(localStorage.getItem(KEY + ':' + cid) || 'null'); } catch (e) {} return st && st.v === V ? st : seedFor(cid); };
  const Auth = {
    USERS, OP_PIN,
    demoOps(cid) { return peek(cid).ops; },
    // consola: busca al usuario por usuario, correo o celular
    find(id) {
      const s = String(id || '').trim().toLowerCase(), d = s.replace(/\D/g, '').slice(-10);
      return USERS.find(x => x.user === s || x.email === s || (d.length === 10 && x.phone === d)) || null;
    },
    // a dónde puede llegar su código (enmascarado para no exponer el dato completo)
    channels(id) { const u = this.find(id); return u ? { email: maskMail(u.email), sms: maskPhone(u.phone) } : null; },
    // genera el código y lo "envía" por el medio que eligió el usuario: 'email' o 'sms'
    sendCode(id, via) {
      const u = this.find(id); if (!u || !['email', 'sms'].includes(via)) return null;
      const code = String(100000 + Math.floor(Math.random() * 900000));
      try { sessionStorage.setItem(CKEY, JSON.stringify({ u: u.user, code, via, at: now() })); } catch (e) {}
      return { code, via, to: via === 'email' ? maskMail(u.email) : maskPhone(u.phone) };
    },
    // revisa el código; si es correcto abre la sesión
    verify(id, code, keep) {
      const u = this.find(id); let p = null;
      try { p = JSON.parse(sessionStorage.getItem(CKEY) || 'null'); } catch (e) {}
      if (!u || !p || p.u !== u.user) return { err: 'Pide un código nuevo.' };
      if (now() - p.at > CODE_TTL) return { err: 'El código venció (dura 10 minutos). Pide uno nuevo.' };
      if (String(code) !== p.code) return { err: 'Ese código no coincide. Revisa tu ' + (p.via === 'email' ? 'correo' : 'SMS') + '.' };
      try { sessionStorage.removeItem(CKEY); } catch (e) {}
      return { ok: this.login(u.user, keep) };
    },
    // abre la sesión (se llama después de validar el código)
    login(user, keep) {
      const u = this.find(user);
      if (!u) return null;
      const s = { kind: 'consola', user: u.user, name: u.name, role: u.role, client: u.client, admin: !!u.admin, at: now() };
      wr(SKEY, s, keep); return s;
    },
    // el permiso de administrador sale de la lista de usuarios, no de lo guardado en el navegador
    current() { const s = rd(SKEY), u = s && USERS.find(x => x.user === s.user); if (!s || !u || !CLIENTS[s.client]) return null; s.admin = !!u.admin; s.role = u.role; return s; },
    admins(cid) { return USERS.filter(u => u.client === cid && u.admin).map(u => u.name); },
    logout() { wr(SKEY, null); },
    // app del operador: código de empresa + celular + PIN
    loginOp(code, phone, pin) {
      const cid = Object.keys(CLIENTS).find(k => CLIENTS[k].code === String(code || '').trim().toUpperCase());
      if (!cid) return { err: 'Ese código no corresponde a ninguna empresa cliente de Navi.' };
      const st = peek(cid);
      const num = String(phone || '').replace(/\D/g, '').slice(-10);
      const p = st.ops.find(x => x.phone === num);
      if (!p) return { err: 'Ese celular no está registrado en ' + CLIENTS[cid].name.split(',')[0] + '.' };
      if (String(pin || '') !== OP_PIN) return { err: 'PIN incorrecto.' };
      const s = { kind: 'operador', client: cid, opId: p.id, name: p.name, at: now() };
      wr(OKEY, s, true); return { ok: s };
    },
    currentOp() { const s = rd(OKEY); return s && CLIENTS[s.client] ? s : null; },
    logoutOp() { wr(OKEY, null); },
    // el manual de procesos es solo para clientes con sesión (consola u operador)
    any() { return this.current() || this.currentOp(); }
  };

  window.Mando = { Auth, SOS_KINDS, sos, KEY, STATUS, ORDER_ST, ALERT_T, PLACES, SCALE, BOX, toLL, fromLL, load, save, update, on, tick, nearest, advance, event, alert, orderHist, uid, dist, km, fmtD, eta, site, scale, areaAt, members, forMe, planSVG, fmtT, ago, esc, Ptt, beep, MIN,
    AREA_T, aType, isWork, CLIENTS,
    routeBetween, mkTrip, activeTrip, pathLen, pt, offRoute, simDesvio, DESV_KM,
    useClient(cid) { CID = CLIENTS[cid] ? cid : 'mixta'; return CID; },
    client() { return CID; },
    clientByCode(code) { return Object.keys(CLIENTS).find(k => CLIENTS[k].code === String(code || '').trim().toUpperCase()); },
    hbKey() { return 'navi.mando.hb:' + CID; },
    reset() { DATA.removeItem(keyOf()); return load(); },
    // para el servidor y para sync.js: versión de datos, datos iniciales de cada empresa y acceso a la copia local
    V, _seed: seedFor,
    _sync: {
      onSave(fn) { saveHooks.push(fn); },
      useSession() { DATA = sessionStorage; },
      read() { try { return JSON.parse(DATA.getItem(keyOf()) || 'null'); } catch (e) { return null; } },
      write(s) { try { DATA.setItem(keyOf(), JSON.stringify(s)); } catch (e) {} },
      emit(s) { subs.forEach(f => f(s, false)); }
    } };
})();
