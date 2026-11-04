// Navi · verificación de identidad: la confianza de todo el ecosistema, en 3 niveles.
//  Nivel 1 · Línea Navi: automático (línea activa + código por SMS al entrar). Mi Navi, recargas, Fit, Pet…
//  Nivel 2 · Identidad verificada ✓: CURP (RENAPO) + INE frente y reverso + selfie con prueba de vida, una sola vez
//            (unos 2 minutos). La selfie se vuelve su foto de perfil y se regala 1 GB. Desbloquea Navi Ride y Navi Conecta.
//  Nivel 3 · Confianza Navi: se gana con el uso (antigüedad, pagos puntuales, viajes, conductor verificado).
//  Menores de edad: no se verifican con foto; los avala el titular del Plan Familia y no usan Ride ni Conecta.
//  NAVI SOS nunca se bloquea: en una emergencia no se pide nada.
// DEMO: todo vive en este navegador y la validación se simula. En producción la hace un proveedor de verificación
// (p. ej. Truora, Incode o MetaMap) contra RENAPO y el INE; los documentos se guardan cifrados en el servidor
// y nadie los ve sin un motivo que quede en la auditoría.
const NaviVerify = (() => {
  const KEY = 'navi.verify';
  const MINORS = ['5500000006', '5500000007'];
  // cuentas demo ya verificadas (para probar Navi Ride entre dos cuentas); Sofía (01) y Carla (03) aún no
  const SEED = { '5500000002': 70, '5500000004': 120, '5500000005': 95 };
  // DEMO: lo que "contestaría" RENAPO para las CURP de ejemplo
  const RENAPO = {
    GALJ850412HDFRPS09: 'José García López', LOHM870923MDFPRR02: 'María López Hernández', RATS950315MDFMRF07: 'Sofía Ramírez Torres',
    PEGL900101HDFRMS03: 'Luis Pérez Gómez', RUMC920718MDFZNR05: 'Carla Ruiz Mendoza',
  };
  const SAMPLE = { '5500000004': 'GALJ850412HDFRPS09', '5500000005': 'LOHM870923MDFPRR02', '5500000001': 'RATS950315MDFMRF07', '5500000002': 'PEGL900101HDFRMS03', '5500000003': 'RUMC920718MDFZNR05' };
  // la selfie y la INE son datos personales sensibles (biométricos): se piden con consentimiento expreso y por escrito
  // (LFPDPPP). En producción el texto completo lo redacta el abogado y la versión aceptada queda guardada.
  const AVISO_V = '2026-11';
  const AVISO = `<b>Aviso de privacidad (resumen)</b><br>Responsable: Navi Móvil. Datos: CURP, imagen de tu INE y una selfie (dato biométrico sensible).
    Para qué: solo verificar que eres tú y evitar fraudes y perfiles falsos en Navi. No se usan para publicidad ni se venden.
    Con quién: el proveedor de verificación que valida contra RENAPO y el INE, y autoridades si la ley lo pide.
    Tus derechos ARCO: acceder, corregir, cancelar u oponerte, y revocar este consentimiento escribiendo a privacidad@navimovil.com.
    Al cancelar se borran tus documentos y pierdes el sello ✓.`;
  const CURP_RE =/^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;

  const all = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const get = phone => {
    const a = all();
    if (a[phone]) return a[phone];
    if (MINORS.includes(phone)) return { status: 'minor' };
    if (SEED[phone]) return { status: 'ok', at: Date.now() - SEED[phone] * 864e5, method: 'auto', score: 96, seed: true,
      driver: phone === '5500000004' ? { status: 'ok', at: Date.now() - 100 * 864e5, plate: 'NVR-482-A' } : null };
    return { status: 'none' };
  };
  const set = (phone, patch) => {
    const a = all(); a[phone] = { ...get(phone), ...patch, upd: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(a)); return true; } catch { return false; }
  };
  const ok = phone => get(phone).status === 'ok';
  const minor = phone => get(phone).status === 'minor';
  const driverOk = phone => ok(phone) && get(phone).driver?.status === 'ok';
  const since = phone => NaviAuth.find(phone)?.plan.since;
  // insignias que se ganan solas con el uso
  const badges = phone => {
    const r = get(phone), m = monthsWith(since(phone)), out = [];
    if (r.status === 'ok') out.push(['✓', 'Identidad verificada']);
    if (r.status === 'minor') out.push(['👨‍👩‍👧', 'Avalado por su familia']);
    if (m >= 1) out.push(['📅', m >= 12 ? `${Math.floor(m / 12)} ${m >= 24 ? 'años' : 'año'} en Navi` : `${m} ${m === 1 ? 'mes' : 'meses'} en Navi`]);
    if (m >= 3) out.push(['💳', 'Pagos puntuales']);
    if (typeof RideStore !== 'undefined') {
      const n = RideStore.bookings().filter(b => b.phone === phone && b.status === 'terminada').length;
      if (n) out.push(['🚗', `${n} ${n === 1 ? 'viaje' : 'viajes'} en Navi Ride`]);
    }
    if (r.driver?.status === 'ok') out.push(['🪪', 'Conductor verificado']);
    return out;
  };
  // nivel 3: identidad verificada + 3 meses o más con pagos al corriente
  const level = phone => !ok(phone) ? 1 : monthsWith(since(phone)) >= 3 ? 3 : 2;
  const LEVELS = { 1: ['📶', 'Línea Navi'], 2: ['✓', 'Identidad verificada'], 3: ['⭐', 'Confianza Navi'] };
  const tag = phone => ok(phone) ? `<span class="nv-tag ok">✓ Identidad verificada</span>`
    : minor(phone) ? `<span class="nv-tag">👨‍👩‍👧 Avalado por su familia</span>` : `<span class="nv-tag">📶 Línea Navi</span>`;

  // ---------- estilos (una sola vez) ----------
  const css = () => {
    if (document.getElementById('nvCss')) return;
    const s = document.createElement('style'); s.id = 'nvCss';
    s.textContent = `
.nv-tag{display:inline-block;font-size:11px;font-weight:800;padding:3px 8px;border-radius:99px;background:#ffffff14;color:#D9D7FF;white-space:nowrap}
.nv-tag.ok{background:#2BD67B26;color:#7BF0AE}
.nv-ov{position:fixed;inset:0;z-index:150;background:#03031ae0;display:grid;place-items:center;padding:16px;overflow:auto;font-family:"DM Sans",system-ui,sans-serif;color:#F4F3FF}
.nv-box{width:min(460px,100%);background:#15156E;border:1px solid #ffffff2a;border-radius:26px;padding:24px;position:relative;max-height:calc(100dvh - 32px);overflow:auto}
.nv-box h2{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:24px;line-height:1.15;margin:4px 0 8px}
.nv-box p{color:#B9B7E6;font-size:14px;margin:0 0 12px}
.nv-x{position:absolute;top:14px;right:16px;background:none;border:0;color:#B9B7E6;font-size:20px;cursor:pointer}
.nv-prog{display:flex;gap:6px;margin:0 30px 14px 0}.nv-prog i{flex:1;height:6px;border-radius:99px;background:#ffffff1f}.nv-prog i.on{background:#B4E32F}
.nv-k{font-size:11px;font-weight:800;letter-spacing:.12em;color:#B4E32F}
.nv-btn{display:flex;width:100%;justify-content:center;align-items:center;gap:8px;margin-top:10px;background:#B4E32F;color:#06062E;border:0;border-radius:99px;padding:13px;font:800 15px "DM Sans",system-ui,sans-serif;cursor:pointer}
.nv-btn.gh{background:#ffffff14;color:#F4F3FF}.nv-btn:disabled{opacity:.45;cursor:default}
.nv-lnk{background:none;border:0;color:#B9B7E6;font-size:13px;text-decoration:underline;cursor:pointer;padding:6px;display:block;margin:6px auto 0}
.nv-in{width:100%;background:#ffffff10;border:2px solid #ffffff26;border-radius:12px;padding:12px;color:#F4F3FF;font:700 17px "DM Sans",system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;box-sizing:border-box}
.nv-in:focus{outline:none;border-color:#B4E32F}
.nv-err{color:#FF9EB0;font-size:13px;min-height:18px;margin-top:6px}
.nv-list{display:grid;gap:10px;margin:14px 0}.nv-list>div{display:flex;gap:12px;align-items:center;background:#ffffff0c;border-radius:14px;padding:10px 12px;font-size:14px}
.nv-list b{display:block}.nv-list small{display:block;color:#B9B7E6;font-size:12px}.nv-list>div>span{font-size:22px;flex:none}
.nv-docs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
.nv-doc{aspect-ratio:1.58;border:2px dashed #ffffff40;border-radius:14px;display:grid;place-items:center;text-align:center;font-size:12px;font-weight:700;color:#B9B7E6;background:#ffffff08 center/cover;cursor:pointer;padding:6px}
.nv-doc.ok{border:2px solid #B4E32F}
.nv-cam{position:relative;width:240px;height:300px;margin:6px auto 10px;border-radius:50%;overflow:hidden;background:#0b0b3a;border:4px solid #ffffff30}
.nv-cam.ok{border-color:#B4E32F}.nv-cam video,.nv-cam img{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
.nv-cam .face{position:absolute;inset:0;display:grid;place-items:center;font-size:110px;transition:transform .5s}
.nv-say{text-align:center;font-weight:800;font-size:18px;min-height:26px}
.nv-bar{height:6px;border-radius:99px;background:#ffffff1f;overflow:hidden;margin:8px 0}.nv-bar i{display:block;height:100%;width:0;background:#B4E32F;transition:width .25s linear}
.nv-spin{width:54px;height:54px;border-radius:50%;border:5px solid #ffffff22;border-top-color:#B4E32F;margin:18px auto;animation:nvs 1s linear infinite}@keyframes nvs{to{transform:rotate(360deg)}}
.nv-big{font-size:56px;text-align:center;line-height:1;margin:6px 0}
.nv-kv{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:14px;background:#ffffff0c;border-radius:14px;padding:12px;margin:10px 0}.nv-kv span{color:#B9B7E6}.nv-kv b{text-align:right}
.nv-priv{font-size:12px;color:#B9B7E6;background:#ffffff0a;border-radius:12px;padding:10px 12px;margin-top:12px}
.nv-ok{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:#D9D7FF;background:#ffffff0a;border-radius:12px;padding:10px 12px;margin-top:4px;cursor:pointer}
.nv-ok input{width:20px;height:20px;flex:none;accent-color:#B4E32F;margin-top:1px}.nv-ok a{color:#B4E32F;text-decoration:underline}
.nv-badges{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:10px 0}`;
    document.head.append(s);
  };

  // ---------- ventana del flujo ----------
  let ov = null;
  const close = () => { stopCam(); ov?.remove(); ov = null; document.body.style.overflow = ''; };
  const box = (html, step) => {
    css();
    if (!ov) { ov = document.createElement('div'); ov.className = 'nv-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); document.body.append(ov); document.body.style.overflow = 'hidden'; }
    ov.innerHTML = `<div class="nv-box"><button class="nv-x" data-nvx aria-label="Cerrar">✕</button>${step ? `<div class="nv-prog">${[1, 2, 3].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div><span class="nv-k">PASO ${step} DE 3</span>` : ''}${html}</div>`;
    ov.querySelector('[data-nvx]').onclick = close;
    return ov.querySelector('.nv-box');
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const curpBirth = c => { const yy = +c.slice(4, 6), cen = /\d/.test(c[16]) ? 1900 : 2000; return new Date(cen + yy, +c.slice(6, 8) - 1, +c.slice(8, 10)); };
  const ageAt = d => { const n = new Date(); return n.getFullYear() - d.getFullYear() - ((n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) ? 1 : 0); };
  const firstName = u => (u.me?.fullName || u.me?.name || u.name || '').split(' ')[0];

  // reduce una imagen (archivo o canvas) a JPEG pequeño para guardarla
  const shrink = (src, w, h) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const s = Math.max(w / im.width, h / im.height), dw = im.width * s, dh = im.height * s;
      c.getContext('2d').drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
      res(c.toDataURL('image/jpeg', .8));
    };
    im.onerror = () => rej(new Error('No pudimos leer esa imagen.'));
    im.src = src;
  });
  const fileUrl = f => new Promise((res, rej) => { if (!f || !f.type.startsWith('image/')) return rej(new Error('Elige una foto (JPG o PNG).')); const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  // INE de ejemplo para la demo (credencial ficticia con marca DEMO)
  const sampleId = (name, curp, back) => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 202; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 320, 202); gr.addColorStop(0, '#f3e9f5'); gr.addColorStop(1, '#d8e6f3'); g.fillStyle = gr; g.fillRect(0, 0, 320, 202);
    g.fillStyle = '#7a2d5a'; g.fillRect(0, 0, 320, 26); g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.fillText('CREDENCIAL PARA VOTAR · EJEMPLO', 12, 18);
    g.fillStyle = '#333';
    if (!back) {
      g.fillStyle = '#c9c4d6'; g.fillRect(14, 40, 78, 98); g.font = '46px sans-serif'; g.fillText('🙂', 30, 106);
      g.fillStyle = '#333'; g.font = '9px sans-serif'; g.fillText('NOMBRE', 104, 48); g.font = 'bold 12px sans-serif';
      (name || '').toUpperCase().split(' ').forEach((w, i) => g.fillText(w, 104, 64 + i * 14));
      g.font = '9px sans-serif'; g.fillText('CURP', 104, 122); g.font = 'bold 11px monospace'; g.fillText(curp || '', 104, 136);
      g.font = '9px sans-serif'; g.fillText('VIGENCIA 2024 - 2034', 104, 158);
    } else {
      g.font = 'bold 11px monospace'; ['IDMEX2049381753<<0471', '8504128H3412316MEX<04<<', 'GARCIA<LOPEZ<<JOSE<<<<<'].forEach((l, i) => g.fillText(l, 16, 140 + i * 16));
      g.fillStyle = '#222'; for (let i = 0; i < 40; i++) g.fillRect(200 + (i % 10) * 10, 40 + Math.floor(i / 10) * 18, 6 + (i * 7) % 4, 12);
    }
    g.save(); g.translate(160, 101); g.rotate(-.35); g.font = 'bold 54px sans-serif'; g.fillStyle = '#e0306a33'; g.textAlign = 'center'; g.fillText('DEMO', 0, 18); g.restore();
    return c.toDataURL('image/jpeg', .8);
  };

  // ---------- cámara ----------
  let stream = null;
  const stopCam = () => { stream?.getTracks().forEach(t => t.stop()); stream = null; };

  // ---------- flujo de verificación ----------
  // opts: { onDone(), mode: 'full' | 'photo' (solo nueva selfie para cambiar la foto de perfil) }
  function start(user, opts = {}) {
    const phone = user.phone, r = get(phone);
    if (r.status === 'minor') return minorScreen(user);
    if (opts.mode === 'photo') return selfie(user, { ...opts, draft: {} });
    const draft = r.draft || {};
    if (draft.step === 'ine' && draft.curp) return ine(user, { ...opts, draft, resumed: true });
    if (draft.step === 'selfie' && draft.ineF) return selfie(user, { ...opts, draft, resumed: true });
    intro(user, opts);
  }
  const save = (user, draft) => set(user.phone, { draft });

  function intro(user, opts) {
    const b = box(`<div class="nv-big">🪪</div><h2 style="text-align:center">Verifica tu identidad</h2>
      <p style="text-align:center">Una sola vez, unos 2 minutos. Con esto los demás clientes Navi saben que eres tú de verdad.</p>
      <div class="nv-list"><div><span>🔢</span><div><b>Tu CURP</b><small>Traemos tu nombre oficial de RENAPO: no lo tecleas.</small></div></div>
        <div><span>🪪</span><div><b>Tu INE, frente y reverso</b><small>Leemos los datos solos.</small></div></div>
        <div><span>🤳</span><div><b>Una selfie con prueba de vida</b><small>Parpadeas y giras la cabeza. Será tu foto de perfil.</small></div></div></div>
      <div class="nv-list" style="margin-top:0"><div style="background:#B4E32F1f"><span>🎁</span><div><b>Te regalamos 1 GB</b><small>Al terminar, directo a tu línea.</small></div></div></div>
      <label class="nv-ok"><input type="checkbox" id="nvConsent"><span>Autorizo a Navi Móvil a tratar mis <b>datos biométricos</b> (mi selfie y la foto de mi INE) y mi CURP solo para verificar mi identidad, conforme al <a href="#" id="nvAviso">aviso de privacidad</a>. Puedo pedir que se borren cuando quiera.</span></label>
      <button class="nv-btn" data-go disabled>Empezar</button><button class="nv-lnk" data-later>Después</button>
      <div class="nv-priv" id="nvAvisoTxt">🔒 Tus documentos se guardan cifrados y nadie los ve. Los demás solo ven “${esc(firstName(user))} ✓ Identidad verificada”, nunca tu número, tu CURP ni tu INE.</div>`);
    const go = b.querySelector('[data-go]');
    b.querySelector('#nvConsent').onchange = e => { go.disabled = !e.target.checked; };
    b.querySelector('#nvAviso').onclick = e => { e.preventDefault(); b.querySelector('#nvAvisoTxt').innerHTML = AVISO; };
    go.onclick = () => { set(user.phone, { consent: { at: Date.now(), v: AVISO_V } }); curp(user, opts); };
    b.querySelector('[data-later]').onclick = close;
  }

  function curp(user, opts) {
    const draft = { step: 'curp' };
    const b = box(`<h2>¿Cuál es tu CURP?</h2><p>La validamos con RENAPO y traemos tu nombre tal como está registrado.</p>
      <input class="nv-in" id="nvCurp" maxlength="18" placeholder="18 caracteres" autocomplete="off" spellcheck="false">
      <div class="nv-err" id="nvErr"></div>
      ${SAMPLE[user.phone] ? `<button class="nv-lnk" id="nvSample" style="margin:0">Usar mi CURP de ejemplo (demo)</button>` : ''}
      <button class="nv-btn" id="nvGo">Validar CURP</button>
      <p style="font-size:12px;margin-top:10px">¿No te la sabes? Búscala en gob.mx/curp.</p>`, 1);
    const inp = b.querySelector('#nvCurp'), err = b.querySelector('#nvErr');
    inp.focus();
    inp.oninput = () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); err.textContent = ''; };
    b.querySelector('#nvSample')?.addEventListener('click', () => { inp.value = SAMPLE[user.phone]; });
    b.querySelector('#nvGo').onclick = async () => {
      const c = inp.value;
      if (c.length < 18) return err.textContent = 'Tu CURP tiene 18 caracteres.';
      if (!CURP_RE.test(c)) return err.textContent = 'Revisa tu CURP: no tiene el formato correcto.';
      const birth = curpBirth(c);
      box(`<div class="nv-spin"></div><h2 style="text-align:center">Consultando RENAPO…</h2><p style="text-align:center">Validamos tu CURP con el Registro Nacional de Población.</p>`, 1);
      await wait(1300); if (!ov) return;
      if (ageAt(birth) < 18) { set(user.phone, { draft: null }); return minorScreen(user, true); }
      const name = RENAPO[c] || Profiles.get(user.phone).full || user.me?.fullName || 'Nombre registrado en RENAPO';
      const b2 = box(`<h2>¿Eres tú?</h2><p>Esto es lo que tiene RENAPO con tu CURP.</p>
        <div class="nv-kv"><span>Nombre</span><b>${esc(name)}</b><span>Nacimiento</span><b>${birth.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</b><span>Sexo</span><b>${{ H: 'Hombre', M: 'Mujer', X: 'No binario' }[c[10]]}</b><span>CURP</span><b>${c.slice(0, 4)}••••••${c.slice(-4)}</b></div>
        <button class="nv-btn" data-yes>Sí, soy yo</button><button class="nv-lnk" data-no>No soy yo · corregir CURP</button>`, 1);
      b2.querySelector('[data-yes]').onclick = () => { Object.assign(draft, { step: 'ine', curp: c, name, birth: +birth }); save(user, draft); ine(user, { ...opts, draft }); };
      b2.querySelector('[data-no]').onclick = () => curp(user, opts);
    };
  }

  function ine(user, opts) {
    const draft = opts.draft;
    const paint = () => {
      const b = box(`${opts.resumed ? '<p style="color:#B4E32F;font-weight:700;margin:8px 0">👋 Retomamos donde te quedaste.</p>' : ''}<h2>Tu INE, frente y reverso</h2>
        <p>Ponla sobre una mesa con buena luz, sin reflejos, que se vean las 4 esquinas.</p>
        <div class="nv-docs">${['ineF', 'ineB'].map((k, i) => `<label class="nv-doc ${draft[k] ? 'ok' : ''}" style="${draft[k] ? `background-image:url(${draft[k]})` : ''}">${draft[k] ? '' : `📷<br>${i ? 'Reverso' : 'Frente'}<br><small style="font-weight:500">Tomar foto</small>`}<input type="file" accept="image/*" capture="environment" data-k="${k}" hidden></label>`).join('')}</div>
        <div class="nv-err" id="nvErr"></div>
        <button class="nv-lnk" id="nvSample" style="margin:0">Usar INE de ejemplo (demo)</button>
        <button class="nv-btn" id="nvGo" ${draft.ineF && draft.ineB ? '' : 'disabled'}>Leer mi INE</button>`, 2);
      b.querySelectorAll('[data-k]').forEach(inp => inp.onchange = async () => {
        try { draft[inp.dataset.k] = await shrink(await fileUrl(inp.files[0]), 320, 202); save(user, draft); opts.resumed = false; paint(); }
        catch (e) { b.querySelector('#nvErr').textContent = e.message; }
      });
      b.querySelector('#nvSample').onclick = () => { draft.ineF = sampleId(draft.name, draft.curp); draft.ineB = sampleId(draft.name, draft.curp, true); save(user, draft); opts.resumed = false; paint(); };
      b.querySelector('#nvGo').onclick = async () => {
        box(`<div class="nv-spin"></div><h2 style="text-align:center">Leyendo tu INE…</h2><p style="text-align:center">Revisamos que sea original, que esté vigente y que coincida con tu CURP.</p>`, 2);
        await wait(1500); if (!ov) return;
        const b2 = box(`<h2>Tu INE está bien ✓</h2><div class="nv-list"><div><span>✅</span><div><b>Nombre y CURP coinciden</b><small>${esc(draft.name)}</small></div></div>
          <div><span>✅</span><div><b>Credencial vigente</b><small>Vigencia hasta 2034</small></div></div><div><span>✅</span><div><b>Sin señales de alteración</b><small>Hologramas y tipografía correctos</small></div></div></div>
          <button class="nv-btn" data-go>Último paso: tu selfie</button>`, 2);
        b2.querySelector('[data-go]').onclick = () => { draft.step = 'selfie'; save(user, draft); selfie(user, { ...opts, resumed: false }); };
      };
    };
    paint();
  }

  // selfie con prueba de vida: mira al frente, parpadea, gira a un lado y al otro
  const CHALLENGES = [['🙂', 'Mira al frente', 0], ['😑', 'Parpadea dos veces', 0], ['👈', 'Gira la cabeza a la izquierda', -18], ['👉', 'Ahora a la derecha', 18], ['😊', '¡Sonríe!', 0]];
  async function selfie(user, opts) {
    const draft = opts.draft, photoMode = opts.mode === 'photo';
    const b = box(`${opts.resumed ? '<p style="color:#B4E32F;font-weight:700;margin:8px 0">👋 Retomamos donde te quedaste.</p>' : ''}<h2>${photoMode ? 'Nueva foto de perfil' : 'Tu selfie'}</h2>
      <p>${photoMode ? 'Tu foto viene de tu verificación: para cambiarla toma una nueva selfie y la comparamos con tu INE.' : 'Pon tu cara dentro del óvalo, con buena luz y sin lentes oscuros ni gorra.'}</p>
      <div class="nv-cam" id="nvCam"><div class="face">🤳</div></div><div class="nv-say" id="nvSay">Preparando la cámara…</div><div class="nv-bar"><i id="nvBar"></i></div>
      <div class="nv-err" id="nvErr"></div><div id="nvAlt"></div>`, photoMode ? 0 : 3);
    const cam = b.querySelector('#nvCam'), say = b.querySelector('#nvSay'), bar = b.querySelector('#nvBar'), alt = b.querySelector('#nvAlt');
    let video = null;
    const altButtons = msg => {
      say.textContent = msg || '';
      alt.innerHTML = `<button class="nv-btn" id="nvSim">🎬 Simular la cámara (demo)</button><label class="nv-btn gh" style="box-sizing:border-box">📁 Subir una selfie<input type="file" accept="image/*" capture="user" id="nvUp" hidden></label>
        <p style="font-size:12px;margin-top:8px">Si subes una foto, sin prueba de vida, un especialista de Navi la revisa (en menos de 24 h).</p>`;
      alt.querySelector('#nvSim').onclick = () => run(true);
      alt.querySelector('#nvUp').onchange = async e => {
        try { const s = await shrink(await fileUrl(e.target.files[0]), 240, 300); finish(user, { ...opts, draft }, s, 'manual'); }
        catch (er) { b.querySelector('#nvErr').textContent = er.message; }
      };
    };
    const run = async sim => {
      alt.innerHTML = ''; cam.classList.remove('ok');
      const face = cam.querySelector('.face');
      if (sim) { stopCam(); cam.querySelector('video')?.remove(); face.style.display = ''; }
      let shot = null;
      for (let i = 0; i < CHALLENGES.length; i++) {
        const [e, t, rot] = CHALLENGES[i];
        say.textContent = t; if (sim) { face.textContent = e === '👈' || e === '👉' ? '🙂' : e; face.style.transform = `rotate(${rot}deg) translateX(${rot}px)`; }
        await wait(1500); if (!ov) return;
        bar.style.width = (i + 1) / CHALLENGES.length * 100 + '%';
        if (i === 0) shot = sim ? await simShot(user) : grab(video);
      }
      cam.classList.add('ok'); say.textContent = '✓ ¡Listo! Prueba de vida superada';
      stopCam(); await wait(600); if (!ov) return;
      finish(user, { ...opts, draft }, shot, sim ? 'sim' : 'camera');
    };
    if (!navigator.mediaDevices?.getUserMedia) return altButtons('Este navegador no permite usar la cámara aquí.');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false });
      if (!ov) return stopCam();
      video = document.createElement('video'); video.autoplay = true; video.muted = true; video.playsInline = true; video.srcObject = stream;
      cam.querySelector('.face').style.display = 'none'; cam.prepend(video);
      await video.play().catch(() => {});
      say.textContent = 'Pon tu cara en el óvalo';
      alt.innerHTML = `<button class="nv-btn" id="nvStart">Estoy listo</button><button class="nv-lnk" id="nvNoCam">¿Problemas con la cámara?</button>`;
      alt.querySelector('#nvStart').onclick = () => run(false);
      alt.querySelector('#nvNoCam').onclick = () => { stopCam(); video.remove(); cam.querySelector('.face').style.display = ''; altButtons(''); };
    } catch { altButtons('No pudimos abrir la cámara (¿no diste permiso o no hay cámara?).'); }
  }
  const grab = v => { const c = document.createElement('canvas'); c.width = 240; c.height = 300; const g = c.getContext('2d'); const s = Math.max(240 / v.videoWidth, 300 / v.videoHeight), w = v.videoWidth * s, h = v.videoHeight * s; g.translate(240, 0); g.scale(-1, 1); g.drawImage(v, (240 - w) / 2, (300 - h) / 2, w, h); return c.toDataURL('image/jpeg', .82); };
  // DEMO: con la cámara simulada se usa el personaje de la cuenta como "selfie"
  const simShot = async user => { try { return await shrink(`assets/${user.me?.img || user.img || 'sofi'}.png`, 240, 300); } catch { return null; } };

  async function finish(user, opts, shot, method) {
    const draft = opts.draft, photoMode = opts.mode === 'photo';
    box(`<div class="nv-spin"></div><h2 style="text-align:center">Comparando tu selfie con tu INE…</h2><p style="text-align:center">Revisamos que sea la misma persona.</p>`, photoMode ? 0 : 3);
    await wait(1600); if (!ov) return;
    const score = 93 + Math.floor(Math.random() * 6);
    if (photoMode) {
      if (method === 'manual') { set(user.phone, { photoReview: { img: shot, at: Date.now() } }); return done(user, opts, 'photoReview'); }
      if (shot) Photos.set(user.phone, shot);
      set(user.phone, { selfie: shot, photoAt: Date.now() });
      return done(user, opts, 'photo');
    }
    const rec = { curp: draft.curp.slice(0, 4) + '••••••' + draft.curp.slice(-4), name: draft.name, birth: draft.birth, ineF: draft.ineF, ineB: draft.ineB, selfie: shot, method, draft: null, sent: Date.now() };
    if (method === 'manual') { set(user.phone, { ...rec, status: 'review' }); return done(user, opts, 'review'); }
    set(user.phone, { ...rec, status: 'ok', at: Date.now(), score });
    approved(user.phone, shot);
    done(user, opts, 'ok', score);
  }
  // al aprobarse: la selfie es su foto de perfil y se regala 1 GB (una sola vez)
  function approved(phone, shot) {
    if (shot) Photos.set(phone, shot);
    if (!get(phone).gift) {
      Topups.add({ phone, gb: 1, price: 0, at: Date.now(), method: 'regalo', status: 'aplicada', folio: 'REG-ID-' + String(Date.now()).slice(-6), gift: 'verificación' });
      set(phone, { gift: Date.now() });
    }
  }

  function done(user, opts, st, score) {
    const name = firstName(user);
    const T = {
      ok: `<div class="nv-big">✅</div><h2 style="text-align:center">¡Listo, ${esc(name)}! Identidad verificada</h2>
        <p style="text-align:center">Coincidencia de ${score}% entre tu selfie y tu INE.</p>
        <div class="nv-badges">${tag(user.phone)}</div>
        <div class="nv-list"><div style="background:#B4E32F1f"><span>🎁</span><div><b>+1 GB de regalo</b><small>Ya está en tu línea.</small></div></div>
          <div><span>🤳</span><div><b>Tu selfie es tu foto de perfil</b><small>Así nadie puede usar una foto falsa.</small></div></div>
          <div><span>🔓</span><div><b>Ya puedes usar Navi Ride y Navi Conecta</b><small>Con el sello ✓ en tu perfil.</small></div></div></div>`,
      review: `<div class="nv-big">⏳</div><h2 style="text-align:center">Recibimos tus documentos</h2>
        <p style="text-align:center">Como subiste una foto sin prueba de vida, un especialista de Navi la revisa. Te avisamos en menos de 24 horas.</p>
        <div class="nv-priv">DEMO: apruébala en Navi Central → 🪪 Verificaciones.</div>`,
      photo: `<div class="nv-big">🤳</div><h2 style="text-align:center">Foto de perfil actualizada</h2><p style="text-align:center">Coincide con tu INE. Tu familia y los clientes Navi ya la ven.</p>`,
      photoReview: `<div class="nv-big">⏳</div><h2 style="text-align:center">Revisamos tu nueva foto</h2><p style="text-align:center">Un especialista confirma que eres tú y la cambiamos.</p>`,
    }[st];
    const b = box(`${T}<button class="nv-btn" data-ok>Continuar</button>`);
    b.querySelector('[data-ok]').onclick = () => { close(); if (st === 'ok' || st === 'photo') opts.onDone?.(); else opts.onPending?.(); };
  }

  function minorScreen(user, fromCurp) {
    const owner = NaviAuth.find(user.owner);
    const b = box(`<div class="nv-big">👨‍👩‍👧</div><h2 style="text-align:center">${fromCurp ? 'Eres menor de edad' : 'Tu cuenta la avala tu familia'}</h2>
      <p style="text-align:center">Para cuidarte, los menores no se verifican con foto ni INE: tu cuenta está avalada por ${owner && owner.phone !== user.phone ? 'el titular de tu Plan Familia' : 'tu familia'}. Navi Ride y Navi Conecta son solo para mayores de 18.</p>
      <button class="nv-btn" data-ok>Entendido</button>`);
    b.querySelector('[data-ok]').onclick = close;
  }

  // ---------- licencia para conductores de Navi Ride ----------
  function driver(user, onDone) {
    const d = {};
    const paint = () => {
      const b = box(`<div class="nv-big">🪪</div><h2>Verifica que puedes manejar</h2><p>Para publicar viajes en Navi Ride pedimos tu licencia vigente y la tarjeta de circulación del auto.</p>
        <div class="nv-docs">${[['lic', 'Licencia'], ['tc', 'Tarjeta de circulación']].map(([k, n]) => `<label class="nv-doc ${d[k] ? 'ok' : ''}" style="${d[k] ? `background-image:url(${d[k]})` : ''}">${d[k] ? '' : `📷<br>${n}`}<input type="file" accept="image/*" capture="environment" data-k="${k}" hidden></label>`).join('')}</div>
        <input class="nv-in" id="nvPlate" maxlength="10" placeholder="Placas · ej. NVR482A" value="${esc(d.plate || '')}">
        <label style="display:flex;gap:10px;align-items:center;margin-top:12px;font-size:14px"><input type="checkbox" id="nvIns" ${d.ins ? 'checked' : ''} style="width:20px;height:20px;accent-color:#B4E32F"> Mi auto tiene seguro vigente</label>
        <div class="nv-err" id="nvErr"></div>
        <button class="nv-lnk" id="nvSample" style="margin:0">Usar documentos de ejemplo (demo)</button>
        <button class="nv-btn" id="nvGo">Validar</button>`);
      const keep = () => { d.plate = b.querySelector('#nvPlate').value; d.ins = b.querySelector('#nvIns').checked; };
      b.querySelectorAll('[data-k]').forEach(inp => inp.onchange = async () => { keep(); try { d[inp.dataset.k] = await shrink(await fileUrl(inp.files[0]), 320, 202); paint(); } catch (e) { b.querySelector('#nvErr').textContent = e.message; } });
      b.querySelector('#nvSample').onclick = () => { keep(); const nm = get(user.phone).name || firstName(user); d.lic = sampleId(nm, 'LICENCIA TIPO A'); d.tc = sampleId(nm, 'TARJETA CIRCULACIÓN', true); d.plate = d.plate || 'NVR482A'; d.ins = true; paint(); };
      b.querySelector('#nvGo').onclick = async () => {
        keep(); const err = b.querySelector('#nvErr'), plate = (d.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!d.lic || !d.tc) return err.textContent = 'Falta la foto de la licencia o de la tarjeta de circulación.';
        if (plate.length < 5) return err.textContent = 'Escribe las placas del auto.';
        if (!d.ins) return err.textContent = 'Para llevar pasajeros el auto debe tener seguro vigente.';
        box(`<div class="nv-spin"></div><h2 style="text-align:center">Validando tu licencia…</h2><p style="text-align:center">Revisamos que esté vigente y que sea tuya.</p>`);
        await wait(1500); if (!ov) return;
        set(user.phone, { driver: { status: 'ok', at: Date.now(), plate, lic: d.lic, tc: d.tc } });
        const b2 = box(`<div class="nv-big">🚗</div><h2 style="text-align:center">¡Conductor verificado!</h2><p style="text-align:center">Tu perfil ahora muestra la insignia 🪪 Conductor verificado.</p><button class="nv-btn" data-ok>Seguir publicando</button>`);
        b2.querySelector('[data-ok]').onclick = () => { close(); onDone?.(); };
      };
    };
    paint();
  }

  // ---------- puerta: pide el nivel que hace falta antes de seguir ----------
  // need: 'id' (identidad verificada) | 'driver' (además, licencia). why: "reservar en Navi Ride"
  function require(user, { need = 'id', why = 'usar esta función', onOk }) {
    const r = get(user.phone);
    if (r.status === 'ok' && (need !== 'driver' || r.driver?.status === 'ok')) { onOk?.(); return true; }
    if (r.status === 'minor') { minorScreen(user); return false; }
    if (r.status === 'ok') { driver(user, onOk); return false; }
    if (r.status === 'review') {
      const b = box(`<div class="nv-big">⏳</div><h2 style="text-align:center">Tu verificación está en revisión</h2><p style="text-align:center">En cuanto la aprobemos podrás ${esc(why)}. Te avisamos en menos de 24 horas.</p><div class="nv-priv">DEMO: apruébala en Navi Central → 🪪 Verificaciones.</div><button class="nv-btn" data-ok>Entendido</button>`);
      b.querySelector('[data-ok]').onclick = close; return false;
    }
    const b = box(`<div class="nv-big">🪪</div><h2 style="text-align:center">Para ${esc(why)}, verifica tu identidad</h2>
      <p style="text-align:center">${r.status === 'rejected' ? `No pudimos aprobar tu verificación anterior: ${esc(r.reason || 'las fotos no se veían bien')}. Inténtalo otra vez.` : 'Así todos saben con quién tratan. Toma 2 minutos y te regalamos 1 GB.'}</p>
      <button class="nv-btn" data-go>Verificarme ahora</button><button class="nv-lnk" data-no>Después</button>`);
    b.querySelector('[data-go]').onclick = () => start(user, { onDone: () => (need === 'driver' ? driver(user, onOk) : onOk?.()) });
    b.querySelector('[data-no]').onclick = close;
    return false;
  }

  // ---------- Navi Central: revisión manual ----------
  const decide = (phone, approve, by, reason) => {
    const r = get(phone);
    if (approve) { set(phone, { status: 'ok', at: Date.now(), by, method: 'manual' }); approved(phone, r.selfie); }
    else set(phone, { status: 'rejected', by, reason: reason || 'las fotos no se veían bien', at: Date.now() });
  };
  const decidePhoto = (phone, approve) => { const r = get(phone); if (approve && r.photoReview?.img) { Photos.set(phone, r.photoReview.img); set(phone, { selfie: r.photoReview.img, photoReview: null }); } else set(phone, { photoReview: null }); };
  const reset = phone => { const a = all(); a[phone] = MINORS.includes(phone) ? { status: 'minor' } : { status: 'none' }; try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {} Photos.set(phone, null); };

  css(); // los sellos ✓ se ven en cuanto carga la página
  return { KEY, get, ok, minor, driverOk, level, LEVELS, badges, tag, start, require, driver, decide, decidePhoto, reset, all, css, MINORS };
})();
