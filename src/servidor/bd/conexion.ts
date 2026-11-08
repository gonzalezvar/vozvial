import { PGlite, type Transaction } from '@electric-sql/pglite';
import { Pool, type PoolClient } from 'pg';

/** Lo que necesitan los repositorios: consultas con parametros ($1, $2...). */
export interface Consultor {
  consultar<T = Record<string, unknown>>(sql: string, parametros?: unknown[]): Promise<T[]>;
}

/**
 * Base de datos del servidor. En Railway es Postgres (paquete pg, DATABASE_URL);
 * en local y en pruebas es PGlite, un Postgres compilado a WASM que corre en el mismo proceso.
 * Los dos hablan el mismo SQL, asi que migraciones y repositorios son unicos.
 */
export interface BaseDatos extends Consultor {
  readonly tipo: 'pg' | 'pglite';
  /** Varias sentencias separadas por punto y coma, sin parametros (migraciones). */
  ejecutarScript(sql: string): Promise<void>;
  transaccion<R>(trabajo: (tx: Consultor) => Promise<R>): Promise<R>;
  cerrar(): Promise<void>;
}

export interface OpcionesConexion {
  /** URL de Postgres. Sin ella se usa PGlite. */
  url?: string;
  /** Carpeta de datos de PGlite. Sin ella PGlite vive solo en memoria. */
  directorioPglite?: string;
}

/** pg devuelve bytea como Buffer y PGlite como Uint8Array: se entrega siempre Uint8Array. */
export function aBytes(valor: unknown): Uint8Array {
  if (valor instanceof Uint8Array) return new Uint8Array(valor.buffer, valor.byteOffset, valor.byteLength);
  throw new TypeError('Se esperaba un bytea');
}

/** timestamptz llega como Date en los dos clientes; se entrega en ISO 8601. */
export function aISO(valor: unknown): string {
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'string') return new Date(valor).toISOString();
  throw new TypeError('Se esperaba una fecha');
}

class BaseDatosPg implements BaseDatos {
  readonly tipo = 'pg' as const;

  constructor(private readonly pool: Pool) {}

  async consultar<T>(sql: string, parametros: unknown[] = []): Promise<T[]> {
    const resultado = await this.pool.query(sql, parametros);
    return resultado.rows as T[];
  }

  async ejecutarScript(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async transaccion<R>(trabajo: (tx: Consultor) => Promise<R>): Promise<R> {
    const cliente: PoolClient = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const tx: Consultor = {
        consultar: async <T>(sql: string, parametros: unknown[] = []) =>
          (await cliente.query(sql, parametros)).rows as T[],
      };
      const resultado = await trabajo(tx);
      await cliente.query('COMMIT');
      return resultado;
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      cliente.release();
    }
  }

  cerrar(): Promise<void> {
    return this.pool.end();
  }
}

class BaseDatosPglite implements BaseDatos {
  readonly tipo = 'pglite' as const;

  constructor(private readonly db: PGlite) {}

  async consultar<T>(sql: string, parametros: unknown[] = []): Promise<T[]> {
    return (await this.db.query<T>(sql, parametros)).rows;
  }

  async ejecutarScript(sql: string): Promise<void> {
    await this.db.exec(sql);
  }

  transaccion<R>(trabajo: (tx: Consultor) => Promise<R>): Promise<R> {
    return this.db.transaction(async (t: Transaction) =>
      trabajo({ consultar: async <T>(sql: string, parametros: unknown[] = []) => (await t.query<T>(sql, parametros)).rows }),
    );
  }

  cerrar(): Promise<void> {
    return this.db.close();
  }
}

/** Elige pg si hay URL y PGlite si no. PGlite solo carga su WASM al crear la instancia. */
export async function conectar(opciones: OpcionesConexion = {}): Promise<BaseDatos> {
  if (opciones.url) {
    const pool = new Pool({ connectionString: opciones.url, max: 5, idleTimeoutMillis: 30_000 });
    // Sin este manejador, un corte de la conexion inactiva tumbaria el proceso.
    pool.on('error', () => undefined);
    return new BaseDatosPg(pool);
  }
  const db = opciones.directorioPglite ? new PGlite(opciones.directorioPglite) : new PGlite();
  await db.waitReady;
  return new BaseDatosPglite(db);
}
