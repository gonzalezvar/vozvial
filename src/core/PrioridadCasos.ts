import type { Caso } from './Caso';
import type { FechaCivil } from './FechaCivil';

/** Lo minimo del plazo de un caso que hace falta para ordenarlo. */
export interface PlazoParaOrden {
  fechaLimite: FechaCivil;
  vencido: boolean;
}

/**
 * Grupo de urgencia de un caso, de mas a menos urgente:
 * 0 plazo corriendo, 1 sin comparendo (todavia no hay plazo), 2 plazo vencido, 3 caso cerrado.
 */
export type GrupoUrgencia = 0 | 1 | 2 | 3;

/**
 * CA-14.1: ordena "Mis casos" por urgencia. Primero los casos con el plazo mas proximo; despues
 * los que todavia no tienen comparendo, luego los vencidos (el que vencio hace menos, primero) y
 * al final los cerrados. Si empatan, el caso mas reciente va primero.
 *
 * El plazo se inyecta para no depender de como se calcula (ServicioPlazos con los parametros
 * verificados). Si el plazo no se puede calcular, el caso cuenta como sin plazo.
 */
export class PrioridadCasos {
  constructor(private readonly plazoDe: (caso: Caso) => PlazoParaOrden | null) {}

  grupo(caso: Caso, plazo: PlazoParaOrden | null): GrupoUrgencia {
    if (caso.estado === 'cerrado') return 3;
    if (!plazo) return 1;
    return plazo.vencido ? 2 : 0;
  }

  /** Devuelve una lista nueva; no cambia la original. */
  ordenar(casos: readonly Caso[]): Caso[] {
    const conPlazo = casos.map((caso) => {
      let plazo: PlazoParaOrden | null;
      try {
        plazo = this.plazoDe(caso);
      } catch {
        plazo = null;
      }
      return { caso, plazo, grupo: this.grupo(caso, plazo) };
    });
    return conPlazo
      .sort((a, b) => {
        if (a.grupo !== b.grupo) return a.grupo - b.grupo;
        if (a.plazo && b.plazo && (a.grupo === 0 || a.grupo === 2)) {
          const diferencia = a.plazo.fechaLimite.comparar(b.plazo.fechaLimite);
          // Corriendo: el que vence antes. Vencidos: el que vencio hace menos.
          if (diferencia !== 0) return a.grupo === 0 ? diferencia : -diferencia;
        }
        return Date.parse(b.caso.creadoEn) - Date.parse(a.caso.creadoEn);
      })
      .map((x) => x.caso);
  }
}
