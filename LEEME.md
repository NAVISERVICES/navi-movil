# Navi Móvil · sitio y suite Mi Navi

Sitio estático (HTML, CSS, JS e imágenes). Se publica tal cual en GitHub Pages.

## Publicar en GitHub Pages
1. GitHub → **New repository** (público) → **uploading an existing file** → arrastra todo el contenido de esta carpeta → **Commit changes**.
2. **Settings → Pages** → Source: **Deploy from a branch** → `main` / `(root)` → Save.
3. **Custom domain**: escribe tu dominio y guarda. En tu proveedor de dominio agrega:
   - `CNAME` · `www` → `TU-USUARIO.github.io`
   - `A` · `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
4. Cuando GitHub verifique el dominio, activa **Enforce HTTPS**.

## Páginas
La raíz (`index.html`) muestra "Muy pronto". El sitio completo vive en `demo/` → https://www.navimovil.com/demo/
(oculto a buscadores con `robots.txt` y `noindex`, pero sin contraseña: quien tenga el enlace puede entrar).

Dentro de `demo/`:
- `index.html` — página principal (planes, Plan Familia, descarga de la app)
- `login.html` — acceso Mi Navi con número y código SMS (demo)
- `cuenta.html` — perfil, equipos y suite de apps
- `movil.html` — consumo de datos, llamadas y mensajes
- `recargas.html` — recargas y puntos de venta
- `juegos.html`, `videos.html` — catálogo de NAVI Store
- `sos.html` — NAVI SOS Family

Todo funciona con datos de demostración guardados en el navegador; no hay cobros, SMS ni ubicación reales.
