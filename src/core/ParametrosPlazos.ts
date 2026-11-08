/**
 * Parámetros de los plazos (cuántos días hábiles y desde cuándo se cuentan).
 *
 * Salen de data/normativa/parametros.json y cada uno apunta a las entradas de
 * la base normativa que lo sustentan. La app no usa un parámetro que no esté
 * verificado: en ese caso desdeJSON lanza un error en vez de calcular con un
 * número sin fuente.
 */

export type TipoPlazo = 'via' | 'fotodeteccion';

export type PuntoPartida = 'dia_siguiente_evento' | 'dia_siguiente_notificacion';

/** Forma de cada parámetro en parametros.json. */
export interface ParametroJSON {
  id: string;
  valor: number;
  unidad: string;
  punto_partida?: string;
  descripcion: string;
  sustento: string[];
  verificado: boolean;
  notas?: string;
}

/** Forma de parametros.json. Solo se lee la lista de parámetros; unidad_multa la usa otra clase. */
export interface ParametrosJSON {
  parametros: ParametroJSON[];
  unidad_multa?: unknown;
}

export interface ParametroPlazo {
  id: string;
  tipo: TipoPlazo;
  diasHabiles: number;
  puntoPartida: PuntoPartida;
  descripcion: string;
  sustento: string[];
}

export class ErrorParametroPlazo extends Error {
  readonly idParametro: string;

  constructor(idParametro: string, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorParametroPlazo';
    this.idParametro = idParametro;
  }
}

/** El parámetro existe pero no está verificado contra la fuente oficial. */
export class ErrorParametroNoVerificado extends ErrorParametroPlazo {
  constructor(idParametro: string) {
    super(idParametro, `El parámetro "${idParametro}" no está verificado. No se puede calcular el plazo con él.`);
    this.name = 'ErrorParametroNoVerificado';
  }
}

const ID_POR_TIPO: Readonly<Record<TipoPlazo, string>> = {
  via: 'dias_habiles_via',
  fotodeteccion: 'dias_habiles_fotodeteccion',
};

const PUNTOS_PARTIDA: readonly PuntoPartida[] = ['dia_siguiente_evento', 'dia_siguiente_notificacion'];

function esPuntoPartida(valor: unknown): valor is PuntoPartida {
  return typeof valor === 'string' && (PUNTOS_PARTIDA as readonly string[]).includes(valor);
}

export class ParametrosPlazos {
  private readonly porTipo: Readonly<Record<TipoPlazo, ParametroPlazo>>;

  private constructor(porTipo: Record<TipoPlazo, ParametroPlazo>) {
    this.porTipo = Object.freeze({ ...porTipo });
  }

  static idDe(tipo: TipoPlazo): string {
    return ID_POR_TIPO[tipo];
  }

  /**
   * Lee los parámetros de vía y fotodetección. Lanza ErrorParametroNoVerificado
   * si alguno tiene verificado:false y ErrorParametroPlazo si falta o está mal formado.
   */
  static desdeJSON(json: ParametrosJSON): ParametrosPlazos {
    if (!json || !Array.isArray(json.parametros)) {
      throw new ErrorParametroPlazo('parametros', 'El JSON de parámetros no tiene la lista "parametros".');
    }
    const leer = (tipo: TipoPlazo): ParametroPlazo => {
      const id = ID_POR_TIPO[tipo];
      const crudo = json.parametros.find((p) => p.id === id);
      if (!crudo) {
        throw new ErrorParametroPlazo(id, `Falta el parámetro "${id}" en parametros.json.`);
      }
      if (crudo.verificado !== true) {
        throw new ErrorParametroNoVerificado(id);
      }
      if (!Number.isInteger(crudo.valor) || crudo.valor <= 0) {
        throw new ErrorParametroPlazo(id, `El parámetro "${id}" debe ser un entero positivo de días: ${String(crudo.valor)}`);
      }
      if (crudo.unidad !== 'dias_habiles') {
        throw new ErrorParametroPlazo(id, `El parámetro "${id}" debe estar en dias_habiles, no en ${String(crudo.unidad)}.`);
      }
      if (!esPuntoPartida(crudo.punto_partida)) {
        throw new ErrorParametroPlazo(id, `El parámetro "${id}" tiene un punto de partida desconocido: ${String(crudo.punto_partida)}`);
      }
      if (!Array.isArray(crudo.sustento) || crudo.sustento.length === 0) {
        throw new ErrorParametroPlazo(id, `El parámetro "${id}" no dice qué artículo lo sustenta.`);
      }
      return {
        id,
        tipo,
        diasHabiles: crudo.valor,
        puntoPartida: crudo.punto_partida,
        descripcion: crudo.descripcion,
        sustento: [...crudo.sustento],
      };
    };
    return new ParametrosPlazos({ via: leer('via'), fotodeteccion: leer('fotodeteccion') });
  }

  obtener(tipo: TipoPlazo): ParametroPlazo {
    const p = this.porTipo[tipo];
    return { ...p, sustento: [...p.sustento] };
  }
}
