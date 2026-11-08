// Servidor local del asistente y de la API de datos para desarrollo (npm run api). Usa los mismos handlers que produccion.
import { createServer } from 'node:http';

import handler from '../api/asistente';
import { CABECERAS_EVIDENCIA, crearManejadorDatos } from '../src/servidor/rutas';
import { ejecutarHandlerVercel, rutaDe } from './adaptador-vercel';

const PUERTO = Number(process.env.PORT ?? 3001);
// CORS solo para la app servida por Expo en localhost (cualquier puerto).
const ORIGEN_PERMITIDO = /^http:\/\/localhost(:\d{1,5})?$/;
// PGlite en memoria si no hay DATABASE_URL (o en PGLITE_DIR para conservar los datos entre reinicios).
const apiDatos = crearManejadorDatos();
const CABECERAS_DATOS = Object.values(CABECERAS_EVIDENCIA).join(', ');

const servidor = createServer((req, res) => {
  const origen = req.headers.origin;
  if (origen && ORIGEN_PERMITIDO.test(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', `Content-Type, Authorization, ${CABECERAS_DATOS}`);
    res.setHeader('Access-Control-Expose-Headers', CABECERAS_DATOS);
    res.setHeader('Access-Control-Max-Age', '600');
  }

  if (req.method === 'OPTIONS' && rutaDe(req).startsWith('/api/')) {
    res.statusCode = origen && ORIGEN_PERMITIDO.test(origen) ? 204 : 403;
    res.end();
    return;
  }

  if (rutaDe(req) !== '/api/asistente') {
    void apiDatos.manejar(req, res).then((atendida) => {
      if (atendida) return;
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'no_encontrado' }));
    });
    return;
  }
  void ejecutarHandlerVercel(handler, req, res);
});

servidor.listen(PUERTO, () => {
  console.log(`Servidor del asistente y la API de datos en http://localhost:${PUERTO}/api/`);
});
