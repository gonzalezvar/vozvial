/**
 * Catálogo de códigos de infracción construido desde data/infracciones.json
 * (art. 131 de la Ley 769 de 2002). Solo expone entradas con verificado: true;
 * las demás se descartan al construir para que la app nunca las use.
 */

export interface SancionInfraccion {
  cantidad: number;
  unidad: string;
}

export interface ValorReferenciaInfraccion {
  pesos: number;
  vigencia: number;
  fuente: string;
}

export interface InfraccionJSON {
  codigo: string;
  literal: string;
  numeral: string;
  descripcion_literal: string;
  descripcion_sencilla: string;
  sancion: SancionInfraccion | null;
  otras_consecuencias: string;
  articulo_id: string;
  valor_referencia: ValorReferenciaInfraccion | null;
  verificado: boolean;
  notas: string;
}

export interface CatalogoInfraccionesJSON {
  articulo_id: string;
  fecha_consulta: string;
  infracciones: InfraccionJSON[];
}

/** Infracción verificada, con el código ya normalizado (por ejemplo "C02"). */
export interface Infraccion {
  readonly codigo: string;
  readonly literal: string;
  readonly numeral: string;
  readonly descripcionLiteral: string;
  readonly descripcionSencilla: string;
  readonly sancion: Readonly<SancionInfraccion> | null;
  readonly otrasConsecuencias: string;
  readonly articuloId: string;
  readonly valorReferencia: Readonly<ValorReferenciaInfraccion> | null;
  readonly notas: string;
}

export type ResultadoValidacionCodigo =
  | { valido: true; codigo: string; infraccion: Infraccion }
  | { valido: false; motivo: 'formato' | 'no_existe'; mensaje: string };

/** Mensaje literal del criterio CA-09.3. */
export const MENSAJE_CODIGO_NO_EXISTE = 'Ese código no aparece en el Código de Tránsito. Revísalo.';
export const MENSAJE_CODIGO_FORMATO = 'Revisa el código. Es una letra y dos números, por ejemplo C02.';

// Letra del literal (A-H), uno o dos dígitos del numeral y, opcionalmente, una
// letra de sufijo (el texto vigente tiene numerales como C.12A).
const PATRON_CODIGO = /^([A-H])([0-9O]{1,2})([A-Z])?$/;

export class CatalogoInfracciones {
  private readonly porCodigo: ReadonlyMap<string, Infraccion>;

  constructor(json: CatalogoInfraccionesJSON) {
    const mapa = new Map<string, Infraccion>();
    for (const entrada of json.infracciones) {
      if (entrada.verificado !== true) continue;
      const codigo = CatalogoInfracciones.normalizarCodigo(entrada.codigo);
      if (codigo === null || mapa.has(codigo)) continue;
      mapa.set(
        codigo,
        Object.freeze({
          codigo,
          literal: entrada.literal,
          numeral: entrada.numeral,
          descripcionLiteral: entrada.descripcion_literal,
          descripcionSencilla: entrada.descripcion_sencilla,
          sancion: entrada.sancion ? Object.freeze({ ...entrada.sancion }) : null,
          otrasConsecuencias: entrada.otras_consecuencias,
          articuloId: entrada.articulo_id,
          valorReferencia: entrada.valor_referencia ? Object.freeze({ ...entrada.valor_referencia }) : null,
          notas: entrada.notas,
        }),
      );
    }
    this.porCodigo = mapa;
  }

  /**
   * Lleva un código escrito o leído por OCR a la forma "C02".
   * Acepta "C.02", "C 02", "c-2", "c2", "C.12A" y confunde O con 0 en el
   * numeral ("CO2" -> "C02"). Devuelve null si no tiene forma de código.
   */
  static normalizarCodigo(texto: string): string | null {
    const compacto = texto.toUpperCase().replace(/[\s.\-_]/g, '');
    const partes = PATRON_CODIGO.exec(compacto);
    if (!partes) return null;
    const [, letra, numeralCrudo, sufijo] = partes;
    const numero = Number((numeralCrudo ?? '').replace(/O/g, '0'));
    if (!Number.isInteger(numero) || numero < 1) return null;
    return `${letra}${numero.toString().padStart(2, '0')}${sufijo ?? ''}`;
  }

  buscar(codigo: string): Infraccion | null {
    const normalizado = CatalogoInfracciones.normalizarCodigo(codigo);
    if (normalizado === null) return null;
    return this.porCodigo.get(normalizado) ?? null;
  }

  existe(codigo: string): boolean {
    return this.buscar(codigo) !== null;
  }

  todas(): Infraccion[] {
    return [...this.porCodigo.values()];
  }

  /** Validación para el formulario del comparendo (CA-09.3). */
  validarCodigo(codigo: string): ResultadoValidacionCodigo {
    const normalizado = CatalogoInfracciones.normalizarCodigo(codigo);
    if (normalizado === null) {
      return { valido: false, motivo: 'formato', mensaje: MENSAJE_CODIGO_FORMATO };
    }
    const infraccion = this.porCodigo.get(normalizado);
    if (!infraccion) {
      return { valido: false, motivo: 'no_existe', mensaje: MENSAJE_CODIGO_NO_EXISTE };
    }
    return { valido: true, codigo: normalizado, infraccion };
  }
}
