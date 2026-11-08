import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTema } from './estadoAjustes';
import { estiloFoco } from './foco';
import { Icono } from './Icono';
import type { NombreIcono } from './iconos';
import { Texto } from './Texto';

interface PropsAccesoGrande {
  titulo: string;
  descripcion: string;
  href: Href;
  /** Icono del destino, en un cuadro de color a la izquierda. */
  icono?: NombreIcono;
  testID?: string;
}

/** Acceso grande del inicio: icono, titulo, una linea que explica para que sirve y flecha. */
export function AccesoGrande({ titulo, descripcion, href, icono, testID }: PropsAccesoGrande) {
  const tema = useTema();
  const { colores, espacio, radio, medidas, tipo, peso, elevacion } = tema;
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
          minHeight: medidas.altoMinimoFila,
          paddingVertical: espacio.m,
          paddingHorizontal: espacio.m,
          borderRadius: radio.l,
          borderWidth: 1,
          borderColor: pressed ? colores.primario : colores.bordeSuave,
          backgroundColor: pressed ? colores.primarioSuave : colores.superficie,
          flexDirection: 'row',
          alignItems: 'center',
          gap: espacio.m,
        },
        elevacion.baja,
        enfocado && estiloFoco(tema),
      ]}
    >
      {icono ? (
        <View
          style={{
            width: medidas.cajaIcono,
            height: medidas.cajaIcono,
            borderRadius: radio.m,
            backgroundColor: colores.primarioSuave,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre={icono} color="primario" tamano={28} />
        </View>
      ) : null}
      {/* Un solo bloque de texto: el nombre accesible contiene el texto visible (WCAG 2.5.3).
          El bloque usa el interlineado del texto base; el titulo, mas grande, lleva el suyo. */}
      <Texto color="textoSuave" variante="nota" style={{ flex: 1 }}>
        <Text style={{ fontSize: tipo.subtitulo, lineHeight: tipo.alturaLinea(tipo.subtitulo), fontWeight: peso.medio, color: colores.texto }}>
          {titulo}
        </Text>
        {`\n${descripcion}`}
      </Texto>
      <Icono nombre="siguiente" color="primario" respaldo="›" />
    </Pressable>
  );
}
