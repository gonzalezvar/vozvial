// Sirve dist/ como SPA y /api/asistente en el mismo origen, como en Vercel. Lo usa Playwright.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

import serveHandler from 'serve-handler';

import handler from '../api/asistente';
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

const servidor = createServer((req, res) => {
  for (const { key, value } of cabeceras) res.setHeader(key, value);

  const ruta = rutaDe(req);
  if (ruta === '/api/asistente') {
    void ejecutarHandlerVercel(handler, req, res);
    return;
  }
  if (ruta.startsWith('/api/')) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'no_encontrado' }));
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
