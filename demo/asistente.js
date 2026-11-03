// Chat de Navi para clientes: botón flotante en la página y en Mi Navi. Contesta el asistente 24/7
// y, si hace falta, un asesor desde la consola central. Necesita auth.js, planes.js y desk.js.
(() => {
  const css = `
  .nb-fab{position:fixed;right:18px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:80;display:flex;align-items:center;gap:10px;background:#B4E32F;color:#06062E;border-radius:99px;padding:12px 18px 12px 14px;font:800 15px "DM Sans",system-ui,sans-serif;box-shadow:0 6px 0 #7FA312,0 14px 30px #0007;cursor:pointer;border:0;transition:transform .2s}
  .nb-fab:hover{transform:translateY(-3px)}
  .nb-fab i{font-style:normal;font-size:22px}
  .nb-fab b{position:absolute;top:-6px;right:-4px;background:#FF6FB1;color:#fff;border-radius:99px;font-size:11px;padding:2px 7px}
  .nb-panel{position:fixed;right:18px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:81;width:min(380px,calc(100vw - 24px));height:min(580px,calc(100dvh - 110px));background:#0F0F5A;border:1px solid #ffffff26;border-radius:24px;box-shadow:0 24px 60px #000a;display:flex;flex-direction:column;overflow:hidden;font-family:"DM Sans",system-ui,sans-serif;color:#F4F3FF;animation:nbin .25s cubic-bezier(.3,1.4,.5,1)}
  .nb-panel[hidden]{display:none}
  @keyframes nbin{from{transform:translateY(16px) scale(.97);opacity:0}}
  @media (max-width:520px){.nb-panel{right:12px;left:12px;width:auto;bottom:calc(80px + env(safe-area-inset-bottom,0px))}.nb-fab span{display:none}.nb-fab{padding:14px}}
  .nb-hd{display:flex;align-items:center;gap:10px;padding:14px 16px;background:#15156E;border-bottom:1px solid #ffffff18}
  .nb-hd .av{width:38px;height:38px;border-radius:50%;background:#B4E32F;display:grid;place-items:center;font-size:20px}
  .nb-hd b{display:block;font-size:15px}
  .nb-hd small{font-size:12px;color:#B9B7E6}
  .nb-hd small i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#2BD67B;margin-right:5px}
  .nb-hd button{margin-left:auto;background:none;border:0;color:#fff;font-size:20px;cursor:pointer}
  .nb-msgs{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px}
  .nb-m{max-width:84%;padding:9px 12px;border-radius:16px;font-size:14px;line-height:1.4;background:#ffffff14;align-self:flex-start;border-bottom-left-radius:5px;word-wrap:break-word}
  .nb-m a{color:#D4F56B;text-decoration:underline}
  .nb-m.me{align-self:flex-end;background:#B4E32F;color:#06062E;border-bottom-left-radius:16px;border-bottom-right-radius:5px}
  .nb-m.me a{color:#06062E}
  .nb-m.agent{background:#7B5CFA}
  .nb-m small{display:block;font-size:10.5px;opacity:.65;margin-top:3px}
  .nb-sys{align-self:center;font-size:11.5px;color:#B9B7E6;background:#ffffff0d;border-radius:99px;padding:4px 10px;text-align:center}
  .nb-q{display:flex;gap:6px;overflow-x:auto;padding:8px 12px 0;scrollbar-width:none}
  .nb-q button{flex:none;font:700 12.5px "DM Sans",sans-serif;color:#F4F3FF;background:#ffffff12;border:1px solid #ffffff24;border-radius:99px;padding:6px 11px;cursor:pointer}
  .nb-f{display:flex;gap:8px;padding:10px 12px 12px}
  .nb-f input{flex:1;min-width:0;background:#ffffff10;border:2px solid #ffffff22;border-radius:99px;padding:10px 14px;font:15px "DM Sans",sans-serif;color:#fff}
  .nb-f input:focus{outline:none;border-color:#B4E32F}
  .nb-f button{background:#B4E32F;color:#06062E;border:0;border-radius:99px;padding:0 16px;font-weight:800;cursor:pointer}
  .nb-wa{display:block;text-align:center;font-size:12px;color:#B9B7E6;padding:0 0 10px}
  .nb-wa a{color:#2BD67B;font-weight:700}`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
  const user = NaviAuth.current();
  const inApp = /cuenta|movil|recargas|fit|pet|ride|conecta|sos|agenda|juegos|videos|referidos/.test(location.pathname);
  // en la página Empresas el chat es de NAVICom (B2B) y llega a la consola como requerimiento de empresa
  const b2b = /empresas/.test(location.pathname);
  const channel = b2b ? 'empresas' : user && inApp ? 'app' : 'web';
  const anonKey = 'navi.desk.anon';
  let anon = localStorage.getItem(anonKey); if (!anon) { anon = 'Visitante ' + Math.floor(1000 + Math.random() * 9000); try { localStorage.setItem(anonKey, anon); } catch {} }
  const fab = document.createElement('button'); fab.className = 'nb-fab'; fab.setAttribute('aria-label', 'Abrir chat con Navi');
  fab.innerHTML = '<i>💬</i><span>¿Te ayudamos?</span>';
  const panel = document.createElement('div'); panel.className = 'nb-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chat con Navi');
  document.body.append(fab, panel);
  let cid = null;
  const conv = () => cid && Desk.get(cid);
  const QUICK = b2b ? ['Quiero una propuesta', 'Líneas para mi empresa', 'Rastreo de flotillas', 'PTT', 'Seguridad', 'IoT', 'Hablar con un ejecutivo']
    : ['Mi saldo', 'Recargar', '¿Cuándo se renueva?', 'Portabilidad', 'Pagos', 'Para mi empresa', 'Hablar con un asesor'];
  function paint() {
    const c = conv(); if (!c) return;
    const draft = panel.querySelector('.nb-f input')?.value || '';
    const exec = c.seg === 'b2b' ? 'un ejecutivo' : 'un asesor';
    const who = c.status === 'agent' ? `Te atiende ${c.agent || exec}` : c.status === 'waiting' ? (c.seg === 'b2b' ? 'Un ejecutivo de NAVICom te contactará' : 'Conectando con un asesor…') : c.seg === 'b2b' ? 'Asistente NAVICom · 24/7' : 'Asistente Navi · 24/7';
    panel.innerHTML = `<div class="nb-hd"><span class="av">${c.status === 'agent' ? '🙋' : c.seg === 'b2b' ? '🏢' : '🤖'}</span><div><b>${b2b ? 'NAVICom · Empresas' : 'Navi Móvil'}</b><small><i></i>${who}</small></div><button aria-label="Cerrar">✕</button></div>
      <div class="nb-msgs">${c.msgs.map(m => m.from === 'system' ? `<div class="nb-sys">${deskFmt(m.txt)}</div>`
        : `<div class="nb-m ${m.from === 'customer' ? 'me' : m.from === 'agent' ? 'agent' : ''}">${m.from === 'agent' ? `<b style="font-size:11px;opacity:.8">${m.agent || 'Asesor'}</b><br>` : ''}${deskFmt(m.txt)}<small>${new Date(m.t).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}</small></div>`).join('')}</div>
      <div class="nb-q">${QUICK.map(q => `<button>${q}</button>`).join('')}</div>
      <form class="nb-f"><input placeholder="Escribe tu mensaje…" maxlength="500" autocomplete="off" aria-label="Mensaje"><button>Enviar</button></form>
      <div class="nb-wa">${b2b ? '¿Prefieres correo? <a href="mailto:info@naviservices.net">info@naviservices.net</a>' : '¿Prefieres WhatsApp? <a href="whatsapp.html" target="_blank" rel="noopener">Escríbenos ahí</a>'}</div>`;
    const box = panel.querySelector('.nb-msgs'); box.scrollTop = box.scrollHeight;
    panel.querySelector('.nb-hd button').onclick = () => { panel.hidden = true; };
    const send = t => { if (!t.trim()) return; NaviBot.handle(cid, t.trim()); paint(); };
    panel.querySelector('form').onsubmit = e => { e.preventDefault(); const i = panel.querySelector('input'), v = i.value; i.value = ''; send(v); };
    panel.querySelectorAll('.nb-q button').forEach(b => b.onclick = () => send(b.textContent));
    const inp = panel.querySelector('input'); inp.value = draft; inp.focus({ preventScroll: true });
  }
  fab.onclick = () => {
    if (!panel.hidden) { panel.hidden = true; return; }
    const c = Desk.open(channel, user?.phone || null, user ? user.me.name : anon);
    cid = c.id;
    if (!c.msgs.length) Desk.push(cid, { from: 'bot', txt: b2b
      ? `¡Hola! 👋 Soy el asistente de NAVICom, la división de Navi para empresas, gobierno y escuelas. Te resuelvo dudas y, si quieres, armo tu requerimiento para que un ejecutivo te mande una propuesta.\n\n${NaviBot.MENU_B2B}`
      : `¡Hola${user ? ' ' + user.me.name : ''}! 👋 Soy el asistente de Navi Móvil, disponible las 24 horas.${user ? ' Ya sé quién eres, así que puedo darte datos de tu línea.' : ''}\n\n${NaviBot.MENU}` });
    Desk.set(cid, { seenByCustomer: Date.now() });
    panel.hidden = false; paint(); badge();
  };
  // respuestas del asesor o mensajes proactivos que llegan desde la consola
  const badge = () => {
    const c = cid ? conv() : Desk.all().find(x => x.channel === channel && (user ? x.phone === user.phone : x.anon === anon) && x.status !== 'closed');
    if (!c) return;
    const n = c.msgs.filter(m => (m.from === 'agent' || m.proactive) && m.t > (c.seenByCustomer || 0)).length;
    fab.querySelector('b')?.remove();
    if (n && panel.hidden) fab.insertAdjacentHTML('beforeend', `<b>${n}</b>`);
  };
  // (solo escribe si de verdad llegó algo nuevo, para no rebotar cambios con la consola abierta en otra pestaña)
  addEventListener('storage', e => {
    if (e.key !== Desk.KEY) return;
    if (panel.hidden) return badge();
    const c = conv(); if (!c) return;
    if (c.msgs.some(m => m.from !== 'customer' && m.t > (c.seenByCustomer || 0))) Desk.set(cid, { seenByCustomer: Date.now() });
    paint();
  });
  badge();
})();
