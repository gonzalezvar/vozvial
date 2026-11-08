import { CatalogoInfracciones } from './CatalogoInfracciones';
import { FechaCivil } from './FechaCivil';

export type TipoComparendo = 'via' | 'fotodeteccion';

export const TIPOS_COMPARENDO: readonly TipoComparendo[] = ['via', 'fotodeteccion'];

export type CampoComparendo =
  | 'numero'
  | 'fecha'
  | 'placa'
  | 'codigoInfraccion'
  | 'tipo'
  | 'fechaNotificacion'
  | 'organismo';

const CAMPOS_COMPARENDO: readonly CampoComparendo[] = [
  'numero',
  'fecha',
  'placa',
  'codigoInfraccion',
  'tipo',
  'fechaNotificacion',
  'organismo',
];

export class ErrorComparendo extends Error {
  constructor(
    readonly campo: CampoComparendo | 'camposConfirmados',
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorComparendo';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface DatosComparendo {
  numero: string;
  fecha: FechaCivil;
  /** Opcional: no todo comparendo trae placa legible. Si viene, debe tener formato colombiano. */
  placa?: string | null;
  codigoInfraccion: string;
  tipo: TipoComparendo;
  /** Fecha en que el conductor recibió la notificación. Obligatoria si es por fotodetección. */
  fechaNotificacion?: FechaCivil | null;
  organismo?: string | null;
  /** Campos que el conductor revisó y confirmó (por ejemplo, los que el OCR marcó como dudosos). */
  camposConfirmados?: readonly CampoComparendo[];
}

export interface ComparendoJSON {
  numero: string;
  fecha: string;
  placa: string | null;
  codigoInfraccion: string;
  tipo: TipoComparendo;
  fechaNotificacion: string | null;
  organismo: string | null;
  camposConfirmados: CampoComparendo[];
}

// Carros: AAA123. Motos: AAA12A.
const PATRON_PLACA = /^[A-Z]{3}(\d{3}|\d{2}[A-Z])$/;
const PATRON_NUMERO = /^\d{6,}$/;

/**
 * Comparendo de tránsito registrado por el conductor. Inmutable: los cambios
 * se hacen creando una instancia nueva con los datos actualizados.
 */
export class Comparendo {
  readonly numero: string;
  readonly fecha: FechaCivil;
  readonly placa: string | null;
  readonly codigoInfraccion: string;
  readonly tipo: TipoComparendo;
  readonly fechaNotificacion: FechaCivil | null;
  readonly organismo: string | null;
  readonly camposConfirmados: readonly CampoComparendo[];

  private constructor(datos: {
    numero: string;
    fecha: FechaCivil;
    placa: string | null;
    codigoInfraccion: string;
    tipo: TipoComparendo;
    fechaNotificacion: FechaCivil | null;
    organismo: string | null;
    camposConfirmados: readonly CampoComparendo[];
  }) {
    this.numero = datos.numero;
    this.fecha = datos.fecha;
    this.placa = datos.placa;
    this.codigoInfraccion = datos.codigoInfraccion;
    this.tipo = datos.tipo;
    this.fechaNotificacion = datos.fechaNotificacion;
    this.organismo = datos.organismo;
    this.camposConfirmados = Object.freeze([...datos.camposConfirmados]);
    Object.freeze(this);
  }

  /** Normaliza y valida los datos. Lanza ErrorComparendo con el campo que falló. */
  static crear(datos: DatosComparendo): Comparendo {
    const numero = Comparendo.normalizarNumero(datos.numero ?? '');
    if (numero === '') {
      throw new ErrorComparendo('numero', 'Falta el número del comparendo.');
    }
    if (!PATRON_NUMERO.test(numero)) {
      throw new ErrorComparendo('numero', 'El número del comparendo debe tener solo números, al menos 6.');
    }

    if (!(datos.fecha instanceof FechaCivil)) {
      throw new ErrorComparendo('fecha', 'Falta la fecha del comparendo.');
    }

    let placa: string | null = null;
    if (datos.placa != null && datos.placa.trim() !== '') {
      placa = Comparendo.normalizarPlaca(datos.placa);
      if (!Comparendo.esPlacaValida(placa)) {
        throw new ErrorComparendo('placa', 'Revisa la placa. Debe ser como ABC123, o ABC12D si es moto.');
      }
    }

    if ((datos.codigoInfraccion ?? '').trim() === '') {
      throw new ErrorComparendo('codigoInfraccion', 'Falta el código de la infracción.');
    }
    const codigo = CatalogoInfracciones.normalizarCodigo(datos.codigoInfraccion);
    if (codigo === null) {
      throw new ErrorComparendo('codigoInfraccion', 'Revisa el código. Es una letra y dos números, por ejemplo C02.');
    }

    if (!TIPOS_COMPARENDO.includes(datos.tipo)) {
      throw new ErrorComparendo('tipo', 'Indica si el comparendo fue en la vía o por fotodetección.');
    }

    let fechaNotificacion: FechaCivil | null = null;
    if (datos.tipo === 'fotodeteccion') {
      if (!(datos.fechaNotificacion instanceof FechaCivil)) {
        throw new ErrorComparendo('fechaNotificacion', 'Falta la fecha en que recibiste la notificación.');
      }
      if (datos.fechaNotificacion.esAnterior(datos.fecha)) {
        throw new ErrorComparendo(
          'fechaNotificacion',
          'La fecha en que recibiste la notificación no puede ser anterior a la fecha de la infracción.',
        );
      }
      fechaNotificacion = datos.fechaNotificacion;
    }

    const organismo = datos.organismo?.trim() ? datos.organismo.trim() : null;

    const confirmados = datos.camposConfirmados ?? [];
    for (const campo of confirmados) {
      if (!CAMPOS_COMPARENDO.includes(campo)) {
        throw new ErrorComparendo('camposConfirmados', `Campo desconocido: ${String(campo)}`);
      }
    }

    return new Comparendo({
      numero,
      fecha: datos.fecha,
      placa,
      codigoInfraccion: codigo,
      tipo: datos.tipo,
      fechaNotificacion,
      organismo,
      camposConfirmados: [...new Set(confirmados)],
    });
  }

  /** Quita espacios y guiones que el conductor o el OCR ponen entre grupos de dígitos. */
  static normalizarNumero(texto: string): string {
    return texto.replace(/[\s\-.]/g, '');
  }

  static normalizarPlaca(texto: string): string {
    return texto.toUpperCase().replace(/[\s\-.]/g, '');
  }

  static esPlacaValida(placa: string): boolean {
    return PATRON_PLACA.test(placa);
  }

  /**
   * Fecha desde la que se cuenta el plazo: la de la infracción si fue en la
   * vía, la de la notificación si fue por fotodetección. El número de días y
   * su punto de partida los decide CalculadoraPlazos con los parámetros
   * verificados; aquí solo se elige cuál fecha del comparendo aplica.
   */
  fechaBasePlazo(): FechaCivil {
    if (this.tipo === 'fotodeteccion' && this.fechaNotificacion) {
      return this.fechaNotificacion;
    }
    return this.fecha;
  }

  estaConfirmado(campo: CampoComparendo): boolean {
    return this.camposConfirmados.includes(campo);
  }

  /** Devuelve un comparendo nuevo con los campos marcados como confirmados. */
  confirmar(...campos: CampoComparendo[]): Comparendo {
    return Comparendo.crear({ ...this.aDatos(), camposConfirmados: [...this.camposConfirmados, ...campos] });
  }

  /** Devuelve un comparendo nuevo con los cambios aplicados y validados. */
  con(cambios: Partial<DatosComparendo>): Comparendo {
    return Comparendo.crear({ ...this.aDatos(), ...cambios });
  }

  toJSON(): ComparendoJSON {
    return {
      numero: this.numero,
      fecha: this.fecha.aISO(),
      placa: this.placa,
      codigoInfraccion: this.codigoInfraccion,
      tipo: this.tipo,
      fechaNotificacion: this.fechaNotificacion ? this.fechaNotificacion.aISO() : null,
      organismo: this.organismo,
      camposConfirmados: [...this.camposConfirmados],
    };
  }

  static desdeJSON(json: ComparendoJSON): Comparendo {
    return Comparendo.crear({
      numero: json.numero,
      fecha: FechaCivil.desdeISO(json.fecha),
      placa: json.placa,
      codigoInfraccion: json.codigoInfraccion,
      tipo: json.tipo,
      fechaNotificacion: json.fechaNotificacion ? FechaCivil.desdeISO(json.fechaNotificacion) : null,
      organismo: json.organismo,
      camposConfirmados: json.camposConfirmados ?? [],
    });
  }

  private aDatos(): DatosComparendo {
    return {
      numero: this.numero,
      fecha: this.fecha,
      placa: this.placa,
      codigoInfraccion: this.codigoInfraccion,
      tipo: this.tipo,
      fechaNotificacion: this.fechaNotificacion,
      organismo: this.organismo,
      camposConfirmados: this.camposConfirmados,
    };
  }
}
