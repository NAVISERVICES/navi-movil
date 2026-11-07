# Servidor de Navi

Un solo servidor publica:

- **Navi Móvil** (`/` y `/demo/…`).
- **Navi Empresas** (`/demo/empresas.html`, o un dominio propio si se activa en el `Caddyfile`).
- **La API de NAVI Órbita** (`/api/…`): acceso con código por correo o SMS, datos de cada empresa y cambios en vivo entre la consola y la app.

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

## Qué hace hoy y qué falta

| Ya funciona | Falta para producción |
| --- | --- |
| Acceso a la consola con código de 6 dígitos (vence en 10 min, 5 intentos) | Cuentas reales de SMS y correo (Twilio y SendGrid ya están conectados; faltan llaves) |
| Sesiones del servidor; el permiso de administrador se revisa en el servidor | Alta de usuarios y empresas desde una pantalla (hoy salen de la demo) |
| Datos de cada empresa separados; nadie ve otra empresa | PIN propio por operador (hoy, PIN de demo) |
| Cambios en vivo entre consola y app, por campo, sin pisarse | Limitar qué puede cambiar un operador (hoy cualquier dato de su empresa) |
| Una sola consola corre las revisiones automáticas por empresa | Servidor de voz para PTT en vivo (ver plan de PTT) |
| Respaldo diario y bitácora de accesos | Mi Navi, Recargas y Navi Central siguen en modo demo del navegador |
