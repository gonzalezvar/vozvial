import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTema } from './estadoAjustes';
import { estiloFoco } from './foco';
import { Icono } from './Icono';
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
            borderWidth: 2,
            borderColor: error ? colores.peligro : marcada ? colores.primario : colores.borde,
            backgroundColor: marcada ? colores.primario : colores.superficie,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {marcada ? <Icono nombre="check" color="sobrePrimario" tamano={26} respaldo="✓" /> : null}
        </View>
        <View style={{ flex: 1 }}>{typeof children === 'string' ? <Texto>{children}</Texto> : children}</View>
      </Pressable>
      {error ? (
        <View
          accessibilityRole="alert"
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s, backgroundColor: colores.peligroSuave, borderRadius: radio.s, paddingHorizontal: espacio.ms, paddingVertical: espacio.s }}
        >
          <Icono nombre="alerta" color="peligroTexto" style={{ marginTop: 2 }} />
          <Texto negrita color="peligroTexto" style={{ flex: 1 }}>
            {error}
          </Texto>
        </View>
      ) : null}
    </View>
  );
}
