import { View } from 'react-native';

import { useTema } from '../estadoAjustes';
import { Texto } from '../Texto';

interface PropsPasosNumerados {
  pasos: readonly string[];
  /** Nombre del grupo para el lector de pantalla. */
  accessibilityLabel: string;
  testID?: string;
}

/** Lista de pasos con el numero en un circulo grande. El lector de pantalla lee el numero y el paso. */
export function PasosNumerados({ pasos, accessibilityLabel, testID }: PropsPasosNumerados) {
  const { colores, espacio, radio, medidas, tipo, peso } = useTema();
  const lado = medidas.cajaIcono;
  return (
    <View accessibilityRole="list" accessibilityLabel={accessibilityLabel} testID={testID} style={{ gap: espacio.m, marginBottom: espacio.l }}>
      {pasos.map((paso, i) => (
        <View
          key={paso}
          accessibilityRole="listitem"
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m }}
        >
          <View
            style={{
              width: lado,
              height: lado,
              borderRadius: radio.circulo,
              backgroundColor: colores.primarioSuave,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Texto color="primario" style={{ fontSize: tipo.subtitulo, lineHeight: tipo.alturaLinea(tipo.subtitulo), fontWeight: peso.fuerte }}>
              {String(i + 1)}
            </Texto>
          </View>
          <Texto style={{ flex: 1, paddingTop: Math.max(0, (lado - tipo.alturaLinea(tipo.base)) / 2) }}>{paso}</Texto>
        </View>
      ))}
    </View>
  );
}
