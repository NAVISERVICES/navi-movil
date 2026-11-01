// Pasarela de pago (como en la plataforma del operador): el cobro no se hace en la página de Navi,
// se abre la ventana segura de la pasarela con tarjeta, transferencia o efectivo y la página espera el resultado.
// DEMO: la ventana se simula aquí; en producción la abre el operador con el folio del pedido y avisa por webhook.
//   Pasarela.open({ concepto, monto, folio, onResult: r => … })  r = { status: 'pagado'|'pendiente'|'rechazado', method, ref }
const Pasarela = (() => {
  const css = `
.pg-ov{position:fixed;inset:0;z-index:100;background:#03031acc;backdrop-filter:blur(6px);display:grid;place-items:center;padding:16px}
.pg-ov[hidden]{display:none}
.pg{width:min(440px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:#fff;color:#0B0B4F;border-radius:24px;box-shadow:0 30px 80px #0008;font-size:15px}
.pg-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 20px;border-bottom:1px solid #0B0B4F14}
.pg-hd b{font-family:var(--display,sans-serif);font-size:17px}
.pg-hd small{display:block;font-size:12px;color:#0B0B4F99}
.pg-hd button{width:34px;height:34px;border-radius:50%;background:#0B0B4F0f;font-size:18px;color:#0B0B4F}
.pg-amt{padding:16px 20px;background:#F3F4FF;display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.pg-amt span{font-size:13px;color:#0B0B4F99}
.pg-amt b{font-family:var(--display,sans-serif);font-size:28px}
.pg-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:14px 20px 0}
.pg-tabs button{padding:10px 6px;border-radius:12px;border:2px solid #0B0B4F1f;font-weight:700;font-size:13px;color:#0B0B4F}
.pg-tabs button[aria-pressed="true"]{border-color:#0B0B4F;background:#0B0B4F;color:#B4E32F}
.pg-body{padding:16px 20px 20px;display:grid;gap:12px}
.pg-body p{font-size:14px;color:#0B0B4Fcc}
.pg-logos{display:flex;gap:6px;flex-wrap:wrap}
.pg-logos span{font-size:11px;font-weight:800;padding:5px 9px;border-radius:8px;background:#0B0B4F0d}
.pg-go{width:100%;padding:14px;border-radius:99px;background:#B4E32F;color:#0B0B4F;font-weight:800;font-size:16px;box-shadow:0 4px 0 #7FA312}
.pg-alt{width:100%;padding:10px;border-radius:99px;font-weight:700;font-size:13px;color:#0B0B4F99;text-decoration:underline}
.pg-demo{font-size:12px;color:#0B0B4F80;text-align:center}
.pg-wait{padding:34px 20px;text-align:center;display:grid;gap:10px;justify-items:center}
.pg-spin{width:42px;height:42px;border-radius:50%;border:4px solid #0B0B4F1a;border-top-color:#0B0B4F;animation:pgspin .8s linear infinite}
@keyframes pgspin{to{transform:rotate(360deg)}}
.pg-lock{font-size:12px;color:#0B0B4F99;display:flex;gap:6px;align-items:center;justify-content:center;padding:0 20px 16px}`;
  let ov = null, cfg = null, method = 'tarjeta';
  const money = n => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ref = () => String(Math.floor(1e13 + Math.random() * 9e13)).replace(/(\d{4})(?=\d)/g, '$1 ');
  const BODY = {
    tarjeta: () => `<p>Crédito o débito. Se confirma al momento.</p>
      <div class="pg-logos"><span>VISA</span><span>Mastercard</span><span>American Express</span></div>
      <button class="pg-go" data-r="pagado">Pagar ${money(cfg.monto)}</button>
      <button class="pg-alt" data-r="rechazado">Simular que el banco rechaza el pago</button>`,
    transferencia: () => `<p>SPEI o CoDi desde la app de tu banco. Se confirma cuando llega la transferencia.</p>
      <div class="pg-logos"><span>SPEI</span><span>CoDi</span><span>BBVA</span><span>Banorte</span><span>Banco Azteca</span></div>
      <button class="pg-go" data-r="pendiente">Generar datos para transferir</button>`,
    efectivo: () => `<p>Paga en tienda con un código de barras. Se confirma al pagar en caja.</p>
      <div class="pg-logos"><span>OXXO</span><span>7-Eleven</span><span>Circle K</span><span>Walmart</span><span>Bodega Aurrera</span><span>Farmacias del Ahorro</span></div>
      <button class="pg-go" data-r="pendiente">Generar código de pago</button>`,
  };
  const draw = () => {
    ov.innerHTML = `<div class="pg" role="dialog" aria-modal="true" aria-labelledby="pgT">
      <div class="pg-hd"><div><b id="pgT">Pago seguro</b><small>Pasarela de pago · Folio ${cfg.folio}</small></div><button data-x aria-label="Cerrar la ventana de pago">✕</button></div>
      <div class="pg-amt"><span>${cfg.concepto}</span><b>${money(cfg.monto)}</b></div>
      <div class="pg-tabs">${['tarjeta', 'transferencia', 'efectivo'].map(m => `<button data-m="${m}" aria-pressed="${m === method}">${{ tarjeta: '💳 Tarjeta', transferencia: '🏦 Transferencia', efectivo: '💵 Efectivo' }[m]}</button>`).join('')}</div>
      <div class="pg-body">${BODY[method]()}<p class="pg-demo">Demostración: no se hace ningún cobro.</p></div>
      <div class="pg-lock">🔒 Navi no ve ni guarda los datos de tu tarjeta</div></div>`;
  };
  const close = () => { if (ov) ov.hidden = true; };
  function open(c) {
    cfg = c; method = 'tarjeta';
    if (!ov) {
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      ov = document.createElement('div'); ov.className = 'pg-ov'; document.body.appendChild(ov);
      ov.addEventListener('click', e => {
        const m = e.target.closest('[data-m]'), r = e.target.closest('[data-r]');
        if (e.target.closest('[data-x]')) { close(); cfg.onClose?.(); return; }
        if (m) { method = m.dataset.m; draw(); return; }
        if (r) {
          // la pasarela procesa y avisa el resultado a la página que espera
          ov.innerHTML = `<div class="pg"><div class="pg-wait"><div class="pg-spin"></div><b>Procesando tu pago…</b></div></div>`;
          setTimeout(() => { close(); cfg.onResult({ status: r.dataset.r, method, ref: method === 'tarjeta' ? null : ref() }); }, 1100);
        }
      });
    }
    // "Conectando con la pasarela de pago…" antes de abrir la ventana
    ov.hidden = false;
    ov.innerHTML = `<div class="pg"><div class="pg-wait"><div class="pg-spin"></div><b>Conectando con la pasarela de pago…</b></div></div>`;
    setTimeout(draw, 700);
  }
  return { open, close };
})();
