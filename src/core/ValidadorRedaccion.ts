import type { EntradaNormativa } from './BaseNormativa';

/**
 * Revisa el texto que redacta una IA (modo Claude) antes de mostrarlo.
 *
 * Que las citas existan no basta: el texto podría decir un plazo, un valor o
 * una promesa que los artículos citados no sustentan. Esta revisión es
 * determinista y conservadora: ante la duda rechaza, y el proveedor se abstiene.
 *
 * Reglas:
 * - Frases prohibidas por el proyecto ("garantizado", "seguro que ganas"...).
 * - Nada de enlaces, correos ni teléfonos.
 * - Toda cifra del texto (en dígitos o en palabras, de "dos" a "cien") debe
 *   aparecer en alguna de las entradas citadas: texto literal, resumen
 *   sencillo, norma, artículo o título.
 *
 * Límite conocido: no entiende cifras compuestas en palabras ("treinta y
 * cinco" se revisa como 30 y 5 por separado) ni comprueba el sentido de la
 * frase; solo que las cifras salgan de la norma citada.
 */
export type MotivoRedaccion = 'frase_prohibida' | 'contacto' | 'cifra_sin_sustento';

export type ResultadoRedaccion = { valida: true } | { valida: false; motivo: MotivoRedaccion };

const FRASES_PROHIBIDAS: readonly RegExp[] = [
  /\bgarantizad[oa]s?\b/,
  /\bte (lo )?garantizo\b/,
  /\bseguro que (vas a )?gan/,
  /\bvas a ganar\b/,
  /\bganaras\b/,
  /\bte (lo )?aseguro\b/,
];

const CONTACTO: readonly RegExp[] = [
  /\bhttps?:\/\//,
  /\bwww\./,
  /\b[a-z0-9-]+\.(com|co|org|net|gov|edu|io)\b/,
  /[^\s@]+@[^\s@]+\.[^\s@]+/,
  /\+\s?\d{1,3}[\s-]?\d{3}/,
  /\b\d{3}[\s-]\d{3}[\s-]?\d{4}\b/,
];

// "un", "uno" y "una" se dejan por fuera: son artículos en casi todas las frases.
const NUMEROS_EN_PALABRAS: Readonly<Record<string, number>> = {
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21,
  veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40,
  cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100,
};

export class ValidadorRedaccion {
  validar(texto: string, citadas: readonly EntradaNormativa[]): ResultadoRedaccion {
    const normal = ValidadorRedaccion.normalizar(texto);
    if (FRASES_PROHIBIDAS.some((r) => r.test(normal))) return { valida: false, motivo: 'frase_prohibida' };
    if (CONTACTO.some((r) => r.test(normal))) return { valida: false, motivo: 'contacto' };

    const permitidas = new Set<string>();
    for (const e of citadas) {
      for (const fuente of [e.textoLiteral, e.resumenSencillo, e.norma, e.articulo, e.titulo]) {
        for (const c of ValidadorRedaccion.cifras(fuente)) permitidas.add(c);
      }
    }
    const sinSustento = ValidadorRedaccion.cifras(texto).some((c) => !permitidas.has(c));
    return sinSustento ? { valida: false, motivo: 'cifra_sin_sustento' } : { valida: true };
  }

  /** Cifras de un texto como cadenas de dígitos canónicas: "10.000" y "$10.000.00" dan "10000"; "cinco" da "5". */
  static cifras(texto: string): string[] {
    const normal = ValidadorRedaccion.normalizar(texto);
    const salida: string[] = [];
    for (const token of normal.match(/\d+(?:[.,]\d+)*/g) ?? []) {
      // Los centavos ",00" o ".00" al final no cambian el valor.
      const sinCentavos = /[.,]\d+[.,]00$|^\d+[.,]00$/.test(token) ? token.slice(0, -3) : token;
      const digitos = sinCentavos.replace(/[.,]/g, '').replace(/^0+(?=\d)/, '');
      salida.push(digitos);
    }
    for (const palabra of normal.split(/[^a-z]+/)) {
      const valor = NUMEROS_EN_PALABRAS[palabra];
      if (valor !== undefined) salida.push(String(valor));
    }
    return salida;
  }

  private static normalizar(texto: string): string {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
}
