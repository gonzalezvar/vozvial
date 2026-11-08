// Servidor de cuentas y datos propio de una prueba, con su base PGlite a la vista, para revisar
// las tablas despues de que el navegador escribe en ella (CA-01.6). Es el mismo codigo que corre
// en produccion (src/servidor/rutas.ts con las migraciones reales); las peticiones del navegador a
// /api/cuentas, /api/sesiones, /api/casos... se desvian a este servidor con page.route.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { BrowserContext } from '@playwright/test';

import { conectar, type BaseDatos } from '../src/servidor/bd/conexion';
import { migrar } from '../src/servidor/bd/migraciones';
import { configuracionDesdeEntorno } from '../src/servidor/configuracion';
import { ApiDatos } from '../src/servidor/rutas';

export interface ServidorPrueba {
  bd: BaseDatos;
  /** Todas las filas de cada tabla de datos, en texto (bytea en base64), para buscar datos en claro. */
  volcar: () => Promise<Record<string, Record<string, unknown>[]>>;
  cerrar: () => Promise<void>;
}

const RUTAS_DATOS = /\/api\/(cuentas|sesiones|recuperacion|cuenta|casos|evidencias)(\/|\?|$)/;
const TABLAS = ['cuentas', 'sesiones', 'casos', 'evidencias'] as const;

/** Mismos valores baratos que playwright.config.ts pasa al servidor e2e. */
export async function iniciarServidorPrueba(contexto: BrowserContext): Promise<ServidorPrueba> {
  const config = {
    ...configuracionDesdeEntorno({}),
    scrypt: { N: 1024, r: 8, p: 1 },
    peticionesPorMinuto: 10_000,
    iteracionesAuth: 1000,
    bloqueoMs: 3000,
  };
  const bd = await conectar();
  await migrar(bd);
  const api = new ApiDatos({ bd, config });
  const servidor: Server = createServer((req, res) => {
    void api.manejar(req, res).then((atendida) => {
      if (!atendida) {
        res.statusCode = 404;
        res.end();
      }
    });
  });
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const { port } = servidor.address() as AddressInfo;

  await contexto.route(RUTAS_DATOS, async (ruta) => {
    const url = new URL(ruta.request().url());
    const respuesta = await ruta.fetch({ url: `http://127.0.0.1:${port}${url.pathname}${url.search}` });
    await ruta.fulfill({ response: respuesta });
  });

  return {
    bd,
    volcar: async () => {
      const salida: Record<string, Record<string, unknown>[]> = {};
      for (const tabla of TABLAS) {
        const filas = await bd.consultar(`SELECT * FROM ${tabla}`);
        salida[tabla] = filas.map((fila) =>
          Object.fromEntries(
            Object.entries(fila).map(([k, v]) => [k, v instanceof Uint8Array ? Buffer.from(v).toString('base64') : v]),
          ),
        );
      }
      return salida;
    },
    cerrar: async () => {
      await contexto.unrouteAll({ behavior: 'ignoreErrors' });
      await new Promise<void>((resolve) => servidor.close(() => resolve()));
      await bd.cerrar();
    },
  };
}
