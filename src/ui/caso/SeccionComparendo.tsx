import { View } from 'react-native';

import { Boton } from '../Boton';
import { useTema } from '../estadoAjustes';
import { Tarjeta } from '../Tarjeta';
import { Texto } from '../Texto';
import { obtenerCatalogo } from './datosComparendo';
import { ResumenPlazo } from './ResumenPlazo';
import type { PropsSeccionCaso } from './tipos';

/** Comparendo del caso y su plazo, con acceso al detalle o al registro (HU-09 a HU-11). */
export function SeccionComparendo({ caso }: PropsSeccionCaso) {
  const { espacio } = useTema();
  const comparendo = caso.comparendo;

  if (!comparendo) {
    return (
      <Tarjeta titulo="Comparendo" testID="seccion-comparendo">
        <Texto style={{ marginBottom: espacio.m }}>Este caso todavía no tiene comparendo.</Texto>
        <Boton
          etiqueta="Registrar el comparendo"
          accessibilityRole="link"
          accessibilityLabel="Registrar el comparendo de este caso"
          href={{ pathname: '/comparendo/nuevo', params: { caso: caso.id } }}
        />
      </Tarjeta>
    );
  }

  const infraccion = obtenerCatalogo().buscar(comparendo.codigoInfraccion);
  return (
    <Tarjeta titulo="Comparendo" testID="seccion-comparendo">
      <View style={{ gap: espacio.s, marginBottom: espacio.m }}>
        <Texto>Número: {comparendo.numero}</Texto>
        <Texto>
          Código {comparendo.codigoInfraccion}
          {infraccion ? `: ${infraccion.descripcionSencilla}` : ''}
        </Texto>
        <ResumenPlazo caso={caso} />
      </View>
      <Boton
        etiqueta="Ver comparendo y plazo"
        accessibilityRole="link"
        accessibilityLabel={`Ver el comparendo ${comparendo.numero} y su plazo`}
        href={`/comparendo/${caso.id}`}
      />
    </Tarjeta>
  );
}
