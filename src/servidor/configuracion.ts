import { createHash } from 'node:crypto';

import { BLOQUEO_MS_POR_DEFECTO, MAX_INTENTOS_POR_DEFECTO } from '../core/ControlIntentos';
import { ITERACIONES_PBKDF2_POR_DEFECTO } from '../core/DerivadorPBKDF2';
import { SCRYPT_PREDETERMINADO, type ParametrosScrypt } from './cuentas/CriptoServidor';

/** Secreto solo para desarrollo local y pruebas. En Railway se define SECRETO_SERVIDOR. */
export const SECRETO_LOCAL = 'vozvial-secreto-solo-para-desarrollo-local';

export const MB = 1024 * 1024;

export interface ConfiguracionDatos {
  urlBaseDatos?: string;
  directorioPglite?: string;
  secreto: string;
  /** De donde salio el secreto, para avisar en el arranque sin imprimirlo. */
  origenSecreto: 'variable' | 'derivado_de_bd' | 'local';
  maxIntentos: number;
  bloqueoMs: number;
  /** Iteraciones que se anuncian a celulares no registrados y minimas que se aceptan al registrar. */
  iteracionesAuth: number;
  iteracionesMinimas: number;
  sesionMs: number;
  peticionesPorMinuto: number;
  maxBytesEvidencia: number;
  maxBytesJson: number;
  cuotaCuentaBytes: number;
  scrypt: ParametrosScrypt;
  /** Si la IP del cliente se toma de X-Forwarded-For (detras del proxy de Railway). */
  confiarProxy: boolean;
}

function entero(valor: string | undefined, predeterminado: number, minimo = 1): number {
  if (valor === undefined || valor.trim() === '') return predeterminado;
  const n = Number(valor);
  return Number.isInteger(n) && n >= minimo ? n : predeterminado;
}

/** Lee la configuracion de las variables de entorno. Nada de aqui se imprime en los logs. */
export function configuracionDesdeEntorno(env: Record<string, string | undefined> = process.env): ConfiguracionDatos {
  const urlBaseDatos = env.DATABASE_URL?.trim() || undefined;
  let secreto = env.SECRETO_SERVIDOR?.trim() ?? '';
  let origenSecreto: ConfiguracionDatos['origenSecreto'] = 'variable';
  if (secreto.length < 16) {
    if (urlBaseDatos) {
      // Respaldo estable si falta la variable en Railway: la URL de la base trae la contrasena de Postgres.
      secreto = createHash('sha256').update(`vozvial|secreto|${urlBaseDatos}`).digest('hex');
      origenSecreto = 'derivado_de_bd';
    } else {
      secreto = SECRETO_LOCAL;
      origenSecreto = 'local';
    }
  }
  return {
    urlBaseDatos,
    directorioPglite: env.PGLITE_DIR?.trim() || undefined,
    secreto,
    origenSecreto,
    maxIntentos: MAX_INTENTOS_POR_DEFECTO,
    bloqueoMs: entero(env.BLOQUEO_CUENTA_MS, BLOQUEO_MS_POR_DEFECTO),
    iteracionesAuth: entero(env.ITERACIONES_AUTENTICACION, ITERACIONES_PBKDF2_POR_DEFECTO),
    // El build de e2e usa 1000 iteraciones (EXPO_PUBLIC_PBKDF2_ITERACIONES), por eso el minimo es bajo.
    iteracionesMinimas: entero(env.ITERACIONES_MINIMAS, 1000),
    sesionMs: entero(env.SESION_HORAS, 24 * 7) * 60 * 60 * 1000,
    peticionesPorMinuto: entero(env.LIMITE_PETICIONES_MINUTO, 30),
    maxBytesEvidencia: entero(env.MAX_BYTES_EVIDENCIA, 8 * MB),
    maxBytesJson: 1 * MB,
    cuotaCuentaBytes: entero(env.CUOTA_CUENTA_BYTES, 100 * MB),
    confiarProxy: env.CONFIAR_PROXY ? env.CONFIAR_PROXY === '1' : Boolean(env.RAILWAY_ENVIRONMENT),
    scrypt: { ...SCRYPT_PREDETERMINADO, N: potenciaDeDos(entero(env.SCRYPT_N, SCRYPT_PREDETERMINADO.N, 1024)) },
  };
}

// scrypt exige que N sea potencia de 2.
function potenciaDeDos(n: number): number {
  return (n & (n - 1)) === 0 ? n : SCRYPT_PREDETERMINADO.N;
}
