import { CodificacionBase64 } from './CodificacionBase64';
import { CodigoRecuperacion } from './CodigoRecuperacion';
import { DerivadorPBKDF2, ITERACIONES_PBKDF2_POR_DEFECTO, LARGO_SAL_BYTES } from './DerivadorPBKDF2';

/**
 * Prefijos de separacion de dominio. Aunque la sal de autenticacion coincidiera con la sal
 * de envoltura de GestorClaves, el verificador nunca sale igual a la clave que abre los datos.
 */
const DOMINIO_PIN = 'vozvial/autenticacion/pin/v1|';
const DOMINIO_CODIGO = 'vozvial/autenticacion/codigo/v1|';
const BITS_VERIFICADOR = 256;

/** Parametros publicos que el servidor devuelve para un celular (GET /api/cuentas/parametros). */
export interface ParametrosAutenticacion {
  /** Sal de autenticacion en base64 (16 bytes). */
  salAuth: string;
  iteraciones: number;
}

/**
 * Deriva el verificador de autenticacion que viaja al servidor: PBKDF2-SHA256(prefijo + secreto, sal_auth).
 * Es distinto de la clave que envuelve la clave de datos (GestorClaves usa otra sal y sin prefijo),
 * asi que conocer el verificador no permite abrir casos ni evidencias. El PIN nunca sale del dispositivo.
 */
export class DerivadorVerificador {
  private readonly derivador: DerivadorPBKDF2;

  constructor(crypto: Crypto) {
    this.derivador = new DerivadorPBKDF2(crypto);
  }

  /** Sal nueva para registrar una cuenta, en base64. */
  generarSal(): string {
    return CodificacionBase64.codificar(this.derivador.generarSal());
  }

  /** Parametros para una cuenta nueva: sal aleatoria y las iteraciones indicadas. */
  nuevosParametros(iteraciones = ITERACIONES_PBKDF2_POR_DEFECTO): ParametrosAutenticacion {
    return { salAuth: this.generarSal(), iteraciones: DerivadorPBKDF2.validarIteraciones(iteraciones) };
  }

  /** Verificador del PIN en base64 (32 bytes). */
  verificadorPin(pin: string, parametros: ParametrosAutenticacion): Promise<string> {
    return this.derivar(DOMINIO_PIN + pin, parametros);
  }

  /** Verificador del codigo de recuperacion. Normaliza el codigo: "abcd-efgh-jkmn" y "ABCDEFGHJKMN" dan lo mismo. */
  verificadorCodigo(codigo: string, parametros: ParametrosAutenticacion): Promise<string> {
    return this.derivar(DOMINIO_CODIGO + CodigoRecuperacion.normalizar(codigo), parametros);
  }

  static esParametros(valor: unknown): valor is ParametrosAutenticacion {
    if (typeof valor !== 'object' || valor === null) return false;
    const v = valor as Record<string, unknown>;
    if (typeof v.salAuth !== 'string' || typeof v.iteraciones !== 'number') return false;
    if (!Number.isInteger(v.iteraciones) || v.iteraciones < 1) return false;
    try {
      return CodificacionBase64.decodificar(v.salAuth).length === LARGO_SAL_BYTES;
    } catch {
      return false;
    }
  }

  private async derivar(secreto: string, parametros: ParametrosAutenticacion): Promise<string> {
    if (!DerivadorVerificador.esParametros(parametros)) {
      throw new RangeError('Los parametros de autenticacion no son validos');
    }
    const sal = CodificacionBase64.decodificar(parametros.salAuth);
    const bits = await this.derivador.derivarBits(secreto, sal, parametros.iteraciones, BITS_VERIFICADOR);
    return CodificacionBase64.codificar(bits);
  }
}
