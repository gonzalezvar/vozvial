import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { conectar, type BaseDatos } from '../../../../src/servidor/bd/conexion';
import { migrar } from '../../../../src/servidor/bd/migraciones';
import { configuracionDesdeEntorno, type ConfiguracionDatos } from '../../../../src/servidor/configuracion';
import { ApiDatos } from '../../../../src/servidor/rutas';

/** Reloj que la prueba adelanta a mano (bloqueos y marcas de tiempo). */
export class RelojPrueba {
  constructor(public ms = Date.parse('2026-11-09T15:00:00.000Z')) {}
  ahora = (): Date => new Date(this.ms);
  avanzar(ms: number): void {
    this.ms += ms;
  }
}

export interface EntornoApi {
  bd: BaseDatos;
  api: ApiDatos;
  config: ConfiguracionDatos;
  reloj: RelojPrueba;
  url: string;
  cerrar: () => Promise<void>;
}

/** PGlite en memoria + API real detras de un servidor HTTP en un puerto libre. scrypt barato para que sea rapido. */
export async function crearEntorno(cambios: Partial<ConfiguracionDatos> = {}): Promise<EntornoApi> {
  const config: ConfiguracionDatos = {
    ...configuracionDesdeEntorno({}),
    scrypt: { N: 1024, r: 8, p: 1 },
    peticionesPorMinuto: 10_000,
    iteracionesAuth: 1000,
    ...cambios,
  };
  const bd = await conectar();
  await migrar(bd);
  const reloj = new RelojPrueba();
  const api = new ApiDatos({ bd, config, reloj: reloj.ahora });
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
  return {
    bd,
    api,
    config,
    reloj,
    url: `http://127.0.0.1:${port}`,
    cerrar: async () => {
      await new Promise<void>((resolve) => servidor.close(() => resolve()));
      await bd.cerrar();
    },
  };
}
