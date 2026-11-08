import { Comparendo, type ComparendoJSON } from './Comparendo';
import { Evidencia, type EvidenciaJSON } from './Evidencia';

export interface Ubicacion {
  lat: number;
  lon: number;
  /** Radio de precisión en metros que reporta el dispositivo. */
  precision: number;
}

export type MotivoSinUbicacion = 'denegada' | 'no_disponible';

/**
 * registrando: modo "Me pararon" activo.
 * abierto: el registro terminó y el caso sigue en trámite.
 * solicitud_generada: ya se generó la solicitud de audiencia.
 * cerrado: el conductor lo dio por terminado.
 */
export type EstadoCaso = 'registrando' | 'abierto' | 'solicitud_generada' | 'cerrado';

export const ETIQUETAS_ESTADO: Readonly<Record<EstadoCaso, string>> = {
  registrando: 'Registrando',
  abierto: 'Abierto',
  solicitud_generada: 'Solicitud generada',
  cerrado: 'Cerrado',
};

/** Texto que se muestra cuando el caso no tiene ubicación (CA-07.2). */
export const TEXTO_SIN_UBICACION = 'Sin ubicación';

/** Datos del conductor para la solicitud. Se llenan poco a poco, por eso son opcionales. */
export interface DatosConductor {
  nombre?: string;
  cedula?: string;
  celular?: string;
  direccion?: string;
  correo?: string;
  ciudad?: string;
}

const CAMPOS_CONDUCTOR = ['nombre', 'cedula', 'celular', 'direccion', 'correo', 'ciudad'] as const;

export type CampoCaso = 'id' | 'creadoEn' | 'ubicacion' | 'motivoSinUbicacion' | 'evidencias' | 'estado';

export class ErrorCaso extends Error {
  constructor(
    readonly campo: CampoCaso,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorCaso';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface DatosCaso {
  id: string;
  /** Instante ISO 8601 con zona. */
  creadoEn: string;
  ubicacion: Ubicacion | null;
  /** Obligatorio cuando no hay ubicación; debe ser null cuando sí la hay. */
  motivoSinUbicacion?: MotivoSinUbicacion | null;
  evidencias?: readonly Evidencia[];
  comparendo?: Comparendo | null;
  conductor?: DatosConductor;
  estado?: EstadoCaso;
}

export interface CasoJSON {
  id: string;
  creadoEn: string;
  ubicacion: Ubicacion | null;
  motivoSinUbicacion: MotivoSinUbicacion | null;
  evidencias: EvidenciaJSON[];
  comparendo: ComparendoJSON | null;
  conductor: DatosConductor;
  estado: EstadoCaso;
}

const ESTADOS: readonly EstadoCaso[] = ['registrando', 'abierto', 'solicitud_generada', 'cerrado'];
const MOTIVOS: readonly MotivoSinUbicacion[] = ['denegada', 'no_disponible'];

/**
 * Caso que agrupa lo ocurrido en un procedimiento: ubicación, evidencias,
 * comparendo y datos del conductor. Inmutable: cada cambio devuelve un caso
 * nuevo, lo que encaja con el estado de la interfaz.
 */
export class Caso {
  readonly id: string;
  readonly creadoEn: string;
  readonly ubicacion: Readonly<Ubicacion> | null;
  readonly motivoSinUbicacion: MotivoSinUbicacion | null;
  readonly evidencias: readonly Evidencia[];
  readonly comparendo: Comparendo | null;
  readonly conductor: Readonly<DatosConductor>;
  readonly estado: EstadoCaso;

  private constructor(datos: {
    id: string;
    creadoEn: string;
    ubicacion: Ubicacion | null;
    motivoSinUbicacion: MotivoSinUbicacion | null;
    evidencias: readonly Evidencia[];
    comparendo: Comparendo | null;
    conductor: DatosConductor;
    estado: EstadoCaso;
  }) {
    this.id = datos.id;
    this.creadoEn = datos.creadoEn;
    this.ubicacion = datos.ubicacion ? Object.freeze({ ...datos.ubicacion }) : null;
    this.motivoSinUbicacion = datos.motivoSinUbicacion;
    this.evidencias = Object.freeze([...datos.evidencias]);
    this.comparendo = datos.comparendo;
    this.conductor = Object.freeze({ ...datos.conductor });
    this.estado = datos.estado;
    Object.freeze(this);
  }

  static crear(datos: DatosCaso): Caso {
    const id = (datos.id ?? '').trim();
    if (id === '') throw new ErrorCaso('id', 'El caso necesita un identificador.');

    if (!Evidencia.esInstanteValido(datos.creadoEn)) {
      throw new ErrorCaso('creadoEn', 'La fecha y hora del caso no es válida.');
    }

    const ubicacion = datos.ubicacion ?? null;
    const motivo = datos.motivoSinUbicacion ?? null;
    if (ubicacion !== null) {
      Caso.validarUbicacion(ubicacion);
      if (motivo !== null) {
        throw new ErrorCaso('motivoSinUbicacion', 'Un caso con ubicación no lleva motivo de ausencia.');
      }
    } else if (motivo === null || !MOTIVOS.includes(motivo)) {
      throw new ErrorCaso('motivoSinUbicacion', 'Indica por qué el caso no tiene ubicación.');
    }

    const evidencias = datos.evidencias ?? [];
    const ids = new Set<string>();
    for (const evidencia of evidencias) {
      if (!(evidencia instanceof Evidencia)) throw new ErrorCaso('evidencias', 'Evidencia inválida.');
      if (ids.has(evidencia.id)) throw new ErrorCaso('evidencias', `Evidencia repetida: ${evidencia.id}`);
      ids.add(evidencia.id);
    }

    const estado = datos.estado ?? 'registrando';
    if (!ESTADOS.includes(estado)) throw new ErrorCaso('estado', `Estado desconocido: ${String(estado)}`);

    return new Caso({
      id,
      creadoEn: datos.creadoEn,
      ubicacion,
      motivoSinUbicacion: ubicacion === null ? motivo : null,
      evidencias,
      comparendo: datos.comparendo ?? null,
      conductor: Caso.limpiarConductor(datos.conductor ?? {}),
      estado,
    });
  }

  private static validarUbicacion(u: Ubicacion): void {
    const valida =
      Number.isFinite(u.lat) &&
      Number.isFinite(u.lon) &&
      Number.isFinite(u.precision) &&
      u.lat >= -90 &&
      u.lat <= 90 &&
      u.lon >= -180 &&
      u.lon <= 180 &&
      u.precision >= 0;
    if (!valida) throw new ErrorCaso('ubicacion', 'La ubicación no es válida.');
  }

  /** Recorta espacios y descarta campos vacíos o desconocidos. */
  private static limpiarConductor(conductor: DatosConductor): DatosConductor {
    const limpio: DatosConductor = {};
    for (const campo of CAMPOS_CONDUCTOR) {
      const valor = conductor[campo];
      if (typeof valor === 'string' && valor.trim() !== '') limpio[campo] = valor.trim();
    }
    return limpio;
  }

  tieneUbicacion(): boolean {
    return this.ubicacion !== null;
  }

  /** "Sin ubicación" o las coordenadas con su precisión. */
  descripcionUbicacion(): string {
    if (!this.ubicacion) return TEXTO_SIN_UBICACION;
    const { lat, lon, precision } = this.ubicacion;
    return `${lat.toFixed(5)}, ${lon.toFixed(5)} (precisión de ${Math.round(precision)} m)`;
  }

  etiquetaEstado(): string {
    return ETIQUETAS_ESTADO[this.estado];
  }

  /** Evidencias en orden cronológico. */
  evidenciasOrdenadas(): Evidencia[] {
    return [...this.evidencias].sort((a, b) => a.instante() - b.instante());
  }

  buscarEvidencia(id: string): Evidencia | null {
    return this.evidencias.find((e) => e.id === id) ?? null;
  }

  agregarEvidencia(evidencia: Evidencia): Caso {
    return this.con({ evidencias: [...this.evidencias, evidencia] });
  }

  quitarEvidencia(id: string): Caso {
    return this.con({ evidencias: this.evidencias.filter((e) => e.id !== id) });
  }

  conComparendo(comparendo: Comparendo | null): Caso {
    return this.con({ comparendo });
  }

  /** Mezcla los datos nuevos del conductor con los que ya había. */
  conConductor(cambios: DatosConductor): Caso {
    return this.con({ conductor: { ...this.conductor, ...cambios } });
  }

  terminarRegistro(): Caso {
    return this.estado === 'registrando' ? this.con({ estado: 'abierto' }) : this;
  }

  marcarSolicitudGenerada(): Caso {
    return this.con({ estado: 'solicitud_generada' });
  }

  cerrar(): Caso {
    return this.con({ estado: 'cerrado' });
  }

  private con(cambios: Partial<DatosCaso>): Caso {
    return Caso.crear({
      id: this.id,
      creadoEn: this.creadoEn,
      ubicacion: this.ubicacion,
      motivoSinUbicacion: this.motivoSinUbicacion,
      evidencias: this.evidencias,
      comparendo: this.comparendo,
      conductor: this.conductor,
      estado: this.estado,
      ...cambios,
    });
  }

  toJSON(): CasoJSON {
    return {
      id: this.id,
      creadoEn: this.creadoEn,
      ubicacion: this.ubicacion ? { ...this.ubicacion } : null,
      motivoSinUbicacion: this.motivoSinUbicacion,
      evidencias: this.evidencias.map((e) => e.toJSON()),
      comparendo: this.comparendo ? this.comparendo.toJSON() : null,
      conductor: { ...this.conductor },
      estado: this.estado,
    };
  }

  static desdeJSON(json: CasoJSON): Caso {
    return Caso.crear({
      id: json.id,
      creadoEn: json.creadoEn,
      ubicacion: json.ubicacion,
      motivoSinUbicacion: json.motivoSinUbicacion,
      evidencias: (json.evidencias ?? []).map((e) => Evidencia.desdeJSON(e)),
      comparendo: json.comparendo ? Comparendo.desdeJSON(json.comparendo) : null,
      conductor: json.conductor ?? {},
      estado: json.estado,
    });
  }
}
