import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTema } from './estadoAjustes';
import { estiloFoco } from './foco';
import { Texto } from './Texto';

interface PropsCasilla {
  marcada: boolean;
  alCambiar: (marcada: boolean) => void;
  accessibilityLabel: string;
  /** Texto visible junto a la casilla. */
  children: ReactNode;
  error?: string | null;
  testID?: string;
}

/** Casilla de verificacion grande (toda la fila se puede tocar). */
export function Casilla({ marcada, alCambiar, accessibilityLabel, children, error, testID }: PropsCasilla) {
  const tema = useTema();
  const { colores, espacio, radio, medidas } = tema;
  const [enfocado, setEnfocado] = useState(false);
  return (
    <View style={{ marginBottom: espacio.m, gap: espacio.xs }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={accessibilityLabel}
        aria-checked={marcada}
        onPress={() => alCambiar(!marcada)}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        testID={testID}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.m,
            minHeight: medidas.altoMinimoBoton,
            paddingVertical: espacio.s,
            borderRadius: radio.s,
          },
          enfocado && estiloFoco(tema),
        ]}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radio.s,
            borderWidth: 3,
            borderColor: error ? colores.peligro : colores.primario,
            backgroundColor: marcada ? colores.primario : colores.superficie,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {marcada ? (
            <Texto negrita color="sobrePrimario" style={{ lineHeight: 28 }}>
              {'✓'}
            </Texto>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>{typeof children === 'string' ? <Texto>{children}</Texto> : children}</View>
      </Pressable>
      {error ? (
        <View accessibilityRole="alert" style={{ backgroundColor: colores.peligroSuave, borderRadius: radio.s, padding: espacio.s }}>
          <Texto negrita color="peligroTexto">
            {error}
          </Texto>
        </View>
      ) : null}
    </View>
  );
}
