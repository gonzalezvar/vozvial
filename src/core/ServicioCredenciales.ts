import { CodificacionBase64 } from './CodificacionBase64';
import {
  DerivadorPBKDF2,
  ITERACIONES_PBKDF2_POR_DEFECTO,
  LARGO_SAL_BYTES,
} from './DerivadorPBKDF2';

/** Lo unico que se guarda del PIN (CA-01.6): hash, sal e iteraciones. Nunca el PIN. */
export interface Credencial {
  algoritmo: 'PBKDF2-SHA256';
  hash: string;
  sal: string;
  iteraciones: number;
}

export interface OpcionesCredenciales {
  iteraciones?: number;
}

const BITS_HASH = 256;

export class ServicioCredenciales {
  private readonly derivador: DerivadorPBKDF2;
  readonly iteraciones: number;

  constructor(crypto: Crypto, opciones: OpcionesCredenciales = {}) {
    this.derivador = new DerivadorPBKDF2(crypto);
    this.iteraciones = DerivadorPBKDF2.validarIteraciones(
      opciones.iteraciones ?? ITERACIONES_PBKDF2_POR_DEFECTO,
    );
  }

  async crearCredencial(pin: string): Promise<Credencial> {
    const sal = this.derivador.generarSal();
    const hash = await this.derivador.derivarBits(pin, sal, this.iteraciones, BITS_HASH);
    return {
      algoritmo: 'PBKDF2-SHA256',
      hash: CodificacionBase64.codificar(hash),
      sal: CodificacionBase64.codificar(sal),
      iteraciones: this.iteraciones,
    };
  }

  /**
   * Usa la sal y las iteraciones guardadas en la credencial, no las del servicio,
   * para que una credencial vieja siga funcionando si cambia la configuracion.
   * Una credencial mal formada devuelve false en vez de lanzar.
   */
  async verificar(pin: string, credencial: Credencial): Promise<boolean> {
    if (!ServicioCredenciales.esCredencial(credencial)) return false;
    let sal: Uint8Array<ArrayBuffer>;
    let esperado: Uint8Array<ArrayBuffer>;
    try {
      sal = CodificacionBase64.decodificar(credencial.sal);
      esperado = CodificacionBase64.decodificar(credencial.hash);
    } catch {
      return false;
    }
    if (sal.length !== LARGO_SAL_BYTES || esperado.length !== BITS_HASH / 8) return false;
    const calculado = await this.derivador.derivarBits(
      pin,
      sal,
      credencial.iteraciones,
      BITS_HASH,
    );
    return ServicioCredenciales.igualesTiempoConstante(calculado, esperado);
  }

  static esCredencial(valor: unknown): valor is Credencial {
    if (typeof valor !== 'object' || valor === null) return false;
    const v = valor as Record<string, unknown>;
    return (
      v.algoritmo === 'PBKDF2-SHA256' &&
      typeof v.hash === 'string' &&
      typeof v.sal === 'string' &&
      typeof v.iteraciones === 'number' &&
      Number.isInteger(v.iteraciones) &&
      v.iteraciones > 0
    );
  }

  /** Recorre siempre todos los bytes para no filtrar por tiempo cuantos coinciden. */
  static igualesTiempoConstante(a: Uint8Array, b: Uint8Array): boolean {
    const largo = Math.max(a.length, b.length);
    let diferencia = a.length ^ b.length;
    for (let i = 0; i < largo; i++) {
      diferencia |= (a[i] ?? 0) ^ (b[i] ?? 0);
    }
    return diferencia === 0;
  }
}
