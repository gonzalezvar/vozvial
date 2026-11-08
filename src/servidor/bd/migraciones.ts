import type { BaseDatos } from './conexion';

export interface Migracion {
  version: number;
  nombre: string;
  sql: string;
}

/**
 * Migraciones versionadas. Nunca se edita una que ya corrio en Railway: se agrega una nueva.
 * Todo lo que guarda el usuario (perfil, casos, evidencias, claves) llega cifrado desde el cliente;
 * en claro solo quedan el celular (para entrar), marcas de tiempo, tamanos y tipo MIME.
 */
export const MIGRACIONES: readonly Migracion[] = [
  {
    version: 1,
    nombre: 'esquema_inicial',
    sql: `
      CREATE TABLE IF NOT EXISTS cuentas (
        id uuid PRIMARY KEY,
        celular text NOT NULL UNIQUE,
        sal_auth text NOT NULL,
        iteraciones_auth integer NOT NULL,
        verificador_pin text NOT NULL,
        verificador_codigo text NOT NULL,
        clave_envuelta_pin jsonb NOT NULL,
        clave_envuelta_codigo jsonb NOT NULL,
        perfil_cifrado jsonb NOT NULL,
        creada_en timestamptz NOT NULL DEFAULT now(),
        intentos_fallidos integer NOT NULL DEFAULT 0,
        bloqueada_hasta timestamptz
      );

      CREATE TABLE IF NOT EXISTS sesiones (
        token_hash text PRIMARY KEY,
        cuenta_id uuid NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
        creada_en timestamptz NOT NULL DEFAULT now(),
        expira_en timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sesiones_cuenta_idx ON sesiones (cuenta_id);

      CREATE TABLE IF NOT EXISTS casos (
        cuenta_id uuid NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
        id text NOT NULL,
        iv text NOT NULL,
        datos text NOT NULL,
        actualizado_en timestamptz NOT NULL,
        borrado boolean NOT NULL DEFAULT false,
        PRIMARY KEY (cuenta_id, id)
      );

      CREATE TABLE IF NOT EXISTS evidencias (
        cuenta_id uuid NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
        id text NOT NULL,
        caso_id text NOT NULL,
        iv text NOT NULL,
        datos bytea NOT NULL,
        mime text NOT NULL,
        tamano integer NOT NULL,
        actualizado_en timestamptz NOT NULL,
        PRIMARY KEY (cuenta_id, id),
        FOREIGN KEY (cuenta_id, caso_id) REFERENCES casos(cuenta_id, id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS evidencias_caso_idx ON evidencias (cuenta_id, caso_id);
    `,
  },
];

/**
 * Crea la tabla de control y aplica, en orden y cada una en su transaccion, las migraciones
 * que falten. Es idempotente: correrla dos veces no cambia nada.
 */
export async function migrar(bd: BaseDatos, migraciones: readonly Migracion[] = MIGRACIONES): Promise<number[]> {
  await bd.ejecutarScript(`
    CREATE TABLE IF NOT EXISTS migraciones (
      version integer PRIMARY KEY,
      nombre text NOT NULL,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    );
  `);
  const aplicadas = new Set(
    (await bd.consultar<{ version: number }>('SELECT version FROM migraciones')).map((f) => Number(f.version)),
  );
  const nuevas: number[] = [];
  for (const migracion of [...migraciones].sort((a, b) => a.version - b.version)) {
    if (aplicadas.has(migracion.version)) continue;
    await bd.transaccion(async (tx) => {
      // Varias sentencias en una sola llamada: se separan por ";" porque los parametros no se usan aqui.
      for (const sentencia of dividirSentencias(migracion.sql)) await tx.consultar(sentencia);
      // ON CONFLICT: si otra instancia la aplico al mismo tiempo, no falla.
      await tx.consultar('INSERT INTO migraciones (version, nombre) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING', [
        migracion.version,
        migracion.nombre,
      ]);
    });
    nuevas.push(migracion.version);
  }
  return nuevas;
}

function dividirSentencias(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
