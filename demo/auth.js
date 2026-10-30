// Navi · cuentas, suite de apps y acceso por plan.
// DEMO: las cuentas y la sesión viven en el navegador. En producción esto lo resuelve
// el servidor (p. ej. AWS Cognito con código por SMS) y aquí solo se lee la respuesta.

const NAVI_STORE_URL = 'https://navi-store.netlify.app/';

const NAVI_APPS = [
  { id: 'recargas', name: 'Recargas',          icon: '⚡', color: '#7EE0FF', desc: '¿Se te acaban los megas? Recarga tu línea en dos toques, sin escribir tu número.', href: 'recargas.html', wide: true },
  { id: 'movil', name: 'Navi Móvil',         icon: '📶', color: '#B4E32F', desc: 'Tu consumo de datos, llamadas y mensajes, recargas y tu equipo.', href: 'movil.html' },
  { id: 'shop',   name: 'Navi Shop',          icon: '🛍️', color: '#FFC22E', desc: 'Precios de miembro y meses sin intereses en equipos.',
    href: 'https://www.navirepaircenter.com/demo/shop/' },
  { id: 'repair', name: 'Navi Repair Center', icon: '🔧', color: '#4FD1C0', desc: 'Diagnóstico gratis y reparaciones con descuento.',
    href: 'https://www.navirepaircenter.com/demo/' },
  { id: 'juegos', name: 'Juegos',             icon: '🎮', color: '#A893FF', desc: 'Ruta Chilanga, Lotería, Trivia Mx y más. Se juegan en el navegador.', href: 'juegos.html' },
  { id: 'videos', name: 'Videos',             icon: '▶️', color: '#FF9A6B', desc: 'Canales NAVI y cuentos animados para toda la familia.', href: 'videos.html' },
  { id: 'sos',    name: 'NAVI SOS',           icon: '🚨', color: '#FF6FB1', desc: 'Botón SOS, ubicación en tiempo real y zonas seguras.',
    // app funcional dentro de la suite: usa la sesión de Mi Navi, sin volver a iniciar sesión
    // (prototipo de diseño en Figma: NAVI-SOS-Family-–-App-Android, nodo 4-415)
    href: 'sos.html' },
];

// gratis para todo cliente Navi Móvil (Shop y Repair traen tráfico para vender en esas plataformas)
const FREE_APPS = ['recargas', 'movil', 'shop', 'repair', 'juegos', 'videos'];
// qué apps incluye cada plan: lo gratis + NAVI SOS en 24 GB y Plan Familia
const PLAN_ACCESS = {
  2:  [...FREE_APPS],
  4:  [...FREE_APPS],
  12: [...FREE_APPS],
  24: [...FREE_APPS, 'sos'],
  familia: [...FREE_APPS, 'sos'],
};

// plan mínimo que desbloquea cada app (para el mensaje de "Disponible desde…")
const unlockPlan = appId => {
  const gb = [2, 4, 12, 24].find(g => PLAN_ACCESS[g].includes(appId));
  return gb ? `${gb} GB` : 'Plan Familia';
};

// Catálogo de equipos por TAC (los primeros 8 dígitos del IMEI identifican marca y modelo).
// En producción se consulta la base de datos de dispositivos de la GSMA o un catálogo de equipos
// con los renders oficiales del fabricante; aquí cada modelo se dibuja (frente + reverso) con su
// forma de pantalla y su módulo de cámaras.
//   screen: 'island' (Dynamic Island) | 'notch' | 'punch' (cámara perforada)
//   cam: acomodo de cámaras del reverso
const TAC_DB = {
  '35291411': { brand: 'Samsung',  model: 'Galaxy A15',       os: 'Android 14', red: '5G',     screen: 'drop',   cam: 'galaxy3', r: 13 },
  '35382711': { brand: 'Apple',    model: 'iPhone 13',        os: 'iOS 18',     red: '5G',     screen: 'notch',  cam: 'iphone2', r: 15 },
  '35610423': { brand: 'Motorola', model: 'Edge 50 Neo',      os: 'Android 14', red: '5G',     screen: 'punch',  cam: 'moto3',   r: 14 },
  '35722134': { brand: 'Apple',    model: 'iPhone 15 Pro',    os: 'iOS 18',     red: '5G',     screen: 'island', cam: 'iphone3', r: 15 },
  '35091822': { brand: 'Samsung',  model: 'Galaxy S23 Ultra', os: 'Android 14', red: '5G',     screen: 'punch',  cam: 'ultra',   r: 6 },
  '86153704': { brand: 'Xiaomi',   model: 'Redmi Note 12',    os: 'Android 14', red: '4G LTE', screen: 'punch',  cam: 'redmi',   r: 12 },
  '35948217': { brand: 'Motorola', model: 'Moto G24',         os: 'Android 14', red: '4G LTE', screen: 'punch',  cam: 'moto2',   r: 13 },
};
// identifica el equipo con su IMEI; si el TAC no está en el catálogo queda como "equipo no identificado"
const identifyDevice = imei => TAC_DB[imei.slice(0, 8)] || { brand: 'Equipo', model: 'no identificado', os: '—', red: '—' };

// DEMO: compatibilidad con la Red Compartida de Altán Redes por TAC. En producción se consulta su registro de equipos.
//   b28: homologado en Banda 28 · volte · esim · lock: 'robo' si el IMEI tiene reporte
const COMPAT = {
  '35291411': { b28: true, volte: true, esim: false },
  '35382711': { b28: true, volte: true, esim: true },
  '35610423': { b28: true, volte: true, esim: true },
  '35722134': { b28: true, volte: true, esim: true },
  '35091822': { b28: true, volte: true, esim: true },
  '86153704': { b28: true, volte: true, esim: false },
  '35948217': { b28: true, volte: true, esim: false },
  '35727579': { b28: true, volte: true, esim: true, brand: 'Apple', model: 'iPhone 15 Pro Max', os: 'iOS 18' },
  '49015420': { b28: false, volte: false, esim: false, brand: 'Nokia', model: '3110', os: 'Básico' },
  '35332509': { b28: true, volte: true, esim: false, lock: 'robo', brand: 'Samsung', model: 'Galaxy A10', os: 'Android 11' },
};
const ALTAN_VALIDATOR = 'https://checkimei.altanredes.com/';
const imeiValid = s => /^\d{15}$/.test(s) && [...s].reverse().reduce((sum, ch, i) => { let d = +ch; if (i % 2) { d *= 2; if (d > 9) d -= 9; } return sum + d; }, 0) % 10 === 0;
// status: 'ok' | 'noreg' (no está en el registro) | 'nob28' (no compatible) | 'lock' (reporte de robo o extravío)
const compatOf = imei => {
  const tac = imei.slice(0, 8), c = COMPAT[tac], D = { ...(TAC_DB[tac] || {}), ...(c || {}) };
  const status = !c ? 'noreg' : c.lock ? 'lock' : !c.b28 ? 'nob28' : 'ok';
  return { ...D, status, name: D.brand ? `${D.brand} ${D.model}` : '' };
};

// color del cuerpo según el acabado que reporta el equipo
const FINISH = { 'Azul oscuro': '#2F3A52', 'Medianoche': '#232A35', 'Azul náutico': '#2D4479', 'Titanio natural': '#BDB6A9',
  'Lavanda': '#CDBEE3', 'Gris': '#5B6168' };

// equipos de demostración (IMEI ficticios): lo que no sale del TAC lo reporta la red al registrar la SIM
const dev = (storage, color, sim, imei) => ({ ...identifyDevice(imei), storage, color, sim, volte: true, imei });

// dibujo del equipo: reverso atrás a la izquierda (se ven las cámaras) y frente adelante, como en las fichas de los operadores
const deviceArt = D => {
  if (!D.cam) return '<span style="font-size:30px">📱</span>';
  const body = FINISH[D.color] || '#3A3F47', r = D.r;
  const lens = (x, y, s = 4.6) => `<circle cx="${x}" cy="${y}" r="${s + 1.4}" fill="#0b0d12" opacity=".9"/><circle cx="${x}" cy="${y}" r="${s}" fill="#151a26"/><circle cx="${x}" cy="${y}" r="${s * .45}" fill="#2b3550"/><circle cx="${x - s * .35}" cy="${y - s * .35}" r="${s * .22}" fill="#fff" opacity=".55"/>`;
  const mod = (x, y, w, h, rr) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rr}" fill="#fff" opacity=".16"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rr}" fill="none" stroke="#000" stroke-opacity=".18"/>`;
  const cams = {
    iphone3: mod(10, 11, 27, 27, 8) + lens(17, 18) + lens(17, 31) + lens(29.5, 24.5) + '<circle cx="30" cy="15" r="1.6" fill="#f3e6b0"/>',
    iphone2: mod(10, 11, 24, 24, 7) + lens(16.5, 17.5, 4.3) + lens(27.5, 28.5, 4.3) + '<circle cx="28" cy="16" r="1.5" fill="#f3e6b0"/>',
    galaxy3: lens(16, 17, 4) + lens(16, 28, 4) + lens(16, 39, 4) + '<circle cx="25" cy="17" r="1.4" fill="#f3e6b0"/>',
    ultra: lens(15, 16, 4.4) + lens(15, 28, 4.4) + lens(15, 40, 4.4) + lens(26, 16, 3.4) + lens(26, 27, 2.6),
    moto3: mod(9, 10, 26, 34, 7) + lens(17, 18, 4.5) + lens(17, 33, 4.5) + lens(28.5, 18, 2.8),
    moto2: mod(9, 10, 22, 32, 7) + lens(17, 18, 4.4) + lens(17, 32, 4.4) + '<circle cx="26" cy="25" r="1.4" fill="#f3e6b0"/>',
    redmi: mod(9, 10, 18, 40, 6) + lens(18, 18, 4) + lens(18, 30, 3.4) + lens(18, 41, 3.4),
  }[D.cam];
  const cut = {
    island: '<rect x="62" y="27" width="20" height="5.5" rx="2.75" fill="#000"/>',
    notch: '<path d="M60 22.5h24v3a3.5 3.5 0 0 1-3.5 3.5h-17a3.5 3.5 0 0 1-3.5-3.5z" fill="#000"/>',
    punch: '<circle cx="72" cy="28.5" r="2.4" fill="#000"/>',
    drop: '<path d="M68 22.5h8c-1 0-1.5 4.8-4 4.8s-3-4.8-4-4.8z" fill="#000"/>',
  }[D.screen];
  const uid = 'g' + D.imei.slice(-6);
  return `<svg viewBox="0 0 112 150" role="img" aria-label="${D.brand} ${D.model}">
    <defs>
      <linearGradient id="${uid}b" x1="0" x2="1"><stop offset="0" stop-color="${body}"/><stop offset=".55" stop-color="${body}" stop-opacity=".82"/><stop offset="1" stop-color="${body}"/></linearGradient>
      <linearGradient id="${uid}s" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#1E1E8A"/><stop offset=".55" stop-color="#7B5CFA"/><stop offset="1" stop-color="#B4E32F"/></linearGradient>
    </defs>
    <rect x="4" y="6" width="62" height="134" rx="${r}" fill="url(#${uid}b)" stroke="#000" stroke-opacity=".25"/>
    ${cams}
    <rect x="40" y="16" width="64" height="130" rx="${r}" fill="${body}" stroke="#000" stroke-opacity=".3"/>
    <rect x="42.5" y="18.5" width="59" height="125" rx="${Math.max(r - 2.5, 3)}" fill="#05060c"/>
    <rect x="44.5" y="20.5" width="55" height="121" rx="${Math.max(r - 4, 2)}" fill="url(#${uid}s)"/>
    <circle cx="86" cy="118" r="16" fill="#D4F56B" opacity=".35"/><circle cx="56" cy="62" r="11" fill="#fff" opacity=".12"/>
    <text x="72" y="58" text-anchor="middle" font-family="Bricolage Grotesque,system-ui,sans-serif" font-weight="800" font-size="13" fill="#fff">9:41</text>
    ${cut}
    <path d="M47 24c6 0 10 2 13 6" stroke="#fff" stroke-opacity=".25" stroke-width="1.2" fill="none"/>
  </svg>`;
};

// fecha en que un número portado quedó en Navi, relativa a hoy para que el demo siempre esté a mitad de sus 12 regalos
const portedAgo = months => { const d = new Date(); d.setMonth(d.getMonth() - months); d.setDate(d.getDate() - 3); return d.toISOString().slice(0, 10); };

// cuentas de demostración (números ficticios)
const NAVI_ACCOUNTS = {
  '5500000001': { name: 'Sofía Ramírez', img: 'sofi', plan: { type: 'individual', gb: 2,  period: 'm' },
    device: dev('128 GB', 'Azul oscuro', 'SIM física', '352914110473826') },
  '5500000002': { name: 'Luis Pérez',    img: 'beto', plan: { type: 'individual', gb: 12, period: 't' },
    device: dev('128 GB', 'Medianoche', 'eSIM', '353827119064512'), porta: { from: 'AT&T', since: portedAgo(4) } },
  '5500000003': { name: 'Carla Ruiz',    img: 'mama', plan: { type: 'individual', gb: 24, period: 'a' },
    device: dev('256 GB', 'Azul náutico', 'SIM física', '356104230918475') },
  '5500000004': { name: 'Familia García', img: 'beto', plan: { type: 'familia', period: 'm', lines: [
    { name: 'Papá', img: 'beto', gb: 12, phone: '5500000004', device: dev('256 GB', 'Titanio natural', 'eSIM', '357221340556193') },
    { name: 'Mamá', img: 'mama', gb: 12, phone: '5500000005', device: dev('512 GB', 'Lavanda', 'SIM física', '350918221764038'), porta: { from: 'Telcel', since: portedAgo(2) } },
    { name: 'Sofi', img: 'sofi', gb: 12, phone: '5500000006', device: dev('128 GB', 'Gris', 'SIM física', '861537040298114'), porta: { from: 'Movistar', since: portedAgo(6) } },
    { name: 'Toño', img: 'tono', gb: 12, phone: '5500000007', device: dev('128 GB', 'Gris', 'SIM física', '359482170633521') },
  ] } },
};

const appsFor = plan => PLAN_ACCESS[plan.type === 'familia' ? 'familia' : plan.gb] || [];

// Perfil de cada persona, por número (DEMO: en este navegador; en producción, en el servidor).
// Lo que cada quien edita aquí es lo que ve toda su familia: nombre, correo, cumpleaños y estado.
const Profiles = (() => {
  const KEY = 'navi.profiles';
  const all = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  return {
    get: phone => all()[phone] || {},
    set: (phone, data) => {
      const a = all(); a[phone] = { ...a[phone], ...data, at: Date.now() };
      try { localStorage.setItem(KEY, JSON.stringify(a)); return true; } catch { return false; }
    },
  };
})();
// full: nombre real completo (para la ficha de la línea) · nick: cómo le dice su familia (mapa, chat, listas)
const withProfile = l => {
  const p = Profiles.get(l.phone);
  return { ...l, name: p.nick || (p.full ? p.full.split(' ')[0] : l.name), fullName: p.full || null };
};

// todas las líneas de una cuenta con la misma forma (individual = una sola línea), con el nombre que cada quien eligió
const accountLines = user => user.plan.type === 'familia'
  ? user.plan.lines.map(withProfile)
  : [withProfile({ name: user.baseName.split(' ')[0], img: user.img, gb: user.plan.gb, phone: user.phone, device: user.device, porta: user.porta })]
    .map(l => ({ ...l, fullName: l.fullName || user.baseName }));

// consumo de demostración: fracción de datos usada por línea (misma en Mi Navi y en Navi Móvil)
const DEMO_USED = [0.62, 0.35, 0.48, 0.81];

// Recargas: mismos paquetes y precios que los planes mensuales (MXN, 30 días)
const NAVI_TOPUPS = [
  { gb: 2,  price: 129.99, color: '#FFC22E' },
  { gb: 4,  price: 169.99, color: '#4FD1C0' },
  { gb: 12, price: 239.99, color: '#A893FF' },
  { gb: 24, price: 289.99, color: '#FF8A65' },
];
// DEMO: las recargas se guardan en este navegador; en producción las aplica el sistema de cobro
const Topups = (() => {
  const KEY = 'navi.topups';
  const all = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  return {
    all,
    add: t => { const list = [t, ...all()]; try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} return t; },
    // GB extra ya aplicados a una línea
    extra: phone => all().filter(t => t.phone === phone && t.status === 'aplicada').reduce((s, t) => s + t.gb, 0),
    forPhone: phone => all().filter(t => t.phone === phone),
  };
})();
const mxn = n => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ficha compacta de una línea: foto del equipo, titular, plan, modelo y número
const lineHolder = (user, l) => user.plan.type === 'familia'
  ? (l.fullName || `${l.name} ${user.familyName.replace(/^Familia\s+/i, '')}`) : (l.fullName || user.baseName);
const linePlan = (user, l) => user.plan.type === 'familia' ? `Navi Plan Familia · ${l.gb} GB` : `Navi Plan ${l.gb} GB`;
const lineCard = (user, l) => `<div class="idcard">
  <div class="idpic">${deviceArt(l.device)}</div>
  <div><b>${lineHolder(user, l)}</b><span>${linePlan(user, l)}</span><span>${l.device.brand === 'Apple' ? '' : l.device.brand + ' '}${l.device.model}</span><span>${fmtPhone(l.phone).replace('+52 ', '')}</span></div>
</div>`;

// Fotos reales de perfil por número (DEMO: se guardan en este navegador; en producción, en el servidor)
const Photos = (() => {
  const KEY = 'navi.photos';
  const all = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  return {
    get: id => all()[id] || null,
    set: (id, url) => {
      const a = all(); if (url) a[id] = url; else delete a[id];
      try { localStorage.setItem(KEY, JSON.stringify(a)); return true; } catch { return false; }
    },
  };
})();
// foto real si la subieron; si no, el personaje de Navi
const avatarSrc = (id, img) => Photos.get(id) || `assets/${img || 'sofi'}.png`;
// recorta al centro en cuadrado y reduce a 256 px para que pese poco (~25 KB)
const readPhoto = (file, size = 256) => new Promise((resolve, reject) => {
  if (!file || !file.type.startsWith('image/')) return reject(new Error('Elige una imagen (JPG o PNG).'));
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const s = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    URL.revokeObjectURL(img.src);
    resolve(c.toDataURL('image/jpeg', 0.85));
  };
  img.onerror = () => reject(new Error('No pudimos leer esa imagen.'));
  img.src = URL.createObjectURL(file);
});

const fmtPhone = p => '+52 ' + p.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3');
const fmtImei = i => i.replace(/(\d{2})(\d{6})(\d{6})(\d)/, '$1 $2 $3 $4');
const maskImei = i => '•• •••••• ••' + i.slice(10, 14) + ' ' + i.slice(14);

const NaviAuth = (() => {
  const KEY = 'navi.session';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  // Cuenta vista por quien entra con su número. En Plan Familia cada integrante entra con su propia línea:
  // comparte plan y red con su familia (owner = número del titular) y "me" es su propia línea.
  //   name: nombre de la cuenta (en familia, "Familia García") · me.name: el nombre de la persona
  const resolve = phone => {
    const own = NAVI_ACCOUNTS[phone];
    if (own && own.plan.type !== 'familia') {
      const me = withProfile({ name: own.name.split(' ')[0], phone, img: own.img });
      const full = me.fullName || own.name;
      return { phone, ...own, baseName: own.name, name: full, familyName: full, owner: phone, role: 'titular', me, apps: appsFor(own.plan) };
    }
    const owner = own ? phone : Object.keys(NAVI_ACCOUNTS).find(k => NAVI_ACCOUNTS[k].plan.lines?.some(l => l.phone === phone));
    if (!owner) return null;
    const acc = NAVI_ACCOUNTS[owner], line = acc.plan.lines.find(l => l.phone === phone);
    return { phone, name: acc.name, baseName: acc.name, familyName: acc.name, img: line.img, plan: acc.plan, device: line.device, porta: line.porta,
      owner, role: owner === phone ? 'titular' : 'integrante', me: withProfile(line), apps: appsFor(acc.plan) };
  };
  return {
    find: resolve,
    login: phone => { try { localStorage.setItem(KEY, JSON.stringify({ phone, at: Date.now() })); } catch {} },
    logout: () => { try { localStorage.removeItem(KEY); } catch {} },
    // devuelve la cuenta con sesión activa, o null
    current: () => { const s = read(); return s ? resolve(s.phone) : null; },
  };
})();

// lo que cambia un integrante (perfil o foto) se ve al momento en las demás pestañas abiertas de la familia
addEventListener('storage', e => {
  if (!['navi.profiles', 'navi.photos'].includes(e.key)) return;
  if (document.activeElement?.matches('input,textarea,select')) return; // no interrumpir a quien está escribiendo
  location.reload();
});
