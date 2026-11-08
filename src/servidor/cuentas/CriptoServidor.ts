import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';

function scrypt(secreto: Buffer, sal: Buffer, largo: number, opciones: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(secreto, sal, largo, opciones, (error, clave) => (error ? reject(error) : resolve(clave)));
  });
}

export interface ParametrosScrypt {
  N: number;
  r: number;
  p: number;
}

/** OWASP (2023) recomienda N = 2^17; 2^15 da ~50 ms en un servidor pequeno y cabe en 32 MB de memoria. */
export const SCRYPT_PREDETERMINADO: ParametrosScrypt = { N: 2 ** 15, r: 8, p: 1 };
const LARGO_HASH = 32;
const LARGO_SAL_SERVIDOR = 16;
const LARGO_TOKEN = 32;

/**
 * Criptografia del lado del servidor. El cliente ya manda un verificador PBKDF2 (nunca el PIN);
 * aqui se le aplica scrypt con una sal propia del servidor, para que una copia de la tabla
 * no sirva para entrar mandando el valor guardado.
 */
export class CriptoServidor {
  private readonly secreto: Buffer;

  constructor(
    secreto: string,
    private readonly scryptParams: ParametrosScrypt = SCRYPT_PREDETERMINADO,
  ) {
    if (secreto.length < 16) throw new RangeError('El secreto del servidor debe tener al menos 16 caracteres');
    this.secreto = Buffer.from(secreto, 'utf8');
  }

  /** Formato guardado: "scrypt$N$r$p$sal$hash" (sal y hash en base64). */
  async protegerVerificador(verificador: string): Promise<string> {
    const sal = randomBytes(LARGO_SAL_SERVIDOR);
    const { N, r, p } = this.scryptParams;
    const hash = await this.hashear(verificador, sal, this.scryptParams);
    return ['scrypt', N, r, p, sal.toString('base64'), hash.toString('base64')].join('$');
  }

  /** Compara en tiempo constante. Un valor guardado mal formado devuelve false. */
  async comprobarVerificador(verificador: string, guardado: string): Promise<boolean> {
    const partes = guardado.split('$');
    if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
    const [N, r, p] = partes.slice(1, 4).map(Number);
    if (!N || !r || !p) return false;
    const sal = Buffer.from(partes[4] ?? '', 'base64');
    const esperado = Buffer.from(partes[5] ?? '', 'base64');
    if (sal.length !== LARGO_SAL_SERVIDOR || esperado.length !== LARGO_HASH) return false;
    const calculado = await this.hashear(verificador, sal, { N, r, p });
    return timingSafeEqual(calculado, esperado);
  }

  /** Mismo costo que comprobar, para que un celular inexistente tarde lo mismo en responder. */
  async trabajoFicticio(verificador: string): Promise<void> {
    await this.hashear(verificador, randomBytes(LARGO_SAL_SERVIDOR), this.scryptParams);
  }

  /**
   * Sal falsa pero estable para celulares que no estan registrados: HMAC del celular con el
   * secreto del servidor. Asi GET /api/cuentas/parametros no revela quien tiene cuenta.
   */
  salFalsa(celular: string): string {
    return createHmac('sha256', this.secreto).update(`sal_auth|${celular}`).digest().subarray(0, 16).toString('base64');
  }

  /** Clave interna para contar intentos de celulares inexistentes sin guardar el numero en claro. */
  huellaCelular(celular: string): string {
    return createHmac('sha256', this.secreto).update(`intentos|${celular}`).digest('hex');
  }

  static nuevoToken(): string {
    return randomBytes(LARGO_TOKEN).toString('base64url');
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private hashear(verificador: string, sal: Buffer, { N, r, p }: ParametrosScrypt): Promise<Buffer> {
    // maxmem holgado: scrypt necesita 128 * N * r bytes.
    return scrypt(Buffer.from(verificador, 'utf8'), sal, LARGO_HASH, { N, r, p, maxmem: 256 * N * r });
  }
}
