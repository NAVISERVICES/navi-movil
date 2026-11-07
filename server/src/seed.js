// Datos iniciales: se toman del mismo mando.js que usa la consola, así la demo y el servidor no se separan.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { CONFIG } from './config.js';
import { q, audit } from './db.js';

// mando.js es código de navegador: se ejecuta aquí con un "navegador" mínimo y sin guardar nada
function loadMando() {
  const store = { getItem: () => null, setItem() {}, removeItem() {} };
  const win = { addEventListener() {}, localStorage: store, sessionStorage: store, navigator: {} };
  const ctx = vm.createContext({ window: win, localStorage: store, sessionStorage: store, navigator: {}, console });
  vm.runInContext(readFileSync(join(CONFIG.staticRoot, 'demo', 'mando', 'mando.js'), 'utf8'), ctx, { filename: 'mando.js' });
  return win.Mando;
}
export const Mando = loadMando();

// las mismas reglas de cambios que el navegador
const ctx2 = vm.createContext({});
vm.runInContext(readFileSync(join(CONFIG.staticRoot, 'demo', 'mando', 'patch.js'), 'utf8') + ';this.P = globalThis.NaviPatch;', ctx2);
export const Patch = ctx2.P;

export function seedDemo() {
  if (!CONFIG.demo) return;
  const C = Mando.CLIENTS;
  for (const id of Object.keys(C)) {
    q('INSERT INTO companies (id, code, name, demo) VALUES (?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET code = excluded.code, name = excluded.name').run(id, C[id].code, C[id].name);
    const row = q('SELECT v, doc FROM state WHERE company = ?').get(id);
    let docV = null;
    if (row) { try { docV = JSON.parse(row.doc).v; } catch (e) {} }
    // empresa demo sin datos, o con datos de una versión anterior de la demo → datos nuevos
    if (!row || docV !== Mando.V) {
      const doc = JSON.stringify(Mando._seed(id));
      q('INSERT INTO state (company, v, doc, updated) VALUES (?, ?, ?, ?) ON CONFLICT(company) DO UPDATE SET v = state.v + 1, doc = excluded.doc, updated = excluded.updated').run(id, 1, doc, Date.now());
      audit(id, 'sistema', row ? 'demo-reiniciada' : 'demo-creada', 'versión de datos ' + Mando.V);
    }
  }
  for (const u of Mando.Auth.USERS) {
    q(`INSERT INTO users (user, company, name, role, email, phone, admin) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user) DO UPDATE SET company = excluded.company, name = excluded.name, role = excluded.role, email = excluded.email, phone = excluded.phone, admin = excluded.admin`)
      .run(u.user, u.client, u.name, u.role, u.email, u.phone, u.admin ? 1 : 0);
  }
}
