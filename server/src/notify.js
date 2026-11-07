// Envío de códigos de acceso por SMS o correo.
// 'log' solo lo escribe en la bitácora del servidor (pruebas). Para producción se configura un proveedor.
import { CONFIG } from './config.js';

export async function sendSms(phone, text) {
  const c = CONFIG.sms;
  if (c.provider === 'twilio') {
    const body = new URLSearchParams({ To: '+52' + phone.slice(-10), From: c.twilioFrom, Body: text });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(c.twilioSid)}/Messages.json`, {
      method: 'POST', body,
      headers: { Authorization: 'Basic ' + Buffer.from(c.twilioSid + ':' + c.twilioToken).toString('base64') }
    });
    if (!r.ok) throw new Error('sms ' + r.status);
    return;
  }
  console.log(`[sms → ••••${phone.slice(-4)}] ${text}`);
}

export async function sendEmail(to, subject, text) {
  const c = CONFIG.email;
  if (c.provider === 'sendgrid') {
    const m = /^(.*)<(.+)>$/.exec(c.from);
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + c.sendgridKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: m ? { email: m[2].trim(), name: m[1].trim() } : { email: c.from },
        subject, content: [{ type: 'text/plain', value: text }]
      })
    });
    if (!r.ok) throw new Error('email ' + r.status);
    return;
  }
  console.log(`[correo → ${to.replace(/^(.{2})[^@]*/, '$1•••')}] ${subject}: ${text}`);
}
