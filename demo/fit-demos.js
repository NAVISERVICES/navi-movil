// NAVI Fit · demostraciones animadas de cada ejercicio (sin personas reales): un maniquí articulado
// que repite el movimiento en bucle corto. Cada ejercicio es una serie de posturas clave; entre ellas
// se interpola y los codos y rodillas se calculan solos (cinemática inversa de dos huesos).
//   Postura: hip / neck = [x, y] (cadera y cuello), h = [mano lejana, mano cercana], f = [tobillo lejano, tobillo cercano],
//   toe = punta del pie relativa al tobillo (opcional). Lienzo 240 × 210 (y de -20 a 190), piso en y = 180.
const FitDemo = (() => {
  const LEN = { th: 40, sh: 40, ua: 30, fa: 28 };
  const STAND = { hip: [118, 98], neck: [120, 48], h: [[124, 104], [126, 104]], f: [[116, 176], [120, 176]] };
  const PUSH_TOP = { hip: [110, 140], neck: [158, 119], h: [[156, 176], [160, 176]], f: [[38, 172], [40, 172]], toe: [[5, 7], [5, 7]] };
  const PUSH_LOW = { hip: [116, 160], neck: [167, 152], h: [[156, 176], [160, 176]], f: [[38, 172], [40, 172]], toe: [[5, 7], [5, 7]] };
  const SQ_LOW = { hip: [90, 138], neck: [116, 94], h: [[170, 96], [172, 98]], f: [[116, 176], [120, 176]] };
  const CROUCH = { hip: [100, 146], neck: [144, 124], h: [[154, 176], [156, 176]], f: [[116, 176], [120, 176]] };
  const AIR = { hip: [118, 74], neck: [120, 24], h: [[130, -14], [134, -12]], f: [[116, 154], [120, 156]], toe: [[8, 8], [8, 8]] };
  const up = (p, dy) => ({ ...p, hip: [p.hip[0], p.hip[1] + dy], neck: [p.neck[0], p.neck[1] + dy], h: p.h.map(([x, y]) => [x, y + dy]), f: p.f.map(([x, y]) => [x, y + dy]) });

  // t = segundos por transición · loop: true = va de la última a la primera; si no, ida y vuelta
  const D = {
    sq: { t: .9, frames: [STAND, SQ_LOW] },
    jumpsq: { t: .5, frames: [SQ_LOW, AIR] },
    lunge: { t: 1, frames: [
      { hip: [120, 98], neck: [121, 48], h: [[126, 102], [128, 102]], f: [[112, 176], [126, 176]] },
      { hip: [116, 126], neck: [118, 76], h: [[124, 130], [126, 130]], f: [[80, 174], [158, 176]], toe: [[6, 6], [11, 3]] }] },
    bulg: { t: 1, props: ['chairL'], frames: [
      { hip: [112, 96], neck: [114, 46], h: [[118, 100], [120, 100]], f: [[70, 134], [150, 176]], toe: [[-9, 3], [11, 3]] },
      { hip: [108, 128], neck: [112, 78], h: [[116, 132], [118, 132]], f: [[70, 134], [150, 176]], toe: [[-9, 3], [11, 3]] }] },
    glute: { t: 1, frames: [
      { hip: [108, 170], neck: [60, 168], h: [[114, 174], [116, 174]], f: [[146, 176], [150, 176]] },
      { hip: [112, 134], neck: [66, 164], h: [[114, 174], [116, 174]], f: [[146, 176], [150, 176]] }] },
    wall: { t: 1.3, props: ['wall'], frames: [
      { hip: [76, 126], neck: [74, 76], h: [[104, 122], [108, 124]], f: [[118, 176], [122, 176]] },
      { hip: [76, 127], neck: [74, 78], h: [[104, 123], [108, 125]], f: [[118, 176], [122, 176]] }] },
    calf: { t: .7, frames: [STAND, { ...up(STAND, -9), toe: [[9, 12], [9, 12]] }] },
    push: { t: .9, frames: [PUSH_TOP, PUSH_LOW] },
    pushEasy: { t: .9, frames: [
      { hip: [116, 152], neck: [158, 121], h: [[156, 176], [160, 176]], f: [[49, 156], [51, 156]], toe: [[-9, -5], [-9, -5]] },
      { hip: [123, 168], neck: [174, 157], h: [[156, 176], [160, 176]], f: [[49, 156], [51, 156]], toe: [[-9, -5], [-9, -5]] }] },
    diamond: { t: .9, frames: [PUSH_TOP, PUSH_LOW] },
    dips: { t: 1, props: ['chairR'], frames: [
      { hip: [108, 128], neck: [100, 80], h: [[86, 136], [90, 136]], f: [[164, 176], [168, 176]] },
      { hip: [110, 156], neck: [102, 108], h: [[86, 136], [90, 136]], f: [[164, 176], [168, 176]] }] },
    pike: { t: 1, frames: [
      { hip: [98, 100], neck: [140, 124], h: [[150, 176], [152, 176]], f: [[70, 172], [72, 172]], toe: [[5, 7], [5, 7]] },
      { hip: [100, 104], neck: [128, 146], h: [[150, 176], [152, 176]], f: [[70, 172], [72, 172]], toe: [[5, 7], [5, 7]] }] },
    plank: { t: 1.4, frames: [
      { hip: [112, 150], neck: [160, 134], h: [[184, 176], [188, 176]], f: [[38, 172], [40, 172]], toe: [[5, 7], [5, 7]] },
      { hip: [112, 148], neck: [160, 133], h: [[184, 176], [188, 176]], f: [[38, 172], [40, 172]], toe: [[5, 7], [5, 7]] }] },
    sidepl: { t: 1.2, frames: [
      { hip: [110, 160], neck: [160, 146], h: [[186, 176], [164, 90]], f: [[32, 174], [34, 172]], toe: [[5, 6], [5, 6]] },
      { hip: [110, 150], neck: [160, 144], h: [[186, 176], [164, 88]], f: [[32, 174], [34, 172]], toe: [[5, 6], [5, 6]] }] },
    mc: { t: .32, frames: [
      { ...PUSH_TOP, f: [[38, 172], [118, 164]] },
      { ...PUSH_TOP, f: [[118, 164], [38, 172]] }] },
    jj: { t: .45, front: true, frames: [
      { hip: [120, 98], neck: [120, 48], h: [[98, 109], [142, 109]], f: [[112, 176], [128, 176]], toe: [[-5, 3], [5, 3]] },
      { hip: [120, 94], neck: [120, 44], h: [[100, -12], [140, -12]], f: [[92, 174], [148, 174]], toe: [[-5, 3], [5, 3]] }] },
    burpee: { t: .45, loop: true, frames: [STAND, CROUCH, PUSH_TOP, CROUCH, STAND, AIR] },
    legr: { t: 1.1, frames: [
      { hip: [112, 170], neck: [62, 168], h: [[118, 176], [120, 176]], f: [[190, 166], [192, 166]], toe: [[3, -10], [3, -10]] },
      { hip: [112, 170], neck: [62, 168], h: [[118, 176], [120, 176]], f: [[116, 92], [118, 92]], toe: [[10, -2], [10, -2]] }] },
    sup: { t: 1.2, frames: [
      { hip: [100, 170], neck: [150, 170], h: [[206, 172], [208, 172]], f: [[22, 172], [24, 172]], toe: [[-9, 4], [-9, 4]] },
      { hip: [100, 170], neck: [148, 158], h: [[200, 146], [202, 146]], f: [[24, 156], [26, 156]], toe: [[-9, 4], [-9, 4]] }] },
    hollow: { t: 1.4, frames: [
      { hip: [118, 172], neck: [72, 160], h: [[18, 150], [20, 150]], f: [[194, 158], [196, 158]], toe: [[6, -6], [6, -6]] },
      { hip: [118, 172], neck: [72, 157], h: [[18, 147], [20, 147]], f: [[194, 155], [196, 155]], toe: [[6, -6], [6, -6]] }] },
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (A, B, t) => {
    const pt = (a, b) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    const toeA = A.toe || [[11, 3], [11, 3]], toeB = B.toe || [[11, 3], [11, 3]];
    return { hip: pt(A.hip, B.hip), neck: pt(A.neck, B.neck), h: [pt(A.h[0], B.h[0]), pt(A.h[1], B.h[1])], f: [pt(A.f[0], B.f[0]), pt(A.f[1], B.f[1])], toe: [pt(toeA[0], toeB[0]), pt(toeA[1], toeB[1])] };
  };
  // dos huesos: raíz → articulación → extremo; s = de qué lado dobla
  const ik = (r, t, l1, l2, s) => {
    const dx = t[0] - r[0], dy = t[1] - r[1], d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + .01), l1 + l2 - .01);
    const a = Math.atan2(dy, dx), A = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const j = [r[0] + l1 * Math.cos(a + s * A), r[1] + l1 * Math.sin(a + s * A)];
    const ea = Math.atan2(t[1] - j[1], t[0] - j[0]);
    return [j, [j[0] + l2 * Math.cos(ea), j[1] + l2 * Math.sin(ea)]];
  };
  const C = { far: '#5E54C4', near: '#B3A6FF', torso: '#8E80F7', head: '#DCD4FF', joint: '#B4E32F' };
  const line = (a, b, col, w) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  const limb = (r, t, l1, l2, s, col, foot) => {
    const [j, e] = ik(r, t, l1, l2, s);
    return `<path d="M${r[0].toFixed(1)} ${r[1].toFixed(1)}L${j[0].toFixed(1)} ${j[1].toFixed(1)}L${e[0].toFixed(1)} ${e[1].toFixed(1)}" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<circle cx="${j[0].toFixed(1)}" cy="${j[1].toFixed(1)}" r="2.6" fill="${C.joint}" opacity=".9"/>`
      + (foot ? line(e, [e[0] + foot[0], e[1] + foot[1]], col, 8) : `<circle cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="5.5" fill="${col}"/>`);
  };
  const PROPS = {
    wall: `<rect x="40" y="-20" width="18" height="200" fill="#ffffff10"/><line x1="58" y1="-20" x2="58" y2="180" stroke="#ffffff40" stroke-width="2"/>`,
    chairL: `<g stroke="#ffffff55" stroke-width="4" stroke-linecap="round" fill="none"><path d="M30 138H84M34 138V180M80 138V180M30 138V92"/></g>`,
    chairR: `<g stroke="#ffffff55" stroke-width="4" stroke-linecap="round" fill="none"><path d="M36 138H92M40 138V180M88 138V180M36 138V90"/></g>`,
  };
  function svg(spec, P) {
    const fr = spec.front, sh = fr ? [[P.neck[0] - 13, P.neck[1] + 4], [P.neck[0] + 13, P.neck[1] + 4]] : [P.neck, P.neck];
    const hp = fr ? [[P.hip[0] - 7, P.hip[1]], [P.hip[0] + 7, P.hip[1]]] : [P.hip, P.hip];
    const dir = [P.neck[0] - P.hip[0], P.neck[1] - P.hip[1]], dl = Math.hypot(...dir) || 1;
    const head = [P.neck[0] + dir[0] / dl * 15, P.neck[1] + dir[1] / dl * 15];
    const cx = (P.hip[0] + P.neck[0]) / 2;
    const farC = fr ? C.near : C.far;
    // lado lejano detrás del torso, lado cercano enfrente
    return `<svg viewBox="0 -20 240 210" aria-hidden="true"><line x1="0" y1="180" x2="240" y2="180" stroke="#ffffff26" stroke-width="2"/>
      <ellipse cx="${cx.toFixed(1)}" cy="182" rx="62" ry="4" fill="#00000055"/>${(spec.props || []).map(k => PROPS[k]).join('')}
      ${limb(sh[0], P.h[0], LEN.ua, LEN.fa, fr ? -1 : 1, farC)}${limb(hp[0], P.f[0], LEN.th, LEN.sh, fr ? 1 : -1, farC, P.toe[0])}
      ${line(P.hip, P.neck, C.torso, 20)}<circle cx="${P.hip[0].toFixed(1)}" cy="${P.hip[1].toFixed(1)}" r="10" fill="${C.torso}"/>
      <circle cx="${head[0].toFixed(1)}" cy="${head[1].toFixed(1)}" r="11.5" fill="${C.head}"/>
      ${limb(hp[1], P.f[1], LEN.th, LEN.sh, -1, C.near, P.toe[1])}${limb(sh[1], P.h[1], LEN.ua, LEN.fa, fr ? 1 : 1, C.near)}</svg>`;
  }
  // postura en el tiempo t (segundos)
  function at(spec, t) {
    const F = spec.frames, seq = spec.loop ? [...F, F[0]] : [...F, ...F.slice(0, -1).reverse()];
    // (el primer cuadro puede llegar con t un poco negativo)
    const n = seq.length - 1, cyc = n * spec.t, u = (((t % cyc) + cyc) % cyc) / spec.t, i = Math.min(n - 1, Math.floor(u)), k = u - i;
    const e = .5 - .5 * Math.cos(Math.PI * k); // suave al entrar y salir
    return mix(seq[i], seq[i + 1], e);
  }
  const live = new Set();
  let raf = 0;
  const loop = now => {
    live.forEach(m => { if (!m.el.isConnected) return live.delete(m); m.el.innerHTML = svg(m.spec, at(m.spec, (now - m.t0) / 1000)); });
    raf = live.size ? requestAnimationFrame(loop) : 0;
  };
  return {
    has: k => !!D[k],
    keys: () => Object.keys(D),
    // postura fija en el momento t (para revisar o para miniaturas)
    still: (key, t) => svg(D[key], at(D[key], t)),
    // postura clave i tal cual
    pose: (key, i) => svg(D[key], { toe: [[11, 3], [11, 3]], ...D[key].frames[i] }),
    // easy = variante de principiante si existe
    mount(el, key, easy) {
      const spec = (easy && D[key + 'Easy']) || D[key];
      if (!spec) return false;
      live.add({ el, spec, t0: performance.now() });
      el.innerHTML = svg(spec, at(spec, 0));
      if (!raf) raf = requestAnimationFrame(loop);
      return true;
    },
  };
})();
