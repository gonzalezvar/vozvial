const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const INDICE: Record<string, number> = {};
for (let i = 0; i < ALFABETO.length; i++) {
  INDICE[ALFABETO.charAt(i)] = i;
}

/**
 * Base64 estandar (RFC 4648, con relleno "="). Se implementa a mano para no
 * depender de btoa/atob ni de Buffer, que no existen igual en web, Node y Hermes.
 */
export class CodificacionBase64 {
  static codificar(bytes: Uint8Array): string {
    let salida = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i] ?? 0;
      const b1 = bytes[i + 1] ?? 0;
      const b2 = bytes[i + 2] ?? 0;
      const grupo = (b0 << 16) | (b1 << 8) | b2;
      salida += ALFABETO.charAt((grupo >> 18) & 63);
      salida += ALFABETO.charAt((grupo >> 12) & 63);
      salida += i + 1 < bytes.length ? ALFABETO.charAt((grupo >> 6) & 63) : '=';
      salida += i + 2 < bytes.length ? ALFABETO.charAt(grupo & 63) : '=';
    }
    return salida;
  }

  /** Lanza TypeError si el texto no es base64 valido. */
  static decodificar(texto: string): Uint8Array<ArrayBuffer> {
    const limpio = texto.replace(/\s+/g, '');
    if (limpio.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(limpio)) {
      throw new TypeError('Texto base64 invalido');
    }
    const relleno = limpio.endsWith('==') ? 2 : limpio.endsWith('=') ? 1 : 0;
    const largo = (limpio.length / 4) * 3 - relleno;
    const bytes = new Uint8Array(largo);
    let j = 0;
    for (let i = 0; i < limpio.length; i += 4) {
      const c0 = INDICE[limpio.charAt(i)] ?? 0;
      const c1 = INDICE[limpio.charAt(i + 1)] ?? 0;
      const c2 = INDICE[limpio.charAt(i + 2)] ?? 0;
      const c3 = INDICE[limpio.charAt(i + 3)] ?? 0;
      const grupo = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
      if (j < largo) bytes[j++] = (grupo >> 16) & 255;
      if (j < largo) bytes[j++] = (grupo >> 8) & 255;
      if (j < largo) bytes[j++] = grupo & 255;
    }
    return bytes;
  }
}
