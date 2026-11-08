import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from './estadoAjustes';
import { Icono } from './Icono';
import type { NombreIcono } from './iconos';
import { Texto, Titulo } from './Texto';

interface PropsTarjeta {
  titulo?: string;
  /** Una frase bajo el titulo, en gris. */
  descripcion?: string;
  /** Icono junto al titulo. */
  icono?: NombreIcono;
  /** Nivel semantico del titulo. Por defecto h2 (se ve del tamano de un h3). */
  nivelTitulo?: 2 | 3;
  /**
   * normal: blanca con borde fino. alterna: fondo papel oscuro, para bloques secundarios dentro
   * de otra tarjeta. resaltada: borde de color primario, para el bloque mas importante de la pantalla.
   */
  variante?: 'normal' | 'alterna' | 'resaltada';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Superficie que agrupa un bloque de contenido relacionado. */
export function Tarjeta({ titulo, descripcion, icono, nivelTitulo = 2, variante = 'normal', children, style, testID }: PropsTarjeta) {
  const { colores, espacio, radio, elevacion } = useTema();
  const fondo = variante === 'alterna' ? colores.superficieAlterna : colores.superficie;
  const borde = variante === 'resaltada' ? colores.primario : variante === 'alterna' ? colores.superficieAlterna : colores.bordeSuave;
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: fondo,
          borderColor: borde,
          borderWidth: variante === 'resaltada' ? 2 : 1,
          borderRadius: radio.l,
          padding: espacio.m,
          gap: espacio.ms,
          marginBottom: espacio.m,
        },
        variante === 'alterna' ? null : elevacion.baja,
        style,
      ]}
    >
      {titulo ? (
        <View style={{ gap: espacio.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
            {icono ? <Icono nombre={icono} color="primario" /> : null}
            <Titulo nivel={nivelTitulo} tamanoVisual={3} style={{ flex: 1 }}>
              {titulo}
            </Titulo>
          </View>
          {descripcion ? (
            <Texto variante="nota" color="textoSuave">
              {descripcion}
            </Texto>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
