// Navi Ride · viajes compartidos entre ciudades para clientes Navi (datos compartidos por la app y Navi Central).
// Solo se comparten gastos: el precio por asiento no puede pasar del costo estimado de gasolina y casetas.
// DEMO: viajes de ejemplo con conductores ficticios + lo que se publica y reserva en este navegador.
// En producción: servidor con los viajes, pagos con retención hasta terminar el viaje y verificación de INE.

const RIDE_CITIES = {
  cdmx: { n: 'Ciudad de México', lat: 19.43, lng: -99.13, meet: ['Metro Taxqueña', 'Metro Observatorio', 'Indios Verdes', 'Metro San Lázaro', 'Metro Universidad'] },
  pue:  { n: 'Puebla', lat: 19.04, lng: -98.21, meet: ['CAPU', 'Angelópolis', 'Centro (Zócalo)'] },
  qro:  { n: 'Querétaro', lat: 20.59, lng: -100.39, meet: ['Terminal de autobuses', 'Plaza Antea', 'Centro'] },
  cva:  { n: 'Cuernavaca', lat: 18.92, lng: -99.23, meet: ['Glorieta de la Paloma', 'Plaza Galerías', 'Centro'] },
  tol:  { n: 'Toluca', lat: 19.29, lng: -99.66, meet: ['Terminal de Toluca', 'Galerías Metepec', 'Centro'] },
  pac:  { n: 'Pachuca', lat: 20.10, lng: -98.76, meet: ['Reloj Monumental', 'Plaza Gran Patio', 'Terminal'] },
  mor:  { n: 'Morelia', lat: 19.70, lng: -101.19, meet: ['Catedral', 'Plaza Las Américas', 'Terminal'] },
  gdl:  { n: 'Guadalajara', lat: 20.67, lng: -103.35, meet: ['Minerva', 'Plaza del Sol', 'Nueva Central'] },
};
// distancia por carretera aproximada (línea recta × 1.25)
const rideKm = (a, b) => {
  const A = RIDE_CITIES[a], B = RIDE_CITIES[b], r = Math.PI / 180;
  const h = Math.sin((B.lat - A.lat) * r / 2) ** 2 + Math.cos(A.lat * r) * Math.cos(B.lat * r) * Math.sin((B.lng - A.lng) * r / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 1.25);
};
const rideMins = km => Math.round(km / 80 * 60 + 15);
// costo estimado del viaje: gasolina (~$2/km) + casetas (~$1.6/km); se reparte entre conductor y pasajeros
const rideCost = km => Math.round(km * 3.6);
const rideSuggest = (km, seats) => Math.max(40, Math.round(rideCost(km) / (seats + 1) / 10) * 10);
const rideMax = (km, seats) => Math.round(rideSuggest(km, seats) * 1.25 / 10) * 10;
const RIDE_FEE = 0.1; // cuota de servicio de Navi Ride sobre lo que paga el pasajero

// ---------- viajes de ejemplo (conductores ficticios, verificados por su línea Navi) ----------
const RIDE_DRIVERS = [
  ['Marisol R.', 4.9, 128, 'Nissan Versa gris', '👩'], ['Andrés P.', 4.8, 64, 'Mazda 3 azul', '👨'], ['Lupita G.', 5.0, 210, 'Honda City blanco', '👩'],
  ['Rodrigo M.', 4.7, 39, 'VW Jetta negro', '🧔'], ['Fernanda T.', 4.9, 97, 'Kia Rio rojo', '👩‍🦱'], ['Héctor S.', 4.6, 22, 'Chevrolet Aveo plata', '👨‍🦳'],
  ['Daniela C.', 4.8, 75, 'Toyota Yaris blanco', '👩'], ['Iván L.', 4.9, 143, 'Nissan Sentra gris', '🧑'],
];
function rideSeeds() {
  const routes = [['cdmx', 'pue'], ['pue', 'cdmx'], ['cdmx', 'qro'], ['qro', 'cdmx'], ['cdmx', 'cva'], ['cva', 'cdmx'], ['cdmx', 'tol'], ['cdmx', 'pac'], ['cdmx', 'mor'], ['cdmx', 'gdl']];
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const out = [];
  let s = 7;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let d = 0; d < 4; d++) routes.forEach(([a, b], i) => {
    // misma fecha y ruta → mismo viaje, sin importar qué día se abra la app
    const day = new Date(day0); day.setDate(day.getDate() + d); s = (day.getFullYear() * 400 + day.getMonth() * 31 + day.getDate()) * 17 + i * 101;
    const times = (i < 6 ? [7, 13, 18] : [9, 17]).filter(() => rnd() > .25);
    times.forEach((h, k) => {
      const dr = RIDE_DRIVERS[(i + k + day.getDate()) % RIDE_DRIVERS.length], km = rideKm(a, b), seats = 2 + Math.floor(rnd() * 3);
      const at = new Date(day0); at.setDate(at.getDate() + d); at.setHours(h, [0, 15, 30, 45][Math.floor(rnd() * 4)]);
      if (at < Date.now() + 30 * 60e3) return;
      out.push({ id: `S${at.getMonth() + 1}${at.getDate()}-${i}${k}`, seed: true, from: a, to: b, at: +at, seats, price: rideSuggest(km, seats) + (rnd() > .6 ? 10 : 0),
        instant: rnd() > .4, driver: dr[0], rating: dr[1], trips: dr[2], car: dr[3], emo: dr[4], driverPhone: null,
        meet: RIDE_CITIES[a].meet[Math.floor(rnd() * RIDE_CITIES[a].meet.length)], drop: RIDE_CITIES[b].meet[0],
        prefs: { smoke: false, pets: rnd() > .55, music: rnd() > .3, back2: rnd() > .5 }, notes: '' });
    });
  });
  return out;
}
const RideStore = (() => {
  const KEY = 'navi.ride';
  const read = () => { try { return { trips: [], bookings: [], reviews: [], ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { trips: [], bookings: [], reviews: [] }; } };
  const write = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
  const upd = fn => { const d = read(); const r = fn(d); write(d); return r; };
  return {
    KEY, read, upd,
    trips: () => [...rideSeeds(), ...read().trips.filter(t => !t.canceled)],
    // cada reserva guarda una copia del viaje (snap): los viajes de ejemplo se vuelven a generar cada día
    trip: id => read().trips.find(t => t.id === id) || read().bookings.find(b => b.trip === id)?.snap || rideSeeds().find(t => t.id === id),
    bookings: () => read().bookings,
    taken: id => read().bookings.filter(b => b.trip === id && ['confirmada', 'pendiente', 'terminada'].includes(b.status)).reduce((s, b) => s + b.seats, 0),
  };
})();
