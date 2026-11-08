import type { BaseNormativa, Cita } from './BaseNormativa';
import { DetectorTema, MENSAJE_FUERA_DE_TEMA } from './DetectorTema';
import {
  AVISO_LEGAL,
  crearAbstencion,
  type ProveedorRespuesta,
  type RespuestaAsistente,
} from './ProveedorRespuesta';

/** Largo máximo de la pregunta, el mismo que valida api/asistente.ts. */
export const MAX_CARACTERES_PREGUNTA = 500;

/**
 * Asistente normativo: primero decide si la pregunta es del tema y luego le
 * pide la respuesta al proveedor (verificado o LLM). Garantiza dos cosas sin
 * importar el proveedor: toda respuesta lleva el aviso legal y ninguna
 * respuesta de tipo 'respuesta' sale sin al menos una cita.
 * Si recibe la base normativa, además exige que cada cita sea una entrada
 * verificada de esa base con su mismo texto literal; si no, se abstiene.
 */
export class AsistenteNormativo {
  constructor(
    private readonly proveedor: ProveedorRespuesta,
    private readonly detector: DetectorTema = new DetectorTema(),
    private readonly base: BaseNormativa | null = null,
  ) {}

  get modo(): ProveedorRespuesta['modo'] {
    return this.proveedor.modo;
  }

  async responder(pregunta: string): Promise<RespuestaAsistente> {
    const limpia = pregunta.trim().slice(0, MAX_CARACTERES_PREGUNTA);
    if (!limpia) return crearAbstencion(this.proveedor.modo, 0);

    if (!this.detector.esDelTema(limpia)) {
      return {
        tipo: 'fuera_de_tema',
        texto: MENSAJE_FUERA_DE_TEMA,
        citas: [],
        puntaje: 0,
        modo: this.proveedor.modo,
        aviso: AVISO_LEGAL,
      };
    }

    let respuesta: RespuestaAsistente;
    try {
      respuesta = await this.proveedor.responder(limpia);
    } catch {
      // Un fallo del proveedor nunca se convierte en una respuesta sin sustento.
      return crearAbstencion(this.proveedor.modo, 0);
    }

    if (respuesta.tipo === 'respuesta' && !this.citasValidas(respuesta.citas)) {
      return crearAbstencion(this.proveedor.modo, respuesta.puntaje);
    }
    return { ...respuesta, aviso: AVISO_LEGAL };
  }

  /** Al menos una cita, todas con texto literal y fuente, y (si hay base) todas presentes en ella sin alterar. */
  private citasValidas(citas: readonly Cita[]): boolean {
    if (citas.length === 0) return false;
    return citas.every((c) => {
      if (!c.textoLiteral?.trim() || !c.urlFuente?.trim()) return false;
      if (!this.base) return true;
      const entrada = this.base.porId(c.id);
      return entrada !== null && entrada.textoLiteral === c.textoLiteral && entrada.urlFuente === c.urlFuente;
    });
  }
}
