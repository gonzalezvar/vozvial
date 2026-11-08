import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from './estadoAjustes';
import { Icono } from './Icono';
import { Texto } from './Texto';

export const TEXTO_AVISO_LEGAL = 'VozVial informa y organiza. No reemplaza a un abogado.';

/**
 * Aviso legal visible en todas las pantallas (CA-06.4 y CLAUDE.md). Es una nota, no un boton:
 * va sin caja, con una linea fina arriba y un icono de informacion.
 */
export function AvisoLegal({ style }: { style?: StyleProp<ViewStyle> } = {}) {
  const { colores, espacio } = useTema();
  return (
    <View
      accessibilityRole="note"
      testID="aviso-legal"
      style={[
        {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: espacio.s,
        borderTopWidth: 1,
        borderTopColor: colores.bordeSuave,
        paddingTop: espacio.m,
        marginTop: espacio.xl,
        },
        style,
      ]}
    >
      <Icono nombre="info" color="textoSuave" style={{ marginTop: 2 }} />
      <Texto variante="nota" color="textoSuave" style={{ flex: 1 }}>
        {TEXTO_AVISO_LEGAL}
      </Texto>
    </View>
  );
}
