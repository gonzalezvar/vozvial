import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useTema } from './estadoAjustes';
import { estiloFoco } from './foco';
import { Texto } from './Texto';

export interface Opcion<T extends string> {
  valor: T;
  etiqueta: string;
  descripcion?: string;
}

interface PropsGrupoOpciones<T extends string> {
  /** Nombre del grupo para el lector de pantalla. */
  accessibilityLabel: string;
  opciones: readonly Opcion<T>[];
  seleccion: T | null;
  alElegir: (valor: T) => void;
  testID?: string;
}

/** Grupo de opciones excluyentes (radio) con botones grandes. */
export function GrupoOpciones<T extends string>({ accessibilityLabel, opciones, seleccion, alElegir, testID }: PropsGrupoOpciones<T>) {
  const { espacio } = useTema();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} testID={testID} style={{ gap: espacio.s }}>
      {opciones.map((opcion) => (
        <OpcionRadio
          key={opcion.valor}
          opcion={opcion}
          elegida={opcion.valor === seleccion}
          alElegir={() => alElegir(opcion.valor)}
        />
      ))}
    </View>
  );
}

function OpcionRadio<T extends string>({ opcion, elegida, alElegir }: { opcion: Opcion<T>; elegida: boolean; alElegir: () => void }) {
  const tema = useTema();
  const { colores, espacio, radio, medidas } = tema;
  const [enfocado, setEnfocado] = useState(false);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={opcion.etiqueta}
      aria-checked={elegida}
      onPress={alElegir}
      onFocus={() => setEnfocado(true)}
      onBlur={() => setEnfocado(false)}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: espacio.m,
          minHeight: medidas.altoMinimoBoton,
          padding: espacio.m,
          borderRadius: radio.m,
          borderWidth: 2,
          borderColor: elegida ? colores.primario : colores.borde,
          backgroundColor: elegida ? colores.primarioSuave : colores.superficie,
        },
        enfocado && estiloFoco(tema),
      ]}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: elegida ? colores.primario : colores.borde,
          backgroundColor: colores.superficie,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {elegida ? <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colores.primario }} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Texto negrita>{opcion.etiqueta}</Texto>
        {opcion.descripcion ? (
          <Texto variante="nota" color="textoSuave">
            {opcion.descripcion}
          </Texto>
        ) : null}
      </View>
    </Pressable>
  );
}
