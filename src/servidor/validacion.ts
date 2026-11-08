import { CodificacionBase64 } from '../core/CodificacionBase64';
import type { ClaveEnvuelta, DatosCifrados } from '../core/GestorClaves';
import { ValidadorRegistro } from '../core/ValidadorRegistro';

/** Error de validacion de una peticion: se responde 400 con el codigo, sin repetir lo que llego. */
export class ErrorValidacion extends Error {
  constructor(readonly campo: string) {
    super(`Campo invalido: ${campo}`);
    this.name = 'ErrorValidacion';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const MAX_ITERACIONES = 10_000_000;

function bytesBase64(valor: unknown, campo: string, largo?: { exacto?: number; maximo?: number }): string {
  if (typeof valor !== 'string' || valor.length === 0) throw new ErrorValidacion(campo);
  let bytes: Uint8Array;
  try {
    bytes = CodificacionBase64.decodificar(valor);
  } catch {
    throw new ErrorValidacion(campo);
  }
  if (largo?.exacto !== undefined && bytes.length !== largo.exacto) throw new ErrorValidacion(campo);
  if (largo?.maximo !== undefined && bytes.length > largo.maximo) throw new ErrorValidacion(campo);
  return valor;
}

export function objeto(valor: unknown, campo = 'cuerpo'): Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) throw new ErrorValidacion(campo);
  return valor as Record<string, unknown>;
}

/** Celular colombiano de 10 digitos que empieza por 3, igual que en el registro (CA-01.3). */
export function celular(valor: unknown): string {
  if (typeof valor !== 'string') throw new ErrorValidacion('celular');
  const limpio = ValidadorRegistro.normalizarCelular(valor);
  if (!/^3\d{9}$/.test(limpio)) throw new ErrorValidacion('celular');
  return limpio;
}

/** Verificador PBKDF2 del cliente: 32 bytes en base64. */
export function verificador(valor: unknown, campo: string): string {
  return bytesBase64(valor, campo, { exacto: 32 });
}

export function salAuth(valor: unknown): string {
  return bytesBase64(valor, 'salAuth', { exacto: 16 });
}

export function iteraciones(valor: unknown, minimo: number): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < minimo || valor > MAX_ITERACIONES) {
    throw new ErrorValidacion('iteraciones');
  }
  return valor;
}

export function claveEnvuelta(valor: unknown, campo: string): ClaveEnvuelta {
  const v = objeto(valor, campo);
  if (typeof v.iteraciones !== 'number' || !Number.isInteger(v.iteraciones) || v.iteraciones < 1 || v.iteraciones > MAX_ITERACIONES) {
    throw new ErrorValidacion(campo);
  }
  return {
    iv: bytesBase64(v.iv, campo, { exacto: 12 }),
    sal: bytesBase64(v.sal, campo, { exacto: 16 }),
    iteraciones: v.iteraciones,
    // Clave AES-256 envuelta con AES-GCM: 32 bytes mas 16 de etiqueta.
    datos: bytesBase64(v.datos, campo, { maximo: 128 }),
  };
}

export function datosCifrados(valor: unknown, campo: string, maximoBytes: number): DatosCifrados {
  const v = objeto(valor, campo);
  return { iv: bytesBase64(v.iv, campo, { exacto: 12 }), datos: bytesBase64(v.datos, campo, { maximo: maximoBytes }) };
}

export function ivBase64(valor: unknown, campo = 'iv'): string {
  return bytesBase64(valor, campo, { exacto: 12 });
}

/** Ids que genera la app: UUID o 32 hexadecimales. Se acepta un alfabeto corto y seguro. */
export function id(valor: unknown, campo = 'id'): string {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(valor)) throw new ErrorValidacion(campo);
  return valor;
}

/** Instante ISO con zona. Si viene del futuro (reloj del celular adelantado) se recorta a ahora. */
export function instante(valor: unknown, ahora: Date, campo = 'actualizadoEn'): string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/.test(valor)) {
    throw new ErrorValidacion(campo);
  }
  const ms = Date.parse(valor);
  if (Number.isNaN(ms)) throw new ErrorValidacion(campo);
  return new Date(Math.min(ms, ahora.getTime())).toISOString();
}

/** Tipos de archivo que la app guarda como evidencia (audio o foto). */
export function mime(valor: unknown): string {
  if (typeof valor !== 'string') throw new ErrorValidacion('mime');
  const limpio = valor.trim().toLowerCase();
  if (!/^(audio|image)\/[a-z0-9.+-]{1,40}(;[a-z0-9=.+ -]{0,60})?$/.test(limpio)) throw new ErrorValidacion('mime');
  return limpio;
}
