// Base de datos: SQLite incluido en Node (sin instalar nada más). Un solo archivo en DATA_DIR.
// Para muchas empresas o varios servidores se cambia a PostgreSQL sin tocar el resto: todo pasa por aquí.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG } from './config.js';

mkdirSync(CONFIG.dataDir, { recursive: true });
mkdirSync(join(CONFIG.dataDir, 'backups'), { recursive: true });

export const db = new DatabaseSync(join(CONFIG.dataDir, 'navi.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,            -- seguridad, transporte, operativa, mixta…
    code TEXT UNIQUE NOT NULL,      -- código de empresa para la app (NAVI-2200)
    name TEXT NOT NULL,
    demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS users (          -- usuarios de la consola
    user TEXT PRIMARY KEY,
    company TEXT NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    admin INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS login_codes (    -- códigos de acceso: se guardan cifrados, duran 10 minutos
    user TEXT NOT NULL,
    hash TEXT NOT NULL,
    via TEXT NOT NULL,
    at INTEGER NOT NULL,
    tries INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sessions (       -- sesiones: solo se guarda la huella del token
    hash TEXT PRIMARY KEY,
    kind TEXT NOT NULL,                       -- consola | operador
    company TEXT NOT NULL,
    subject TEXT NOT NULL,                    -- usuario de consola o id del operador
    data TEXT NOT NULL,                       -- lo que la pantalla necesita (nombre, rol, admin…)
    expires INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS state (          -- datos de operación de cada empresa (mismo formato que la demo)
    company TEXT PRIMARY KEY REFERENCES companies(id),
    v INTEGER NOT NULL,                       -- versión: sube con cada cambio
    doc TEXT NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit (          -- bitácora de accesos y cambios importantes
    at INTEGER NOT NULL,
    company TEXT,
    actor TEXT,
    action TEXT NOT NULL,
    detail TEXT
  );
  CREATE INDEX IF NOT EXISTS audit_at ON audit(at);
`);

export const q = sql => db.prepare(sql);
export function audit(company, actor, action, detail) {
  q('INSERT INTO audit (at, company, actor, action, detail) VALUES (?, ?, ?, ?, ?)').run(Date.now(), company || null, actor || null, action, detail ? String(detail).slice(0, 500) : null);
}

// respaldo diario: copia consistente del archivo, se guardan los últimos 14
export function backup() {
  const day = new Date().toISOString().slice(0, 10);
  const file = join(CONFIG.dataDir, 'backups', `navi-${day}.sqlite`);
  try { unlinkSync(file); } catch (e) {}
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const all = readdirSync(join(CONFIG.dataDir, 'backups')).filter(f => /^navi-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort();
  all.slice(0, Math.max(0, all.length - 14)).forEach(f => { try { unlinkSync(join(CONFIG.dataDir, 'backups', f)); } catch (e) {} });
  return file;
}
