// Navi Front Desk · conversaciones con clientes (chat web, WhatsApp y app) y asistente automático.
// Lo usan el chat del cliente (asistente.js, whatsapp.html) y la consola central (central/).
// DEMO: todo vive en este navegador. En producción: WhatsApp Business API (Meta o un proveedor como Twilio),
// un servidor que guarde cada conversación y un motor de reglas que dispare los avisos proactivos.
// Necesita auth.js y planes.js cargados antes.

// ---------- privacidad: lo que un asesor ve por defecto ----------
const Mask = {
  phone: p => p ? '+52 ' + String(p).slice(0, 2) + ' •••• ' + String(p).slice(-4) : '—',
  mail: m => { if (!m) return '—'; const [u, d] = String(m).split('@'); return (u || '').slice(0, 2) + '•••@' + (d || ''); },
  imei: i => i ? '••••••••••' + String(i).slice(-5) : '—',
  name: n => { const [a, ...r] = String(n || '').split(' '); return [a, ...r.map(x => x[0] ? x[0] + '.' : '')].join(' '); },
};

// ---------- lo que el sistema sabe del servicio de una línea (mismo cálculo que Mi Navi) ----------
const PER_MONTHS = { m: 1, t: 3, s: 6, a: 12 }, PER_LABEL = { m: 'Mensual', t: 'Trimestral', s: 'Semestral', a: 'Anual' };
const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
function custFacts(phone) {
  const acc = NaviAuth.find(phone);
  if (!acc) return null;
  const lines = accountLines(acc), idx = Math.max(0, lines.findIndex(l => l.phone === phone)), line = lines[idx];
  const fam = acc.plan.type === 'familia', gb = line.gb, extra = Topups.extra(phone);
  const total = gb + extra, used = +(gb * DEMO_USED[idx % DEMO_USED.length]).toFixed(1), left = +(total - used).toFixed(1);
  const renew = new Date(); renew.setMonth(renew.getMonth() + PER_MONTHS[acc.plan.period]); renew.setDate(Math.min(renew.getDate(), 28));
  const porta = line.porta || null, gm = porta ? giftMonth(porta.since) : 0;
  const orders = readLS('navi.orders', []).filter(o => o.alta?.telefono === phone || o.mail && Profiles.get(phone).mail === o.mail);
  const portas = readLS('navi.portas', []).filter(p => p.prov === phone || p.num === phone);
  const price = fam ? quote({ gb: acc.plan.lines[0].gb, per: acc.plan.period, lines: acc.plan.lines.length })?.total : PLANS.find(p => p.gb === gb)?.prices[acc.plan.period];
  return {
    phone, acc, line, fam, gb, extra, total, used, left, pctLeft: left / total, renew,
    daysToRenew: Math.ceil((renew - Date.now()) / 864e5), period: acc.plan.period, perLabel: PER_LABEL[acc.plan.period], price,
    client: clientCode(acc).replace(/^NV/, 'NV-'), name: lineHolder(acc, line), first: line.name,
    porta, giftMonth: gm, giftGb: porta ? portaGift(gb) : 0, apps: acc.apps, device: line.device,
    topups: Topups.forPhone(phone), orders, portas, since: acc.plan.since, role: acc.role,
  };
}
const fmtDay = d => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });

// ---------- conversaciones ----------
const Desk = (() => {
  const KEY = 'navi.desk';
  const read = () => ({ leads: [], ...readLS(KEY, { convs: [], audit: [], done: {}, tickets: [] }) });
  const write = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
  const upd = fn => { const d = read(); const r = fn(d); write(d); return r; };
  const id = () => 'C' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  return {
    all: () => read().convs,
    get: cid => read().convs.find(c => c.id === cid),
    // conversación abierta de un cliente en un canal (o una nueva).
    // seg: 'b2c' (personas, Navi Móvil) o 'b2b' (empresas, NAVICom); el chat de la página Empresas siempre es b2b
    open: (channel, phone, name) => upd(d => {
      let c = d.convs.find(x => x.channel === channel && x.phone === phone && x.status !== 'closed' && (phone || x.anon === name));
      if (!c) { c = { id: id(), channel, seg: channel === 'empresas' ? 'b2b' : 'b2c', phone: phone || null, anon: phone ? null : name, name: name || null, status: 'bot', created: Date.now(), updated: Date.now(), msgs: [], tags: [], notes: [], csat: null, agent: null }; d.convs.unshift(c); }
      return c;
    }),
    push: (cid, m) => upd(d => { const c = d.convs.find(x => x.id === cid); if (!c) return; c.msgs.push({ t: Date.now(), ...m }); c.updated = Date.now(); if (m.from === 'customer') c.unread = (c.unread || 0) + 1; return c; }),
    set: (cid, patch) => upd(d => { const c = d.convs.find(x => x.id === cid); if (c) Object.assign(c, patch, { updated: Date.now() }); return c; }),
    // auditoría: quién vio qué dato completo y por qué
    audit: e => upd(d => { d.audit.unshift({ t: Date.now(), ...e }); }),
    audits: () => read().audit,
    // avisos proactivos ya atendidos
    done: () => read().done,
    markDone: (key, by) => upd(d => { d.done[key] = { t: Date.now(), by }; }),
    tickets: () => read().tickets,
    ticket: tk => upd(d => { const t = { id: 'T-' + String(Date.now()).slice(-6), t: Date.now(), status: 'abierto', ...tk }; d.tickets.unshift(t); return t; }),
    // requerimientos de empresas (B2B): llegan del formulario de propuesta o del chat de Empresas
    leads: () => read().leads,
    lead: l => upd(d => {
      let x = l.conv && d.leads.find(y => y.conv === l.conv);
      if (x) Object.assign(x, l, { updated: Date.now() });
      else { x = { id: 'L-' + String(Date.now()).slice(-6), t: Date.now(), updated: Date.now(), stage: 'nuevo', owner: null, notes: [], ...l }; d.leads.unshift(x); }
      return x;
    }),
    setLead: (lid, patch) => upd(d => { const x = d.leads.find(y => y.id === lid); if (x) Object.assign(x, patch, { updated: Date.now() }); return x; }),
    KEY,
  };
})();

// ---------- asistente automático (24/7) ----------
// Reconoce la intención por palabras clave y, si sabe quién es el cliente, contesta con los datos de su servicio.
const NaviBot = (() => {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const has = (s, ...w) => w.some(x => s.includes(x));
  const MENU = 'Puedo ayudarte con: 📶 *saldo* de datos · ⚡ *recargas* · 📅 *renovación* · 🔁 *portabilidad* · 💳 *pagos* · 📍 *cobertura* · 📱 *mi equipo* · 🚨 *SOS* · 👤 *asesor*. ¿Qué necesitas?';
  const base = 'https://www.navimovil.com/demo/';
  // ---------- empresas (NAVICom): resuelve dudas y arma el requerimiento para un ejecutivo ----------
  const MENU_B2B = 'Te ayudo con: 📱 *líneas* empresariales · 🔳 *eSIM* · 🌐 *internet* para negocio · 🛡️ *seguridad* (SOS / Safe City) · 📻 *PTT* · 🚚 *rastreo* de flotillas · 📡 *IoT* · 📶 *equipos* y cobertura. Si ya sabes lo que necesitas, escribe *propuesta*.';
  const B2B_TOPICS = [
    [['linea', 'plan', 'chip', 'sim fisica'], 'Líneas móviles', 'Líneas empresariales sobre la Red Compartida (4.5G LTE) con datos, minutos y SMS, facturación central y un ejecutivo asignado. Desde 5 líneas.'],
    [['esim'], 'eSIM', 'Activamos eSIM a distancia para que tu equipo no espere chips físicos; ideal para altas rápidas y personal en campo.'],
    [['internet', 'modem', 'wifi', 'oficina', 'sucursal'], 'Internet para negocio', 'Internet fijo inalámbrico para oficinas y sucursales, sin obra ni cableado. Se instala en días.'],
    [['segur', 'sos', 'safe city', 'emergencia', 'vigila', 'escuela', 'colegio'], 'Seguridad (SOS / Safe City)', 'NAVI SOS para empresas y escuelas: botón de pánico, ubicación en tiempo real y geocercas con horario. Safe City para municipios y fraccionamientos.'],
    [['ptt', 'radio', 'push to talk', 'walkie'], 'PTT', 'PTT (push to talk): radio digital en el celular con cobertura nacional, grupos y despacho desde una consola web.'],
    [['rastreo', 'track', 'gps', 'flotilla', 'unidades', 'chofer', 'vehicul', 'camion'], 'Rastreo (Track)', 'Navi Track: rastreo de unidades y personal en tiempo real, rutas, geocercas y alertas desde un panel web.'],
    [['iot', 'lora', 'sensor', 'telemetria', 'medidor'], 'IoT / LoRaWAN', 'IoT y LoRaWAN: sensores y medidores conectados (agua, energía, temperatura) con su tablero de monitoreo.'],
    [['equipo', 'cobertura', 'booster', 'senal', 'rudo'], 'Equipos y cobertura', 'Equipos de uso rudo, celulares y amplificadores de señal (booster) para bodegas, sótanos y zonas con poca cobertura.'],
  ];
  // pasos para armar el requerimiento: empresa → nombre → líneas → correo
  const STEPS = { empresa: '¿Cómo se llama tu empresa o institución? 🏢', nombre: '¿Con quién tengo el gusto? (tu nombre)', lineas: '¿Cuántas líneas, equipos o unidades necesitas, más o menos?', mail: '¿A qué *correo de trabajo* te enviamos la propuesta? 📧' };
  const nextStep = L => !L.company ? 'empresa' : !L.contact ? 'nombre' : !L.lines ? 'lineas' : !L.mail ? 'mail' : null;
  function answerB2B(conv, text) {
    const s = norm(text), L = { interest: [], ...(conv.lead || {}) };
    const mail = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0], n = +(text.match(/\d+/)?.[0] || 0);
    const ask = (lead, pre = '') => {
      const st = nextStep(lead);
      if (st) return { lead, step: st, txt: `${pre}${STEPS[st]}` };
      return { lead, step: null, final: true, status: 'waiting', tag: 'venta', txt: `${pre}¡Listo, ${lead.contact.split(' ')[0]}! ✅ Registré tu requerimiento para *${lead.company}*${lead.lines ? ` (${lead.lines} líneas/equipos)` : ''}. Un ejecutivo de NAVICom te escribe aquí y a ${lead.mail} en horario laboral. Si tienes más detalles (ciudad, fechas, equipos), escríbelos aquí y los verá.` };
    };
    // respuestas a la pregunta que hizo el asistente
    if (conv.b2bStep === 'empresa' && text.trim().length > 1) return ask({ ...L, company: text.trim().slice(0, 60) });
    if (conv.b2bStep === 'nombre' && text.trim().length > 1) return ask({ ...L, contact: text.trim().slice(0, 50) });
    if (conv.b2bStep === 'lineas' && n) return ask({ ...L, lines: n });
    if (conv.b2bStep === 'mail') { if (mail) return ask({ ...L, mail }); return { lead: L, step: 'mail', txt: 'Ese correo no se ve completo 🤔. Escríbelo así: nombre@empresa.com' }; }
    if (has(s, 'gracias', 'eso es todo', 'ok gracias')) return { csat: true, txt: '¡Con gusto! 😊 ¿Cómo calificarías la atención del 1 al 5?' };
    if (/^[1-5]$/.test(s.trim()) && conv.askedCsat) return { rate: +s.trim(), txt: '¡Gracias por tu calificación! 💚' };
    if (has(s, 'propuesta', 'cotiza', 'precio', 'costo', 'cuanto cuesta', 'ejecutivo', 'asesor', 'vendedor', 'contratar', 'humano', 'llamen', 'llamada')) return ask(L, nextStep(L) ? 'Con gusto te armamos una propuesta a la medida. Solo necesito unos datos.\n\n' : '');
    const hit = B2B_TOPICS.filter(([w]) => has(s, ...w));
    if (hit.length) {
      const lead = { ...L, interest: [...new Set([...L.interest, ...hit.map(h => h[1])])] };
      return { lead, txt: hit.map(h => `*${h[1]}*: ${h[2]}`).join('\n\n') + '\n\n¿Te armamos una propuesta? Escribe *propuesta* y te pido unos datos.' };
    }
    if (has(s, 'hola', 'buenas', 'buen dia', 'menu', 'ayuda', 'info')) return { txt: `¡Hola! 👋 Soy el asistente de NAVICom, la división de Navi para empresas.\n\n${MENU_B2B}` };
    return { miss: true, txt: `No estoy seguro de haberte entendido 🤔.\n\n${MENU_B2B}` };
  }
  function answer(conv, text) {
    if (conv.seg === 'b2b') return answerB2B(conv, text);
    const s = norm(text), f = conv.phone ? custFacts(conv.phone) : null, hi = f ? f.first : '';
    // una persona que pregunta por su empresa pasa al flujo de empresas (B2B)
    if (has(s, 'empresa', 'negocio', 'flotilla', 'corporativ', 'pyme', 'para mi equipo de trabajo')) return { seg: 'b2b', tag: 'empresa', txt: `¡Claro! Para empresas tenemos NAVICom 🏢.\n\n${MENU_B2B}\n\nMás información: ${base}empresas.html` };
    const need = () => ({ txt: 'Para darte datos de tu línea necesito saber quién eres. Escríbeme tu número Navi de 10 dígitos 📱' });
    // número escrito para identificarse
    const num = text.replace(/\D/g, '');
    if (!conv.phone && num.length === 10) {
      if (NaviAuth.find(num)) return { identify: num, txt: `¡Listo! Ya te identifiqué ✅ (en producción te enviamos un código por SMS para confirmarlo). ¿En qué te ayudo?\n\n${MENU}` };
      return { txt: 'Ese número no está en Navi Móvil. Si quieres cambiarte con tu número, escribe *portabilidad*, o mira los planes en ' + base + '#individuales' };
    }
    if (has(s, 'asesor', 'humano', 'persona', 'agente', 'ejecutivo', 'hablar con')) return { status: 'waiting', txt: 'Te comunico con un asesor de Navi 🙋. Te responde en unos minutos y verá toda esta conversación, así que no tienes que repetir nada.' };
    if (has(s, 'gracias', 'listo', 'eso es todo', 'perfecto', 'ok gracias')) return { csat: true, txt: '¡Con gusto! 😊 Antes de irte, ¿cómo calificarías la atención del 1 al 5?' };
    if (/^[1-5]$/.test(s.trim()) && conv.askedCsat) return { rate: +s.trim(), txt: +s.trim() >= 4 ? '¡Gracias por tu calificación! 💚 Aquí estamos cuando nos necesites.' : 'Gracias por decírnoslo. Un supervisor revisará tu caso para mejorar 🙏' };
    if (has(s, 'saldo', 'datos', 'megas', 'gigas', 'gb', 'consumo', 'me queda')) {
      if (!f) return need();
      return { txt: `${hi}, te quedan *${f.left} GB* de ${f.total} GB${f.extra ? ` (incluye ${f.extra} GB de recargas)` : ''}. Tu plan se renueva el *${fmtDay(f.renew)}*.${f.pctLeft < 0.25 ? '\n\nTe queda poco: si quieres, escribe *recarga* y te mando el enlace.' : ''}${f.giftMonth ? `\n🎁 Además vas en el regalo ${f.giftMonth} de 12: +${f.giftGb} GB este mes.` : ''}` };
    }
    if (has(s, 'recarg', 'paquete', 'comprar datos')) return { txt: `Puedes recargar en dos toques desde tu sesión de Mi Navi: ${base}recargas.html\nPaquetes: ${NAVI_TOPUPS.map(t => `${t.gb} GB ${mxn(t.price)}`).join(' · ')}. Se aplican en cuanto se confirma el pago.` };
    if (has(s, 'renueva', 'vence', 'corte', 'cuando se', 'fecha de pago', 'renovacion')) {
      if (!f) return need();
      return { txt: `Tu plan ${f.perLabel.toLowerCase()} se renueva el *${fmtDay(f.renew)}* (en ${f.daysToRenew} días)${f.price ? ` por ${mxn(f.price)}` : ''}.` };
    }
    if (has(s, 'portab', 'cambiarme', 'traer mi numero', 'conservar mi numero', 'nip')) {
      const p = f?.portas?.[0];
      if (p) return { txt: `Tu portabilidad *${p.folio}* va en proceso. Fecha estimada: *${fmtDay(p.date)}*. Tu línea anterior sigue funcionando mientras tanto.` };
      return { txt: `Traer tu número es gratis: 1) marca *051* desde tu línea actual para recibir tu NIP, 2) captúralo en ${base}portabilidad.html y 3) nosotros hacemos el resto. Si vienes de Telcel, AT&T, Movistar, Unefon o Virgin Mobile te regalamos GB cada mes por 12 meses 🎁` };
    }
    if (has(s, 'pago', 'cobro', 'tarjeta', 'rechaz', 'factura', 'oxxo', 'transferencia')) {
      const o = f?.orders?.find(x => x.status !== 'pagado'), t = f?.topups?.find(x => x.status === 'pendiente');
      if (o) return { txt: `Veo tu pedido *${o.folio}* como *${o.status}*. Puedes retomarlo y pagarlo desde ${base}comprar.html, o escribe *asesor* y te ayudamos.` };
      if (t) return { txt: `Tu recarga *${t.folio}* está pendiente de pago (${t.method}). En cuanto se acredite se aplica sola.` };
      return { txt: 'Aceptamos tarjeta, transferencia y efectivo en tiendas. Si necesitas factura, márcalo al pagar y te llega a tu correo. ¿Tienes algún cobro que revisar? Escribe *asesor*.' };
    }
    if (has(s, 'cobertura', 'senal', 'no tengo red', 'sin servicio', 'no jala')) return { txt: `Usamos la Red Compartida de Altán (4.5G LTE). Revisa la cobertura de tu código postal en ${base}cobertura.html. Si estás en zona con cobertura y no tienes señal, reinicia tu equipo; si sigue igual escribe *asesor* y abrimos un reporte.` };
    if (has(s, 'equipo', 'celular', 'compatible', 'imei', 'esim', 'volte')) {
      if (f) return { txt: `Tu equipo registrado es *${f.device.brand} ${f.device.model}* (${f.device.sim}) y es compatible con la red ✅. Para revisar otro equipo usa ${base}equipo.html` };
      return { txt: `Revisa si tu celular es compatible en ${base}equipo.html (marca *#06# para ver tu IMEI).` };
    }
    if (has(s, 'sos', 'emergencia', 'ubicacion', 'familia segura')) return { txt: f && f.apps.includes('sos') ? `NAVI SOS está incluido en tu plan ✅. Ábrelo en ${base}sos.html y agrega a tu familia. En una emergencia real llama al *911*.` : 'NAVI SOS viene con los planes de 12 GB, 24 GB y Plan Familia. En una emergencia llama al *911*.' };
    if (has(s, 'plan', 'precio', 'cuanto cuesta', 'promo')) return { txt: `Planes mensuales: ${PLANS.map(p => `${p.gb} GB ${mxn(p.prices.m)}`).join(' · ')}. Todos con minutos y SMS ilimitados, hotspot y redes sociales incluidas. Plan Familia: 5% menos por cada línea. Ver: ${base}#individuales` };
    if (has(s, 'cancel', 'dar de baja', 'me quiero ir')) return { status: 'waiting', tag: 'retención', txt: 'Lamento que lo estés pensando 😕. Te comunico con un asesor para revisar tu caso; muchas veces encontramos una mejor opción para ti.' };
    if (has(s, 'hola', 'buenas', 'buen dia', 'que tal', 'menu', 'ayuda', 'info')) return { txt: `¡Hola${hi ? ' ' + hi : ''}! 👋 Soy el asistente de Navi Móvil, disponible 24/7.\n\n${MENU}${f ? '' : '\n\nSi eres cliente, escríbeme tu número Navi para darte datos de tu línea.'}` };
    return { miss: true, txt: `No estoy seguro de haberte entendido 🤔.\n\n${MENU}` };
  }
  // procesa un mensaje del cliente y responde (si un asesor tomó la conversación, el bot ya no contesta)
  function handle(cid, text) {
    Desk.push(cid, { from: 'customer', txt: text });
    let c = Desk.get(cid);
    if (c.status === 'agent' || c.status === 'waiting') return null;
    const r = answer(c, text);
    if (r.identify) { Desk.set(cid, { phone: r.identify, name: custFacts(r.identify).name }); }
    if (r.status) Desk.set(cid, { status: r.status });
    if (r.tag) Desk.set(cid, { tags: [...new Set([...(c.tags || []), r.tag])] });
    if (r.csat) Desk.set(cid, { askedCsat: true });
    if (r.rate) Desk.set(cid, { csat: r.rate, askedCsat: false, status: 'closed' });
    if (r.miss) Desk.set(cid, { misses: (c.misses || 0) + 1 });
    if (r.seg) Desk.set(cid, { seg: r.seg });
    if (r.lead) Desk.set(cid, { lead: r.lead });
    if ('step' in r) Desk.set(cid, { b2bStep: r.step });
    // requerimiento completo: entra a la consola como oportunidad de empresa
    if (r.final) Desk.lead({ conv: cid, source: 'Chat Empresas', company: r.lead.company, contact: r.lead.contact, mail: r.lead.mail, lines: r.lead.lines, interest: r.lead.interest, msg: c.msgs.filter(m => m.from === 'customer').map(m => m.txt).slice(0, 3).join(' · ') });
    Desk.push(cid, { from: 'bot', txt: r.txt });
    // si el bot no entiende dos veces, pasa la conversación a un asesor
    c = Desk.get(cid);
    if ((c.misses || 0) >= 2 && c.status === 'bot') { Desk.set(cid, { status: 'waiting' }); Desk.push(cid, { from: 'bot', txt: 'Mejor te comunico con un asesor para ayudarte 🙋.' }); }
    return Desk.get(cid);
  }
  return { handle, answer, MENU, MENU_B2B };
})();

// texto con *negritas* estilo WhatsApp y enlaces
const deskFmt = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  .replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
