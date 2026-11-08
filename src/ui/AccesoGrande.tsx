import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTema } from './estadoAjustes';
import { aria, estiloFoco } from './foco';
import { Texto } from './Texto';

interface PropsAccesoGrande {
  titulo: string;
  descripcion: string;
  href: Href;
  testID?: string;
}

/** Acceso grande del inicio: titulo y una linea que explica para que sirve. */
export function AccesoGrande({ titulo, descripcion, href, testID }: PropsAccesoGrande) {
  const tema = useTema();
  const { colores, espacio, radio, medidas } = tema;
  const [enfocado, setEnfocado] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${titulo}. ${descripcion}`}
      onPress={() => router.push(href)}
      onFocus={() => setEnfocado(true)}
      onBlur={() => setEnfocado(false)}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: medidas.altoMinimoBoton + 24,
          padding: espacio.m,
          borderRadius: radio.m,
          borderWidth: 2,
          borderColor: colores.primario,
          backgroundColor: pressed ? colores.primarioSuave : colores.superficie,
          flexDirection: 'row',
          alignItems: 'center',
          gap: espacio.m,
        },
        enfocado && estiloFoco(tema),
      ]}
    >
      <Texto negrita color="primario" style={{ flex: 1 }}>
        {titulo}
        <Text
          style={{
            fontSize: tema.tipo.nota,
            lineHeight: tema.tipo.alturaLinea(tema.tipo.nota),
            fontWeight: '400',
            color: colores.textoSuave,
          }}
        >
          {`\n${descripcion}`}
        </Text>
      </Texto>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...aria({ 'aria-hidden': true })}>
        <Texto negrita color="primario" style={{ fontSize: tema.tipo.titulo }}>
          {'›'}
        </Texto>
      </View>
    </Pressable>
  );
}
