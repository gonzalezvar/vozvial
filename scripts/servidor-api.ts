// Servidor local del asistente para desarrollo (npm run api). Usa el mismo handler que Vercel.
import { createServer } from 'node:http';

import handler from '../api/asistente';
import { ejecutarHandlerVercel, rutaDe } from './adaptador-vercel';

const PUERTO = Number(process.env.PORT ?? 3001);
// CORS solo para la app servida por Expo en localhost (cualquier puerto).
const ORIGEN_PERMITIDO = /^http:\/\/localhost(:\d{1,5})?$/;

const servidor = createServer((req, res) => {
  const origen = req.headers.origin;
  if (origen && ORIGEN_PERMITIDO.test(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }

  if (rutaDe(req) !== '/api/asistente') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'no_encontrado' }));
    return;
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = origen && ORIGEN_PERMITIDO.test(origen) ? 204 : 403;
    res.end();
    return;
  }

  void ejecutarHandlerVercel(handler, req, res);
});

servidor.listen(PUERTO, () => {
  console.log(`Servidor del asistente en http://localhost:${PUERTO}/api/asistente`);
});
