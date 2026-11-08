import type { BaseNormativa, Cita } from './BaseNormativa';

/**
 * Entradas de la base que se muestran en "Me pararon" (CA-07.3), en este orden:
 * grabar el procedimiento, como debe ser el comparendo, inmovilizacion y audiencia.
 * Si alguna deja de estar verificada, BaseNormativa la descarta y no se muestra.
 */
export const IDS_DERECHOS_ME_PARARON: readonly string[] = [
  'L1801-2016-art21',
  'L769-2002-art135',
  'L769-2002-art125',
  'L769-2002-art136',
];

export interface DerechoClave {
  id: string;
  /** Resumen sencillo tal como esta en la base verificada. */
  resumen: string;
  cita: Cita;
}

/** Derechos a la vista durante el procedimiento, tomados solo de entradas verificadas. */
export class DerechosClave {
  constructor(
    private readonly base: BaseNormativa,
    private readonly ids: readonly string[] = IDS_DERECHOS_ME_PARARON,
  ) {}

  lista(): DerechoClave[] {
    const salida: DerechoClave[] = [];
    const vistos = new Set<string>();
    for (const id of this.ids) {
      if (vistos.has(id)) continue;
      vistos.add(id);
      const entrada = this.base.porId(id);
      const cita = this.base.cita(id);
      // Sin resumen no hay texto sencillo que mostrar: se omite antes que inventarlo.
      if (!entrada || !cita || !entrada.resumenSencillo.trim()) continue;
      salida.push({ id, resumen: entrada.resumenSencillo, cita });
    }
    return salida;
  }

  /** Ids pedidos que no se muestran por no estar verificados o no tener resumen. */
  omitidos(): string[] {
    const mostrados = new Set(this.lista().map((d) => d.id));
    return this.ids.filter((id) => !mostrados.has(id));
  }
}
