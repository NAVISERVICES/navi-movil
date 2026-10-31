// Planes y precios (MXN), compartidos por la página principal y la compra.
const PERIODS = {
  m: { label: 'Mensual', per: 'al mes', months: 1 },
  t: { label: 'Trimestral', per: 'cada 3 meses', months: 3 },
  s: { label: 'Semestral', per: 'cada 6 meses', months: 6 },
  a: { label: 'Anual', per: 'al año', months: 12 },
};
const PLANS = [
  { gb: 2,  color: 'p-yellow', prices: { m: 129.99 } },
  { gb: 4,  color: 'p-teal',   prices: { m: 169.99, t: 459.99 } },
  { gb: 12, color: 'p-purple', prices: { m: 239.99, t: 629.99, s: 1199, a: 2299 } },
  { gb: 24, color: 'p-coral',  prices: { m: 289.99, t: 779.99, s: 1499, a: 2899 } },
];
const FAMILY_STEP = 0.05; // 5% por cada línea agregada después de la primera
const MAX_LINES = 4;
const familyDiscount = lines => FAMILY_STEP * (lines - 1);
const round2 = n => Math.round(n * 100) / 100;
const money = n => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

// promo de portabilidad: GB multiplicados durante 12 meses si traes tu número desde estas compañías
const PORTA_BONUS = { 2: 2, 4: 3, 12: 3, 24: 3 };
const PORTA_FROM = ['Telcel', 'AT&T', 'Movistar', 'Unefon', 'Virgin Mobile'];
const PORTA_MONTHS = 12;
const portaGb = gb => gb * (PORTA_BONUS[gb] || 1);
const portaWord = gb => PORTA_BONUS[gb] === 2 ? 'el doble' : PORTA_BONUS[gb] === 3 ? 'el triple' : '';
// "regalo de bienvenida": los GB extra se muestran aparte de los GB del plan, nunca sumados en el número grande
const portaGift = gb => portaGb(gb) - gb;
// mes del regalo (1 a 12) desde que el número quedó en Navi; 0 si ya terminó o no ha empezado
const giftMonth = since => {
  const s = new Date(since), n = new Date();
  const m = (n.getFullYear() - s.getFullYear()) * 12 + n.getMonth() - s.getMonth() + (n.getDate() >= s.getDate() ? 1 : 0);
  return m >= 1 && m <= PORTA_MONTHS ? m : 0;
};

// roaming internacional en Estados Unidos y Canadá (uso justo): GB para usar allá, hasta 15 días
const ROAMING = { 12: 4, 24: 8 };
const ROAMING_DAYS = 15;
const roamingTxt = gb => ROAMING[gb] ? `${ROAMING[gb]} GB en EE. UU. y Canadá, hasta ${ROAMING_DAYS} días` : '';
const ROAMING_POLICY = `Uso justo: el roaming internacional funciona en Estados Unidos y Canadá hasta ${ROAMING_DAYS} días, con ${ROAMING[12]} GB en el plan de 12 GB y ${ROAMING[24]} GB en el de 24 GB. Tu línea debe estar activa en México.`;

// precio de un pedido: plan individual o Plan Familia (mismo plan para todas las líneas, pesos cerrados)
const quote = ({ gb, per, lines = 1 }) => {
  const price = PLANS.find(p => p.gb === gb)?.prices[per];
  if (!price) return null;
  if (lines < 2) return { sub: price, off: 0, total: price };
  const exact = price * lines, sub = Math.round(exact), total = Math.round(exact * (1 - familyDiscount(lines)));
  return { sub, off: sub - total, total };
};
