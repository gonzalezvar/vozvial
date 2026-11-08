/**
 * Contrato para reconocer la voz del usuario. Las implementaciones viven en
 * src/services/ (ProveedorVozWeb con Web Speech API, ProveedorTexto para
 * escribir). El dominio solo conoce esta interfaz.
 */

export interface DisponibilidadVoz {
  ok: boolean;
  /** Explicación en lenguaje sencillo cuando no está disponible. */
  motivo?: string;
}

export interface OpcionesEscucha {
  /** Idioma BCP 47. Por defecto "es-CO". */
  idioma?: string;
  /** Tiempo máximo de escucha en milisegundos. */
  tiempoMaximoMs?: number;
  /** Texto parcial mientras la persona habla. */
  alParcial?: (texto: string) => void;
}

export interface ProveedorVoz {
  disponible(): Promise<DisponibilidadVoz>;
  /** Resuelve con el texto reconocido; rechaza si se niega el micrófono o no se entiende nada. */
  escuchar(opciones?: OpcionesEscucha): Promise<string>;
  detener(): void;
}
