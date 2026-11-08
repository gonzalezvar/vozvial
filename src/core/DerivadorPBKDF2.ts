/** Iteraciones por defecto: recomendacion de OWASP (2023) para PBKDF2-HMAC-SHA256. */
export const ITERACIONES_PBKDF2_POR_DEFECTO = 600_000;

export const LARGO_SAL_BYTES = 16;

/**
 * Deriva bits o claves a partir de un secreto de texto con PBKDF2-HMAC-SHA256.
 * Lo comparten ServicioCredenciales (hash del PIN) y GestorClaves (clave de envoltura).
 */
export class DerivadorPBKDF2 {
  private readonly codificador = new TextEncoder();

  constructor(private readonly crypto: Crypto) {}

  static validarIteraciones(iteraciones: number): number {
    if (!Number.isInteger(iteraciones) || iteraciones < 1) {
      throw new RangeError('Las iteraciones de PBKDF2 deben ser un entero mayor que 0');
    }
    return iteraciones;
  }

  generarSal(): Uint8Array<ArrayBuffer> {
    return this.crypto.getRandomValues(new Uint8Array(LARGO_SAL_BYTES));
  }

  async derivarBits(
    secreto: string,
    sal: Uint8Array<ArrayBuffer>,
    iteraciones: number,
    bits = 256,
  ): Promise<Uint8Array<ArrayBuffer>> {
    const material = await this.importarSecreto(secreto);
    const resultado = await this.crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones },
      material,
      bits,
    );
    return new Uint8Array(resultado);
  }

  async derivarClaveAES(
    secreto: string,
    sal: Uint8Array<ArrayBuffer>,
    iteraciones: number,
    usos: KeyUsage[],
  ): Promise<CryptoKey> {
    const material = await this.importarSecreto(secreto);
    return this.crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      usos,
    );
  }

  private importarSecreto(secreto: string): Promise<CryptoKey> {
    // NFC para que el mismo texto escrito con distinta composicion derive lo mismo.
    const bytes = this.codificador.encode(secreto.normalize('NFC'));
    return this.crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveBits', 'deriveKey']);
  }
}
