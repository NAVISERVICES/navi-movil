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
  const read = () => readLS(KEY, { convs: [], audit: [], done: {}, tickets: [] });
  const write = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
  const upd = fn => { const d = read(); const r = fn(d); write(d); return r; };
  const id = () => 'C' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  return {
    all: () => read().convs,
    get: cid => read().convs.find(c => c.id === cid),
    // conversación abierta de un cliente en un canal (o una nueva)
    open: (channel, phone, name) => upd(d => {
      let c = d.convs.find(x => x.channel === channel && x.phone === phone && x.status !== 'closed' && (phone || x.anon === name));
      if (!c) { c = { id: id(), channel, phone: phone || null, anon: phone ? null : name, name: name || null, status: 'bot', created: Date.now(), updated: Date.now(), msgs: [], tags: [], notes: [], csat: null, agent: null }; d.convs.unshift(c); }
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
  function answer(conv, text) {
    const s = norm(text), f = conv.phone ? custFacts(conv.phone) : null, hi = f ? f.first : '';
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
    Desk.push(cid, { from: 'bot', txt: r.txt });
    // si el bot no entiende dos veces, pasa la conversación a un asesor
    c = Desk.get(cid);
    if ((c.misses || 0) >= 2 && c.status === 'bot') { Desk.set(cid, { status: 'waiting' }); Desk.push(cid, { from: 'bot', txt: 'Mejor te comunico con un asesor para ayudarte 🙋.' }); }
    return Desk.get(cid);
  }
  return { handle, answer, MENU };
})();

// texto con *negritas* estilo WhatsApp y enlaces
const deskFmt = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  .replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
