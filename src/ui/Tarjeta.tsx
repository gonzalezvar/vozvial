import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from './estadoAjustes';
import { Titulo } from './Texto';

interface PropsTarjeta {
  titulo?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Contenedor de una seccion de contenido sobre fondo blanco. */
export function Tarjeta({ titulo, children, style, testID }: PropsTarjeta) {
  const { colores, espacio, radio } = useTema();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: colores.superficie,
          borderColor: colores.bordeSuave,
          borderWidth: 1,
          borderRadius: radio.m,
          padding: espacio.m,
          gap: espacio.s,
          marginBottom: espacio.m,
        },
        style,
      ]}
    >
      {titulo ? <Titulo nivel={2}>{titulo}</Titulo> : null}
      {children}
    </View>
  );
}
