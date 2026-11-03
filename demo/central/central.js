// Navi Central: consola interna de Navi Móvil.
//  · ERP: clientes, servicio, pedidos, recargas y portabilidades en un solo lugar
//  · Front desk: conversaciones de chat web, app, WhatsApp y Empresas con el asistente y los asesores,
//    separadas en personas (B2C, Navi Móvil) y empresas (B2B, NAVICom)
//  · Empresas B2B: embudo de oportunidades que llegan del formulario y del chat de la página Empresas
//  · Proactivo: reglas que detectan a quién hay que buscar antes de que nos busque
//  · Privacidad: datos enmascarados por defecto; ver un dato completo pide motivo y queda en auditoría
// DEMO: lee los datos de este navegador y suma una cartera de ejemplo (clientes ficticios).
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = t => { const e = $('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(e.t); e.t = setTimeout(() => e.classList.remove('show'), 2600); };
const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? 'ahora' : s < 3600 ? `hace ${Math.floor(s / 60)} min` : s < 86400 ? `hace ${Math.floor(s / 3600)} h` : `hace ${Math.floor(s / 86400)} d`; };
const hhmm = t => new Date(t).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
const img = src => src.startsWith('data:') ? src : '../' + src;

// ---------- quién usa la consola (DEMO: sin contraseña; en producción, acceso con cuenta corporativa y 2 pasos) ----------
const ROLES = {
  asesor: { n: 'Asesor', can: { reveal: ['phone', 'mail'], export: false, audit: false } },
  supervisor: { n: 'Supervisor', can: { reveal: ['phone', 'mail', 'imei'], export: true, audit: true } },
  admin: { n: 'Administrador', can: { reveal: ['phone', 'mail', 'imei'], export: true, audit: true } },
};
let staff = (() => { try { return JSON.parse(sessionStorage.getItem('central.staff')); } catch { return null; } })();
const can = (k, v) => v ? ROLES[staff.role].can[k].includes(v) : ROLES[staff.role].can[k];

// ---------- cartera de ejemplo (personas ficticias) para ver la consola con volumen ----------
const rnd = (() => { let s = 20261101; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; })();
const pick = a => a[Math.floor(rnd() * a.length)];
const NOMBRES = ['Ana', 'Carlos', 'María', 'José', 'Fernanda', 'Jorge', 'Lucía', 'Miguel', 'Paola', 'Ricardo', 'Daniela', 'Alejandro', 'Gabriela', 'Luis', 'Sofía', 'Diego', 'Valeria', 'Juan', 'Andrea', 'Héctor', 'Karla', 'Raúl', 'Mónica', 'Óscar', 'Elena', 'Iván', 'Patricia', 'Arturo', 'Rocío', 'Emilio'];
const APELLIDOS = ['García', 'Hernández', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez', 'Cruz', 'Flores', 'Gómez', 'Morales', 'Vázquez', 'Reyes', 'Jiménez', 'Torres', 'Díaz', 'Ruiz', 'Mendoza'];
const SYNTH = Array.from({ length: 42 }, (_, i) => {
  const gb = pick([2, 4, 4, 12, 12, 12, 24, 24]), per = gb <= 4 ? 'm' : pick(['m', 'm', 't', 's', 'a']);
  const fam = gb === 12 && rnd() < .3, lines = fam ? 2 + Math.floor(rnd() * 3) : 1;
  const usedP = rnd(), total = gb, left = +(total * (1 - usedP)).toFixed(1);
  const renewDays = 1 + Math.floor(rnd() * (per === 'm' ? 30 : 80));
  const porta = rnd() < .35 ? { from: pick(PORTA_FROM), month: 1 + Math.floor(rnd() * 12), status: pick(['completada', 'completada', 'completada', 'en proceso', 'rechazada']) } : null;
  const name = `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`;
  const phone = '55' + String(91000000 + Math.floor(rnd() * 8999999));
  return {
    id: 'S' + i, synth: true, phone, name, client: 'NV-' + refCode(phone).slice(2), gb, per, fam, lines, total, left, pct: left / total, renewDays,
    renew: new Date(Date.now() + renewDays * 864e5), porta, pay: rnd() < .1 ? pick(['rechazado', 'pendiente']) : null,
    csat: rnd() < .25 ? 1 + Math.floor(rnd() * 5) : null, sosOff: (gb >= 12 || fam) && rnd() < .4, mail: name.split(' ')[0].toLowerCase() + '.' + phone.slice(-3) + '@correo.mx',
    imei: '35' + String(Math.floor(rnd() * 1e13)).padStart(13, '0'), device: pick(['Samsung Galaxy A15', 'iPhone 13', 'Motorola Moto G24', 'Xiaomi Redmi 13C', 'iPhone 15', 'Samsung Galaxy S23']),
    since: new Date(Date.now() - (30 + Math.floor(rnd() * 600)) * 864e5), price: fam ? quote({ gb, per, lines }).total : PLANS.find(p => p.gb === gb).prices[per] || PLANS.find(p => p.gb === gb).prices.m,
    status: rnd() < .06 ? 'suspendida' : 'activa',
  };
});
// clientes reales del demo (las cuentas de Mi Navi), con los mismos datos que ven en su app
const REAL = () => Object.keys(NAVI_ACCOUNTS).flatMap(k => { const a = NaviAuth.find(k); return accountLines(a).map(l => l.phone); })
  .map(ph => { const f = custFacts(ph), pr = Profiles.get(ph); return {
    id: ph, synth: false, phone: ph, name: f.name, client: f.client, gb: f.gb, per: f.period, fam: f.fam, lines: f.fam ? f.acc.plan.lines.length : 1, total: f.total, left: f.left, pct: f.pctLeft,
    renewDays: f.daysToRenew, renew: f.renew, porta: f.porta ? { from: f.porta.from, month: f.giftMonth, status: 'completada' } : null,
    pay: f.orders.some(o => o.status === 'rechazado') ? 'rechazado' : f.orders.some(o => o.status === 'pendiente') || f.topups.some(t => t.status === 'pendiente') ? 'pendiente' : null,
    csat: Desk.all().filter(c => c.phone === ph && c.csat).map(c => c.csat).pop() || null, sosOff: f.apps.includes('sos') && !localStorage.getItem('navi.sos.' + f.acc.owner),
    mail: pr.mail || null, imei: f.device.imei, device: `${f.device.brand === 'Apple' ? '' : f.device.brand + ' '}${f.device.model}`, since: new Date(f.since), price: f.price, status: 'activa', facts: f, img: f.line.img,
  }; });
const customers = () => [...REAL(), ...SYNTH];
const custById = id => customers().find(c => c.id === id || c.phone === id);
const planTxt = c => c.fam ? `Familia · ${c.lines} × ${c.gb} GB` : `${c.gb} GB`;

// ---------- conversaciones de ejemplo (una sola vez) ----------
(() => {
  if (localStorage.getItem('navi.desk.seeded')) return;
  const mk = (channel, cust, msgs, patch = {}) => {
    const c = Desk.open(channel, cust.phone, cust.name);
    msgs.forEach(([from, txt, minAgo]) => { Desk.push(c.id, { from, txt }); const d = JSON.parse(localStorage.getItem(Desk.KEY)); const cc = d.convs.find(x => x.id === c.id); cc.msgs[cc.msgs.length - 1].t = Date.now() - minAgo * 6e4; cc.updated = Date.now() - minAgo * 6e4; cc.created = Math.min(cc.created, cc.updated); localStorage.setItem(Desk.KEY, JSON.stringify(d)); });
    Desk.set(c.id, { ...patch, seed: true });
    const d = JSON.parse(localStorage.getItem(Desk.KEY)); const cc = d.convs.find(x => x.id === c.id); cc.updated = cc.msgs[cc.msgs.length - 1].t; localStorage.setItem(Desk.KEY, JSON.stringify(d));
  };
  const s = SYNTH;
  mk('whatsapp', s[3], [['customer', 'Hola, me cobraron dos veces la recarga de ayer', 14], ['bot', 'Aceptamos tarjeta, transferencia y efectivo en tiendas. ¿Tienes algún cobro que revisar? Escribe *asesor*.', 14], ['customer', 'asesor', 12], ['bot', 'Te comunico con un asesor de Navi 🙋. Te responde en unos minutos y verá toda esta conversación.', 12]], { status: 'waiting', tags: ['cobros'], unread: 2 });
  mk('web', s[7], [['customer', '¿Cuánto tarda la portabilidad?', 45], ['bot', 'Traer tu número es gratis: 1) marca *051*… Si vienes de Telcel, AT&T, Movistar, Unefon o Virgin Mobile te regalamos GB cada mes por 12 meses 🎁', 45], ['customer', 'gracias', 44], ['bot', '¡Con gusto! 😊 ¿Cómo calificarías la atención del 1 al 5?', 44], ['customer', '5', 43], ['bot', '¡Gracias por tu calificación! 💚', 43]], { status: 'closed', csat: 5 });
  mk('whatsapp', s[11], [['customer', 'No tengo señal desde la mañana en Ecatepec', 95], ['bot', 'Usamos la Red Compartida de Altán (4.5G LTE)… si sigue igual escribe *asesor* y abrimos un reporte.', 95], ['customer', 'asesor', 93], ['agent', 'Hola, soy Marco de Navi. Ya levanté el reporte T-104233 con la red; te aviso en cuanto quede.', 80]], { status: 'agent', agent: 'Marco R.', tags: ['red'] });
  mk('app', s[15], [['customer', 'quiero cancelar', 6], ['bot', 'Lamento que lo estés pensando 😕. Te comunico con un asesor para revisar tu caso.', 6]], { status: 'waiting', tags: ['retención'], unread: 1 });
  mk('whatsapp', s[20], [['customer', 'Hola', 200], ['bot', '¡Hola! 👋 Soy el asistente de Navi Móvil…', 200], ['customer', 'mi saldo', 199], ['bot', 'Para darte datos de tu línea necesito saber quién eres…', 199]], { status: 'bot' });
  localStorage.setItem('navi.desk.seeded', '1');
})();

// ---------- empresas (B2B, NAVICom): oportunidades de ejemplo, una sola vez ----------
const STAGES = [['nuevo', 'Nuevo', '#FF6FB1'], ['contactado', 'Contactado', '#7EE0FF'], ['propuesta', 'Propuesta enviada', '#FFC22E'], ['negociacion', 'Negociación', '#A893FF'], ['ganado', 'Ganado', '#2BD67B'], ['perdido', 'Perdido', '#8A88B8']];
const STAGE = Object.fromEntries(STAGES.map(([k, n, c]) => [k, { n, c }]));
const LINE_PRICE = PLANS.find(p => p.gb === 12).prices.m; // valor estimado por línea al mes
const leadValue = l => (l.lines || 0) * LINE_PRICE;
const SRC = { 'Formulario web': '📝', 'Chat Empresas': '🏢', 'Chat web': '💬', WhatsApp: '🟢', Referido: '🤝' };
(() => {
  if (localStorage.getItem('navi.desk.seeded.b2b')) return;
  const ex = [
    ['Transportes del Bajío', 'Laura Méndez', 60, ['Rastreo (Track)', 'Líneas móviles'], 'Chat Empresas', 'nuevo', 25, '60 unidades de carga, queremos rastreo y líneas para choferes'],
    ['Colegio Monteverde', 'Prof. Ricardo Salas', 35, ['Seguridad (SOS / Safe City)'], 'Formulario web', 'nuevo', 140, 'Relojes con SIM para alumnos de primaria y geocercas del colegio'],
    ['Seguridad Privada Centinela', 'Mario Ortega', 120, ['PTT', 'Equipos y cobertura'], 'Formulario web', 'contactado', 60 * 26, 'Radios PTT para guardias en 3 turnos'],
    ['Farmacias Vida Plena', 'Claudia Ríos', 18, ['Internet para negocio'], 'Referido', 'propuesta', 60 * 70, 'Internet para 18 sucursales'],
    ['Constructora Ribera', 'Ing. Pablo Núñez', 45, ['Líneas móviles', 'Equipos y cobertura'], 'Chat web', 'negociacion', 60 * 24 * 4, 'Líneas y equipos de uso rudo para obra'],
    ['Agua Clara Municipal', 'Lic. Sandra Paz', 400, ['IoT / LoRaWAN'], 'Formulario web', 'propuesta', 60 * 24 * 6, 'Medidores de agua conectados'],
    ['Logística Express Norte', 'Raúl Cantú', 25, ['Rastreo (Track)'], 'WhatsApp', 'ganado', 60 * 24 * 12, 'Rastreo de 25 camionetas de reparto'],
    ['Clínica San Rafael', 'Dra. Elena Ruiz', 12, ['Líneas móviles'], 'Formulario web', 'perdido', 60 * 24 * 20, 'Líneas para médicos de guardia'],
  ];
  const d = JSON.parse(localStorage.getItem(Desk.KEY) || '{}'); d.leads = d.leads || [];
  ex.forEach(([company, contact, lines, interest, source, stage, minAgo, msg], i) => {
    const t = Date.now() - minAgo * 6e4;
    d.leads.push({ id: 'L-' + (204810 + i * 7), t, updated: t, synth: true, company, contact, lines, interest, source, stage, msg, owner: stage === 'nuevo' ? null : pick(['Marco R.', 'Ana López', 'Sofía T.']), notes: [],
      mail: contact.replace(/^(Prof|Ing|Lic|Dra)\.\s/, '').split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + '@' + company.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '').slice(0, 14) + '.mx' });
  });
  localStorage.setItem(Desk.KEY, JSON.stringify(d));
  // una conversación de empresa en el chat, esperando ejecutivo
  const c = Desk.open('empresas', null, 'Laura Méndez · Transportes del Bajío');
  [['bot', '¡Hola! 👋 Soy el asistente de NAVICom…', 27], ['customer', 'Tenemos 60 unidades de carga, queremos rastreo y líneas para choferes', 26], ['bot', '*Rastreo (Track)*: rastreo de unidades y personal en tiempo real… ¿Te armamos una propuesta?', 26], ['customer', 'propuesta', 25], ['bot', '¡Listo, Laura! ✅ Registré tu requerimiento para *Transportes del Bajío* (60 líneas/equipos). Un ejecutivo de NAVICom te escribe aquí.', 25]]
    .forEach(([from, txt]) => Desk.push(c.id, { from, txt }));
  Desk.set(c.id, { status: 'waiting', tags: ['venta'], unread: 2, seed: true, lead: { company: 'Transportes del Bajío', contact: 'Laura Méndez', lines: 60, interest: ['Rastreo (Track)', 'Líneas móviles'] } });
  const d2 = JSON.parse(localStorage.getItem(Desk.KEY)); const cc = d2.convs.find(x => x.id === c.id);
  cc.msgs.forEach((m, i) => m.t = Date.now() - [27, 26, 26, 25, 25][i] * 6e4); cc.updated = cc.created = Date.now() - 25 * 6e4;
  const ld = d2.leads.find(l => l.company === 'Transportes del Bajío'); if (ld) ld.conv = c.id;
  localStorage.setItem(Desk.KEY, JSON.stringify(d2));
  localStorage.setItem('navi.desk.seeded.b2b', '1');
})();
const segOf = c => c.seg || 'b2c';
const openLeads = () => Desk.leads().filter(l => !['ganado', 'perdido'].includes(l.stage));

// ---------- reglas proactivas ----------
const RULES = [
  { id: 'datos', ic: '📶', color: '#7EE0FF', n: 'Se están quedando sin datos', d: 'Les queda menos del 20% de su plan.', test: c => c.pct < .2 && c.status === 'activa',
    tpl: c => `Hola ${c.name.split(' ')[0]} 👋, te quedan ${c.left} GB de tu plan Navi. Para que no te quedes sin internet, recarga en dos toques: https://www.navimovil.com/demo/recargas.html` },
  { id: 'renueva', ic: '📅', color: '#B4E32F', n: 'Renuevan en 3 días o menos', d: 'Recordatorio amable antes de la fecha de pago.', test: c => c.renewDays <= 3,
    tpl: c => `Hola ${c.name.split(' ')[0]}, tu plan Navi ${planTxt(c)} se renueva el ${fmtDay(c.renew)}${c.price ? ` por ${mxn(c.price)}` : ''}. Si quieres cambiar de plan o forma de pago, aquí estamos 🙌` },
  { id: 'pago', ic: '💳', color: '#FF6F8E', n: 'Pago rechazado o pendiente', d: 'Ayudarles a completar el pago antes de que se suspenda.', test: c => !!c.pay,
    tpl: c => `Hola ${c.name.split(' ')[0]}, vimos que tu pago quedó ${c.pay}. ¿Te ayudamos a completarlo? Puedes intentar con otra tarjeta, transferencia o efectivo.` },
  { id: 'porta', ic: '🔁', color: '#FFC22E', n: 'Portabilidad detenida', d: 'Rechazada (casi siempre NIP vencido) o en proceso.', test: c => c.porta && c.porta.status !== 'completada',
    tpl: c => c.porta.status === 'rechazada' ? `Hola ${c.name.split(' ')[0]}, tu portabilidad desde ${c.porta.from} no pasó porque el NIP venció. Marca 051 para pedir uno nuevo y compártelo en https://www.navimovil.com/demo/portabilidad.html 🙌` : `Hola ${c.name.split(' ')[0]}, tu portabilidad desde ${c.porta.from} va en proceso. Tu línea anterior sigue funcionando mientras tanto.` },
  { id: 'regalo', ic: '🎁', color: '#FF9A6B', n: 'Su regalo de bienvenida está por terminar', d: 'Van en el regalo 11 o 12 de 12: momento de retención.', test: c => c.porta && c.porta.status === 'completada' && c.porta.month >= 11,
    tpl: c => `Hola ${c.name.split(' ')[0]} 🎁, tu regalo de bienvenida termina pronto. Gracias por este año con Navi: tenemos una oferta para que sigas con más GB. ¿Te la comparto?` },
  { id: 'sos', ic: '🚨', color: '#FF6FB1', n: 'Tienen NAVI SOS y no lo han activado', d: 'Incluido en su plan, pero sin red familiar.', test: c => c.sosOff,
    tpl: c => `Hola ${c.name.split(' ')[0]}, tu plan incluye NAVI SOS Family: ubicación en tiempo real y botón SOS para tu familia. Actívalo en 1 minuto: https://www.navimovil.com/demo/sos.html` },
  { id: 'csat', ic: '⭐', color: '#A893FF', n: 'Calificaron mal la atención', d: 'Calificación de 1 o 2: un supervisor les llama.', test: c => c.csat && c.csat <= 2,
    tpl: c => `Hola ${c.name.split(' ')[0]}, soy de Navi. Vimos que tu última atención no fue buena y queremos resolverlo. ¿Nos cuentas qué pasó?` },
];
const alerts = () => { const done = Desk.done(); return RULES.flatMap(r => customers().filter(r.test).map(c => ({ r, c, key: r.id + ':' + c.id }))).filter(a => !done[a.key]); };
// a quién le escribe Navi primero: por WhatsApp, y queda en el historial del cliente
function sendProactive(c, txt, ruleId) {
  const cv = Desk.open('whatsapp', c.phone, c.name);
  Desk.push(cv.id, { from: 'agent', agent: staff.name, txt, proactive: true });
  if (cv.status === 'bot') Desk.set(cv.id, { status: 'agent', agent: staff.name });
  if (ruleId) Desk.markDone(ruleId + ':' + c.id, staff.name);
}

// ---------- privacidad: ver un dato completo ----------
const revealed = new Set();
const REASONS = ['El cliente lo pidió en la conversación', 'Validar identidad del cliente', 'Resolver un problema técnico', 'Requerimiento legal o de autoridad'];
function maskedVal(c, field) {
  const key = c.id + ':' + field, raw = { phone: c.phone ? fmtPhone(c.phone) : '—', mail: c.mail || '—', imei: c.imei ? fmtImei(c.imei) : '—' }[field];
  if (revealed.has(key)) return `${esc(raw)}`;
  const m = { phone: Mask.phone(c.phone), mail: Mask.mail(c.mail), imei: Mask.imei(c.imei) }[field];
  return `${esc(m)}${can('reveal', field) && raw !== '—' ? `<a class="rv" data-reveal="${c.id}|${field}">Ver</a>` : ''}`;
}
function askReveal(id, field, after) {
  const c = custById(id), label = { phone: 'número', mail: 'correo', imei: 'IMEI' }[field];
  $('ov').hidden = false;
  $('ov').innerHTML = `<div><h3>Ver ${label} completo</h3><p class="muted">Queda registrado en la auditoría con tu nombre, la hora y el motivo. Úsalo solo si lo necesitas para atender al cliente.</p>
    <label>Motivo<select class="inp" id="why">${REASONS.map(r => `<option>${r}</option>`).join('')}</select></label>
    <div class="acts"><button class="btn btn-line xs" id="rvNo">Cancelar</button><button class="btn btn-lime xs" id="rvOk">Ver dato</button></div></div>`;
  $('rvNo').onclick = () => $('ov').hidden = true;
  $('rvOk').onclick = () => { Desk.audit({ by: staff.name, role: staff.role, cust: c.client, name: Mask.name(c.name), field: label, why: $('why').value }); revealed.add(id + ':' + field); $('ov').hidden = true; toast('Registrado en auditoría'); after(); };
}
document.addEventListener('click', e => { const r = e.target.closest('[data-reveal]'); if (!r) return; const [id, f] = r.dataset.reveal.split('|'); askReveal(id, f, () => route()); });

// ---------- estructura ----------
let view = sessionStorage.getItem('central.view') || 'resumen', sel = null, inboxF = 'abiertas', segF = 'todos', q = '', opsTab = 'pedidos';
const NAV = [['resumen', '📊', 'Resumen'], ['desk', '💬', 'Front desk'], ['empresas', '🏢', 'Empresas B2B'], ['clientes', '👥', 'Clientes'], ['proactivo', '⚡', 'Proactivo'], ['ops', '📦', 'Operaciones'], ['privacidad', '🔒', 'Privacidad']];
const openConvs = () => Desk.all().filter(c => c.status !== 'closed');
function shell(inner, title, right = '') {
  const w = Desk.all().filter(c => c.status === 'waiting').length, al = alerts().length, nl = Desk.leads().filter(l => l.stage === 'nuevo').length;
  $('root').innerHTML = `<div class="app"><aside class="side">
      <div class="brand"><img src="../assets/navi-logo.png" alt="Navi"><small>CENTRAL</small></div>
      <nav>${NAV.map(([k, i, n]) => `<button data-v="${k}" aria-current="${view === k}">${i} ${n}${k === 'desk' && w ? `<b>${w}</b>` : ''}${k === 'proactivo' && al ? `<b>${al}</b>` : ''}${k === 'empresas' && nl ? `<b>${nl}</b>` : ''}</button>`).join('')}</nav>
      <div class="who"><b>${esc(staff.name)}</b>${ROLES[staff.role].n}<br><a class="rv" id="logout" style="margin:0">Salir</a></div>
      <div class="foot">DEMO · datos de este navegador + cartera ficticia</div></aside>
    <main class="main"><div class="top"><h1>${title}</h1><div class="sp">${right}</div></div>${inner}</main></div>`;
  document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; sel = null; sessionStorage.setItem('central.view', view); route(); });
  $('logout').onclick = () => { sessionStorage.removeItem('central.staff'); staff = null; route(); };
}
function route() {
  if (!staff) return login();
  ({ resumen, desk, empresas, clientes, proactivo, ops, privacidad }[view] || resumen)();
}

function login() {
  $('root').innerHTML = `<div class="login"><div class="box"><img src="../assets/navi-logo.png" alt="Navi" style="height:34px"><h1>Navi Central</h1>
    <p class="muted">Consola interna de Navi Móvil: clientes, atención y seguimiento.</p>
    <label>Tu nombre<input class="inp" id="lgName" value="Ana López"></label>
    <label>Rol<select class="inp" id="lgRole">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}">${r.n}</option>`).join('')}</select></label>
    <button class="btn btn-lime" id="lgGo" style="width:100%;justify-content:center;margin-top:18px">Entrar</button>
    <p class="hint" style="margin-top:12px">DEMO sin contraseña. En producción: cuenta corporativa con verificación en dos pasos y permisos por rol.</p></div></div>`;
  $('lgGo').onclick = () => { staff = { name: $('lgName').value.trim() || 'Asesor', role: $('lgRole').value }; sessionStorage.setItem('central.staff', JSON.stringify(staff)); route(); };
}

// ---------- Resumen ----------
function resumen() {
  const cs = customers(), act = cs.filter(c => c.status === 'activa'), convs = Desk.all();
  const lines = cs.reduce((s, c) => s + c.lines, 0);
  const mrr = cs.reduce((s, c) => s + (c.price || 0) / PER_MONTHS[c.per], 0);
  const rated = convs.filter(c => c.csat), csat = rated.length ? rated.reduce((s, c) => s + c.csat, 0) / rated.length : 0;
  const closedByBot = convs.filter(c => c.status === 'closed' && !c.msgs.some(m => m.from === 'agent')).length, closed = convs.filter(c => c.status === 'closed').length;
  const waiting = convs.filter(c => c.status === 'waiting');
  const firstReply = convs.map(c => { const i = c.msgs.findIndex(m => m.from === 'customer'), j = c.msgs.findIndex((m, k) => k > i && m.from !== 'customer'); return i >= 0 && j > i ? (c.msgs[j].t - c.msgs[i].t) / 1000 : null; }).filter(x => x != null);
  const al = alerts();
  const mix = [2, 4, 12, 24].map(g => [g + ' GB', cs.filter(c => c.gb === g && !c.fam).length]).concat([['Plan Familia', cs.filter(c => c.fam).length]]);
  const chans = [['whatsapp', 'WhatsApp'], ['web', 'Chat web'], ['app', 'App Mi Navi'], ['empresas', 'Chat Empresas']].map(([k, n]) => [n, convs.filter(c => c.channel === k).length]);
  // requerimientos por tipo de cliente: personas (B2C, Navi Móvil) y empresas (B2B, NAVICom)
  const b2c = openConvs().filter(c => segOf(c) === 'b2c'), b2bC = openConvs().filter(c => segOf(c) === 'b2b'), ol = openLeads(), newL = Desk.leads().filter(l => l.stage === 'nuevo');
  const pipe = STAGES.slice(0, 4).map(([k, n]) => [n, Desk.leads().filter(l => l.stage === k).length]);
  const bars = (rows, color) => { const mx = Math.max(1, ...rows.map(r => r[1])); return `<div class="bars">${rows.map(([n, v]) => `<div class="bar"><span>${n}</span><i style="width:${v / mx * 100}%;background:${color}"></i><span>${v}</span></div>`).join('')}</div>`; };
  shell(`<div class="kpis">
      <div class="kpi"><small>Clientes activos</small><b>${act.length}</b><em>${lines} líneas</em></div>
      <div class="kpi"><small>Ingreso mensual recurrente</small><b>${mxn(mrr).replace(/\.\d+$/, '')}</b><em>estimado</em></div>
      <div class="kpi seg-b2c"><small>👤 Requerimientos personas (B2C)</small><b>${b2c.length}</b><em>${b2c.filter(c => c.status === 'waiting').length} esperando asesor</em></div>
      <div class="kpi seg-b2b"><small>🏢 Requerimientos empresas (B2B)</small><b>${ol.length + b2bC.filter(c => !Desk.leads().some(l => l.conv === c.id)).length}</b><em>${newL.length} nuevos · ${mxn(ol.reduce((s, l) => s + leadValue(l), 0)).replace(/\.\d+$/, '')}/mes en juego</em></div>
      <div class="kpi"><small>Primera respuesta</small><b>${firstReply.length ? Math.max(1, Math.round(firstReply.reduce((a, b) => a + b, 0) / firstReply.length)) + ' s' : '—'}</b><em>el asistente contesta al momento</em></div>
      <div class="kpi"><small>Resueltas por el asistente</small><b>${closed ? Math.round(closedByBot / closed * 100) : 0}%</b><em>${closed} cerradas</em></div>
      <div class="kpi"><small>Satisfacción (CSAT)</small><b>${csat ? csat.toFixed(1) : '—'}<span style="font-size:15px">/5</span></b><em>${rated.length} calificaciones</em></div>
      <div class="kpi"><small>Avisos proactivos pendientes</small><b>${al.length}</b><em>clientes a contactar</em></div>
    </div>
    <div class="g2"><section class="card"><h3>⚡ Lo urgente ahora<span class="hint">primero quien espera, luego lo proactivo</span></h3><div class="list">
      ${waiting.map(c => `<button class="item" data-conv="${c.id}"><span class="ic">${CH[c.channel]}</span><span><b>${esc(c.name || c.anon)} espera a ${segOf(c) === 'b2b' ? 'un ejecutivo' : 'un asesor'}</b><small>${esc(c.msgs[c.msgs.length - 1]?.txt.slice(0, 70))}</small></span><span class="r">${segTag(c)} <span class="pill bad">${ago(c.updated)}</span></span></button>`).join('')}
      ${newL.filter(l => !waiting.some(c => c.id === l.conv)).map(l => `<button class="item" data-lead="${l.id}"><span class="ic">${SRC[l.source] || '🏢'}</span><span><b>${esc(l.company)} pide propuesta</b><small>${esc((l.interest || []).join(', ') || l.msg || '')}${l.lines ? ' · ' + l.lines + ' líneas' : ''}</small></span><span class="r"><span class="pill b2b">B2B</span> <span class="pill bad">${ago(l.t)}</span></span></button>`).join('')}
      ${al.slice(0, 6).map(a => `<button class="item" data-go="proactivo"><span class="ic" style="background:${a.r.color}33">${a.r.ic}</span><span><b>${esc(a.c.name)}</b><small>${a.r.n}</small></span><span class="r"><span class="pill info">${planTxt(a.c)}</span></span></button>`).join('')}
      ${!waiting.length && !al.length && !newL.length ? '<p class="muted">Todo al día ✨</p>' : ''}</div></section>
      <div style="display:grid;gap:14px"><section class="card"><h3>🏢 Embudo de empresas<span class="hint">NAVICom · B2B</span></h3>${bars(pipe, '#A893FF')}</section><section class="card"><h3>Planes</h3>${bars(mix, 'var(--lime)')}</section><section class="card"><h3>Canales de atención</h3>${bars(chans, '#7EE0FF')}</section></div></div>`, 'Resumen', `<span class="pill ok">● Asistente en línea 24/7</span>`);
  document.querySelectorAll('[data-conv]').forEach(b => b.onclick = () => { view = 'desk'; sel = b.dataset.conv; route(); });
  document.querySelectorAll('[data-lead]').forEach(b => b.onclick = () => leadCard(b.dataset.lead));
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { view = b.dataset.go; route(); });
}

// ---------- Front desk ----------
const ST = { bot: ['🤖 Asistente', 'info'], waiting: ['⏳ Espera asesor', 'bad'], agent: ['🙋 Con asesor', 'warn'], closed: ['✓ Resuelta', 'ok'] };
const CH = { whatsapp: '🟢', web: '💬', app: '📱', empresas: '🏢' };
const CH_N = { whatsapp: 'WhatsApp', web: 'Chat web', app: 'App Mi Navi', empresas: 'Chat Empresas' };
const segTag = c => segOf(c) === 'b2b' ? '<span class="pill b2b">B2B</span>' : '<span class="pill b2c">B2C</span>';
const TPL_B2B = [
  ['Saludo', n => `Hola ${n}, soy ${staff.name.split(' ')[0]}, ejecutivo de NAVICom 👋. Ya revisé tu requerimiento.`],
  ['Datos', () => 'Para armar tu propuesta, ¿me confirmas la ciudad o ciudades donde operan y para cuándo lo necesitan?'],
  ['Llamada', () => '¿Te parece si agendamos una llamada de 15 minutos para entender tu operación? Dime día y hora.'],
  ['Propuesta', () => 'Te acabo de enviar la propuesta a tu correo 📧. Cualquier duda la vemos por aquí.'],
  ['Prueba', () => 'Podemos darte una prueba piloto con algunas líneas o equipos antes de contratar todo. ¿Te interesa?'],
  ['Cierre', () => '¡Gracias por considerar a NAVICom! Quedo pendiente 💚'],
];
const TPL = [
  ['Saludo', n => `Hola ${n}, soy ${staff.name.split(' ')[0]} de Navi Móvil 👋. Ya revisé tu conversación, ¿me das un momento?`],
  ['Revisando', () => 'Estoy revisando tu cuenta, en un momento te confirmo 🔎'],
  ['Reporte de red', () => `Ya levanté un reporte con la red (folio T-${String(Date.now()).slice(-6)}). Te aviso en cuanto quede resuelto.`],
  ['Pago', () => 'Puedes pagar con tarjeta, transferencia o efectivo en tiendas. Si quieres te mando el enlace para completar tu pago.'],
  ['Retención', n => `${n}, antes de que te vayas: puedo ofrecerte un mes con el doble de GB sin costo. ¿Te interesa?`],
  ['Cierre', () => '¿Hay algo más en lo que te pueda ayudar? Si no, cierro la conversación. ¡Gracias por elegir Navi! 💚'],
];
function desk() {
  const all = Desk.all().filter(c => segF === 'todos' || segOf(c) === segF).filter(c => inboxF === 'abiertas' ? c.status !== 'closed' : inboxF === 'mias' ? c.agent === staff.name && c.status !== 'closed' : inboxF === 'espera' ? c.status === 'waiting' : c.status === 'closed')
    .sort((a, b) => (b.status === 'waiting') - (a.status === 'waiting') || b.updated - a.updated);
  const c = sel && Desk.get(sel);
  shell(`<div class="desk ${c ? 'open' : ''}">
    <section class="inbox"><div class="hd"><div class="seg segs">${[['todos', 'Todos'], ['b2c', '👤 Personas B2C'], ['b2b', '🏢 Empresas B2B']].map(([k, n]) => { const cnt = openConvs().filter(c => k === 'todos' || segOf(c) === k).length; return `<button data-sg="${k}" aria-pressed="${segF === k}">${n} · ${cnt}</button>`; }).join('')}</div>
        <div class="seg" style="margin-top:6px">${[['abiertas', 'Abiertas'], ['espera', 'En espera'], ['mias', 'Mías'], ['cerradas', 'Resueltas']].map(([k, n]) => `<button data-f="${k}" aria-pressed="${inboxF === k}">${n}</button>`).join('')}</div></div>
      <div class="rows">${all.map(x => { const l = x.msgs[x.msgs.length - 1]; return `<button class="crow" data-c="${x.id}" aria-current="${x.id === sel}"><span class="ch c-${x.channel}">${CH[x.channel]}</span><span class="mid"><b>${esc(x.name || x.anon)}${x.unread ? '<i class="dot"></i>' : ''}</b><small>${l ? esc((l.from === 'customer' ? '' : l.from === 'bot' ? '🤖 ' : '🙋 ') + l.txt) : ''}</small><span style="display:flex;gap:4px">${segTag(x)}<span class="pill ${ST[x.status][1]}">${ST[x.status][0]}</span></span></span><span class="r">${ago(x.updated)}</span></button>`; }).join('') || '<p class="muted" style="padding:14px">Sin conversaciones aquí.</p>'}</div></section>
    <section class="conv">${c ? convHTML(c) : '<div style="margin:auto;text-align:center;padding:30px" class="muted">💬<br>Elige una conversación</div>'}</section>
    <aside class="cust">${c ? custPanel(c) : '<p class="muted">El contexto del cliente aparece aquí.</p>'}</aside></div>`, 'Front desk', `<span class="pill">${Desk.all().filter(x => x.status === 'waiting').length} en espera</span><a class="btn btn-line xs" href="../whatsapp.html" target="_blank">Abrir WhatsApp de prueba ↗</a>`);
  document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { inboxF = b.dataset.f; desk(); });
  document.querySelectorAll('[data-sg]').forEach(b => b.onclick = () => { segF = b.dataset.sg; desk(); });
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { sel = b.dataset.c; desk(); });
  if (c) bindConv(c);
}
function convHTML(c) {
  const cu = c.phone && custById(c.phone);
  return `<div class="hd"><button class="btn btn-line xs back" id="cBack">←</button><span class="ch c-${c.channel}" style="width:32px;height:32px;border-radius:50%;display:grid;place-items:center">${CH[c.channel]}</span>
      <div><b>${esc(c.name || c.anon)}</b> ${segTag(c)}<div class="hint">${CH_N[c.channel]} · ${segOf(c) === 'b2b' ? esc(c.lead?.company || 'empresa sin datos') : cu ? cu.client : 'sin identificar'} · ${c.id}</div></div>
      <span class="pill ${ST[c.status][1]}">${ST[c.status][0]}${c.agent && c.status === 'agent' ? ' · ' + esc(c.agent) : ''}</span>
      <div style="margin-left:auto;display:flex;gap:6px">${c.status !== 'agent' || c.agent !== staff.name ? `<button class="btn btn-lime xs" id="cTake">Tomar</button>` : ''}${c.status !== 'closed' ? `<button class="btn btn-line xs" id="cClose">Resolver</button>` : `<button class="btn btn-line xs" id="cReopen">Reabrir</button>`}</div></div>
    <div class="msgs" id="cMsgs">${c.msgs.map(m => m.from === 'system' ? `<div class="sys">${deskFmt(m.txt)}</div>`
      : m.from === 'note' ? `<div class="m note"><span class="who">📝 Nota interna · ${esc(m.agent)}</span>${deskFmt(m.txt)}<small>${hhmm(m.t)} · el cliente no la ve</small></div>`
      : `<div class="m ${m.from === 'customer' ? '' : 'out'} ${m.from === 'agent' ? 'agent' : ''}"><span class="who">${m.from === 'customer' ? esc(c.name || c.anon) : m.from === 'bot' ? '🤖 Asistente' : '🙋 ' + esc(m.agent || 'Asesor') + (m.proactive ? ' · proactivo' : '')}</span>${deskFmt(m.txt)}<small>${hhmm(m.t)}</small></div>`).join('')}
      ${c.csat ? `<div class="sys">Calificación del cliente: ${'★'.repeat(c.csat)}${'☆'.repeat(5 - c.csat)}</div>` : ''}</div>
    <div class="compose" id="comp"><div class="tpl">${(segOf(c) === 'b2b' ? TPL_B2B : TPL).map(([n], i) => `<button data-t="${i}">${n}</button>`).join('')}</div>
      <form id="cForm"><textarea id="cTxt" placeholder="Escribe al cliente… (Enter envía, Shift+Enter salto de línea)"></textarea><button class="btn btn-lime xs">Enviar</button></form>
      <div class="opts"><label><input type="checkbox" id="cNote"> Nota interna (el cliente no la ve)</label><span style="margin-left:auto">${c.channel === 'whatsapp' ? 'Se envía por WhatsApp' : 'Se envía al chat'}</span></div></div>`;
}
function bindConv(c) {
  if (c.unread) Desk.set(c.id, { unread: 0 });
  const box = $('cMsgs'); box.scrollTop = box.scrollHeight;
  $('cBack').onclick = () => { sel = null; desk(); };
  if ($('cTake')) $('cTake').onclick = () => { Desk.set(c.id, { status: 'agent', agent: staff.name }); Desk.push(c.id, { from: 'system', txt: `${staff.name} tomó la conversación` }); desk(); };
  if ($('cClose')) $('cClose').onclick = () => { Desk.push(c.id, { from: 'system', txt: `Resuelta por ${staff.name}` }); Desk.set(c.id, { status: 'closed' }); toast('Conversación resuelta'); desk(); };
  if ($('cReopen')) $('cReopen').onclick = () => { Desk.set(c.id, { status: 'agent', agent: staff.name }); desk(); };
  const first = (c.lead?.contact || c.name || '').replace(/^(Prof|Ing|Lic|Dra?)\.\s/, '').split(' ')[0];
  const tpl = segOf(c) === 'b2b' ? TPL_B2B : TPL;
  document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { $('cTxt').value = tpl[b.dataset.t][1](first); $('cTxt').focus(); });
  if ($('cLead')) $('cLead').onclick = () => { const L = c.lead || {}; const l = Desk.leads().find(x => x.conv === c.id) || Desk.lead({ conv: c.id, source: CH_N[c.channel], company: L.company || c.name || c.anon, contact: L.contact || c.name || c.anon, mail: L.mail || null, lines: L.lines || null, interest: L.interest || [], msg: c.msgs.filter(m => m.from === 'customer').map(m => m.txt).slice(0, 3).join(' · ') }); leadCard(l.id); };
  if ($('cToB2b')) $('cToB2b').onclick = () => { Desk.set(c.id, { seg: segOf(c) === 'b2b' ? 'b2c' : 'b2b' }); toast(segOf(c) === 'b2b' ? 'Marcada como persona (B2C)' : 'Marcada como empresa (B2B)'); desk(); };
  $('cNote').onchange = () => $('comp').classList.toggle('noting', $('cNote').checked);
  const send = () => {
    const v = $('cTxt').value.trim(); if (!v) return;
    if ($('cNote').checked) Desk.push(c.id, { from: 'note', agent: staff.name, txt: v });
    else { Desk.push(c.id, { from: 'agent', agent: staff.name, txt: v }); if (c.status !== 'agent') Desk.set(c.id, { status: 'agent', agent: staff.name }); }
    desk();
  };
  $('cForm').onsubmit = e => { e.preventDefault(); send(); };
  $('cTxt').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  document.querySelectorAll('[data-tag]').forEach(b => b.onclick = () => { const t = b.dataset.tag, tags = c.tags || []; Desk.set(c.id, { tags: tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t] }); desk(); });
  if ($('cTicket')) $('cTicket').onclick = () => newTicket(c);
  if ($('cFicha')) $('cFicha').onclick = () => ficha(c.phone);
}
function custPanel(c) {
  if (segOf(c) === 'b2b') return b2bPanel(c);
  const cu = c.phone && custById(c.phone);
  const TAGS = ['cobros', 'red', 'portabilidad', 'equipo', 'retención', 'venta'];
  const hist = c.phone ? Desk.all().filter(x => x.phone === c.phone && x.id !== c.id) : [];
  return `${cu ? `<b style="font-size:16px">${esc(cu.name)}</b><div class="hint">${cu.client} · cliente desde ${cu.since.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}</div>
    <h4>Servicio</h4><div class="kv"><span>Plan</span><b>${planTxt(cu)} · ${PER_LABEL[cu.per]}</b><span>Datos</span><b>${cu.left} de ${cu.total} GB</b><span>Renueva</span><b>${fmtDay(cu.renew)} (${cu.renewDays} d)</b>
      <span>Número</span><b>${maskedVal(cu, 'phone')}</b><span>Equipo</span><b>${esc(cu.device)}</b>${cu.porta ? `<span>Portabilidad</span><b>${esc(cu.porta.from)} · ${cu.porta.status}</b>` : ''}${cu.pay ? `<span>Pago</span><b style="color:#FF9EB0">${cu.pay}</b>` : ''}</div>
    <h4>Avisos</h4>${RULES.filter(r => r.test(cu)).map(r => `<span class="pill" style="margin:0 4px 4px 0;background:${r.color}26">${r.ic} ${r.n}</span>`).join('') || '<span class="hint">Sin avisos</span>'}
    <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-lime xs" id="cFicha">Ficha completa</button><button class="btn btn-line xs" id="cTicket">Crear ticket</button></div>`
    : '<b>Cliente sin identificar</b><p class="hint">El asistente le pide su número Navi para identificarlo.</p>'}
    <h4>Etiquetas</h4><div class="seg">${TAGS.map(t => `<button data-tag="${t}" aria-pressed="${(c.tags || []).includes(t)}">${t}</button>`).join('')}</div>
    <h4>Historial</h4>${hist.length ? hist.map(h => `<div class="hint">${CH[h.channel]} ${new Date(h.created).toLocaleDateString('es-MX')} · ${ST[h.status][0]}</div>`).join('') : '<span class="hint">Primera conversación</span>'}
    <h4>Tipo de cliente</h4><button class="btn btn-line xs" id="cToB2b">🏢 Es una empresa: pasar a B2B</button>`;
}
// panel de una conversación de empresa: lo que el asistente ya capturó y la oportunidad en el embudo
function b2bPanel(c) {
  const L = c.lead || {}, l = Desk.leads().find(x => x.conv === c.id);
  return `<b style="font-size:16px">🏢 ${esc(L.company || 'Empresa sin identificar')}</b><div class="hint">Requerimiento de empresa · NAVICom</div>
    <h4>Lo que capturó el asistente</h4><div class="kv"><span>Contacto</span><b>${esc(L.contact || '—')}</b><span>Correo</span><b>${esc(L.mail ? Mask.mail(L.mail) : '—')}</b><span>Líneas / equipos</span><b>${L.lines || '—'}</b><span>Valor estimado</span><b>${L.lines ? mxn(leadValue(L)).replace(/\.\d+$/, '') + '/mes' : '—'}</b></div>
    <h4>Le interesa</h4>${(L.interest || []).map(i => `<span class="pill" style="margin:0 4px 4px 0">${esc(i)}</span>`).join('') || '<span class="hint">Aún no lo dice</span>'}
    <h4>Oportunidad</h4>${l ? `<div class="kv"><span>Folio</span><b>${l.id}</b><span>Etapa</span><b style="color:${STAGE[l.stage].c}">${STAGE[l.stage].n}</b><span>Ejecutivo</span><b>${esc(l.owner || 'sin asignar')}</b></div>` : '<span class="hint">Todavía no está en el embudo.</span>'}
    <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-lime xs" id="cLead">${l ? 'Ver oportunidad' : 'Crear oportunidad'}</button><button class="btn btn-line xs" id="cToB2b">👤 Es persona: pasar a B2C</button></div>
    <h4>Etiquetas</h4><div class="seg">${['venta', 'propuesta', 'piloto', 'gobierno', 'escuela'].map(t => `<button data-tag="${t}" aria-pressed="${(c.tags || []).includes(t)}">${t}</button>`).join('')}</div>`;
}
function newTicket(c) {
  $('ov').hidden = false;
  $('ov').innerHTML = `<div><h3>Nuevo ticket</h3><p class="muted">${esc(c.name || c.anon)} · ${c.id}</p>
    <label>Área<select class="inp" id="tkA"><option>Red y cobertura</option><option>Cobros y pagos</option><option>Portabilidad</option><option>Equipo</option><option>Envíos</option></select></label>
    <label>Prioridad<select class="inp" id="tkP"><option>Normal</option><option>Alta</option><option>Urgente</option></select></label>
    <label>Descripción<textarea class="inp" id="tkD" style="min-height:90px">${esc(c.msgs.filter(m => m.from === 'customer').slice(-1)[0]?.txt || '')}</textarea></label>
    <div class="acts"><button class="btn btn-line xs" id="tkNo">Cancelar</button><button class="btn btn-lime xs" id="tkOk">Crear</button></div></div>`;
  $('tkNo').onclick = () => $('ov').hidden = true;
  $('tkOk').onclick = () => { const t = Desk.ticket({ conv: c.id, cust: c.phone, name: c.name || c.anon, area: $('tkA').value, prio: $('tkP').value, desc: $('tkD').value, by: staff.name }); Desk.push(c.id, { from: 'note', agent: staff.name, txt: `Ticket ${t.id} creado · ${t.area} · ${t.prio}` }); $('ov').hidden = true; toast('Ticket ' + t.id + ' creado'); route(); };
}

// ---------- Empresas B2B (NAVICom): embudo de oportunidades ----------
let leadQ = '';
function empresas() {
  const ls = Desk.leads(), qq = leadQ.toLowerCase();
  const vis = ls.filter(l => !qq || (l.company + ' ' + l.contact + ' ' + (l.interest || []).join(' ')).toLowerCase().includes(qq));
  const ol = openLeads(), won = ls.filter(l => l.stage === 'ganado'), closed = ls.filter(l => ['ganado', 'perdido'].includes(l.stage));
  const card = l => `<button class="lead" data-l="${l.id}" style="--c:${STAGE[l.stage].c}"><b>${esc(l.company)}</b><small>${esc((l.interest || []).join(' · ') || l.msg || 'Sin detalle')}</small>
    <span class="lf"><span>${SRC[l.source] || '🏢'} ${l.lines ? l.lines + ' líneas · ' + mxn(leadValue(l)).replace(/\.\d+$/, '') : esc(l.source)}</span><span>${l.owner ? '🙋 ' + esc(l.owner.split(' ')[0]) : '<i class="dot"></i> sin asignar'} · ${ago(l.updated)}</span></span></button>`;
  shell(`<div class="kpis">
      <div class="kpi"><small>Oportunidades abiertas</small><b>${ol.length}</b><em>${ls.filter(l => l.stage === 'nuevo').length} nuevas sin contactar</em></div>
      <div class="kpi"><small>Valor mensual en juego</small><b>${mxn(ol.reduce((s, l) => s + leadValue(l), 0)).replace(/\.\d+$/, '')}</b><em>${ol.reduce((s, l) => s + (l.lines || 0), 0)} líneas/equipos</em></div>
      <div class="kpi"><small>Ganadas</small><b>${won.length}</b><em>${mxn(won.reduce((s, l) => s + leadValue(l), 0)).replace(/\.\d+$/, '')}/mes</em></div>
      <div class="kpi"><small>Tasa de cierre</small><b>${closed.length ? Math.round(won.length / closed.length * 100) : 0}%</b><em>${closed.length} cerradas</em></div>
    </div>
    <div class="search"><input id="lq" placeholder="Busca empresa, contacto o interés" value="${esc(leadQ)}"><span class="hint" style="align-self:center">Entran del formulario de propuesta y del chat de la página Empresas.</span></div>
    <div class="kanban">${STAGES.map(([k, n, c]) => { const xs = vis.filter(l => l.stage === k).sort((a, b) => b.updated - a.updated); return `<section class="col"><h4><i style="background:${c}"></i>${n}<span>${xs.length}</span></h4>${xs.map(card).join('') || '<p class="hint" style="padding:6px">—</p>'}</section>`; }).join('')}</div>`,
    'Empresas B2B', `<span class="pill b2b">NAVICom</span><a class="btn btn-line xs" href="../empresas.html" target="_blank">Abrir página Empresas ↗</a>`);
  const inp = $('lq'); inp.oninput = () => { leadQ = inp.value; empresas(); const i = $('lq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
  document.querySelectorAll('[data-l]').forEach(b => b.onclick = () => leadCard(b.dataset.l));
}
function leadCard(lid) {
  const l = Desk.leads().find(x => x.id === lid); if (!l) return;
  const conv = l.conv && Desk.get(l.conv), shown = revealed.has(l.id + ':mail');
  $('ov').hidden = false;
  $('ov').innerHTML = `<div><div style="display:flex;gap:10px;align-items:start"><div><h3>🏢 ${esc(l.company)}</h3><p class="muted">${l.id} · ${SRC[l.source] || ''} ${esc(l.source)} · ${new Date(l.t).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} ${hhmm(l.t)}</p></div><span class="pill b2b" style="margin-left:auto">B2B</span></div>
    <div class="kv" style="margin-top:12px"><span>Contacto</span><b>${esc(l.contact || '—')}</b>
      <span>Correo</span><b>${l.mail ? (shown ? esc(l.mail) : esc(Mask.mail(l.mail)) + `<a class="rv" id="lRv">Ver</a>`) : '—'}</b>
      ${l.tel ? `<span>Teléfono</span><b>${esc(Mask.phone(l.tel))}</b>` : ''}
      <span>Líneas / equipos</span><b>${l.lines || '—'}</b><span>Valor estimado</span><b>${l.lines ? mxn(leadValue(l)).replace(/\.\d+$/, '') + '/mes' : '—'}</b>
      <span>Le interesa</span><b>${esc((l.interest || []).join(', ') || '—')}</b></div>
    ${l.msg ? `<p style="margin-top:10px;background:#ffffff0a;border-radius:12px;padding:10px;font-size:13px">“${esc(l.msg)}”</p>` : ''}
    <label>Etapa<select class="inp" id="lSt">${STAGES.map(([k, n]) => `<option value="${k}" ${l.stage === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>Ejecutivo<div style="display:flex;gap:8px;align-items:center"><b style="color:var(--text)">${esc(l.owner || 'Sin asignar')}</b>${l.owner !== staff.name ? '<button class="btn btn-line xs" id="lMe" type="button">Asignármela</button>' : ''}</div></label>
    <label>Notas<textarea class="inp" id="lNote" style="min-height:60px" placeholder="Ej. Llamada agendada el jueves; quieren piloto de 5 unidades"></textarea></label>
    ${(l.notes || []).map(n => `<div class="hint" style="margin-top:6px">📝 ${esc(n.txt)} · ${esc(n.by)} · ${ago(n.t)}</div>`).join('')}
    <div class="acts">${conv ? '<button class="btn btn-line xs" id="lConv">💬 Abrir conversación</button>' : ''}<button class="btn btn-line xs" id="lX">Cerrar</button><button class="btn btn-lime xs" id="lOk">Guardar</button></div></div>`;
  $('lX').onclick = () => { $('ov').hidden = true; route(); };
  if ($('lRv')) $('lRv').onclick = () => { Desk.audit({ by: staff.name, role: staff.role, cust: l.id, name: l.company, field: 'correo (empresa)', why: 'Contactar a la empresa' }); revealed.add(l.id + ':mail'); leadCard(lid); };
  if ($('lMe')) $('lMe').onclick = () => { Desk.setLead(l.id, { owner: staff.name, stage: l.stage === 'nuevo' ? 'contactado' : l.stage }); toast('Asignada a ti'); leadCard(lid); };
  if ($('lConv')) $('lConv').onclick = () => { $('ov').hidden = true; view = 'desk'; segF = 'b2b'; sel = conv.id; sessionStorage.setItem('central.view', view); route(); };
  $('lOk').onclick = () => {
    const note = $('lNote').value.trim(), st = $('lSt').value;
    Desk.setLead(l.id, { stage: st, owner: l.owner || staff.name, notes: note ? [{ t: Date.now(), by: staff.name, txt: note }, ...(l.notes || [])] : l.notes || [] });
    if (conv && st !== l.stage) Desk.push(conv.id, { from: 'note', agent: staff.name, txt: `Oportunidad ${l.id}: ${STAGE[l.stage].n} → ${STAGE[st].n}` });
    $('ov').hidden = true; toast('Oportunidad actualizada'); route();
  };
}

// ---------- Clientes ----------
function clientes() {
  const qq = q.toLowerCase().replace(/\s/g, '');
  const list = customers().filter(c => !qq || (c.name + c.client + c.phone).toLowerCase().replace(/\s/g, '').includes(qq));
  shell(`<div class="search"><input id="q" placeholder="Busca por nombre, no. de cliente o número completo" value="${esc(q)}"></div>
    <div class="tw"><table><thead><tr><th>Cliente</th><th>No. cliente</th><th>Número</th><th>Plan</th><th>Datos</th><th>Renueva</th><th>Estado</th></tr></thead><tbody>
    ${list.map(c => `<tr class="click" data-id="${c.id}"><td><b>${esc(c.synth ? c.name : c.name)}</b>${c.synth ? '' : ' <span class="pill lime">demo</span>'}</td><td>${c.client}</td><td>${esc(Mask.phone(c.phone))}</td><td>${planTxt(c)}</td>
      <td><div style="display:flex;gap:8px;align-items:center"><div class="meter"><i class="${c.pct < .2 ? 'low' : ''}" style="width:${Math.round(c.pct * 100)}%"></i></div><span class="hint">${c.left} GB</span></div></td>
      <td>${fmtDay(c.renew)}</td><td>${c.status === 'activa' ? '<span class="pill ok">Activa</span>' : '<span class="pill bad">Suspendida</span>'} ${RULES.filter(r => r.test(c)).map(r => `<span title="${r.n}">${r.ic}</span>`).join('')}</td></tr>`).join('')}
    </tbody></table></div><p class="hint" style="margin-top:8px">${list.length} clientes · los números se muestran enmascarados; para buscar por número escríbelo completo.</p>`, 'Clientes');
  const inp = $('q'); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
  inp.oninput = () => { q = inp.value; clientes(); };
  document.querySelectorAll('tr[data-id]').forEach(r => r.onclick = () => ficha(r.dataset.id));
}
function ficha(id) {
  const c = custById(id); if (!c) return toast('Cliente sin ficha');
  const convs = Desk.all().filter(x => x.phone === c.phone), tks = Desk.tickets().filter(t => t.cust === c.phone);
  const f = c.facts, orders = f ? f.orders : [], tops = f ? f.topups : [], portas = f ? f.portas : [];
  const ev = [
    ...convs.map(x => ({ t: x.created, txt: `${CH[x.channel]} Conversación ${ST[x.status][0].toLowerCase()}${x.csat ? ' · ' + x.csat + '★' : ''}` })),
    ...orders.map(o => ({ t: o.at, txt: `📦 Pedido ${o.folio} · ${o.status} · ${mxn(o.total)}` })),
    ...tops.map(t => ({ t: t.at, txt: `⚡ Recarga ${t.gb} GB · ${t.status} · ${mxn(t.price)}` })),
    ...portas.map(p => ({ t: p.at, txt: `🔁 Portabilidad ${p.folio} desde ${p.de}` })),
    ...tks.map(t => ({ t: t.t, txt: `🎫 Ticket ${t.id} · ${t.area}` })),
    { t: +c.since, txt: '✅ Alta en Navi Móvil' },
  ].sort((a, b) => b.t - a.t);
  $('ov').hidden = false;
  $('ov').innerHTML = `<div class="wide ficha"><div class="hd"><div class="av">${c.img ? `<img src="${img(avatarSrc(c.phone, c.img))}" alt="">` : esc(c.name[0])}</div>
      <div><h2>${esc(c.name)}</h2><div class="muted">${c.client} · ${planTxt(c)} · cliente desde ${c.since.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</div></div>
      <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-lime xs" id="fMsg">Escribir por WhatsApp</button><button class="btn btn-line xs" id="fX">Cerrar</button></div></div>
    <div class="kpis"><div class="kpi"><small>Datos disponibles</small><b>${c.left} GB</b><em>de ${c.total} GB</em></div><div class="kpi"><small>Renueva</small><b>${c.renewDays} d</b><em>${fmtDay(c.renew)}</em></div>
      <div class="kpi"><small>Pago</small><b style="font-size:20px">${c.price ? mxn(c.price) : '—'}</b><em>${PER_LABEL[c.per]}</em></div><div class="kpi"><small>Satisfacción</small><b>${c.csat ? c.csat + '★' : '—'}</b><em>${convs.length} conversaciones</em></div></div>
    <div class="g3"><section class="card"><h3>Servicio</h3><div class="kv"><span>Estado</span><b>${c.status}</b><span>Plan</span><b>${planTxt(c)}</b><span>Periodo</span><b>${PER_LABEL[c.per]}</b>
        ${c.porta ? `<span>Portabilidad</span><b>${esc(c.porta.from)} · ${c.porta.status}</b><span>Regalo bienvenida</span><b>${c.porta.status === 'completada' ? `mes ${c.porta.month} de 12` : '—'}</b>` : ''}
        <span>Apps activas</span><b>${f ? f.apps.length : c.gb >= 12 ? 10 : 9}</b><span>NAVI SOS</span><b>${c.gb >= 12 || c.fam ? (c.sosOff ? 'incluido, sin activar' : 'activo') : 'no incluido'}</b></div></section>
      <section class="card"><h3>Datos personales <span class="hint">enmascarados</span></h3><div class="kv"><span>Número</span><b>${maskedVal(c, 'phone')}</b><span>Correo</span><b>${maskedVal(c, 'mail')}</b><span>Equipo</span><b>${esc(c.device)}</b><span>IMEI</span><b>${maskedVal(c, 'imei')}</b><span>CURP</span><b>no se guarda</b></div>
        <p class="hint" style="margin-top:8px">De la CURP solo se guarda una huella cifrada para validar identidad; nadie puede leerla.</p></section>
      <section class="card"><h3>Avisos proactivos</h3>${RULES.filter(r => r.test(c)).map(r => `<div class="item" style="margin-bottom:6px"><span class="ic" style="background:${r.color}33">${r.ic}</span><span><b>${r.n}</b><small>${r.d}</small></span></div>`).join('') || '<p class="muted">Nada pendiente ✨</p>'}</section></div>
    <div class="g2" style="margin-top:14px"><section class="card"><h3>Línea de tiempo</h3><div class="tl">${ev.slice(0, 12).map(e => `<div><span>${new Date(e.t).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>${esc(e.txt)}</div>`).join('')}</div></section>
      <section class="priv"><b>🔒 Lo que Navi no ve</b><ul><li>El NIP de portabilidad (se usa una vez y se descarta).</li><li>Mensajes de Navi Conecta entre clientes.</li><li>Ubicación en tiempo real de NAVI SOS (solo la familia).</li><li>Agenda, fotos y contenido personal de la app.</li><li>Datos completos de tarjetas (los guarda la pasarela de pago).</li></ul>
        <p class="hint" style="margin-top:8px">Ver un dato completo pide un motivo y queda en la auditoría.</p></section></div></div>`;
  $('fX').onclick = () => $('ov').hidden = true;
  $('fMsg').onclick = () => {
    $('ov').innerHTML = `<div><h3>Mensaje a ${esc(c.name)}</h3><label>Mensaje<textarea class="inp" id="pmT" style="min-height:110px">Hola ${esc(c.name.split(' ')[0])}, soy ${esc(staff.name.split(' ')[0])} de Navi Móvil 👋 </textarea></label>
      <div class="acts"><button class="btn btn-line xs" id="pmNo">Cancelar</button><button class="btn btn-lime xs" id="pmOk">Enviar por WhatsApp</button></div></div>`;
    $('pmNo').onclick = () => ficha(id);
    $('pmOk').onclick = () => { sendProactive(c, $('pmT').value.trim()); $('ov').hidden = true; toast('Mensaje enviado'); route(); };
  };
}

// ---------- Proactivo ----------
function proactivo() {
  const al = alerts();
  shell(`<p class="muted" style="margin-bottom:14px;max-width:760px">El sistema revisa la cartera y te dice a quién buscar <b>antes</b> de que tenga un problema. Revisa el mensaje sugerido y envíalo por WhatsApp; queda en el historial del cliente.</p>
    ${RULES.map(r => { const xs = al.filter(a => a.r === r); return `<section class="card rule"><div class="hdr"><span class="ic" style="background:${r.color}33">${r.ic}</span><div><b>${r.n}</b><div class="hint">${r.d}</div></div>
      <div class="sp"><span class="pill">${xs.length}</span>${xs.length ? `<button class="btn btn-lime xs" data-all="${r.id}">Enviar a todos</button>` : ''}</div></div>
      ${xs.length ? `<div class="list">${xs.slice(0, 8).map(a => `<div class="item"><span><b>${esc(a.c.name)}</b><small>${a.c.client} · ${planTxt(a.c)} · ${a.r.id === 'datos' ? a.c.left + ' GB disponibles' : a.r.id === 'renueva' ? 'renueva ' + fmtDay(a.c.renew) : a.r.id === 'porta' ? 'portabilidad ' + a.c.porta.status : a.r.id === 'regalo' ? 'regalo ' + a.c.porta.month + '/12' : a.r.id === 'pago' ? 'pago ' + a.c.pay : a.r.id === 'csat' ? a.c.csat + '★' : 'SOS sin activar'}</small></span>
        <span class="r" style="display:flex;gap:6px"><button class="btn btn-line xs" data-skip="${a.key}">Descartar</button><button class="btn btn-lime xs" data-send="${a.key}">Revisar y enviar</button></span></div>`).join('')}${xs.length > 8 ? `<p class="hint">y ${xs.length - 8} más</p>` : ''}</div>` : '<p class="hint">Nadie en esta situación ✨</p>'}</section>`; }).join('')}`, 'Proactivo', `<span class="pill warn">${al.length} pendientes</span>`);
  const find = k => al.find(a => a.key === k);
  document.querySelectorAll('[data-skip]').forEach(b => b.onclick = () => { Desk.markDone(b.dataset.skip, staff.name); proactivo(); });
  document.querySelectorAll('[data-send]').forEach(b => b.onclick = () => {
    const a = find(b.dataset.send);
    $('ov').hidden = false;
    $('ov').innerHTML = `<div><h3>${a.r.ic} ${esc(a.c.name)}</h3><p class="muted">${a.r.n} · por WhatsApp</p><label>Mensaje<textarea class="inp" id="paT" style="min-height:120px">${esc(a.r.tpl(a.c))}</textarea></label>
      <div class="acts"><button class="btn btn-line xs" id="paNo">Cancelar</button><button class="btn btn-lime xs" id="paOk">Enviar</button></div></div>`;
    $('paNo').onclick = () => $('ov').hidden = true;
    $('paOk').onclick = () => { sendProactive(a.c, $('paT').value.trim(), a.r.id); $('ov').hidden = true; toast('Enviado a ' + a.c.name.split(' ')[0]); proactivo(); };
  });
  document.querySelectorAll('[data-all]').forEach(b => b.onclick = () => {
    const xs = al.filter(a => a.r.id === b.dataset.all);
    if (!confirm(`¿Enviar el mensaje sugerido a ${xs.length} clientes por WhatsApp?`)) return;
    xs.forEach(a => sendProactive(a.c, a.r.tpl(a.c), a.r.id)); toast(`Enviado a ${xs.length} clientes`); proactivo();
  });
}

// ---------- Operaciones ----------
function ops() {
  const orders = readLS('navi.orders', []), tops = Topups.all(), portas = readLS('navi.portas', []), tks = Desk.tickets();
  const synthOrders = SYNTH.slice(0, 9).map((c, i) => ({ folio: 'NV-' + String(4821300 + i * 37), at: Date.now() - i * 5.3e7, name: Mask.name(c.name), gb: c.gb, lines: c.lines, total: c.price, status: i === 2 ? 'rechazado' : i === 5 ? 'pendiente' : 'pagado', demo: false }));
  const synthPortas = SYNTH.filter(c => c.porta).slice(0, 8).map((c, i) => ({ folio: `PORT-2611${String(10 + i).padStart(2, '0')}-${refCode(c.phone).slice(2)}`, de: c.porta.from, name: Mask.name(c.name), status: c.porta.status, at: Date.now() - i * 8.6e7 }));
  const T = {
    pedidos: ['Pedidos', ['Folio', 'Fecha', 'Cliente', 'Plan', 'Total', 'Estado'], [...orders.map(o => [o.folio, o.at, Mask.name(o.name), `${o.lines > 1 ? o.lines + ' × ' : ''}${o.gb} GB`, mxn(o.total), o.status, 1]), ...synthOrders.map(o => [o.folio, o.at, o.name, `${o.lines > 1 ? o.lines + ' × ' : ''}${o.gb} GB`, mxn(o.total), o.status])]],
    recargas: ['Recargas', ['Folio', 'Fecha', 'Línea', 'Paquete', 'Monto', 'Estado'], tops.map(t => [t.folio, t.at, Mask.phone(t.phone), t.gb + ' GB', mxn(t.price), t.status, 1])],
    portas: ['Portabilidades', ['Folio', 'Fecha', 'Cliente / número', 'Desde', 'Fecha estimada', 'Estado'], [...portas.map(p => [p.folio, p.at, Mask.phone(p.num), p.de, fmtDay(p.date), 'en proceso', 1]), ...synthPortas.map(p => [p.folio, p.at, p.name, p.de, '—', p.status])]],
    tickets: ['Tickets', ['Ticket', 'Fecha', 'Cliente', 'Área', 'Prioridad', 'Estado'], tks.map(t => [t.id, t.t, Mask.name(t.name), t.area, t.prio, t.status, 1])],
  };
  const [, heads, rows] = T[opsTab];
  const pill = s => `<span class="pill ${/pagad|aplicad|complet/.test(s) ? 'ok' : /rechaz/.test(s) ? 'bad' : 'warn'}">${s}</span>`;
  shell(`<div class="seg" style="margin-bottom:12px">${Object.entries(T).map(([k, [n, , r]]) => `<button data-o="${k}" aria-pressed="${opsTab === k}">${n} · ${r.length}</button>`).join('')}</div>
    <div class="tw"><table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>
    ${rows.sort((a, b) => b[1] - a[1]).map(r => `<tr><td><b>${esc(r[0])}</b>${r[6] ? ' <span class="pill lime">demo</span>' : ''}</td><td>${new Date(r[1]).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} ${hhmm(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td>${pill(r[5])}</td></tr>`).join('') || `<tr><td colspan="6" class="muted">Sin registros todavía.</td></tr>`}
    </tbody></table></div><p class="hint" style="margin-top:8px">“demo” = hecho en este navegador desde la página o Mi Navi. En producción: todo viene de la plataforma de JR Móvil y la pasarela de pago.</p>`, 'Operaciones', can('export') ? `<button class="btn btn-line xs" id="exp">Exportar CSV</button>` : `<span class="hint">Exportar: solo supervisor</span>`);
  document.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { opsTab = b.dataset.o; ops(); });
  if ($('exp')) $('exp').onclick = () => {
    const csv = [heads, ...rows.map(r => r.slice(0, 6).map((v, i) => i === 1 ? new Date(v).toISOString() : v))].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = `navi-${opsTab}.csv`; a.click();
    Desk.audit({ by: staff.name, role: staff.role, cust: '—', name: '—', field: 'exportó ' + opsTab, why: 'Reporte operativo' });
  };
}

// ---------- Privacidad ----------
function privacidad() {
  const au = Desk.audits();
  shell(`<div class="g2"><section class="card"><h3>🔎 Auditoría de accesos<span class="hint">quién vio qué y por qué</span></h3>
      ${can('audit') ? `<div class="tw" style="border:0"><table><thead><tr><th>Cuándo</th><th>Quién</th><th>Cliente</th><th>Dato</th><th>Motivo</th></tr></thead><tbody>
      ${au.map(a => `<tr><td>${new Date(a.t).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td><td>${esc(a.by)}<div class="hint">${ROLES[a.role]?.n || ''}</div></td><td>${esc(a.cust)}<div class="hint">${esc(a.name)}</div></td><td>${esc(a.field)}</td><td>${esc(a.why)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nadie ha visto datos completos todavía.</td></tr>'}
      </tbody></table></div>` : '<p class="muted">Solo supervisores y administradores ven la auditoría.</p>'}</section>
    <div style="display:grid;gap:14px;align-content:start"><section class="card"><h3>Permisos por rol</h3><div class="tw" style="border:0"><table><thead><tr><th></th><th>Asesor</th><th>Supervisor</th><th>Admin</th></tr></thead><tbody>
      <tr><td>Ver ficha y servicio</td><td>✓</td><td>✓</td><td>✓</td></tr><tr><td>Ver número / correo completo</td><td>✓ con motivo</td><td>✓ con motivo</td><td>✓ con motivo</td></tr>
      <tr><td>Ver IMEI completo</td><td>—</td><td>✓ con motivo</td><td>✓ con motivo</td></tr><tr><td>Exportar reportes</td><td>—</td><td>✓</td><td>✓</td></tr><tr><td>Ver auditoría</td><td>—</td><td>✓</td><td>✓</td></tr>
      <tr><td>Leer chats de Conecta / ubicación SOS</td><td>—</td><td>—</td><td>—</td></tr></tbody></table></div></section>
      <section class="priv"><b>Principios</b><ul><li>Mínimo necesario: el asesor ve lo que necesita para resolver, nada más.</li><li>Enmascarado por defecto y acceso completo con motivo.</li><li>Lo privado de la app (Conecta, SOS, Agenda) no entra a la consola.</li><li>Derechos ARCO: el cliente puede pedir acceso, corrección o borrado de sus datos.</li><li>Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.</li></ul></section></div></div>`, 'Privacidad y auditoría');
}

// la consola se actualiza sola cuando un cliente escribe desde otra pestaña (chat web, Mi Navi o WhatsApp de prueba)
addEventListener('storage', e => {
  if (e.key !== Desk.KEY || !staff || !$('ov').hidden) return;
  if (document.activeElement?.id === 'cTxt' && $('cTxt').value) return; // no borrar lo que el asesor está escribiendo
  if (['desk', 'resumen', 'empresas'].includes(view)) route();
});
route();
