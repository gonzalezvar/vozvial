/**
 * Arma el asistente del servidor (SOLO SERVIDOR: importa el SDK de Anthropic).
 * - Con ANTHROPIC_API_KEY (y ASISTENTE_MODO distinto de "verificado"): Claude,
 *   con el modo verificado como respaldo si Claude falla.
 * - Sin llave: lo de siempre (crearAsistente de src/core: verificado, o LLM si
 *   hay LLM_BASE_URL y LLM_MODELO).
 */
import Anthropic from '@anthropic-ai/sdk';

import { AsistenteNormativo } from '../core/AsistenteNormativo';
import { crearAsistente, obtenerBaseNormativa, PREGUNTAS_VERIFICADAS } from '../core/cargarDatos';
import { DetectorTema } from '../core/DetectorTema';
import type { FuncionFetch } from '../core/ProveedorLLM';
import { ProveedorVerificado } from '../core/ProveedorVerificado';
import { ControlConsumo } from './ControlConsumo';
import { ProveedorClaude, type ClienteMensajesClaude, type OpcionesProveedorClaude } from './ProveedorClaude';

export interface OpcionesAsistenteServidor {
  env: Record<string, string | undefined>;
  /** fetch para el modo LLM compatible con OpenAI (solo si no hay llave de Anthropic). */
  fetch?: FuncionFetch;
  /** Fábrica del cliente; en las pruebas devuelve un cliente falso. */
  crearCliente?: (apiKey: string, timeoutMs: number) => ClienteMensajesClaude;
  opcionesClaude?: OpcionesProveedorClaude;
  /** Topes de consumo. Si no se pasa, se crea uno con los límites del entorno. */
  control?: ControlConsumo;
}

/** Opciones del cliente oficial. Se exportan para probar que el SDK no registra contenido. */
export function opcionesClienteAnthropic(apiKey: string, timeoutMs: number) {
  return {
    apiKey,
    timeout: timeoutMs,
    // Sin reintentos del SDK: un reintento duplicaría la espera; si falla, responde el modo verificado.
    maxRetries: 0,
    // Explícito para que ANTHROPIC_LOG=debug no haga que el SDK escriba en el log el cuerpo de
    // la petición, que incluye la pregunta. La opción del constructor tiene prioridad sobre la variable.
    logLevel: 'warn' as const,
    // Por la misma razón, sin trazas de OpenTelemetry aunque se configuren por variables de entorno.
    openTelemetry: false as const,
  };
}

function clienteAnthropic(apiKey: string, timeoutMs: number): ClienteMensajesClaude {
  return new Anthropic(opcionesClienteAnthropic(apiKey, timeoutMs));
}

export function crearAsistenteServidor(opciones: OpcionesAsistenteServidor): AsistenteNormativo {
  const config = ProveedorClaude.configDesdeEntorno(opciones.env);
  if (!config) return crearAsistente({ env: opciones.env, fetch: opciones.fetch });

  const base = obtenerBaseNormativa();
  const cliente = (opciones.crearCliente ?? clienteAnthropic)(config.apiKey, config.timeoutMs);
  const respaldo = new ProveedorVerificado(PREGUNTAS_VERIFICADAS, base);
  const control = opciones.control ?? new ControlConsumo(ControlConsumo.limitesDesdeEntorno(opciones.env));
  const proveedor = new ProveedorClaude(
    cliente,
    base,
    respaldo,
    { modelo: config.modelo, esfuerzo: config.esfuerzo, timeoutMs: config.timeoutMs, reintentoMs: config.reintentoMs },
    { detectorRespaldo: new DetectorTema(), permitirConsulta: () => control.consumirGlobal(), ...opciones.opcionesClaude },
  );
  // Sin prefiltro de tema: Claude clasifica "fuera_de_tema" (ver AsistenteNormativo).
  return new AsistenteNormativo(proveedor, null, base);
}
