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
  // juegos originales de Navi Móvil (30 oct 2026)
  { id: 'penales', name: 'Penales Mundialistas', cat: 'Deportes', tier: 'basico',
    desc: 'Tira y ataja penales en un torneo de 4 rondas hasta levantar la Copa NAVI.',
    badges: ['Nuevo', 'Torneo'], url: '/juegos/penales.html',
    icon: svgIcon('<rect width="100" height="100" fill="#1F7A43"/><path d="M0 70h100" stroke="#fff" stroke-width="2" opacity=".6"/><path d="M16 22h68v40" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><path d="M16 22v40" stroke="#fff" stroke-width="5"/><path d="M20 26h60v36H20z" fill="#0b3f22" opacity=".55"/><g stroke="#ffffff40" stroke-width="1.5"><path d="M30 26v36M40 26v36M50 26v36M60 26v36M70 26v36M20 38h60M20 50h60"/></g><circle cx="50" cy="80" r="11" fill="#fff"/><path d="M50 74l5 3.5-2 6h-6l-2-6z" fill="#2A1B3D"/><circle cx="70" cy="40" r="5" fill="#FFC23A"/>') },
  { id: 'basta', name: '¡Basta!', cat: 'Palabras', tier: 'basico',
    desc: 'Sale una letra: nombre, apellido, animal, fruta y país antes de que se acabe el tiempo.',
    badges: ['Nuevo', 'Familia'], url: '/juegos/basta.html',
    icon: svgIcon('<rect width="100" height="100" fill="#FFF4E0"/><g stroke="#2FD3E8" stroke-width="2" opacity=".6"><path d="M10 34h80M10 50h80M10 66h80M10 82h80"/></g><path d="M22 10v86" stroke="#E4007C" stroke-width="2"/><rect x="50" y="8" width="38" height="38" rx="10" fill="#E4007C"/><text x="69" y="37" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="26" fill="#fff">B</text><text x="28" y="47" font-family="Rubik,sans-serif" font-weight="800" font-size="11" fill="#2A1B3D">Beto</text><text x="28" y="63" font-family="Rubik,sans-serif" font-weight="800" font-size="11" fill="#2A1B3D">Búho</text><text x="28" y="79" font-family="Rubik,sans-serif" font-weight="800" font-size="11" fill="#2A1B3D">Brasil</text>') },
  { id: 'pinata', name: 'Piñata Pop', cat: 'Arcade', tier: 'basico',
    desc: 'Pégale a la piñata justo en el centro, encadena rachas y junta todos los dulces.',
    badges: ['Nuevo', 'Récord'], url: '/juegos/pinata.html',
    icon: svgIcon('<rect width="100" height="100" fill="#7B5CFA"/><path d="M50 0v20" stroke="#C9A26B" stroke-width="3"/><g transform="translate(50 52)"><polygon points="0,-40 9,-14 -9,-14" fill="#E4007C"/><polygon points="38,-12 14,-4 10,-18" fill="#FFC23A"/><polygon points="24,32 8,12 20,4" fill="#2FD3E8"/><polygon points="-24,32 -20,4 -8,12" fill="#E4007C"/><polygon points="-38,-12 -10,-18 -14,-4" fill="#2BD67B"/><circle r="17" fill="#FFF4E0"/><text y="6" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="15" fill="#E4007C">N</text></g><text x="18" y="90" font-size="14">🍬</text><text x="70" y="94" font-size="14">🍭</text>') },
  { id: 'taquero', name: 'Taquero Express', cat: 'Destreza', tier: 'basico',
    desc: 'Arma los tacos que piden los clientes antes de que se desesperen. ¡Que no se junten!',
    badges: ['Nuevo', 'Récord'], url: '/juegos/taquero.html',
    icon: svgIcon('<rect width="100" height="100" fill="#FFC23A"/><ellipse cx="50" cy="80" rx="40" ry="6" fill="#0003"/><path d="M12 76 Q50 10 88 76 Z" fill="#F2B544" stroke="#C98A2B" stroke-width="3"/><g fill="#E4572E"><rect x="28" y="50" width="12" height="9" rx="3" transform="rotate(-12 34 54)"/><rect x="43" y="46" width="12" height="9" rx="3"/><rect x="58" y="50" width="12" height="9" rx="3" transform="rotate(12 64 54)"/></g><g fill="#2BB55B"><circle cx="36" cy="46" r="3"/><circle cx="52" cy="42" r="3"/><circle cx="64" cy="47" r="3"/></g><circle cx="45" cy="52" r="3" fill="#fff"/><circle cx="58" cy="44" r="3" fill="#fff"/><path d="M30 48 Q42 40 52 47 T72 47" fill="none" stroke="#3FA34D" stroke-width="4" stroke-linecap="round"/>') },
  { id: 'domino', name: 'Dominó NAVI', cat: 'Tradición', tier: 'basico',
    desc: 'Dominó clásico contra Tía Rosa, Primo Beto y la Abuela Chayo. Partida a 100 puntos.',
    badges: ['Nuevo', 'Familia'], url: '/juegos/domino.html',
    icon: svgIcon('<rect width="100" height="100" fill="#1F6B46"/><g transform="rotate(-14 50 50)"><rect x="30" y="14" width="40" height="72" rx="8" fill="#FFF4E0" stroke="#0003" stroke-width="2"/><path d="M34 50h32" stroke="#2A1B3D" stroke-width="2" opacity=".4"/><g fill="#2A1B3D"><circle cx="40" cy="24" r="4"/><circle cx="60" cy="24" r="4"/><circle cx="40" cy="32" r="4"/><circle cx="60" cy="32" r="4"/><circle cx="40" cy="40" r="4"/><circle cx="60" cy="40" r="4"/><circle cx="50" cy="68" r="4"/><circle cx="40" cy="60" r="4"/><circle cx="60" cy="76" r="4"/></g></g><circle cx="80" cy="18" r="9" fill="#E4007C"/><text x="80" y="22" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="10" fill="#fff">N</text>') },
  { id: 'sopa', name: 'Sopa de Letras Mx', cat: 'Palabras', tier: 'basico',
    desc: 'Encuentra palabras de comida, fiesta, naturaleza y lugares de México. Fácil o difícil.',
    badges: ['Nuevo', '2 niveles'], url: '/juegos/sopa.html',
    icon: svgIcon('<rect width="100" height="100" fill="#2FD3E8"/><rect x="12" y="12" width="76" height="76" rx="10" fill="#0E0F2E"/><g font-family="Rubik,sans-serif" font-weight="800" font-size="13" fill="#F3F1FF" text-anchor="middle"><text x="26" y="34">T</text><text x="42" y="34">A</text><text x="58" y="34">C</text><text x="74" y="34">O</text><text x="26" y="54">M</text><text x="42" y="54">X</text><text x="58" y="54">L</text><text x="74" y="54">E</text><text x="26" y="74">O</text><text x="42" y="74">P</text><text x="58" y="74">S</text><text x="74" y="74">R</text></g><rect x="17" y="21" width="66" height="18" rx="9" fill="none" stroke="#FFC23A" stroke-width="3"/><rect x="17" y="41" width="18" height="38" rx="9" fill="none" stroke="#E4007C" stroke-width="3"/>') },
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
