// Catálogo de juegos y videos tomado de NAVI Store (navi-store.netlify.app), 28 oct 2026.
// Los juegos están copiados en juegos/ (30 oct 2026) y se abren aquí con la sesión de Mi Navi.

const svgIcon = body => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`);

const NAVI_GAMES = [
  { id: 'ruta', name: 'Ruta Chilanga', cat: 'Arcade', tier: 'basico', featured: true,
    desc: 'Recorre la CDMX en moto, de Reforma a Xochimilco, esquivando el tráfico.',
    badges: ['Gana MB', 'Récord'], url: '/juegos/ruta-chilanga.html',
    icon: svgIcon('<rect width="100" height="100" fill="#1F5E3A"/><path d="M30 0h40l22 100H8z" fill="#2B2D3A"/><path d="M50 4v12M50 26v14M50 50v16M50 76v20" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/><path d="M30 0 8 100M70 0l22 100" stroke="#C9C3B4" stroke-width="3"/><rect x="40" y="58" width="20" height="26" rx="8" fill="#E4007C"/><circle cx="50" cy="56" r="7" fill="#FFC23A"/><rect x="55" y="14" width="14" height="14" rx="3" fill="#2FD3E8"/>') },
  { id: 'raspa', name: 'Raspa y Gana', cat: 'Diario', tier: 'basico',
    desc: 'Tu boleto gratis de cada día. Raspa y descubre si te toca premio.',
    badges: ['Nuevo', '1 al día'], url: '/juegos/raspa-y-gana.html',
    icon: svgIcon('<rect width="100" height="100" fill="#C2D62E"/><path d="M14 30a6 6 0 0 1 6-6h60a6 6 0 0 1 6 6v10a8 8 0 0 0 0 16v14a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V56a8 8 0 0 0 0-16z" fill="#E4007C"/><rect x="24" y="34" width="52" height="32" rx="4" fill="#B9BCC8"/><path d="M26 58 40 44l8 8 14-14 12 10" fill="none" stroke="#FFF4E0" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><text x="64" y="64" font-family="Rubik,sans-serif" font-weight="800" font-size="13" fill="#2A1B3D">$</text>') },
  { id: 'loteria', name: 'Lotería NAVI', cat: 'Tradición', tier: 'basico',
    desc: 'La lotería de siempre con baraja NAVI, gritón con voz y tres rivales.',
    badges: ['Familia', 'Con voz'], url: '/juegos/loteria.html',
    icon: svgIcon('<rect width="100" height="100" fill="#E4007C"/><rect x="22" y="14" width="56" height="72" rx="6" fill="#FFF4E0"/><rect x="22" y="14" width="56" height="72" rx="6" fill="none" stroke="#8E004D" stroke-width="3"/><text x="29" y="28" font-family="Rubik,sans-serif" font-weight="800" font-size="10" fill="#2A1B3D">12</text><circle cx="50" cy="50" r="15" fill="#FFC23A"/><g stroke="#FFC23A" stroke-width="4" stroke-linecap="round"><path d="M50 28v-4M50 76v-4M28 50h-4M76 50h-4M35 35l-3-3M68 68l-3-3M65 35l3-3M35 65l-3 3"/></g><rect x="30" y="73" width="40" height="6" rx="3" fill="#2A1B3D" opacity=".75"/><ellipse cx="66" cy="62" rx="8" ry="6" transform="rotate(-20 66 62)" fill="#6B3B1F"/>') },
  { id: 'trivia', name: 'Trivia Mx', cat: 'Conocimiento', tier: 'basico',
    desc: '168 preguntas de fútbol, historia, comida, música y más.',
    badges: ['Gana MB', '7 categorías'], url: '/juegos/trivia-mx.html',
    icon: svgIcon('<rect width="100" height="100" fill="#2FD3E8"/><path d="M18 26a10 10 0 0 1 10-10h44a10 10 0 0 1 10 10v32a10 10 0 0 1-10 10H44l-16 14V68a10 10 0 0 1-10-10z" fill="#0E0F2E"/><text x="50" y="58" text-anchor="middle" font-family="Kanit,Rubik,sans-serif" font-style="italic" font-weight="700" font-size="40" fill="#C2D62E">?</text><circle cx="80" cy="80" r="9" fill="#E4007C"/><text x="80" y="84" text-anchor="middle" font-family="Rubik,sans-serif" font-weight="800" font-size="11" fill="#fff">MX</text>') },
  { id: 'memo', name: 'Memorama', cat: 'Familia', tier: 'basico',
    desc: 'Encuentra las parejas. Tres niveles y modo de 2 jugadores.',
    badges: ['2 jugadores', 'Gana MB'], url: '/juegos/memorama.html',
    icon: svgIcon('<rect width="100" height="100" fill="#FFC23A"/><g transform="rotate(-12 38 52)"><rect x="18" y="24" width="38" height="52" rx="6" fill="#1B237B"/><path d="M26 34h22M26 42h22M26 50h22M26 58h22M26 66h22" stroke="#2F3AA3" stroke-width="3"/></g><g transform="rotate(10 62 50)"><rect x="44" y="22" width="38" height="52" rx="6" fill="#FFF4E0" stroke="#E4007C" stroke-width="3"/><circle cx="63" cy="46" r="9" fill="#E4007C"/><path d="M57 60h12" stroke="#2A1B3D" stroke-width="4" stroke-linecap="round"/></g>') },
  { id: 'senal', name: 'Señal Total', cat: 'Arcade', tier: 'basico',
    desc: 'Atrapa los paquetes de datos con tu antena y esquiva las zonas sin señal.',
    badges: ['Gana MB', 'Rápido'], url: '/juegos/senal-total.html',
    icon: svgIcon('<rect width="100" height="100" fill="#0E0F2E"/><circle cx="50" cy="104" r="80" fill="#2FD3E8" opacity=".12"/><g fill="none" stroke="#2FD3E8" stroke-width="7" stroke-linecap="round"><path d="M28 44a30 30 0 0 1 44 0" opacity=".55"/><path d="M18 34a44 44 0 0 1 64 0" opacity=".3"/><path d="M37 54a16 16 0 0 1 26 0"/></g><circle cx="50" cy="62" r="6" fill="#E4007C"/><path d="M50 66 38 86h24z" fill="#fff"/><rect x="62" y="16" width="16" height="16" rx="4" fill="#FFC23A"/>') },
  { id: 'lucha', name: 'Lucha Libre NAVI', cat: 'Peleas · Torneo', tier: 'max',
    desc: 'Vence a 4 luchadores ilustrados con golpes, llaves, combos y la Señal Máxima.',
    badges: ['Premium', 'Torneo', 'Sonido'], url: '/max/lucha-libre.html',
    icon: 'games/lucha-thumb.jpg' },
];

const NAVI_CHANNELS = [
  { id: 'navimovil', name: 'NAVImovil', color: '#C2D62E', url: 'https://www.youtube.com/@NAVIMovil',
    desc: 'El canal oficial de NAVI: novedades, tutoriales y promociones.' },
  { id: 'lumina', name: 'Lumina Stories', color: '#FFC23A', url: 'https://www.youtube.com/@Lumina-us',
    desc: 'Cuentos animados para toda la familia, con valores y aventuras.' },
];

// videos destacados: { title, channel, yt: 'ID de YouTube' } (NAVI Store aún no tiene)
const NAVI_VIDEOS = [];

// /juegos/x.html y /max/x.html de NAVI Store viven en juegos/x.html
const gameUrl = g => 'juegos/' + g.url.split('/').pop();
