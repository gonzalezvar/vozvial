export type TipoEvidencia = 'audio' | 'foto' | 'nota';

export const TIPOS_EVIDENCIA: readonly TipoEvidencia[] = ['audio', 'foto', 'nota'];

export type CampoEvidencia = 'id' | 'tipo' | 'creadaEn' | 'mime' | 'nombre' | 'tamano' | 'texto' | 'duracionMs';

export class ErrorEvidencia extends Error {
  constructor(
    readonly campo: CampoEvidencia,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorEvidencia';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface DatosEvidencia {
  id: string;
  tipo: TipoEvidencia;
  /** Instante de creación en ISO 8601 con zona (por ejemplo "2026-11-13T20:45:00.000Z"). */
  creadaEn: string;
  /** Tipo MIME del archivo. Obligatorio para audio y foto; null en notas. */
  mime?: string | null;
  nombre?: string | null;
  /** Tamaño del contenido en bytes. 0 en notas sin archivo. */
  tamano?: number;
  /** Texto de la nota, o comentario opcional sobre un audio o una foto. */
  texto?: string | null;
  /** Duración de un audio en milisegundos, si se conoce. */
  duracionMs?: number | null;
}

export interface EvidenciaJSON {
  id: string;
  tipo: TipoEvidencia;
  creadaEn: string;
  mime: string | null;
  nombre: string | null;
  tamano: number;
  texto: string | null;
  duracionMs: number | null;
}

// Instante ISO 8601 con zona explícita: Z o +hh:mm.
const PATRON_INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Metadatos de una evidencia del caso. El contenido binario (audio o imagen)
 * no vive aquí: va cifrado en el almacén y se busca por el id.
 */
export class Evidencia {
  readonly id: string;
  readonly tipo: TipoEvidencia;
  readonly creadaEn: string;
  readonly mime: string | null;
  readonly nombre: string | null;
  readonly tamano: number;
  readonly texto: string | null;
  readonly duracionMs: number | null;

  private constructor(datos: EvidenciaJSON) {
    this.id = datos.id;
    this.tipo = datos.tipo;
    this.creadaEn = datos.creadaEn;
    this.mime = datos.mime;
    this.nombre = datos.nombre;
    this.tamano = datos.tamano;
    this.texto = datos.texto;
    this.duracionMs = datos.duracionMs;
    Object.freeze(this);
  }

  static crear(datos: DatosEvidencia): Evidencia {
    const id = (datos.id ?? '').trim();
    if (id === '') throw new ErrorEvidencia('id', 'La evidencia necesita un identificador.');

    if (!TIPOS_EVIDENCIA.includes(datos.tipo)) {
      throw new ErrorEvidencia('tipo', `Tipo de evidencia desconocido: ${String(datos.tipo)}`);
    }

    if (!Evidencia.esInstanteValido(datos.creadaEn)) {
      throw new ErrorEvidencia('creadaEn', 'La fecha y hora de la evidencia no es válida.');
    }

    const mime = datos.mime?.trim() ? datos.mime.trim().toLowerCase() : null;
    const texto = datos.texto?.trim() ? datos.texto.trim() : null;
    const nombre = datos.nombre?.trim() ? datos.nombre.trim() : null;
    const tamano = datos.tamano ?? 0;
    const duracionMs = datos.duracionMs ?? null;

    if (!Number.isInteger(tamano) || tamano < 0) {
      throw new ErrorEvidencia('tamano', 'El tamaño de la evidencia debe ser un número entero de bytes.');
    }

    if (datos.tipo === 'nota') {
      if (texto === null) throw new ErrorEvidencia('texto', 'Escribe o dicta la nota antes de guardarla.');
    } else {
      const prefijo = datos.tipo === 'audio' ? 'audio/' : 'image/';
      if (mime === null || !mime.startsWith(prefijo)) {
        throw new ErrorEvidencia('mime', `El archivo no es ${datos.tipo === 'audio' ? 'un audio' : 'una imagen'}.`);
      }
      if (tamano === 0) throw new ErrorEvidencia('tamano', 'El archivo está vacío.');
    }

    if (duracionMs !== null) {
      if (datos.tipo !== 'audio') throw new ErrorEvidencia('duracionMs', 'Solo los audios tienen duración.');
      if (!Number.isFinite(duracionMs) || duracionMs < 0) {
        throw new ErrorEvidencia('duracionMs', 'La duración del audio no es válida.');
      }
    }

    return new Evidencia({
      id,
      tipo: datos.tipo,
      creadaEn: datos.creadaEn,
      mime,
      nombre,
      tamano,
      texto,
      duracionMs,
    });
  }

  static esInstanteValido(texto: unknown): texto is string {
    return typeof texto === 'string' && PATRON_INSTANTE.test(texto) && !Number.isNaN(Date.parse(texto));
  }

  /** Milisegundos desde la época, para ordenar evidencias. */
  instante(): number {
    return Date.parse(this.creadaEn);
  }

  /** Indica si hay contenido cifrado asociado en el almacén (audio o foto). */
  tieneArchivo(): boolean {
    return this.tipo !== 'nota';
  }

  toJSON(): EvidenciaJSON {
    return {
      id: this.id,
      tipo: this.tipo,
      creadaEn: this.creadaEn,
      mime: this.mime,
      nombre: this.nombre,
      tamano: this.tamano,
      texto: this.texto,
      duracionMs: this.duracionMs,
    };
  }

  static desdeJSON(json: EvidenciaJSON): Evidencia {
    return Evidencia.crear(json);
  }
}
