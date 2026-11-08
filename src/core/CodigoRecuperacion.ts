/**
 * Codigo de recuperacion de HU-03. Alfabeto de 31 simbolos sin los que se confunden
 * al leer o dictar (0/O, 1/I/L). 12 simbolos dan unos 59 bits de azar.
 */
export class CodigoRecuperacion {
  static readonly ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  static readonly LONGITUD = 12;

  static generar(crypto: Crypto): string {
    const alfabeto = CodigoRecuperacion.ALFABETO;
    // Rechazo de muestras para que todos los simbolos tengan la misma probabilidad.
    const limite = 256 - (256 % alfabeto.length);
    let codigo = '';
    while (codigo.length < CodigoRecuperacion.LONGITUD) {
      const bytes = crypto.getRandomValues(new Uint8Array(CodigoRecuperacion.LONGITUD * 2));
      for (const byte of bytes) {
        if (byte >= limite) continue;
        codigo += alfabeto.charAt(byte % alfabeto.length);
        if (codigo.length === CodigoRecuperacion.LONGITUD) break;
      }
    }
    return codigo;
  }

  /** Mayusculas y sin espacios, guiones ni puntos: "abcd-efgh jkmn" -> "ABCDEFGHJKMN". */
  static normalizar(texto: string): string {
    return texto.toUpperCase().replace(/[\s\-._]+/g, '');
  }

  static esValido(texto: string): boolean {
    const codigo = CodigoRecuperacion.normalizar(texto);
    if (codigo.length !== CodigoRecuperacion.LONGITUD) return false;
    for (const simbolo of codigo) {
      if (!CodigoRecuperacion.ALFABETO.includes(simbolo)) return false;
    }
    return true;
  }

  /** Grupos de 4 para mostrarlo o leerlo en voz alta: "ABCD-EFGH-JKMN". */
  static formatear(texto: string): string {
    const codigo = CodigoRecuperacion.normalizar(texto);
    return codigo.match(/.{1,4}/g)?.join('-') ?? '';
  }
}
