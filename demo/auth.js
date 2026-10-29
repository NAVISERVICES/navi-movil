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

// cuentas de demostración (números ficticios)
const NAVI_ACCOUNTS = {
  '5500000001': { name: 'Sofía Ramírez', img: 'sofi', plan: { type: 'individual', gb: 2,  period: 'm' },
    device: dev('128 GB', 'Azul oscuro', 'SIM física', '352914110473826') },
  '5500000002': { name: 'Luis Pérez',    img: 'beto', plan: { type: 'individual', gb: 12, period: 't' },
    device: dev('128 GB', 'Medianoche', 'eSIM', '353827119064512') },
  '5500000003': { name: 'Carla Ruiz',    img: 'mama', plan: { type: 'individual', gb: 24, period: 'a' },
    device: dev('256 GB', 'Azul náutico', 'SIM física', '356104230918475') },
  '5500000004': { name: 'Familia García', img: 'beto', plan: { type: 'familia', period: 'm', lines: [
    { name: 'Papá', img: 'beto', gb: 12, phone: '5500000004', device: dev('256 GB', 'Titanio natural', 'eSIM', '357221340556193') },
    { name: 'Mamá', img: 'mama', gb: 12, phone: '5500000005', device: dev('512 GB', 'Lavanda', 'SIM física', '350918221764038') },
    { name: 'Sofi', img: 'sofi', gb: 12, phone: '5500000006', device: dev('128 GB', 'Gris', 'SIM física', '861537040298114') },
    { name: 'Toño', img: 'tono', gb: 12, phone: '5500000007', device: dev('128 GB', 'Gris', 'SIM física', '359482170633521') },
  ] } },
};

const appsFor = plan => PLAN_ACCESS[plan.type === 'familia' ? 'familia' : plan.gb] || [];

// todas las líneas de una cuenta con la misma forma (individual = una sola línea)
const accountLines = user => user.plan.type === 'familia'
  ? user.plan.lines
  : [{ name: user.name.split(' ')[0], img: user.img, gb: user.plan.gb, phone: user.phone, device: user.device }];

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
  ? `${l.name} ${user.name.replace(/^Familia\s+/i, '')}` : user.name;
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
  return {
    find: phone => NAVI_ACCOUNTS[phone] || null,
    login: phone => { try { localStorage.setItem(KEY, JSON.stringify({ phone, at: Date.now() })); } catch {} },
    logout: () => { try { localStorage.removeItem(KEY); } catch {} },
    // devuelve la cuenta con sesión activa, o null
    current: () => {
      const s = read();
      const acc = s && NAVI_ACCOUNTS[s.phone];
      return acc ? { phone: s.phone, ...acc, apps: appsFor(acc.plan) } : null;
    },
  };
})();
