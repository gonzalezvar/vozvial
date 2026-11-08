import { View } from 'react-native';

import { useTema } from './estadoAjustes';
import { Texto } from './Texto';

export const TEXTO_AVISO_LEGAL = 'VozVial informa y organiza. No reemplaza a un abogado.';

/** Aviso legal visible en todas las pantallas (CA-06.4 y CLAUDE.md). */
export function AvisoLegal() {
  const { colores, espacio, radio } = useTema();
  return (
    <View
      accessibilityRole="note"
      testID="aviso-legal"
      style={{
        borderTopWidth: 2,
        borderTopColor: colores.bordeSuave,
        backgroundColor: colores.superficieAlterna,
        borderRadius: radio.s,
        padding: espacio.m,
        marginTop: espacio.l,
      }}
    >
      <Texto variante="nota" color="textoSuave" centrado>
        {TEXTO_AVISO_LEGAL}
      </Texto>
    </View>
  );
}
