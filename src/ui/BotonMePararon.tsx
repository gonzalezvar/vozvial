import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTema } from './estadoAjustes';
import { aria, estiloFoco } from './foco';
import { Texto } from './Texto';

/** Elemento distintivo del inicio: un boton grande para cuando te detiene un agente (HU-07). */
export function BotonMePararon({ href, testID = 'boton-me-pararon' }: { href: Href; testID?: string }) {
  const tema = useTema();
  const { colores, espacio, radio, tipo } = tema;
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
          minHeight: 150,
          borderRadius: radio.l,
          backgroundColor: pressed ? colores.urgenciaPresionado : colores.urgencia,
          padding: espacio.l,
          flexDirection: 'row',
          alignItems: 'center',
          gap: espacio.l,
          marginBottom: espacio.l,
          // Sombra plana: separa el boton del fondo sin degradados.
          borderBottomWidth: 6,
          borderBottomColor: colores.urgenciaPresionado,
        },
        enfocado && estiloFoco(tema),
      ]}
    >
      {/* Simbolo de grabacion: anillo blanco con punto. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...aria({ 'aria-hidden': true })}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          borderWidth: 5,
          borderColor: colores.sobreUrgencia,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colores.sobreUrgencia }} />
      </View>
      {/* Un solo bloque de texto: el nombre accesible contiene el texto visible (WCAG 2.5.3). */}
      <Texto color="sobreUrgencia" style={{ flex: 1 }}>
        <Text style={{ fontSize: grande, lineHeight: tipo.alturaLinea(grande), fontWeight: '800' }}>Me pararon</Text>
        {'\nEmpieza a grabar lo que pasa'}
      </Texto>
    </Pressable>
  );
}
