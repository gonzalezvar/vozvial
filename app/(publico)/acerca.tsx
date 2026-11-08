import { View } from 'react-native';

import { EtiquetaEstado, Pantalla, Tarjeta, Texto, Titulo, useTema } from '../../src/ui';
import { LO_REAL, LO_SIMULADO, type ElementoAcerca } from '../../src/ui/contenidoAcerca';

function Lista({
  elementos,
  testID,
  conEstado = true,
}: {
  elementos: readonly ElementoAcerca[];
  testID: string;
  conEstado?: boolean;
}) {
  const { espacio, colores } = useTema();
  return (
    <View accessibilityRole="list" testID={testID} style={{ gap: espacio.s, marginBottom: espacio.l }}>
      {elementos.map((e) => (
        <View
          key={e.titulo}
          accessibilityRole="listitem"
          style={{ borderBottomWidth: 1, borderBottomColor: colores.bordeSuave, paddingBottom: espacio.s, gap: espacio.xs }}
        >
          <Texto negrita>{e.titulo}</Texto>
          <Texto color="textoSuave">{e.detalle}</Texto>
          {conEstado ? (
            <EtiquetaEstado
              texto={e.estado === 'listo' ? 'Ya funciona' : 'En construcción'}
              tono={e.estado === 'listo' ? 'exito' : 'neutro'}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default function Acerca() {
  const { espacio } = useTema();
  return (
    <Pantalla titulo="Acerca del prototipo" volverA="/bienvenida">
      <Texto style={{ marginBottom: espacio.l }}>
        VozVial es el prototipo de un proyecto universitario. Aquí te contamos qué hace de verdad y qué está simulado.
      </Texto>
      <Tarjeta>
        <Titulo nivel={2}>Lo que es real</Titulo>
        <Lista elementos={LO_REAL} testID="lista-real" />
      </Tarjeta>
      <Tarjeta>
        <Titulo nivel={2}>Lo que es simulado o tiene límites</Titulo>
        {/* En los limites la etiqueta "Ya funciona" confundiria: solo se listan. */}
        <Lista elementos={LO_SIMULADO} testID="lista-simulado" conEstado={false} />
      </Tarjeta>
    </Pantalla>
  );
}
