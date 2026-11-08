import { Boton } from '../Boton';
import { ListaDatos } from '../Lista';
import { Tarjeta } from '../Tarjeta';
import { Texto } from '../Texto';
import { obtenerCatalogo } from './datosComparendo';
import { ResumenPlazo } from './ResumenPlazo';
import type { PropsSeccionCaso } from './tipos';

/** Comparendo del caso y su plazo, con acceso al detalle o al registro (HU-09 a HU-11). */
export function SeccionComparendo({ caso }: PropsSeccionCaso) {
  const comparendo = caso.comparendo;

  if (!comparendo) {
    return (
      <Tarjeta titulo="Comparendo" icono="comparendo" testID="seccion-comparendo">
        <Texto color="textoSuave">Este caso todavía no tiene comparendo. Regístralo para calcular tu plazo.</Texto>
        <Boton
          etiqueta="Registrar el comparendo"
          accessibilityRole="link"
          accessibilityLabel="Registrar el comparendo de este caso"
          variante="secundaria"
          icono="comparendo"
          href={{ pathname: '/comparendo/nuevo', params: { caso: caso.id } }}
        />
      </Tarjeta>
    );
  }

  const infraccion = obtenerCatalogo().buscar(comparendo.codigoInfraccion);
  return (
    <Tarjeta titulo="Comparendo y plazo" icono="comparendo" testID="seccion-comparendo">
      <ResumenPlazo caso={caso} />
      <ListaDatos
        datos={[
          { etiqueta: 'Número', valor: comparendo.numero },
          {
            etiqueta: 'Infracción',
            valor: `Código ${comparendo.codigoInfraccion}${infraccion ? `: ${infraccion.descripcionSencilla}` : ''}`,
          },
        ]}
      />
      <Boton
        etiqueta="Ver comparendo y plazo"
        accessibilityRole="link"
        accessibilityLabel={`Ver comparendo y plazo del comparendo ${comparendo.numero}`}
        variante="secundaria"
        iconoFinal="siguiente"
        href={`/comparendo/${caso.id}`}
      />
    </Tarjeta>
  );
}
