import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTema } from './estadoAjustes';
import { aria, estiloFoco } from './foco';
import { Texto } from './Texto';

/** Elemento distintivo del inicio: un boton grande para cuando te detiene un agente (HU-07). */
export function BotonMePararon({ href, testID = 'boton-me-pararon' }: { href: Href; testID?: string }) {
  const tema = useTema();
  const { colores, espacio, radio, tipo, peso, elevacion } = tema;
  const [enfocado, setEnfocado] = useState(false);
  // Tope para que "Me pararon" quepa en una linea con letra "Muy grande" en 412 px de ancho.
  const grande = Math.min(tipo.destacado, 40);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Me pararon. Empieza a grabar lo que pasa"
      onPress={() => router.push(href)}
      onFocus={() => setEnfocado(true)}
      onBlur={() => setEnfocado(false)}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: 144,
          borderRadius: radio.xl,
          backgroundColor: pressed ? colores.urgenciaPresionado : colores.urgencia,
          paddingVertical: espacio.l,
          paddingHorizontal: espacio.l,
          flexDirection: 'row',
          alignItems: 'center',
          gap: espacio.m,
          marginBottom: espacio.l,
        },
        elevacion.media,
        enfocado && estiloFoco(tema),
      ]}
    >
      {/* Simbolo de grabacion: disco claro con punto, dibujado con vistas para que funcione tambien en Expo Go. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...aria({ 'aria-hidden': true })}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: 'rgba(255, 255, 255, 0.18)',
          borderWidth: 4,
          borderColor: colores.sobreUrgencia,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colores.sobreUrgencia }} />
      </View>
      {/* Un solo bloque de texto: el nombre accesible contiene el texto visible (WCAG 2.5.3). */}
      <Texto color="sobreUrgencia" style={{ flex: 1 }}>
        <Text style={{ fontSize: grande, lineHeight: tipo.alturaLinea(grande), fontWeight: peso.fuerte }}>Me pararon</Text>
        {'\nEmpieza a grabar lo que pasa'}
      </Texto>
    </Pressable>
  );
}
