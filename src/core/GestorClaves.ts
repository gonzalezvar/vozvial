import { CodificacionBase64 } from './CodificacionBase64';
import {
  DerivadorPBKDF2,
  ITERACIONES_PBKDF2_POR_DEFECTO,
  LARGO_SAL_BYTES,
} from './DerivadorPBKDF2';
import { ErrorClave } from './ErrorClave';

/** Clave de datos cifrada con una clave derivada de un secreto (PIN o codigo). Todo en base64. */
export interface ClaveEnvuelta {
  iv: string;
  sal: string;
  iteraciones: number;
  datos: string;
}

export interface DatosCifrados {
  iv: string;
  datos: string;
}

export interface OpcionesGestorClaves {
  iteraciones?: number;
}

const LARGO_IV_BYTES = 12;
const USOS_DATOS: KeyUsage[] = ['encrypt', 'decrypt'];

/**
 * Esquema de clave envuelta (riesgo R7 del plan de construccion): una clave de datos AES-GCM 256
 * aleatoria cifra casos y evidencias, y se guarda envuelta dos veces, con el PIN y con el
 * codigo de recuperacion. Asi, al olvidar el PIN, el codigo recupera la misma clave.
 *
 * WebCrypto exige que la clave de datos sea extraible para poder envolverla con wrapKey;
 * este gestor solo la exporta de esa forma, ya cifrada, nunca en crudo.
 */
export class GestorClaves {
  private readonly derivador: DerivadorPBKDF2;
  readonly iteraciones: number;

  constructor(
    private readonly crypto: Crypto,
    opciones: OpcionesGestorClaves = {},
  ) {
    this.derivador = new DerivadorPBKDF2(crypto);
    this.iteraciones = DerivadorPBKDF2.validarIteraciones(
      opciones.iteraciones ?? ITERACIONES_PBKDF2_POR_DEFECTO,
    );
  }

  generarClaveDatos(): Promise<CryptoKey> {
    return this.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, USOS_DATOS);
  }

  /** Si no se pasa sal se genera una nueva de 16 bytes. */
  async envolver(
    claveDatos: CryptoKey,
    secreto: string,
    sal?: Uint8Array<ArrayBuffer>,
  ): Promise<ClaveEnvuelta> {
    if (sal !== undefined && sal.length !== LARGO_SAL_BYTES) {
      throw new RangeError(`La sal debe tener ${LARGO_SAL_BYTES} bytes`);
    }
    const salUsada = sal ?? this.derivador.generarSal();
    const iv = this.crypto.getRandomValues(new Uint8Array(LARGO_IV_BYTES));
    const claveEnvoltura = await this.derivador.derivarClaveAES(
      secreto,
      salUsada,
      this.iteraciones,
      ['wrapKey', 'unwrapKey'],
    );
    const envuelta = await this.crypto.subtle.wrapKey('raw', claveDatos, claveEnvoltura, {
      name: 'AES-GCM',
      iv,
    });
    return {
      iv: CodificacionBase64.codificar(iv),
      sal: CodificacionBase64.codificar(salUsada),
      iteraciones: this.iteraciones,
      datos: CodificacionBase64.codificar(new Uint8Array(envuelta)),
    };
  }

  /** Lanza ErrorClave('secreto_incorrecto') si el secreto no corresponde a esta envoltura. */
  async desenvolver(envuelta: ClaveEnvuelta, secreto: string): Promise<CryptoKey> {
    const { iv, sal, datos } = this.decodificarEnvuelta(envuelta);
    const claveEnvoltura = await this.derivador.derivarClaveAES(
      secreto,
      sal,
      envuelta.iteraciones,
      ['wrapKey', 'unwrapKey'],
    );
    try {
      // Sigue siendo extraible para poder envolverla de nuevo al cambiar el PIN.
      return await this.crypto.subtle.unwrapKey(
        'raw',
        datos,
        claveEnvoltura,
        { name: 'AES-GCM', iv },
        { name: 'AES-GCM', length: 256 },
        true,
        USOS_DATOS,
      );
    } catch (causa) {
      throw new ErrorClave('secreto_incorrecto', 'El secreto no corresponde a esta clave', {
        cause: causa,
      });
    }
  }

  /**
   * Cambio de PIN o recuperacion (CA-03.1): abre la envoltura con el secreto actual
   * (PIN viejo o codigo) y devuelve una envoltura nueva con el secreto nuevo.
   * La clave de datos no cambia, asi que los casos guardados siguen descifrables.
   */
  async reenvolver(
    envuelta: ClaveEnvuelta,
    secretoActual: string,
    secretoNuevo: string,
  ): Promise<ClaveEnvuelta> {
    const claveDatos = await this.desenvolver(envuelta, secretoActual);
    return this.envolver(claveDatos, secretoNuevo);
  }

  async cifrar(clave: CryptoKey, contenido: Uint8Array<ArrayBuffer> | string): Promise<DatosCifrados> {
    const bytes = typeof contenido === 'string' ? new TextEncoder().encode(contenido) : contenido;
    const iv = this.crypto.getRandomValues(new Uint8Array(LARGO_IV_BYTES));
    const cifrado = await this.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, bytes);
    return {
      iv: CodificacionBase64.codificar(iv),
      datos: CodificacionBase64.codificar(new Uint8Array(cifrado)),
    };
  }

  /** Lanza ErrorClave('descifrado_fallido') si la clave no es la correcta o los datos se alteraron. */
  async descifrar(clave: CryptoKey, cifrado: DatosCifrados): Promise<Uint8Array<ArrayBuffer>> {
    let iv: Uint8Array<ArrayBuffer>;
    let datos: Uint8Array<ArrayBuffer>;
    try {
      iv = CodificacionBase64.decodificar(cifrado.iv);
      datos = CodificacionBase64.decodificar(cifrado.datos);
    } catch (causa) {
      throw new ErrorClave('datos_invalidos', 'Los datos cifrados estan dañados', { cause: causa });
    }
    if (iv.length !== LARGO_IV_BYTES) {
      throw new ErrorClave('datos_invalidos', 'El vector de inicio no tiene 12 bytes');
    }
    try {
      const claro = await this.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, clave, datos);
      return new Uint8Array(claro);
    } catch (causa) {
      throw new ErrorClave('descifrado_fallido', 'No se pudieron descifrar los datos', {
        cause: causa,
      });
    }
  }

  async descifrarTexto(clave: CryptoKey, cifrado: DatosCifrados): Promise<string> {
    const bytes = await this.descifrar(clave, cifrado);
    return new TextDecoder().decode(bytes);
  }

  private decodificarEnvuelta(envuelta: ClaveEnvuelta): {
    iv: Uint8Array<ArrayBuffer>;
    sal: Uint8Array<ArrayBuffer>;
    datos: Uint8Array<ArrayBuffer>;
  } {
    if (
      typeof envuelta !== 'object' ||
      envuelta === null ||
      typeof envuelta.iteraciones !== 'number' ||
      !Number.isInteger(envuelta.iteraciones) ||
      envuelta.iteraciones < 1
    ) {
      throw new ErrorClave('datos_invalidos', 'La clave envuelta no tiene un formato valido');
    }
    try {
      const iv = CodificacionBase64.decodificar(envuelta.iv);
      const sal = CodificacionBase64.decodificar(envuelta.sal);
      const datos = CodificacionBase64.decodificar(envuelta.datos);
      if (iv.length !== LARGO_IV_BYTES || sal.length !== LARGO_SAL_BYTES || datos.length === 0) {
        throw new TypeError('Largos inesperados en la clave envuelta');
      }
      return { iv, sal, datos };
    } catch (causa) {
      throw new ErrorClave('datos_invalidos', 'La clave envuelta no tiene un formato valido', {
        cause: causa,
      });
    }
  }
}
