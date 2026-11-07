// Configuración por variables de entorno (archivo .env en el servidor). Ver .env.example.
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const bool = v => /^(1|true|si|sí|yes)$/i.test(String(v || ''));

export const CONFIG = {
  port: Number(env.PORT || 8080),
  // carpeta con el sitio (la raíz del repositorio: index.html, demo/…)
  staticRoot: resolve(env.STATIC_ROOT || resolve(here, '..', '..')),
  dataDir: resolve(env.DATA_DIR || resolve(here, '..', 'data')),
  // modo demostración: carga las 4 empresas de ejemplo, muestra el código de acceso en pantalla
  // y deja entrar a los operadores con el PIN de demo. En producción: DEMO=0
  demo: env.DEMO === undefined ? true : bool(env.DEMO),
  demoPin: env.DEMO_OP_PIN || '1234',
  // envío de códigos: 'log' (solo en la bitácora del servidor), 'twilio' (SMS) y 'sendgrid' (correo)
  sms: { provider: env.SMS_PROVIDER || 'log', twilioSid: env.TWILIO_SID, twilioToken: env.TWILIO_TOKEN, twilioFrom: env.TWILIO_FROM },
  email: { provider: env.EMAIL_PROVIDER || 'log', sendgridKey: env.SENDGRID_KEY, from: env.EMAIL_FROM || 'NAVI Mando <no-responder@navimovil.com>' },
  sessionHours: Number(env.SESSION_HOURS || 12),
  keepDays: Number(env.SESSION_KEEP_DAYS || 30),
  trustProxy: bool(env.TRUST_PROXY)
};
