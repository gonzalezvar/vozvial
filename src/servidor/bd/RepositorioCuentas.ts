import type { ClaveEnvuelta, DatosCifrados } from '../../core/GestorClaves';
import { aISO, type Consultor } from './conexion';

export interface CuentaServidor {
  id: string;
  celular: string;
  salAuth: string;
  iteracionesAuth: number;
  /** Hash de servidor (scrypt) del verificador que manda el cliente. */
  verificadorPin: string;
  verificadorCodigo: string;
  claveEnvueltaPin: ClaveEnvuelta;
  claveEnvueltaCodigo: ClaveEnvuelta;
  perfilCifrado: DatosCifrados;
  creadaEn: string;
  intentosFallidos: number;
  /** ms desde la epoca, o null si no esta bloqueada. */
  bloqueadaHasta: number | null;
}

export type NuevaCuentaServidor = Omit<CuentaServidor, 'creadaEn' | 'intentosFallidos' | 'bloqueadaHasta'>;

interface FilaCuenta {
  id: string;
  celular: string;
  sal_auth: string;
  iteraciones_auth: number;
  verificador_pin: string;
  verificador_codigo: string;
  clave_envuelta_pin: ClaveEnvuelta | string;
  clave_envuelta_codigo: ClaveEnvuelta | string;
  perfil_cifrado: DatosCifrados | string;
  creada_en: unknown;
  intentos_fallidos: number;
  bloqueada_hasta: unknown;
}

// jsonb llega como objeto en pg y PGlite; si algun driver lo entrega como texto se parsea.
function json<T>(valor: T | string): T {
  return typeof valor === 'string' ? (JSON.parse(valor) as T) : valor;
}

function desdeFila(f: FilaCuenta): CuentaServidor {
  return {
    id: f.id,
    celular: f.celular,
    salAuth: f.sal_auth,
    iteracionesAuth: Number(f.iteraciones_auth),
    verificadorPin: f.verificador_pin,
    verificadorCodigo: f.verificador_codigo,
    claveEnvueltaPin: json(f.clave_envuelta_pin),
    claveEnvueltaCodigo: json(f.clave_envuelta_codigo),
    perfilCifrado: json(f.perfil_cifrado),
    creadaEn: aISO(f.creada_en),
    intentosFallidos: Number(f.intentos_fallidos),
    bloqueadaHasta: f.bloqueada_hasta == null ? null : Date.parse(aISO(f.bloqueada_hasta)),
  };
}

export class RepositorioCuentas {
  constructor(private readonly bd: Consultor) {}

  /** Devuelve false si el celular ya estaba registrado. */
  async crear(c: NuevaCuentaServidor): Promise<boolean> {
    const filas = await this.bd.consultar<{ id: string }>(
      `INSERT INTO cuentas (id, celular, sal_auth, iteraciones_auth, verificador_pin, verificador_codigo,
         clave_envuelta_pin, clave_envuelta_codigo, perfil_cifrado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (celular) DO NOTHING
       RETURNING id`,
      [
        c.id,
        c.celular,
        c.salAuth,
        c.iteracionesAuth,
        c.verificadorPin,
        c.verificadorCodigo,
        JSON.stringify(c.claveEnvueltaPin),
        JSON.stringify(c.claveEnvueltaCodigo),
        JSON.stringify(c.perfilCifrado),
      ],
    );
    return filas.length === 1;
  }

  async buscarPorCelular(celular: string): Promise<CuentaServidor | null> {
    const filas = await this.bd.consultar<FilaCuenta>('SELECT * FROM cuentas WHERE celular = $1', [celular]);
    return filas[0] ? desdeFila(filas[0]) : null;
  }

  async buscarPorId(id: string): Promise<CuentaServidor | null> {
    const filas = await this.bd.consultar<FilaCuenta>('SELECT * FROM cuentas WHERE id = $1', [id]);
    return filas[0] ? desdeFila(filas[0]) : null;
  }

  async guardarIntentos(id: string, fallos: number, bloqueadaHasta: number | null): Promise<void> {
    await this.bd.consultar('UPDATE cuentas SET intentos_fallidos = $2, bloqueada_hasta = $3 WHERE id = $1', [
      id,
      fallos,
      bloqueadaHasta === null ? null : new Date(bloqueadaHasta),
    ]);
  }

  /** Recuperacion o cambio de PIN: nuevo verificador y nueva envoltura; reinicia el bloqueo. */
  async cambiarPin(id: string, verificadorPin: string, claveEnvueltaPin: ClaveEnvuelta): Promise<void> {
    await this.bd.consultar(
      `UPDATE cuentas SET verificador_pin = $2, clave_envuelta_pin = $3, intentos_fallidos = 0, bloqueada_hasta = NULL
       WHERE id = $1`,
      [id, verificadorPin, JSON.stringify(claveEnvueltaPin)],
    );
  }

  /** Borra la cuenta; sesiones, casos y evidencias caen en cascada. */
  async borrar(id: string): Promise<void> {
    await this.bd.consultar('DELETE FROM cuentas WHERE id = $1', [id]);
  }

  async borrarPorCelular(celular: string): Promise<void> {
    await this.bd.consultar('DELETE FROM cuentas WHERE celular = $1', [celular]);
  }

  async contar(): Promise<number> {
    const filas = await this.bd.consultar<{ n: number | string }>('SELECT count(*) AS n FROM cuentas');
    return Number(filas[0]?.n ?? 0);
  }
}
