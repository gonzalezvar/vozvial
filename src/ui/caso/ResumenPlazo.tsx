import type { Caso } from '../../core/Caso';
import { obtenerServicioPlazos, type EstadoPlazo, type NivelPlazo } from '../../services/ServicioPlazos';
import { Texto } from '../Texto';

const COLOR_NIVEL = {
  vencido: 'peligroTexto',
  hoy: 'urgenciaTexto',
  urgente: 'urgenciaTexto',
  en_tiempo: 'exitoTexto',
} as const satisfies Record<NivelPlazo, string>;

/** Estado del plazo del caso, o null si no se puede calcular. */
export function estadoPlazoSeguro(caso: Caso): EstadoPlazo | null {
  try {
    return obtenerServicioPlazos().estadoDeCaso(caso);
  } catch {
    return null;
  }
}

const SIN_COMPARENDO = 'Sin comparendo todavía: no hay plazo que contar.';
const SIN_CALCULO = 'No pudimos calcular el plazo de este comparendo.';

/** El mismo texto que muestra ResumenPlazo, para armar nombres accesibles. */
export function textoPlazo(caso: Caso): string {
  if (!caso.comparendo) return SIN_COMPARENDO;
  const estado = estadoPlazoSeguro(caso);
  if (!estado) return SIN_CALCULO;
  return estado.nivel === 'vencido' ? estado.mensaje : `${estado.mensaje} Vence el ${estado.resultado.fechaLimite.formatoLargo()}.`;
}

/** Días restantes del caso para la lista de casos (CA-11.4). */
export function ResumenPlazo({ caso }: { caso: Caso }) {
  if (!caso.comparendo) {
    return (
      <Texto variante="nota" color="textoSuave" testID={`plazo-${caso.id}`}>
        {SIN_COMPARENDO}
      </Texto>
    );
  }
  const estado = estadoPlazoSeguro(caso);
  if (!estado) {
    return (
      <Texto variante="nota" color="avisoTexto" testID={`plazo-${caso.id}`}>
        {SIN_CALCULO}
      </Texto>
    );
  }
  return (
    <Texto negrita color={COLOR_NIVEL[estado.nivel]} testID={`plazo-${caso.id}`}>
      {textoPlazo(caso)}
    </Texto>
  );
}
