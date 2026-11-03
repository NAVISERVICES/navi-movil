// "Pon Mi Navi en tu pantalla": ícono de Mi Navi en el celular (app web instalable) mientras salen las apps
// de App Store y Google Play. Mismas instrucciones que el botón SOS: iPhone (Safari → Compartir → Agregar a inicio)
// y Android (Chrome → Instalar). En Android, si el navegador lo permite, se instala con un toque.
const NaviInstall = (() => {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const link = new URL('login.html', location.href).href;
  let prompt = null, tab = ios ? 'ios' : 'android', sheet = null;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; if (sheet && !sheet.hidden) open(); });
  addEventListener('appinstalled', () => { if (sheet) sheet.hidden = true; try { localStorage.setItem('navi.installed', '1'); } catch {} document.querySelectorAll('[data-install]').forEach(b => b.hidden = true); });
  document.head.insertAdjacentHTML('beforeend', `<style>
    .ni-sheet{position:fixed;inset:0;z-index:95;background:#03031acc;display:grid;place-items:end center;padding:12px;font-family:var(--body,"DM Sans",sans-serif)}
    .ni-sheet[hidden]{display:none}
    .ni-sheet > div{width:min(460px,100%);background:#15156E;border:1px solid #ffffff26;border-radius:26px;padding:22px 20px calc(20px + env(safe-area-inset-bottom,0px));color:#F4F3FF;max-height:calc(100dvh - 24px);overflow:auto;animation:niIn .3s cubic-bezier(.3,1.4,.5,1)}
    @keyframes niIn{from{transform:translateY(30px);opacity:0}}
    .ni-top{display:flex;gap:14px;align-items:center}
    .ni-top img{width:64px;height:64px;border-radius:16px;box-shadow:0 8px 20px #0006}
    .ni-top h2{font-family:var(--display,sans-serif);font-size:22px;line-height:1.1}
    .ni-top p{color:#B9B7E6;font-size:14px;margin-top:4px}
    .ni-tabs{display:flex;gap:6px;margin-top:16px}
    .ni-tabs button{flex:1;padding:9px;border-radius:99px;border:1px solid #ffffff2a;color:#B9B7E6;font-weight:700;font-size:13px;background:none;cursor:pointer}
    .ni-tabs button[aria-pressed="true"]{background:#B4E32F;color:#06062E;border-color:#B4E32F}
    .ni-steps{list-style:none;margin:14px 0 4px;padding:0;display:grid;gap:10px;counter-reset:s}
    .ni-steps li{counter-increment:s;display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:start;font-size:15px;line-height:1.4}
    .ni-steps li::before{content:counter(s);width:30px;height:30px;border-radius:50%;background:#7B5CFA;display:grid;place-items:center;font-weight:800}
    .ni-ico{display:inline-grid;place-items:center;min-width:26px;height:26px;border-radius:7px;background:#ffffff1f;vertical-align:middle;margin:0 2px;padding:0 4px}
    .ni-url{display:flex;gap:8px;margin-top:12px}
    .ni-url input{flex:1;min-width:0;background:#ffffff12;border:1px solid #ffffff2a;border-radius:12px;padding:10px;color:#fff;font-size:13px}
    .ni-url button,.ni-go{background:#B4E32F;color:#06062E;border:0;border-radius:12px;padding:10px 14px;font-weight:800;cursor:pointer}
    .ni-go{width:100%;margin-top:14px;border-radius:99px;padding:13px;font-size:15px;box-shadow:0 5px 0 #7FA312}
    .ni-ok{width:100%;margin-top:10px;border-radius:99px;padding:12px;font-weight:700;background:#ffffff14;color:#fff;border:0;cursor:pointer}
    .ni-guide{display:grid;grid-template-columns:128px 1fr;gap:14px;margin-top:14px;align-items:start}
    .ni-guide video{width:100%;aspect-ratio:384/848;border-radius:16px;background:#000;border:2px solid #ffffff2a;display:block}
    .ni-guide small{display:block;text-align:center;font-size:11px;color:#B9B7E6;margin-top:5px}
    .ni-guide .ni-steps{margin:0}
    .ni-guide .ni-steps li{font-size:14px;grid-template-columns:26px 1fr;cursor:pointer;border-radius:10px;transition:background .2s}
    .ni-guide .ni-steps li::before{width:26px;height:26px;font-size:13px}
    .ni-guide .ni-steps li.on{background:#ffffff12}
    .ni-guide .ni-steps li.on::before{background:#B4E32F;color:#06062E}
    .ni-note{font-size:12px;color:#B9B7E6;margin-top:10px}
    @media (max-width:360px){.ni-guide{grid-template-columns:104px 1fr}}
    .ni-also{margin-top:14px;font-size:13px;color:#B9B7E6;background:#ffffff0a;border-radius:14px;padding:10px 12px}
    .ni-also a{color:#B4E32F;font-weight:700}
  </style>`);
  const hide = () => { sheet.hidden = true; sheet.querySelector('video')?.pause(); };
  function open() {
    if (!sheet) { sheet = document.createElement('div'); sheet.className = 'ni-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.onclick = e => { if (e.target === sheet) hide(); }; document.body.append(sheet); }
    const inside = standalone;
    const copy = `<div class="ni-url"><input readonly value="${link}" aria-label="Enlace de Mi Navi"><button data-cp>Copiar</button></div>`;
    const steps = inside
      ? `<p style="margin-top:12px;font-size:14px;color:#B9B7E6">Ya estás usando Mi Navi como app 🎉. Para ponerla en otro celular, abre este enlace en ${ios ? 'Safari' : 'Chrome'}:</p>${copy}`
      : tab === 'ios'
        // video guía grabado en iPhone: cada paso salta a su momento del video
        ? `<div class="ni-guide"><div><video src="assets/guia-instalar.mp4" autoplay muted loop playsinline controls preload="metadata" aria-label="Video: cómo poner Mi Navi en la pantalla del iPhone"></video><small>▶ Video guía · 37 s</small></div>
          <ol class="ni-steps"><li data-at="10"><span>Abre <b>navimovil.com</b> en <b>Safari</b>${/CriOS|FxiOS|EdgiOS/.test(ua) ? ' (copia el enlace y pégalo ahí)' : ''}.</span></li><li data-at="16.5"><span>Toca <span class="ni-ico">•••</span> abajo a la derecha y luego <b>Compartir</b> <span class="ni-ico">⬆</span>.</span></li><li data-at="22"><span>Toca <b>Ver más</b> y elige <b>Agregar a inicio</b> <span class="ni-ico">＋</span>.</span></li><li data-at="25"><span>Deja activado <b>Abrir como app web</b> y toca <b>Agregar</b>.</span></li><li data-at="29.5"><span>Listo: el ícono de Navi queda en tu pantalla.</span></li></ol></div>
          <p class="ni-note">Toca un paso para verlo en el video. Si tu iPhone está en inglés: <i>Share</i> → <i>View More</i> → <i>Add to Home Screen</i> → <i>Add</i>. En algunos iPhone, Compartir <span class="ni-ico">⬆</span> está directo en la barra.</p>${copy}`
        : `${prompt ? '<button class="ni-go" data-inst>📲 Instalar Mi Navi ahora</button><p style="text-align:center;font-size:12px;color:#B9B7E6;margin-top:8px">o hazlo a mano:</p>' : ''}<ol class="ni-steps"><li><span>Abre esta página en <b>Chrome</b>.</span></li><li><span>Toca <span class="ni-ico">⋮</span> arriba a la derecha.</span></li><li><span>Elige <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.</span></li><li><span>Confirma. El ícono de Navi queda en tu pantalla.</span></li></ol>${copy}`;
    sheet.innerHTML = `<div><div class="ni-top"><img src="assets/icon-192.png" alt=""><div><h2>Mi Navi en tu pantalla</h2><p>Ábrela de un toque, como cualquier app, mientras llega a App Store y Google Play.</p></div></div>
      ${inside ? '' : `<div class="ni-tabs"><button data-t="ios" aria-pressed="${tab === 'ios'}">iPhone</button><button data-t="android" aria-pressed="${tab === 'android'}">Android</button></div>`}
      ${steps}
      <div class="ni-also">🚨 ¿Tienes NAVI SOS? También puedes poner <b>solo el botón SOS</b> como un ícono aparte: <a href="boton/?from=app">ver cómo</a>.</div>
      <button class="ni-ok" data-close>Entendido</button></div>`;
    sheet.hidden = false;
    sheet.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; open(); });
    sheet.querySelector('[data-close]').onclick = hide;
    const vid = sheet.querySelector('video');
    if (vid) {
      const li = [...sheet.querySelectorAll('[data-at]')];
      li.forEach(l => l.onclick = () => { vid.currentTime = +l.dataset.at; vid.play().catch(() => {}); });
      vid.ontimeupdate = () => { const k = li.findLastIndex(l => vid.currentTime >= +l.dataset.at); li.forEach((l, i) => l.classList.toggle('on', i === k)); };
    }
    const inst = sheet.querySelector('[data-inst]');
    if (inst) inst.onclick = async () => { prompt.prompt(); await prompt.userChoice; prompt = null; open(); };
    const cp = sheet.querySelector('[data-cp]');
    if (cp) cp.onclick = async () => { const i = sheet.querySelector('.ni-url input'); try { await navigator.clipboard.writeText(link); } catch { i.select(); document.execCommand?.('copy'); } cp.textContent = '✓ Copiado'; };
  }
  // ya instalada y abierta como app: no hace falta el botón
  const needed = () => !standalone;
  document.addEventListener('click', e => { if (e.target.closest('[data-install]')) { e.preventDefault(); open(); } });
  return { open, needed, standalone };
})();
document.querySelectorAll('[data-install]').forEach(b => { if (!NaviInstall.needed()) b.hidden = true; });
