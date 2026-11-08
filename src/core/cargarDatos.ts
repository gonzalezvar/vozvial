/**
 * Carga los JSON de data/ y construye la base normativa y el asistente.
 * Lo usan la app (Metro empaqueta los JSON), api/asistente.ts y los scripts.
 * Solo importa JSON y clases de src/core: nada de React ni de Node.
 */
import ley1581 from '../../data/normativa/ley-1581-2012.json';
import ley1801 from '../../data/normativa/ley-1801-2016.json';
import ley1843 from '../../data/normativa/ley-1843-2017.json';
import ley51 from '../../data/normativa/ley-51-1983.json';
import ley769art131 from '../../data/normativa/ley-769-2002-art131.json';
import ley769 from '../../data/normativa/ley-769-2002.json';
import unidadMulta from '../../data/normativa/unidad-multa.json';
import preguntasVerificadas from '../../data/preguntas-verificadas.json';
import { AsistenteNormativo } from './AsistenteNormativo';
import { BaseNormativa, type ArchivoNormativaJSON } from './BaseNormativa';
import { DetectorTema } from './DetectorTema';
import type { ProveedorRespuesta } from './ProveedorRespuesta';
import { ProveedorLLM, type FuncionFetch } from './ProveedorLLM';
import { ProveedorVerificado, type PreguntasVerificadasJSON } from './ProveedorVerificado';

/** Archivos de data/normativa con entradas (parametros.json va aparte, en ParametrosPlazos). */
export const ARCHIVOS_NORMATIVA: readonly ArchivoNormativaJSON[] = [
  ley769,
  ley769art131,
  ley1843,
  ley1801,
  ley1581,
  ley51,
  unidadMulta,
] as unknown as ArchivoNormativaJSON[];

export const PREGUNTAS_VERIFICADAS = preguntasVerificadas as unknown as PreguntasVerificadasJSON;

let baseCompartida: BaseNormativa | null = null;

/** Base normativa con solo las entradas verificadas. Se construye una vez. */
export function obtenerBaseNormativa(): BaseNormativa {
  if (!baseCompartida) baseCompartida = BaseNormativa.desdeArchivos(ARCHIVOS_NORMATIVA);
  return baseCompartida;
}

export interface OpcionesAsistente {
  /** Variables de entorno; el modo LLM solo se activa si traen LLM_BASE_URL y LLM_MODELO. */
  env?: Record<string, string | undefined>;
  /** fetch para el modo LLM. Sin él, el modo LLM no se activa. */
  fetch?: FuncionFetch;
  umbral?: number;
}

/** Proveedor de respuestas: verificado por defecto; LLM solo si el entorno lo configura. */
export function crearProveedor(opciones: OpcionesAsistente = {}): ProveedorRespuesta {
  const base = obtenerBaseNormativa();
  const configLLM = opciones.env ? ProveedorLLM.configDesdeEntorno(opciones.env) : null;
  if (configLLM && opciones.fetch) return new ProveedorLLM(base, configLLM, opciones.fetch);
  return new ProveedorVerificado(PREGUNTAS_VERIFICADAS, base, { umbral: opciones.umbral });
}

export function crearAsistente(opciones: OpcionesAsistente = {}): AsistenteNormativo {
  return new AsistenteNormativo(crearProveedor(opciones), new DetectorTema(), obtenerBaseNormativa());
}
