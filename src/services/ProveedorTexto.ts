import type { DisponibilidadVoz, ProveedorVoz } from '../core/ProveedorVoz';

import { ErrorVoz, MOTIVO_SIN_RECONOCIMIENTO, ProveedorVozWeb } from './ProveedorVozWeb';

/**
 * Alternativa cuando no hay reconocimiento de voz: no escucha y explica por
 * qué. La pantalla muestra entonces el campo para escribir la pregunta.
 */
export class ProveedorTexto implements ProveedorVoz {
  constructor(private readonly motivo: string = MOTIVO_SIN_RECONOCIMIENTO) {}

  async disponible(): Promise<DisponibilidadVoz> {
    return { ok: false, motivo: this.motivo };
  }

  escuchar(): Promise<string> {
    return Promise.reject(new ErrorVoz('no_disponible', this.motivo));
  }

  detener(): void {}
}

/** Proveedor de voz del navegador si existe la Web Speech API; si no, la alternativa de escribir. */
export function crearProveedorVoz(): ProveedorVoz {
  const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : {};
  return w.SpeechRecognition || w.webkitSpeechRecognition ? new ProveedorVozWeb() : new ProveedorTexto();
}
