import type { Cita } from './BaseNormativa';

export type { Cita } from './BaseNormativa';

/** Aviso legal que acompaña toda respuesta del asistente. */
export const AVISO_LEGAL = 'VozVial informa y organiza. No reemplaza a un abogado.' as const;

export const TEXTO_ABSTENCION = 'No tengo información verificada sobre eso.';

export const SUGERENCIA_ABSTENCION =
  'Puedes consultar en el organismo de tránsito de tu ciudad, en el SIMIT, con un abogado o en el consultorio jurídico gratuito de una universidad.';

export type TipoRespuesta = 'respuesta' | 'abstencion' | 'fuera_de_tema';
/** 'claude': respuesta redactada por Claude (API de Anthropic) a partir de la base verificada. */
export type ModoAsistente = 'verificado' | 'llm' | 'claude';

/**
 * Por qué una respuesta salió del modo verificado cuando el servidor tenía
 * configurado Claude: Claude no respondió a tiempo, rechazó la carga, falló o
 * devolvió una salida que no se pudo usar.
 */
export type MotivoRespaldo = 'tiempo_agotado' | 'limite' | 'servidor' | 'red' | 'configuracion' | 'salida_invalida';

export interface RespuestaAsistente {
  tipo: TipoRespuesta;
  texto: string;
  citas: Cita[];
  sugerencia?: string;
  /** Puntaje normalizado de la recuperación, entre 0 y 1. En modo 'claude' no hay recuperación y vale 0. */
  puntaje: number;
  modo: ModoAsistente;
  aviso: typeof AVISO_LEGAL;
  /** Pregunta verificada que se usó (solo modo verificado, para trazabilidad). */
  preguntaId?: string;
  /** Modelo que redactó la respuesta (solo modo 'claude'). */
  modelo?: string;
  /** Presente cuando Claude estaba configurado pero se respondió con el modo verificado. */
  respaldo?: MotivoRespaldo;
}

/** Contrato común de los proveedores: modo verificado (MiniSearch), modo LLM y Claude. */
export interface ProveedorRespuesta {
  readonly modo: ModoAsistente;
  responder(pregunta: string): Promise<RespuestaAsistente>;
}

export function crearAbstencion(modo: ModoAsistente, puntaje: number): RespuestaAsistente {
  return {
    tipo: 'abstencion',
    texto: TEXTO_ABSTENCION,
    citas: [],
    sugerencia: SUGERENCIA_ABSTENCION,
    puntaje: redondear(puntaje),
    modo,
    aviso: AVISO_LEGAL,
  };
}

export function redondear(valor: number): number {
  return Math.round(Math.max(0, Math.min(1, valor)) * 1000) / 1000;
}
