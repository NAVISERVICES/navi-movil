# Servidor de Navi

Un solo servidor publica:

- **Navi Móvil** (`/` y `/demo/…`).
- **Navi Empresas** (`/demo/empresas.html`, o un dominio propio si se activa en el `Caddyfile`).
- **La API de NAVI Órbita** (`/api/…`): acceso con código por correo o SMS, datos de cada empresa y cambios en vivo entre la consola y la app.
- **Los avisos automáticos del operador** (`/webhooks/operador`): recargas, activaciones, cambio de IMEI, suspensiones, bajas y portabilidad (ver abajo).

No usa librerías externas: solo Node.js 24 o más nuevo (trae HTTP, SQLite y criptografía). Los datos quedan en un archivo SQLite dentro de `/data`, con un respaldo diario (se guardan los últimos 14).

## Probar en tu computadora

```bash
cd server
node src/server.js
```

Abre http://localhost:8080/demo/mando/login.html. En modo demo, el código de acceso aparece en pantalla y en la bitácora del servidor.

Prueba automática (arranca el servidor con datos temporales y revisa acceso, datos y canal en vivo):

```bash
node test/smoke.js
```

## Instalar en un servidor (cualquier nube)

Necesitas un servidor Linux con Docker, de preferencia en México. Con 1 a 2 GB de RAM alcanza para empezar.

1. Copia el repositorio al servidor (por ejemplo con `git clone`).
2. Crea la configuración: `cp .env.example .env` y llena los valores.
   - Para producción usa `DEMO=0` y configura el envío de SMS y correo.
3. En tu proveedor de dominio, apunta `www.navimovil.com` y `navimovil.com` (registro A) a la IP del servidor.
4. Arranca: `docker compose up -d --build`. Caddy obtiene el certificado HTTPS solo.
5. Revisa que funcione: `https://www.navimovil.com/api/health` debe responder `{"ok":true,…}`.

Para actualizar después de un cambio: `git pull` y luego `docker compose up -d --build`.

### Cambio desde GitHub Pages

Mientras el DNS apunte a GitHub, el sitio sigue saliendo de GitHub Pages: la demo funciona sola en el navegador, igual que hoy. En cuanto el DNS apunte al servidor, la misma demo se conecta a la API sin cambiar nada (lo decide `demo/mando/config.js`, que el servidor responde con la dirección de la API).

## Avisos del operador (webhooks)

Dirección pública: **https://api.navimovil.com/webhooks/operador** (en línea desde el 25 de noviembre de 2026). El operador (Custome Mobile / Conec-Rural) manda ahí cada aviso; el código está en `src/webhooks.js`.

- `GET` → `{"ok":true}` (prueba de conexión del operador).
- `POST` → guarda el aviso completo en la tabla `operator_events` (fecha, IP, tipo, id del aviso, encabezados sin llaves, cuerpo) y responde `{"ok":true,"recibido":<n>}` al instante. Acepta JSON o texto.
- Si el aviso trae un id (`event_id`, `id_evento`, `id`…) y ya lo teníamos, responde `{"duplicado":true}` y no lo guarda otra vez (el operador reintenta).
- Seguridad, en `.env` (vacías = no se exigen; los avisos quedan con `verified = 0`):
  - `WEBHOOK_IPS`: IPs del operador separadas por coma; cualquier otra recibe 403.
  - `WEBHOOK_TOKEN`: llave compartida en `Authorization: Bearer …` o `X-Webhook-Token`; sin ella, 401.
  - `WEBHOOK_SECRET` + `WEBHOOK_SIG_HEADER` (por omisión `X-Signature`): firma HMAC-SHA256 del cuerpo (`sha256=<hex>`, hex o base64); firma inválida, 401; válida, `verified = 1`.
- Pendiente: procesar los avisos guardados (actualizar la línea y avisar al cliente) y llenar las variables de seguridad cuando el operador las entregue.

Ver los últimos avisos en el servidor:

```bash
sudo docker exec navi-api node -e "const {DatabaseSync}=require('node:sqlite');console.table(new DatabaseSync('/data/navi.sqlite').prepare('SELECT id, datetime(at/1000,\'unixepoch\') AS fecha, ip, type, event_id, verified FROM operator_events ORDER BY id DESC LIMIT 20').all())"
```

### Cómo está instalado (AWS Lightsail `wms-navi`)

Por ahora solo los avisos están en el servidor; el sitio sigue en GitHub Pages.

- Carpeta `~/navi-api`: copia parcial de este repositorio (`git sparse-checkout`: `server/`, `Dockerfile`, `.dockerignore`, `.env.example`, `demo/mando/mando.js`, `demo/mando/patch.js`).
- `docker-compose.api.yml` (solo en el servidor): contenedor `navi-api`, volumen `navi-api-data`, conectado a la red `wms_default`.
- `.env` (solo en el servidor, permisos 600): `DEMO=0` y las variables `WEBHOOK_*`.
- HTTPS: lo da el Caddy del WMS (repo `wms-multicliente`, archivo `Caddyfile`, bloque `api.navimovil.com`). Solo deja pasar `/webhooks/*` y `/api/health`; lo demás responde 404.
- DNS (name.com): `api` tipo A → 77.113.47.166 y tipo AAAA → 2600:1f16:89c:e900:a29c:3f5c:e927:97b4.
- Actualizar después de un cambio subido a GitHub:

```bash
cd ~/navi-api && git pull && sudo docker compose -f docker-compose.api.yml up -d --build
```

## Qué hace hoy y qué falta

| Ya funciona | Falta para producción |
| --- | --- |
| Acceso a la consola con código de 6 dígitos (vence en 10 min, 5 intentos) | Cuentas reales de SMS y correo (Twilio y SendGrid ya están conectados; faltan llaves) |
| Sesiones del servidor; el permiso de administrador se revisa en el servidor | Alta de usuarios y empresas desde una pantalla (hoy salen de la demo) |
| Datos de cada empresa separados; nadie ve otra empresa | PIN propio por operador (hoy, PIN de demo) |
| Cambios en vivo entre consola y app, por campo, sin pisarse | Limitar qué puede cambiar un operador (hoy cualquier dato de su empresa) |
| Una sola consola corre las revisiones automáticas por empresa | Servidor de voz para PTT en vivo (ver plan de PTT) |
| Respaldo diario y bitácora de accesos | Mi Navi, Recargas y Navi Central siguen en modo demo del navegador |
