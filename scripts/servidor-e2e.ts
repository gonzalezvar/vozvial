// Sirve dist/ como SPA, /api/asistente y la API de cuentas y datos cifrados (src/servidor/rutas.ts) en el mismo origen.
// Lo usan Playwright y el despliegue en Railway.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

import serveHandler from 'serve-handler';

import handler from '../api/asistente';
import { crearManejadorDatos } from '../src/servidor/rutas';
import { ejecutarHandlerVercel, rutaDe } from './adaptador-vercel';

const PUERTO = Number(process.env.PORT ?? 4173);
const RAIZ = path.resolve(__dirname, '..');
const DIST = path.join(RAIZ, process.env.E2E_DIST ?? 'dist');

// Reutiliza las cabeceras de seguridad de vercel.json para que e2e detecte problemas de CSP.
interface ConfigVercel {
  headers?: { source: string; headers: { key: string; value: string }[] }[];
}
const configVercel = JSON.parse(readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8')) as ConfigVercel;
const cabeceras = configVercel.headers?.find((h) => h.source === '/(.*)')?.headers ?? [];

// Postgres si hay DATABASE_URL (Railway); si no, PGlite en memoria (o en PGLITE_DIR). Migra al arrancar.
const apiDatos = crearManejadorDatos();
void apiDatos.listo.then((api) => {
  if (!api) return;
  // Solo el tipo de base y de dónde salió el secreto; nunca la URL ni el secreto.
  console.log(`API de datos lista (${api.descripcion()})`);
});

const servidor = createServer((req, res) => {
  for (const { key, value } of cabeceras) res.setHeader(key, value);

  const ruta = rutaDe(req);
  if (ruta === '/api/asistente') {
    void ejecutarHandlerVercel(handler, req, res);
    return;
  }
  if (ruta.startsWith('/api/')) {
    void apiDatos.manejar(req, res).then((atendida) => {
      if (atendida) return;
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'no_encontrado' }));
    });
    return;
  }

  void serveHandler(req, res, {
    public: DIST,
    cleanUrls: false,
    directoryListing: false,
    // Cualquier ruta que no sea un archivo existente cae en index.html (SPA).
    rewrites: [{ source: '**', destination: '/index.html' }],
  });
});

servidor.listen(PUERTO, () => {
  console.log(`Servidor e2e en http://localhost:${PUERTO}`);
});
