/** Lo minimo que se compara de un registro para sincronizar: id, marca de tiempo y si esta borrado. */
export interface MarcaRegistro {
  id: string;
  /** Instante ISO 8601 de la ultima modificacion (o del borrado). */
  actualizadoEn: string;
  borrado: boolean;
}

export interface PlanSincronizacion {
  /** Registros locales mas nuevos que los del servidor (o que el servidor no tiene): se suben. */
  subir: MarcaRegistro[];
  /** Registros del servidor mas nuevos que los locales (o que no estan en el dispositivo): se bajan. */
  bajar: MarcaRegistro[];
  /** Borrados en el servidor mas nuevos que la copia local: se borran del dispositivo. */
  borrarLocal: MarcaRegistro[];
}

/**
 * Sincronizacion por "gana el mas reciente" (last write wins) sobre actualizadoEn.
 * Los borrados viajan como marca (borrado: true) para que otro dispositivo tambien los aplique.
 * Si las dos copias tienen la misma marca de tiempo no se hace nada.
 */
export class ResolvedorSincronizacion {
  static planear(locales: readonly MarcaRegistro[], remotos: readonly MarcaRegistro[]): PlanSincronizacion {
    const plan: PlanSincronizacion = { subir: [], bajar: [], borrarLocal: [] };
    const porIdRemoto = new Map(remotos.map((r) => [r.id, r]));
    const idsLocales = new Set<string>();

    for (const local of locales) {
      idsLocales.add(local.id);
      const remoto = porIdRemoto.get(local.id);
      if (!remoto) {
        // Un borrado local que el servidor nunca conocio no hace falta subirlo.
        if (!local.borrado) plan.subir.push(local);
        continue;
      }
      const diferencia = ResolvedorSincronizacion.comparar(local, remoto);
      if (diferencia > 0) plan.subir.push(local);
      else if (diferencia < 0) {
        if (remoto.borrado) {
          if (!local.borrado) plan.borrarLocal.push(remoto);
        } else plan.bajar.push(remoto);
      }
    }

    for (const remoto of remotos) {
      if (idsLocales.has(remoto.id) || remoto.borrado) continue;
      plan.bajar.push(remoto);
    }
    return plan;
  }

  /** Positivo si a es mas reciente que b, negativo si es mas antiguo, 0 si empatan. */
  static comparar(a: MarcaRegistro, b: MarcaRegistro): number {
    const ta = Date.parse(a.actualizadoEn);
    const tb = Date.parse(b.actualizadoEn);
    return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
  }
}
