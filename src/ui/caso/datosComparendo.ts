import infraccionesJSON from '../../../data/infracciones.json';
import { CatalogoInfracciones, type CatalogoInfraccionesJSON, type Infraccion } from '../../core/CatalogoInfracciones';
import type { TipoComparendo } from '../../core/Comparendo';
import { FechaCivil } from '../../core/FechaCivil';

let catalogo: CatalogoInfracciones | null = null;

/** Catálogo con solo las infracciones verificadas de data/infracciones.json. */
export function obtenerCatalogo(): CatalogoInfracciones {
  catalogo ??= new CatalogoInfracciones(infraccionesJSON as unknown as CatalogoInfraccionesJSON);
  return catalogo;
}

export const ETIQUETA_TIPO: Readonly<Record<TipoComparendo, string>> = {
  via: 'En la vía',
  fotodeteccion: 'Por fotodetección (fotomulta)',
};

/** Acepta 13/11/2026, 13-11-2026 o 2026-11-13. Devuelve null si no es una fecha real. */
export function leerFecha(texto: string): FechaCivil | null {
  const t = texto.trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  try {
    if (m) return FechaCivil.de(Number(m[3]), Number(m[2]), Number(m[1]));
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    if (m) return FechaCivil.de(Number(m[1]), Number(m[2]), Number(m[3]));
  } catch {
    return null;
  }
  return null;
}

/** 13/11/2026. */
export function fechaCorta(fecha: FechaCivil): string {
  return `${String(fecha.dia).padStart(2, '0')}/${String(fecha.mes).padStart(2, '0')}/${fecha.anio}`;
}

const UNIDADES: Readonly<Record<string, string>> = {
  SMDLV: 'salarios mínimos diarios legales vigentes',
};

/** "15 SMDLV (salarios mínimos diarios legales vigentes)". */
export function sancionLegible(infraccion: Infraccion): string | null {
  if (!infraccion.sancion) return null;
  const { cantidad, unidad } = infraccion.sancion;
  const nombre = UNIDADES[unidad];
  return nombre ? `${cantidad} ${unidad} (${nombre})` : `${cantidad} ${unidad}`;
}

/** "Literal C, numeral 29". */
export function ubicacionEnArticulo(infraccion: Infraccion): string {
  return infraccion.numeral ? `literal ${infraccion.literal}, numeral ${infraccion.numeral}` : `literal ${infraccion.literal}`;
}
